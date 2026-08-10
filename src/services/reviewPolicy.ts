import {
  ReviewType,
  ReviewTriggerReason,
  ReviewPriority,
  ReviewStatus,
  MasteryState,
  LearningEvidence,
  ReviewCompletion,
  RecommendationConfidence,
} from '../types';
import { classifyMasterySource } from './masteryEngine';

export const REVIEW_POLICY_VERSION = 'INITIAL_REVIEW_POLICY_V1';

export interface ReviewWindowResult {
  start: string; // ISO String or YYYY-MM-DD
  end: string;
  rationale: string;
}

export type RecencyStatus = 'RECENT' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface RecencyEvaluationInput {
  masteryState: MasteryState;
  evidences: LearningEvidence[];
  previousReviews?: any[];
  previousCompletions?: ReviewCompletion[];
  now?: string;
}

/**
 * Helper to normalize exam weight (supports 1-10 or 0-1) to 0-1
 */
export function normalizeExamWeight(weightInExam?: number): number {
  if (weightInExam === undefined || weightInExam === null) return 0.5;
  if (typeof weightInExam !== 'number' || isNaN(weightInExam)) return 0.5;
  const clamped = Math.max(0, Math.min(10, weightInExam));
  return Number((clamped / 10).toFixed(2));
}

/**
 * Pure function to evaluate evidence recency
 * Separates independent application (SUPPORTING/FRAGILE question attempts) from successful retention checks
 */
export function evaluateEvidenceRecency(input: RecencyEvaluationInput): RecencyStatus {
  const { masteryState, evidences, previousCompletions = [], now = new Date().toISOString() } = input;

  if (!evidences) {
    return 'UNKNOWN';
  }

  // Group QUESTION_ATTEMPT evidence by sourceId to classify sources
  const appEvidences = evidences.filter(e => e.type === 'QUESTION_ATTEMPT');
  const sourceMap = new Map<string, LearningEvidence[]>();
  for (const ev of appEvidences) {
    if (!ev.sourceId) continue;
    const existing = sourceMap.get(ev.sourceId) || [];
    existing.push(ev);
    sourceMap.set(ev.sourceId, existing);
  }

  let lastIndependentApplicationAt = 0;
  for (const sourceEvs of sourceMap.values()) {
    const classification = classifyMasterySource(sourceEvs);
    if (classification === 'SUPPORTING' || classification === 'FRAGILE') {
      const newestInSource = Math.max(...sourceEvs.map(e => new Date(e.createdAt).getTime()));
      if (newestInSource > lastIndependentApplicationAt) {
        lastIndependentApplicationAt = newestInSource;
      }
    }
  }

  const QUESTION_BASED_TYPES: ReviewType[] = [
    'TARGETED_QUESTIONS',
    'REATTEMPT_WITHOUT_SUPPORT',
    'DIAGNOSTIC_RETEST',
  ];

  const previousReviewsList = input.previousReviews || [];

  const successfulCompletions = previousCompletions
    .filter(c => {
      if (c.outcome !== 'SUCCESS_CONFIDENT' && c.outcome !== 'SUCCESS_EFFORTFUL') {
        return false;
      }
      const review = previousReviewsList.find(r => r.id === c.reviewId);
      if (!review) {
        // Completion sem Review correspondente encontrada: política conservadora, não renova retenção
        return false;
      }
      if (QUESTION_BASED_TYPES.includes(review.reviewType)) {
        // Question-based reviews exigem evidências objetivas (QUESTION_ATTEMPT)
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  let lastSuccessfulRetentionCheckAt = 0;
  if (successfulCompletions.length > 0) {
    lastSuccessfulRetentionCheckAt = new Date(successfulCompletions[0].completedAt).getTime();
  }

  const latestTimestamp = Math.max(lastIndependentApplicationAt, lastSuccessfulRetentionCheckAt);

  if (latestTimestamp === 0) {
    return 'UNKNOWN';
  }

  const currentDate = new Date(now).getTime();
  const diffMs = currentDate - latestTimestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let recencyThresholdDays = 14;
  if (masteryState.confidence === 'HIGH') {
    recencyThresholdDays = 30;
  } else if (masteryState.confidence === 'MODERATE') {
    recencyThresholdDays = 21;
  }

  if (diffDays <= recencyThresholdDays) {
    return 'RECENT';
  } else if (diffDays <= recencyThresholdDays * 2) {
    return 'AGING';
  } else {
    return 'STALE';
  }
}

/**
 * Derives the review status based on current date relative to the window
 */
export function deriveReviewStatusFromWindow({
  start,
  end,
  now = new Date().toISOString(),
}: {
  start?: string;
  end?: string;
  now?: string;
}): ReviewStatus {
  if (!start || !end) return 'AVAILABLE';
  const currentDate = new Date(now).getTime();
  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();

  if (currentDate < startDate) {
    return 'SCHEDULED';
  } else if (currentDate > endDate) {
    return 'REASSESS';
  } else {
    return 'AVAILABLE';
  }
}

/**
  * Central policy function to calculate review windows based on trigger reason, mastery, and history
  */
export function calculateReviewWindow({
  triggerReason,
  mastery,
  previousCompletions = [],
  topicWeight = 1,
  daysUntilExam,
  recencyStatus,
  now = new Date().toISOString(),
}: {
  triggerReason: ReviewTriggerReason;
  mastery: MasteryState;
  previousCompletions?: ReviewCompletion[];
  topicWeight?: number; // Weight in exam / importance multiplier (1-10 or 0-1)
  daysUntilExam?: number;
  recencyStatus?: RecencyStatus;
  now?: string;
}): ReviewWindowResult {
  const currentDate = new Date(now);
  
  // Base offset days from current date determined by trigger reason
  let startOffsetDays = 2;
  let endOffsetDays = 5;
  let windowRationale = 'Janela inicial calculada com base na fragilidade da evidência.';

  switch (triggerReason) {
    case 'CONFLICTED_MASTERY':
    case 'CONFIDENCE_DIVERGENCE':
      startOffsetDays = 0;
      endOffsetDays = 2;
      windowRationale = 'Ação prioritária curta para resolver divergência/conflito de evidências.';
      break;
    case 'POST_SOLUTION_DEPENDENCY':
      startOffsetDays = 1;
      endOffsetDays = 3;
      windowRationale = 'Janela curta para verificar reprodução sem apoio após consulta da resolução.';
      break;
    case 'SELF_CORRECTION':
    case 'CORRECT_UNCERTAIN':
    case 'CORRECT_GUESS':
      startOffsetDays = 2;
      endOffsetDays = 5;
      windowRationale = 'Janela intermediária para consolidar o raciocínio positivo frágil.';
      break;
    case 'FRAGILE_MASTERY':
      startOffsetDays = 2;
      endOffsetDays = 6;
      windowRationale = 'Janela de consolidação para mastery com sinais frágeis.';
      break;
    case 'RETENTION_CHECK':
      if (recencyStatus === 'STALE') {
        startOffsetDays = 0;
        endOffsetDays = 3;
        windowRationale = 'Checagem de retenção pendente para conteúdo com retenção expirada.';
      } else if (recencyStatus === 'AGING') {
        startOffsetDays = 3;
        endOffsetDays = 7;
        windowRationale = 'Checagem de retenção intermediária para conteúdo em envelhecimento.';
      } else {
        startOffsetDays = 7;
        endOffsetDays = 14;
        windowRationale = 'Checagem periódica de retenção para conteúdo anteriormente estável.';
      }
      break;
    default:
      break;
  }

  // Check previous completions for success/failure modifiers
  const lastCompletion = previousCompletions.length > 0
    ? [...previousCompletions].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
    : null;

  if (lastCompletion) {
    if (lastCompletion.outcome === 'SUCCESS_CONFIDENT') {
      startOffsetDays += 4;
      endOffsetDays += 7;
      windowRationale = 'Janela ampliada devido ao sucesso confiante na revisão anterior.';
    } else if (lastCompletion.outcome === 'FAILED') {
      startOffsetDays = Math.max(0, startOffsetDays - 1);
      endOffsetDays = Math.max(1, endOffsetDays - 2);
      windowRationale = 'Janela encurtada devido a falha na revisão anterior.';
    }
  }

  // Topic weight modifier: higher importance slightly prioritizes review window
  const normWeight = normalizeExamWeight(topicWeight);
  if (normWeight > 0.6 && startOffsetDays > 1) {
    startOffsetDays = Math.max(1, startOffsetDays - 1);
    endOffsetDays = Math.max(2, endOffsetDays - 1);
  }

  // Days until exam modifier: if exam is close (< 30 days) and mastery is fragile or conflicted
  if (daysUntilExam !== undefined && daysUntilExam <= 30 && (mastery.status === 'FRAGILE' || mastery.status === 'CONFLICTED')) {
    startOffsetDays = Math.max(0, startOffsetDays - 1);
    endOffsetDays = Math.max(1, endOffsetDays - 1);
  }

  const startDate = new Date(currentDate);
  startDate.setDate(startDate.getDate() + startOffsetDays);

  const endDate = new Date(currentDate);
  endDate.setDate(endDate.getDate() + endOffsetDays);

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
    rationale: windowRationale,
  };
}

/**
  * Standard duration policy for interventions (in minutes)
  */
export function estimateReviewMinutes(reviewType: ReviewType): number {
  switch (reviewType) {
    case 'ACTIVE_RECALL':
      return 8;
    case 'ORAL_EXPLANATION':
      return 10;
    case 'FORMULA_RECONSTRUCTION':
      return 10;
    case 'REATTEMPT_WITHOUT_SUPPORT':
      return 12;
    case 'ERROR_REVIEW':
      return 15;
    case 'TARGETED_QUESTIONS':
      return 20;
    case 'MINI_LIST':
      return 25;
    case 'THEORY_REFRESH':
      return 20;
    case 'DIAGNOSTIC_RETEST':
      return 15;
    default:
      return 15;
  }
}

/**
  * Calculates recommendation confidence for the review decision based on mastery confidence and relevant sources
  */
export function calculateRecommendationConfidence(
  mastery: MasteryState,
  evidenceCountOrOptions?: number | { triggerReason?: ReviewTriggerReason; relevantIndependentSourceCount?: number }
): RecommendationConfidence {
  let relevantCount = 0;
  let triggerReason: ReviewTriggerReason | undefined;

  if (typeof evidenceCountOrOptions === 'number') {
    relevantCount = mastery.informativeIndependentSourceCount ?? mastery.independentSourceCount ?? evidenceCountOrOptions;
  } else if (evidenceCountOrOptions && typeof evidenceCountOrOptions === 'object') {
    triggerReason = evidenceCountOrOptions.triggerReason;
    relevantCount = evidenceCountOrOptions.relevantIndependentSourceCount ?? mastery.informativeIndependentSourceCount ?? 0;
  } else {
    relevantCount = mastery.informativeIndependentSourceCount ?? 0;
  }

  // High clarity triggers (direct observations) get higher recommendation confidence even with fewer sources
  const isHighClarityTrigger = triggerReason === 'POST_SOLUTION_DEPENDENCY' ||
    triggerReason === 'CONFIDENCE_DIVERGENCE' ||
    triggerReason === 'ERROR_RECURRENCE' ||
    triggerReason === 'SELF_CORRECTION';

  if (mastery.confidence === 'HIGH' && relevantCount >= 4) {
    return 'HIGH';
  }
  if (mastery.confidence === 'MODERATE' || relevantCount >= 2 || isHighClarityTrigger) {
    return 'MODERATE';
  }
  return 'LOW';
}


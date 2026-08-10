import {
  Review,
  ReviewDecision,
  ReviewType,
  ReviewTriggerReason,
  ReviewPriority,
  MasteryState,
  LearningEvidence,
  LearningEvidenceSignal,
  Attempt,
  ErrorEntry,
  ReviewCompletion,
  RecommendationConfidence,
  TopicNode,
} from '../types';
import {
  REVIEW_POLICY_VERSION,
  calculateReviewWindow,
  estimateReviewMinutes,
  calculateRecommendationConfidence,
  evaluateEvidenceRecency,
  deriveReviewStatusFromWindow,
} from './reviewPolicy';
import { ReviewRepository } from './reviewRepository';
import { classifyMasterySource, computeMasteryStateForTopic } from './masteryEngine';

export interface GenerateReviewDecisionInput {
  userId: string;
  topic: TopicNode;
  masteryState: MasteryState;
  evidences: LearningEvidence[];
  attempts?: Attempt[];
  errors?: ErrorEntry[];
  previousReviews?: Review[];
  previousReviewCompletions?: ReviewCompletion[];
  now?: string;
  context?: {
    daysUntilExam?: number;
    topicWeight?: number;
  };
}

let reviewIdCounter = 0;

/**
 * Creates a unique deterministic-safe Review ID without millisecond collision
 */
export function createReviewId(topicId: string, triggerReason: string): string {
  const nonce = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().substring(0, 8)
    : `${Date.now()}_${++reviewIdCounter}`;
  return `rev_${topicId}_${triggerReason}_${nonce}`;
}

/**
 * Calculates consecutive review failures for a topic across historical reviews and completions
 */
export function getConsecutiveReviewFailures({
  topicReviews,
  completions,
  reviewType,
  triggerReason,
}: {
  topicReviews: Review[];
  completions: ReviewCompletion[];
  reviewType?: ReviewType;
  triggerReason?: ReviewTriggerReason;
}): number {
  if (!topicReviews || topicReviews.length === 0 || !completions || completions.length === 0) {
    return 0;
  }

  const reviewMap = new Map<string, Review>();
  for (const r of topicReviews) {
    reviewMap.set(r.id, r);
  }

  const relevantCompletions = completions.filter(c => {
    const parent = reviewMap.get(c.reviewId);
    if (!parent) return false;
    if (reviewType && parent.reviewType !== reviewType) return false;
    if (triggerReason && parent.triggerReason !== triggerReason) return false;
    return true;
  });

  relevantCompletions.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  let failures = 0;
  for (const comp of relevantCompletions) {
    if (comp.outcome === 'FAILED') {
      failures++;
    } else if (
      comp.outcome === 'SUCCESS_CONFIDENT' ||
      comp.outcome === 'SUCCESS_EFFORTFUL' ||
      comp.outcome === 'PARTIAL'
    ) {
      break;
    }
  }

  return failures;
}

/**
 * Policy to select the next review method after repeated failures
 */
export function chooseNextReviewMethodAfterFailures({
  currentMethod,
  consecutiveFailures,
  hasConceptualErrors,
}: {
  currentMethod: ReviewType;
  consecutiveFailures: number;
  hasConceptualErrors?: boolean;
}): ReviewType {
  if (consecutiveFailures < 2) {
    return currentMethod;
  }

  switch (currentMethod) {
    case 'ACTIVE_RECALL':
    case 'ORAL_EXPLANATION':
    case 'FORMULA_RECONSTRUCTION':
      return 'TARGETED_QUESTIONS';
    case 'TARGETED_QUESTIONS':
    case 'MINI_LIST':
      return 'ERROR_REVIEW';
    case 'ERROR_REVIEW':
      return hasConceptualErrors ? 'THEORY_REFRESH' : 'DIAGNOSTIC_RETEST';
    case 'REATTEMPT_WITHOUT_SUPPORT':
      return 'DIAGNOSTIC_RETEST';
    case 'THEORY_REFRESH':
      return 'DIAGNOSTIC_RETEST';
    default:
      return 'DIAGNOSTIC_RETEST';
  }
}

/**
 * Pure deterministic function to generate a ReviewDecision for a topic
 */
export function generateReviewDecisionForTopic(
  input: GenerateReviewDecisionInput
): ReviewDecision {
  const {
    topic,
    masteryState,
    evidences,
    errors = [],
    previousReviews = [],
    previousReviewCompletions = [],
    now = new Date().toISOString(),
    context = {},
  } = input;

  const topicId = topic.id;
  const topicEvidences = evidences.filter(e => e.topicIds.includes(topicId));
  const topicErrors = errors.filter(e => e.topicId === topicId);

  // Filter previous reviews and completions for this topic strictly
  const topicPreviousReviews = previousReviews.filter(r => r.topicId === topicId);
  const topicReviewIds = new Set(topicPreviousReviews.map(r => r.id));
  const topicPreviousCompletions = previousReviewCompletions.filter(c => topicReviewIds.has(c.reviewId));

  const adjustDecision = (d: ReviewDecision): ReviewDecision => {
    if (d.reviewType && topicPreviousReviews.length > 0 && topicPreviousCompletions.length > 0) {
      const failures = getConsecutiveReviewFailures({
        topicReviews: topicPreviousReviews,
        completions: topicPreviousCompletions,
        reviewType: d.reviewType,
      });
      if (failures >= 2) {
        const nextType = chooseNextReviewMethodAfterFailures({
          currentMethod: d.reviewType,
          consecutiveFailures: failures,
          hasConceptualErrors: topicErrors.some(e => e.errorType === 'conceitual'),
        });
        if (nextType !== d.reviewType) {
          return {
            ...d,
            reviewType: nextType,
            estimatedMinutes: estimateReviewMinutes(nextType),
            rationale: `${d.rationale} (Método adaptado para ${nextType} após ${failures} falhas consecutivas).`,
          };
        }
      }
    }
    return d;
  };

  const finalizeDecision = (d: ReviewDecision): ReviewDecision => {
    if (d.action === 'NO_REVIEW_NOW' || !d.reviewType) {
      return d;
    }
    return adjustDecision(d);
  };

  // Source evidence IDs from topic evidences
  const sourceEvIds = topicEvidences.map(e => e.id);

  // Group topicEvidences (type === 'QUESTION_ATTEMPT') by sourceId to classify sources semantically
  const appEvidences = topicEvidences.filter(e => e.type === 'QUESTION_ATTEMPT');
  const sourceMap = new Map<string, LearningEvidence[]>();
  for (const ev of appEvidences) {
    if (!ev.sourceId) continue;
    const existing = sourceMap.get(ev.sourceId) || [];
    existing.push(ev);
    sourceMap.set(ev.sourceId, existing);
  }

  const contradictingSourceIds: string[] = [];
  const selfCorrectedSourceIds: string[] = [];
  const postSolutionSourceIds: string[] = [];
  const fragileSourceIds: string[] = [];
  const supportingSourceIds: string[] = [];

  for (const [sId, sEvs] of sourceMap.entries()) {
    const classification = classifyMasterySource(sEvs);
    if (classification === 'CONTRADICTING') contradictingSourceIds.push(sId);
    else if (classification === 'SELF_CORRECTED') selfCorrectedSourceIds.push(sId);
    else if (classification === 'POST_SOLUTION_ASSISTED') postSolutionSourceIds.push(sId);
    else if (classification === 'FRAGILE') fragileSourceIds.push(sId);
    else if (classification === 'SUPPORTING') supportingSourceIds.push(sId);
  }

  // Helper to map source IDs to evidence IDs
  const getEvIdsForSources = (sIds: string[]): string[] => {
    const sSet = new Set(sIds);
    return topicEvidences.filter(e => e.sourceId && sSet.has(e.sourceId)).map(e => e.id);
  };

  // Default recommendation confidence
  const recommendationConfidence: RecommendationConfidence = calculateRecommendationConfidence(
    masteryState,
    { relevantIndependentSourceCount: masteryState.informativeIndependentSourceCount }
  );

  // 1. RULE: UNKNOWN status -> NO_REVIEW_NOW
  if (masteryState.status === 'UNKNOWN') {
    return finalizeDecision({
      action: 'NO_REVIEW_NOW',
      rationale: 'Ainda não há dados que indiquem uma revisão. Primeiro precisamos saber se este conteúdo já foi estudado.',
      recommendationConfidence: 'LOW',
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: [],
      sourceErrorIds: [],
    });
  }

  // 2. RULE: TIME_SIGNAL only -> NO_REVIEW_NOW
  const nonTimeEvidences = topicEvidences.filter(e => e.signal !== 'TIME_SIGNAL' && e.signal !== 'UNKNOWN');
  if (topicEvidences.length > 0 && nonTimeEvidences.length === 0) {
    return finalizeDecision({
      action: 'NO_REVIEW_NOW',
      rationale: 'O principal sinal atual é de execução/tempo. Uma revisão conceitual não está justificada pelos dados.',
      recommendationConfidence: 'MODERATE',
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: [],
    });
  }

  // 3. RULE: CONFLICTED status -> DIAGNOSTIC_RETEST
  if (masteryState.status === 'CONFLICTED') {
    const window = calculateReviewWindow({
      triggerReason: 'CONFLICTED_MASTERY',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    return finalizeDecision({
      action: 'DIAGNOSTIC_RETEST',
      reviewType: 'DIAGNOSTIC_RETEST',
      triggerReason: 'CONFLICTED_MASTERY',
      priority: 'HIGH',
      rationale: 'Os dados estão conflitantes. Antes de revisar o conteúdo inteiro, vale gerar uma nova evidência independente.',
      estimatedMinutes: estimateReviewMinutes('DIAGNOSTIC_RETEST'),
      recommendedWindow: {
        start: window.start,
        end: window.end,
      },
      recommendationConfidence,
      sourceEvidenceIds: masteryState.contradictingEvidenceIds.concat(masteryState.levelSupportingEvidenceIds),
      sourceAttemptIds: contradictingSourceIds.concat(supportingSourceIds),
      sourceErrorIds: [],
    });
  }

  // 4. RULE: ESTIMATED with MODERATE/HIGH confidence & no major contradiction
  if (
    masteryState.status === 'ESTIMATED' &&
    (masteryState.confidence === 'HIGH' || masteryState.confidence === 'MODERATE') &&
    contradictingSourceIds.length === 0 &&
    postSolutionSourceIds.length <= 1
  ) {
    const recency = evaluateEvidenceRecency({
      masteryState,
      evidences: topicEvidences,
      previousReviews: topicPreviousReviews,
      previousCompletions: topicPreviousCompletions,
      now,
    });

    if (recency === 'RECENT') {
      const hasRecentRetentionCheck = topicPreviousCompletions.some(c => {
        if (c.outcome !== 'SUCCESS_CONFIDENT' && c.outcome !== 'SUCCESS_EFFORTFUL') return false;
        const review = topicPreviousReviews.find(r => r.id === c.reviewId);
        if (!review) return false;
        if (['TARGETED_QUESTIONS', 'REATTEMPT_WITHOUT_SUPPORT', 'DIAGNOSTIC_RETEST'].includes(review.reviewType)) return false;
        return (new Date(now).getTime() - new Date(c.completedAt).getTime()) < 30 * 24 * 60 * 60 * 1000;
      });
      const rationaleText = hasRecentRetentionCheck
        ? 'Uma checagem recente indicou recuperação satisfatória do conteúdo.'
        : 'Há evidências recentes e consistentes de aplicação independente.';

      return finalizeDecision({
        action: 'NO_REVIEW_NOW',
        rationale: rationaleText,
        recommendationConfidence: masteryState.confidence,
        sourceEvidenceIds: masteryState.levelSupportingEvidenceIds,
        sourceAttemptIds: supportingSourceIds,
        sourceErrorIds: [],
      });
    } else {
      const window = calculateReviewWindow({
        triggerReason: 'RETENTION_CHECK',
        mastery: masteryState,
        previousCompletions: topicPreviousCompletions,
        topicWeight: context.topicWeight,
        daysUntilExam: context.daysUntilExam,
        recencyStatus: recency,
        now,
      });

      return finalizeDecision({
        action: 'SCHEDULE_REVIEW',
        reviewType: 'DIAGNOSTIC_RETEST',
        triggerReason: 'RETENTION_CHECK',
        priority: 'MEDIUM',
        rationale: 'Conteúdo anteriormente estável, porém sem verificação recente. Recomendado teste rápido de retenção.',
        estimatedMinutes: estimateReviewMinutes('DIAGNOSTIC_RETEST'),
        recommendedWindow: { start: window.start, end: window.end },
        recommendationConfidence: masteryState.confidence,
        sourceEvidenceIds: masteryState.levelSupportingEvidenceIds,
        sourceAttemptIds: supportingSourceIds,
        sourceErrorIds: [],
      });
    }
  }

  // 5. Specific triggers with semantic classification checks

  // CONFIDENCE_DIVERGENCE: require active contradicting sources
  if (masteryState.confidenceDivergenceCount > 0 && contradictingSourceIds.length > 0) {
    const window = calculateReviewWindow({
      triggerReason: 'CONFIDENCE_DIVERGENCE',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    const triggerEvIds = getEvIdsForSources(contradictingSourceIds);

    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'ERROR_REVIEW',
      triggerReason: 'CONFIDENCE_DIVERGENCE',
      priority: 'HIGH',
      rationale: 'Antes de rever toda a teoria, investigue onde o raciocínio divergiu.',
      estimatedMinutes: estimateReviewMinutes('ERROR_REVIEW'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'CONFIDENCE_DIVERGENCE' }),
      sourceEvidenceIds: triggerEvIds.length > 0 ? triggerEvIds : masteryState.contradictingEvidenceIds,
      sourceAttemptIds: contradictingSourceIds,
      sourceErrorIds: [],
    });
  }

  // POST_SOLUTION_DEPENDENCY
  if (postSolutionSourceIds.length > 0 && supportingSourceIds.length === 0) {
    const window = calculateReviewWindow({
      triggerReason: 'POST_SOLUTION_DEPENDENCY',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'REATTEMPT_WITHOUT_SUPPORT',
      triggerReason: 'POST_SOLUTION_DEPENDENCY',
      priority: 'HIGH',
      rationale: 'Acerto ocorreu após consultar a resolução. Necessário verificar reprodução autônoma sem apoio.',
      estimatedMinutes: estimateReviewMinutes('REATTEMPT_WITHOUT_SUPPORT'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'POST_SOLUTION_DEPENDENCY' }),
      sourceEvidenceIds: getEvIdsForSources(postSolutionSourceIds),
      sourceAttemptIds: postSolutionSourceIds,
      sourceErrorIds: [],
    });
  }

  // SELF_CORRECTION
  if (selfCorrectedSourceIds.length > 0 && supportingSourceIds.length === 0) {
    const window = calculateReviewWindow({
      triggerReason: 'SELF_CORRECTION',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'TARGETED_QUESTIONS',
      triggerReason: 'SELF_CORRECTION',
      priority: 'MEDIUM',
      rationale: 'Desempenho com autocorreção. Recomendadas poucas questões para confirmação sem erros iniciais.',
      estimatedMinutes: estimateReviewMinutes('TARGETED_QUESTIONS'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'SELF_CORRECTION' }),
      sourceEvidenceIds: getEvIdsForSources(selfCorrectedSourceIds),
      sourceAttemptIds: selfCorrectedSourceIds,
      sourceErrorIds: [],
    });
  }

  // CORRECT_UNCERTAIN (Fragile positive)
  if (fragileSourceIds.length > 0 && supportingSourceIds.length === 0) {
    const window = calculateReviewWindow({
      triggerReason: 'CORRECT_UNCERTAIN',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'TARGETED_QUESTIONS',
      triggerReason: 'CORRECT_UNCERTAIN',
      priority: 'MEDIUM',
      rationale: 'Acerto registrado com dúvida ou insegurança. Recomendada prática direcionada para consolidar.',
      estimatedMinutes: estimateReviewMinutes('TARGETED_QUESTIONS'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: 'MODERATE',
      sourceEvidenceIds: getEvIdsForSources(fragileSourceIds),
      sourceAttemptIds: fragileSourceIds,
      sourceErrorIds: [],
    });
  }

  // 6. Check specific error entries for error-based trigger reasons (requiring at least 2 pending errors of compatible type)
  const pendingErrors = topicErrors.filter(e => e.reviewStatus === 'pending');
  const errorTypeCounts: Record<string, ErrorEntry[]> = {};
  for (const err of pendingErrors) {
    const typeKey = err.errorType || 'unknown';
    if (!errorTypeCounts[typeKey]) errorTypeCounts[typeKey] = [];
    errorTypeCounts[typeKey].push(err);
  }

  if (errorTypeCounts['pre_requisito'] && errorTypeCounts['pre_requisito'].length >= 2) {
    const window = calculateReviewWindow({
      triggerReason: 'ERROR_RECURRENCE',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    const errs = errorTypeCounts['pre_requisito'];
    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'DIAGNOSTIC_RETEST',
      triggerReason: 'ERROR_RECURRENCE',
      priority: 'HIGH',
      rationale: 'Possível lacuna de pré-requisito identificada no caderno de erros. Recomendado diagnóstico direcionado.',
      estimatedMinutes: estimateReviewMinutes('DIAGNOSTIC_RETEST'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'ERROR_RECURRENCE' }),
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: errs.map(e => e.id),
    });
  }

  if (errorTypeCounts['conceitual'] && errorTypeCounts['conceitual'].length >= 2) {
    const window = calculateReviewWindow({
      triggerReason: 'ERROR_RECURRENCE',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    const errs = errorTypeCounts['conceitual'];
    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'THEORY_REFRESH',
      triggerReason: 'ERROR_RECURRENCE',
      priority: 'HIGH',
      rationale: 'Erros conceituais recorrentes identificados no caderno de erros. Recomendada revisão de teoria direcionada.',
      estimatedMinutes: estimateReviewMinutes('THEORY_REFRESH'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'ERROR_RECURRENCE' }),
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: errs.map(e => e.id),
    });
  }

  if (errorTypeCounts['calculo'] && errorTypeCounts['calculo'].length >= 2) {
    const window = calculateReviewWindow({
      triggerReason: 'ERROR_RECURRENCE',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    const errs = errorTypeCounts['calculo'];
    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'TARGETED_QUESTIONS',
      triggerReason: 'ERROR_RECURRENCE',
      priority: 'MEDIUM',
      rationale: 'Erros de cálculo recorrentes. Recomendado treino de questões direcionadas.',
      estimatedMinutes: estimateReviewMinutes('TARGETED_QUESTIONS'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'ERROR_RECURRENCE' }),
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: errs.map(e => e.id),
    });
  }

  if (errorTypeCounts['interpretacao'] && errorTypeCounts['interpretacao'].length >= 2) {
    const window = calculateReviewWindow({
      triggerReason: 'ERROR_RECURRENCE',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    const errs = errorTypeCounts['interpretacao'];
    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'TARGETED_QUESTIONS',
      triggerReason: 'ERROR_RECURRENCE',
      priority: 'MEDIUM',
      rationale: 'Erros de interpretação recorrentes. Recomendada prática direcionada de interpretação.',
      estimatedMinutes: estimateReviewMinutes('TARGETED_QUESTIONS'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'ERROR_RECURRENCE' }),
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: errs.map(e => e.id),
    });
  }

  if (errorTypeCounts['estrategia'] && errorTypeCounts['estrategia'].length >= 2) {
    const window = calculateReviewWindow({
      triggerReason: 'ERROR_RECURRENCE',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    const errs = errorTypeCounts['estrategia'];
    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'ERROR_REVIEW',
      triggerReason: 'ERROR_RECURRENCE',
      priority: 'HIGH',
      rationale: 'Erros de estratégia recorrentes. Recomendada análise de erros.',
      estimatedMinutes: estimateReviewMinutes('ERROR_REVIEW'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: calculateRecommendationConfidence(masteryState, { triggerReason: 'ERROR_RECURRENCE' }),
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: errs.map(e => e.id),
    });
  }

  // 7. INSUFFICIENT_EVIDENCE -> DIAGNOSTIC_RETEST or NO_REVIEW_NOW
  if (masteryState.status === 'INSUFFICIENT_EVIDENCE') {
    if (masteryState.negativeCount > 0) {
      const window = calculateReviewWindow({
        triggerReason: 'FRAGILE_MASTERY',
        mastery: masteryState,
        previousCompletions: topicPreviousCompletions,
        topicWeight: context.topicWeight,
        daysUntilExam: context.daysUntilExam,
        now,
      });

      return finalizeDecision({
        action: 'SCHEDULE_REVIEW',
        reviewType: 'DIAGNOSTIC_RETEST',
        triggerReason: 'FRAGILE_MASTERY',
        priority: 'MEDIUM',
        rationale: 'Sinais de dificuldade registrados com pouca amostragem. Recomendado teste diagnóstico direto.',
        estimatedMinutes: estimateReviewMinutes('DIAGNOSTIC_RETEST'),
        recommendedWindow: { start: window.start, end: window.end },
        recommendationConfidence: 'LOW',
        sourceEvidenceIds: masteryState.contradictingEvidenceIds,
        sourceAttemptIds: contradictingSourceIds,
        sourceErrorIds: [],
      });
    }

    return finalizeDecision({
      action: 'NO_REVIEW_NOW',
      rationale: 'Poucas evidências registradas. Recomenda-se realizar mais resoluções normais antes de agendar revisão.',
      recommendationConfidence: 'LOW',
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: [],
    });
  }

  // 8. General FRAGILE / EMERGING fallback
  if (masteryState.status === 'FRAGILE' || masteryState.status === 'EMERGING') {
    const window = calculateReviewWindow({
      triggerReason: 'FRAGILE_MASTERY',
      mastery: masteryState,
      previousCompletions: topicPreviousCompletions,
      topicWeight: context.topicWeight,
      daysUntilExam: context.daysUntilExam,
      now,
    });

    return finalizeDecision({
      action: 'SCHEDULE_REVIEW',
      reviewType: 'TARGETED_QUESTIONS',
      triggerReason: 'FRAGILE_MASTERY',
      priority: 'MEDIUM',
      rationale: 'Intervenção curta de questões para evoluir domínio emergente para aplicação independente.',
      estimatedMinutes: estimateReviewMinutes('TARGETED_QUESTIONS'),
      recommendedWindow: { start: window.start, end: window.end },
      recommendationConfidence: 'MODERATE',
      sourceEvidenceIds: sourceEvIds,
      sourceAttemptIds: Array.from(sourceMap.keys()),
      sourceErrorIds: [],
    });
  }

  // Default fallback
  return finalizeDecision({
    action: 'NO_REVIEW_NOW',
    rationale: 'Sem justificativa de revisão no momento.',
    recommendationConfidence: 'LOW',
    sourceEvidenceIds: sourceEvIds,
    sourceAttemptIds: [],
    sourceErrorIds: [],
  });
}

export type ReassessResultAction = 'KEEP' | 'RESCHEDULE' | 'CANCEL_NOT_NEEDED' | 'CHANGE_METHOD' | 'REASSESS';

export interface ReassessReviewOutput {
  action: ReassessResultAction;
  updatedReviewType?: ReviewType;
  updatedWindow?: { start: string; end: string };
  rationale: string;
}

/**
 * Pure function to reassess an existing Review against current Mastery & Evidences
 */
export function reassessReview({
  review,
  currentMastery,
  latestEvidences,
  latestCompletions = [],
  topicReviews = [],
  now = new Date().toISOString(),
}: {
  review: Review;
  currentMastery: MasteryState;
  latestEvidences: LearningEvidence[];
  latestCompletions?: ReviewCompletion[];
  topicReviews?: Review[];
  now?: string;
}): ReassessReviewOutput {
  const evidencesAfterReview = latestEvidences.filter(e =>
    e.topicIds.includes(review.topicId) &&
    e.type === 'QUESTION_ATTEMPT' &&
    new Date(e.createdAt).getTime() > new Date(review.createdAt).getTime()
  );

  const sourceMap = new Map<string, LearningEvidence[]>();
  for (const ev of evidencesAfterReview) {
    if (!ev.sourceId) continue;
    const existing = sourceMap.get(ev.sourceId) || [];
    existing.push(ev);
    sourceMap.set(ev.sourceId, existing);
  }

  let hasNewSupportingApplication = false;
  for (const sourceEvs of sourceMap.values()) {
    if (classifyMasterySource(sourceEvs) === 'SUPPORTING') {
      hasNewSupportingApplication = true;
      break;
    }
  }

  if (hasNewSupportingApplication) {
    return {
      action: 'CANCEL_NOT_NEEDED',
      rationale: 'Esta revisão deixou de ser prioridade porque surgiram novas evidências de domínio.',
    };
  }

  const allTopicReviews = topicReviews.length > 0 ? topicReviews : [review];
  const consecutiveFailures = getConsecutiveReviewFailures({
    topicReviews: allTopicReviews,
    completions: latestCompletions,
    reviewType: review.reviewType,
  });

  if (consecutiveFailures >= 2) {
    const updatedReviewType = chooseNextReviewMethodAfterFailures({
      currentMethod: review.reviewType,
      consecutiveFailures,
      hasConceptualErrors: currentMastery.negativeCount > 0,
    });

    return {
      action: 'CHANGE_METHOD',
      updatedReviewType,
      rationale: `Revisões do tipo ${review.reviewType} falharam repetidamente (${consecutiveFailures}x). Alterando método para ${updatedReviewType}.`,
    };
  }

  if (currentMastery.status === 'CONFLICTED' && review.reviewType !== 'DIAGNOSTIC_RETEST') {
    return {
      action: 'CHANGE_METHOD',
      updatedReviewType: 'DIAGNOSTIC_RETEST',
      rationale: 'Estado do tópico tornou-se conflitante. Alterando método para reteste diagnóstico curto.',
    };
  }

  if (review.recommendedWindowEnd && new Date(now) > new Date(review.recommendedWindowEnd)) {
    const reviewCompletions = latestCompletions
      .filter(c => c.reviewId === review.id)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    const newWindow = calculateReviewWindow({
      triggerReason: review.triggerReason,
      mastery: currentMastery,
      previousCompletions: reviewCompletions,
      now,
    });

    return {
      action: 'RESCHEDULE',
      updatedWindow: newWindow,
      rationale: 'A janela de revisão expirou. Reagendando janela adaptativa sem cobrança ou acúmulo punitivo.',
    };
  }

  return {
    action: 'KEEP',
    rationale: 'Revisão mantida de acordo com do plano adaptativo.',
  };
}

/**
 * Applies a reassessment result to the repository
 */
export function applyReviewReassessment({
  review,
  reassessment,
  userId,
  reviewRepository,
  now,
}: {
  review: Review;
  reassessment: ReassessReviewOutput;
  userId: string;
  reviewRepository: ReviewRepository;
  now?: string;
}): Review | null {
  if (reassessment.action === 'CANCEL_NOT_NEEDED') {
    return reviewRepository.updateReviewStatus(review.id, userId, 'CANCELED', reassessment.rationale);
  } else if (reassessment.action === 'RESCHEDULE' && reassessment.updatedWindow) {
    return reviewRepository.rescheduleReview({
      id: review.id,
      userId,
      windowStart: reassessment.updatedWindow.start,
      windowEnd: reassessment.updatedWindow.end,
      rationale: reassessment.rationale,
      now,
    });
  } else if (reassessment.action === 'CHANGE_METHOD' && reassessment.updatedReviewType) {
    return reviewRepository.changeReviewMethod({
      id: review.id,
      userId,
      reviewType: reassessment.updatedReviewType,
      rationale: reassessment.rationale,
    });
  }
  return review;
}

/**
 * Materializes a ReviewDecision into a persisted Review object
 */
export function materializeReviewDecision({
  decision,
  userId,
  topic,
  reviewRepository,
  now = new Date().toISOString(),
}: {
  decision: ReviewDecision;
  userId: string;
  topic: TopicNode | { id: string; subjectId: string; name: string };
  reviewRepository: ReviewRepository;
  now?: string;
}): Review | null {
  if (decision.action === 'NO_REVIEW_NOW' || !decision.reviewType || !decision.triggerReason) {
    return null;
  }

  const existingActive = reviewRepository.findActiveReviewForTopicAndTrigger(
    userId,
    topic.id,
    decision.triggerReason
  );

  if (existingActive) {
    return existingActive;
  }

  const reviewId = createReviewId(topic.id, decision.triggerReason);

  const initialStatus = deriveReviewStatusFromWindow({
    start: decision.recommendedWindow?.start,
    end: decision.recommendedWindow?.end,
    now,
  });

  const newReview: Review = {
    id: reviewId,
    userId,
    subjectId: topic.subjectId,
    topicId: topic.id,
    reviewType: decision.reviewType,
    triggerReason: decision.triggerReason,
    status: initialStatus,
    priority: decision.priority || 'MEDIUM',
    sourceEvidenceIds: decision.sourceEvidenceIds || [],
    sourceAttemptIds: decision.sourceAttemptIds || [],
    sourceErrorIds: decision.sourceErrorIds || [],
    createdAt: now,
    recommendedWindowStart: decision.recommendedWindow?.start,
    recommendedWindowEnd: decision.recommendedWindow?.end,
    estimatedMinutes: decision.estimatedMinutes || estimateReviewMinutes(decision.reviewType),
    rationale: decision.rationale,
    recommendationConfidence: decision.recommendationConfidence,
    policyVersion: REVIEW_POLICY_VERSION,
  };

  return reviewRepository.saveReview(newReview);
}

/**
 * Converts a ReviewCompletion into a LearningEvidence object
 */
export function createLearningEvidenceFromReviewCompletion({
  review,
  completion,
}: {
  review: Review;
  completion: ReviewCompletion;
}): LearningEvidence {
  let signal: LearningEvidenceSignal = 'UNKNOWN';
  if (completion.outcome === 'SUCCESS_CONFIDENT') {
    signal = 'STRONG_POSITIVE';
  } else if (completion.outcome === 'SUCCESS_EFFORTFUL' || completion.outcome === 'PARTIAL') {
    signal = 'FRAGILE_POSITIVE';
  } else if (completion.outcome === 'FAILED') {
    signal = 'NEGATIVE_SIGNAL';
  }

  return {
    id: `ev_rev_${completion.id}`,
    userId: completion.userId,
    subjectId: review.subjectId,
    topicIds: [review.topicId],
    type: 'REVIEW_RESULT',
    sourceId: completion.id,
    createdAt: completion.completedAt,
    signal,
    reviewOutcome: completion.outcome,
    confidence: completion.confidence || null,
    durationSeconds: completion.actualMinutes ? completion.actualMinutes * 60 : undefined,
    metadata: {
      reviewId: review.id,
      reviewType: review.reviewType,
      triggerReason: review.triggerReason,
      linkedAttemptIds: completion.linkedAttemptIds || [],
      completionId: completion.id,
    },
  };
}


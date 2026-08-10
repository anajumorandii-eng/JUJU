import {
  TaskItem,
  Review,
  ReviewDecision,
  MasteryState,
  TopicNode,
  ErrorEntry,
  EnergyLevel,
  ActionDecision,
  ReviewType,
  ReviewTriggerReason,
  ReviewPriority,
  RecommendationConfidence,
  TaskCategory,
} from '../types';

export interface EfficiencyPolicy {
  version: '2.0-V1';
  weights: {
    learningNeed: number;
    objectiveRelevance: number;
    urgency: number;
    reviewNeed: number;
    errorSignal: number;
    timeFit: number;
    energyFit: number;
    prerequisiteReadiness: number;
    obligationSignal: number;
    opportunityCost: number;
  };
  mastery: {
    statusScores: Record<string, number>;
    estimatedLevelHighThreshold: number;
    estimatedLevelMedThreshold: number;
    estimatedLevelHighNeed: number;
    estimatedLevelMedNeed: number;
    estimatedLevelLowNeed: number;
  };
  objectiveRelevance: {
    taskTopicWeightShare: number;
    taskImpactShare: number;
    defaultValue: number;
    examBoostWindowDays: number;
    examBoostMinTopicWeight: number;
    examBoost: number;
  };
  urgency: {
    overdueDaysThreshold: number;
    overdueValue: number;
    nearDaysThreshold: number;
    nearValue: number;
    mediumDaysThreshold: number;
    mediumValue: number;
    distantValue: number;
    dateUrgencyShare: number;
    baseUrgencyShare: number;
    criticalMinUrgency: number;
  };
  error: {
    singlePending: number;
    multipleMixed: number;
    sameTypeRecurrence: number;
    sameTypeRecurrenceMinCount: number;
  };
  prerequisite: {
    estimatedHighConfidence: number;
    estimatedModConfidence: number;
    estimatedLowConfidence: number;
    estimatedLowLevel: number;
    fragileOrConflicted: number;
    unknown: number;
    fallback: number;
  };
  review: {
    needByPriority: Record<ReviewPriority, number>;
    confidenceMultipliers: Record<RecommendationConfidence, number>;
    triggerReasonMultipliers: Record<ReviewTriggerReason, number>;
  };
  opportunityCost: {
    maxGapForNorm: number;
  };
  redundancy: {
    minScoreAdvantage: number;
    allowLowConfidenceReplacement: boolean;
  };
  confidence: {
    tightMarginThreshold: number;
    unknownShareThreshold: number;
  };
}

export const EFFICIENCY_POLICY_V1: EfficiencyPolicy = {
  version: '2.0-V1',
  weights: {
    learningNeed: 0.15,
    objectiveRelevance: 0.15,
    urgency: 0.15,
    reviewNeed: 0.15,
    errorSignal: 0.10,
    timeFit: 0.15,
    energyFit: 0.05,
    prerequisiteReadiness: 0.05,
    obligationSignal: 0.05,
    opportunityCost: 0.05,
  },
  mastery: {
    statusScores: {
      CONFLICTED: 1.0,
      FRAGILE: 0.8,
      EMERGING: 0.6,
      INSUFFICIENT_EVIDENCE: 0.4,
      ESTIMATED: 0.3,
      UNKNOWN: 0.5,
    },
    estimatedLevelHighThreshold: 7,
    estimatedLevelMedThreshold: 5,
    estimatedLevelHighNeed: 0.2,
    estimatedLevelMedNeed: 0.4,
    estimatedLevelLowNeed: 0.6,
  },
  objectiveRelevance: {
    taskTopicWeightShare: 0.5,
    taskImpactShare: 0.5,
    defaultValue: 0.5,
    examBoostWindowDays: 30,
    examBoostMinTopicWeight: 7,
    examBoost: 0.1,
  },
  urgency: {
    overdueDaysThreshold: 0,
    overdueValue: 1.0,
    nearDaysThreshold: 3,
    nearValue: 0.8,
    mediumDaysThreshold: 7,
    mediumValue: 0.6,
    distantValue: 0.3,
    dateUrgencyShare: 0.6,
    baseUrgencyShare: 0.4,
    criticalMinUrgency: 0.8,
  },
  error: {
    singlePending: 0.3,
    multipleMixed: 0.6,
    sameTypeRecurrence: 1.0,
    sameTypeRecurrenceMinCount: 2,
  },
  prerequisite: {
    estimatedHighConfidence: 1.0,
    estimatedModConfidence: 0.8,
    estimatedLowConfidence: 0.5,
    estimatedLowLevel: 0.4,
    fragileOrConflicted: 0.3,
    unknown: 0.5,
    fallback: 0.7,
  },
  review: {
    needByPriority: {
      CRITICAL: 1.0,
      HIGH: 0.85,
      MEDIUM: 0.6,
      MAINTENANCE: 0.3,
    },
    confidenceMultipliers: {
      HIGH: 1.0,
      MODERATE: 0.85,
      LOW: 0.70,
    },
    triggerReasonMultipliers: {
      FRAGILE_MASTERY: 1.05,
      CONFIDENCE_DIVERGENCE: 1.10,
      CORRECT_UNCERTAIN: 1.05,
      CORRECT_GUESS: 1.05,
      SELF_CORRECTION: 1.05,
      POST_SOLUTION_DEPENDENCY: 1.10,
      CONFLICTED_MASTERY: 1.10,
      RETENTION_CHECK: 1.0,
      ERROR_RECURRENCE: 1.10,
      EXAM_RELEVANCE: 1.05,
      MANUAL_REQUEST: 1.0,
    },
  },
  opportunityCost: {
    maxGapForNorm: 40,
  },
  redundancy: {
    minScoreAdvantage: 5.0,
    allowLowConfidenceReplacement: false,
  },
  confidence: {
    tightMarginThreshold: 3.0,
    unknownShareThreshold: 0.5,
  },
};

export function estimateReviewEnergyRequirement(reviewType?: ReviewType): EnergyLevel {
  if (!reviewType) return 'medium';
  switch (reviewType) {
    case 'TARGETED_QUESTIONS':
    case 'REATTEMPT_WITHOUT_SUPPORT':
    case 'DIAGNOSTIC_RETEST':
      return 'high';
    case 'ACTIVE_RECALL':
    case 'ORAL_EXPLANATION':
    case 'ERROR_REVIEW':
    case 'FORMULA_RECONSTRUCTION':
    case 'MINI_LIST':
      return 'medium';
    case 'THEORY_REFRESH':
      return 'low';
    default:
      return 'medium';
  }
}

export interface EfficiencyCandidate {
  id: string;
  sourceType: 'TASK' | 'REVIEW';
  sourceId: string;
  subjectId: string;
  topicId?: string;
  title: string;
  durationMinutes: number;
  energyRequired: EnergyLevel;

  // Review-specific fields
  reviewType?: ReviewType;
  triggerReason?: ReviewTriggerReason;
  reviewPriority?: ReviewPriority;
  recommendationConfidence?: RecommendationConfidence;

  // Task-specific fields
  isCriticalTask?: boolean;
  dueDate?: string;
  taskCategory?: TaskCategory;
  taskUrgency?: number;
  taskImpact?: number;
}

export interface EfficiencyFactorBreakdown {
  learningNeed: number;
  objectiveRelevance: number;
  urgency: number;
  reviewNeed: number;
  errorSignal: number;
  timeFit: number;
  energyFit: number;
  prerequisiteReadiness: number;
  obligationSignal: number;
  opportunityCost: number;
}

export interface RankedEfficiencyCandidate {
  candidate: EfficiencyCandidate;
  decision: ActionDecision;
  internalScore: number; // 0.0 to 100.0 (internal ranking only, NEVER in human rationale)
  factorBreakdown: EfficiencyFactorBreakdown;
  reasons: string[];
  uncertainties: string[];
  reasonCodes: string[];
  rationale: string;
}

export interface EfficiencyEngineInput {
  userId: string;
  availableMinutes: number; // REQUIRED
  energyLevel: EnergyLevel; // REQUIRED
  now: string; // REQUIRED ISO String

  tasks: TaskItem[];
  reviews: Review[];
  noReviewDecisions: Record<string, ReviewDecision>;
  masteryStates: Record<string, MasteryState>;
  errors: ErrorEntry[];
  topics: TopicNode[];

  context?: {
    daysUntilExam?: number;
  };
  policy?: EfficiencyPolicy;
}

export interface EfficiencyEngineOutput {
  primaryCandidate: RankedEfficiencyCandidate | null;
  rankedCandidates: RankedEfficiencyCandidate[];
  recommendationConfidence: 'LOW' | 'MODERATE' | 'HIGH';
  reasons: string[];
  uncertainties: string[];
  policyVersion: string;
  evaluatedAt: string;
}

/**
 * Calculates deterministic factor scores and base score for a single candidate.
 */
export function evaluateCandidateEfficiency(
  candidate: EfficiencyCandidate,
  input: EfficiencyEngineInput,
  policy: EfficiencyPolicy = EFFICIENCY_POLICY_V1
): {
  factors: EfficiencyFactorBreakdown;
  internalScore: number;
  reasons: string[];
  uncertainties: string[];
  reasonCodes: string[];
} {
  const nowMs = new Date(input.now).getTime();
  const topicId = candidate.topicId;
  const topic = topicId ? input.topics.find(t => t.id === topicId) : undefined;
  const masteryState = topicId ? input.masteryStates[topicId] : undefined;

  const reasons: string[] = [];
  const uncertainties: string[] = [];
  const reasonCodes: string[] = [];

  // 1. Learning Need (0.0 to 1.0) - derived from MasteryState using policy
  let learningNeed = policy.objectiveRelevance.defaultValue;
  if (masteryState) {
    if (masteryState.status === 'CONFLICTED') {
      learningNeed = policy.mastery.statusScores['CONFLICTED'] ?? 1.0;
      reasons.push(`Gargalo crítico de conflito no tópico ${topic?.name || topicId}.`);
      reasonCodes.push('CONFLICTED_MASTERY');
    } else if (masteryState.status === 'FRAGILE') {
      learningNeed = policy.mastery.statusScores['FRAGILE'] ?? 0.8;
      reasons.push(`Domínio frágil em ${topic?.name || topicId}.`);
      reasonCodes.push('FRAGILE_MASTERY');
    } else if (masteryState.status === 'EMERGING') {
      learningNeed = policy.mastery.statusScores['EMERGING'] ?? 0.6;
    } else if (masteryState.status === 'INSUFFICIENT_EVIDENCE') {
      learningNeed = policy.mastery.statusScores['INSUFFICIENT_EVIDENCE'] ?? 0.4;
      uncertainties.push(`Evidências insuficientes para estimar domínio completo de ${topic?.name || topicId}.`);
    } else if (masteryState.status === 'ESTIMATED') {
      if (masteryState.estimatedLevel !== null && masteryState.estimatedLevel <= policy.mastery.estimatedLevelMedThreshold) {
        learningNeed = policy.mastery.estimatedLevelLowNeed;
      } else if (masteryState.estimatedLevel !== null && masteryState.estimatedLevel <= policy.mastery.estimatedLevelHighThreshold) {
        learningNeed = policy.mastery.estimatedLevelMedNeed;
      } else {
        learningNeed = policy.mastery.estimatedLevelHighNeed;
      }
    } else if (masteryState.status === 'UNKNOWN') {
      learningNeed = policy.mastery.statusScores['UNKNOWN'] ?? 0.5;
      uncertainties.push(`Não há evidências suficientes para estimar o domínio deste tópico.`);
      reasonCodes.push('UNKNOWN_MASTERY');
    }
  } else if (topicId) {
    uncertainties.push(`Sem dados de domínio para o tópico.`);
    reasonCodes.push('UNKNOWN_MASTERY');
  }

  // 2. Objective Relevance (0.0 to 1.0) - Combines topic weightInExam AND task impact
  let objectiveRelevance = policy.objectiveRelevance.defaultValue;
  const topicWeight = topic?.weightInExam !== undefined ? topic.weightInExam / 10 : undefined;
  const taskImpact = candidate.taskImpact !== undefined ? candidate.taskImpact / 10 : undefined;

  if (candidate.sourceType === 'TASK') {
    if (topicWeight !== undefined && taskImpact !== undefined) {
      objectiveRelevance = topicWeight * policy.objectiveRelevance.taskTopicWeightShare + taskImpact * policy.objectiveRelevance.taskImpactShare;
    } else if (taskImpact !== undefined) {
      objectiveRelevance = taskImpact;
    } else if (topicWeight !== undefined) {
      objectiveRelevance = topicWeight;
    } else {
      objectiveRelevance = policy.objectiveRelevance.defaultValue;
    }
  } else {
    // Review candidate
    objectiveRelevance = topicWeight ?? policy.objectiveRelevance.defaultValue;
  }

  // Days until exam modification: only if daysUntilExam >= 0
  const daysExam = input.context?.daysUntilExam;
  if (
    daysExam !== undefined &&
    daysExam >= 0 &&
    daysExam <= policy.objectiveRelevance.examBoostWindowDays &&
    (topic?.weightInExam ?? 5) >= policy.objectiveRelevance.examBoostMinTopicWeight
  ) {
    objectiveRelevance = Math.min(1.0, objectiveRelevance + policy.objectiveRelevance.examBoost);
  }

  // 3. Urgency (0.0 to 1.0) - Combines task.urgency + due date
  let urgency = policy.urgency.distantValue;
  if (candidate.sourceType === 'TASK') {
    const baseUrgency = (candidate.taskUrgency ?? 5) / 10;
    if (candidate.dueDate) {
      const dueMs = new Date(candidate.dueDate).getTime();
      const daysUntilDue = (dueMs - nowMs) / (1000 * 60 * 60 * 24);
      let dateUrgency = policy.urgency.distantValue;
      if (daysUntilDue <= policy.urgency.overdueDaysThreshold) {
        dateUrgency = policy.urgency.overdueValue;
        reasons.push('Data limite vencida ou para hoje.');
      } else if (daysUntilDue <= policy.urgency.nearDaysThreshold) {
        dateUrgency = policy.urgency.nearValue;
      } else if (daysUntilDue <= policy.urgency.mediumDaysThreshold) {
        dateUrgency = policy.urgency.mediumValue;
      } else {
        dateUrgency = policy.urgency.distantValue;
      }
      urgency = Math.min(1.0, dateUrgency * policy.urgency.dateUrgencyShare + baseUrgency * policy.urgency.baseUrgencyShare);
    } else {
      urgency = baseUrgency;
    }
    if (candidate.isCriticalTask) {
      urgency = Math.max(policy.urgency.criticalMinUrgency, urgency);
      reasons.push('Atividade marcada como crítica.');
      reasonCodes.push('CRITICAL_OBLIGATION');
    }
  } else {
    // Review candidate
    if (candidate.reviewPriority === 'CRITICAL' || candidate.reviewPriority === 'HIGH') {
      urgency = 0.9;
      reasons.push('Revisão de prioridade alta.');
    } else if (candidate.reviewPriority === 'MEDIUM') {
      urgency = 0.6;
    } else {
      urgency = 0.3;
    }
  }

  // 4. Review Need (0.0 to 1.0) - Incorporates recommendationConfidence and triggerReason
  let reviewNeed = 0.0;
  if (candidate.sourceType === 'REVIEW') {
    reasonCodes.push('AVAILABLE_EVIDENCE_BASED_REVIEW');
    const prio = candidate.reviewPriority || 'MEDIUM';
    reviewNeed = policy.review.needByPriority[prio] ?? 0.6;

    // Apply Review recommendationConfidence modifier
    const confMult = candidate.recommendationConfidence
      ? policy.review.confidenceMultipliers[candidate.recommendationConfidence] ?? 1.0
      : 1.0;
    reviewNeed *= confMult;

    // Apply Review triggerReason modifier
    const trigMult = candidate.triggerReason
      ? policy.review.triggerReasonMultipliers[candidate.triggerReason] ?? 1.0
      : 1.0;
    reviewNeed = Math.min(1.0, reviewNeed * trigMult);

  } else if (candidate.taskCategory === 'revisao') {
    reviewNeed = 0.4;
    // Check if there is NO_REVIEW_NOW decision for this topic
    const hasNoReviewDecision = candidate.topicId && input.noReviewDecisions[candidate.topicId]?.action === 'NO_REVIEW_NOW';
    if (hasNoReviewDecision) {
      reviewNeed = 0.05; // Reduces review need significantly
      reasonCodes.push('NO_REVIEW_NEEDED');
      reasons.push('As evidências atuais não indicam necessidade de revisão adaptativa deste tópico agora.');
    }
  }

  // 5. Error Signal (0.0 to 1.0) - Real error recurrence by errorType
  let errorSignal = 0.0;
  if (topicId) {
    const pendingErrors = input.errors.filter(
      e => e.topicId === topicId && (e.reviewStatus === 'pending' || e.reviewStatus === undefined)
    );

    if (pendingErrors.length > 0) {
      // Group by errorType
      const typeCounts: Record<string, number> = {};
      for (const err of pendingErrors) {
        const t = err.errorType || 'outro';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }

      const maxCountForType = Math.max(...Object.values(typeCounts));

      if (maxCountForType >= policy.error.sameTypeRecurrenceMinCount) {
        errorSignal = policy.error.sameTypeRecurrence; // Strong recurrence signal
        reasons.push(`Acúmulo de ${maxCountForType} erros do mesmo tipo pendentes neste tópico.`);
        reasonCodes.push('PENDING_ERROR_RECURRENCE');
      } else if (pendingErrors.length >= policy.error.sameTypeRecurrenceMinCount) {
        errorSignal = policy.error.multipleMixed; // Intermediate signal
        reasons.push(`Acúmulo de ${pendingErrors.length} erros de diferentes tipos pendentes neste tópico.`);
        reasonCodes.push('PENDING_ERRORS');
      } else {
        errorSignal = policy.error.singlePending; // Small signal
        reasons.push('1 erro registrado pendente de revisão.');
        reasonCodes.push('PENDING_ERRORS');
      }
    }
  }

  // 6. Time Fit (0.0 to 1.0)
  let timeFit = 1.0;
  if (candidate.durationMinutes <= input.availableMinutes) {
    timeFit = 1.0;
    reasons.push(`Cabe no tempo disponível (${input.availableMinutes} min).`);
    reasonCodes.push('FITS_AVAILABLE_TIME');
  } else {
    // Duration exceeds available minutes
    const ratio = input.availableMinutes / candidate.durationMinutes;
    timeFit = Math.max(0.0, ratio * 0.2); // Heavily penalized score
    reasons.push(`Duração de ${candidate.durationMinutes} min excede o tempo disponível de ${input.availableMinutes} min.`);
    reasonCodes.push('EXCEEDS_AVAILABLE_TIME');
  }

  // 7. Energy Fit (0.0 to 1.0)
  let energyFit = 1.0;
  const userE = input.energyLevel;
  const candE = candidate.energyRequired;
  if (userE === 'low') {
    if (candE === 'low') energyFit = 1.0;
    else if (candE === 'medium') energyFit = 0.5;
    else energyFit = 0.2; // High energy requirement in low user energy
  } else if (userE === 'medium') {
    if (candE === 'high') energyFit = 0.6;
    else energyFit = 1.0;
  } else {
    energyFit = 1.0;
  }

  if (energyFit < 0.6) {
    reasons.push('Esta atividade exige mais energia do que o contexto atual favorece.');
    reasonCodes.push('ENERGY_MISMATCH');
  }

  // 8. Prerequisite Readiness (0.0 to 1.0) - Incorporates confidence
  let prerequisiteReadiness = 1.0;
  if (topic && topic.prerequisites && topic.prerequisites.length > 0) {
    let sumPrereq = 0;
    for (const pId of topic.prerequisites) {
      const pState = input.masteryStates[pId];
      if (!pState || pState.status === 'UNKNOWN') {
        sumPrereq += policy.prerequisite.unknown;
        uncertainties.push(`Pré-requisito ${pId} sem dados de domínio.`);
        reasonCodes.push('PREREQUISITE_UNCERTAINTY');
      } else if (pState.status === 'ESTIMATED') {
        if ((pState.estimatedLevel ?? 0) >= policy.mastery.estimatedLevelMedThreshold + 1) {
          if (pState.confidence === 'HIGH') {
            sumPrereq += policy.prerequisite.estimatedHighConfidence;
          } else if (pState.confidence === 'MODERATE') {
            sumPrereq += policy.prerequisite.estimatedModConfidence;
          } else {
            // LOW confidence
            sumPrereq += policy.prerequisite.estimatedLowConfidence;
            uncertainties.push(`Pré-requisito ${pId} possui nível estimado mas confiança baixa.`);
            reasonCodes.push('PREREQUISITE_UNCERTAINTY');
          }
        } else {
          sumPrereq += policy.prerequisite.estimatedLowLevel;
          uncertainties.push(`Pré-requisito ${pId} possui nível estimado insuficiente.`);
          reasonCodes.push('PREREQUISITE_UNCERTAINTY');
        }
      } else if (pState.status === 'FRAGILE' || pState.status === 'CONFLICTED') {
        sumPrereq += policy.prerequisite.fragileOrConflicted;
        uncertainties.push(`Pré-requisito ${pId} está frágil ou em conflito.`);
        reasonCodes.push('PREREQUISITE_UNCERTAINTY');
      } else {
        sumPrereq += policy.prerequisite.fallback;
      }
    }
    prerequisiteReadiness = sumPrereq / topic.prerequisites.length;
  }

  // 9. Obligation Signal (0.0 to 1.0)
  let obligationSignal = 0.2;
  if (candidate.sourceType === 'TASK') {
    if (candidate.isCriticalTask) obligationSignal = 1.0;
    else if (urgency >= policy.urgency.criticalMinUrgency) obligationSignal = 0.8;
    else obligationSignal = (candidate.taskUrgency ?? 5) / 10;
  } else {
    if (candidate.reviewPriority === 'CRITICAL') obligationSignal = 0.8;
    else obligationSignal = 0.3;
  }

  // 10. Opportunity Cost initial placeholder (calculated in relative pass)
  const opportunityCost = 0.0;

  // Weighted score calculation
  const rawWeighted =
    learningNeed * policy.weights.learningNeed +
    objectiveRelevance * policy.weights.objectiveRelevance +
    urgency * policy.weights.urgency +
    reviewNeed * policy.weights.reviewNeed +
    errorSignal * policy.weights.errorSignal +
    timeFit * policy.weights.timeFit +
    energyFit * policy.weights.energyFit +
    prerequisiteReadiness * policy.weights.prerequisiteReadiness +
    obligationSignal * policy.weights.obligationSignal;

  const rawScore = rawWeighted * 100;
  const internalScore = Math.round(Math.min(100, Math.max(0, rawScore)) * 10) / 10;

  return {
    factors: {
      learningNeed: Math.round(learningNeed * 100) / 100,
      objectiveRelevance: Math.round(objectiveRelevance * 100) / 100,
      urgency: Math.round(urgency * 100) / 100,
      reviewNeed: Math.round(reviewNeed * 100) / 100,
      errorSignal: Math.round(errorSignal * 100) / 100,
      timeFit: Math.round(timeFit * 100) / 100,
      energyFit: Math.round(energyFit * 100) / 100,
      prerequisiteReadiness: Math.round(prerequisiteReadiness * 100) / 100,
      obligationSignal: Math.round(obligationSignal * 100) / 100,
      opportunityCost: Math.round(opportunityCost * 100) / 100,
    },
    internalScore,
    reasons,
    uncertainties,
    reasonCodes,
  };
}

/**
 * Pure function to calculate Recommendation Confidence deterministically.
 */
export function calculateEfficiencyRecommendationConfidence(
  primaryCandidate: RankedEfficiencyCandidate | null,
  finalViableCandidates: RankedEfficiencyCandidate[],
  allRankedCandidates: RankedEfficiencyCandidate[],
  input: EfficiencyEngineInput,
  policy: EfficiencyPolicy = EFFICIENCY_POLICY_V1
): {
  confidence: 'LOW' | 'MODERATE' | 'HIGH';
  additionalUncertainties: string[];
} {
  const additionalUncertainties: string[] = [];

  if (allRankedCandidates.length === 0 || !primaryCandidate) {
    return { confidence: 'MODERATE', additionalUncertainties };
  }

  const unknownCount = allRankedCandidates.filter(e =>
    e.candidate.topicId && input.masteryStates[e.candidate.topicId!]?.status === 'UNKNOWN'
  ).length;

  if (unknownCount / allRankedCandidates.length >= policy.confidence.unknownShareThreshold) {
    return { confidence: 'LOW', additionalUncertainties };
  }

  let confidence: 'LOW' | 'MODERATE' | 'HIGH' = 'HIGH';

  const primCand = primaryCandidate.candidate;

  // Rule 1: Check Mastery confidence of primary candidate's topic
  if (primCand.topicId) {
    const mState = input.masteryStates[primCand.topicId];
    if (mState && mState.confidence === 'LOW') {
      confidence = 'MODERATE';
    }
  }

  // Rule 2: If primary is a Review, cap by review.recommendationConfidence
  if (primCand.sourceType === 'REVIEW' && primCand.recommendationConfidence) {
    if (primCand.recommendationConfidence === 'LOW' || primCand.recommendationConfidence === 'MODERATE') {
      confidence = 'MODERATE';
    }
  }

  // Rule 3: Check if primary candidate has prerequisite or unknown uncertainties
  if (
    primaryCandidate.reasonCodes.includes('PREREQUISITE_UNCERTAINTY') ||
    primaryCandidate.reasonCodes.includes('UNKNOWN_MASTERY')
  ) {
    confidence = 'MODERATE';
  }

  // Rule 4: Check margin between top 2 viable candidates in finalViableCandidates
  if (finalViableCandidates.length >= 2) {
    const margin = Math.abs(finalViableCandidates[0].internalScore - finalViableCandidates[1].internalScore);
    if (margin < policy.confidence.tightMarginThreshold) {
      confidence = 'MODERATE';
      additionalUncertainties.push('Há mais de uma ação com retorno e viabilidade semelhantes neste momento.');
    }
  }

  return { confidence, additionalUncertainties };
}

export function isSafeGenericReviewReplacement(params: {
  taskCandidate: EfficiencyCandidate;
  taskBaseScore: number;
  reviewCandidate: EfficiencyCandidate;
  reviewBaseScore: number;
  availableMinutes: number;
  policy: EfficiencyPolicy;
}): boolean {
  const {
    taskCandidate,
    taskBaseScore,
    reviewCandidate,
    reviewBaseScore,
    availableMinutes,
    policy,
  } = params;

  // A) Task must be non-critical and generic review
  if (taskCandidate.isCriticalTask) return false;
  if (taskCandidate.taskCategory !== 'revisao') return false;

  // B) Review must be sourceType REVIEW
  if (reviewCandidate.sourceType !== 'REVIEW') return false;

  // C) Same topicId
  if (!taskCandidate.topicId || taskCandidate.topicId !== reviewCandidate.topicId) return false;

  // D) Review fits in availableMinutes
  if (reviewCandidate.durationMinutes > availableMinutes) return false;

  const redundancyConfig = policy.redundancy || EFFICIENCY_POLICY_V1.redundancy;

  // G) Review recommendationConfidence check
  if (
    !redundancyConfig.allowLowConfidenceReplacement &&
    reviewCandidate.recommendationConfidence === 'LOW'
  ) {
    return false;
  }

  // H) Clear score advantage
  if (reviewBaseScore <= taskBaseScore + redundancyConfig.minScoreAdvantage) {
    return false;
  }

  return true;
}

/**
 * Pure deterministic Motor de Eficiência 2.0 Core
 *
 * Recebe tasks, reviews e contextos do usuário, avalia candidatos,
 * ranqueia por ROI de aprendizado e viabilidade temporal/energética,
 * e produz decisões semânticas (FAZER, ADIAR, NAO_FAZER).
 */
export function evaluateEfficiencyV2(input: EfficiencyEngineInput): EfficiencyEngineOutput {
  const policy = input.policy || EFFICIENCY_POLICY_V1;
  const candidates: EfficiencyCandidate[] = [];

  // 1. Build Task Candidates (pending or in_progress)
  for (const t of input.tasks) {
    if (t.status === 'pending' || t.status === 'in_progress') {
      candidates.push({
        id: `task:${t.id}`,
        sourceType: 'TASK',
        sourceId: t.id,
        subjectId: t.subjectId,
        topicId: t.topicId,
        title: t.title,
        durationMinutes: t.durationMinutes,
        energyRequired: t.energyRequired,
        isCriticalTask: t.isCritical,
        dueDate: t.dueDate,
        taskCategory: t.category,
        taskUrgency: t.urgency,
        taskImpact: t.impact,
      });
    }
  }

  // 2. Build Review Candidates (status === AVAILABLE AND userId === input.userId)
  for (const r of input.reviews) {
    if (r.status === 'AVAILABLE' && r.userId === input.userId) {
      const topic = input.topics.find(top => top.id === r.topicId);
      candidates.push({
        id: `review:${r.id}`,
        sourceType: 'REVIEW',
        sourceId: r.id,
        subjectId: r.subjectId,
        topicId: r.topicId,
        title: `Revisão: ${topic?.name || r.topicId}`,
        durationMinutes: r.estimatedMinutes,
        energyRequired: estimateReviewEnergyRequirement(r.reviewType),
        reviewType: r.reviewType,
        triggerReason: r.triggerReason,
        reviewPriority: r.priority,
        recommendationConfidence: r.recommendationConfidence,
      });
    }
  }

  interface EvaluatedCandidateItem {
    candidate: EfficiencyCandidate;
    decision: ActionDecision;
    internalScore: number;
    factorBreakdown: EfficiencyFactorBreakdown;
    reasons: string[];
    uncertainties: string[];
    reasonCodes: string[];
    rationale: string;
  }

  // First pass: evaluate candidate factor scores
  const initialEvaluated = candidates.map(candidate => {
    const evalRes = evaluateCandidateEfficiency(candidate, input, policy);
    return {
      candidate,
      evalRes,
      baseScore: evalRes.internalScore,
    };
  });

  // Second pass: evaluate decisions including safe generic review replacement
  const evaluated: EvaluatedCandidateItem[] = initialEvaluated.map(item => {
    const { candidate, evalRes, baseScore } = item;
    let decision: ActionDecision = 'ADIAR';

    if (candidate.sourceType === 'TASK') {
      const safeReplacement = initialEvaluated.find(other =>
        isSafeGenericReviewReplacement({
          taskCandidate: candidate,
          taskBaseScore: baseScore,
          reviewCandidate: other.candidate,
          reviewBaseScore: other.baseScore,
          availableMinutes: input.availableMinutes,
          policy,
        })
      );

      if (safeReplacement) {
        decision = 'NAO_FAZER';
        evalRes.reasonCodes.push('GENERIC_REVIEW_REDUNDANT');
        evalRes.reasons.push('Substituída por uma intervenção de revisão mais específica baseada nas evidências atuais.');
      }
    }

    return {
      candidate,
      decision,
      internalScore: evalRes.internalScore,
      factorBreakdown: evalRes.factors,
      reasons: evalRes.reasons,
      uncertainties: evalRes.uncertainties,
      reasonCodes: evalRes.reasonCodes,
      rationale: '', // to be constructed
    };
  });

  // Calculate Opportunity Cost relative to best viable candidate
  const initialViableCandidates = evaluated.filter(
    e => e.candidate.durationMinutes <= input.availableMinutes && e.decision !== 'NAO_FAZER'
  );

  const bestViableBaseScore = initialViableCandidates.length > 0
    ? Math.max(...initialViableCandidates.map(c => c.internalScore))
    : 0;

  for (const item of evaluated) {
    if (item.candidate.durationMinutes <= input.availableMinutes && item.decision !== 'NAO_FAZER') {
      const diff = Math.max(0, bestViableBaseScore - item.internalScore);
      const oppCost = Math.min(1.0, Math.round((diff / policy.opportunityCost.maxGapForNorm) * 100) / 100);
      item.factorBreakdown.opportunityCost = oppCost;

      // Deduct opportunity cost penalty if applicable
      if (oppCost > 0) {
        item.internalScore = Math.round(Math.max(0, item.internalScore - oppCost * policy.weights.opportunityCost * 100) * 10) / 10;
        item.reasonCodes.push('LOWER_ROI_THAN_PRIMARY');
      }
    } else {
      item.factorBreakdown.opportunityCost = 0.0;
    }
  }

  // Sort candidates by internalScore descending, then by candidate ID for strict determinism and order invariance
  evaluated.sort((a, b) => {
    if (b.internalScore !== a.internalScore) {
      return b.internalScore - a.internalScore;
    }
    return a.candidate.id.localeCompare(b.candidate.id);
  });

  // Select primary candidate (top candidate in sorted evaluated that fits and is NOT NAO_FAZER)
  let primaryCandidate: RankedEfficiencyCandidate | null = null;

  for (const item of evaluated) {
    if (item.decision === 'NAO_FAZER') continue;

    if (item.candidate.durationMinutes <= input.availableMinutes) {
      if (!primaryCandidate) {
        item.decision = 'FAZER';
        primaryCandidate = item;
      } else {
        item.decision = 'ADIAR';
      }
    } else {
      item.decision = 'ADIAR';
    }
  }

  // Construct finalViableCandidates AFTER final decision and scoring
  const finalViableCandidates = evaluated.filter(
    item => item.decision !== 'NAO_FAZER' && item.candidate.durationMinutes <= input.availableMinutes
  );

  // Construct semantic human rationales (NO NUMBERS /100)
  for (const item of evaluated) {
    const cand = item.candidate;
    const topic = cand.topicId ? input.topics.find(t => t.id === cand.topicId) : undefined;
    const topicName = topic?.name || cand.title;

    if (item.decision === 'FAZER') {
      if (cand.sourceType === 'REVIEW') {
        item.rationale = `Ação prioritária de revisão que cabe no tempo disponível (${cand.durationMinutes} min) e foca em ${topicName}.`;
      } else {
        item.rationale = `Ação recomendada para o seu intervalo atual de ${input.availableMinutes} min (${cand.durationMinutes} min de duração).`;
      }
    } else if (item.decision === 'ADIAR') {
      if (cand.durationMinutes > input.availableMinutes) {
        item.rationale = `Atividade relevante para ${topicName}, mas sua duração (${cand.durationMinutes} min) excede o tempo disponível de ${input.availableMinutes} min. Adiada para uma janela maior.`;
      } else if (item.factorBreakdown.opportunityCost > 0) {
        item.rationale = `É uma atividade útil, mas outra ação disponível oferece melhor combinação de necessidade e viabilidade no momento.`;
      } else {
        item.rationale = `Atividade mantida em espera para momento posterior.`;
      }
    } else if (item.decision === 'NAO_FAZER') {
      item.rationale = `Substituída por uma intervenção mais específica baseada nas evidências atuais.`;
    }
  }

  // Calculate overall Recommendation Confidence and additional uncertainties
  const confResult = calculateEfficiencyRecommendationConfidence(
    primaryCandidate,
    finalViableCandidates,
    evaluated,
    input,
    policy
  );

  // Aggregate overall reasons and uncertainties (with deduplication & primary propagation)
  const overallReasons: string[] = [];
  const uncertaintySet = new Set<string>();

  if (primaryCandidate) {
    overallReasons.push(`Recomendação principal: "${primaryCandidate.candidate.title}" selecionada para janela de ${input.availableMinutes} min.`);
    for (const unc of primaryCandidate.uncertainties) {
      uncertaintySet.add(unc);
    }
  } else if (evaluated.length > 0) {
    overallReasons.push(`Nenhuma ação inteira disponível cabe com segurança neste intervalo de ${input.availableMinutes} min.`);
  } else {
    overallReasons.push('Nenhuma tarefa ou revisão pendente no momento.');
  }

  const unknownCount = evaluated.filter(e =>
    e.candidate.topicId && input.masteryStates[e.candidate.topicId!]?.status === 'UNKNOWN'
  ).length;

  if (unknownCount > 0) {
    uncertaintySet.add(`${unknownCount} tópicos avaliados ainda possuem dados insuficientes de domínio (UNKNOWN).`);
  }

  for (const unc of confResult.additionalUncertainties) {
    uncertaintySet.add(unc);
  }

  return {
    primaryCandidate,
    rankedCandidates: evaluated,
    recommendationConfidence: confResult.confidence,
    reasons: overallReasons,
    uncertainties: Array.from(uncertaintySet),
    policyVersion: policy.version,
    evaluatedAt: input.now,
  };
}

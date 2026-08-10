import { 
  MasteryState, 
  MasteryStatus, 
  MasteryConfidence, 
  MasteryTrend, 
  LearningEvidence, 
  TopicNode, 
  QuestionDifficulty 
} from '../types';

export interface ComputeMasteryInput {
  userId: string;
  topic: TopicNode | { id: string; subjectId: string; name: string };
  evidences: LearningEvidence[];
  computedAt?: string;
}

export type MasterySourceClassification = 
  | 'SUPPORTING' 
  | 'FRAGILE' 
  | 'SELF_CORRECTED' 
  | 'POST_SOLUTION_ASSISTED' 
  | 'CONTRADICTING' 
  | 'NON_MASTERY';

export type SourceOutcome = 'STRONG_POSITIVE' | 'FRAGILE_POSITIVE' | 'NEGATIVE' | 'ASSISTED' | 'NON_MASTERY';

/**
 * Classifies a single source (Attempt) based on the full combination of its evidences
 */
export function classifyMasterySource(sourceEvidences: LearningEvidence[]): MasterySourceClassification {
  if (sourceEvidences.length === 0) {
    return 'NON_MASTERY';
  }

  const hasStrongPos = sourceEvidences.some(e => e.signal === 'STRONG_POSITIVE');
  const hasFragilePos = sourceEvidences.some(e => e.signal === 'FRAGILE_POSITIVE');
  const hasNeg = sourceEvidences.some(e => e.signal === 'NEGATIVE_SIGNAL' || e.signal === 'CONFIDENCE_DIVERGENCE');
  const hasSelfCorr = sourceEvidences.some(e => e.signal === 'SELF_CORRECTION');
  const hasPostSol = sourceEvidences.some(e => e.signal === 'POST_SOLUTION');

  if (hasStrongPos) {
    return 'SUPPORTING';
  }

  if (hasFragilePos) {
    return 'FRAGILE';
  }

  if (hasNeg && hasSelfCorr) {
    return 'SELF_CORRECTED';
  }

  if (hasNeg && hasPostSol) {
    return 'POST_SOLUTION_ASSISTED';
  }

  if (hasNeg) {
    return 'CONTRADICTING';
  }

  if (hasSelfCorr) {
    return 'SELF_CORRECTED';
  }

  if (hasPostSol) {
    return 'POST_SOLUTION_ASSISTED';
  }

  return 'NON_MASTERY';
}

/**
 * Derives the overall learning outcome for a single source (Attempt)
 */
export function deriveSourceLearningOutcome(sourceEvidences: LearningEvidence[]): SourceOutcome {
  const classification = classifyMasterySource(sourceEvidences);
  switch (classification) {
    case 'SUPPORTING':
      return 'STRONG_POSITIVE';
    case 'FRAGILE':
      return 'FRAGILE_POSITIVE';
    case 'SELF_CORRECTED':
    case 'POST_SOLUTION_ASSISTED':
      return 'ASSISTED';
    case 'CONTRADICTING':
      return 'NEGATIVE';
    case 'NON_MASTERY':
    default:
      return 'NON_MASTERY';
  }
}

export interface MasteryConfidenceInput {
  levelSupportingIndependentSourceCount: number;
  informativeIndependentSourceCount: number;
  fragileIndependentSourceCount: number;
  contradictingIndependentSourceCount: number;
  assistedIndependentSourceCount: number;
  status: MasteryStatus;
  uncertaintyReasons: string[];
  supportingEvidences: LearningEvidence[];
}

/**
 * Calculates MasteryConfidence factual rating based on source volume, consistency and uncertainty
 */
export function calculateMasteryConfidence(input: MasteryConfidenceInput): MasteryConfidence {
  const {
    levelSupportingIndependentSourceCount,
    contradictingIndependentSourceCount,
    assistedIndependentSourceCount,
    status,
    uncertaintyReasons,
    supportingEvidences,
  } = input;

  if (status === 'UNKNOWN' || status === 'INSUFFICIENT_EVIDENCE' || status === 'CONFLICTED') {
    return 'LOW';
  }

  if (levelSupportingIndependentSourceCount < 3 || uncertaintyReasons.length >= 3) {
    return 'LOW';
  }

  // Criteria for HIGH confidence: at least 5 level supporting independent sources, estimated status, low conflict, multiple timestamps on SUPPORTING sources ONLY
  const uniqueSupportingDates = new Set(
    supportingEvidences.map(e => e.createdAt.split('T')[0])
  );

  if (
    levelSupportingIndependentSourceCount >= 5 &&
    status === 'ESTIMATED' &&
    contradictingIndependentSourceCount === 0 &&
    assistedIndependentSourceCount <= 1 &&
    uncertaintyReasons.length <= 1 &&
    uniqueSupportingDates.size >= 2
  ) {
    return 'HIGH';
  }

  // MODERATE confidence requires at least 3 level-supporting independent sources across at least 2 distinct dates
  if (
    levelSupportingIndependentSourceCount >= 3 &&
    uniqueSupportingDates.size >= 2 &&
    contradictingIndependentSourceCount <= 1 &&
    uncertaintyReasons.length < 3
  ) {
    return 'MODERATE';
  }

  return 'LOW';
}

/**
 * Calculates MasteryTrend based on chronological evidence progression grouped by sourceId
 */
export function calculateMasteryTrend(
  topicEvidences: LearningEvidence[]
): MasteryTrend {
  if (topicEvidences.length === 0) {
    return 'UNKNOWN';
  }

  // Group evidences by sourceId
  const sourceMap = new Map<string, LearningEvidence[]>();
  topicEvidences.forEach(ev => {
    const list = sourceMap.get(ev.sourceId) || [];
    list.push(ev);
    sourceMap.set(ev.sourceId, list);
  });

  // Sort sources chronologically by their earliest evidence
  const sortedSourceIds = Array.from(sourceMap.keys()).sort((a, b) => {
    const earliestA = Math.min(...(sourceMap.get(a) || []).map(e => new Date(e.createdAt).getTime()));
    const earliestB = Math.min(...(sourceMap.get(b) || []).map(e => new Date(e.createdAt).getTime()));
    return earliestA - earliestB;
  });

  // Derive outcome per source and filter out NON_MASTERY sources
  const informativeSources = sortedSourceIds
    .map(sourceId => ({
      sourceId,
      outcome: deriveSourceLearningOutcome(sourceMap.get(sourceId) || []),
    }))
    .filter(s => s.outcome !== 'NON_MASTERY');

  // Check how many non-assisted domain sources exist (STRONG_POSITIVE, FRAGILE_POSITIVE, or NEGATIVE)
  const domainSources = informativeSources.filter(s => s.outcome === 'STRONG_POSITIVE' || s.outcome === 'FRAGILE_POSITIVE' || s.outcome === 'NEGATIVE');

  if (domainSources.length < 3) {
    return 'UNKNOWN';
  }

  const mid = Math.floor(informativeSources.length / 2);
  const firstHalf = informativeSources.slice(0, mid);
  const secondHalf = informativeSources.slice(mid);

  const isPos = (o: SourceOutcome) => o === 'STRONG_POSITIVE' || o === 'FRAGILE_POSITIVE';
  const isNeg = (o: SourceOutcome) => o === 'NEGATIVE';

  const firstPos = firstHalf.filter(s => isPos(s.outcome)).length;
  const firstNeg = firstHalf.filter(s => isNeg(s.outcome)).length;

  const secondPos = secondHalf.filter(s => isPos(s.outcome)).length;
  const secondNeg = secondHalf.filter(s => isNeg(s.outcome)).length;

  if (secondPos > firstPos && secondNeg <= firstNeg) {
    return 'IMPROVING';
  }
  if (secondNeg > firstNeg && secondPos <= firstPos) {
    return 'DECLINING';
  }

  return 'STABLE';
}

/**
 * Pure function that calculates the derived MasteryState for a single topic
 */
export function computeMasteryStateForTopic({
  userId,
  topic,
  evidences,
  computedAt,
}: ComputeMasteryInput): MasteryState {
  const topicId = topic.id;

  // 1. Filter evidences for this topic and user
  const topicEvidences = evidences
    .filter(e => e.userId === userId && e.topicIds.includes(topicId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const evidenceCount = topicEvidences.length;

  // 2. Identify unique sources (attempts) and group by source
  const uniqueSourceIds = Array.from(new Set(topicEvidences.map(e => e.sourceId)));
  const independentSourceCount = uniqueSourceIds.length;

  const levelSupportingSources: string[] = [];
  const fragileSources: string[] = [];
  const contradictingSources: string[] = [];
  const assistedSources: string[] = [];
  const informativeSources: string[] = [];

  uniqueSourceIds.forEach(sourceId => {
    const sourceEvs = topicEvidences.filter(e => e.sourceId === sourceId);
    const questionAttemptEvs = sourceEvs.filter(e => e.type === 'QUESTION_ATTEMPT');
    const classification = questionAttemptEvs.length > 0 ? classifyMasterySource(questionAttemptEvs) : 'NON_MASTERY';

    switch (classification) {
      case 'SUPPORTING':
        levelSupportingSources.push(sourceId);
        informativeSources.push(sourceId);
        break;
      case 'FRAGILE':
        fragileSources.push(sourceId);
        informativeSources.push(sourceId);
        break;
      case 'SELF_CORRECTED':
      case 'POST_SOLUTION_ASSISTED':
        assistedSources.push(sourceId);
        informativeSources.push(sourceId);
        break;
      case 'CONTRADICTING':
        contradictingSources.push(sourceId);
        informativeSources.push(sourceId);
        break;
      case 'NON_MASTERY':
      default:
        if (sourceEvs.some(e => e.signal !== 'UNKNOWN' && e.signal !== 'TIME_SIGNAL')) {
          informativeSources.push(sourceId);
        }
        break;
    }
  });

  const levelSupportingIndependentSourceCount = levelSupportingSources.length;
  const fragileIndependentSourceCount = fragileSources.length;
  const contradictingIndependentSourceCount = contradictingSources.length;
  const assistedIndependentSourceCount = assistedSources.length;
  const informativeIndependentSourceCount = informativeSources.length;

  // 3. Count individual signals for stats
  let strongPositiveCount = 0;
  let fragilePositiveCount = 0;
  let negativeCount = 0;
  let confidenceDivergenceCount = 0;
  let selfCorrectionCount = 0;
  let postSolutionCount = 0;
  let timeSignalCount = 0;

  const levelSupportingEvidenceIds: string[] = [];
  const fragileEvidenceIds: string[] = [];
  const assistedEvidenceIds: string[] = [];
  const contradictingEvidenceIds: string[] = [];
  const timeEvidenceIds: string[] = [];
  const observedDiffSet = new Set<QuestionDifficulty>();

  topicEvidences.forEach(ev => {
    if (ev.difficulty && ['EASY', 'MEDIUM', 'HARD', 'UNKNOWN'].includes(ev.difficulty)) {
      observedDiffSet.add(ev.difficulty as QuestionDifficulty);
    }

    switch (ev.signal) {
      case 'STRONG_POSITIVE':
        strongPositiveCount++;
        if (levelSupportingSources.includes(ev.sourceId)) {
          levelSupportingEvidenceIds.push(ev.id);
        } else {
          fragileEvidenceIds.push(ev.id);
        }
        break;
      case 'FRAGILE_POSITIVE':
        fragilePositiveCount++;
        fragileEvidenceIds.push(ev.id);
        break;
      case 'SELF_CORRECTION':
        selfCorrectionCount++;
        assistedEvidenceIds.push(ev.id);
        break;
      case 'POST_SOLUTION':
        postSolutionCount++;
        assistedEvidenceIds.push(ev.id);
        break;
      case 'NEGATIVE_SIGNAL':
        negativeCount++;
        contradictingEvidenceIds.push(ev.id);
        break;
      case 'CONFIDENCE_DIVERGENCE':
        confidenceDivergenceCount++;
        contradictingEvidenceIds.push(ev.id);
        break;
      case 'TIME_SIGNAL':
        timeSignalCount++;
        timeEvidenceIds.push(ev.id);
        break;
      case 'UNKNOWN':
      default:
        break;
    }
  });

  const supportingEvidenceIds = levelSupportingEvidenceIds; // Deprecated alias

  const difficultiesObserved = Array.from(observedDiffSet);
  const lastEvidenceAt = topicEvidences[topicEvidences.length - 1]?.createdAt;

  // Supporting evidences (for temporal diversity in HIGH confidence calculation)
  const supportingEvidences = topicEvidences.filter(e => levelSupportingSources.includes(e.sourceId) && e.signal === 'STRONG_POSITIVE');

  // 4. Determine Uncertainty Reasons
  const uncertaintyReasons: string[] = [];

  const hasMultitopic = topicEvidences.some(e => e.topicIds.length > 1);
  if (hasMultitopic) {
    uncertaintyReasons.push(
      'Esta questão envolve múltiplos tópicos, portanto não permite isolar completamente o domínio de um único conteúdo.'
    );
  }

  const hasUnknownDiff = topicEvidences.some(e => !e.difficulty || e.difficulty === 'UNKNOWN');
  if (hasUnknownDiff) {
    uncertaintyReasons.push('Parte das questões não possui dificuldade classificada.');
  }

  if (postSolutionCount > 0) {
    uncertaintyReasons.push('Parte do desempenho ocorreu após consulta à resolução.');
  }

  if (selfCorrectionCount > 0) {
    uncertaintyReasons.push('Parte do desempenho positivo decorre de autocorreção.');
  }

  if (confidenceDivergenceCount > 0) {
    uncertaintyReasons.push('Há divergência entre confiança e resultado que ainda precisa ser esclarecida.');
  }

  if (contradictingIndependentSourceCount > 0 && (strongPositiveCount > 0 || fragilePositiveCount > 0)) {
    uncertaintyReasons.push('Existem erros registrados que contradizem o desempenho positivo.');
  }

  if (informativeIndependentSourceCount > 0 && informativeIndependentSourceCount < 3) {
    uncertaintyReasons.push('Poucas tentativas independentes registradas para este conteúdo.');
  }

  const onlyNegative = contradictingIndependentSourceCount > 0 && 
    strongPositiveCount === 0 && fragilePositiveCount === 0 && 
    selfCorrectionCount === 0 && postSolutionCount === 0;

  if (onlyNegative) {
    uncertaintyReasons.push('Há sinais de dificuldade registrados, mas ainda não existem evidências positivas suficientes para estimar o nível de aplicação.');
  }

  // 5. Calculate Status and Estimated Level
  let status: MasteryStatus = 'UNKNOWN';
  let estimatedLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | null = null;

  if (evidenceCount === 0) {
    status = 'UNKNOWN';
    estimatedLevel = null;
  } else if (onlyNegative) {
    status = 'INSUFFICIENT_EVIDENCE';
    estimatedLevel = null;
  } else {
    // Determine level from SUPPORTING sources
    let strongEasySources = 0;
    let strongMediumSources = 0;
    let strongHardSources = 0;

    levelSupportingSources.forEach(sourceId => {
      const sourceEvidences = topicEvidences.filter(e => e.sourceId === sourceId && e.signal === 'STRONG_POSITIVE');
      const hasHard = sourceEvidences.some(e => e.difficulty === 'HARD');
      const hasMedium = sourceEvidences.some(e => e.difficulty === 'MEDIUM' || e.difficulty === 'HARD');
      const hasEasy = sourceEvidences.some(e => e.difficulty === 'EASY' || e.difficulty === 'MEDIUM' || e.difficulty === 'HARD');

      if (hasHard) strongHardSources++;
      if (hasMedium) strongMediumSources++;
      if (hasEasy) strongEasySources++;
    });

    if (strongHardSources >= 2) {
      estimatedLevel = 8;
    } else if (strongMediumSources >= 2) {
      estimatedLevel = 7;
    } else if (strongEasySources >= 2) {
      estimatedLevel = 6;
    } else {
      estimatedLevel = null;
    }

    // Determine Status
    if (levelSupportingIndependentSourceCount >= 2 && contradictingIndependentSourceCount >= 2) {
      status = 'CONFLICTED';
      estimatedLevel = null; // Rule 16: CONFLICTED status MUST have estimatedLevel = null
    } else if (contradictingIndependentSourceCount >= 2 && (levelSupportingIndependentSourceCount + fragileIndependentSourceCount + assistedIndependentSourceCount > 0)) {
      status = 'CONFLICTED';
      estimatedLevel = null; // Rule 16: CONFLICTED status MUST have estimatedLevel = null
    } else if (estimatedLevel !== null) {
      if (contradictingIndependentSourceCount > 0 || fragileIndependentSourceCount > 0 || assistedIndependentSourceCount > 0) {
        status = 'FRAGILE';
      } else {
        status = 'ESTIMATED';
      }
    } else {
      // estimatedLevel === null
      if (levelSupportingIndependentSourceCount >= 1 || fragileIndependentSourceCount >= 1 || assistedIndependentSourceCount >= 1) {
        if (contradictingIndependentSourceCount > 0) {
          status = 'FRAGILE';
        } else {
          status = 'EMERGING';
        }
      } else {
        status = 'INSUFFICIENT_EVIDENCE';
      }
    }
  }

  // 6. Calculate Confidence and Trend
  const confidence = calculateMasteryConfidence({
    levelSupportingIndependentSourceCount,
    informativeIndependentSourceCount,
    fragileIndependentSourceCount,
    contradictingIndependentSourceCount,
    assistedIndependentSourceCount,
    status,
    uncertaintyReasons,
    supportingEvidences,
  });

  const trend = calculateMasteryTrend(topicEvidences);

  const updatedAt = computedAt || lastEvidenceAt;

  return {
    userId,
    topicId,
    status,
    estimatedLevel,
    confidence,
    evidenceCount,
    independentSourceCount,

    levelSupportingIndependentSourceCount,
    informativeIndependentSourceCount,
    fragileIndependentSourceCount,
    contradictingIndependentSourceCount,
    assistedIndependentSourceCount,

    strongPositiveCount,
    fragilePositiveCount,
    negativeCount,
    confidenceDivergenceCount,
    selfCorrectionCount,
    postSolutionCount,
    timeSignalCount,
    difficultiesObserved,
    levelSupportingEvidenceIds,
    fragileEvidenceIds,
    assistedEvidenceIds,
    contradictingEvidenceIds,
    timeEvidenceIds,
    supportingEvidenceIds,
    lastEvidenceAt,
    trend,
    uncertaintyReasons,
    updatedAt,
  };
}

/**
 * Pure function to compute MasteryStates for all provided topics
 */
export function computeAllMasteryStates({
  userId,
  topics,
  evidences,
  computedAt,
}: {
  userId: string;
  topics: (TopicNode | { id: string; subjectId: string; name: string })[];
  evidences: LearningEvidence[];
  computedAt?: string;
}): Record<string, MasteryState> {
  const result: Record<string, MasteryState> = {};

  topics.forEach(topic => {
    result[topic.id] = computeMasteryStateForTopic({
      userId,
      topic,
      evidences,
      computedAt,
    });
  });

  return result;
}


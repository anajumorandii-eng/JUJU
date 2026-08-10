import {
  TaskItem,
  TopicNode,
  ErrorEntry,
  EnergyLevel,
  Attempt,
  LearningEvidence,
} from '../types';
import { syncAdaptiveReviewsForUser } from './reviewOrchestrator';
import {
  ReviewRepository,
  ReviewCompletionRepository,
  LocalReviewRepository,
  LocalReviewCompletionRepository,
} from './reviewRepository';
import {
  attemptRepository as defaultAttemptRepository,
  learningEvidenceRepository as defaultLearningEvidenceRepository,
} from './questionRepository';
import {
  evaluateEfficiencyV2,
  EfficiencyEngineInput,
  EfficiencyEngineOutput,
  RankedEfficiencyCandidate,
  EfficiencyPolicy,
} from './efficiencyEngineV2';

export type { EfficiencyEngineOutput, RankedEfficiencyCandidate };

export interface EfficiencyDecisionInput {
  userId: string;
  tasks: TaskItem[];
  topics: TopicNode[];
  errors: ErrorEntry[];
  availableMinutes: number;
  energyLevel: EnergyLevel;
  now: string;
  daysUntilExam?: number;

  attemptRepository?: {
    getAttemptsByUser: (userId: string) => Attempt[];
  };
  learningEvidenceRepository?: {
    getEvidencesByUser: (userId: string) => LearningEvidence[];
  };
  reviewRepository?: ReviewRepository;
  reviewCompletionRepository?: ReviewCompletionRepository;
  customPolicy?: EfficiencyPolicy;
}

/**
  Orchestrates data preparation and calls evaluateEfficiencyV2.
 * Synchronizes adaptive reviews for the user with the given timestamp (`now`),
 * loads attempts, evidences, and mastery states, and returns the deterministic
 * recommendation without mutating tasks or executing state changes.
 */
export function buildEfficiencyDecisionForUser(
  input: EfficiencyDecisionInput
): EfficiencyEngineOutput {
  const {
    userId,
    tasks,
    topics,
    errors = [],
    availableMinutes,
    energyLevel,
    now,
    daysUntilExam,
    attemptRepository = defaultAttemptRepository,
    learningEvidenceRepository = defaultLearningEvidenceRepository,
    reviewRepository = new LocalReviewRepository(),
    reviewCompletionRepository = new LocalReviewCompletionRepository(),
    customPolicy,
  } = input;

  if (!userId) {
    throw new Error('EfficiencyDecisionOrchestrator requires a valid userId');
  }

  if (availableMinutes <= 0) {
    throw new Error('availableMinutes must be a positive number');
  }

  // 1. Load user attempts & evidences isolated by userId
  const rawAttempts = attemptRepository.getAttemptsByUser(userId) || [];
  const userAttempts = rawAttempts.filter(a => a.userId === userId);

  const rawEvidences = learningEvidenceRepository.getEvidencesByUser(userId) || [];
  const userEvidences = rawEvidences.filter(e => e.userId === userId);

  const userErrors = errors.filter(e => !(e as any).userId || (e as any).userId === userId);

  // 2. Synchronize adaptive reviews for this user using exact same `now` timestamp
  const syncResult = syncAdaptiveReviewsForUser({
    userId,
    topics,
    evidences: userEvidences,
    attempts: userAttempts,
    errors: userErrors,
    reviewRepository,
    reviewCompletionRepository,
    now,
    context: daysUntilExam !== undefined ? { daysUntilExam } : undefined,
  });

  const { reviews, noReviewDecisions, masteryStates } = syncResult;

  // 3. Prepare Engine V2 input
  const engineInput: EfficiencyEngineInput = {
    userId,
    availableMinutes,
    energyLevel,
    now,
    tasks,
    reviews,
    noReviewDecisions,
    masteryStates,
    errors: userErrors,
    topics,
    context: daysUntilExam !== undefined ? { daysUntilExam } : undefined,
    policy: customPolicy,
  };

  // 4. Evaluate and return recommendation output
  return evaluateEfficiencyV2(engineInput);
}

/**
 * Alias function name as requested in orchestrator specification.
 */
export const generateDecidePorMimV2 = buildEfficiencyDecisionForUser;

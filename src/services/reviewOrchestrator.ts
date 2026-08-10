import {
  Review,
  ReviewDecision,
  ReviewCompletion,
  ReviewCompletionOutcome,
  LearningEvidence,
  MasteryState,
  TopicNode,
  Attempt,
  ErrorEntry,
} from '../types';
import {
  generateReviewDecisionForTopic,
  reassessReview,
  applyReviewReassessment,
  materializeReviewDecision,
  createLearningEvidenceFromReviewCompletion,
} from './reviewEngine';
import { deriveReviewStatusFromWindow } from './reviewPolicy';
import { computeMasteryStateForTopic } from './masteryEngine';
import { ReviewRepository, ReviewCompletionRepository } from './reviewRepository';

export interface SyncAdaptiveReviewsInput {
  userId: string;
  topics: TopicNode[];
  evidences: LearningEvidence[];
  attempts?: Attempt[];
  errors?: ErrorEntry[];
  reviewRepository: ReviewRepository;
  reviewCompletionRepository: ReviewCompletionRepository;
  now?: string;
  context?: {
    daysUntilExam?: number;
    topicWeightMap?: Record<string, number>;
  };
}

export interface SyncAdaptiveReviewsResult {
  reviews: Review[];
  noReviewDecisions: Record<string, ReviewDecision>;
  masteryStates: Record<string, MasteryState>;
}

/**
 * Synchronizes adaptive reviews across all topics for a user.
 * Evaluates mastery, reassesses active reviews, and generates/materializes new reviews.
 */
export function syncAdaptiveReviewsForUser(
  input: SyncAdaptiveReviewsInput
): SyncAdaptiveReviewsResult {
  const {
    userId,
    topics,
    evidences,
    attempts = [],
    errors = [],
    reviewRepository,
    reviewCompletionRepository,
    now = new Date().toISOString(),
    context = {},
  } = input;

  const userReviews = reviewRepository.getReviewsByUser(userId);
  const userCompletions = reviewCompletionRepository.getCompletionsByUser(userId);

  const noReviewDecisions: Record<string, ReviewDecision> = {};
  const masteryStates: Record<string, MasteryState> = {};

  for (const topic of topics) {
    const topicEvidences = evidences.filter(e => e.topicIds.includes(topic.id));
    const topicWeight = context.topicWeightMap && context.topicWeightMap[topic.id] !== undefined
      ? context.topicWeightMap[topic.id]
      : topic.weightInExam;

    // 1. Compute mastery state
    const masteryState = computeMasteryStateForTopic({
      userId,
      topic,
      evidences: topicEvidences,
      computedAt: now,
    });
    masteryStates[topic.id] = masteryState;

    // 2. Find active reviews for this topic
    const activeReviewsForTopic = userReviews.filter(
      r =>
        r.topicId === topic.id &&
        (r.status === 'SCHEDULED' || r.status === 'AVAILABLE' || r.status === 'REASSESS')
    );

    // Reassess active reviews against current mastery & new evidences
    for (let review of activeReviewsForTopic) {
      // Refresh temporal status before reassessment
      if (review.recommendedWindowStart && review.recommendedWindowEnd) {
        const derivedStatus = deriveReviewStatusFromWindow({
          start: review.recommendedWindowStart,
          end: review.recommendedWindowEnd,
          now,
        });

        if (derivedStatus !== review.status) {
          const refreshed = reviewRepository.updateReviewStatus(
            review.id,
            userId,
            derivedStatus,
            `Status temporal atualizado para ${derivedStatus} com base na janela.`
          );
          if (refreshed) {
            review = refreshed;
          }
        }
      }

      const reassessment = reassessReview({
        review,
        currentMastery: masteryState,
        latestEvidences: topicEvidences,
        latestCompletions: userCompletions,
        topicReviews: userReviews.filter(r => r.topicId === topic.id),
        now,
      });

      if (reassessment.action !== 'KEEP') {
        applyReviewReassessment({
          review,
          reassessment,
          userId,
          reviewRepository,
          now,
        });
      }
    }

    // 3. Generate review decision for topic
    const topicReviewsUpdated = reviewRepository.getReviewsByUser(userId).filter(r => r.topicId === topic.id);

    const decision = generateReviewDecisionForTopic({
      userId,
      topic,
      masteryState,
      evidences: topicEvidences,
      attempts,
      errors,
      previousReviews: topicReviewsUpdated,
      previousReviewCompletions: userCompletions,
      now,
      context: {
        daysUntilExam: context.daysUntilExam,
        topicWeight,
      },
    });

    if (decision.action === 'SCHEDULE_REVIEW' || decision.action === 'DIAGNOSTIC_RETEST') {
      materializeReviewDecision({
        decision,
        userId,
        topic,
        reviewRepository,
        now,
      });
    } else {
      noReviewDecisions[topic.id] = decision;
    }
  }

  const finalReviews = reviewRepository.getReviewsByUser(userId);

  return {
    reviews: finalReviews,
    noReviewDecisions,
    masteryStates,
  };
}

export interface CompleteAdaptiveReviewInput {
  reviewId: string;
  userId: string;
  outcome: ReviewCompletionOutcome;
  confidence?: 1 | 2 | 3 | 4 | 5;
  actualMinutes?: number;
  linkedAttemptIds?: string[];
  notes?: string;
  completedAt?: string;
  reviewRepository: ReviewRepository;
  reviewCompletionRepository: ReviewCompletionRepository;
  learningEvidenceRepository?: { saveEvidence: (evidence: LearningEvidence) => LearningEvidence };
}

/**
 * Completes an adaptive review session, updating review status and recording completion & evidence.
 */
export function completeAdaptiveReview(
  input: CompleteAdaptiveReviewInput
): { review: Review; completion: ReviewCompletion; evidence?: LearningEvidence } {
  const {
    reviewId,
    userId,
    outcome,
    confidence,
    actualMinutes,
    linkedAttemptIds = [],
    notes,
    reviewRepository,
    reviewCompletionRepository,
    learningEvidenceRepository,
  } = input;

  const completedAtWasProvided = input.completedAt !== undefined;
  const completedAt = input.completedAt ?? new Date().toISOString();

  const existingReview = reviewRepository.getReviewById(reviewId, userId);
  if (!existingReview) {
    throw new Error(`Review with ID ${reviewId} not found for user ${userId}`);
  }

  if (existingReview.userId !== userId) {
    throw new Error(`Review ${reviewId} does not belong to user ${userId}`);
  }

  if (existingReview.status === 'CANCELED') {
    throw new Error(`Cannot complete a canceled review (${reviewId})`);
  }

  const existingCompletions = reviewCompletionRepository.getCompletionsByReview(reviewId);
  const existingCompletion = existingCompletions.length > 0 ? existingCompletions[0] : null;

  if (existingCompletion) {
    const basicMatch =
      existingCompletion.outcome === outcome &&
      (confidence === undefined || existingCompletion.confidence === confidence) &&
      (actualMinutes === undefined || existingCompletion.actualMinutes === actualMinutes);

    if (!basicMatch) {
      throw new Error(
        `Review ${reviewId} already completed with outcome ${existingCompletion.outcome}. Cannot overwrite with new parameters.`
      );
    }

    if (notes !== undefined && existingCompletion.notes !== notes) {
      throw new Error(
        `ReviewCompletion ${existingCompletion.id} immutability error: notes mismatch.`
      );
    }

    if (input.linkedAttemptIds !== undefined) {
      const eSorted = [...(existingCompletion.linkedAttemptIds || [])].sort();
      const iSorted = [...linkedAttemptIds].sort();
      if (
        eSorted.length !== iSorted.length ||
        eSorted.some((val, idx) => val !== iSorted[idx])
      ) {
        throw new Error(
          `ReviewCompletion ${existingCompletion.id} immutability error: linkedAttemptIds mismatch.`
        );
      }
    }

    if (completedAtWasProvided && existingCompletion.completedAt !== input.completedAt) {
      throw new Error(
        `ReviewCompletion ${existingCompletion.id} immutability error: completedAt mismatch.`
      );
    }

    let existingEv: LearningEvidence | undefined = undefined;
    if (existingCompletion.outcome !== 'NOT_COMPLETED') {
      existingEv = createLearningEvidenceFromReviewCompletion({
        review: existingReview,
        completion: existingCompletion,
      });

      if (learningEvidenceRepository && typeof learningEvidenceRepository.saveEvidence === 'function') {
        learningEvidenceRepository.saveEvidence(existingEv);
      }
    }

    return {
      review: existingReview,
      completion: existingCompletion,
      evidence: existingEv,
    };
  }

  if (existingReview.status === 'COMPLETED' || existingReview.status === 'SKIPPED') {
    throw new Error(`Review ${reviewId} is already in state ${existingReview.status}`);
  }

  const completionId = `comp_${reviewId}`;
  const completion: ReviewCompletion = {
    id: completionId,
    userId,
    reviewId,
    completedAt,
    outcome,
    confidence,
    actualMinutes,
    linkedAttemptIds,
    notes,
  };

  const savedCompletion = reviewCompletionRepository.saveCompletion(completion);

  const targetStatus = outcome === 'NOT_COMPLETED' ? 'SKIPPED' : 'COMPLETED';
  const updatedReview = reviewRepository.updateReviewStatus(
    reviewId,
    userId,
    targetStatus,
    outcome === 'NOT_COMPLETED' ? 'Revisão marcada como não concluída.' : 'Revisão concluída pelo usuário.'
  );

  if (!updatedReview) {
    throw new Error(`Failed to update review status to ${targetStatus} for ${reviewId}`);
  }

  let evidence: LearningEvidence | undefined = undefined;
  if (outcome !== 'NOT_COMPLETED') {
    evidence = createLearningEvidenceFromReviewCompletion({
      review: updatedReview,
      completion: savedCompletion,
    });

    if (learningEvidenceRepository && typeof learningEvidenceRepository.saveEvidence === 'function') {
      learningEvidenceRepository.saveEvidence(evidence);
    }
  }

  return {
    review: updatedReview,
    completion: savedCompletion,
    evidence,
  };
}

export interface GroupReviewsForDisplayInput {
  reviews: Review[];
  noReviewDecisions?: Record<string, ReviewDecision>;
  now?: string;
}

export interface GroupedReviews {
  available: Review[];
  scheduled: Review[];
  noReviewNow: { topicId: string; decision: ReviewDecision }[];
  completed: Review[];
  needsReassessment?: Review[];
}

/**
 * Groups reviews into display buckets based on review status and recommended windows relative to `now`.
 */
export function groupReviewsForDisplay(
  input: GroupReviewsForDisplayInput
): GroupedReviews {
  const { reviews, noReviewDecisions = {}, now = new Date().toISOString() } = input;
  const currentDate = new Date(now).getTime();

  const available: Review[] = [];
  const scheduled: Review[] = [];
  const completed: Review[] = [];
  const needsReassessment: Review[] = [];

  for (const r of reviews) {
    if (r.status === 'CANCELED') continue;

    if (r.status === 'COMPLETED' || r.status === 'SKIPPED') {
      completed.push(r);
      continue;
    }

    if (r.status === 'REASSESS') {
      needsReassessment.push(r);
      continue;
    }

    if (r.status === 'AVAILABLE') {
      available.push(r);
      continue;
    }

    if (r.status === 'SCHEDULED') {
      if (r.recommendedWindowStart) {
        const startDate = new Date(r.recommendedWindowStart).getTime();
        const endDate = r.recommendedWindowEnd ? new Date(r.recommendedWindowEnd).getTime() : Infinity;

        if (currentDate >= startDate && currentDate <= endDate) {
          available.push({ ...r, status: 'AVAILABLE' });
        } else if (currentDate > endDate) {
          needsReassessment.push({ ...r, status: 'REASSESS' });
        } else {
          scheduled.push(r);
        }
      } else {
        available.push({ ...r, status: 'AVAILABLE' });
      }
    }
  }

  const noReviewNow = Object.entries(noReviewDecisions).map(([topicId, decision]) => ({
    topicId,
    decision,
  }));

  return {
    available,
    scheduled,
    noReviewNow,
    completed,
    needsReassessment,
  };
}

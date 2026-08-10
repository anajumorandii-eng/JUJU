import {
  Review,
  ReviewCompletion,
  ReviewStatus,
  ReviewType,
  ReviewTriggerReason,
} from '../types';

export interface ReviewRepository {
  saveReview(review: Review): Review;
  updateReviewStatus(id: string, userId: string, status: ReviewStatus, rationale?: string): Review | null;
  rescheduleReview(params: { id: string; userId: string; windowStart: string; windowEnd: string; rationale?: string; now?: string }): Review | null;
  changeReviewMethod(params: { id: string; userId: string; reviewType: ReviewType; rationale?: string }): Review | null;
  getReviewsByUser(userId: string): Review[];
  getReviewById(id: string, userId: string): Review | null;
  findActiveReviewForTopicAndTrigger(userId: string, topicId: string, triggerReason: ReviewTriggerReason): Review | null;
}

export interface ReviewCompletionRepository {
  saveCompletion(completion: ReviewCompletion): ReviewCompletion;
  getCompletionsByUser(userId: string): ReviewCompletion[];
  getCompletionsByReview(reviewId: string): ReviewCompletion[];
}

const REVIEWS_KEY = 'juju_reviews_v1';
const REVIEW_COMPLETIONS_KEY = 'juju_review_completions_v1';

const memoryStore: Record<string, string> = {};

function getItem(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryStore[key] || null;
}

function setItem(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  } else {
    memoryStore[key] = value;
  }
}

import {
  deriveReviewStatusFromWindow,
  estimateReviewMinutes,
} from './reviewPolicy';

function isReviewIdentical(a: Review, b: Review): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    a.subjectId === b.subjectId &&
    a.topicId === b.topicId &&
    a.reviewType === b.reviewType &&
    a.triggerReason === b.triggerReason &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.createdAt === b.createdAt &&
    a.notBefore === b.notBefore &&
    a.recommendedWindowStart === b.recommendedWindowStart &&
    a.recommendedWindowEnd === b.recommendedWindowEnd &&
    a.estimatedMinutes === b.estimatedMinutes &&
    a.rationale === b.rationale &&
    a.recommendationConfidence === b.recommendationConfidence &&
    a.policyVersion === b.policyVersion &&
    JSON.stringify(a.sourceEvidenceIds || []) === JSON.stringify(b.sourceEvidenceIds || []) &&
    JSON.stringify(a.sourceAttemptIds || []) === JSON.stringify(b.sourceAttemptIds || []) &&
    JSON.stringify(a.sourceErrorIds || []) === JSON.stringify(b.sourceErrorIds || [])
  );
}

export class LocalReviewRepository implements ReviewRepository {
  getReviewsByUser(userId: string): Review[] {
    const raw = getItem(REVIEWS_KEY);
    if (!raw) return [];
    try {
      const list: Review[] = JSON.parse(raw);
      return list.filter(r => r.userId === userId);
    } catch {
      return [];
    }
  }

  getReviewById(id: string, userId: string): Review | null {
    const list = this.getReviewsByUser(userId);
    return list.find(r => r.id === id) || null;
  }

  findActiveReviewForTopicAndTrigger(
    userId: string,
    topicId: string,
    triggerReason: ReviewTriggerReason
  ): Review | null {
    const list = this.getReviewsByUser(userId);
    return list.find(
      r =>
        r.topicId === topicId &&
        r.triggerReason === triggerReason &&
        (r.status === 'SCHEDULED' || r.status === 'AVAILABLE' || r.status === 'REASSESS')
    ) || null;
  }

  saveReview(review: Review): Review {
    const raw = getItem(REVIEWS_KEY);
    let list: Review[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }

    const existingIdx = list.findIndex(r => r.id === review.id);
    if (existingIdx !== -1) {
      const existing = list[existingIdx];
      if (isReviewIdentical(existing, review)) {
        return existing; // Idempotent
      }

      throw new Error(`Immutability violation: Review ${review.id} cannot be modified via saveReview`);
    }

    list.push(review);
    setItem(REVIEWS_KEY, JSON.stringify(list));
    return review;
  }

  updateReviewStatus(id: string, userId: string, status: ReviewStatus, rationale?: string): Review | null {
    const raw = getItem(REVIEWS_KEY);
    if (!raw) return null;
    let list: Review[] = [];
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }

    const idx = list.findIndex(r => r.id === id && r.userId === userId);
    if (idx === -1) return null;

    list[idx] = {
      ...list[idx],
      status,
      rationale: rationale || list[idx].rationale,
    };

    setItem(REVIEWS_KEY, JSON.stringify(list));
    return list[idx];
  }

  rescheduleReview({ id, userId, windowStart, windowEnd, rationale, now }: { id: string; userId: string; windowStart: string; windowEnd: string; rationale?: string; now?: string }): Review | null {
    const raw = getItem(REVIEWS_KEY);
    if (!raw) return null;
    let list: Review[] = [];
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }

    const idx = list.findIndex(r => r.id === id && r.userId === userId);
    if (idx === -1) return null;

    const derivedStatus = deriveReviewStatusFromWindow({
      start: windowStart,
      end: windowEnd,
      now,
    });

    list[idx] = {
      ...list[idx],
      recommendedWindowStart: windowStart,
      recommendedWindowEnd: windowEnd,
      status: derivedStatus,
      rationale: rationale || list[idx].rationale,
    };

    setItem(REVIEWS_KEY, JSON.stringify(list));
    return list[idx];
  }

  changeReviewMethod({ id, userId, reviewType, rationale }: { id: string; userId: string; reviewType: ReviewType; rationale?: string }): Review | null {
    const raw = getItem(REVIEWS_KEY);
    if (!raw) return null;
    let list: Review[] = [];
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }

    const idx = list.findIndex(r => r.id === id && r.userId === userId);
    if (idx === -1) return null;

    list[idx] = {
      ...list[idx],
      reviewType,
      estimatedMinutes: estimateReviewMinutes(reviewType),
      rationale: rationale || list[idx].rationale,
    };

    setItem(REVIEWS_KEY, JSON.stringify(list));
    return list[idx];
  }
}

function isCompletionIdentical(a: ReviewCompletion, b: ReviewCompletion): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    a.reviewId === b.reviewId &&
    a.outcome === b.outcome &&
    a.confidence === b.confidence &&
    a.actualMinutes === b.actualMinutes &&
    a.notes === b.notes &&
    a.completedAt === b.completedAt &&
    JSON.stringify(a.linkedAttemptIds || []) === JSON.stringify(b.linkedAttemptIds || [])
  );
}

export class LocalReviewCompletionRepository implements ReviewCompletionRepository {
  getCompletionsByUser(userId: string): ReviewCompletion[] {
    const raw = getItem(REVIEW_COMPLETIONS_KEY);
    if (!raw) return [];
    try {
      const list: ReviewCompletion[] = JSON.parse(raw);
      return list.filter(c => c.userId === userId);
    } catch {
      return [];
    }
  }

  getCompletionsByReview(reviewId: string): ReviewCompletion[] {
    const raw = getItem(REVIEW_COMPLETIONS_KEY);
    if (!raw) return [];
    try {
      const list: ReviewCompletion[] = JSON.parse(raw);
      return list.filter(c => c.reviewId === reviewId);
    } catch {
      return [];
    }
  }

  saveCompletion(completion: ReviewCompletion): ReviewCompletion {
    const raw = getItem(REVIEW_COMPLETIONS_KEY);
    let list: ReviewCompletion[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }

    const existing = list.find(c => c.id === completion.id);
    if (existing) {
      if (isCompletionIdentical(existing, completion)) {
        return existing;
      }
      throw new Error(`Immutability violation: ReviewCompletion ${completion.id} cannot be modified after saving`);
    }

    list.push(completion);
    setItem(REVIEW_COMPLETIONS_KEY, JSON.stringify(list));
    return completion;
  }
}

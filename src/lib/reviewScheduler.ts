import { MasteryStage, ReviewEvent, TopicMastery } from '../types';

// Interval ranges (in days) per outcome, matching the tables shared by the
// three study manuals: erro -> 1-2d, ajuda -> 3-7d, independente -> 10-21d,
// transferência -> 30-45d, retenção -> manutenção mensal/cumulativa.
const INTERVAL_RANGE_DAYS: Record<MasteryStage, [number, number]> = {
  0: [1, 2],
  1: [3, 7],
  2: [10, 21],
  3: [30, 45],
  4: [45, 60],
};

// How much a fresh, independent-or-better outcome maps to a domain level (0-100).
const OUTCOME_TO_LEVEL: Record<MasteryStage, number> = {
  0: 10,
  1: 40,
  2: 65,
  3: 85,
  4: 100,
};

export class ReviewScheduler {
  /**
   * Next interval in days given the latest recall outcome. A weak outcome
   * (0 or 1) resets close to the minimum of its range regardless of history.
   * A strong outcome (2-4) grows the previous interval, capped by the
   * range's maximum, faster the more consecutive successes there are.
   */
  public static computeNextInterval(
    outcome: MasteryStage,
    consecutiveSuccesses: number,
    currentIntervalDays: number
  ): number {
    const [min, max] = INTERVAL_RANGE_DAYS[outcome];

    if (outcome <= 1) {
      return min;
    }

    const growthFactor = Math.min(1 + consecutiveSuccesses * 0.15, 2);
    const proposed = Math.round(Math.max(currentIntervalDays, min) * growthFactor);
    return Math.min(Math.max(proposed, min), max);
  }

  /**
   * Applies one recall attempt to a topic's mastery: updates level, stage,
   * schedule and error streak, and returns the ReviewEvent audit row.
   */
  public static recordOutcome(
    mastery: TopicMastery,
    outcome: MasteryStage,
    consultedMaterial: boolean,
    now: Date = new Date()
  ): { updatedMastery: TopicMastery; event: ReviewEvent } {
    const intervalBeforeDays = mastery.currentIntervalDays;
    const consecutiveSuccesses = outcome >= 2 ? mastery.consecutiveSuccesses + 1 : 0;
    const intervalAfterDays = this.computeNextInterval(outcome, consecutiveSuccesses, intervalBeforeDays);
    const nextReviewDate = new Date(now.getTime() + intervalAfterDays * 86400000).toISOString();
    const level = Math.round(mastery.level * 0.4 + OUTCOME_TO_LEVEL[outcome] * 0.6);

    const updatedMastery: TopicMastery = {
      ...mastery,
      level,
      stage: outcome,
      lastReviewed: now.toISOString(),
      nextReviewDate,
      currentIntervalDays: intervalAfterDays,
      consecutiveSuccesses,
      errorSignals: outcome <= 1 ? mastery.errorSignals + 1 : 0,
      uncertainty:
        outcome >= 3
          ? Math.max(mastery.uncertainty - 0.15, 0.05)
          : Math.min(mastery.uncertainty + 0.1, 1),
    };

    const event: ReviewEvent = {
      id: `review_${mastery.topicId}_${now.getTime()}`,
      topicId: mastery.topicId,
      date: now.toISOString(),
      outcome,
      consultedMaterial,
      intervalBeforeDays,
      intervalAfterDays,
    };

    return { updatedMastery, event };
  }

  /** Topics whose scheduled review date has already passed. */
  public static getDueTopics(masteryData: TopicMastery[], now: Date = new Date()): TopicMastery[] {
    return masteryData.filter((m) => new Date(m.nextReviewDate).getTime() <= now.getTime());
  }
}

import { TaskItem } from '../types';
import { RankedEfficiencyCandidate, EfficiencyCandidate } from './efficiencyEngineV2';

export type EfficiencyActionResolution =
  | {
      type: 'START_TASK';
      task: TaskItem;
    }
  | {
      type: 'OPEN_REVIEW';
      reviewId: string;
    }
  | {
      type: 'BLOCKED';
      reason: string;
    };

export function isTaskStillCompatibleWithCandidate(
  candidate: EfficiencyCandidate,
  task: TaskItem
): { compatible: boolean; reason?: string } {
  // Duration change check
  if (candidate.durationMinutes !== undefined && task.durationMinutes !== candidate.durationMinutes) {
    return {
      compatible: false,
      reason: 'A duração desta tarefa mudou desde que a recomendação foi calculada. Recalcule a decisão.',
    };
  }

  if (candidate.title !== task.title) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.subjectId !== task.subjectId) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.topicId !== task.topicId) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.energyRequired !== task.energyRequired) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.isCriticalTask !== task.isCritical) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.dueDate !== task.dueDate) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.taskCategory !== task.category) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.taskUrgency !== task.urgency) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }
  if (candidate.taskImpact !== task.impact) {
    return { compatible: false, reason: 'A tarefa mudou desde que a recomendação foi calculada.' };
  }

  return { compatible: true };
}

/**
 * Pure function to resolve a RankedEfficiencyCandidate or EfficiencyCandidate into a safe execution intention.
 * Does not mutate inputs, access DOM, or hit external repositories.
 */
export function resolveEfficiencyAction(
  candidateInput: RankedEfficiencyCandidate | EfficiencyCandidate,
  tasks: TaskItem[],
  selectedMinutes: number
): EfficiencyActionResolution {
  const candidate: EfficiencyCandidate =
    'candidate' in candidateInput ? candidateInput.candidate : candidateInput;

  // 1. Time fit check on candidate snapshot
  if (candidate.durationMinutes > selectedMinutes) {
    return {
      type: 'BLOCKED',
      reason: 'Esta ação não cabe no tempo que você informou. Altere a janela para escolhê-la.',
    };
  }

  // 2. TASK resolution
  if (candidate.sourceType === 'TASK') {
    const foundTask = tasks.find(t => t.id === candidate.sourceId);

    if (!foundTask) {
      return {
        type: 'BLOCKED',
        reason: 'A tarefa mudou desde que a recomendação foi calculada.',
      };
    }

    if (foundTask.status === 'completed' || foundTask.status === 'abandoned') {
      return {
        type: 'BLOCKED',
        reason: 'A tarefa mudou desde que a recomendação foi calculada.',
      };
    }

    // Re-check real task duration against selectedMinutes
    if (foundTask.durationMinutes > selectedMinutes) {
      return {
        type: 'BLOCKED',
        reason: 'A duração desta tarefa mudou desde que a recomendação foi calculada. Recalcule a decisão.',
      };
    }

    // Check snapshot compatibility
    const compat = isTaskStillCompatibleWithCandidate(candidate, foundTask);
    if (!compat.compatible) {
      return {
        type: 'BLOCKED',
        reason: compat.reason || 'A tarefa mudou desde que a recomendação foi calculada.',
      };
    }

    return {
      type: 'START_TASK',
      task: foundTask,
    };
  }

  // 3. REVIEW resolution
  if (candidate.sourceType === 'REVIEW') {
    return {
      type: 'OPEN_REVIEW',
      reviewId: candidate.sourceId,
    };
  }

  return {
    type: 'BLOCKED',
    reason: 'Tipo de ação desconhecido.',
  };
}

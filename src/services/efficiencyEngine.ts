import { TaskItem, TopicNode, UserProfile, Subject } from '../types';

export interface PlanFeasibility {
  availableMinutes: number;
  plannedMinutes: number;
  feasibilityPercentage: number;
  isOverloaded: boolean;
  overloadMinutes: number;
  statusText: string;
}

export function calculatePlanFeasibility(
  user: UserProfile,
  tasks: TaskItem[]
): PlanFeasibility {
  const availableMinutes = user.availableHoursPerDay * 60;
  const activeTasks = tasks.filter(t => t.decision === 'FAZER' && t.status !== 'abandoned');
  const plannedMinutes = activeTasks.reduce((acc, t) => acc + t.durationMinutes, 0);

  const overloadMinutes = Math.max(0, plannedMinutes - availableMinutes);
  const isOverloaded = overloadMinutes > 0;
  
  // Calculate percentage capped at reasonable bounds
  const rawPercentage = Math.round((availableMinutes / Math.max(1, plannedMinutes)) * 100);
  const feasibilityPercentage = Math.min(100, Math.max(10, rawPercentage));

  let statusText = 'Excelente viabilidade — plano sustentável com margem para imprevistos.';
  if (feasibilityPercentage < 50) {
    statusText = `Crítico: Seu planejamento excede seu tempo em ${Math.round(overloadMinutes / 60 * 10) / 10} horas. Risco alto de esgotamento e culpa.`;
  } else if (feasibilityPercentage < 80) {
    statusText = `Atenção: Pouca margem de imprevistos (${overloadMinutes} min acima do ideal). Considere adiar itens secundários.`;
  }

  return {
    availableMinutes,
    plannedMinutes,
    feasibilityPercentage,
    isOverloaded,
    overloadMinutes,
    statusText,
  };
}

export function computeTaskROI(
  task: TaskItem,
  topics: TopicNode[],
  userEnergy: 'low' | 'medium' | 'high'
): { score: number; rationale: string; decision: 'FAZER' | 'ADIAR' | 'NAO_FAZER' } {
  const topic = topics.find(t => t.id === task.topicId);
  const examWeight = topic ? topic.weightInExam : 5;
  const mastery = topic ? topic.masteryLevel : 5;

  // Need factor: low mastery = higher need for intervention
  const needFactor = (11 - mastery); 

  // Energy match multiplier
  let energyMultiplier = 1.0;
  if (task.energyRequired === 'high' && userEnergy === 'low') {
    energyMultiplier = 0.5; // Penalty for high energy task when user is tired
  } else if (task.energyRequired === 'low' && userEnergy === 'low') {
    energyMultiplier = 1.3; // Boost low-energy tasks when tired
  }

  const benefits = (task.impact * 1.5) + (task.urgency * 1.2) + (needFactor * 1.0) + (examWeight * 0.8);
  const costs = (task.durationMinutes / 10) * (1.1 / energyMultiplier);

  const score = Math.round((benefits / Math.max(0.5, costs)) * 10) / 10;

  // Subtraction Logic Rules
  if (task.category === 'teoria' && mastery >= 6) {
    return {
      score: 2.1,
      decision: 'NAO_FAZER',
      rationale: `Subtração de Eficiência: Você já tem compreensão básica (${mastery}/10) neste tema. Ler teoria do zero traz retorno muito baixo. Faça 4 questões diretas em vez disso.`,
    };
  }

  if (score >= 6.0 || task.isCritical) {
    return {
      score,
      decision: 'FAZER',
      rationale: `Prioridade Alta (ROI: ${score}). Incidência em prova (${examWeight}/10) + gargalo ativo com alto retorno de aprendizado.`,
    };
  } else if (score >= 3.5) {
    return {
      score,
      decision: 'ADIAR',
      rationale: `Impacto moderado (ROI: ${score}). Recomendado adiar conscientemente para focar nos gargalos críticos hoje.`,
    };
  } else {
    return {
      score,
      decision: 'NAO_FAZER',
      rationale: `Atividade de baixo retorno relativo (ROI: ${score}). Custo de tempo e energia superior ao ganho esperado de aprendizado.`,
    };
  }
}

export function autoReorganizeTasks(
  user: UserProfile,
  tasks: TaskItem[],
  topics: TopicNode[]
): TaskItem[] {
  const availableMinutes = user.availableHoursPerDay * 60;
  let remainingMinutes = availableMinutes * 0.85; // Leave 15% buffer margin for unforeseen delay

  // Calculate scores for all tasks
  const scoredTasks = tasks.map(t => {
    const { score, rationale, decision } = computeTaskROI(t, topics, user.currentEnergyLevel);
    return { ...t, computedROI: score, rationale, decision };
  });

  // Sort descending by ROI
  scoredTasks.sort((a, b) => (b.computedROI || 0) - (a.computedROI || 0));

  let currentMinutes = 0;

  return scoredTasks.map(task => {
    if (task.status === 'completed' || task.status === 'abandoned') {
      return task;
    }

    if (currentMinutes + task.durationMinutes <= remainingMinutes) {
      currentMinutes += task.durationMinutes;
      return {
        ...task,
        decision: 'FAZER',
        rationale: `Mantido com prioridade no plano reorganizado (ROI: ${task.computedROI}). Cabe no seu tempo disponível com margem de imprevistos.`,
      };
    } else {
      return {
        ...task,
        decision: 'ADIAR',
        rationale: `Adiado automaticamente para proteger sua carga horária diária. Excederia seu orçamento de tempo (${user.availableHoursPerDay}h).`,
      };
    }
  });
}

export function generateDecidePorMimRecommendation(
  user: UserProfile,
  tasks: TaskItem[],
  subjects: Subject[],
  topics: TopicNode[]
): {
  recommendedTask: TaskItem | null;
  subjectName: string;
  durationMinutes: number;
  reason: string;
} {
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  if (pendingTasks.length === 0) {
    return {
      recommendedTask: null,
      subjectName: 'Nenhuma',
      durationMinutes: 0,
      reason: 'Parabéns! Todas as tarefas pendentes do dia foram concluídas ou organizadas.',
    };
  }

  // Find best match according to current energy
  const validTasks = pendingTasks.map(t => {
    const { score, rationale } = computeTaskROI(t, topics, user.currentEnergyLevel);
    return { task: t, score, rationale };
  });

  validTasks.sort((a, b) => b.score - a.score);

  const bestMatch = validTasks[0];
  const subj = subjects.find(s => s.id === bestMatch.task.subjectId);

  return {
    recommendedTask: bestMatch.task,
    subjectName: subj ? subj.name : 'Geral',
    durationMinutes: bestMatch.task.durationMinutes,
    reason: bestMatch.rationale,
  };
}

export function generateEstouPerdidoPlan(
  tasks: TaskItem[],
  subjects: Subject[]
): {
  reassuringMessage: string;
  singleTask: TaskItem | null;
  subjectName: string;
} {
  const activeTasks = tasks.filter(t => t.status === 'pending');
  if (activeTasks.length === 0) {
    return {
      reassuringMessage: 'Você está em dia. Respire fundo, não há acúmulos para recuperar hoje.',
      singleTask: null,
      subjectName: '',
    };
  }

  // Find most critical task
  const critical = activeTasks.find(t => t.isCritical) || activeTasks[0];
  const subj = subjects.find(s => s.id === critical.subjectId);

  return {
    reassuringMessage: 'Calma. Não vamos tentar recuperar semanas de matéria em poucas horas. Apenas 1 única ação concentrada hoje vai restaurar seu ritmo sem culpa.',
    singleTask: critical,
    subjectName: subj ? subj.name : '',
  };
}

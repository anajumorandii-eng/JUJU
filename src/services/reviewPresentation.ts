import {
  ReviewType,
  ReviewTriggerReason,
  ReviewPriority,
  RecommendationConfidence,
  MasteryStatus,
  MasteryConfidence,
  MasteryState,
  ReviewDecision,
  ReviewCompletionOutcome,
  Attempt,
} from '../types';

export function formatReviewType(type?: ReviewType | string): string {
  switch (type) {
    case 'ACTIVE_RECALL':
      return 'Recuperação ativa';
    case 'TARGETED_QUESTIONS':
      return 'Questões direcionadas';
    case 'ERROR_REVIEW':
      return 'Investigar erro';
    case 'REATTEMPT_WITHOUT_SUPPORT':
      return 'Refazer sem apoio';
    case 'MINI_LIST':
      return 'Mini lista';
    case 'ORAL_EXPLANATION':
      return 'Explicação oral';
    case 'FORMULA_RECONSTRUCTION':
      return 'Reconstruir fórmula';
    case 'THEORY_REFRESH':
      return 'Retomada teórica direcionada';
    case 'DIAGNOSTIC_RETEST':
      return 'Reteste curto';
    default:
      return type || 'Revisão Padrão';
  }
}

export function formatReviewPriority(priority?: ReviewPriority | string): string {
  switch (priority) {
    case 'CRITICAL':
      return 'Crítica';
    case 'HIGH':
      return 'Alta';
    case 'MEDIUM':
      return 'Média';
    case 'MAINTENANCE':
      return 'Manutenção';
    default:
      return priority || 'Média';
  }
}

export function formatReviewTriggerReason(reason?: ReviewTriggerReason | string): string {
  switch (reason) {
    case 'FRAGILE_MASTERY':
      return 'Domínio ainda frágil';
    case 'CONFIDENCE_DIVERGENCE':
      return 'Confiança e resultado divergiram';
    case 'CORRECT_UNCERTAIN':
      return 'Acerto com dúvida';
    case 'CORRECT_GUESS':
      return 'Acerto por acaso';
    case 'SELF_CORRECTION':
      return 'Autocorreção';
    case 'POST_SOLUTION_DEPENDENCY':
      return 'Acerto após consultar a resolução';
    case 'CONFLICTED_MASTERY':
      return 'Evidências conflitantes';
    case 'RETENTION_CHECK':
      return 'Checagem de retenção';
    case 'ERROR_RECURRENCE':
      return 'Erro recorrente';
    case 'EXAM_RELEVANCE':
      return 'Relevância para a prova';
    case 'MANUAL_REQUEST':
      return 'Revisão solicitada';
    default:
      return reason || 'Gatilho Pedagógico';
  }
}

export function formatConfidenceLabel(
  confidence?: RecommendationConfidence | MasteryConfidence | string
): string {
  switch (confidence) {
    case 'LOW':
      return 'Baixa';
    case 'MODERATE':
      return 'Moderada';
    case 'HIGH':
      return 'Alta';
    default:
      return confidence || 'Moderada';
  }
}

export function formatMasteryStatusLabel(status?: MasteryStatus | string): string {
  switch (status) {
    case 'UNKNOWN':
      return 'Sem Dados';
    case 'INSUFFICIENT_EVIDENCE':
      return 'Evidência Insuficiente';
    case 'EMERGING':
      return 'Em Emergência';
    case 'FRAGILE':
      return 'Frágil';
    case 'ESTIMATED':
      return 'Estimado';
    case 'CONFLICTED':
      return 'Conflitante';
    default:
      return status || 'Sem Dados';
  }
}

export function formatReviewWindow(start?: string, end?: string): string {
  if (!start && !end) {
    return 'Janela ainda não definida.';
  }

  const parseDate = (dStr: string) => {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const startDate = start ? parseDate(start) : null;
  const endDate = end ? parseDate(end) : null;

  if (!startDate && !endDate) {
    return 'Janela ainda não definida.';
  }

  const months = [
    'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
    'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'
  ];

  if (startDate && !endDate) {
    return `A partir de ${startDate.getDate()} ${months[startDate.getMonth()]}`;
  }

  if (!startDate && endDate) {
    return `Até ${endDate.getDate()} ${months[endDate.getMonth()]}`;
  }

  if (startDate && endDate) {
    const sameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate();

    if (sameDay) {
      return `${startDate.getDate()} ${months[startDate.getMonth()]}`;
    }

    const sameMonthYear =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth();

    if (sameMonthYear) {
      return `${startDate.getDate()}–${endDate.getDate()} ${months[startDate.getMonth()]}`;
    }

    return `${startDate.getDate()} ${months[startDate.getMonth()]} – ${endDate.getDate()} ${months[endDate.getMonth()]}`;
  }

  return 'Janela ainda não definida.';
}

export function getReviewTypeInstruction(reviewType?: ReviewType | string): string {
  switch (reviewType) {
    case 'ACTIVE_RECALL':
      return 'Sem consultar o material, recupere os conceitos principais e depois confira.';
    case 'TARGETED_QUESTIONS':
      return 'Resolva poucas questões direcionadas deste tópico.';
    case 'ERROR_REVIEW':
      return 'Revise onde o raciocínio divergiu antes de retomar teoria.';
    case 'REATTEMPT_WITHOUT_SUPPORT':
      return 'Refaça a questão sem consultar a resolução.';
    case 'MINI_LIST':
      return 'Resolva uma pequena sequência de questões para confirmar o padrão.';
    case 'ORAL_EXPLANATION':
      return 'Explique o conteúdo com suas próprias palavras sem consultar material.';
    case 'FORMULA_RECONSTRUCTION':
      return 'Reconstrua a relação ou fórmula a partir do significado das grandezas.';
    case 'THEORY_REFRESH':
      return 'Retome apenas o conceito indicado, de forma direcionada.';
    case 'DIAGNOSTIC_RETEST':
      return 'Produza uma nova evidência curta antes de decidir se precisa revisar mais.';
    default:
      return 'Execute os passos recomendados para este tópico de forma focada e sem distração.';
  }
}

export function getInformativeNoReviewDecisions(params: {
  noReviewDecisions: Array<{ topicId: string; decision: ReviewDecision }>;
  masteryStates: Map<string, MasteryState> | Record<string, MasteryState> | MasteryState[];
  limit?: number;
}): Array<{ topicId: string; decision: ReviewDecision }> {
  const { noReviewDecisions, masteryStates, limit = 5 } = params;

  const getMastery = (topicId: string): MasteryState | undefined => {
    if (masteryStates instanceof Map) {
      return masteryStates.get(topicId);
    }
    if (Array.isArray(masteryStates)) {
      return masteryStates.find((m) => m.topicId === topicId);
    }
    if (masteryStates && typeof masteryStates === 'object') {
      return (masteryStates as Record<string, MasteryState>)[topicId];
    }
    return undefined;
  };

  const informative = noReviewDecisions.filter(({ topicId }) => {
    const mastery = getMastery(topicId);
    if (!mastery) return false;
    // Exclude UNKNOWN mastery status from "Pode Esperar" cards
    return mastery.status !== 'UNKNOWN';
  });

  return informative.slice(0, limit);
}

export function formatReviewCompletionOutcome(outcome?: ReviewCompletionOutcome): string {
  switch (outcome) {
    case 'SUCCESS_CONFIDENT':
      return 'Concluída com segurança';
    case 'SUCCESS_EFFORTFUL':
      return 'Concluída com esforço';
    case 'PARTIAL':
      return 'Concluída parcialmente';
    case 'FAILED':
      return 'Não conseguiu nesta tentativa';
    case 'NOT_COMPLETED':
      return 'Não realizada';
    default:
      return 'Concluída';
  }
}

export interface ReviewAttemptsSummary {
  total: number;
  correctConfident: number;
  correctUncertain: number;
  correctGuess: number;
  wrong: number;
  blank: number;
  noTime: number;
  totalCorrect: number;
}

export function summarizeReviewAttempts(attempts: Attempt[]): ReviewAttemptsSummary {
  let correctConfident = 0;
  let correctUncertain = 0;
  let correctGuess = 0;
  let wrong = 0;
  let blank = 0;
  let noTime = 0;

  for (const att of attempts) {
    switch (att.result) {
      case 'CORRECT_CONFIDENT':
        correctConfident++;
        break;
      case 'CORRECT_UNCERTAIN':
        correctUncertain++;
        break;
      case 'CORRECT_GUESS':
        correctGuess++;
        break;
      case 'WRONG':
        wrong++;
        break;
      case 'BLANK':
        blank++;
        break;
      case 'NO_TIME':
        noTime++;
        break;
    }
  }

  return {
    total: attempts.length,
    correctConfident,
    correctUncertain,
    correctGuess,
    wrong,
    blank,
    noTime,
    totalCorrect: correctConfident + correctUncertain + correctGuess,
  };
}


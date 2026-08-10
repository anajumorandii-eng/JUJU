import { 
  InitialLearningDiagnostic, 
  DiagnosticInsightItem, 
  DiagnosticHypothesis, 
  DiagnosticHypothesisType,
  HypothesisStatus,
  SevenDayExperiment,
  MicroAssessmentResult,
  ConfidenceLevel
} from '../types';
import { 
  PERCEIVED_DIFFICULTIES_OPTIONS,
  PERCEIVED_STRENGTHS_OPTIONS
} from '../data/diagnosticOptions';

/**
 * Pure function to calculate outcome of two attempts on a microactivity
 */
export function calculateTwoAttemptOutcome(input: {
  firstOptionId?: string;
  firstCorrect?: boolean;
  firstConfidence?: ConfidenceLevel;
  firstReasoningText?: string;
  secondOptionId?: string;
  secondCorrect?: boolean;
  secondConfidence?: ConfidenceLevel;
  secondReasoningText?: string;
}): {
  changedAnswer: boolean;
  selfCorrection: boolean;
  finalOptionId: string;
  finalCorrect: boolean;
  finalConfidence: ConfidenceLevel;
  finalReasoningText?: string;
} {
  const firstOpt = input.firstOptionId || '';
  const secondOpt = input.secondOptionId;
  const changedAnswer = secondOpt !== undefined && secondOpt !== firstOpt;
  const selfCorrection = input.firstCorrect === false && input.secondCorrect === true;
  
  const finalOptionId = secondOpt !== undefined ? secondOpt : firstOpt;
  const finalCorrect = secondOpt !== undefined ? (input.secondCorrect ?? false) : (input.firstCorrect ?? false);
  const finalConfidence = secondOpt !== undefined ? (input.secondConfidence ?? 3) : (input.firstConfidence ?? 3);
  const finalReasoningText = secondOpt !== undefined ? input.secondReasoningText : input.firstReasoningText;

  return {
    changedAnswer,
    selfCorrection,
    finalOptionId,
    finalCorrect,
    finalConfidence,
    finalReasoningText,
  };
}

// Selectors for separating perceived vs observed insights
export function getPerceivedStrengths(diag: InitialLearningDiagnostic): DiagnosticInsightItem[] {
  return diag.perceivedStrengthInsights || diag.strengths.filter(s => s.source === 'perceived');
}

export function getPerceivedDifficulties(diag: InitialLearningDiagnostic): DiagnosticInsightItem[] {
  return diag.perceivedDifficultyInsights || diag.bottlenecks.filter(b => b.source === 'perceived');
}

export function getObservedPositiveSignals(diag: InitialLearningDiagnostic): DiagnosticInsightItem[] {
  return diag.observedPositiveSignals || diag.strengths.filter(s => s.source === 'observed');
}

export function getObservedBottlenecks(diag: InitialLearningDiagnostic): DiagnosticInsightItem[] {
  return diag.observedBottlenecks || diag.bottlenecks.filter(b => b.source === 'observed');
}

export function getOptionLabel(id: string, optionsList: { id: string; label: string }[]): string {
  const item = optionsList.find(o => o.id === id);
  return item ? item.label : id;
}

export function generateUnknowns(input: Partial<InitialLearningDiagnostic>): DiagnosticInsightItem[] {
  const unknowns: DiagnosticInsightItem[] = [];
  const microResults = input.microAssessmentResults || [];

  const hasGraphActivity = microResults.some(r => r.activityType === 'graph');
  if (!hasGraphActivity) {
    unknowns.push({
      id: 'unk_graph_data',
      title: 'Interpretação Gráfica Não Observada',
      description: 'Nenhuma atividade de análise visual/gráfica foi executada nesta amostra inicial.',
      category: 'UNKNOWN',
      source: 'observed',
    });
  }

  // Time pressure is only considered evaluated if explicitly timed
  const hasTimePressureData = microResults.some(r => r.isTimedAssessment === true);
  if (!hasTimePressureData) {
    unknowns.push({
      id: 'unk_time_pressure',
      title: 'Desempenho sob Pressão de Tempo',
      description: 'Precisão e velocidade sob limite rígido de tempo ainda não foram testadas.',
      category: 'UNKNOWN',
      source: 'observed',
    });
  }

  unknowns.push({
    id: 'unk_longterm_retention',
    title: 'Curva de Retenção de Longo Prazo',
    description: 'Ainda não existem evidências longitudinais suficientes para estimar sua retenção ao longo do tempo.',
    category: 'UNKNOWN',
    source: 'observed',
  });

  if (microResults.length < 5) {
    unknowns.push({
      id: 'unk_transfer_ability',
      title: 'Capacidade de Transferência Interdisciplinar',
      description: 'Amostra de microatividades enxuta. Aprofundaremos em novos tópicos nas sessões práticas.',
      category: 'UNKNOWN',
      source: 'observed',
    });
  }

  return unknowns.slice(0, 4);
}

export function calculateHypothesisConfidence(
  evidenceCount: number,
  convergentSourcesCount: number
): 'BAIXA' | 'MODERADA' | 'ALTA' {
  if (evidenceCount <= 1 || convergentSourcesCount <= 1) {
    return 'BAIXA';
  }
  if (evidenceCount >= 2 && convergentSourcesCount >= 2) {
    return 'MODERADA';
  }
  return 'BAIXA';
}

export function calculateInitialDiagnostic(
  partial: Partial<InitialLearningDiagnostic>
): InitialLearningDiagnostic {
  if (!partial.userId) {
    throw new Error('calculateInitialDiagnostic requires a valid userId.');
  }

  const userId = partial.userId;
  const perceivedStrengthInsights: DiagnosticInsightItem[] = [];
  const perceivedDifficultyInsights: DiagnosticInsightItem[] = [];
  const observedPositiveSignals: DiagnosticInsightItem[] = [];
  const observedBottlenecks: DiagnosticInsightItem[] = [];
  const fragileStrengths: DiagnosticInsightItem[] = [];

  const selfState = partial.selfReportedState || [];
  const errorHandling = partial.errorHandlingProfile || [];
  const reasoningAwareness = partial.reasoningAwareness || '';
  const successStreak = partial.successStreakBehavior || '';
  const difficulties = partial.perceivedDifficulties || [];
  const percStrengths = partial.perceivedStrengths || [];
  const studyMethods = partial.currentStudyMethods || {};
  const biggestTimeDrain = partial.biggestTimeDrain || '';
  const microResults: MicroAssessmentResult[] = partial.microAssessmentResults || [];

  // --- 1. EVALUATE PERCEIVED STRENGTHS (SOURCE: PERCEIVED) ---
  percStrengths.forEach((psId, idx) => {
    if (psId && psId !== 'UNSURE_STRENGTH' && psId !== 'não sei identificar') {
      const label = getOptionLabel(psId, PERCEIVED_STRENGTHS_OPTIONS);
      perceivedStrengthInsights.push({
        id: `perc_str_${idx}`,
        title: `Facilidade Relatada: ${label}`,
        description: 'Ponto forte percebido por você. Hipótese a ser validada nas sessões práticas.',
        category: 'PERCEIVED_STRENGTH',
        source: 'perceived',
      });
    }
  });

  // --- 2. EVALUATE PERCEIVED DIFFICULTIES (SOURCE: PERCEIVED) ---
  difficulties.forEach((diffId, idx) => {
    if (diffId && diffId !== 'UNSURE_DIFFICULTY' && diffId !== 'não sei identificar') {
      const label = getOptionLabel(diffId, PERCEIVED_DIFFICULTIES_OPTIONS);
      perceivedDifficultyInsights.push({
        id: `perc_diff_${idx}`,
        title: `Dificuldade Relatada: ${label}`,
        description: 'Ponto de atrito relatado por você. Investigaremos com dados reais de resolução.',
        category: 'PERCEIVED_DIFFICULTY',
        source: 'perceived',
      });
    }
  });

  // --- 3. EVALUATE MICRO-ASSESSMENT RESULTS (SOURCE: OBSERVED) ---
  let highConfErrorsCount = 0;
  let lowConfCorrectsCount = 0;
  let highConfCorrectsCount = 0;

  microResults.forEach((res) => {
    const conf = res.confidenceAtAnswer ?? res.confidenceBefore ?? 3;
    const typeLabel = res.activityType ? res.activityType.toUpperCase() : 'GERAL';
    const distractorInfo = res.chosenDistractorType 
      ? ` (Distrator: ${res.chosenDistractorType})` 
      : '';

    if (res.correct) {
      if (conf >= 4) {
        highConfCorrectsCount++;
        observedPositiveSignals.push({
          id: `obs_str_${res.activityId}`,
          title: `Indício Positivo Observado em ${typeLabel}`,
          description: `Acerto com nível de confiança ${conf}/5 em ${res.responseTimeSeconds}s. Demonstra fluidez na tarefa.`,
          category: 'OBSERVED_POSITIVE_SIGNAL',
          source: 'observed',
          cognitivePattern: res.cognitivePatterns?.[0],
        });
      } else {
        lowConfCorrectsCount++;
        fragileStrengths.push({
          id: `frag_str_${res.activityId}`,
          title: `Acerto Inseguro em ${typeLabel}`,
          description: `Acerto com confiança ${conf}/5. Indica intuição acurada necessitando de validação explícita.`,
          category: 'FRAGILE_STRENGTH',
          source: 'observed',
          cognitivePattern: res.cognitivePatterns?.[0],
        });
      }
    } else {
      if (conf >= 4) {
        highConfErrorsCount++;
        observedBottlenecks.push({
          id: `bot_high_conf_${res.activityId}`,
          title: `Divergência entre Confiança e Resultado em ${typeLabel}`,
          description: `Resposta incorreta com indicação de alta confiança (${conf}/5)${distractorInfo}. Pode indicar ponto cego no raciocínio.`,
          category: 'OBSERVED_BOTTLENECK',
          source: 'observed',
          cognitivePattern: res.cognitivePatterns?.[0],
        });
      } else {
        observedBottlenecks.push({
          id: `bot_low_conf_${res.activityId}`,
          title: `Dificuldade Observada em ${typeLabel}`,
          description: `Confiança baixa (${conf}/5) compatível com o erro nesta atividade${distractorInfo}.`,
          category: 'OBSERVED_BOTTLENECK',
          source: 'observed',
          cognitivePattern: res.cognitivePatterns?.[0],
        });
      }
    }
  });

  // --- 4. BEHAVIORAL PATTERN CHECKS (STRICTLY USING OPTION IDs) ---
  const readsSolutionsOnly = errorHandling.includes('READ_SOLUTION_IMMEDIATELY') || 
                             errorHandling.includes('CHECK_ANSWER_AND_MOVE_ON');

  const investigatesErrorCause = errorHandling.includes('INVESTIGATE_ERROR_POINT') ||
                                  errorHandling.includes('RETRY_WITHOUT_SOLUTION');

  if (readsSolutionsOnly && !investigatesErrorCause) {
    perceivedDifficultyInsights.push({
      id: 'bot_error_habits',
      title: 'Indício de Correção Passiva',
      description: 'Consulta frequente da resolução sem antes isolar o ponto exato onde o raciocínio desviou.',
      category: 'PERCEIVED_DIFFICULTY',
      source: 'perceived',
    });
  }

  if (successStreak === 'KEEP_PRACTICING_SAME_LEVEL') {
    perceivedDifficultyInsights.push({
      id: 'bot_overstudying',
      title: 'Possível permanência excessiva no mesmo nível',
      description: 'Relato de continuar praticando no mesmo nível após acertar uma sequência de questões.',
      category: 'PERCEIVED_DIFFICULTY',
      source: 'perceived',
    });
  }

  if (biggestTimeDrain === 'BEAUTIFUL_SUMMARIES') {
    perceivedDifficultyInsights.push({
      id: 'bot_time_drain_summaries',
      title: 'Atenção e tempo dedicados à formatação de resumos',
      description: 'Você percebe que gastar tempo polindo resumos pode competir com a resolução prática de questões.',
      category: 'PERCEIVED_DIFFICULTY',
      source: 'perceived',
    });
  }

  if (reasoningAwareness === 'SOMETIMES_ELIMINATION' || reasoningAwareness === 'OFTEN_UNSURE') {
    fragileStrengths.push({
      id: 'frag_reasoning_guess',
      title: 'Insegurança na Validação de Acertos',
      description: 'Acertos frequentes por eliminação ou dúvida demandam consolidação de justificativas conceituais.',
      category: 'FRAGILE_STRENGTH',
      source: 'perceived',
    });
  }

  // --- 5. GENERATE DYNAMIC UNKNOWNS ---
  const unknowns = generateUnknowns(partial);

  // --- 6. GENERATE HYPOTHESIS & CONFIDENCE USING CANDIDATE-SPECIFIC EVIDENCE SOURCES ---
  const hasHighConfError = highConfErrorsCount > 0;
  const hasPassiveCorrection = readsSolutionsOnly && !investigatesErrorCause;
  const hasOverstudying = successStreak === 'KEEP_PRACTICING_SAME_LEVEL';
  const hasLowConfCorrects = lowConfCorrectsCount >= 2;

  interface HypothesisCandidate {
    type: DiagnosticHypothesisType;
    evidenceIds: string[];
    evidenceSources: Set<string>;
    factObserved: string;
    hypothesisText: string;
    whyReasons: string[];
    howToVerify: string;
    status: HypothesisStatus;
  }

  const candidates: HypothesisCandidate[] = [];

  // Candidate A: PASSIVE_CORRECTION
  if (hasPassiveCorrection) {
    const evSources = new Set<string>(['SELF_REPORT']);
    const evIds = ['passive_correction_self_report'];
    if (hasHighConfError) {
      evSources.add('MICRO_ASSESSMENT');
      evIds.push('high_conf_error_micro');
    }
    candidates.push({
      type: 'PASSIVE_CORRECTION',
      evidenceIds: evIds,
      evidenceSources: evSources,
      factObserved: hasHighConfError 
        ? 'Divergência entre confiança e acerto no microdiagnóstico somada ao relato de consulta rápida de gabaritos.'
        : 'Relato de consultar a resolução imediatamente após errar.',
      hypothesisText: hasHighConfError
        ? 'Um possível risco de ilusão de competência provocado pela transição rápida para a resolução antes de tentar a autocorreção.'
        : 'Um possível gargalo inicial está na transição passiva para o gabarito sem tentativa de autocorreção.',
      whyReasons: hasHighConfError
        ? ['Registro de erro em questão assinalada com alta confiança', 'Perfil relatado de olhar a solução sem isolar a causa do erro']
        : ['Transição imediata para a solução impede o cérebro de fixar o aprendizado do erro'],
      howToVerify: 'Testar a pausa de 30 segundos de busca do erro antes de olhar a resolução nas próximas tentativas.',
      status: 'TESTING'
    });
  }

  // Candidate B: CONFIDENCE_RESULT_DIVERGENCE
  if (hasHighConfError) {
    const evSources = new Set<string>(['MICRO_ASSESSMENT']);
    const evIds = ['high_conf_error_micro'];
    candidates.push({
      type: 'CONFIDENCE_RESULT_DIVERGENCE',
      evidenceIds: evIds,
      evidenceSources: evSources,
      factObserved: 'Ocorreu divergência pontual entre confiança assinalada e resultado na microatividade.',
      hypothesisText: 'Pode existir uma concepção equivocada pontual ou leitura apressada do enunciado.',
      whyReasons: ['Erro com alta confiança assinalada em item objetivo'],
      howToVerify: 'Observar se a taxa de acerto em questões com alta confiança se mantém em novas tentativas.',
      status: 'TESTING'
    });
  }

  // Candidate C: OVERPRACTICE_SAME_LEVEL
  if (hasOverstudying) {
    const evSources = new Set<string>(['SELF_REPORT']);
    const evIds = ['overstudying_self_report'];
    candidates.push({
      type: 'OVERPRACTICE_SAME_LEVEL',
      evidenceIds: evIds,
      evidenceSources: evSources,
      factObserved: 'Relato de continuar praticando no mesmo nível após acertar uma sequência de questões.',
      hypothesisText: 'Possível permanência excessiva no mesmo nível praticando conteúdos já dominados.',
      whyReasons: ['Excesso de treino no mesmo nível reduz tempo para tópicos frágeis'],
      howToVerify: 'Avançar na dificuldade após uma sequência consistente de acertos.',
      status: 'TESTING'
    });
  }

  // Candidate D: LOW_CONFIDENCE_CORRECT
  if (hasLowConfCorrects) {
    const evSources = new Set<string>(['MICRO_ASSESSMENT']);
    const evIds = ['low_conf_corrects_micro'];
    candidates.push({
      type: 'LOW_CONFIDENCE_CORRECT',
      evidenceIds: evIds,
      evidenceSources: evSources,
      factObserved: 'Múltiplos acertos registrados com baixa confiança metacognitiva.',
      hypothesisText: 'Presença de intuição acurada porém acompanhada de dúvida na validação do próprio raciocínio.',
      whyReasons: ['Acertos nas microatividades assinalados com insegurança'],
      howToVerify: 'Anotar em uma frase o motivo da resposta antes de conferir o gabarito.',
      status: 'TESTING'
    });
  }

  let chosenCandidate: HypothesisCandidate | undefined;
  const passiveBoth = candidates.find(c => c.type === 'PASSIVE_CORRECTION' && c.evidenceSources.size >= 2);
  if (passiveBoth) {
    chosenCandidate = passiveBoth;
  } else {
    chosenCandidate = candidates[0];
  }

  let hypothesisText = '';
  let factObserved = '';
  let whyReasons: string[] = [];
  let howToVerify = '';
  let status: HypothesisStatus = 'INSUFFICIENT_DATA';
  let hypothesisType: DiagnosticHypothesisType = 'INSUFFICIENT_DATA';
  let confidence: 'BAIXA' | 'MODERADA' | 'ALTA' = 'BAIXA';

  if (!chosenCandidate) {
    hypothesisType = 'INSUFFICIENT_DATA';
    status = 'INSUFFICIENT_DATA';
    factObserved = 'Dados iniciais neutros e sem convergência de gargalo único.';
    hypothesisText = 'AINDA NÃO TEMOS DADOS SUFICIENTES PARA DEFINIR UM GARGALO PRINCIPAL.';
    whyReasons = ['Ainda sem evidências suficientes no questionário e nas microatividades'];
    howToVerify = 'Registrar o motivo dos erros e a confiança nas primeiras sessões de prática.';
    confidence = 'BAIXA';
  } else {
    hypothesisType = chosenCandidate.type;
    status = chosenCandidate.status;
    factObserved = chosenCandidate.factObserved;
    hypothesisText = chosenCandidate.hypothesisText;
    whyReasons = chosenCandidate.whyReasons;
    howToVerify = chosenCandidate.howToVerify;
    confidence = calculateHypothesisConfidence(chosenCandidate.evidenceIds.length, chosenCandidate.evidenceSources.size);
  }

  const initialHypothesis: DiagnosticHypothesis = {
    id: `hyp_${Date.now()}`,
    type: hypothesisType,
    text: hypothesisText,
    confidence,
    factObserved,
    hypothesisText,
    howToVerify,
    whyReasons,
    status,
  };

  // --- 7. EXPERIMENT DERIVED DYNAMICALLY FROM HYPOTHESIS.TYPE ---
  let coreChanges: string[] = [];
  let rulesToFollow: string[] = [];
  let metricsToWatch = 'Taxa de acertos e alinhamento da confiança metacognitiva.';

  switch (hypothesisType) {
    case 'PASSIVE_CORRECTION':
      coreChanges = [
        'Como teste inicial, tentar encontrar o ponto cego por 30 segundos antes de abrir a resolução ao errar.'
      ];
      rulesToFollow = [
        'Nas próximas tentativas, registrar a confiança honesta (1 a 5) antes de conferir o gabarito.'
      ];
      metricsToWatch = 'Taxa de acertos em re-tentativas autônomas.';
      break;

    case 'CONFIDENCE_RESULT_DIVERGENCE':
      coreChanges = [
        'Como teste inicial, reler o comando principal da questão antes de assinalar a opção final.'
      ];
      rulesToFollow = [
        'Anotar a confiança sincera antes de conferir a resposta.'
      ];
      metricsToWatch = 'Precisão em questões marcadas com alta confiança.';
      break;

    case 'OVERPRACTICE_SAME_LEVEL':
      coreChanges = [
        'Como teste inicial, avançar no nível de dificuldade após uma sequência consistente de acertos.'
      ];
      rulesToFollow = [
        'Evitar praticar excessivamente questões do mesmo nível já dominado.'
      ];
      metricsToWatch = 'Tempo economizado para focar em tópicos prioritários.';
      break;

    case 'LOW_CONFIDENCE_CORRECT':
      coreChanges = [
        'Como teste inicial, registrar brevemente a justificativa antes de confirmar a alternativa.'
      ];
      rulesToFollow = [
        'Validar se a intuição inicial estava fundamentada no conceito correto.'
      ];
      metricsToWatch = 'Evolução do nível de confiança em acertos subsequentes.';
      break;

    case 'INSUFFICIENT_DATA':
    default:
      coreChanges = [
        'Manter a rotina registrando o nível de facilidade/dificuldade percebido nas questões.'
      ];
      rulesToFollow = [
        'Anotar a confiança sincera antes do gabarito nas próximas tentativas.'
      ];
      metricsToWatch = 'Padrão natural de acertos e erros nas próximas sessões.';
      break;
  }

  const firstExperiment: SevenDayExperiment = {
    id: `exp_7d_${Date.now()}`,
    hypothesis: hypothesisText,
    coreChanges,
    rulesToFollow,
    metricsToWatch,
    durationDays: 7,
  };

  const combinedStrengths = [...perceivedStrengthInsights, ...observedPositiveSignals];
  const combinedBottlenecks = [...perceivedDifficultyInsights, ...observedBottlenecks];

  return {
    id: partial.id || `diag_${Date.now()}`,
    userId,
    createdAt: partial.createdAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    currentStep: 9,
    selfReportedState: selfState,
    errorHandlingProfile: errorHandling,
    errorRepeatReaction: partial.errorRepeatReaction || '',
    reasoningAwareness,
    successHandlingProfile: partial.successHandlingProfile || '',
    successStreakBehavior: successStreak,
    perceivedDifficulties: difficulties,
    perceivedStrengths: percStrengths,
    currentStudyMethods: studyMethods,
    biggestTimeDrain,
    efficiencyPerception: partial.efficiencyPerception ?? null,
    planCompletionFrequency: partial.planCompletionFrequency || '',
    unfinishedPlanBehavior: partial.unfinishedPlanBehavior || '',
    microAssessmentResults: microResults,
    
    // Explicit source arrays
    perceivedStrengthInsights,
    perceivedDifficultyInsights,
    observedPositiveSignals,
    observedBottlenecks,

    // Aliases for backwards compatibility
    strengths: combinedStrengths,
    fragileStrengths,
    bottlenecks: combinedBottlenecks,
    unknowns,
    initialHypothesis,
    firstExperiment,
  };
}

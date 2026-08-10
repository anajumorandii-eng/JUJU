import { 
  calculateInitialDiagnostic, 
  generateUnknowns, 
  calculateTwoAttemptOutcome,
  getPerceivedStrengths,
  getPerceivedDifficulties,
  getObservedPositiveSignals,
  getObservedBottlenecks
} from './diagnosticEngine';
import { ALL_MICRO_ACTIVITIES, selectMicroActivities } from '../data/microActivities';
import { toggleLimitedExclusiveSelection, SELF_REPORTED_STATE_OPTIONS } from '../data/diagnosticOptions';
import { DiagnosticDraftRepository } from './diagnosticDraftRepository';
import { InitialLearningDiagnostic, MicroAssessmentResult, DiagnosticDraft } from '../types';

function runDiagnosticTests() {
  console.log('==================================================');
  console.log('   EXECUTANDO BATERIA DE TESTES — HOTFIX 1.3      ');
  console.log('==================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       Detalhe: ${detail}`);
      failedCount++;
    }
  }

  // TEST 1: Novo diagnóstico começa sem respostas preenchidas
  const emptyDiagInput: Partial<InitialLearningDiagnostic> = {
    userId: 'test_user_1',
    selfReportedState: [],
    errorHandlingProfile: [],
    perceivedDifficulties: [],
    perceivedStrengths: [],
    microAssessmentResults: []
  };
  const diag1 = calculateInitialDiagnostic(emptyDiagInput);
  assert(
    diag1.selfReportedState.length === 0 &&
    diag1.errorHandlingProfile.length === 0 &&
    diag1.perceivedDifficulties.length === 0 &&
    diag1.perceivedStrengths.length === 0,
    'TEST 1: Novo diagnóstico começa sem respostas preenchidas'
  );

  // TEST 2: Ausência de userId lança erro controlado
  let threwForMissingUserId = false;
  try {
    calculateInitialDiagnostic({ selfReportedState: [] });
  } catch (e) {
    threwForMissingUserId = true;
  }
  assert(
    threwForMissingUserId,
    'TEST 2: calculateInitialDiagnostic exige userId válido e não aceita valor omitido'
  );

  // TEST 3: toggleLimitedExclusiveSelection desmarca opção exclusiva ao selecionar item normal
  const exclusiveOptionSelected = ['UNSURE_STATE'];
  const afterNormalSelect = toggleLimitedExclusiveSelection(exclusiveOptionSelected, 'UNDERSTAND_THEORY_FAIL_QUESTIONS', SELF_REPORTED_STATE_OPTIONS, 3);
  assert(
    !afterNormalSelect.includes('UNSURE_STATE') && afterNormalSelect.includes('UNDERSTAND_THEORY_FAIL_QUESTIONS'),
    'TEST 3: Opção exclusiva "não sei identificar" é desmarcada ao escolher outra opção'
  );

  // TEST 4: Etapa de seleção aceita no máximo 3 escolhas
  let fourChoices = ['UNDERSTAND_THEORY_FAIL_QUESTIONS', 'FORGET_PREVIOUS_TOPICS', 'DONT_KNOW_HOW_TO_START'];
  fourChoices = toggleLimitedExclusiveSelection(fourChoices, 'SLOW_QUESTION_SOLVING', SELF_REPORTED_STATE_OPTIONS, 3);
  assert(
    fourChoices.length === 3 && !fourChoices.includes('SLOW_QUESTION_SOLVING'),
    'TEST 4: Seleção múltipla limita escolhas ao máximo configurado (3)'
  );

  // TEST 5: Acerto + confiança alta vira "Indício Positivo Observado", não "Domínio Consolidado"
  const singleCorrectHighConf: MicroAssessmentResult = {
    id: 'res_1',
    activityId: 'act_1_geometry',
    activityType: 'geometry',
    correct: true,
    confidenceBefore: 5,
    responseTimeSeconds: 15,
    hintCount: 0,
    changedAnswer: false,
    cognitivePatterns: ['proporcionalidade_geometrica']
  };
  const diag5 = calculateInitialDiagnostic({ userId: 'u5', microAssessmentResults: [singleCorrectHighConf] });
  const hasConsolidatedText = diag5.strengths.some(s => s.title.includes('Consolidado') || s.title.includes('Domínio Consolidado'));
  assert(
    !hasConsolidatedText && diag5.strengths.some(s => s.title.includes('Indício Positivo Observado') && s.category === 'OBSERVED_POSITIVE_SIGNAL'),
    'TEST 5: Acerto + confiança alta em 1 atividade vira "Indício Positivo Observado"'
  );

  // TEST 6: Acerto + confiança baixa gera indício de força frágil
  const singleCorrectLowConf: MicroAssessmentResult = {
    id: 'res_2',
    activityId: 'act_1_geometry',
    activityType: 'geometry',
    correct: true,
    confidenceBefore: 2,
    responseTimeSeconds: 20,
    hintCount: 0,
    changedAnswer: false,
    cognitivePatterns: ['proporcionalidade_geometrica']
  };
  const diag6 = calculateInitialDiagnostic({ userId: 'u6', microAssessmentResults: [singleCorrectLowConf] });
  assert(
    diag6.fragileStrengths.length > 0 && diag6.fragileStrengths[0].title.includes('Acerto Inseguro'),
    'TEST 6: Acerto + confiança baixa gera indício de força frágil'
  );

  // TEST 7: Erro com alta confiança gera "Divergência entre Confiança e Resultado"
  const singleErrorHighConf: MicroAssessmentResult = {
    id: 'res_3',
    activityId: 'act_1_geometry',
    activityType: 'geometry',
    correct: false,
    confidenceBefore: 5,
    responseTimeSeconds: 18,
    hintCount: 0,
    changedAnswer: false,
    cognitivePatterns: ['proporcionalidade_geometrica']
  };
  const diag7 = calculateInitialDiagnostic({ userId: 'u7', microAssessmentResults: [singleErrorHighConf] });
  assert(
    diag7.bottlenecks.some(b => b.title.includes('Divergência entre Confiança e Resultado')),
    'TEST 7: Erro + confiança alta gera "Divergência entre Confiança e Resultado"'
  );

  // TEST 8: Uma única fonte/evidência isolada produz confiança BAIXA
  assert(
    diag7.initialHypothesis?.confidence === 'BAIXA',
    'TEST 8: Uma única evidência isolada produz confiança BAIXA'
  );

  // TEST 8B: Duas evidências de DUAS FONTES DIFERENTES produzem confiança MODERADA (HOTFIX 1.3 Requirement #1 & #2)
  const diag8b = calculateInitialDiagnostic({
    userId: 'u8b',
    errorHandlingProfile: ['READ_SOLUTION_IMMEDIATELY'], // Source 1: SELF_REPORT
    microAssessmentResults: [singleErrorHighConf]         // Source 2: MICRO_ASSESSMENT
  });
  assert(
    diag8b.initialHypothesis?.confidence === 'MODERADA',
    'TEST 8B: Duas evidências de fontes distintas (MICRO_ASSESSMENT + SELF_REPORT) resultam em confiança MODERADA'
  );

  // TEST 8C: Duas evidências da MESMA FONTE produzem confiança BAIXA
  const diag8c = calculateInitialDiagnostic({
    userId: 'u8c',
    microAssessmentResults: [
      singleErrorHighConf,
      { ...singleErrorHighConf, id: 'res_4', activityId: 'act_2_logic' }
    ] // 2 evidences, but both from MICRO_ASSESSMENT (1 source)
  });
  assert(
    diag8c.initialHypothesis?.confidence === 'BAIXA',
    'TEST 8C: Múltiplas evidências da mesma fonte isolada resultam em confiança BAIXA'
  );

  // TEST 9: Ausência de atividade temporizada gera UNKNOWN de Pressão de Tempo
  const unknownList = generateUnknowns({ microAssessmentResults: [singleCorrectHighConf] });
  const timeUnknown = unknownList.find(u => u.id === 'unk_time_pressure');
  assert(
    timeUnknown !== undefined && timeUnknown.category === 'UNKNOWN',
    'TEST 9: Ausência de teste temporizado gera item do tipo UNKNOWN para pressão de tempo'
  );

  // TEST 10: Structural separation of Perceived vs Observed
  const diag10 = calculateInitialDiagnostic({
    userId: 'u10',
    perceivedStrengths: ['QUICK_THEORY_GRASP'],
    perceivedDifficulties: ['LONG_CALCULATIONS'],
    microAssessmentResults: [singleCorrectHighConf, singleErrorHighConf]
  });
  const percStr = getPerceivedStrengths(diag10);
  const percDiff = getPerceivedDifficulties(diag10);
  const obsPos = getObservedPositiveSignals(diag10);
  const obsBot = getObservedBottlenecks(diag10);
  assert(
    percStr.length > 0 && percDiff.length > 0 && obsPos.length > 0 && obsBot.length > 0,
    'TEST 10: Seletores estruturais separam corretamente percepção e observação'
  );

  // TEST 11: DiagnosticHypothesis possui tipo explícito (DiagnosticHypothesisType)
  assert(
    diag8b.initialHypothesis?.type === 'PASSIVE_CORRECTION',
    'TEST 11: Hipótese possui tipo explícito (PASSIVE_CORRECTION)'
  );

  // TEST 12: Softened language check for overstudying
  const diag12 = calculateInitialDiagnostic({
    userId: 'u12',
    successStreakBehavior: 'KEEP_PRACTICING_SAME_LEVEL'
  });
  assert(
    diag12.bottlenecks.some(b => b.title.includes('Possível permanência excessiva')),
    'TEST 12: Linguagem suavizada em perdas de eficiência ("Possível permanência excessiva no mesmo nível")'
  );

  // TEST 13: Experimento baseado no tipo de hipótese via switch
  assert(
    diag12.initialHypothesis?.type === 'OVERPRACTICE_SAME_LEVEL' &&
    diag12.firstExperiment?.coreChanges[0].includes('avançar no nível de dificuldade'),
    'TEST 13: Experimento é derivado estritamente do tipo da hipótese via switch'
  );

  // TEST 14: calculateTwoAttemptOutcome - função pura de duas tentativas
  const outcome1 = calculateTwoAttemptOutcome({
    firstOptionId: 'a',
    firstCorrect: false,
    firstConfidence: 2,
    secondOptionId: 'c',
    secondCorrect: true,
    secondConfidence: 4
  });
  assert(
    outcome1.selfCorrection === true && outcome1.changedAnswer === true && outcome1.finalOptionId === 'c' && outcome1.finalCorrect === true,
    'TEST 14: calculateTwoAttemptOutcome calcula selfCorrection: true e changedAnswer: true para erro -> acerto'
  );

  const outcome2 = calculateTwoAttemptOutcome({
    firstOptionId: 'a',
    firstCorrect: false,
    firstConfidence: 2,
    secondOptionId: 'a',
    secondCorrect: false,
    secondConfidence: 3
  });
  assert(
    outcome2.selfCorrection === false && outcome2.changedAnswer === false && outcome2.finalOptionId === 'a',
    'TEST 14B: calculateTwoAttemptOutcome identifica mesma opção mantida (changedAnswer: false)'
  );

  // TEST 15: selectMicroActivities usa strictly IDs sem fallbacks de texto
  const selectedByStrictId = selectMicroActivities({
    perceivedDifficulties: ['GRAPH_IMAGE_ANALYSIS'],
    perceivedStrengths: [],
    selfReportedState: []
  });
  assert(
    selectedByStrictId.some(a => a.id === 'act_4_graph'),
    'TEST 15: selectMicroActivities seleciona via ID estrito GRAPH_IMAGE_ANALYSIS'
  );

  // TEST 16: Bug da Tela Final - rascunho com step 9 e finalDiagnostic preservado após fechar e reabrir
  const step9Draft: DiagnosticDraft = {
    id: 'draft_u16',
    userId: 'u16',
    currentStep: 9,
    formState: {
      selfReportedState: ['UNDERSTAND_THEORY_FAIL_QUESTIONS'],
      errorHandling: ['READ_SOLUTION_IMMEDIATELY'],
      errorRepeatReaction: '',
      reasoningAwareness: '',
      successHandling: '',
      successStreakBehavior: '',
      difficulties: ['LONG_CALCULATIONS'],
      strengths: [],
      studyMethods: { 'Videoaulas': null, 'Questões': null, 'Resumos': null, 'Revisão': null, 'Flashcards': null, 'Explicação em voz alta': null },
      biggestTimeDrain: '',
      efficiencyPerception: null,
      planCompletionFrequency: '',
      unfinishedPlanBehavior: ''
    },
    currentMicroIdx: 3,
    microResults: [singleCorrectHighConf],
    selectedActivityIds: ['act_1_geometry', 'act_2_logic', 'act_3_graph'],
    finalDiagnostic: diag5,
    timestamp: new Date().toISOString()
  };
  DiagnosticDraftRepository.saveDraft('u16', step9Draft);
  const reloadedStep9Draft = DiagnosticDraftRepository.getDraft('u16');
  assert(
    reloadedStep9Draft !== null && 
    reloadedStep9Draft.currentStep === 9 && 
    reloadedStep9Draft.finalDiagnostic !== undefined &&
    reloadedStep9Draft.finalDiagnostic.id === diag5.id,
    'TEST 16: Draft de etapa 9 preserva finalDiagnostic e permite reabertura na tela final'
  );

  // TEST 17: clearDraft remove o rascunho apenas no desfecho de salvamento final
  DiagnosticDraftRepository.clearDraft('u16');
  assert(
    DiagnosticDraftRepository.getDraft('u16') === null,
    'TEST 17: clearDraft remove o rascunho apenas no desfecho de salvamento final'
  );

  // TEST 18: Preflight Check — candidate hypothesis confidence uses ONLY candidate-specific sources
  // High confidence error (MICRO_ASSESSMENT) + Overstudying (SELF_REPORT)
  // CONFIDENCE_RESULT_DIVERGENCE relies ONLY on high confidence error (MICRO_ASSESSMENT, 1 source -> BAIXA)
  // OVERPRACTICE_SAME_LEVEL relies ONLY on overstudying (SELF_REPORT, 1 source -> BAIXA)
  const candidateIsoInput: Partial<InitialLearningDiagnostic> = {
    userId: 'u_candidate_iso',
    selfReportedState: [],
    errorHandlingProfile: ['INVESTIGATE_CAUSE_BEFORE_SOLUTION'], // NOT passive correction!
    successStreakBehavior: 'KEEP_PRACTICING_SAME_LEVEL', // overstudying (SELF_REPORT)
    perceivedDifficulties: [],
    perceivedStrengths: [],
    microAssessmentResults: [
      { id: 'm1', activityId: 'act_1_geometry', activityType: 'geometry', correct: false, confidenceBefore: 5, responseTimeSeconds: 10, hintCount: 0, changedAnswer: false, cognitivePatterns: [] }
    ]
  };
  const diagCandidateIso = calculateInitialDiagnostic(candidateIsoInput);
  assert(
    diagCandidateIso.initialHypothesis.confidence === 'BAIXA',
    'TEST 18: Confiança de hipótese é BAIXA quando evidências pertencem a candidatas não-convergentes (não contamina globalmente)'
  );

  // TEST 19: PASSIVE_CORRECTION com 2 fontes convergentes atinge MODERADA
  const passiveBothInput: Partial<InitialLearningDiagnostic> = {
    userId: 'u_passive_both',
    selfReportedState: [],
    errorHandlingProfile: ['READ_SOLUTION_IMMEDIATELY'], // SELF_REPORT
    perceivedDifficulties: [],
    perceivedStrengths: [],
    microAssessmentResults: [
      { id: 'm2', activityId: 'act_1_geometry', activityType: 'geometry', correct: false, confidenceBefore: 5, responseTimeSeconds: 10, hintCount: 0, changedAnswer: false, cognitivePatterns: [] }
    ]
  };
  const diagPassiveBoth = calculateInitialDiagnostic(passiveBothInput);
  assert(
    diagPassiveBoth.initialHypothesis.type === 'PASSIVE_CORRECTION' &&
    diagPassiveBoth.initialHypothesis.confidence === 'MODERADA',
    'TEST 19: PASSIVE_CORRECTION atinge MODERADA quando possui 2 fontes semanticamente convergentes (MICRO_ASSESSMENT + SELF_REPORT)'
  );

  console.log('\n==================================================');
  console.log(` RESULTADO FINAL DOS TESTES: ${passedCount} PASSARAM / ${failedCount} FALHARAM`);
  console.log('==================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runDiagnosticTests();

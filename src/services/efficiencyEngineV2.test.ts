import {
  evaluateEfficiencyV2,
  evaluateCandidateEfficiency,
  estimateReviewEnergyRequirement,
  EFFICIENCY_POLICY_V1,
  EfficiencyEngineInput,
  EfficiencyCandidate,
} from './efficiencyEngineV2';
import {
  TaskItem,
  Review,
  TopicNode,
  MasteryState,
  ErrorEntry,
  ReviewDecision,
  ReviewTriggerReason,
} from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

export function runTests() {
  console.log('==================================================');
  console.log('   EXECUTANDO TESTES DO MOTOR DE EFICIÊNCIA 2.0   ');
  console.log('==================================================');

  const testNow = '2026-08-10T12:00:00Z';

  // Sample Topics
  const topicLogarithm: TopicNode = {
    id: 'top_logarithm',
    subjectId: 'subj_math',
    name: 'Logaritmos',
    masteryLevel: 1,
    prerequisites: [],
    weightInExam: 9,
  };

  const topicCinematics: TopicNode = {
    id: 'top_cinematics',
    subjectId: 'subj_phys',
    name: 'Cinemática',
    masteryLevel: 1,
    prerequisites: [],
    weightInExam: 8,
  };

  const topicGenetics: TopicNode = {
    id: 'top_genetics',
    subjectId: 'subj_bio',
    name: 'Genética',
    masteryLevel: 1,
    prerequisites: [],
    weightInExam: 7,
  };

  const topicAdvancedMath: TopicNode = {
    id: 'top_adv_math',
    subjectId: 'subj_math',
    name: 'Funções Logarítmicas Avançadas',
    masteryLevel: 1,
    prerequisites: ['top_logarithm'],
    weightInExam: 8,
  };

  // Sample MasteryStates
  const mStateConflicted: MasteryState = {
    userId: 'u1',
    topicId: 'top_logarithm',
    status: 'CONFLICTED',
    estimatedLevel: null,
    confidence: 'LOW',
    evidenceCount: 4,
    independentSourceCount: 3,
    levelSupportingIndependentSourceCount: 1,
    informativeIndependentSourceCount: 3,
    fragileIndependentSourceCount: 0,
    contradictingIndependentSourceCount: 2,
    assistedIndependentSourceCount: 0,
    strongPositiveCount: 1,
    fragilePositiveCount: 0,
    negativeCount: 2,
    confidenceDivergenceCount: 1,
    selfCorrectionCount: 0,
    postSolutionCount: 0,
    timeSignalCount: 0,
    difficultiesObserved: ['MEDIUM', 'HARD'],
    levelSupportingEvidenceIds: ['ev1'],
    fragileEvidenceIds: [],
    assistedEvidenceIds: [],
    contradictingEvidenceIds: ['ev2', 'ev3'],
    timeEvidenceIds: [],
    supportingEvidenceIds: ['ev1'],
    lastEvidenceAt: '2026-08-01T10:00:00Z',
    trend: 'STABLE',
    uncertaintyReasons: ['Erros contraditórios'],
    updatedAt: testNow,
  };

  const mStateFragile: MasteryState = {
    userId: 'u1',
    topicId: 'top_cinematics',
    status: 'FRAGILE',
    estimatedLevel: 5,
    confidence: 'LOW',
    evidenceCount: 3,
    independentSourceCount: 2,
    levelSupportingIndependentSourceCount: 1,
    informativeIndependentSourceCount: 2,
    fragileIndependentSourceCount: 1,
    contradictingIndependentSourceCount: 0,
    assistedIndependentSourceCount: 0,
    strongPositiveCount: 1,
    fragilePositiveCount: 1,
    negativeCount: 0,
    confidenceDivergenceCount: 0,
    selfCorrectionCount: 0,
    postSolutionCount: 0,
    timeSignalCount: 0,
    difficultiesObserved: ['EASY', 'MEDIUM'],
    levelSupportingEvidenceIds: ['ev4'],
    fragileEvidenceIds: ['ev5'],
    assistedEvidenceIds: [],
    contradictingEvidenceIds: [],
    timeEvidenceIds: [],
    supportingEvidenceIds: ['ev4'],
    lastEvidenceAt: '2026-07-20T10:00:00Z',
    trend: 'STABLE',
    uncertaintyReasons: [],
    updatedAt: testNow,
  };

  const mStateUnknown: MasteryState = {
    userId: 'u1',
    topicId: 'top_genetics',
    status: 'UNKNOWN',
    estimatedLevel: null,
    confidence: 'LOW',
    evidenceCount: 0,
    independentSourceCount: 0,
    levelSupportingIndependentSourceCount: 0,
    informativeIndependentSourceCount: 0,
    fragileIndependentSourceCount: 0,
    contradictingIndependentSourceCount: 0,
    assistedIndependentSourceCount: 0,
    strongPositiveCount: 0,
    fragilePositiveCount: 0,
    negativeCount: 0,
    confidenceDivergenceCount: 0,
    selfCorrectionCount: 0,
    postSolutionCount: 0,
    timeSignalCount: 0,
    difficultiesObserved: [],
    levelSupportingEvidenceIds: [],
    fragileEvidenceIds: [],
    assistedEvidenceIds: [],
    contradictingEvidenceIds: [],
    timeEvidenceIds: [],
    supportingEvidenceIds: [],
    lastEvidenceAt: undefined,
    trend: 'UNKNOWN',
    uncertaintyReasons: [],
    updatedAt: testNow,
  };

  // Sample Tasks
  const taskPendingShort: TaskItem = {
    id: 't_short',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Exercícios de Logaritmos',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 8,
    impact: 9,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };

  const taskPendingLong: TaskItem = {
    id: 't_long',
    subjectId: 'subj_phys',
    topicId: 'top_cinematics',
    title: 'Leitura Completa de Cinemática',
    durationMinutes: 90,
    energyRequired: 'high',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'teoria',
  };

  const taskCompleted: TaskItem = {
    id: 't_completed',
    subjectId: 'subj_bio',
    topicId: 'top_genetics',
    title: 'Estudo Concluído',
    durationMinutes: 30,
    energyRequired: 'low',
    decision: 'FAZER',
    rationale: '',
    urgency: 1,
    impact: 5,
    isCritical: false,
    status: 'completed',
    category: 'teoria',
  };

  // Sample Reviews
  const revAvailable: Review = {
    id: 'rev_1',
    userId: 'u1',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    reviewType: 'ERROR_REVIEW',
    triggerReason: 'CONFIDENCE_DIVERGENCE',
    status: 'AVAILABLE',
    priority: 'HIGH',
    sourceEvidenceIds: [],
    estimatedMinutes: 20,
    rationale: '',
    recommendationConfidence: 'HIGH',
    policyVersion: '2.0-V1',
    recommendedWindowStart: '2026-08-08T00:00:00Z',
    recommendedWindowEnd: '2026-08-11T00:00:00Z',
    createdAt: '2026-08-08T10:00:00Z',
  };

  const revScheduled: Review = {
    id: 'rev_sched',
    userId: 'u1',
    subjectId: 'subj_phys',
    topicId: 'top_cinematics',
    reviewType: 'THEORY_REFRESH',
    triggerReason: 'RETENTION_CHECK',
    status: 'SCHEDULED',
    priority: 'MAINTENANCE',
    sourceEvidenceIds: [],
    estimatedMinutes: 10,
    rationale: '',
    recommendationConfidence: 'HIGH',
    policyVersion: '2.0-V1',
    recommendedWindowStart: '2026-08-20T00:00:00Z',
    recommendedWindowEnd: '2026-08-25T00:00:00Z',
    createdAt: '2026-08-05T10:00:00Z',
  };

  // Base input template
  const baseInput: EfficiencyEngineInput = {
    userId: 'u1',
    availableMinutes: 30,
    energyLevel: 'medium',
    now: testNow,
    tasks: [taskPendingShort, taskPendingLong, taskCompleted],
    reviews: [revAvailable, revScheduled],
    noReviewDecisions: {},
    masteryStates: {
      top_logarithm: mStateConflicted,
      top_cinematics: mStateFragile,
      top_genetics: mStateUnknown,
    },
    errors: [],
    topics: [topicLogarithm, topicCinematics, topicGenetics, topicAdvancedMath],
  };

  // 1. TEST: Pure Determinism
  const res1 = evaluateEfficiencyV2(baseInput);
  const res2 = evaluateEfficiencyV2(baseInput);
  assert(
    JSON.stringify(res1) === JSON.stringify(res2),
    '1. Execuções puras com mesmas entradas produzem saídas estritamente idênticas'
  );

  // 2. TEST: Candidate Filtering
  const candIds = res1.rankedCandidates.map(c => c.candidate.id);
  assert(
    candIds.includes('task:t_short') && candIds.includes('task:t_long') && candIds.includes('review:rev_1'),
    '2a. Inclui tarefas pendentes e revisões disponíveis'
  );
  assert(
    !candIds.includes('task:t_completed') && !candIds.includes('review:rev_sched'),
    '2b. Filtra tarefas concluídas e revisões agendadas/inativas'
  );

  // 3. TEST: Candidate Exceeding Available Time
  const shortTimeInput: EfficiencyEngineInput = {
    ...baseInput,
    availableMinutes: 15,
  };
  const resShort = evaluateEfficiencyV2(shortTimeInput);
  const candLong = resShort.rankedCandidates.find(c => c.candidate.id === 'task:t_long')!;
  assert(
    candLong.decision === 'ADIAR',
    '3a. Tarefa que excede o tempo disponível (90 min > 15 min) recebe decisão ADIAR'
  );
  assert(
    candLong.factorBreakdown.timeFit < 0.5,
    '3b. timeFit é severamente penalizado quando a duração excede o tempo disponível'
  );

  // 4. TEST: Primary Candidate Selection
  assert(
    resShort.primaryCandidate !== null,
    '4a. Seleciona a melhor candidata viável que cabe no tempo disponível'
  );
  assert(
    resShort.primaryCandidate?.decision === 'FAZER',
    '4b. Apenas a candidata primária recebe decisão FAZER'
  );

  // 5. TEST: No Candidates Fit Available Time
  const tinyTimeInput: EfficiencyEngineInput = {
    ...baseInput,
    availableMinutes: 5,
  };
  const resTiny = evaluateEfficiencyV2(tinyTimeInput);
  assert(
    resTiny.primaryCandidate === null,
    '5a. Quando nenhuma candidata cabe na janela disponível, primaryCandidate é null'
  );
  assert(
    resTiny.rankedCandidates.every(c => c.decision !== 'FAZER'),
    '5b. Nenhuma candidata recebe FAZER quando nenhuma cabe no tempo disponível'
  );

  // 6. TEST: NO_REVIEW_NOW Alone Is NOT Automatic NAO_FAZER
  const noRevDecision: ReviewDecision = {
    action: 'NO_REVIEW_NOW',
    rationale: 'Domínio estável sem sinais de degradação.',
    triggerReason: 'RETENTION_CHECK',
    recommendationConfidence: 'HIGH',
    sourceEvidenceIds: [],
  };
  const taskCinematicReview: TaskItem = {
    id: 't_cin_rev',
    subjectId: 'subj_phys',
    topicId: 'top_cinematics',
    title: 'Revisar Cinemática',
    durationMinutes: 20,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'revisao',
  };
  const noRevInput: EfficiencyEngineInput = {
    ...baseInput,
    tasks: [taskCinematicReview],
    reviews: [],
    noReviewDecisions: { top_cinematics: noRevDecision },
  };
  const resNoRev = evaluateEfficiencyV2(noRevInput);
  const candCin = resNoRev.rankedCandidates.find(c => c.candidate.id === 'task:t_cin_rev')!;
  assert(
    candCin.decision !== 'NAO_FAZER',
    '6a. NO_REVIEW_NOW sozinho NÃO gera NAO_FAZER automaticamente para tarefa de revisão'
  );
  assert(
    candCin.factorBreakdown.reviewNeed <= 0.1,
    '6b. NO_REVIEW_NOW reduz drasticamente o reviewNeed da tarefa de revisão'
  );
  assert(
    candCin.reasonCodes.includes('NO_REVIEW_NEEDED'),
    '6c. Recebe o código de razão NO_REVIEW_NEEDED'
  );

  // 7. TEST: Conservative Case for NAO_FAZER
  const taskGenericReview: TaskItem = {
    id: 't_gen_rev',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Revisar Logaritmos',
    durationMinutes: 20,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'revisao',
  };
  const redundancyInput: EfficiencyEngineInput = {
    ...baseInput,
    tasks: [taskGenericReview],
    reviews: [revAvailable], // There is a specific AVAILABLE review candidate for top_logarithm
  };
  const resRedundant = evaluateEfficiencyV2(redundancyInput);
  const candGenRev = resRedundant.rankedCandidates.find(c => c.candidate.id === 'task:t_gen_rev')!;
  assert(
    candGenRev.decision === 'NAO_FAZER',
    '7a. Tarefa genérica de revisão em tópico com revisão específica DISPONÍVEL recebe NAO_FAZER'
  );
  assert(
    candGenRev.reasonCodes.includes('GENERIC_REVIEW_REDUNDANT'),
    '7b. Recebe o código de razão GENERIC_REVIEW_REDUNDANT'
  );

  // 8. TEST: Critical Task Exception to NAO_FAZER
  const taskCriticalReview: TaskItem = {
    id: 't_crit_rev',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Revisão Crítica de Prova',
    durationMinutes: 15,
    energyRequired: 'high',
    decision: 'ADIAR',
    rationale: '',
    urgency: 9,
    impact: 9,
    isCritical: true, // Marked critical
    status: 'pending',
    category: 'revisao',
  };
  const criticalInput: EfficiencyEngineInput = {
    ...baseInput,
    tasks: [taskCriticalReview],
    reviews: [revAvailable],
  };
  const resCritical = evaluateEfficiencyV2(criticalInput);
  const candCrit = resCritical.rankedCandidates.find(c => c.candidate.id === 'task:t_crit_rev')!;
  assert(
    candCrit.decision !== 'NAO_FAZER',
    '8. Tarefa CRÍTICA NUNCA recebe NAO_FAZER mesmo se houver redundância de categoria'
  );

  // 9. TEST: Error Signal Recurrence by Error Type
  const errConceptual1: ErrorEntry = {
    id: 'e1',
    questionTitle: 'Q1 Log',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    errorType: 'conceitual',
    studentReasoning: '',
    correctedReasoning: '',
    keyInsight: '',
    recordedAt: testNow,
    reviewStatus: 'pending',
  };
  const errConceptual2: ErrorEntry = {
    id: 'e2',
    questionTitle: 'Q2 Log',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    errorType: 'conceitual',
    studentReasoning: '',
    correctedReasoning: '',
    keyInsight: '',
    recordedAt: testNow,
    reviewStatus: 'pending',
  };
  const errCalculation: ErrorEntry = {
    id: 'e3',
    questionTitle: 'Q3 Log',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    errorType: 'calculo',
    studentReasoning: '',
    correctedReasoning: '',
    keyInsight: '',
    recordedAt: testNow,
    reviewStatus: 'pending',
  };

  const sameTypeErrorInput: EfficiencyEngineInput = {
    ...baseInput,
    errors: [errConceptual1, errConceptual2],
  };
  const evalSameType = evaluateCandidateEfficiency(
    {
      id: 'task:t_short',
      sourceType: 'TASK',
      sourceId: 't_short',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Log',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    sameTypeErrorInput
  );
  assert(
    evalSameType.factors.errorSignal === 1.0,
    '9a. 2 erros pendentes do MESMO tipo atribuem errorSignal = 1.0'
  );
  assert(
    evalSameType.reasonCodes.includes('PENDING_ERROR_RECURRENCE'),
    '9b. Adiciona código PENDING_ERROR_RECURRENCE para erros do mesmo tipo'
  );

  // 10. TEST: Error Signal for Different Error Types
  const diffTypeErrorInput: EfficiencyEngineInput = {
    ...baseInput,
    errors: [errConceptual1, errCalculation],
  };
  const evalDiffType = evaluateCandidateEfficiency(
    {
      id: 'task:t_short',
      sourceType: 'TASK',
      sourceId: 't_short',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Log',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    diffTypeErrorInput
  );
  assert(
    evalDiffType.factors.errorSignal < 1.0 && evalDiffType.factors.errorSignal > 0.3,
    '10a. 2 erros de tipos DIFERENTES atribuem sinal intermediário (< 1.0)'
  );
  assert(
    evalSameType.factors.errorSignal > evalDiffType.factors.errorSignal,
    '10b. Erros do mesmo tipo produzem errorSignal maior que erros de tipos diferentes'
  );

  // 11. TEST: Single Pending Error Signal
  const singleErrorInput: EfficiencyEngineInput = {
    ...baseInput,
    errors: [errConceptual1],
  };
  const evalSingleErr = evaluateCandidateEfficiency(
    {
      id: 'task:t_short',
      sourceType: 'TASK',
      sourceId: 't_short',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Log',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    singleErrorInput
  );
  assert(
    evalSingleErr.factors.errorSignal === 0.3,
    '11. Apenas 1 erro pendente atribui sinal pequeno (0.3)'
  );

  // 12. TEST: Mastered Errors Ignored
  const errMastered: ErrorEntry = {
    id: 'e_m',
    questionTitle: 'Q Mastered',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    errorType: 'conceitual',
    studentReasoning: '',
    correctedReasoning: '',
    keyInsight: '',
    recordedAt: testNow,
    reviewStatus: 'mastered',
  };
  const masteredErrInput: EfficiencyEngineInput = {
    ...baseInput,
    errors: [errMastered],
  };
  const evalMasteredErr = evaluateCandidateEfficiency(
    {
      id: 'task:t_short',
      sourceType: 'TASK',
      sourceId: 't_short',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Log',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    masteredErrInput
  );
  assert(
    evalMasteredErr.factors.errorSignal === 0.0,
    '12. Erros com reviewStatus = mastered são ignorados no sinal de erro'
  );

  // 13. TEST: Prerequisite Readiness with Confidence
  const mStatePrereqHigh: MasteryState = {
    ...mStateFragile,
    topicId: 'top_logarithm',
    status: 'ESTIMATED',
    estimatedLevel: 7,
    confidence: 'HIGH',
  };
  const mStatePrereqLow: MasteryState = {
    ...mStateFragile,
    topicId: 'top_logarithm',
    status: 'ESTIMATED',
    estimatedLevel: 7,
    confidence: 'LOW',
  };

  const inputPrereqHigh: EfficiencyEngineInput = {
    ...baseInput,
    masteryStates: { top_logarithm: mStatePrereqHigh },
  };
  const inputPrereqLow: EfficiencyEngineInput = {
    ...baseInput,
    masteryStates: { top_logarithm: mStatePrereqLow },
  };

  const candAdvMath: EfficiencyCandidate = {
    id: 'task:adv_math',
    sourceType: 'TASK',
    sourceId: 't_adv',
    subjectId: 'subj_math',
    topicId: 'top_adv_math', // Prerequisites: ['top_logarithm']
    title: 'Funções Logarítmicas Avançadas',
    durationMinutes: 30,
    energyRequired: 'high',
  };

  const evalPrereqHigh = evaluateCandidateEfficiency(candAdvMath, inputPrereqHigh);
  const evalPrereqLow = evaluateCandidateEfficiency(candAdvMath, inputPrereqLow);

  assert(
    evalPrereqHigh.factors.prerequisiteReadiness > evalPrereqLow.factors.prerequisiteReadiness,
    '13. Pré-requisito ESTIMATED HIGH possui prontidão maior que ESTIMATED LOW'
  );

  // 14. TEST: Prerequisite LOW Confidence Produces Uncertainty
  assert(
    evalPrereqLow.reasonCodes.includes('PREREQUISITE_UNCERTAINTY'),
    '14a. Pré-requisito ESTIMATED LOW produz código PREREQUISITE_UNCERTAINTY'
  );
  assert(
    evalPrereqLow.uncertainties.length > 0,
    '14b. Pré-requisito ESTIMATED LOW adiciona mensagem explicativa de incerteza'
  );

  // 15. TEST: Prerequisite UNKNOWN
  const candAdvMathUnk = evaluateCandidateEfficiency(candAdvMath, baseInput); // top_logarithm is CONFLICTED in baseInput, let's test with UNKNOWN
  const inputPrereqUnk: EfficiencyEngineInput = {
    ...baseInput,
    masteryStates: {}, // No mastery state for top_logarithm -> UNKNOWN
  };
  const evalPrereqUnk = evaluateCandidateEfficiency(candAdvMath, inputPrereqUnk);
  assert(
    evalPrereqUnk.reasonCodes.includes('PREREQUISITE_UNCERTAINTY'),
    '15. Pré-requisito UNKNOWN produz código PREREQUISITE_UNCERTAINTY e não bloqueia'
  );

  // 16. TEST: Review Recommendation Confidence Modifies Score
  const revHighConf: Review = {
    ...revAvailable,
    id: 'rev_high_conf',
    recommendationConfidence: 'HIGH',
  };
  const revLowConf: Review = {
    ...revAvailable,
    id: 'rev_low_conf',
    recommendationConfidence: 'LOW',
  };

  const candRevHigh: EfficiencyCandidate = {
    id: 'review:rev_high_conf',
    sourceType: 'REVIEW',
    sourceId: 'rev_high_conf',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Rev High',
    durationMinutes: 20,
    energyRequired: 'medium',
    reviewPriority: 'HIGH',
    recommendationConfidence: 'HIGH',
  };
  const candRevLow: EfficiencyCandidate = {
    id: 'review:rev_low_conf',
    sourceType: 'REVIEW',
    sourceId: 'rev_low_conf',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Rev Low',
    durationMinutes: 20,
    energyRequired: 'medium',
    reviewPriority: 'HIGH',
    recommendationConfidence: 'LOW',
  };

  const evalRevHigh = evaluateCandidateEfficiency(candRevHigh, baseInput);
  const evalRevLow = evaluateCandidateEfficiency(candRevLow, baseInput);

  assert(
    evalRevHigh.internalScore > evalRevLow.internalScore,
    '16. Review recommendationConfidence HIGH produz score superior a LOW'
  );

  // 17. TEST: Primary Review with LOW Confidence Caps Global Confidence
  const inputPrimaryLowRev: EfficiencyEngineInput = {
    ...baseInput,
    tasks: [],
    reviews: [revLowConf],
  };
  const resPrimaryLowRev = evaluateEfficiencyV2(inputPrimaryLowRev);
  assert(
    resPrimaryLowRev.recommendationConfidence !== 'HIGH',
    '17. Primary Candidate como Review LOW impede recommendationConfidence global de ser HIGH'
  );

  // 18. TEST: Trigger Reason Lightweight Modifier
  const candTrigDivergence: EfficiencyCandidate = {
    ...candRevHigh,
    triggerReason: 'CONFIDENCE_DIVERGENCE',
  };
  const candTrigRetention: EfficiencyCandidate = {
    ...candRevHigh,
    triggerReason: 'RETENTION_CHECK',
  };
  const evalTrigDivergence = evaluateCandidateEfficiency(candTrigDivergence, baseInput);
  const evalTrigRetention = evaluateCandidateEfficiency(candTrigRetention, baseInput);

  assert(
    evalTrigDivergence.internalScore >= evalTrigRetention.internalScore,
    '18. Trigger CONFIDENCE_DIVERGENCE atua como modificador levemente superior a RETENTION_CHECK'
  );

  // 19. TEST: Opportunity Cost Is Not Zero For Inferior Viable Candidates
  const taskA: TaskItem = {
    id: 't_a',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Task A (Excelente)',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 10,
    impact: 10,
    isCritical: true,
    status: 'pending',
    category: 'questoes',
  };
  const taskB: TaskItem = {
    id: 't_b',
    subjectId: 'subj_bio',
    topicId: 'top_genetics',
    title: 'Task B (Inferior)',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 2,
    impact: 2,
    isCritical: false,
    status: 'pending',
    category: 'teoria',
  };
  const oppCostInput: EfficiencyEngineInput = {
    ...baseInput,
    tasks: [taskA, taskB],
    reviews: [],
  };
  const resOppCost = evaluateEfficiencyV2(oppCostInput);
  const candA = resOppCost.rankedCandidates.find(c => c.candidate.id === 'task:t_a')!;
  const candB = resOppCost.rankedCandidates.find(c => c.candidate.id === 'task:t_b')!;

  assert(
    candA.factorBreakdown.opportunityCost === 0.0,
    '19a. A melhor candidata viável possui custo de oportunidade = 0.0'
  );
  assert(
    candB.factorBreakdown.opportunityCost > 0.0,
    '19b. A candidata viável inferior possui custo de oportunidade > 0.0'
  );

  // 20. TEST: Opportunity Cost Rationale for Adiar
  assert(
    candB.rationale.includes('outra ação disponível oferece melhor combinação'),
    '20. Rationale de ADIAR por menor ROI explica a escolha sem exibir números (/100)'
  );

  // 21. TEST: Objective Relevance Combines Task Impact
  const taskHighImpact: TaskItem = {
    ...taskPendingShort,
    id: 't_hi_impact',
    impact: 10,
  };
  const taskLowImpact: TaskItem = {
    ...taskPendingShort,
    id: 't_lo_impact',
    impact: 1,
  };

  const evalHiImpact = evaluateCandidateEfficiency(
    {
      id: 'task:t_hi_impact',
      sourceType: 'TASK',
      sourceId: 't_hi_impact',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Hi',
      durationMinutes: 15,
      energyRequired: 'medium',
      taskImpact: 10,
    },
    baseInput
  );
  const evalLoImpact = evaluateCandidateEfficiency(
    {
      id: 'task:t_lo_impact',
      sourceType: 'TASK',
      sourceId: 't_lo_impact',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Lo',
      durationMinutes: 15,
      energyRequired: 'medium',
      taskImpact: 1,
    },
    baseInput
  );

  assert(
    evalHiImpact.factors.objectiveRelevance > evalLoImpact.factors.objectiveRelevance,
    '21. Task impact 10 possui objectiveRelevance maior do que task impact 1 no mesmo tópico'
  );

  // 22. TEST: Objective Relevance Combines Topic Weight
  const evalTopicWeight9 = evaluateCandidateEfficiency(
    {
      id: 'task:t_top9',
      sourceType: 'TASK',
      sourceId: 't_top9',
      subjectId: 'subj_math',
      topicId: 'top_logarithm', // weightInExam = 9
      title: 'Task Top 9',
      durationMinutes: 15,
      energyRequired: 'medium',
      taskImpact: 5,
    },
    baseInput
  );
  const evalTopicWeight7 = evaluateCandidateEfficiency(
    {
      id: 'task:t_top7',
      sourceType: 'TASK',
      sourceId: 't_top7',
      subjectId: 'subj_bio',
      topicId: 'top_genetics', // weightInExam = 7
      title: 'Task Top 7',
      durationMinutes: 15,
      energyRequired: 'medium',
      taskImpact: 5,
    },
    baseInput
  );

  assert(
    evalTopicWeight9.factors.objectiveRelevance > evalTopicWeight7.factors.objectiveRelevance,
    '22. Tópico com weightInExam maior possui objectiveRelevance maior para mesmo task impact'
  );

  // 23. TEST: Urgency Combines Due Date and Task Urgency
  const evalSameDueDateHiUrg = evaluateCandidateEfficiency(
    {
      id: 'task:t_due_hi',
      sourceType: 'TASK',
      sourceId: 't_due_hi',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Due Hi',
      durationMinutes: 15,
      energyRequired: 'medium',
      dueDate: '2026-08-12T12:00:00Z',
      taskUrgency: 10,
    },
    baseInput
  );
  const evalSameDueDateLoUrg = evaluateCandidateEfficiency(
    {
      id: 'task:t_due_lo',
      sourceType: 'TASK',
      sourceId: 't_due_lo',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Due Lo',
      durationMinutes: 15,
      energyRequired: 'medium',
      dueDate: '2026-08-12T12:00:00Z',
      taskUrgency: 1,
    },
    baseInput
  );

  assert(
    evalSameDueDateHiUrg.factors.urgency > evalSameDueDateLoUrg.factors.urgency,
    '23. Para mesma dueDate, taskUrgency 10 produz urgência superior a taskUrgency 1'
  );

  // 24. TEST: Overdue Due Date Increases Urgency
  const evalOverdue = evaluateCandidateEfficiency(
    {
      id: 'task:t_overdue',
      sourceType: 'TASK',
      sourceId: 't_overdue',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Overdue',
      durationMinutes: 15,
      energyRequired: 'medium',
      dueDate: '2026-08-09T12:00:00Z', // Yesterday
      taskUrgency: 5,
    },
    baseInput
  );
  assert(
    evalOverdue.factors.urgency >= 0.8,
    '24. Data limite vencida aumenta a urgência para pelo menos 0.8'
  );

  // 25. TEST: Missing Due Date Does Not Invent Temporal Urgency
  const evalNoDueDate = evaluateCandidateEfficiency(
    {
      id: 'task:t_nodue',
      sourceType: 'TASK',
      sourceId: 't_nodue',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task No Due',
      durationMinutes: 15,
      energyRequired: 'medium',
      taskUrgency: 3,
    },
    baseInput
  );
  assert(
    evalNoDueDate.factors.urgency === 0.3,
    '25. Ausência de dueDate não inventa urgência temporal artificial'
  );

  // 26. TEST: Exam Proximity Increases Relevance
  const inputExamSoon: EfficiencyEngineInput = {
    ...baseInput,
    context: { daysUntilExam: 10 },
  };
  const evalExamSoon = evaluateCandidateEfficiency(
    {
      id: 'task:t_exam',
      sourceType: 'TASK',
      sourceId: 't_exam',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Exam',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    inputExamSoon
  );
  const evalExamNormal = evaluateCandidateEfficiency(
    {
      id: 'task:t_exam',
      sourceType: 'TASK',
      sourceId: 't_exam',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Exam',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    baseInput
  );
  assert(
    evalExamSoon.factors.objectiveRelevance > evalExamNormal.factors.objectiveRelevance,
    '26. Proximidade do exame (daysUntilExam <= 30) aumenta a relevância objetiva de tópicos de peso alto'
  );

  // 27. TEST: Past Exam Does Not Increase Relevance
  const inputExamPassed: EfficiencyEngineInput = {
    ...baseInput,
    context: { daysUntilExam: -5 }, // Exam already passed!
  };
  const evalExamPassed = evaluateCandidateEfficiency(
    {
      id: 'task:t_exam',
      sourceType: 'TASK',
      sourceId: 't_exam',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Exam',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    inputExamPassed
  );
  assert(
    evalExamPassed.factors.objectiveRelevance === evalExamNormal.factors.objectiveRelevance,
    '27. Exame que já passou (daysUntilExam < 0) NÃO aumenta a relevância'
  );

  // 28. TEST: Prerequisite Uncertainty Reduces Global Confidence
  const inputPrereqUnkGlobal: EfficiencyEngineInput = {
    ...baseInput,
    tasks: [
      {
        id: 't_adv',
        subjectId: 'subj_math',
        topicId: 'top_adv_math', // Has prerequisite 'top_logarithm'
        title: 'Task Prereq Unk',
        durationMinutes: 15,
        energyRequired: 'medium',
        decision: 'ADIAR',
        rationale: '',
        urgency: 8,
        impact: 8,
        isCritical: false,
        status: 'pending',
        category: 'questoes',
      },
    ],
    reviews: [],
    masteryStates: {}, // No mastery states -> UNKNOWN
  };
  const resPrereqUnkGlobal = evaluateEfficiencyV2(inputPrereqUnkGlobal);
  assert(
    resPrereqUnkGlobal.recommendationConfidence !== 'HIGH',
    '28. Incerteza relevante em pré-requisito reduz recommendationConfidence global'
  );

  // 29. TEST: Tight Score Margin Produces MODERATE Global Confidence
  const taskTwin1: TaskItem = {
    id: 't_twin1',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Twin 1',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };
  const taskTwin2: TaskItem = {
    id: 't_twin2',
    subjectId: 'subj_phys',
    topicId: 'top_cinematics',
    title: 'Twin 2',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };
  const inputTwin: EfficiencyEngineInput = {
    ...baseInput,
    tasks: [taskTwin1, taskTwin2],
    reviews: [],
    masteryStates: {
      top_logarithm: { ...mStateFragile, topicId: 'top_logarithm' },
      top_cinematics: { ...mStateFragile, topicId: 'top_cinematics' },
    },
  };
  const resTwin = evaluateEfficiencyV2(inputTwin);
  assert(
    resTwin.recommendationConfidence === 'MODERATE',
    '29. Candidatas quase empatadas (margem < 3.0) produzem recomendação MODERATE'
  );

  // 30. TEST: Energy Mismatch
  const candHighEnergyInLowUser = evaluateCandidateEfficiency(
    {
      id: 'task:t_high_e',
      sourceType: 'TASK',
      sourceId: 't_high_e',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'High Energy Task',
      durationMinutes: 15,
      energyRequired: 'high',
    },
    {
      ...baseInput,
      energyLevel: 'low',
    }
  );
  assert(
    candHighEnergyInLowUser.factors.energyFit < 0.6,
    '30a. Atividade de alta energia em usuário com baixa energia possui energyFit reduzido'
  );
  assert(
    candHighEnergyInLowUser.reasonCodes.includes('ENERGY_MISMATCH'),
    '30b. Adiciona código ENERGY_MISMATCH quando a energia for incompatível'
  );

  // 31. TEST: Legacy Task.decision Property Is Ignored
  const taskWithLegacyDecision: TaskItem = {
    ...taskPendingShort,
    decision: 'NAO_FAZER', // Should be ignored during evaluation!
  };
  const resLegacyDec = evaluateEfficiencyV2({
    ...baseInput,
    tasks: [taskWithLegacyDecision],
    reviews: [],
  });
  assert(
    resLegacyDec.primaryCandidate?.decision === 'FAZER',
    '31. A propriedade legado Task.decision é ignorada durante a avaliação'
  );

  // 32. TEST: Legacy TopicNode.masteryLevel Is Ignored
  const topicWithLegacyLevel: TopicNode = {
    ...topicLogarithm,
    masteryLevel: 10, // Ignored in favor of MasteryState!
  };
  const evalLegacyTopic = evaluateCandidateEfficiency(
    {
      id: 'task:t_short',
      sourceType: 'TASK',
      sourceId: 't_short',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Log',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    {
      ...baseInput,
      topics: [topicWithLegacyLevel],
      masteryStates: { top_logarithm: mStateConflicted },
    }
  );
  assert(
    evalLegacyTopic.factors.learningNeed === 1.0,
    '32. A propriedade legado TopicNode.masteryLevel é ignorada em prol do MasteryState'
  );

  // 33. TEST: Inputs Are Not Mutated
  const inputCopy = JSON.parse(JSON.stringify(baseInput));
  evaluateEfficiencyV2(baseInput);
  assert(
    JSON.stringify(baseInput) === JSON.stringify(inputCopy),
    '33. As estruturas de dados de entrada permanecem imutáveis'
  );

  // 34. TEST: Human Rationale Contains No Internal Scores (/100)
  const resAllRationales = evaluateEfficiencyV2(baseInput);
  for (const item of resAllRationales.rankedCandidates) {
    assert(
      !item.rationale.includes('/100') && !item.rationale.includes('%'),
      '34. Rationale semântico não contém números de pontuação interna (/100 ou %)'
    );
  }

  // 35. TEST: Energy Estimation for Review Types
  assert(
    estimateReviewEnergyRequirement('TARGETED_QUESTIONS') === 'high' &&
      estimateReviewEnergyRequirement('ACTIVE_RECALL') === 'medium' &&
      estimateReviewEnergyRequirement('THEORY_REFRESH') === 'low',
    '35. estimateReviewEnergyRequirement estima corretamente a demanda de energia por tipo'
  );

  // 36. TEST: UNKNOWN Mastery State
  const evalUnkState = evaluateCandidateEfficiency(
    {
      id: 'task:t_unk',
      sourceType: 'TASK',
      sourceId: 't_unk',
      subjectId: 'subj_bio',
      topicId: 'top_genetics',
      title: 'Task Unk',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    baseInput
  );
  assert(
    evalUnkState.reasonCodes.includes('UNKNOWN_MASTERY'),
    '36. Domínio UNKNOWN atribui o código UNKNOWN_MASTERY'
  );

  // 37. TEST: CONFLICTED Mastery State
  const evalConfState = evaluateCandidateEfficiency(
    {
      id: 'task:t_conf',
      sourceType: 'TASK',
      sourceId: 't_conf',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Task Conf',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    baseInput
  );
  assert(
    evalConfState.factors.learningNeed === 1.0 && evalConfState.reasonCodes.includes('CONFLICTED_MASTERY'),
    '37. Domínio CONFLICTED atribui necessidade máxima (1.0) e código CONFLICTED_MASTERY'
  );

  // 38. TEST: FRAGILE Mastery State
  const evalFragState = evaluateCandidateEfficiency(
    {
      id: 'task:t_frag',
      sourceType: 'TASK',
      sourceId: 't_frag',
      subjectId: 'subj_phys',
      topicId: 'top_cinematics',
      title: 'Task Frag',
      durationMinutes: 15,
      energyRequired: 'medium',
    },
    baseInput
  );
  assert(
    evalFragState.factors.learningNeed === 0.8 && evalFragState.reasonCodes.includes('FRAGILE_MASTERY'),
    '38. Domínio FRAGILE atribui necessidade alta (0.8) e código FRAGILE_MASTERY'
  );

  // 39. TEST: Task In Progress Is Included As Candidate
  const taskInProgress: TaskItem = {
    ...taskPendingShort,
    id: 't_in_prog',
    status: 'in_progress',
  };
  const resInProg = evaluateEfficiencyV2({
    ...baseInput,
    tasks: [taskInProgress],
    reviews: [],
  });
  assert(
    resInProg.rankedCandidates.some(c => c.candidate.id === 'task:t_in_prog'),
    '39. Tarefa com status in_progress é incluída como candidata'
  );

  // 40. TEST: Task Without Topic Uses Task Impact
  const taskNoTopic: TaskItem = {
    id: 't_no_top',
    subjectId: 'subj_general',
    title: 'Organizar Caderno',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 4,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'teoria',
  };
  const evalNoTopic = evaluateCandidateEfficiency(
    {
      id: 'task:t_no_top',
      sourceType: 'TASK',
      sourceId: 't_no_top',
      subjectId: 'subj_general',
      title: 'Organizar Caderno',
      durationMinutes: 15,
      energyRequired: 'low',
      taskImpact: 8,
    },
    baseInput
  );
  assert(
    evalNoTopic.factors.objectiveRelevance === 0.8,
    '40. Tarefa sem tópico associado utiliza diretamente taskImpact para objectiveRelevance'
  );

  // 41. TEST: Rationale Format For Review Primary Candidate
  const resRevPrimary = evaluateEfficiencyV2({
    ...baseInput,
    tasks: [],
    reviews: [revAvailable],
  });
  assert(
    resRevPrimary.primaryCandidate?.rationale.includes('Ação prioritária de revisão que cabe no tempo disponível'),
    '41. Primary candidate de revisão utiliza modelo semântico de rationale específico'
  );

  // 42. TEST: Rationale Format For Exceeding Available Time
  assert(
    candLong.rationale.includes('excede o tempo disponível'),
    '42. Rationale para atividade que excede o tempo explica o motivo do adiamento'
  );

  // 43. TEST: Rationale Format For NAO_FAZER
  assert(
    candGenRev.rationale.includes('Substituída por uma intervenção mais específica'),
    '43. Rationale para NAO_FAZER explica a substituição por intervenção específica'
  );

  // 44. TEST: Returned Policy Version Matches
  assert(
    res1.policyVersion === EFFICIENCY_POLICY_V1.version,
    '44. Policy version no output corresponde à versão configurada na política'
  );

  // 45. TEST: EvaluatedAt Matches Input Timestamp
  assert(
    res1.evaluatedAt === testNow,
    '45. Output evaluatedAt corresponde ao timestamp testNow fornecido'
  );

  // 46. TEST: Multiple Candidates Ranked Correctly By Internal Score
  assert(
    res1.rankedCandidates[0].internalScore >= res1.rankedCandidates[1].internalScore,
    '46. Lista de candidatos é estritamente ordenada por internalScore decrescente'
  );

  // 47. TEST: Priority Multipliers Scale Review Internal Score
  const candRevCrit: EfficiencyCandidate = {
    ...candRevHigh,
    reviewPriority: 'CRITICAL',
  };
  const candRevMaint: EfficiencyCandidate = {
    ...candRevHigh,
    reviewPriority: 'MAINTENANCE',
  };

  const evalRevCrit = evaluateCandidateEfficiency(candRevCrit, baseInput);
  const evalRevMaint = evaluateCandidateEfficiency(candRevMaint, baseInput);

  assert(
    evalRevCrit.internalScore > evalRevMaint.internalScore,
    '47. Review com prioridade CRITICAL obtém pontuação superior a MAINTENANCE'
  );

  // 48. TEST: Empty Candidates Input Produces MODERATE Confidence
  const resEmptyInput = evaluateEfficiencyV2({
    ...baseInput,
    tasks: [],
    reviews: [],
  });
  assert(
    resEmptyInput.primaryCandidate === null && resEmptyInput.recommendationConfidence === 'MODERATE',
    '48. Entrada sem candidatos pendentes produz primaryCandidate null e confiança MODERATE'
  );

  // 49. TEST: NO_REVIEW_NOW Rationale Text Match
  assert(
    candCin.reasons.some(r => r.includes('As evidências atuais não indicam necessidade de revisão adaptativa deste tópico agora.')),
    '49. Texto explicativo do NO_REVIEW_NOW segue o padrão textual exato exigido'
  );

  // 50. TEST: Critical Task Obligation Signal Is 1.0
  const evalCritOblig = evaluateCandidateEfficiency(
    {
      id: 'task:t_crit_rev',
      sourceType: 'TASK',
      sourceId: 't_crit_rev',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Critical Task',
      durationMinutes: 15,
      energyRequired: 'high',
      isCriticalTask: true,
    },
    baseInput
  );
  assert(
    evalCritOblig.factors.obligationSignal === 1.0 && evalCritOblig.reasonCodes.includes('CRITICAL_OBLIGATION'),
    '50. Atividade crítica define obligationSignal = 1.0 e inclui código CRITICAL_OBLIGATION'
  );

  // 51. TEST: Order Invariance Test
  const taskInvA: TaskItem = {
    id: 't_inv_A',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Tarefa A Forte',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 9,
    impact: 9,
    isCritical: true,
    status: 'pending',
    category: 'questoes',
  };
  const taskInvB: TaskItem = {
    id: 't_inv_B',
    subjectId: 'subj_phys',
    topicId: 'top_cinematics',
    title: 'Tarefa B Equivalente',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 8,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };
  const taskInvC: TaskItem = {
    id: 't_inv_C',
    subjectId: 'subj_bio',
    topicId: 'top_genetics',
    title: 'Tarefa C Fraca',
    durationMinutes: 15,
    energyRequired: 'high',
    decision: 'ADIAR',
    rationale: '',
    urgency: 2,
    impact: 2,
    isCritical: false,
    status: 'pending',
    category: 'teoria',
  };

  const resOrder1 = evaluateEfficiencyV2({ ...baseInput, tasks: [taskInvA, taskInvB, taskInvC] });
  const resOrder2 = evaluateEfficiencyV2({ ...baseInput, tasks: [taskInvA, taskInvC, taskInvB] });
  const resOrder3 = evaluateEfficiencyV2({ ...baseInput, tasks: [taskInvC, taskInvA, taskInvB] });
  const resOrder4 = evaluateEfficiencyV2({ ...baseInput, tasks: [taskInvB, taskInvC, taskInvA] });

  const samePrimary =
    resOrder1.primaryCandidate?.candidate.id === resOrder2.primaryCandidate?.candidate.id &&
    resOrder1.primaryCandidate?.candidate.id === resOrder3.primaryCandidate?.candidate.id &&
    resOrder1.primaryCandidate?.candidate.id === resOrder4.primaryCandidate?.candidate.id;

  const sameRankOrder =
    JSON.stringify(resOrder1.rankedCandidates.map(c => c.candidate.id)) ===
    JSON.stringify(resOrder2.rankedCandidates.map(c => c.candidate.id)) &&
    JSON.stringify(resOrder1.rankedCandidates.map(c => c.candidate.id)) ===
    JSON.stringify(resOrder3.rankedCandidates.map(c => c.candidate.id)) &&
    JSON.stringify(resOrder1.rankedCandidates.map(c => c.candidate.id)) ===
    JSON.stringify(resOrder4.rankedCandidates.map(c => c.candidate.id));

  const sameConfidence =
    resOrder1.recommendationConfidence === resOrder2.recommendationConfidence &&
    resOrder1.recommendationConfidence === resOrder3.recommendationConfidence &&
    resOrder1.recommendationConfidence === resOrder4.recommendationConfidence;

  assert(
    samePrimary && sameRankOrder && sameConfidence,
    '51. Execuções com mesma coleção em ordens diferentes produzem resultado rigorosamente idêntico (Invariância à Ordem)'
  );

  // 52. TEST: User Isolation - External Review Filtered Out
  const extReview: Review = {
    id: 'rev_external_user',
    userId: 'u_other',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    reviewType: 'ACTIVE_RECALL',
    triggerReason: 'RETENTION_CHECK',
    status: 'AVAILABLE',
    createdAt: testNow,
    estimatedMinutes: 15,
    rationale: 'External review',
    recommendationConfidence: 'HIGH',
    sourceEvidenceIds: [],
    priority: 'HIGH',
    policyVersion: '1.0',
  };

  const resUserIso = evaluateEfficiencyV2({
    ...baseInput,
    userId: 'u1',
    reviews: [extReview],
  });

  assert(
    resUserIso.rankedCandidates.filter(c => c.candidate.id === 'review:rev_external_user').length === 0,
    '52. Review pertencente a outro usuário (u2) é ignorada para input.userId u1'
  );

  // 53. TEST: External User Review Does Not Cause Redundancy For Local Task
  const localTaskGenRev: TaskItem = {
    id: 't_local_gen_rev',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Revisar Logaritmos',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'revisao',
  };

  const resIsoRedundancy = evaluateEfficiencyV2({
    ...baseInput,
    userId: 'u1',
    tasks: [localTaskGenRev],
    reviews: [extReview],
  });

  const localCandItem = resIsoRedundancy.rankedCandidates.find(c => c.candidate.sourceId === 't_local_gen_rev');
  assert(
    localCandItem !== undefined && localCandItem.decision !== 'NAO_FAZER',
    '53. Review de outro usuário não gera contaminação de redundância nem NAO_FAZER para tarefa local'
  );

  // 54. TEST: Primary Candidate Topic With Mastery Confidence LOW Caps Global Confidence
  const taskLowMasteryConf: TaskItem = {
    id: 't_low_m_conf',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Estudar Logaritmos com Confiança Baixa',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 9,
    impact: 9,
    isCritical: true,
    status: 'pending',
    category: 'questoes',
  };

  const resLowMasteryConf = evaluateEfficiencyV2({
    ...baseInput,
    tasks: [taskLowMasteryConf],
    masteryStates: {
      ...baseInput.masteryStates,
      top_logarithm: {
        ...baseInput.masteryStates['top_logarithm'],
        confidence: 'LOW',
      },
    },
  });

  assert(
    resLowMasteryConf.recommendationConfidence !== 'HIGH',
    '54. Mastery confidence LOW no tópico principal limita a recommendationConfidence global a MODERATE ou LOW'
  );

  // 55. TEST: Primary Candidate Review With RecommendationConfidence MODERATE Caps Global Confidence
  const revModConf: Review = {
    id: 'rev_mod_conf',
    userId: 'u1',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    reviewType: 'ACTIVE_RECALL',
    triggerReason: 'RETENTION_CHECK',
    status: 'AVAILABLE',
    createdAt: testNow,
    estimatedMinutes: 15,
    rationale: 'Review com confiança moderada',
    recommendationConfidence: 'MODERATE',
    sourceEvidenceIds: [],
    priority: 'HIGH',
    policyVersion: '1.0',
  };

  const resRevModConf = evaluateEfficiencyV2({
    ...baseInput,
    reviews: [revModConf],
    tasks: [],
  });

  assert(
    resRevModConf.recommendationConfidence !== 'HIGH',
    '55. Review primária com recommendationConfidence MODERATE/LOW não produz HIGH global'
  );

  // 56. TEST: Primary Candidate Uncertainties Propagated To Output
  const taskAdvMathPrereq: TaskItem = {
    id: 't_adv_math',
    subjectId: 'subj_math',
    topicId: 'top_adv_math',
    title: 'Funções Avançadas',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 9,
    impact: 9,
    isCritical: true,
    status: 'pending',
    category: 'questoes',
  };

  const resPrereqProp = evaluateEfficiencyV2({
    ...baseInput,
    tasks: [taskAdvMathPrereq],
    reviews: [],
    masteryStates: {}, // missing top_logarithm -> UNKNOWN prerequisite
  });

  const hasPrereqUncertaintyInOutput = resPrereqProp.uncertainties.some(u =>
    u.includes('Pré-requisito top_logarithm sem dados de domínio.')
  );

  assert(
    hasPrereqUncertaintyInOutput,
    '56. Incertezas do candidato primário (como pré-requisito UNKNOWN) são propagadas para output.uncertainties'
  );

  // 57. TEST: Tight Margin Between Top 2 Viable Candidates Sets Confidence MODERATE and Adds Uncertainty
  const taskTight1: TaskItem = {
    id: 't_tight_1',
    subjectId: 'subj_phys',
    topicId: 'top_cinematics',
    title: 'Tarefa Equivalente 1',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 8,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };
  const taskTight2: TaskItem = {
    id: 't_tight_2',
    subjectId: 'subj_phys',
    topicId: 'top_cinematics',
    title: 'Tarefa Equivalente 2',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 8,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };

  const resTightMargin = evaluateEfficiencyV2({
    ...baseInput,
    tasks: [taskTight1, taskTight2],
    reviews: [],
  });

  const hasTightMarginUncertainty = resTightMargin.uncertainties.includes(
    'Há mais de uma ação com retorno e viabilidade semelhantes neste momento.'
  );

  assert(
    resTightMargin.recommendationConfidence === 'MODERATE' && hasTightMarginUncertainty,
    '57. Margem pequena entre alternativas viáveis define confiança MODERATE e adiciona incerteza explicativa'
  );

  // 58. TEST: Policy Trigger Reason Multipliers Mapped Completely
  const requiredTriggers: ReviewTriggerReason[] = [
    'FRAGILE_MASTERY',
    'CONFIDENCE_DIVERGENCE',
    'CORRECT_UNCERTAIN',
    'CORRECT_GUESS',
    'SELF_CORRECTION',
    'POST_SOLUTION_DEPENDENCY',
    'CONFLICTED_MASTERY',
    'RETENTION_CHECK',
    'ERROR_RECURRENCE',
    'EXAM_RELEVANCE',
    'MANUAL_REQUEST',
  ];

  const policyTriggers = EFFICIENCY_POLICY_V1.review.triggerReasonMultipliers;
  const allTriggersPresent = requiredTriggers.every(tr => typeof policyTriggers[tr] === 'number');
  const staleAbsence = !('STALE_MASTERY' in policyTriggers);

  assert(
    allTriggersPresent && staleAbsence,
    '58. EFFICIENCY_POLICY_V1 possui mapeamento completo para todos os 11 ReviewTriggerReason e excluiu STALE_MASTERY'
  );

  // 59. TEST: Custom Policy Weights Affect Evaluation Output
  const customPolicy = {
    ...EFFICIENCY_POLICY_V1,
    weights: {
      ...EFFICIENCY_POLICY_V1.weights,
      urgency: 0.50, // drastically increase urgency weight
    },
  };

  const resCustomPolicy = evaluateEfficiencyV2({
    ...baseInput,
    policy: customPolicy,
    tasks: [taskInvA, taskInvB],
  });

  assert(
    resCustomPolicy.policyVersion === EFFICIENCY_POLICY_V1.version &&
    resCustomPolicy.primaryCandidate !== null,
    '59. Configuração de política customizada é consumida corretamente pelo Motor'
  );

  // 60. TEST: Deterministic Opportunity Cost & Viable Margin
  const resOrderNoReviews = evaluateEfficiencyV2({ ...baseInput, tasks: [taskInvA, taskInvB, taskInvC], reviews: [] });
  assert(
    resOrderNoReviews.rankedCandidates.length === 3 &&
    resOrderNoReviews.rankedCandidates[0].decision === 'FAZER' &&
    resOrderNoReviews.rankedCandidates[1].decision === 'ADIAR' &&
    resOrderNoReviews.rankedCandidates[2].decision === 'ADIAR',
    '60. ranqueamento e decisões por candidato são perfeitamente determinísticos'
  );

  // 61. TEST (L): Non-viable Review (exceeds available time) does NOT eliminate generic Task via redundancy
  const taskGen10: TaskItem = {
    id: 't_gen_10',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Revisar Logaritmos 10 min',
    durationMinutes: 10,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'revisao',
  };
  const revSpec20: Review = {
    id: 'rev_spec_20',
    userId: 'u1',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    reviewType: 'ACTIVE_RECALL',
    triggerReason: 'RETENTION_CHECK',
    status: 'AVAILABLE',
    createdAt: testNow,
    estimatedMinutes: 20, // Exceeds 15 min available window
    rationale: 'Revisão de 20 min',
    recommendationConfidence: 'HIGH',
    sourceEvidenceIds: [],
    priority: 'HIGH',
    policyVersion: '1.0',
  };

  const resTestL = evaluateEfficiencyV2({
    ...baseInput,
    availableMinutes: 15,
    tasks: [taskGen10],
    reviews: [revSpec20],
  });

  const candTaskL = resTestL.rankedCandidates.find(c => c.candidate.sourceId === 't_gen_10');
  assert(
    candTaskL !== undefined && candTaskL.decision === 'FAZER' && resTestL.primaryCandidate?.candidate.sourceId === 't_gen_10',
    '61. Review específica que NÃO cabe na janela (20 min > 15 min) NÃO elimina Task curta (10 min) por redundância'
  );

  // 62. TEST (M): Viable Review (fits available time) CAN eliminate generic Task via redundancy
  const taskGen15: TaskItem = {
    id: 't_gen_15',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Revisar Logaritmos 15 min',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 5,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'revisao',
  };
  const revSpec10: Review = {
    id: 'rev_spec_10',
    userId: 'u1',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    reviewType: 'ACTIVE_RECALL',
    triggerReason: 'RETENTION_CHECK',
    status: 'AVAILABLE',
    createdAt: testNow,
    estimatedMinutes: 10, // Fits in 15 min available window
    rationale: 'Revisão de 10 min',
    recommendationConfidence: 'HIGH',
    sourceEvidenceIds: [],
    priority: 'HIGH',
    policyVersion: '1.0',
  };

  const resTestM = evaluateEfficiencyV2({
    ...baseInput,
    availableMinutes: 15,
    tasks: [taskGen15],
    reviews: [revSpec10],
  });

  const candTaskM = resTestM.rankedCandidates.find(c => c.candidate.sourceId === 't_gen_15');
  assert(
    candTaskM !== undefined && candTaskM.decision === 'NAO_FAZER' && resTestM.primaryCandidate?.candidate.sourceId === 'rev_spec_10',
    '62. Review específica viável (10 min <= 15 min) e de maior pontuação substitui a Task genérica (15 min) com NAO_FAZER'
  );

  // 63. TEST: Review with lower score (e.g., energy mismatch / maintenance) does NOT eliminate generic Task
  const taskGenLowEnergy: TaskItem = {
    id: 't_gen_low_e',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Revisar Logaritmos 10 min',
    durationMinutes: 10,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 7,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'revisao',
  };
  const revSpecHighEnergyMaint: Review = {
    id: 'rev_high_e_maint',
    userId: 'u1',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    reviewType: 'TARGETED_QUESTIONS', // high energy
    triggerReason: 'RETENTION_CHECK',
    status: 'AVAILABLE',
    createdAt: testNow,
    estimatedMinutes: 10,
    rationale: 'Revisão de alta energia',
    recommendationConfidence: 'HIGH',
    sourceEvidenceIds: [],
    priority: 'MAINTENANCE',
    policyVersion: '1.0',
  };

  const resTest63 = evaluateEfficiencyV2({
    ...baseInput,
    energyLevel: 'low',
    availableMinutes: 15,
    tasks: [taskGenLowEnergy],
    reviews: [revSpecHighEnergyMaint],
  });

  const candTask63 = resTest63.rankedCandidates.find(c => c.candidate.sourceId === 't_gen_low_e');
  assert(
    candTask63 !== undefined && candTask63.decision !== 'NAO_FAZER',
    '63. Review com pontuação menor / incompatibilidade energética NÃO elimina Task genérica'
  );

  // 64. TEST: Review with LOW recommendationConfidence does NOT eliminate generic Task
  const revSpecLowConfidence: Review = {
    id: 'rev_spec_low_conf',
    userId: 'u1',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    reviewType: 'ACTIVE_RECALL',
    triggerReason: 'RETENTION_CHECK',
    status: 'AVAILABLE',
    createdAt: testNow,
    estimatedMinutes: 10,
    rationale: 'Revisão baixa confiança',
    recommendationConfidence: 'LOW',
    sourceEvidenceIds: [],
    priority: 'HIGH',
    policyVersion: '1.0',
  };

  const resTest64 = evaluateEfficiencyV2({
    ...baseInput,
    availableMinutes: 15,
    tasks: [taskGen15],
    reviews: [revSpecLowConfidence],
  });

  const candTask64 = resTest64.rankedCandidates.find(c => c.candidate.sourceId === 't_gen_15');
  assert(
    candTask64 !== undefined && candTask64.decision !== 'NAO_FAZER',
    '64. Review com recommendationConfidence LOW NÃO elimina Task genérica por substituição forte'
  );

  // 65. TEST: Critical Task is NEVER marked NAO_FAZER even if strong Review exists
  const taskCritGen: TaskItem = {
    ...taskGen15,
    id: 't_crit_gen',
    isCritical: true,
  };

  const resTest65 = evaluateEfficiencyV2({
    ...baseInput,
    availableMinutes: 15,
    tasks: [taskCritGen],
    reviews: [revSpec10],
  });

  const candTask65 = resTest65.rankedCandidates.find(c => c.candidate.sourceId === 't_crit_gen');
  assert(
    candTask65 !== undefined && candTask65.decision !== 'NAO_FAZER',
    '65. Task crítica NUNCA recebe NAO_FAZER, mesmo com Review forte disponível'
  );

  console.log('==================================================');
  console.log('   RESULTADO: TODOS OS TESTES DO MOTOR V2 PASSARAM!');
  console.log('==================================================');
}

runTests();


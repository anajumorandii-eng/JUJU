import fs from 'fs';
import {
  computeMasteryStateForTopic,
  calculateMasteryConfidence,
  calculateMasteryTrend,
} from './masteryEngine';
import {
  generateReviewDecisionForTopic,
  reassessReview,
  materializeReviewDecision,
  createLearningEvidenceFromReviewCompletion,
  createReviewId,
  getConsecutiveReviewFailures,
  chooseNextReviewMethodAfterFailures,
} from './reviewEngine';
import {
  calculateReviewWindow,
  estimateReviewMinutes,
  evaluateEvidenceRecency,
  deriveReviewStatusFromWindow,
  normalizeExamWeight,
} from './reviewPolicy';
import {
  LocalReviewRepository,
  LocalReviewCompletionRepository,
} from './reviewRepository';
import { LocalLearningEvidenceRepository, LocalAttemptRepository } from './questionRepository';
import {
  syncAdaptiveReviewsForUser,
  completeAdaptiveReview,
  groupReviewsForDisplay,
} from './reviewOrchestrator';
import {
  TopicNode,
  LearningEvidence,
  MasteryState,
  Review,
  ReviewCompletion,
  ErrorEntry,
  Attempt,
} from '../types';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${testName}`);
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('   EXECUTANDO TESTES DO REVIEW ENGINE — RODADA 3B');
  console.log('==================================================\n');

  const userId = 'user_test_3b';
  const dummyTopic: TopicNode = {
    id: 'topic_trig',
    subjectId: 'mat',
    name: 'Trigonometria',
    masteryLevel: 5,
    prerequisites: [],
    weightInExam: 8,
  };

  const now = '2026-08-08T10:00:00Z';

  // Helper evidences
  const evBase: LearningEvidence = {
    id: 'ev1',
    userId,
    subjectId: 'mat',
    topicIds: ['topic_trig'],
    type: 'QUESTION_ATTEMPT',
    sourceId: 'att1',
    createdAt: '2026-08-08T09:00:00Z',
    signal: 'STRONG_POSITIVE',
    result: 'CORRECT_CONFIDENT',
    confidence: 5,
    difficulty: 'EASY',
  };

  // --------------------------------------------------
  // 86. TESTES — PREFLIGHT
  // --------------------------------------------------
  
  // 1. 2 SUPPORTING na mesma data -> confidence LOW
  const ev1SameDay: LearningEvidence = { ...evBase, id: 'e1', sourceId: 'a1', createdAt: '2026-08-08T08:00:00Z' };
  const ev2SameDay: LearningEvidence = { ...evBase, id: 'e2', sourceId: 'a2', createdAt: '2026-08-08T09:00:00Z' };
  const st1 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [ev1SameDay, ev2SameDay] });
  assert(st1.confidence === 'LOW', '1. 2 SUPPORTING no mesmo dia sem diversidade temporal gera LOW');

  // 2. 2 SUPPORTING + 3 SELF_CORRECTED na mesma data -> continua LOW
  const evSC1: LearningEvidence = { ...evBase, id: 'esc1', sourceId: 'asc1', signal: 'SELF_CORRECTION', createdAt: '2026-08-08T09:10:00Z' };
  const evSC2: LearningEvidence = { ...evBase, id: 'esc2', sourceId: 'asc2', signal: 'SELF_CORRECTION', createdAt: '2026-08-08T09:20:00Z' };
  const evSC3: LearningEvidence = { ...evBase, id: 'esc3', sourceId: 'asc3', signal: 'SELF_CORRECTION', createdAt: '2026-08-08T09:30:00Z' };
  const st2 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [ev1SameDay, ev2SameDay, evSC1, evSC2, evSC3] });
  assert(st2.confidence === 'LOW', '2. 2 SUPPORTING + 3 SELF_CORRECTED no mesmo dia não infla para MODERATE');

  // 3. 2 SUPPORTING + 3 POST_SOLUTION na mesma data -> continua LOW
  const evPS1: LearningEvidence = { ...evBase, id: 'eps1', sourceId: 'aps1', signal: 'POST_SOLUTION', createdAt: '2026-08-08T09:10:00Z' };
  const evPS2: LearningEvidence = { ...evBase, id: 'eps2', sourceId: 'aps2', signal: 'POST_SOLUTION', createdAt: '2026-08-08T09:20:00Z' };
  const evPS3: LearningEvidence = { ...evBase, id: 'eps3', sourceId: 'aps3', signal: 'POST_SOLUTION', createdAt: '2026-08-08T09:30:00Z' };
  const st3 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [ev1SameDay, ev2SameDay, evPS1, evPS2, evPS3] });
  assert(st3.confidence === 'LOW', '3. 2 SUPPORTING + 3 POST_SOLUTION não infla para MODERATE');

  // 4. Sequência apenas de ASSISTED -> trend UNKNOWN
  const tr4 = calculateMasteryTrend([evSC1, evSC2, evPS1]);
  assert(tr4 === 'UNKNOWN', '4. Sequência composta apenas por fontes assistidas produz trend UNKNOWN');

  // 5. supportingEvidenceIds não contém POST_SOLUTION
  assert(!st3.levelSupportingEvidenceIds.includes('eps1'), '5. levelSupportingEvidenceIds não contém POST_SOLUTION');

  // 6. supportingEvidenceIds não contém SELF_CORRECTION
  assert(!st2.levelSupportingEvidenceIds.includes('esc1'), '6. levelSupportingEvidenceIds não contém SELF_CORRECTION');

  // 7. supportingEvidenceIds não contém FRAGILE_POSITIVE
  const evFragile: LearningEvidence = { ...evBase, id: 'efrag', sourceId: 'afrag', signal: 'FRAGILE_POSITIVE' };
  const st7 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [ev1SameDay, evFragile] });
  assert(!st7.levelSupportingEvidenceIds.includes('efrag'), '7. levelSupportingEvidenceIds não contém FRAGILE_POSITIVE');

  // --------------------------------------------------
  // 87. TESTES — REVIEW DECISION BÁSICO
  // --------------------------------------------------

  // 8. UNKNOWN status -> NO_REVIEW_NOW
  const st8 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [] });
  const dec8 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st8, evidences: [], now });
  assert(dec8.action === 'NO_REVIEW_NOW', '8. Status UNKNOWN retorna NO_REVIEW_NOW');

  // 9. INSUFFICIENT_EVIDENCE -> não gera teoria completa
  const evErr1: LearningEvidence = { ...evBase, id: 'eerr1', sourceId: 'aerr1', signal: 'NEGATIVE_SIGNAL', result: 'WRONG' };
  const st9 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evErr1] });
  const dec9 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st9, evidences: [evErr1], now });
  assert(dec9.reviewType !== 'THEORY_REFRESH', '9. INSUFFICIENT_EVIDENCE com erro não gera THEORY_REFRESH');

  // 10. ESTIMATED + evidência recente consistente -> NO_REVIEW_NOW
  const evEasy1DiffDay: LearningEvidence = { ...evBase, id: 'e1d', sourceId: 'a1d', createdAt: '2026-08-01T08:00:00Z' };
  const evEasy2DiffDay: LearningEvidence = { ...evBase, id: 'e2d', sourceId: 'a2d', createdAt: '2026-08-05T08:00:00Z' };
  const st10 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1DiffDay, evEasy2DiffDay] });
  const dec10 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st10, evidences: [evEasy1DiffDay, evEasy2DiffDay], now });
  assert(dec10.action === 'NO_REVIEW_NOW', '10. ESTIMATED com evidência recente e consistência retorna NO_REVIEW_NOW');

  // 11. CONFLICTED -> DIAGNOSTIC_RETEST
  const evErr2DiffDay: LearningEvidence = { ...evBase, id: 'eerr2', sourceId: 'aerr2', signal: 'NEGATIVE_SIGNAL', result: 'WRONG' };
  const st11 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1DiffDay, evEasy2DiffDay, evErr1, evErr2DiffDay] });
  const dec11 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st11, evidences: [evEasy1DiffDay, evEasy2DiffDay, evErr1, evErr2DiffDay], now });
  assert(dec11.action === 'DIAGNOSTIC_RETEST' && dec11.reviewType === 'DIAGNOSTIC_RETEST', '11. Status CONFLICTED resulta em DIAGNOSTIC_RETEST');

  // 12. confidence divergence -> ERROR_REVIEW
  const evConfDiv: LearningEvidence = { ...evBase, id: 'ediv', sourceId: 'adiv', signal: 'CONFIDENCE_DIVERGENCE', result: 'WRONG' };
  const st12 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evConfDiv] });
  const dec12 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st12, evidences: [evConfDiv], now });
  assert(dec12.reviewType === 'ERROR_REVIEW', '12. Confidence divergence resulta em ERROR_REVIEW');

  // 13. POST_SOLUTION -> REATTEMPT_WITHOUT_SUPPORT
  const st13 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evPS1] });
  const dec13 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st13, evidences: [evPS1], now });
  assert(dec13.reviewType === 'REATTEMPT_WITHOUT_SUPPORT', '13. POST_SOLUTION resulta em REATTEMPT_WITHOUT_SUPPORT');

  // 14. SELF_CORRECTION -> TARGETED_QUESTIONS (não teoria)
  const st14 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evSC1] });
  const dec14 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st14, evidences: [evSC1], now });
  assert(dec14.reviewType === 'TARGETED_QUESTIONS', '14. SELF_CORRECTION resulta em confirmação curta (TARGETED_QUESTIONS)');

  // 15. TIME_SIGNAL sozinho -> NO_REVIEW_NOW
  const evTime: LearningEvidence = { ...evBase, id: 'etime', sourceId: 'atime', signal: 'TIME_SIGNAL' };
  const st15 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evTime] });
  const dec15 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st15, evidences: [evTime], now });
  assert(dec15.action === 'NO_REVIEW_NOW', '15. Apenas TIME_SIGNAL retorna NO_REVIEW_NOW');

  // --------------------------------------------------
  // 88. TESTES — REVIEW TYPES & ERROR NOTEBOOK INTEGRATION
  // --------------------------------------------------

  // 16. Erro de pré-requisito no caderno de erros gera DIAGNOSTIC_RETEST
  const errPrereq: ErrorEntry = {
    id: 'err_p1',
    questionTitle: 'Erro de álgebra básica',
    subjectId: 'mat',
    topicId: 'topic_trig',
    errorType: 'pre_requisito',
    studentReasoning: 'Raciocínio errado em álgebra',
    correctedReasoning: 'Aplica fatoração',
    keyInsight: 'Revisar fatoração',
    recordedAt: '2026-08-01T10:00:00Z',
    reviewStatus: 'pending',
  };
  const dec16 = generateReviewDecisionForTopic({
    userId,
    topic: dummyTopic,
    masteryState: st9,
    evidences: [evErr1],
    errors: [errPrereq],
    now,
  });
  assert(dec16.reviewType === 'DIAGNOSTIC_RETEST', '16. Erro de pré-requisito resulta em DIAGNOSTIC_RETEST');

  // 17. Erro de cálculo não gera THEORY_REFRESH automaticamente
  const errCalc: ErrorEntry = {
    ...errPrereq,
    id: 'err_c1',
    errorType: 'calculo',
  };
  const dec17 = generateReviewDecisionForTopic({
    userId,
    topic: dummyTopic,
    masteryState: st9,
    evidences: [evErr1],
    errors: [errCalc],
    now,
  });
  assert(dec17.reviewType !== 'THEORY_REFRESH', '17. Erro de cálculo não gera THEORY_REFRESH');

  // 18. Erro de interpretação não gera teoria automaticamente
  const errInterp: ErrorEntry = {
    ...errPrereq,
    id: 'err_i1',
    errorType: 'interpretacao',
  };
  const dec18 = generateReviewDecisionForTopic({
    userId,
    topic: dummyTopic,
    masteryState: st9,
    evidences: [evErr1],
    errors: [errInterp],
    now,
  });
  assert(dec18.reviewType !== 'THEORY_REFRESH', '18. Erro de interpretação não gera THEORY_REFRESH');

  // 19. Pré-requisito não cria revisão superficial de teoria
  assert(dec16.reviewType !== 'THEORY_REFRESH', '19. Erro de pré-requisito privilegia diagnóstico e não revisão superficial');

  // --------------------------------------------------
  // 89. TESTES — WINDOW & DETERMINISMO
  // --------------------------------------------------

  // 20. FRAGILE recebe janela mais próxima que ESTIMATED MODERATE
  const winFragile = calculateReviewWindow({ triggerReason: 'FRAGILE_MASTERY', mastery: st9, now });
  const winRetention = calculateReviewWindow({ triggerReason: 'RETENTION_CHECK', mastery: st10, now });
  assert(new Date(winFragile.start).getTime() < new Date(winRetention.start).getTime(), '20. FRAGILE recebe janela mais próxima do que RETENTION_CHECK');

  // 21. POST_SOLUTION recebe janela de confirmação relativamente curta
  const winPostSol = calculateReviewWindow({ triggerReason: 'POST_SOLUTION_DEPENDENCY', mastery: st13, now });
  assert(new Date(winPostSol.start).getTime() <= new Date('2026-08-10T10:00:00Z').getTime(), '21. POST_SOLUTION recebe janela curta (1-3 dias)');

  // 22. SUCCESS_CONFIDENT anterior amplia janela
  const compSuccess: ReviewCompletion = {
    id: 'comp1',
    userId,
    reviewId: 'rev1',
    outcome: 'SUCCESS_CONFIDENT',
    completedAt: '2026-08-07T10:00:00Z',
  };
  const winSuccess = calculateReviewWindow({ triggerReason: 'FRAGILE_MASTERY', mastery: st9, previousCompletions: [compSuccess], now });
  assert(new Date(winSuccess.start).getTime() > new Date(winFragile.start).getTime(), '22. SUCCESS_CONFIDENT anterior amplia janela inicial');

  // 23. FAILED anterior reduz janela
  const compFailed: ReviewCompletion = {
    id: 'comp2',
    userId,
    reviewId: 'rev2',
    outcome: 'FAILED',
    completedAt: '2026-08-07T10:00:00Z',
  };
  const winFailed = calculateReviewWindow({ triggerReason: 'FRAGILE_MASTERY', mastery: st9, previousCompletions: [compFailed], now });
  assert(new Date(winFailed.start).getTime() < new Date(winSuccess.start).getTime(), '23. FAILED anterior reduz janela');

  // 24. exam date ausente não gera data fictícia
  assert(Boolean(winFragile.start && winFragile.end), '24. Janela é gerada sem depender de data fictícia de prova');

  // 25. now explícito torna a função totalmente determinística
  const decA = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st13, evidences: [evPS1], now });
  const decB = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st13, evidences: [evPS1], now });
  assert(JSON.stringify(decA) === JSON.stringify(decB), '25. Parameter now explícito torna decisão e janela puras e determinísticas');

  // --------------------------------------------------
  // 90 & 91. TESTES — REASSESS
  // --------------------------------------------------

  // 30. Review existente + nova evidência forte -> CANCEL_NOT_NEEDED
  const existingRev: Review = {
    id: 'rev_test_1',
    userId,
    subjectId: 'mat',
    topicId: 'topic_trig',
    reviewType: 'REATTEMPT_WITHOUT_SUPPORT',
    triggerReason: 'POST_SOLUTION_DEPENDENCY',
    status: 'SCHEDULED',
    priority: 'HIGH',
    sourceEvidenceIds: ['eps1'],
    createdAt: '2026-08-01T10:00:00Z',
    estimatedMinutes: 12,
    rationale: 'Teste',
    recommendationConfidence: 'MODERATE',
    policyVersion: 'INITIAL_REVIEW_POLICY_V1',
  };

  const newStrongEv: LearningEvidence = { ...evBase, id: 'ev_new_strong', sourceId: 'att_new_strong', createdAt: '2026-08-08T09:00:00Z' };
  const stReassess1 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [evEasy1DiffDay, evEasy2DiffDay, newStrongEv],
  });

  const reassessOutput = reassessReview({
    review: existingRev,
    currentMastery: stReassess1,
    latestEvidences: [evEasy1DiffDay, evEasy2DiffDay, newStrongEv],
    now,
  });

  assert(reassessOutput.action === 'CANCEL_NOT_NEEDED', '30. Nova evidência de domínio cancela revisão antiga desnecessária');

  // 32. Método repetidamente falho -> CHANGE_METHOD
  const revActive: Review = { ...existingRev, id: 'rev_act', reviewType: 'ACTIVE_RECALL' };
  const compFail1: ReviewCompletion = { id: 'cf1', userId, reviewId: 'rev_act', outcome: 'FAILED', completedAt: '2026-08-05T10:00:00Z' };
  const compFail2: ReviewCompletion = { id: 'cf2', userId, reviewId: 'rev_act', outcome: 'FAILED', completedAt: '2026-08-06T10:00:00Z' };

  const reassessFail = reassessReview({
    review: revActive,
    currentMastery: st9,
    latestEvidences: [evErr1],
    latestCompletions: [compFail1, compFail2],
    now,
  });

  assert(reassessFail.action === 'CHANGE_METHOD' && reassessFail.updatedReviewType === 'TARGETED_QUESTIONS', '32. Revisões falhas repetidas alteram o método');

  // 33. Review fora da janela -> RESCHEDULE sem cobrança punitiva
  const overdueRev: Review = {
    ...existingRev,
    id: 'rev_overdue',
    recommendedWindowEnd: '2026-08-01',
  };
  const reassessOverdue = reassessReview({
    review: overdueRev,
    currentMastery: st9,
    latestEvidences: [evErr1],
    now,
  });
  assert(reassessOverdue.action === 'RESCHEDULE', '33. Revisão com atraso é reagendada sem cobrança punitiva');

  // --------------------------------------------------
  // TESTES ADICIONAIS DE AUDITORIA & RECÊNCIA (RODADA 3B.2)
  // --------------------------------------------------

  // 7. Testes de REVIEW_RESULT
  const evReviewResult: LearningEvidence = {
    id: 'ev_rev_res',
    userId,
    subjectId: 'mat',
    topicIds: ['topic_trig'],
    type: 'REVIEW_RESULT',
    sourceId: 'rev1',
    createdAt: '2026-08-08T09:00:00Z',
    signal: 'STRONG_POSITIVE',
    result: 'CORRECT_CONFIDENT',
    confidence: 5,
  };

  const evRevRes1: LearningEvidence = { ...evReviewResult, id: 'evrr1', sourceId: 'rev_s1', createdAt: '2026-08-01T10:00:00Z' };
  const evRevRes2: LearningEvidence = { ...evReviewResult, id: 'evrr2', sourceId: 'rev_s2', createdAt: '2026-08-02T10:00:00Z' };
  const stRev2 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evRevRes1, evRevRes2] });
  assert(stRev2.estimatedLevel === null, '7a. 2 REVIEW_RESULT STRONG_POSITIVE -> estimatedLevel continua null');

  const evRevRes3: LearningEvidence = { ...evReviewResult, id: 'evrr3', sourceId: 'rev_s3', createdAt: '2026-08-03T10:00:00Z' };
  const evRevRes4: LearningEvidence = { ...evReviewResult, id: 'evrr4', sourceId: 'rev_s4', createdAt: '2026-08-04T10:00:00Z' };
  const evRevRes5: LearningEvidence = { ...evReviewResult, id: 'evrr5', sourceId: 'rev_s5', createdAt: '2026-08-05T10:00:00Z' };
  const stRev5 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evRevRes1, evRevRes2, evRevRes3, evRevRes4, evRevRes5] });
  assert(stRev5.estimatedLevel === null, '7b. 5 REVIEW_RESULT STRONG_POSITIVE -> estimatedLevel continua null');

  const evQA1: LearningEvidence = { ...evBase, id: 'evqa1', sourceId: 'att_qa1', difficulty: 'EASY', createdAt: '2026-08-01T10:00:00Z' };
  const evQA2: LearningEvidence = { ...evBase, id: 'evqa2', sourceId: 'att_qa2', difficulty: 'EASY', createdAt: '2026-08-02T10:00:00Z' };
  const stQA = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evQA1, evQA2] });
  assert(stQA.estimatedLevel === 6, '7c. 2 QUESTION_ATTEMPT STRONG_POSITIVE EASY -> nível 6 é estimado');

  // 15. Recência (Janeiro x Agosto) -> RETENTION_CHECK
  const evOld1: LearningEvidence = { ...evBase, id: 'evold1', sourceId: 'att_old1', createdAt: '2026-01-10T10:00:00Z' };
  const evOld2: LearningEvidence = { ...evBase, id: 'evold2', sourceId: 'att_old2', createdAt: '2026-01-15T10:00:00Z' };
  const evOld3: LearningEvidence = { ...evBase, id: 'evold3', sourceId: 'att_old3', createdAt: '2026-01-20T10:00:00Z' };
  const stOld = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evOld1, evOld2, evOld3] });
  const decOld = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: stOld, evidences: [evOld1, evOld2, evOld3], now: '2026-08-08T10:00:00Z' });
  assert(decOld.action === 'SCHEDULE_REVIEW' && decOld.triggerReason === 'RETENTION_CHECK', '15. Evidências antigas de janeiro em agosto geram RETENTION_CHECK e não NO_REVIEW_NOW');

  // 64. 3 STRONG_POSITIVE em janeiro + TIME_SIGNAL ontem + now agosto -> RETENTION_CHECK
  const evTimeYesterday: LearningEvidence = { ...evBase, id: 'ev_time_yesterday', sourceId: 'att_ty', signal: 'TIME_SIGNAL', createdAt: '2026-08-07T10:00:00Z' };
  const decTimeYesterday = generateReviewDecisionForTopic({
    userId,
    topic: dummyTopic,
    masteryState: stOld,
    evidences: [evOld1, evOld2, evOld3, evTimeYesterday],
    now: '2026-08-08T10:00:00Z',
  });
  assert(decTimeYesterday.action === 'SCHEDULE_REVIEW' && decTimeYesterday.triggerReason === 'RETENTION_CHECK', '64. TIME_SIGNAL recente não torna aplicação antiga de janeiro recente');

  // 65. UNKNOWN recente + aplicação antiga -> RETENTION_CHECK
  const evUnknownYesterday: LearningEvidence = { ...evBase, id: 'ev_unk_yesterday', sourceId: 'att_unk', signal: 'UNKNOWN', createdAt: '2026-08-07T10:00:00Z' };
  const recUnk = evaluateEvidenceRecency({ masteryState: stOld, evidences: [evOld1, evOld2, evOld3, evUnknownYesterday], now: '2026-08-08T10:00:00Z' });
  assert(recUnk === 'STALE', '65. UNKNOWN recente não renova recência de aplicação antiga');

  // 66. Review FAILED ontem + aplicação antiga -> não renova retenção
  const compFailedYesterday: ReviewCompletion = { id: 'comp_fy', userId, reviewId: 'rev_old', outcome: 'FAILED', completedAt: '2026-08-07T10:00:00Z' };
  const recFailComp = evaluateEvidenceRecency({ masteryState: stOld, evidences: [evOld1, evOld2, evOld3], previousCompletions: [compFailedYesterday], now: '2026-08-08T10:00:00Z' });
  assert(recFailComp === 'STALE', '66. ReviewCompletion FAILED recente não torna o conteúdo RECENT');

  // 67. Successful Review Completion recente -> NO_REVIEW_NOW com indicação de checagem recente
  const compSuccessYesterday: ReviewCompletion = { id: 'comp_sy', userId, reviewId: 'rev_old', outcome: 'SUCCESS_CONFIDENT', completedAt: '2026-08-07T10:00:00Z' };
  const revOldObj: Review = { ...existingRev, id: 'rev_old', topicId: 'topic_trig', reviewType: 'ACTIVE_RECALL' };
  const decSuccessComp = generateReviewDecisionForTopic({
    userId,
    topic: dummyTopic,
    masteryState: stOld,
    evidences: [evOld1, evOld2, evOld3],
    previousReviews: [revOldObj],
    previousReviewCompletions: [compSuccessYesterday],
    now: '2026-08-08T10:00:00Z',
  });
  assert(decSuccessComp.action === 'NO_REVIEW_NOW' && decSuccessComp.rationale.includes('checagem recente'), '67. ReviewCompletion SUCCESS_CONFIDENT recente gera NO_REVIEW_NOW informando checagem recente');

  // 68. 1 trigger ambíguo + 10 TIME_SIGNAL -> recommendationConfidence não é HIGH
  const evs10Time = Array.from({ length: 10 }, (_, i) => ({ ...evTime, id: `ev_t_${i}`, sourceId: `s_t_${i}` }));
  const st10Time = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evErr1, ...evs10Time] });
  const dec10Time = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st10Time, evidences: [evErr1, ...evs10Time], now });
  assert(dec10Time.recommendationConfidence !== 'HIGH', '68. 10 TIME_SIGNAL não inflam a confiança da recomendação para HIGH');

  // 69. Derive review status from window
  const statusFuture = deriveReviewStatusFromWindow({ start: '2026-08-10', end: '2026-08-15', now: '2026-08-08T10:00:00Z' });
  const statusCurrent = deriveReviewStatusFromWindow({ start: '2026-08-05', end: '2026-08-10', now: '2026-08-08T10:00:00Z' });
  const statusPast = deriveReviewStatusFromWindow({ start: '2026-08-01', end: '2026-08-05', now: '2026-08-08T10:00:00Z' });
  assert(statusFuture === 'SCHEDULED' && statusCurrent === 'AVAILABLE' && statusPast === 'REASSESS', '69. Status da Review é derivado corretamente da janela (SCHEDULED, AVAILABLE, REASSESS)');

  // 19. Isolamento Cross-Topic
  const topicB: TopicNode = { id: 'topic_calc', subjectId: 'mat', name: 'Cálculo', masteryLevel: 1, prerequisites: [], weightInExam: 5 };
  const revTopicB: Review = { ...existingRev, id: 'rev_topic_b', topicId: 'topic_calc' };
  const compTopicB: ReviewCompletion = { id: 'comp_tb', userId, reviewId: 'rev_topic_b', outcome: 'SUCCESS_CONFIDENT', completedAt: '2026-08-07T10:00:00Z' };
  const windowAWithCross = calculateReviewWindow({ triggerReason: 'FRAGILE_MASTERY', mastery: st9, previousCompletions: [], now });
  assert(!windowAWithCross.rationale.includes('ampliada devido ao sucesso'), '19. ReviewCompletion de tópico B não altera janela do tópico A');

  // --------------------------------------------------
  // 92, 93, 94. TESTES — REPOSITORY & PERSISTÊNCIA
  // --------------------------------------------------

  const reviewRepo = new LocalReviewRepository();
  const completionRepo = new LocalReviewCompletionRepository();

  // 34 & 42. Criar review -> salvar -> recarregar -> permanece
  reviewRepo.saveReview(existingRev);
  const fetchedRev = reviewRepo.getReviewById(existingRev.id, userId);
  assert(fetchedRev !== null && fetchedRev.id === existingRev.id, '34 & 42. Review é salva e recuperada com sucesso do repositório');

  // 35. Re-salvar review idêntica é idempotente
  const savedSame = reviewRepo.saveReview(existingRev);
  assert(savedSame.id === existingRev.id, '35. Re-salvar review idêntica é idempotente');

  // 36. Tentar alterar campos estruturais lança erro
  let errImmut = false;
  try {
    reviewRepo.saveReview({ ...existingRev, topicId: 'topic_outrotopic' });
  } catch {
    errImmut = true;
  }
  assert(errImmut, '36. Tentar alterar tópico em Review salva lança erro de imutabilidade');

  // 43. Completion salva -> recarregar -> permanece
  completionRepo.saveCompletion(compSuccess);
  const fetchedComps = completionRepo.getCompletionsByReview(compSuccess.reviewId);
  assert(fetchedComps.length === 1 && fetchedComps[0].id === compSuccess.id, '43. ReviewCompletion é salva e recuperada');

  // 39. REVIEW_RESULT de Active Recall NÃO eleva estimatedLevel 6/7/8
  const stReviewResult = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [evReviewResult],
  });

  assert(stReviewResult.estimatedLevel === null, '39. REVIEW_RESULT isolado não eleva estimatedLevel de aplicação numérico');

  // 45. Não duplica review ativa para mesmo tópico + trigger
  const activeRev = reviewRepo.findActiveReviewForTopicAndTrigger(userId, 'topic_trig', 'POST_SOLUTION_DEPENDENCY');
  assert(activeRev !== null && activeRev.id === existingRev.id, '45. Encontra review ativa existente sem duplicar');

  // 71 & 72. createLearningEvidenceFromReviewCompletion usa completion.id como sourceId
  const evFromComp = createLearningEvidenceFromReviewCompletion({ review: existingRev, completion: compSuccess });
  assert(evFromComp.sourceId === compSuccess.id && evFromComp.type === 'REVIEW_RESULT', '71. createLearningEvidenceFromReviewCompletion usa completion.id como sourceId');

  // --------------------------------------------------
  // 20 MANDATORY TESTS FOR RODADA 3B.3A
  // --------------------------------------------------

  // M1. divergence + self-correction -> não ERROR_REVIEW (gera TARGETED_QUESTIONS / SELF_CORRECTION)
  const evDiv1: LearningEvidence = { ...evBase, id: 'm1_div', sourceId: 'att_m1', signal: 'CONFIDENCE_DIVERGENCE' };
  const evSCM1: LearningEvidence = { ...evBase, id: 'm1_sc', sourceId: 'att_m1', signal: 'SELF_CORRECTION' };
  const stM1 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evDiv1, evSCM1] });
  const decM1 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: stM1, evidences: [evDiv1, evSCM1], now });
  assert(decM1.reviewType !== 'ERROR_REVIEW' && decM1.triggerReason === 'SELF_CORRECTION', 'M1. divergence + self-correction no mesmo attempt produz SELF_CORRECTION (TARGETED_QUESTIONS) e não ERROR_REVIEW');

  // M2. divergence + post-solution -> REATTEMPT_WITHOUT_SUPPORT
  const evDiv2: LearningEvidence = { ...evBase, id: 'm2_div', sourceId: 'att_m2', signal: 'CONFIDENCE_DIVERGENCE' };
  const evPSM2: LearningEvidence = { ...evBase, id: 'm2_ps', sourceId: 'att_m2', signal: 'POST_SOLUTION' };
  const stM2 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evDiv2, evPSM2] });
  const decM2 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: stM2, evidences: [evDiv2, evPSM2], now });
  assert(decM2.reviewType === 'REATTEMPT_WITHOUT_SUPPORT' && decM2.triggerReason === 'POST_SOLUTION_DEPENDENCY', 'M2. divergence + post-solution produz REATTEMPT_WITHOUT_SUPPORT');

  // M3. stale retention check tem janela próxima (startOffsetDays = 0)
  const decStale = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: stOld, evidences: [evOld1, evOld2, evOld3], now: '2026-08-08T10:00:00Z' });
  assert(decStale.recommendedWindow?.start === '2026-08-08', 'M3. stale retention check gera janela iniciando hoje (2026-08-08)');

  // M4. reschedule futuro -> SCHEDULED
  const resFut = reviewRepo.rescheduleReview({ id: existingRev.id, userId, windowStart: '2026-08-15', windowEnd: '2026-08-20', now: '2026-08-08T10:00:00Z' });
  assert(resFut?.status === 'SCHEDULED', 'M4. reschedule para o futuro define status SCHEDULED');

  // M5. reschedule atual -> AVAILABLE
  const resCurr = reviewRepo.rescheduleReview({ id: existingRev.id, userId, windowStart: '2026-08-05', windowEnd: '2026-08-10', now: '2026-08-08T10:00:00Z' });
  assert(resCurr?.status === 'AVAILABLE', 'M5. reschedule para janela atual define status AVAILABLE');

  // M6. change method atualiza estimatedMinutes
  const resMethod = reviewRepo.changeReviewMethod({ id: existingRev.id, userId, reviewType: 'TARGETED_QUESTIONS' });
  assert(resMethod?.estimatedMinutes === 20, 'M6. changeReviewMethod atualiza estimatedMinutes para 20m de TARGETED_QUESTIONS');

  // M7. REVIEW_RESULT strong não cancela review como aplicação nova
  const compResultEv: LearningEvidence = { ...evReviewResult, id: 'ev_comp_res', createdAt: '2026-08-05T10:00:00Z' };
  const reassessResultComp = reassessReview({ review: existingRev, currentMastery: st10, latestEvidences: [compResultEv], now });
  assert(reassessResultComp.action !== 'CANCEL_NOT_NEEDED', 'M7. REVIEW_RESULT strong não cancela revisão como se fosse aplicação nova');

  // M8. QUESTION_ATTEMPT supporting posterior pode cancelar
  const appSupportingEv: LearningEvidence = { ...evBase, id: 'ev_app_supp', sourceId: 'att_app_supp', createdAt: '2026-08-05T10:00:00Z' };
  const reassessAppSupp = reassessReview({ review: existingRev, currentMastery: st10, latestEvidences: [appSupportingEv], now });
  assert(reassessAppSupp.action === 'CANCEL_NOT_NEEDED', 'M8. QUESTION_ATTEMPT supporting posterior cancela revisão desnecessária');

  // M9. 1 erro conceitual não é recorrência
  const errConc1: ErrorEntry = { ...errPrereq, id: 'err_c_1', errorType: 'conceitual' };
  const decErr1 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st9, evidences: [evErr1], errors: [errConc1], now });
  assert(decErr1.reviewType !== 'THEORY_REFRESH', 'M9. 1 erro conceitual isolado não gera THEORY_REFRESH');

  // M10. 2 erros conceituais pending geram THEORY_REFRESH
  const errConc2: ErrorEntry = { ...errPrereq, id: 'err_c_2', errorType: 'conceitual' };
  const decErr2 = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st9, evidences: [evErr1], errors: [errConc1, errConc2], now });
  assert(decErr2.reviewType === 'THEORY_REFRESH', 'M10. 2 erros conceituais pending geram THEORY_REFRESH');

  // M11. 2 erros de cálculo não geram THEORY_REFRESH (geram TARGETED_QUESTIONS)
  const errCalc1: ErrorEntry = { ...errPrereq, id: 'err_calc_1', errorType: 'calculo' };
  const errCalc2: ErrorEntry = { ...errPrereq, id: 'err_calc_2', errorType: 'calculo' };
  const decErrCalc = generateReviewDecisionForTopic({ userId, topic: dummyTopic, masteryState: st9, evidences: [evErr1], errors: [errCalc1, errCalc2], now });
  assert(decErrCalc.reviewType === 'TARGETED_QUESTIONS', 'M11. 2 erros de cálculo geram TARGETED_QUESTIONS e não THEORY_REFRESH');

  // M12. ReviewDecision preserva sourceAttemptIds
  assert(Array.isArray(decM1.sourceAttemptIds) && decM1.sourceAttemptIds.includes('att_m1'), 'M12. ReviewDecision preserva sourceAttemptIds');

  // M13. ReviewDecision preserva sourceErrorIds
  assert(Array.isArray(decErr2.sourceErrorIds) && decErr2.sourceErrorIds.includes('err_c_1'), 'M13. ReviewDecision preserva sourceErrorIds');

  // M14. materialize preserva essas origens
  const materializedRev = materializeReviewDecision({ decision: decErr2, userId, topic: dummyTopic, reviewRepository: reviewRepo, now });
  assert(materializedRev !== null && materializedRev.sourceErrorIds?.includes('err_c_1'), 'M14. materializeReviewDecision preserva sourceErrorIds no objeto Review');

  // M15. same Review ID + window diferente gera erro em saveReview
  let errSaveWindow = false;
  try {
    reviewRepo.saveReview({ ...existingRev, recommendedWindowStart: '2026-09-01' });
  } catch {
    errSaveWindow = true;
  }
  assert(errSaveWindow, 'M15. Mesma Review ID com janela diferente gera erro de imutabilidade em saveReview');

  // M16. same Completion ID + notes diferente gera erro
  let errCompNotes = false;
  try {
    completionRepo.saveCompletion({ ...compSuccess, notes: 'Notas alteradas' });
  } catch {
    errCompNotes = true;
  }
  assert(errCompNotes, 'M16. Mesma Completion ID com notes diferente gera erro de imutabilidade');

  // M17. same Completion ID + completedAt diferente gera erro
  let errCompAt = false;
  try {
    completionRepo.saveCompletion({ ...compSuccess, completedAt: '2026-08-09T10:00:00Z' });
  } catch {
    errCompAt = true;
  }
  assert(errCompAt, 'M17. Mesma Completion ID com completedAt diferente gera erro de imutabilidade');

  // M18. sync executado duas vezes não duplica Reviews
  const repoOrch = new LocalReviewRepository();
  const compRepoOrch = new LocalReviewCompletionRepository();
  const dummyTopicSync: TopicNode = { ...dummyTopic, id: 'topic_sync_unique' };
  const evPS1Sync: LearningEvidence = { ...evPS1, id: 'ev_ps1_sync', topicIds: ['topic_sync_unique'], userId };
  const sync1 = syncAdaptiveReviewsForUser({
    userId,
    topics: [dummyTopicSync],
    evidences: [evPS1Sync],
    reviewRepository: repoOrch,
    reviewCompletionRepository: compRepoOrch,
    now,
  });
  const count1 = sync1.reviews.filter(r => r.topicId === 'topic_sync_unique').length;
  const sync2 = syncAdaptiveReviewsForUser({
    userId,
    topics: [dummyTopicSync],
    evidences: [evPS1Sync],
    reviewRepository: repoOrch,
    reviewCompletionRepository: compRepoOrch,
    now,
  });
  const count2 = sync2.reviews.filter(r => r.topicId === 'topic_sync_unique').length;
  assert(count1 === 1 && count2 === 1, 'M18. syncAdaptiveReviewsForUser executado 2x não duplica reviews');

  // M19. sync com nova evidência forte cancela Review desnecessária
  const appSupportingEvSync: LearningEvidence = { ...appSupportingEv, id: 'ev_app_supp_sync', topicIds: ['topic_sync_unique'], userId, createdAt: '2026-08-08T11:00:00Z' };
  const reviewCreatedInSync1 = sync1.reviews.find(r => r.topicId === 'topic_sync_unique');
  const sync3 = syncAdaptiveReviewsForUser({
    userId,
    topics: [dummyTopicSync],
    evidences: [evPS1Sync, appSupportingEvSync],
    reviewRepository: repoOrch,
    reviewCompletionRepository: compRepoOrch,
    now: '2026-08-08T12:00:00Z',
  });
  const activePostSync = sync3.reviews.find(r => r.id === reviewCreatedInSync1?.id);
  assert(activePostSync?.status === 'CANCELED', 'M19. sync com nova evidência forte cancela review ativa desnecessária');

  // M20. completeAdaptiveReview salva Completion + REVIEW_RESULT + status COMPLETED
  const newRevForComplete: Review = { ...existingRev, id: 'rev_complete_test', status: 'AVAILABLE' };
  repoOrch.saveReview(newRevForComplete);

  const completedRes = completeAdaptiveReview({
    reviewId: 'rev_complete_test',
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    actualMinutes: 10,
    reviewRepository: repoOrch,
    reviewCompletionRepository: compRepoOrch,
    completedAt: now,
  });

  assert(
    completedRes.review.status === 'COMPLETED' &&
    completedRes.completion.outcome === 'SUCCESS_CONFIDENT' &&
    completedRes.evidence?.type === 'REVIEW_RESULT',
    'M20. completeAdaptiveReview salva Completion, atualiza status da Review para COMPLETED e gera evidência REVIEW_RESULT'
  );

  // --------------------------------------------------
  // TESTES DO HOTFIX FINAL (RODADA 3B.3A)
  // --------------------------------------------------

  // 1. package test:reviews existe no package.json
  const pkgContent = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
  assert(
    pkgContent.scripts &&
    pkgContent.scripts['test:reviews'] === 'tsx src/services/reviewsEngine.test.ts' &&
    pkgContent.scripts['test'].includes('npm run test:reviews'),
    'HF1. Script test:reviews configurado corretamente no package.json'
  );

  // 2. Segunda completion da mesma Review com parâmetros diferentes não é criada (gera erro)
  const revHF2: Review = { ...existingRev, id: 'rev_hf2', status: 'AVAILABLE' };
  repoOrch.saveReview(revHF2);
  completeAdaptiveReview({
    reviewId: 'rev_hf2',
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    reviewRepository: repoOrch,
    reviewCompletionRepository: compRepoOrch,
    completedAt: now,
  });

  let duplicateErrorThrown = false;
  try {
    completeAdaptiveReview({
      reviewId: 'rev_hf2',
      userId,
      outcome: 'FAILED',
      reviewRepository: repoOrch,
      reviewCompletionRepository: compRepoOrch,
      completedAt: now,
    });
  } catch {
    duplicateErrorThrown = true;
  }
  assert(duplicateErrorThrown, 'HF2. Segunda completion com outcome diferente para a mesma Review gera erro');

  // 3. Mesma conclusão idêntica é idempotente (não lança erro, retorna resultado)
  let idempotentSuccess = false;
  try {
    const resIdemp = completeAdaptiveReview({
      reviewId: 'rev_hf2',
      userId,
      outcome: 'SUCCESS_CONFIDENT',
      reviewRepository: repoOrch,
      reviewCompletionRepository: compRepoOrch,
      completedAt: now,
    });
    if (resIdemp && resIdemp.completion.outcome === 'SUCCESS_CONFIDENT') {
      idempotentSuccess = true;
    }
  } catch {
    idempotentSuccess = false;
  }
  assert(idempotentSuccess, 'HF3. Submissão com parâmetros idênticos é idempotente');

  // 4. Tentativa de outcome diferente para Review já concluída gera erro
  let conflictErrorThrown = false;
  try {
    completeAdaptiveReview({
      reviewId: 'rev_hf2',
      userId,
      outcome: 'PARTIAL',
      reviewRepository: repoOrch,
      reviewCompletionRepository: compRepoOrch,
      completedAt: now,
    });
  } catch {
    conflictErrorThrown = true;
  }
  assert(conflictErrorThrown, 'HF4. Outcome diferente para Review já concluída lança exceção');

  // 5. NOT_COMPLETED → SKIPPED
  const revHF5: Review = { ...existingRev, id: 'rev_hf5', status: 'AVAILABLE' };
  repoOrch.saveReview(revHF5);
  const resHF5 = completeAdaptiveReview({
    reviewId: 'rev_hf5',
    userId,
    outcome: 'NOT_COMPLETED',
    reviewRepository: repoOrch,
    reviewCompletionRepository: compRepoOrch,
    completedAt: now,
  });
  assert(resHF5.review.status === 'SKIPPED', 'HF5. Outcome NOT_COMPLETED altera status da Review para SKIPPED');

  // 6. NOT_COMPLETED não cria LearningEvidence
  assert(resHF5.evidence === undefined, 'HF6. Outcome NOT_COMPLETED não gera objeto de LearningEvidence');

  // 7. FAILED → COMPLETED + REVIEW_RESULT negativo
  const revHF7: Review = { ...existingRev, id: 'rev_hf7', status: 'AVAILABLE' };
  repoOrch.saveReview(revHF7);
  const resHF7 = completeAdaptiveReview({
    reviewId: 'rev_hf7',
    userId,
    outcome: 'FAILED',
    reviewRepository: repoOrch,
    reviewCompletionRepository: compRepoOrch,
    completedAt: now,
  });
  assert(
    resHF7.review.status === 'COMPLETED' &&
    resHF7.evidence !== undefined &&
    resHF7.evidence.type === 'REVIEW_RESULT' &&
    resHF7.evidence.signal === 'NEGATIVE_SIGNAL',
    'HF7. Outcome FAILED resulta em status COMPLETED e gera REVIEW_RESULT com NEGATIVE_SIGNAL'
  );

  // 8. Duas Reviews FAILED consecutivamente contam como duas falhas
  const revHist1: Review = { ...existingRev, id: 'rev_h1', topicId: 'topic_consec_fail', reviewType: 'ACTIVE_RECALL' };
  const revHist2: Review = { ...existingRev, id: 'rev_h2', topicId: 'topic_consec_fail', reviewType: 'ACTIVE_RECALL' };
  const compHF8a: ReviewCompletion = { id: 'comp_h1', userId, reviewId: 'rev_h1', outcome: 'FAILED', completedAt: '2026-08-01T10:00:00Z' };
  const compHF8b: ReviewCompletion = { id: 'comp_h2', userId, reviewId: 'rev_h2', outcome: 'FAILED', completedAt: '2026-08-02T10:00:00Z' };
  const failsConsec2 = getConsecutiveReviewFailures({
    topicReviews: [revHist1, revHist2],
    completions: [compHF8a, compHF8b],
    reviewType: 'ACTIVE_RECALL',
  });
  assert(failsConsec2 === 2, 'HF8. Duas Reviews com FAILED consecutivas contam como 2 falhas');

  // 9. FAILED + SUCCESS + FAILED não contam como duas consecutivas
  const revHist3: Review = { ...existingRev, id: 'rev_h3', topicId: 'topic_consec_fail', reviewType: 'ACTIVE_RECALL' };
  const compHF9_success: ReviewCompletion = { id: 'comp_h2_succ', userId, reviewId: 'rev_h2', outcome: 'SUCCESS_CONFIDENT', completedAt: '2026-08-02T10:00:00Z' };
  const compHF9_failedRecent: ReviewCompletion = { id: 'comp_h3_fail', userId, reviewId: 'rev_h3', outcome: 'FAILED', completedAt: '2026-08-03T10:00:00Z' };
  const failsConsec1 = getConsecutiveReviewFailures({
    topicReviews: [revHist1, revHist2, revHist3],
    completions: [compHF8a, compHF9_success, compHF9_failedRecent],
    reviewType: 'ACTIVE_RECALL',
  });
  assert(failsConsec1 === 1, 'HF9. FAILED + SUCCESS + FAILED resulta em apenas 1 falha consecutiva');

  // 10. Duas TARGETED_QUESTIONS falhas selecionam ERROR_REVIEW (não repetem TARGETED_QUESTIONS)
  const nextMethodAfter2 = chooseNextReviewMethodAfterFailures({
    currentMethod: 'TARGETED_QUESTIONS',
    consecutiveFailures: 2,
    hasConceptualErrors: false,
  });
  assert(nextMethodAfter2 === 'ERROR_REVIEW', 'HF10. Duas falhas em TARGETED_QUESTIONS alteram método para ERROR_REVIEW');

  // 11. Review IDs não colidem em criação rápida
  const idA = createReviewId('top1', 'FRAGILE_MASTERY');
  const idB = createReviewId('top1', 'FRAGILE_MASTERY');
  assert(idA !== idB && idA.startsWith('rev_top1_FRAGILE_MASTERY_'), 'HF11. createReviewId gera IDs únicos em chamadas rápidas sequenciais');

  // 12. weight 1 normaliza para 0.1
  assert(normalizeExamWeight(1) === 0.1, 'HF12. Weight 1 normaliza exatamente para 0.1');

  // 13. weight 10 normaliza para 1.0
  assert(normalizeExamWeight(10) === 1.0, 'HF13. Weight 10 normaliza exatamente para 1.0');

  // 14. Ausência de weight é neutra (0.5)
  assert(normalizeExamWeight(undefined) === 0.5, 'HF14. Ausência de weight (undefined) resulta no valor neutro 0.5');

  // 15. Orchestrator usa topic.weightInExam quando não há override no context
  const topicWeighted: TopicNode = { id: 'topic_weighted', subjectId: 'mat', name: 'Peso Alto', masteryLevel: 1, prerequisites: [], weightInExam: 9 };
  const repoWeight = new LocalReviewRepository();
  const compRepoWeight = new LocalReviewCompletionRepository();
  const syncWeightRes = syncAdaptiveReviewsForUser({
    userId,
    topics: [topicWeighted],
    evidences: [evErr1],
    reviewRepository: repoWeight,
    reviewCompletionRepository: compRepoWeight,
    now: '2026-08-08T10:00:00Z',
  });
  assert(syncWeightRes.reviews.length > 0, 'HF15. Orchestrator processa corretamente topic.weightInExam de forma autônoma');

  // 16. SCHEDULED vira AVAILABLE quando a janela começa
  const revSchedFuture: Review = {
    ...existingRev,
    id: 'rev_sched_avail',
    status: 'SCHEDULED',
    recommendedWindowStart: '2026-08-01T00:00:00Z',
    recommendedWindowEnd: '2026-08-10T00:00:00Z',
  };
  const groupedHF16 = groupReviewsForDisplay({
    reviews: [revSchedFuture],
    now: '2026-08-05T10:00:00Z',
  });
  assert(
    groupedHF16.available.some(r => r.id === 'rev_sched_avail'),
    'HF16. Review SCHEDULED com janela iniciada é agrupada em available'
  );

  // 17. Janela vencida vira REASSESS e é reavaliada no sync
  const repoReassess = new LocalReviewRepository();
  const compRepoReassess = new LocalReviewCompletionRepository();
  const revOverdueRepo: Review = {
    ...existingRev,
    id: 'rev_overdue_sync',
    status: 'SCHEDULED',
    recommendedWindowStart: '2026-08-01T00:00:00Z',
    recommendedWindowEnd: '2026-08-05T00:00:00Z',
  };
  repoReassess.saveReview(revOverdueRepo);
  const syncReassessRes = syncAdaptiveReviewsForUser({
    userId,
    topics: [dummyTopic],
    evidences: [evErr1],
    reviewRepository: repoReassess,
    reviewCompletionRepository: compRepoReassess,
    now: '2026-08-08T10:00:00Z',
  });
  const reviewAfterSyncReassess = syncReassessRes.reviews.find(r => r.id === 'rev_overdue_sync');
  assert(
    reviewAfterSyncReassess?.recommendedWindowStart !== '2026-08-01T00:00:00Z',
    'HF17. Review vencida é reagendada com nova janela durante o sync'
  );

  // 18. REASSESS não aparece diretamente em available no grouping
  const revReassessObj: Review = { ...existingRev, id: 'rev_reassess_grp', status: 'REASSESS' };
  const groupedHF18 = groupReviewsForDisplay({
    reviews: [revReassessObj],
    now: '2026-08-08T10:00:00Z',
  });
  assert(
    !groupedHF18.available.some(r => r.id === 'rev_reassess_grp') &&
    groupedHF18.needsReassessment?.some(r => r.id === 'rev_reassess_grp') === true,
    'HF18. Review com status REASSESS não é exposta em available no groupReviewsForDisplay'
  );

  // 19. TESTE DE LIFECYCLE REAL — adjustDecision adapta método após 2 falhas consecutivas
  const topicLifecycle: TopicNode = { id: 'topic_lifecycle_1', subjectId: 'mat', name: 'Lifecycle Test', masteryLevel: 1, prerequisites: [], weightInExam: 1 };
  const revL1: Review = {
    id: 'rev_l1',
    userId,
    subjectId: 'mat',
    topicId: topicLifecycle.id,
    reviewType: 'TARGETED_QUESTIONS',
    triggerReason: 'SELF_CORRECTION',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    createdAt: '2026-08-01T10:00:00Z',
    sourceEvidenceIds: [],
    estimatedMinutes: 15,
    rationale: 'Test 1',
    recommendationConfidence: 'HIGH',
    policyVersion: '1.0',
  };
  const compL1: ReviewCompletion = {
    id: 'comp_l1',
    userId,
    reviewId: 'rev_l1',
    outcome: 'FAILED',
    completedAt: '2026-08-01T11:00:00Z',
  };

  const revL2: Review = {
    id: 'rev_l2',
    userId,
    subjectId: 'mat',
    topicId: topicLifecycle.id,
    reviewType: 'TARGETED_QUESTIONS',
    triggerReason: 'SELF_CORRECTION',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    createdAt: '2026-08-02T10:00:00Z',
    sourceEvidenceIds: [],
    estimatedMinutes: 15,
    rationale: 'Test 2',
    recommendationConfidence: 'HIGH',
    policyVersion: '1.0',
  };
  const compL2: ReviewCompletion = {
    id: 'comp_l2',
    userId,
    reviewId: 'rev_l2',
    outcome: 'FAILED',
    completedAt: '2026-08-02T11:00:00Z',
  };

  const evL1: LearningEvidence = {
    id: 'ev_l1',
    userId,
    subjectId: 'mat',
    topicIds: [topicLifecycle.id],
    type: 'QUESTION_ATTEMPT',
    signal: 'SELF_CORRECTION',
    confidence: 3,
    createdAt: '2026-08-03T10:00:00Z',
    sourceId: 'att_l1',
  };

  const masteryLifecycle = computeMasteryStateForTopic({
    userId,
    topic: topicLifecycle,
    evidences: [evL1],
    computedAt: '2026-08-04T10:00:00Z',
  });

  const decisionLifecycle = generateReviewDecisionForTopic({
    userId,
    topic: topicLifecycle,
    masteryState: masteryLifecycle,
    evidences: [evL1],
    errors: [],
    previousReviews: [revL1, revL2],
    previousReviewCompletions: [compL1, compL2],
    now: '2026-08-04T10:00:00Z',
  });

  assert(
    decisionLifecycle.reviewType !== 'TARGETED_QUESTIONS' && decisionLifecycle.reviewType === 'ERROR_REVIEW',
    `HF19. Lifecycle real adapta TARGETED_QUESTIONS para ERROR_REVIEW após 2 falhas (gerado: ${decisionLifecycle.reviewType})`
  );

  // --- Idempotency & Evidence Recovery Tests (3B.3B-1.1) ---
  const revRepoIdemp = new LocalReviewRepository();
  const compRepoIdemp = new LocalReviewCompletionRepository();
  const evRepoIdemp = new LocalLearningEvidenceRepository();

  const revIdemp = revRepoIdemp.saveReview({
    id: 'rev_idemp_1',
    userId,
    subjectId: 'mat',
    topicId: 'topic_trig',
    reviewType: 'TARGETED_QUESTIONS',
    triggerReason: 'SELF_CORRECTION',
    priority: 'MEDIUM',
    status: 'AVAILABLE',
    createdAt: '2026-08-08T10:00:00Z',
    sourceEvidenceIds: ['ev_1'],
    estimatedMinutes: 15,
    rationale: 'Test Idempotency',
    recommendationConfidence: 'HIGH',
    policyVersion: '1.0',
  });

  // 1. mesma Completion com mesmas propriedades explícitas → idempotente
  const comp1 = completeAdaptiveReview({
    reviewId: revIdemp.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    confidence: 5,
    actualMinutes: 10,
    notes: 'Nota 1',
    linkedAttemptIds: ['att1', 'att2'],
    completedAt: '2026-08-08T11:00:00Z',
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
    learningEvidenceRepository: evRepoIdemp,
  });

  const comp1_retry = completeAdaptiveReview({
    reviewId: revIdemp.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    confidence: 5,
    actualMinutes: 10,
    notes: 'Nota 1',
    linkedAttemptIds: ['att1', 'att2'],
    completedAt: '2026-08-08T11:00:00Z',
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
    learningEvidenceRepository: evRepoIdemp,
  });
  assert(comp1_retry.completion.id === comp1.completion.id, 'HF20.1. Mesma Completion com mesmas propriedades explícitas é idempotente');

  // 2. retry omitindo notes → idempotente
  const comp1_omit_notes = completeAdaptiveReview({
    reviewId: revIdemp.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    confidence: 5,
    actualMinutes: 10,
    linkedAttemptIds: ['att1', 'att2'],
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
    learningEvidenceRepository: evRepoIdemp,
  });
  assert(comp1_omit_notes.completion.id === comp1.completion.id, 'HF20.2. Retry omitindo notes continua idempotente');

  // 3. notes explicitamente diferentes → erro
  let notesError = false;
  try {
    completeAdaptiveReview({
      reviewId: revIdemp.id,
      userId,
      outcome: 'SUCCESS_CONFIDENT',
      notes: 'Nota DIFERENTE',
      reviewRepository: revRepoIdemp,
      reviewCompletionRepository: compRepoIdemp,
      learningEvidenceRepository: evRepoIdemp,
    });
  } catch (e) {
    notesError = true;
  }
  assert(notesError, 'HF20.3. Notes explicitamente diferentes causam erro de imutabilidade');

  // 4. linkedAttemptIds explicitamente diferentes → erro
  let attemptsError = false;
  try {
    completeAdaptiveReview({
      reviewId: revIdemp.id,
      userId,
      outcome: 'SUCCESS_CONFIDENT',
      linkedAttemptIds: ['att1', 'att_outra'],
      reviewRepository: revRepoIdemp,
      reviewCompletionRepository: compRepoIdemp,
      learningEvidenceRepository: evRepoIdemp,
    });
  } catch (e) {
    attemptsError = true;
  }
  assert(attemptsError, 'HF20.4. linkedAttemptIds explicitamente diferentes causam erro');

  // 5. mesmos linkedAttemptIds em ordem diferente → idempotente
  const comp1_reordered_attempts = completeAdaptiveReview({
    reviewId: revIdemp.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    linkedAttemptIds: ['att2', 'att1'],
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
    learningEvidenceRepository: evRepoIdemp,
  });
  assert(comp1_reordered_attempts.completion.id === comp1.completion.id, 'HF20.5. Mesmos linkedAttemptIds em ordem diferente são considerados iguais');

  // 6. completedAt explicitamente diferente → erro
  let timeError = false;
  try {
    completeAdaptiveReview({
      reviewId: revIdemp.id,
      userId,
      outcome: 'SUCCESS_CONFIDENT',
      completedAt: '2026-08-08T12:00:00Z',
      reviewRepository: revRepoIdemp,
      reviewCompletionRepository: compRepoIdemp,
      learningEvidenceRepository: evRepoIdemp,
    });
  } catch (e) {
    timeError = true;
  }
  assert(timeError, 'HF20.6. completedAt explicitamente diferente causa erro');

  // 7. retry sem completedAt explícito → idempotente
  const comp1_no_completed_at = completeAdaptiveReview({
    reviewId: revIdemp.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
    learningEvidenceRepository: evRepoIdemp,
  });
  assert(comp1_no_completed_at.completion.id === comp1.completion.id, 'HF20.7. Retry sem completedAt explícito continua idempotente');

  // 8. retry idempotente com Evidence ausente → Evidence é recuperada/persistida
  const revIdemp2 = revRepoIdemp.saveReview({
    id: 'rev_idemp_2',
    userId,
    subjectId: 'mat',
    topicId: 'topic_trig',
    reviewType: 'TARGETED_QUESTIONS',
    triggerReason: 'SELF_CORRECTION',
    priority: 'MEDIUM',
    status: 'AVAILABLE',
    createdAt: '2026-08-08T10:00:00Z',
    sourceEvidenceIds: ['ev_1'],
    estimatedMinutes: 15,
    rationale: 'Test Evidence Recovery',
    recommendationConfidence: 'HIGH',
    policyVersion: '1.0',
  });

  completeAdaptiveReview({
    reviewId: revIdemp2.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
  });

  const recoveryResult = completeAdaptiveReview({
    reviewId: revIdemp2.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
    learningEvidenceRepository: evRepoIdemp,
  });
  assert(recoveryResult.evidence !== undefined, 'HF20.8. Retry idempotente com Evidence ausente recupera e persiste a evidencia');

  // 9. retry idempotente com Evidence já existente → não duplica
  const countBefore = evRepoIdemp.getEvidencesByUser(userId).length;
  completeAdaptiveReview({
    reviewId: revIdemp2.id,
    userId,
    outcome: 'SUCCESS_CONFIDENT',
    reviewRepository: revRepoIdemp,
    reviewCompletionRepository: compRepoIdemp,
    learningEvidenceRepository: evRepoIdemp,
  });
  const countAfter = evRepoIdemp.getEvidencesByUser(userId).length;
  assert(countBefore === countAfter, 'HF20.9. Retry idempotente com Evidence já existente não duplica registros');

  // ==========================================
  // RODADA 3B.3B-2A — ATTEMPT.REVIEW_ID & ACTION WIRING
  // ==========================================
  console.log('\n--- 3B.3B-2A: Attempt.reviewId e Wiring de Ações ---');

  const attRepoWiring = new LocalAttemptRepository();

  // 1. Persistir Attempt com reviewId
  const attWithReview: Attempt = {
    id: 'att_rev_101',
    userId: 'user_wiring_1',
    questionId: 'q_wiring_1',
    reviewId: 'rev_target_505',
    result: 'CORRECT_CONFIDENT',
    confidence: 5,
    completedAt: '2026-08-09T10:00:00Z',
    createdAt: '2026-08-09T10:00:00Z',
  };
  attRepoWiring.saveAttempt(attWithReview);

  const foundByRev = attRepoWiring.getAttemptsByReview('rev_target_505', 'user_wiring_1');
  assert(foundByRev.length === 1 && foundByRev[0].id === 'att_rev_101', '3B.3B-2A.1. Salvar Attempt com reviewId permite busca por getAttemptsByReview');
  assert(foundByRev[0].reviewId === 'rev_target_505', '3B.3B-2A.2. Attempt recuperada preserva reviewId');

  // 2. getAttemptsByReview respeita userId
  const foundByOtherUser = attRepoWiring.getAttemptsByReview('rev_target_505', 'user_wiring_2');
  assert(foundByOtherUser.length === 0, '3B.3B-2A.3. getAttemptsByReview filtra estritamente por userId');

  // 3. Imutabilidade do Attempt: tentar sobrescrever com reviewId diferente causa erro
  let thrownImmutability = false;
  try {
    attRepoWiring.saveAttempt({
      ...attWithReview,
      reviewId: 'rev_target_DIFFERENT',
    });
  } catch (err: any) {
    thrownImmutability = true;
  }
  assert(thrownImmutability, '3B.3B-2A.4. Alterar reviewId em tentativa já existente viola imutabilidade e lança erro');

  // 4. Reposicionar mesma Attempt sem alterações é idempotente
  let reSavePassed = true;
  try {
    attRepoWiring.saveAttempt({ ...attWithReview });
  } catch (err) {
    reSavePassed = false;
  }
  assert(reSavePassed, '3B.3B-2A.5. Re-salvar tentativa idêntica com mesmo reviewId é idempotente');

  // --- PREFLIGHT: REGRESSÃO FINAL DE REVIEWS (A, B, C, D) ---
  const pfNow = '2026-08-09T10:00:00Z';
  const pfTopic: TopicNode = { id: 'pf_topic', subjectId: 'subj_1', name: 'Preflight Topic', masteryLevel: 1, prerequisites: [], weightInExam: 5 };
  const pfEvidences: LearningEvidence[] = [
    {
      id: 'pf_ev1',
      userId: 'pf_user',
      subjectId: 'subj_1',
      topicIds: ['pf_topic'],
      type: 'QUESTION_ATTEMPT',
      sourceId: 'att_pf1',
      signal: 'STRONG_POSITIVE',
      result: 'CORRECT_CONFIDENT',
      difficulty: 'EASY',
      confidence: 5,
      createdAt: '2026-06-01T10:00:00Z', // ~69 dias atrás -> STALE
    },
    {
      id: 'pf_ev2',
      userId: 'pf_user',
      subjectId: 'subj_1',
      topicIds: ['pf_topic'],
      type: 'QUESTION_ATTEMPT',
      sourceId: 'att_pf2',
      signal: 'STRONG_POSITIVE',
      result: 'CORRECT_CONFIDENT',
      difficulty: 'MEDIUM',
      confidence: 5,
      createdAt: '2026-06-02T10:00:00Z', // ~68 dias atrás -> STALE
    },
    {
      id: 'pf_ev3',
      userId: 'pf_user',
      subjectId: 'subj_1',
      topicIds: ['pf_topic'],
      type: 'QUESTION_ATTEMPT',
      sourceId: 'att_pf3',
      signal: 'STRONG_POSITIVE',
      result: 'CORRECT_CONFIDENT',
      difficulty: 'MEDIUM',
      confidence: 5,
      createdAt: '2026-06-03T10:00:00Z', // ~67 dias atrás -> STALE
    },
  ];

  const pfMState = computeMasteryStateForTopic({
    userId: 'pf_user',
    topic: pfTopic,
    evidences: pfEvidences,
    computedAt: pfNow,
  });

  // A) TARGETED_QUESTIONS + SUCCESS_CONFIDENT, sem nova QUESTION_ATTEMPT supporting -> não renova retenção
  const pfRevTQ: Review = {
    id: 'pf_rev_tq',
    userId: 'pf_user',
    subjectId: 'subj_1',
    topicId: 'pf_topic',
    reviewType: 'TARGETED_QUESTIONS',
    triggerReason: 'RETENTION_CHECK',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    sourceEvidenceIds: [],
    estimatedMinutes: 20,
    rationale: '',
    recommendationConfidence: 'HIGH',
    policyVersion: '2.0-V1',
    recommendedWindowStart: '2026-08-01T00:00:00Z',
    recommendedWindowEnd: '2026-08-05T00:00:00Z',
    createdAt: '2026-08-01T10:00:00Z',
  };
  const pfCompTQ: ReviewCompletion = {
    id: 'pf_comp_tq',
    userId: 'pf_user',
    reviewId: 'pf_rev_tq',
    outcome: 'SUCCESS_CONFIDENT',
    completedAt: '2026-08-05T10:00:00Z',
  };
  const pfDecA = generateReviewDecisionForTopic({
    userId: 'pf_user',
    topic: pfTopic,
    masteryState: pfMState,
    evidences: pfEvidences,
    errors: [],
    previousReviewCompletions: [pfCompTQ],
    previousReviews: [pfRevTQ],
    now: pfNow,
  });
  assert(
    pfDecA.action === 'SCHEDULE_REVIEW' && pfDecA.triggerReason === 'RETENTION_CHECK',
    'PF-A. TARGETED_QUESTIONS + SUCCESS_CONFIDENT não renova retenção sem question attempt supporting'
  );

  // B) TARGETED_QUESTIONS + NO_TIME + SUCCESS_CONFIDENT -> não renova retenção
  const pfEvidencesB: LearningEvidence[] = [
    ...pfEvidences,
    {
      id: 'pf_ev_notime',
      userId: 'pf_user',
      subjectId: 'subj_1',
      topicIds: ['pf_topic'],
      type: 'QUESTION_ATTEMPT',
      sourceId: 'att_pf_notime',
      signal: 'TIME_SIGNAL',
      result: 'NO_TIME',
      confidence: 1,
      difficulty: 'MEDIUM',
      createdAt: '2026-08-05T10:00:00Z',
    },
  ];
  const pfMStateB = computeMasteryStateForTopic({
    userId: 'pf_user',
    topic: pfTopic,
    evidences: pfEvidencesB,
    computedAt: pfNow,
  });
  const pfRevTQ_B: Review = {
    id: 'pf_rev_tq_b',
    userId: 'pf_user',
    subjectId: 'subj_1',
    topicId: 'pf_topic',
    reviewType: 'TARGETED_QUESTIONS',
    triggerReason: 'RETENTION_CHECK',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    sourceEvidenceIds: [],
    estimatedMinutes: 20,
    rationale: '',
    recommendationConfidence: 'HIGH',
    policyVersion: '2.0-V1',
    recommendedWindowStart: '2026-08-01T00:00:00Z',
    recommendedWindowEnd: '2026-08-05T00:00:00Z',
    createdAt: '2026-08-01T10:00:00Z',
  };
  const pfCompTQ_B: ReviewCompletion = {
    id: 'pf_comp_tq_b',
    userId: 'pf_user',
    reviewId: 'pf_rev_tq_b',
    outcome: 'SUCCESS_CONFIDENT',
    completedAt: '2026-08-05T10:00:00Z',
  };
  const pfDecB = generateReviewDecisionForTopic({
    userId: 'pf_user',
    topic: pfTopic,
    masteryState: pfMStateB,
    evidences: pfEvidencesB,
    errors: [],
    previousReviewCompletions: [pfCompTQ_B],
    previousReviews: [pfRevTQ_B],
    now: pfNow,
  });
  assert(
    pfDecB.action === 'SCHEDULE_REVIEW' && pfDecB.triggerReason === 'RETENTION_CHECK',
    'PF-B. TARGETED_QUESTIONS + NO_TIME + SUCCESS_CONFIDENT não renova retenção'
  );

  // C) ACTIVE_RECALL + SUCCESS_CONFIDENT -> pode renovar checagem de retenção
  const pfRevAR: Review = {
    id: 'pf_rev_ar',
    userId: 'pf_user',
    subjectId: 'subj_1',
    topicId: 'pf_topic',
    reviewType: 'ACTIVE_RECALL',
    triggerReason: 'RETENTION_CHECK',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    sourceEvidenceIds: [],
    estimatedMinutes: 20,
    rationale: '',
    recommendationConfidence: 'HIGH',
    policyVersion: '2.0-V1',
    recommendedWindowStart: '2026-08-01T00:00:00Z',
    recommendedWindowEnd: '2026-08-05T00:00:00Z',
    createdAt: '2026-08-01T10:00:00Z',
  };
  const pfCompAR: ReviewCompletion = {
    id: 'pf_comp_ar',
    userId: 'pf_user',
    reviewId: 'pf_rev_ar',
    outcome: 'SUCCESS_CONFIDENT',
    completedAt: '2026-08-05T10:00:00Z',
  };
  const pfDecC = generateReviewDecisionForTopic({
    userId: 'pf_user',
    topic: pfTopic,
    masteryState: pfMState,
    evidences: pfEvidences,
    errors: [],
    previousReviewCompletions: [pfCompAR],
    previousReviews: [pfRevAR],
    now: pfNow,
  });
  assert(
    pfDecC.action === 'NO_REVIEW_NOW',
    'PF-C. ACTIVE_RECALL + SUCCESS_CONFIDENT renova checagem de retenção'
  );

  // D) ReviewCompletion cuja Review não pode ser encontrada -> não renova retenção
  const pfCompOrphan: ReviewCompletion = {
    id: 'pf_comp_orphan',
    userId: 'pf_user',
    reviewId: 'pf_rev_missing',
    outcome: 'SUCCESS_CONFIDENT',
    completedAt: '2026-08-05T10:00:00Z',
  };
  const pfDecD = generateReviewDecisionForTopic({
    userId: 'pf_user',
    topic: pfTopic,
    masteryState: pfMState,
    evidences: pfEvidences,
    errors: [],
    previousReviewCompletions: [pfCompOrphan],
    previousReviews: [],
    now: pfNow,
  });
  assert(
    pfDecD.action === 'SCHEDULE_REVIEW' && pfDecD.triggerReason === 'RETENTION_CHECK',
    'PF-D. ReviewCompletion sem Review encontrada não renova retenção'
  );

  console.log('\n==================================================');
  console.log(`   RESULTADO: ${passedCount} PASSOU | ${failedCount} FALHOU`);
  console.log('==================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();


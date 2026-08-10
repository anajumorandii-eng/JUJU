import { 
  computeMasteryStateForTopic, 
  computeAllMasteryStates, 
  calculateMasteryConfidence, 
  calculateMasteryTrend,
  classifyMasterySource,
  deriveSourceLearningOutcome
} from './masteryEngine';
import { LocalQuestionRepository, LocalAttemptRepository, LocalLearningEvidenceRepository } from './questionRepository';
import { LearningEvidence, TopicNode, Question, Attempt } from '../types';

export function runMasteryEngineTests() {
  console.log('==================================================');
  console.log('   EXECUTANDO TESTES DO MASTERY ENGINE — RODADA 3A.1 ');
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

  const dummyTopic: TopicNode = {
    id: 'mat_geo_plana',
    subjectId: 'mat',
    name: 'Geometria Plana',
    masteryLevel: 5,
    prerequisites: [],
    weightInExam: 5,
  };

  const dummyTopic2: TopicNode = {
    id: 'mat_trigo',
    subjectId: 'mat',
    name: 'Trigonometria',
    masteryLevel: 5,
    prerequisites: [],
    weightInExam: 5,
  };

  const userId = 'usr_1';

  // 1. Sem evidência -> UNKNOWN
  const state1 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [],
  });
  assert(state1.status === 'UNKNOWN', '1. Sem evidência gera status UNKNOWN');
  assert(state1.estimatedLevel === null, '1. Sem evidência gera nível estimado null');

  // 2. Uma STRONG_POSITIVE -> sem nível numérico
  const singleEv: LearningEvidence = {
    id: 'ev_1_primary',
    userId,
    subjectId: 'mat',
    topicIds: ['mat_geo_plana'],
    type: 'QUESTION_ATTEMPT',
    sourceId: 'att_1',
    createdAt: '2026-08-08T10:00:00Z',
    signal: 'STRONG_POSITIVE',
    result: 'CORRECT_CONFIDENT',
    confidence: 5,
    difficulty: 'EASY',
  };
  const state2 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [singleEv] });
  assert(state2.status === 'EMERGING' && state2.estimatedLevel === null, '2. Uma fonte STRONG_POSITIVE gera EMERGING sem nível numérico');

  // 3. 2 EASY independentes -> nível 6
  const evEasy1: LearningEvidence = { ...singleEv, id: 'ev_e1', sourceId: 'att_e1', difficulty: 'EASY' };
  const evEasy2: LearningEvidence = { ...singleEv, id: 'ev_e2', sourceId: 'att_e2', difficulty: 'EASY', createdAt: '2026-08-08T11:00:00Z' };
  const state3 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2] });
  assert(state3.estimatedLevel === 6 && state3.status === 'ESTIMATED', '3. 2 EASY independentes gera nível 6 ESTIMATED');

  // 4. 2 MEDIUM independentes -> nível 7
  const evMed1: LearningEvidence = { ...singleEv, id: 'ev_m1', sourceId: 'att_m1', difficulty: 'MEDIUM' };
  const evMed2: LearningEvidence = { ...singleEv, id: 'ev_m2', sourceId: 'att_m2', difficulty: 'MEDIUM', createdAt: '2026-08-08T11:00:00Z' };
  const state4 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evMed1, evMed2] });
  assert(state4.estimatedLevel === 7, '4. 2 MEDIUM independentes gera nível 7');

  // 5. 2 HARD independentes -> nível 8
  const evHard1: LearningEvidence = { ...singleEv, id: 'ev_h1', sourceId: 'att_h1', difficulty: 'HARD' };
  const evHard2: LearningEvidence = { ...singleEv, id: 'ev_h2', sourceId: 'att_h2', difficulty: 'HARD', createdAt: '2026-08-08T11:00:00Z' };
  const state5 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evHard1, evHard2] });
  assert(state5.estimatedLevel === 8, '5. 2 HARD independentes gera nível 8');

  // 6. 1 HARD nunca gera nível 8
  const state6 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evHard1] });
  assert(state6.estimatedLevel !== 8, '6. 1 HARD isolada nunca gera nível 8');

  // 7. níveis 9 e 10 nunca são gerados por QUESTION_ATTEMPT
  assert(state5.estimatedLevel !== 9 && state5.estimatedLevel !== 10, '7. Níveis 9 e 10 nunca são gerados por QUESTION_ATTEMPT');

  // 8. duas LearningEvidence da mesma Attempt contam como uma fonte independente
  const evSameAtt1: LearningEvidence = { ...singleEv, id: 'ev_same_1', sourceId: 'att_same', difficulty: 'EASY' };
  const evSameAtt2: LearningEvidence = { ...singleEv, id: 'ev_same_2', sourceId: 'att_same', difficulty: 'EASY', signal: 'STRONG_POSITIVE' };
  const state8 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evSameAtt1, evSameAtt2] });
  assert(state8.independentSourceCount === 1 && state8.estimatedLevel === null, '8. Duas evidências da mesma Attempt contam como apenas 1 fonte independente');

  // 9. FRAGILE_POSITIVE isolado não sustenta nível
  const evFrag1: LearningEvidence = { ...singleEv, id: 'ev_f1', sourceId: 'att_f1', signal: 'FRAGILE_POSITIVE', difficulty: 'HARD' };
  const evFrag2: LearningEvidence = { ...singleEv, id: 'ev_f2', sourceId: 'att_f2', signal: 'FRAGILE_POSITIVE', difficulty: 'HARD' };
  const state9 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evFrag1, evFrag2] });
  assert(state9.estimatedLevel === null, '9. FRAGILE_POSITIVE isolado não sustenta nível numérico');

  // 10. SELF_CORRECTION não sustenta nível
  const evSelfCorr: LearningEvidence = { ...singleEv, id: 'ev_sc1', sourceId: 'att_sc1', signal: 'SELF_CORRECTION', difficulty: 'HARD' };
  const state10 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evSelfCorr] });
  assert(state10.estimatedLevel === null, '10. SELF_CORRECTION não sustenta nível numérico');

  // 11. POST_SOLUTION não sustenta nível
  const evPostSol: LearningEvidence = { ...singleEv, id: 'ev_ps1', sourceId: 'att_ps1', signal: 'POST_SOLUTION', difficulty: 'HARD' };
  const state11 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evPostSol] });
  assert(state11.estimatedLevel === null, '11. POST_SOLUTION não sustenta nível numérico');

  // 12. TIME_SIGNAL não sustenta nível
  const evTime1: LearningEvidence = { ...singleEv, id: 'ev_t1', sourceId: 'att_t1', signal: 'TIME_SIGNAL' };
  const state12 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evTime1] });
  assert(state12.estimatedLevel === null, '12. TIME_SIGNAL não sustenta nível numérico');

  // 13. UNKNOWN não sustenta nível
  const evUnk: LearningEvidence = { ...singleEv, id: 'ev_u1', sourceId: 'att_u1', signal: 'UNKNOWN' };
  const state13 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evUnk] });
  assert(state13.estimatedLevel === null, '13. UNKNOWN não sustenta nível numérico');

  // 14. 2 STRONG_POSITIVE + 3 TIME_SIGNAL não gera HIGH
  const evTime2: LearningEvidence = { ...singleEv, id: 'ev_t2', sourceId: 'att_t2', signal: 'TIME_SIGNAL' };
  const evTime3: LearningEvidence = { ...singleEv, id: 'ev_t3', sourceId: 'att_t3', signal: 'TIME_SIGNAL' };
  const state14 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2, evTime1, evTime2, evTime3] });
  assert(state14.confidence !== 'HIGH', '14. 2 STRONG_POSITIVE + 3 TIME_SIGNAL NÃO infla para confiança HIGH');

  // 15. 2 STRONG_POSITIVE + 5 POST_SOLUTION não gera HIGH
  const evsPS = [1, 2, 3, 4, 5].map(i => ({ ...singleEv, id: `ev_ps_m${i}`, sourceId: `att_ps_m${i}`, signal: 'POST_SOLUTION' as const }));
  const state15 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2, ...evsPS] });
  assert(state15.confidence !== 'HIGH', '15. 2 STRONG_POSITIVE + 5 POST_SOLUTION NÃO infla para confiança HIGH');

  // 16. TIME_SIGNAL não aumenta confidence
  assert(state14.confidence === 'MODERATE' || state14.confidence === 'LOW', '16. TIME_SIGNAL não aumenta confidence');

  // 17. UNKNOWN não aumenta confidence
  const state17 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2, evUnk] });
  assert(state17.confidence !== 'HIGH', '17. UNKNOWN não aumenta confidence');

  // 18. SELF_CORRECTION não aumenta confidence como acerto independente
  const state18 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2, evSelfCorr] });
  assert(state18.confidence !== 'HIGH', '18. SELF_CORRECTION não aumenta confidence como acerto de primeira');

  // 19. HIGH exige fontes reais que sustentem nível (>=5 fontes STRONG_POSITIVE independentes)
  const evsStrong5 = [1, 2, 3, 4, 5].map(i => ({
    ...singleEv,
    id: `ev_str_${i}`,
    sourceId: `att_str_${i}`,
    createdAt: `2026-08-0${i}T10:00:00Z`,
    difficulty: 'EASY' as const,
  }));
  const state19 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: evsStrong5 });
  assert(state19.confidence === 'HIGH', '19. HIGH é atingido com 5 fontes independentes com acerto seguro');

  // 20. quantidade bruta de LearningEvidence não determina confidence
  const state20 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evSameAtt1, evSameAtt2, evTime1, evTime2] });
  assert(state20.confidence === 'LOW', '20. Quantidade bruta de eventos não infla confidence');

  // 21. somente 2 NEGATIVE_SIGNAL não gera FRAGILE
  const evErr1: LearningEvidence = { ...singleEv, id: 'ev_err1', sourceId: 'att_err1', signal: 'NEGATIVE_SIGNAL' };
  const evErr2: LearningEvidence = { ...singleEv, id: 'ev_err2', sourceId: 'att_err2', signal: 'NEGATIVE_SIGNAL' };
  const state21 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evErr1, evErr2] });
  assert(state21.status === 'INSUFFICIENT_EVIDENCE', '21. Somente erros NÃO gera status FRAGILE, gera INSUFFICIENT_EVIDENCE');

  // 22. somente erros mantém estimatedLevel null
  assert(state21.estimatedLevel === null, '22. Somente erros mantém estimatedLevel null');

  // 23. positivo frágil pode gerar EMERGING/FRAGILE
  const state23 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evFrag1] });
  assert(state23.status === 'EMERGING' || state23.status === 'FRAGILE', '23. Positivo frágil gera EMERGING ou FRAGILE');

  // 24. evidências positivas + contradições podem gerar CONFLICTED
  const state24 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2, evErr1, evErr2] });
  assert(state24.status === 'CONFLICTED', '24. Acertos seguros + contradições gera CONFLICTED');

  // 25. CONFLICTED sempre possui estimatedLevel null
  assert(state24.estimatedLevel === null, '25. CONFLICTED sempre possui estimatedLevel null');

  // 26. somente TIME_SIGNAL -> trend UNKNOWN
  const trend26 = calculateMasteryTrend([evTime1, evTime2, evTime3]);
  assert(trend26 === 'UNKNOWN', '26. Somente TIME_SIGNAL gera trend UNKNOWN');

  // 27. somente UNKNOWN -> trend UNKNOWN
  const trend27 = calculateMasteryTrend([evUnk]);
  assert(trend27 === 'UNKNOWN', '27. Somente UNKNOWN gera trend UNKNOWN');

  // 28. duas fontes informativas -> ainda trend UNKNOWN
  const trend28 = calculateMasteryTrend([evEasy1, evEasy2]);
  assert(trend28 === 'UNKNOWN', '28. Apenas duas fontes informativas gera trend UNKNOWN');

  // 29. erro + SELF_CORRECTION da mesma Attempt conta como uma unidade temporal
  const evErrSelf1: LearningEvidence = { ...singleEv, id: 'ev_es1_a', sourceId: 'att_es1', signal: 'NEGATIVE_SIGNAL', createdAt: '2026-08-01T10:00:00Z' };
  const evErrSelf2: LearningEvidence = { ...singleEv, id: 'ev_es1_b', sourceId: 'att_es1', signal: 'SELF_CORRECTION', createdAt: '2026-08-01T10:02:00Z' };
  const state29 = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evErrSelf1, evErrSelf2] });
  assert(state29.independentSourceCount === 1, '29. Erro e autocorreção da mesma tentativa contam como 1 fonte');

  // 30. sequência realmente melhorando produz IMPROVING
  const evSeq1: LearningEvidence = { ...singleEv, id: 's1', sourceId: 'att_s1', signal: 'NEGATIVE_SIGNAL', createdAt: '2026-08-01T10:00:00Z' };
  const evSeq2: LearningEvidence = { ...singleEv, id: 's2', sourceId: 'att_s2', signal: 'NEGATIVE_SIGNAL', createdAt: '2026-08-02T10:00:00Z' };
  const evSeq3: LearningEvidence = { ...singleEv, id: 's3', sourceId: 'att_s3', signal: 'STRONG_POSITIVE', createdAt: '2026-08-03T10:00:00Z' };
  const evSeq4: LearningEvidence = { ...singleEv, id: 's4', sourceId: 'att_s4', signal: 'STRONG_POSITIVE', createdAt: '2026-08-04T10:00:00Z' };
  const trend30 = calculateMasteryTrend([evSeq1, evSeq2, evSeq3, evSeq4]);
  assert(trend30 === 'IMPROVING', '30. Sequência de melhora cronológica gera trend IMPROVING');

  // 31. sequência realmente piorando produz DECLINING
  const evDecl1: LearningEvidence = { ...singleEv, id: 'd1', sourceId: 'att_d1', signal: 'STRONG_POSITIVE', createdAt: '2026-08-01T10:00:00Z' };
  const evDecl2: LearningEvidence = { ...singleEv, id: 'd2', sourceId: 'att_d2', signal: 'STRONG_POSITIVE', createdAt: '2026-08-02T10:00:00Z' };
  const evDecl3: LearningEvidence = { ...singleEv, id: 'd3', sourceId: 'att_d3', signal: 'NEGATIVE_SIGNAL', createdAt: '2026-08-03T10:00:00Z' };
  const evDecl4: LearningEvidence = { ...singleEv, id: 'd4', sourceId: 'att_d4', signal: 'NEGATIVE_SIGNAL', createdAt: '2026-08-04T10:00:00Z' };
  const trend31 = calculateMasteryTrend([evDecl1, evDecl2, evDecl3, evDecl4]);
  assert(trend31 === 'DECLINING', '31. Sequência de piora cronológica gera trend DECLINING');

  // 32. ausência de mudança produz STABLE com dados suficientes
  const trend32 = calculateMasteryTrend([evSeq3, evSeq4, evEasy1, evEasy2]);
  assert(trend32 === 'STABLE', '32. Desempenho positivo constante gera trend STABLE');

  // 33. evidência multitópico aparece nos dois MasteryStates
  const evMulti: LearningEvidence = { ...singleEv, id: 'ev_multi', sourceId: 'att_multi', topicIds: ['mat_geo_plana', 'mat_trigo'] };
  const allStates33 = computeAllMasteryStates({ userId, topics: [dummyTopic, dummyTopic2], evidences: [evMulti] });
  assert(
    allStates33['mat_geo_plana'].evidenceCount === 1 && allStates33['mat_trigo'].evidenceCount === 1,
    '33. Evidência multitópico é processada para ambos os tópicos'
  );

  // 34. adiciona uncertaintyReason para multitópico
  assert(
    allStates33['mat_geo_plana'].uncertaintyReasons.some(r => r.includes('múltiplos tópicos')),
    '34. Evidência multitópico adiciona razão de incerteza apropriada'
  );

  // 35. não duplica source dentro do mesmo tópico
  assert(allStates33['mat_geo_plana'].independentSourceCount === 1, '35. Não duplica contagem de fontes por tópico');

  // 36. Question idêntica é idempotente
  const qRepo = new LocalQuestionRepository();
  const q1: Question = { id: 'q_test_immut', userId: 'u1', title: 'T1', statement: 'S1', subjectId: 'mat', topicIds: ['mat_geo_plana'], sourceType: 'MANUAL', createdAt: '2026-08-08T00:00:00Z' };
  qRepo.saveQuestion(q1);
  const qSaved1 = qRepo.saveQuestion({ ...q1 });
  assert(qSaved1.id === 'q_test_immut', '36. Re-salvar Question idêntica é idempotente');

  // 37. Question mesmo ID + sourceType diferente gera erro
  let err37 = false;
  try {
    qRepo.saveQuestion({ ...q1, sourceType: 'SIMULATED' });
  } catch (_e) {
    err37 = true;
  }
  assert(err37, '37. Tentar alterar sourceType em Question salva lança erro de imutabilidade');

  // 38. Question mesmo ID + exam diferente gera erro
  let err38 = false;
  try {
    qRepo.saveQuestion({ ...q1, exam: 'ENEM' });
  } catch (_e) {
    err38 = true;
  }
  assert(err38, '38. Tentar alterar exam em Question salva lança erro de imutabilidade');

  // 39. Attempt idêntica é idempotente
  const aRepo = new LocalAttemptRepository();
  const att1: Attempt = { id: 'att_immut_1', userId: 'u1', questionId: 'q_test_immut', result: 'CORRECT_CONFIDENT', confidence: 5, completedAt: '2026-08-08T00:00:00Z', createdAt: '2026-08-08T00:00:00Z' };
  aRepo.saveAttempt(att1);
  const attSaved1 = aRepo.saveAttempt({ ...att1 });
  assert(attSaved1.id === 'att_immut_1', '39. Re-salvar Attempt idêntica é idempotente');

  // 40. Attempt mesmo ID + confidence diferente gera erro
  let err40 = false;
  try {
    aRepo.saveAttempt({ ...att1, confidence: 2 });
  } catch (_e) {
    err40 = true;
  }
  assert(err40, '40. Tentar alterar confiança de Attempt salva lança erro de imutabilidade');

  // 41. reasoning é alterado apenas via updateAttemptReasoning
  const attUpdated = aRepo.updateAttemptReasoning('att_immut_1', 'u1', 'Raciocínio atualizado');
  assert(attUpdated !== null && attUpdated.reasoningText === 'Raciocínio atualizado', '41. ReasoningText é atualizado com sucesso via updateAttemptReasoning');

  // 42. Evidence idêntica é idempotente
  const evRepo = new LocalLearningEvidenceRepository();
  const ev1: LearningEvidence = { id: 'ev_immut_1', userId: 'u1', subjectId: 'mat', topicIds: ['mat_geo_plana'], type: 'QUESTION_ATTEMPT', sourceId: 'att_immut_1', signal: 'STRONG_POSITIVE', result: 'CORRECT_CONFIDENT', confidence: 5, createdAt: '2026-08-08T00:00:00Z' };
  evRepo.saveEvidence(ev1);
  const evSaved1 = evRepo.saveEvidence({ ...ev1 });
  assert(evSaved1.id === 'ev_immut_1', '42. Re-salvar Evidence idêntica é idempotente');

  // 43. Evidence mesmo ID + metadata diferente gera erro
  let err43 = false;
  try {
    evRepo.saveEvidence({ ...ev1, metadata: { stage: 'TEST_CHANGE' } });
  } catch (_e) {
    err43 = true;
  }
  assert(err43, '43. Tentar alterar metadata de Evidence salva lança erro de imutabilidade');

  // 44. Evidence mesmo ID + signal diferente gera erro
  let err44 = false;
  try {
    evRepo.saveEvidence({ ...ev1, signal: 'NEGATIVE_SIGNAL' });
  } catch (_e) {
    err44 = true;
  }
  assert(err44, '44. Tentar alterar signal de Evidence salva lança erro de imutabilidade');

  // ==================================================
  // RODADA 3A.2 — TESTES DE CLASSIFICAÇÃO DE SOURCE, STATUS, TREND, CONFIDENCE E DETERMINISMO
  // ==================================================

  // 3A.2 - 1. NEGATIVE sozinho -> CONTRADICTING
  const c1 = classifyMasterySource([{ ...singleEv, signal: 'NEGATIVE_SIGNAL' }]);
  assert(c1 === 'CONTRADICTING', '3A.2-1. NEGATIVE sozinho -> CONTRADICTING');

  // 3A.2 - 2. CONFIDENCE_DIVERGENCE sozinho -> CONTRADICTING
  const c2 = classifyMasterySource([{ ...singleEv, signal: 'CONFIDENCE_DIVERGENCE' }]);
  assert(c2 === 'CONTRADICTING', '3A.2-2. CONFIDENCE_DIVERGENCE sozinho -> CONTRADICTING');

  // 3A.2 - 3. NEGATIVE + SELF_CORRECTION mesma source -> SELF_CORRECTED
  const c3 = classifyMasterySource([
    { ...singleEv, signal: 'NEGATIVE_SIGNAL' },
    { ...singleEv, signal: 'SELF_CORRECTION' }
  ]);
  assert(c3 === 'SELF_CORRECTED', '3A.2-3. NEGATIVE + SELF_CORRECTION mesma source -> SELF_CORRECTED');

  // 3A.2 - 4. CONFIDENCE_DIVERGENCE + SELF_CORRECTION -> SELF_CORRECTED
  const c4 = classifyMasterySource([
    { ...singleEv, signal: 'CONFIDENCE_DIVERGENCE' },
    { ...singleEv, signal: 'SELF_CORRECTION' }
  ]);
  assert(c4 === 'SELF_CORRECTED', '3A.2-4. CONFIDENCE_DIVERGENCE + SELF_CORRECTION -> SELF_CORRECTED');

  // 3A.2 - 5. NEGATIVE + POST_SOLUTION -> POST_SOLUTION_ASSISTED
  const c5 = classifyMasterySource([
    { ...singleEv, signal: 'NEGATIVE_SIGNAL' },
    { ...singleEv, signal: 'POST_SOLUTION' }
  ]);
  assert(c5 === 'POST_SOLUTION_ASSISTED', '3A.2-5. NEGATIVE + POST_SOLUTION -> POST_SOLUTION_ASSISTED');

  // 3A.2 - 6. STRONG_POSITIVE -> SUPPORTING
  const c6 = classifyMasterySource([{ ...singleEv, signal: 'STRONG_POSITIVE' }]);
  assert(c6 === 'SUPPORTING', '3A.2-6. STRONG_POSITIVE -> SUPPORTING');

  // 3A.2 - 7. FRAGILE_POSITIVE -> FRAGILE
  const c7 = classifyMasterySource([{ ...singleEv, signal: 'FRAGILE_POSITIVE' }]);
  assert(c7 === 'FRAGILE', '3A.2-7. FRAGILE_POSITIVE -> FRAGILE');

  // 3A.2 - 8. TIME_SIGNAL -> NON_MASTERY
  const c8 = classifyMasterySource([{ ...singleEv, signal: 'TIME_SIGNAL' }]);
  assert(c8 === 'NON_MASTERY', '3A.2-8. TIME_SIGNAL -> NON_MASTERY');

  // 3A.2 - 9. UNKNOWN -> NON_MASTERY
  const c9 = classifyMasterySource([{ ...singleEv, signal: 'UNKNOWN' }]);
  assert(c9 === 'NON_MASTERY', '3A.2-9. UNKNOWN -> NON_MASTERY');

  // 3A.2 - 10. 2 SUPPORTING + 2 SELF_CORRECTED não vira CONFLICTED
  const evSC1: LearningEvidence = { ...singleEv, id: 'ev_sc_a1', sourceId: 'att_sc_a1', signal: 'NEGATIVE_SIGNAL' };
  const evSC1b: LearningEvidence = { ...singleEv, id: 'ev_sc_a1b', sourceId: 'att_sc_a1', signal: 'SELF_CORRECTION' };
  const evSC2: LearningEvidence = { ...singleEv, id: 'ev_sc_a2', sourceId: 'att_sc_a2', signal: 'NEGATIVE_SIGNAL' };
  const evSC2b: LearningEvidence = { ...singleEv, id: 'ev_sc_a2b', sourceId: 'att_sc_a2', signal: 'SELF_CORRECTION' };
  const st10 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [evEasy1, evEasy2, evSC1, evSC1b, evSC2, evSC2b]
  });
  assert(st10.status !== 'CONFLICTED', '3A.2-10. 2 SUPPORTING + 2 SELF_CORRECTED não vira CONFLICTED apenas pelas autocorreções');

  // 3A.2 - 11. 2 SUPPORTING + 2 POST_SOLUTION_ASSISTED não trata assisted como contradição pura
  const evPSA1: LearningEvidence = { ...singleEv, id: 'ev_psa1', sourceId: 'att_psa1', signal: 'NEGATIVE_SIGNAL' };
  const evPSA1b: LearningEvidence = { ...singleEv, id: 'ev_psa1b', sourceId: 'att_psa1', signal: 'POST_SOLUTION' };
  const evPSA2: LearningEvidence = { ...singleEv, id: 'ev_psa2', sourceId: 'att_psa2', signal: 'NEGATIVE_SIGNAL' };
  const evPSA2b: LearningEvidence = { ...singleEv, id: 'ev_psa2b', sourceId: 'att_psa2', signal: 'POST_SOLUTION' };
  const st11 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [evEasy1, evEasy2, evPSA1, evPSA1b, evPSA2, evPSA2b]
  });
  assert(st11.status !== 'CONFLICTED', '3A.2-11. 2 SUPPORTING + 2 POST_SOLUTION_ASSISTED não trata assisted como contradição pura');

  // 3A.2 - 12. SELF_CORRECTED não aumenta estimatedLevel
  const st12 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [evEasy1, evSC1, evSC1b, evSC2, evSC2b]
  });
  assert(st12.estimatedLevel === null, '3A.2-12. SELF_CORRECTED não aumenta estimatedLevel');

  // 3A.2 - 13. POST_SOLUTION_ASSISTED não aumenta estimatedLevel
  const st13 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [evEasy1, evPSA1, evPSA1b, evPSA2, evPSA2b]
  });
  assert(st13.estimatedLevel === null, '3A.2-13. POST_SOLUTION_ASSISTED não aumenta estimatedLevel');

  // 3A.2 - 14. erro + self-correction da mesma source não deriva NEGATIVE puro
  const outcome14 = deriveSourceLearningOutcome([evSC1, evSC1b]);
  assert(outcome14 === 'ASSISTED', '3A.2-14. erro + self-correction da mesma source deriva ASSISTED, não NEGATIVE puro');

  // 3A.2 - 15. erro sem recuperação continua NEGATIVE
  const outcome15 = deriveSourceLearningOutcome([evErr1]);
  assert(outcome15 === 'NEGATIVE', '3A.2-15. erro sem recuperação continua NEGATIVE');

  // 3A.2 - 16. somente TIME/UNKNOWN continua UNKNOWN
  const tr16 = calculateMasteryTrend([evTime1, evUnk]);
  assert(tr16 === 'UNKNOWN', '3A.2-16. somente TIME/UNKNOWN continua UNKNOWN');

  // 3A.2 - 17. sequência de assistidas não é tratada como forte melhora independente
  const evSeqAss1: LearningEvidence = { ...singleEv, id: 'sa1', sourceId: 'att_sa1', signal: 'NEGATIVE_SIGNAL', createdAt: '2026-08-01T10:00:00Z' };
  const evSeqAss2: LearningEvidence = { ...singleEv, id: 'sa2', sourceId: 'att_sa2', signal: 'POST_SOLUTION', createdAt: '2026-08-02T10:00:00Z' };
  const evSeqAss3: LearningEvidence = { ...singleEv, id: 'sa3', sourceId: 'att_sa3', signal: 'POST_SOLUTION', createdAt: '2026-08-03T10:00:00Z' };
  const tr17 = calculateMasteryTrend([evSeqAss1, evSeqAss2, evSeqAss3]);
  assert(tr17 !== 'IMPROVING', '3A.2-17. sequência de assistidas não é tratada como forte melhora independente');

  // 3A.2 - 18. 5 SUPPORTING no mesmo dia + TIME em outro dia != HIGH
  const evs5SameDay = [1, 2, 3, 4, 5].map(i => ({
    ...singleEv,
    id: `ev_sd_${i}`,
    sourceId: `att_sd_${i}`,
    createdAt: '2026-08-01T10:00:00Z',
    signal: 'STRONG_POSITIVE' as const,
    difficulty: 'EASY' as const,
  }));
  const evTimeNextDay: LearningEvidence = {
    ...singleEv,
    id: 'ev_t_nd',
    sourceId: 'att_t_nd',
    createdAt: '2026-08-02T10:00:00Z',
    signal: 'TIME_SIGNAL',
  };
  const st18 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [...evs5SameDay, evTimeNextDay]
  });
  assert(st18.confidence !== 'HIGH', '3A.2-18. 5 SUPPORTING no mesmo dia + TIME em outro dia != HIGH');

  // 3A.2 - 19. 5 SUPPORTING no mesmo dia + UNKNOWN em outro dia != HIGH
  const evUnkNextDay: LearningEvidence = {
    ...singleEv,
    id: 'ev_u_nd',
    sourceId: 'att_u_nd',
    createdAt: '2026-08-02T10:00:00Z',
    signal: 'UNKNOWN',
  };
  const st19 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [...evs5SameDay, evUnkNextDay]
  });
  assert(st19.confidence !== 'HIGH', '3A.2-19. 5 SUPPORTING no mesmo dia + UNKNOWN em outro dia != HIGH');

  // 3A.2 - 20. 5 SUPPORTING distribuídas em vários momentos pode atingir HIGH
  const st20 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: evsStrong5
  });
  assert(st20.confidence === 'HIGH', '3A.2-20. 5 SUPPORTING distribuídas em vários momentos atinge HIGH');

  // 3A.2 - 21. POST_SOLUTION não fornece diversidade temporal para HIGH
  const evPSNextDay: LearningEvidence = {
    ...singleEv,
    id: 'ev_ps_nd',
    sourceId: 'att_ps_nd',
    createdAt: '2026-08-02T10:00:00Z',
    signal: 'POST_SOLUTION',
  };
  const st21 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [...evs5SameDay, evPSNextDay]
  });
  assert(st21.confidence !== 'HIGH', '3A.2-21. POST_SOLUTION não fornece diversidade temporal para HIGH');

  // 3A.2 - 22. SELF_CORRECTION não fornece diversidade temporal para HIGH
  const evSCNextDay: LearningEvidence = {
    ...singleEv,
    id: 'ev_sc_nd',
    sourceId: 'att_sc_nd',
    createdAt: '2026-08-02T10:00:00Z',
    signal: 'SELF_CORRECTION',
  };
  const st22 = computeMasteryStateForTopic({
    userId,
    topic: dummyTopic,
    evidences: [...evs5SameDay, evSCNextDay]
  });
  assert(st22.confidence !== 'HIGH', '3A.2-22. SELF_CORRECTION não fornece diversidade temporal para HIGH');

  // 3A.2 - 23. mesmo input em computeMasteryStateForTopic produz saída profundamente igual (função pura determinística)
  const runA = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2] });
  const runB = computeMasteryStateForTopic({ userId, topic: dummyTopic, evidences: [evEasy1, evEasy2] });
  assert(JSON.stringify(runA) === JSON.stringify(runB), '3A.2-23. Mesmo input produz saída determinística e profundamente igual');

  console.log('\n==================================================');
  console.log(`   RESULTADO: ${passedCount} PASSOU | ${failedCount} FALHOU`);
  console.log('==================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
  return failedCount === 0;
}

// Execute tests on script execution
runMasteryEngineTests();

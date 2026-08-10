import { TaskItem } from '../types';
import { RankedEfficiencyCandidate } from './efficiencyEngineV2';
import { resolveEfficiencyAction } from './efficiencyActionResolver';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

export function runTests() {
  console.log('==================================================');
  console.log('   EXECUTANDO TESTES DO EFFICIENCY ACTION RESOLVER');
  console.log('==================================================');

  const baseTaskPending: TaskItem = {
    id: 't_real_101',
    subjectId: 'subj_math',
    topicId: 'top_logarithm',
    title: 'Resolver Exercícios de Logaritmo',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: 'Original rationale',
    urgency: 7,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };

  const taskCandidateRanked: RankedEfficiencyCandidate = {
    candidate: {
      id: 'task:t_real_101',
      sourceType: 'TASK',
      sourceId: 't_real_101',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Resolver Exercícios de Logaritmo',
      durationMinutes: 15,
      energyRequired: 'medium',
      isCriticalTask: false,
      taskCategory: 'questoes',
      taskUrgency: 7,
      taskImpact: 8,
    },
    decision: 'FAZER',
    internalScore: 85.0,
    factorBreakdown: {
      learningNeed: 0.8,
      objectiveRelevance: 0.8,
      urgency: 0.7,
      reviewNeed: 0.0,
      errorSignal: 0.0,
      timeFit: 1.0,
      energyFit: 1.0,
      prerequisiteReadiness: 1.0,
      obligationSignal: 0.7,
      opportunityCost: 0.0,
    },
    reasons: ['Fits available time'],
    uncertainties: [],
    reasonCodes: ['FITS_AVAILABLE_TIME'],
    rationale: 'Ação recomendada',
  };

  const reviewCandidateRanked: RankedEfficiencyCandidate = {
    candidate: {
      id: 'review:rev_202',
      sourceType: 'REVIEW',
      sourceId: 'rev_202',
      subjectId: 'subj_math',
      topicId: 'top_logarithm',
      title: 'Revisão de Logaritmos',
      durationMinutes: 10,
      energyRequired: 'medium',
      reviewPriority: 'HIGH',
    },
    decision: 'FAZER',
    internalScore: 88.0,
    factorBreakdown: {
      learningNeed: 0.9,
      objectiveRelevance: 0.8,
      urgency: 0.9,
      reviewNeed: 0.85,
      errorSignal: 0.0,
      timeFit: 1.0,
      energyFit: 1.0,
      prerequisiteReadiness: 1.0,
      obligationSignal: 0.8,
      opportunityCost: 0.0,
    },
    reasons: ['High priority review'],
    uncertainties: [],
    reasonCodes: ['AVAILABLE_EVIDENCE_BASED_REVIEW'],
    rationale: 'Revisão recomendada',
  };

  // A & B) TASK candidate resolve sourceId para Task real, sem usar candidate.id
  const resA = resolveEfficiencyAction(taskCandidateRanked, [baseTaskPending], 30);
  assert(
    resA.type === 'START_TASK' && resA.task.id === 't_real_101',
    'A & B. TASK candidate resolve sourceId "t_real_101" para a Task real e não usa "task:t_real_101"'
  );

  // C) Task pending pode iniciar
  const resC = resolveEfficiencyAction(taskCandidateRanked, [{ ...baseTaskPending, status: 'pending' }], 30);
  assert(
    resC.type === 'START_TASK' && resC.task.status === 'pending',
    'C. Task com status pending pode ser iniciada com sucesso'
  );

  // D) Task in_progress pode iniciar
  const resD = resolveEfficiencyAction(taskCandidateRanked, [{ ...baseTaskPending, status: 'in_progress' }], 30);
  assert(
    resD.type === 'START_TASK' && resD.task.status === 'in_progress',
    'D. Task com status in_progress pode ser iniciada com sucesso'
  );

  // E) Task completed -> BLOCKED
  const resE = resolveEfficiencyAction(taskCandidateRanked, [{ ...baseTaskPending, status: 'completed' }], 30);
  assert(
    resE.type === 'BLOCKED' && resE.reason.includes('A tarefa mudou'),
    'E. Task com status completed resulta em BLOCKED com mensagem explicativa'
  );

  // F) Task abandoned -> BLOCKED
  const resF = resolveEfficiencyAction(taskCandidateRanked, [{ ...baseTaskPending, status: 'abandoned' }], 30);
  assert(
    resF.type === 'BLOCKED' && resF.reason.includes('A tarefa mudou'),
    'F. Task com status abandoned resulta em BLOCKED'
  );

  // G) Task ausente -> BLOCKED
  const resG = resolveEfficiencyAction(taskCandidateRanked, [], 30); // Empty tasks array
  assert(
    resG.type === 'BLOCKED' && resG.reason.includes('A tarefa mudou desde que a recomendação foi calculada'),
    'G. Task ausente da coleção de tarefas resulta em BLOCKED'
  );

  // H) Candidate maior que availableMinutes -> BLOCKED
  const resH = resolveEfficiencyAction(taskCandidateRanked, [baseTaskPending], 10); // 15 min > 10 min
  assert(
    resH.type === 'BLOCKED' && resH.reason.includes('não cabe no tempo que você informou'),
    'H. Candidata com duração (15 min) maior que selectedMinutes (10 min) resulta em BLOCKED'
  );

  // I) REVIEW candidate -> OPEN_REVIEW com sourceId correto
  const resI = resolveEfficiencyAction(reviewCandidateRanked, [], 30);
  assert(
    resI.type === 'OPEN_REVIEW' && resI.reviewId === 'rev_202',
    'I. REVIEW candidate resulta em OPEN_REVIEW com reviewId "rev_202"'
  );

  // J & K) Resolver não muta Task nem altera Task.decision
  const taskOriginalCopy = JSON.parse(JSON.stringify(baseTaskPending));
  resolveEfficiencyAction(taskCandidateRanked, [baseTaskPending], 30);
  assert(
    JSON.stringify(baseTaskPending) === JSON.stringify(taskOriginalCopy) && baseTaskPending.decision === 'ADIAR',
    'J & K. O resolver é estritamente puro, não muta a Task e não altera Task.decision'
  );

  // L) Task real com duração alterada para 60 min -> BLOCKED
  const taskChangedDuration = { ...baseTaskPending, durationMinutes: 60 };
  const resL = resolveEfficiencyAction(taskCandidateRanked, [taskChangedDuration], 30);
  assert(
    resL.type === 'BLOCKED' && resL.reason.includes('A duração desta tarefa mudou'),
    'L. Task real mudou de 15 min para 60 min resulta em BLOCKED com razão sobre duração alterada'
  );

  // M) Task real com energyRequired alterado -> BLOCKED
  const taskChangedEnergy = { ...baseTaskPending, energyRequired: 'high' as const };
  const resM = resolveEfficiencyAction(taskCandidateRanked, [taskChangedEnergy], 30);
  assert(
    resM.type === 'BLOCKED' && resM.reason.includes('A tarefa mudou desde que a recomendação foi calculada'),
    'M. Task real com energyRequired alterado resulta em BLOCKED'
  );

  // N) Task real com urgency/impact/isCritical alterado -> BLOCKED
  const taskChangedUrgency = { ...baseTaskPending, urgency: 10 };
  const resN = resolveEfficiencyAction(taskCandidateRanked, [taskChangedUrgency], 30);
  assert(
    resN.type === 'BLOCKED' && resN.reason.includes('A tarefa mudou desde que a recomendação foi calculada'),
    'N. Task real com urgência/impacto/isCritical alterado resulta em BLOCKED'
  );

  // O) Task.decision mudou apenas no legado -> NÃO bloqueia execution
  const taskChangedLegacyDecision = { ...baseTaskPending, decision: 'FAZER' as const, rationale: 'Novo rationale legado' };
  const resO = resolveEfficiencyAction(taskCandidateRanked, [taskChangedLegacyDecision], 30);
  assert(
    resO.type === 'START_TASK',
    'O. Alteração apenas em Task.decision/rationale legado NÃO bloqueia a execução da decisão V2'
  );

  // P) dueDate undefined na candidate -> definida na Task real = BLOCKED
  const taskWithDueDateAdded = { ...baseTaskPending, dueDate: '2026-12-31' };
  const resP = resolveEfficiencyAction(taskCandidateRanked, [taskWithDueDateAdded], 30);
  assert(
    resP.type === 'BLOCKED' && resP.reason.includes('A tarefa mudou desde que a recomendação foi calculada'),
    'P. dueDate mudou de undefined para definida resulta em BLOCKED'
  );

  // Q) dueDate definida na candidate -> undefined na Task real = BLOCKED
  const candidateWithDueDateDefined = {
    ...taskCandidateRanked,
    candidate: { ...taskCandidateRanked.candidate, dueDate: '2026-12-31' },
  };
  const resQ = resolveEfficiencyAction(candidateWithDueDateDefined, [baseTaskPending], 30);
  assert(
    resQ.type === 'BLOCKED' && resQ.reason.includes('A tarefa mudou desde que a recomendação foi calculada'),
    'Q. dueDate mudou de definida para undefined resulta em BLOCKED'
  );

  // R) topicId undefined na candidate -> definido na Task real = BLOCKED
  const taskCandidateNoTopic = {
    ...taskCandidateRanked,
    candidate: { ...taskCandidateRanked.candidate, topicId: undefined },
  };
  const taskWithTopicAdded = { ...baseTaskPending, topicId: 'top_new_123' };
  const resR = resolveEfficiencyAction(taskCandidateNoTopic, [taskWithTopicAdded], 30);
  assert(
    resR.type === 'BLOCKED' && resR.reason.includes('A tarefa mudou desde que a recomendação foi calculada'),
    'R. topicId mudou de undefined para definido resulta em BLOCKED'
  );

  // S) topicId definido na candidate -> undefined na Task real = BLOCKED
  const taskWithTopicRemoved = { ...baseTaskPending, topicId: undefined };
  const resS = resolveEfficiencyAction(taskCandidateRanked, [taskWithTopicRemoved], 30);
  assert(
    resS.type === 'BLOCKED' && resS.reason.includes('A tarefa mudou desde que a recomendação foi calculada'),
    'S. topicId mudou de definido para undefined resulta em BLOCKED'
  );

  // T) Snapshot idêntico -> START_TASK
  const resT = resolveEfficiencyAction(taskCandidateRanked, [baseTaskPending], 30);
  assert(
    resT.type === 'START_TASK',
    'T. Task com snapshot perfeitamente idêntico resulta em START_TASK'
  );

  console.log('==================================================');
  console.log('   RESULTADO: TODOS OS TESTES DO RESOLVER PASSARAM!');
  console.log('==================================================');
}

runTests();

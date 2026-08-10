import { 
  validateAttemptConsistency, 
  interpretAttempt, 
  createLearningEvidencesFromAttempt 
} from './questionsEngine';
import { LocalAttemptRepository, LocalLearningEvidenceRepository } from './questionRepository';
import { Question, Attempt, LearningEvidence } from '../types';

function runQuestionsEngineTests() {
  console.log('==================================================');
  console.log('   EXECUTANDO TESTES DE INTEGRIDADE — RODADA 2.1   ');
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

  const mockQuestion: Question = {
    id: 'q_test_100',
    userId: 'u_integrity_1',
    title: 'Questão Teste Integridade',
    subjectId: 'mat',
    topicIds: ['mat_sem_tri'],
    sourceType: 'MANUAL',
    createdAt: new Date().toISOString(),
  };

  // TEST 1: Inconsistência de Confiança (CORRECT_CONFIDENT com confiança < 4 é rejeitada)
  const validation1 = validateAttemptConsistency('CORRECT_CONFIDENT', 2);
  assert(
    !validation1.valid && !!validation1.errorMessage,
    'TEST 1: validateAttemptConsistency invalida CORRECT_CONFIDENT com confiança 2'
  );

  // TEST 2: Confiança Nula é rejeitada para resultados normais
  const validation2 = validateAttemptConsistency('WRONG', null);
  assert(
    !validation2.valid,
    'TEST 2: validateAttemptConsistency invalida WRONG com confiança null'
  );

  // TEST 3: BLANK permite confiança nula
  const validation3 = validateAttemptConsistency('BLANK', null);
  assert(
    validation3.valid,
    'TEST 3: validateAttemptConsistency valida BLANK com confiança null'
  );

  // TEST 4: Erro com Confiança 3 gera NEUTRAL / NEGATIVE_SIGNAL sem fingir lacuna reconhecida
  const wrongConf3Attempt: Attempt = {
    id: 'att_3_conf',
    userId: 'u_integrity_1',
    questionId: 'q_test_100',
    result: 'WRONG',
    confidence: 3,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const interp4 = interpretAttempt(wrongConf3Attempt, mockQuestion);
  assert(
    interp4.signalType === 'NEGATIVE_SIGNAL' && interp4.explanation.includes('confiança intermediária'),
    'TEST 4: ERRO + Confiança 3 gera mensagem neutra de dúvida intermediária'
  );

  // TEST 5: Autocorreção preserva o histórico de erro (gera 2 evidências)
  const selfCorrAttempt: Attempt = {
    id: 'att_self_corr',
    userId: 'u_integrity_1',
    questionId: 'q_test_100',
    result: 'CORRECT_CONFIDENT',
    confidence: 4,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    selfCorrection: true,
    correctionBeforeSolution: true,
    firstAttempt: {
      result: 'WRONG',
      confidence: 4,
      timestamp: new Date().toISOString(),
      reflectionTag: 'CALCULATION_ERROR',
    },
    secondAttempt: {
      result: 'CORRECT_CONFIDENT',
      confidence: 4,
      timestamp: new Date().toISOString(),
    },
  };

  const evidences = createLearningEvidencesFromAttempt(selfCorrAttempt, mockQuestion);
  assert(
    evidences.length === 2 && 
    evidences[0].signal === 'CONFIDENCE_DIVERGENCE' && 
    evidences[1].signal === 'SELF_CORRECTION',
    'TEST 5: Autocorreção gera 2 evidências preservando a divergência do erro inicial'
  );

  // TEST 6: Mismatch de IDs lança erro controlado
  let threwMismatch = false;
  try {
    const wrongUserQ = { ...mockQuestion, userId: 'other_user' };
    interpretAttempt(selfCorrAttempt, wrongUserQ);
  } catch (_e) {
    threwMismatch = true;
  }
  assert(
    threwMismatch,
    'TEST 6: Mismatch entre attempt.userId e question.userId lança exceção controlada'
  );

  // TEST 7: Idempotência de salvamento no repositório de tentativas e imutabilidade
  const attemptRepo = new LocalAttemptRepository();
  const attemptForRepo: Attempt = {
    id: 'att_dup_test',
    userId: 'u_repo_test',
    questionId: 'q_test_100',
    result: 'CORRECT_CONFIDENT',
    confidence: 5,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  attemptRepo.saveAttempt(attemptForRepo);
  // Re-saving identical attempt is idempotent
  const resSaved = attemptRepo.saveAttempt({ ...attemptForRepo });
  
  let threwOnDifferentAttempt = false;
  try {
    attemptRepo.saveAttempt({ ...attemptForRepo, result: 'WRONG' });
  } catch (_e) {
    threwOnDifferentAttempt = true;
  }

  const userAttempts = attemptRepo.getAttemptsByUser('u_repo_test');
  assert(
    userAttempts.length === 1 && resSaved.id === 'att_dup_test' && threwOnDifferentAttempt,
    'TEST 7: LocalAttemptRepository é idempotente para dados idênticos e rejeita alteração de tentativa salva'
  );

  // TEST 8: Idempotência e imutabilidade no repositório de evidências
  const evidenceRepo = new LocalLearningEvidenceRepository();
  const evForRepo: LearningEvidence = {
    id: 'ev_dup_test',
    userId: 'u_repo_test',
    subjectId: 'mat',
    topicIds: ['mat_sem_tri'],
    type: 'QUESTION_ATTEMPT',
    sourceId: 'att_dup_test',
    createdAt: new Date().toISOString(),
    signal: 'STRONG_POSITIVE',
    result: 'CORRECT_CONFIDENT',
    confidence: 5,
  };

  evidenceRepo.saveEvidence(evForRepo);
  evidenceRepo.saveEvidence({ ...evForRepo }); // identical -> idempotent

  let threwOnDifferentEvidence = false;
  try {
    evidenceRepo.saveEvidence({ ...evForRepo, result: 'CORRECT_UNCERTAIN' });
  } catch (_e) {
    threwOnDifferentEvidence = true;
  }

  const userEvidences = evidenceRepo.getEvidencesByUser('u_repo_test');
  assert(
    userEvidences.length === 1 && threwOnDifferentEvidence,
    'TEST 8: LocalLearningEvidenceRepository é idempotente para dados idênticos e lança erro ao tentar sobrescrever conteúdo diferente'
  );

  // TEST 9: Idempotência de IDs determinísticos de evidências
  const evs1 = createLearningEvidencesFromAttempt(selfCorrAttempt, mockQuestion);
  const evs2 = createLearningEvidencesFromAttempt(selfCorrAttempt, mockQuestion);
  assert(
    evs1.length === evs2.length && evs1[0].id === evs2[0].id && evs1[1].id === evs2[1].id,
    'TEST 9: createLearningEvidencesFromAttempt gera IDs determinísticos idempotentes'
  );

  // TEST 10: Segunda tentativa após consultar resolução gera sinal POST_SOLUTION (não SELF_CORRECTION)
  const postSolutionAttempt: Attempt = {
    id: 'att_post_sol',
    userId: 'u_integrity_1',
    questionId: 'q_test_100',
    result: 'CORRECT_CONFIDENT',
    confidence: 4,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    selfCorrection: false,
    correctionBeforeSolution: false,
    firstAttempt: {
      result: 'WRONG',
      confidence: 4,
      timestamp: new Date().toISOString(),
    },
    secondAttempt: {
      result: 'CORRECT_CONFIDENT',
      confidence: 4,
      timestamp: new Date().toISOString(),
    },
  };
  const evsPostSol = createLearningEvidencesFromAttempt(postSolutionAttempt, mockQuestion);
  assert(
    evsPostSol.length === 2 && evsPostSol[1].signal === 'POST_SOLUTION',
    'TEST 10: Acerto após consultar resolução gera sinal POST_SOLUTION'
  );

  // TEST 11: Atualização de justificativa de raciocínio via updateAttemptReasoning
  const updatedAttempt = attemptRepo.updateAttemptReasoning('att_dup_test', 'u_repo_test', 'Justificativa de teste');
  assert(
    updatedAttempt !== null && 
    updatedAttempt.reasoningText === 'Justificativa de teste' && 
    !!updatedAttempt.reasoningUpdatedAt,
    'TEST 11: updateAttemptReasoning atualiza reasoningText e registra reasoningUpdatedAt'
  );

  console.log('\n==================================================');
  console.log(`   RESULTADO: ${passedCount} PASSOU | ${failedCount} FALHOU`);
  console.log('==================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runQuestionsEngineTests();

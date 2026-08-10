import assert from 'assert';
import {
  formatReviewType,
  formatReviewPriority,
  formatReviewTriggerReason,
  formatConfidenceLabel,
  formatMasteryStatusLabel,
  formatReviewWindow,
  getReviewTypeInstruction,
  getInformativeNoReviewDecisions,
  formatReviewCompletionOutcome,
  summarizeReviewAttempts,
} from './reviewPresentation';
import {
  ReviewType,
  ReviewTriggerReason,
  ReviewPriority,
  RecommendationConfidence,
  MasteryStatus,
  MasteryState,
  ReviewDecision,
  Attempt,
} from '../types';

console.log('==================================================');
console.log('   EXECUTANDO TESTES DO REVIEW PRESENTATION');
console.log('==================================================');

let passedCount = 0;

function runTest(description: string, fn: () => void) {
  try {
    fn();
    passedCount++;
    console.log(`[PASS] ${description}`);
  } catch (err: any) {
    console.error(`[FAIL] ${description}:`, err.message);
    process.exit(1);
  }
}

// 1. Todos ReviewType possuem label humana
runTest('P1. Todos ReviewType possuem label humano', () => {
  const types: ReviewType[] = [
    'ACTIVE_RECALL',
    'TARGETED_QUESTIONS',
    'ERROR_REVIEW',
    'REATTEMPT_WITHOUT_SUPPORT',
    'MINI_LIST',
    'ORAL_EXPLANATION',
    'FORMULA_RECONSTRUCTION',
    'THEORY_REFRESH',
    'DIAGNOSTIC_RETEST',
  ];
  types.forEach((t) => {
    const label = formatReviewType(t);
    assert(label !== t, `Label de ${t} não pode ser o enum cru`);
    assert(typeof label === 'string' && label.length > 0, `Label de ${t} deve ser válida`);
  });
});

// 2. Todos ReviewTriggerReason possuem label humana
runTest('P2. Todos ReviewTriggerReason possuem label humano', () => {
  const reasons: ReviewTriggerReason[] = [
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
  reasons.forEach((r) => {
    const label = formatReviewTriggerReason(r);
    assert(label !== r, `Label de ${r} não pode ser o enum cru`);
    assert(typeof label === 'string' && label.length > 0, `Label de ${r} deve ser válida`);
  });
});

// 3. Todos ReviewPriority possuem label humana
runTest('P3. Todos ReviewPriority possuem label humano', () => {
  const priorities: ReviewPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'MAINTENANCE'];
  priorities.forEach((p) => {
    const label = formatReviewPriority(p);
    assert(label !== p, `Label de ${p} não pode ser o enum cru`);
    assert(typeof label === 'string' && label.length > 0, `Label de ${p} deve ser válida`);
  });
});

// 4. LOW/MODERATE/HIGH recommendationConfidence possuem label
runTest('P4. LOW/MODERATE/HIGH possuem labels humanas de confiança', () => {
  const confidences: RecommendationConfidence[] = ['LOW', 'MODERATE', 'HIGH'];
  confidences.forEach((c) => {
    const label = formatConfidenceLabel(c);
    assert(label !== c, `Label de ${c} não pode ser o enum cru`);
    assert(['Baixa', 'Moderada', 'Alta'].includes(label), `Label de ${c} deve ser Baixa/Moderada/Alta`);
  });
});

// 5. UNKNOWN é removido de Pode Esperar & 6. no-data com 12 tópicos produz 0 itens informativos
runTest('P5 & P6. UNKNOWN é removido de Pode Esperar; 12 tópicos com 0 dados produzem 0 itens', () => {
  const dummyDecision: ReviewDecision = {
    action: 'NO_REVIEW_NOW',
    rationale: 'Ainda não há dados suficientes de uso para este tópico.',
    recommendationConfidence: 'LOW',
    sourceEvidenceIds: [],
  };

  const noReviewDecisions = Array.from({ length: 12 }, (_, i) => ({
    topicId: `topic_${i + 1}`,
    decision: dummyDecision,
  }));

  const masteryMap = new Map<string, MasteryState>();
  noReviewDecisions.forEach(({ topicId }) => {
    masteryMap.set(topicId, {
      userId: 'u1',
      topicId,
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
      trend: 'UNKNOWN',
      uncertaintyReasons: [],
    });
  });

  const filtered = getInformativeNoReviewDecisions({
    noReviewDecisions,
    masteryStates: masteryMap,
    limit: 5,
  });

  assert.strictEqual(filtered.length, 0, 'Nenhum item UNKNOWN deve aparecer em Pode Esperar');
});

// 7. Lista Pode Esperar respeita limite
runTest('P7. Lista Pode Esperar respeita o limite configurado (ex: max 5)', () => {
  const dummyDecision: ReviewDecision = {
    action: 'NO_REVIEW_NOW',
    rationale: 'Conteúdo estimado recentemente sem sinais de queda.',
    recommendationConfidence: 'HIGH',
    sourceEvidenceIds: ['ev1'],
  };

  const noReviewDecisions = Array.from({ length: 10 }, (_, i) => ({
    topicId: `topic_est_${i + 1}`,
    decision: dummyDecision,
  }));

  const masteryMap = new Map<string, MasteryState>();
  noReviewDecisions.forEach(({ topicId }) => {
    masteryMap.set(topicId, {
      userId: 'u1',
      topicId,
      status: 'ESTIMATED',
      estimatedLevel: 7,
      confidence: 'HIGH',
      evidenceCount: 3,
      independentSourceCount: 3,
      levelSupportingIndependentSourceCount: 3,
      informativeIndependentSourceCount: 3,
      fragileIndependentSourceCount: 0,
      contradictingIndependentSourceCount: 0,
      assistedIndependentSourceCount: 0,
      strongPositiveCount: 3,
      fragilePositiveCount: 0,
      negativeCount: 0,
      confidenceDivergenceCount: 0,
      selfCorrectionCount: 0,
      postSolutionCount: 0,
      timeSignalCount: 0,
      difficultiesObserved: [],
      levelSupportingEvidenceIds: ['ev1'],
      fragileEvidenceIds: [],
      assistedEvidenceIds: [],
      contradictingEvidenceIds: [],
      timeEvidenceIds: [],
      supportingEvidenceIds: ['ev1'],
      trend: 'STABLE',
      uncertaintyReasons: [],
    });
  });

  const filtered = getInformativeNoReviewDecisions({
    noReviewDecisions,
    masteryStates: masteryMap,
    limit: 5,
  });

  assert.strictEqual(filtered.length, 5, 'Respeitou o limite de 5 itens');
});

// 8. formatReviewWindow mostra start + end
runTest('P8. formatReviewWindow formata janelas corretamente', () => {
  const window1 = formatReviewWindow('2026-08-12T00:00:00Z', '2026-08-15T00:00:00Z');
  assert(window1.includes('12') && window1.includes('15'), `Esperado 12–15 ago., gerado: ${window1}`);

  const window2 = formatReviewWindow('2026-08-12T00:00:00Z', '2026-08-12T00:00:00Z');
  assert.strictEqual(window2, '12 ago.', `Data igual deve mostrar apenas 12 ago., gerado: ${window2}`);

  const window3 = formatReviewWindow(undefined, undefined);
  assert.strictEqual(window3, 'Janela ainda não definida.');
});

// 9. Nenhum helper retorna enum cru em cenário válido
runTest('P9. Nenhum helper retorna enum cru', () => {
  assert.strictEqual(formatMasteryStatusLabel('EMERGING'), 'Em Emergência');
  assert.strictEqual(formatMasteryStatusLabel('CONFLICTED'), 'Conflitante');
  assert.strictEqual(getReviewTypeInstruction('ACTIVE_RECALL'), 'Sem consultar o material, recupere os conceitos principais e depois confira.');
});

// 10. formatReviewCompletionOutcome retorna labels humanas para todos os outcomes
runTest('P10. formatReviewCompletionOutcome retorna labels humanas', () => {
  assert.strictEqual(formatReviewCompletionOutcome('SUCCESS_CONFIDENT'), 'Concluída com segurança');
  assert.strictEqual(formatReviewCompletionOutcome('SUCCESS_EFFORTFUL'), 'Concluída com esforço');
  assert.strictEqual(formatReviewCompletionOutcome('PARTIAL'), 'Concluída parcialmente');
  assert.strictEqual(formatReviewCompletionOutcome('FAILED'), 'Não conseguiu nesta tentativa');
  assert.strictEqual(formatReviewCompletionOutcome('NOT_COMPLETED'), 'Não realizada');
});

// 11. summarizeReviewAttempts sumariza corretamente acertos, erros, branco e sem tempo
runTest('P11. summarizeReviewAttempts sumariza tentativas separando erro de branco e sem tempo', () => {
  const dummyAttempts: Attempt[] = [
    { id: 'a1', userId: 'u1', questionId: 'q1', result: 'CORRECT_CONFIDENT', confidence: 5, completedAt: '2026-08-09T10:00:00Z', createdAt: '2026-08-09T10:00:00Z' },
    { id: 'a2', userId: 'u1', questionId: 'q2', result: 'CORRECT_UNCERTAIN', confidence: 3, completedAt: '2026-08-09T10:01:00Z', createdAt: '2026-08-09T10:01:00Z' },
    { id: 'a3', userId: 'u1', questionId: 'q3', result: 'WRONG', confidence: 1, completedAt: '2026-08-09T10:02:00Z', createdAt: '2026-08-09T10:02:00Z' },
    { id: 'a4', userId: 'u1', questionId: 'q4', result: 'BLANK', confidence: 1, completedAt: '2026-08-09T10:03:00Z', createdAt: '2026-08-09T10:03:00Z' },
    { id: 'a5', userId: 'u1', questionId: 'q5', result: 'NO_TIME', confidence: 1, completedAt: '2026-08-09T10:04:00Z', createdAt: '2026-08-09T10:04:00Z' },
  ];

  const summary = summarizeReviewAttempts(dummyAttempts);
  assert.strictEqual(summary.total, 5);
  assert.strictEqual(summary.totalCorrect, 2);
  assert.strictEqual(summary.wrong, 1);
  assert.strictEqual(summary.blank, 1);
  assert.strictEqual(summary.noTime, 1);
});

console.log('==================================================');
console.log(`   RESULTADO: ${passedCount} PASSOU | 0 FALHOU`);
console.log('==================================================\n');

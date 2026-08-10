import assert from 'assert';
import { LocalStudySessionRepository } from './studySessionRepository';
import { StudySession } from '../types';

console.log('==================================================');
console.log('   EXECUTANDO TESTES DO STUDY SESSION REPOSITORY');
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

function makeSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 's1',
    userId: 'u1',
    taskId: 't1',
    subjectId: 'mat',
    topicId: 'mat_razao',
    plannedMinutes: 30,
    actualMinutes: 28,
    energyLevel: 'medium',
    comprehensionScore: 4,
    canExplain: true,
    methodUsed: 'questoes',
    notes: 'Consegui explicar sem consultar.',
    completedAt: '2026-08-10T12:00:00.000Z',
    ...overrides,
  };
}

runTest('1. saveSession sem userId lança erro', () => {
  const repo = new LocalStudySessionRepository();
  assert.throws(() => repo.saveSession(makeSession({ userId: '' })));
});

runTest('2. Sessão salva é recuperada por getSessionsByUser', () => {
  const repo = new LocalStudySessionRepository();
  const session = makeSession({ id: 's_recuperar', userId: 'u_recuperar' });
  repo.saveSession(session);
  const found = repo.getSessionsByUser('u_recuperar').find(s => s.id === 's_recuperar');
  assert.deepStrictEqual(found, session);
});

runTest('3. Re-salvar sessão idêntica é idempotente', () => {
  const repo = new LocalStudySessionRepository();
  const session = makeSession({ id: 's_idempotente', userId: 'u_idempotente' });
  repo.saveSession(session);
  repo.saveSession({ ...session });
  const all = repo.getSessionsByUser('u_idempotente').filter(s => s.id === 's_idempotente');
  assert.strictEqual(all.length, 1);
});

runTest('4. Alterar comprehensionScore em sessão já salva lança erro de imutabilidade', () => {
  const repo = new LocalStudySessionRepository();
  const session = makeSession({ id: 's_imutavel', userId: 'u_imutavel' });
  repo.saveSession(session);
  assert.throws(() => repo.saveSession({ ...session, comprehensionScore: 1 }));
});

runTest('5. getSessionsByUser filtra estritamente por userId', () => {
  const repo = new LocalStudySessionRepository();
  repo.saveSession(makeSession({ id: 's_u1', userId: 'u_isolamento_1' }));
  repo.saveSession(makeSession({ id: 's_u2', userId: 'u_isolamento_2' }));
  const forU1 = repo.getSessionsByUser('u_isolamento_1');
  assert.ok(forU1.every(s => s.userId === 'u_isolamento_1'));
  assert.ok(!forU1.some(s => s.id === 's_u2'));
});

console.log('==================================================');
console.log(`   RESULTADO: ${passedCount} PASSOU | 0 FALHOU`);
console.log('==================================================');

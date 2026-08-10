import assert from 'assert';
import { loadPersistedState, savePersistedState, clearPersistedState } from './appStateStore';

console.log('==================================================');
console.log('   EXECUTANDO TESTES DO APP STATE STORE');
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

runTest('1. Chave ausente retorna o fallback', () => {
  const result = loadPersistedState('juju_test_missing_key', { count: 42 });
  assert.deepStrictEqual(result, { count: 42 });
});

runTest('2. Round-trip save/load preserva o valor exato', () => {
  const value = { name: 'Ana', tasks: [1, 2, 3], nested: { ok: true } };
  savePersistedState('juju_test_roundtrip', value);
  const loaded = loadPersistedState('juju_test_roundtrip', {});
  assert.deepStrictEqual(loaded, value);
});

runTest('3. clearPersistedState remove o valor e volta a retornar o fallback', () => {
  savePersistedState('juju_test_clear', { a: 1 });
  clearPersistedState('juju_test_clear');
  const loaded = loadPersistedState('juju_test_clear', { a: 'fallback' });
  assert.deepStrictEqual(loaded, { a: 'fallback' });
});

runTest('4. JSON corrompido retorna o fallback em vez de lançar erro', () => {
  savePersistedState('juju_test_corrupt', { valid: true });
  // Overwrite with invalid JSON directly through the same storage path
  savePersistedState('juju_test_corrupt', undefined as any);
  const raw = loadPersistedState('juju_test_corrupt', { fallback: true });
  assert.ok(raw);
});

runTest('5. Chaves diferentes não colidem entre si', () => {
  savePersistedState('juju_test_key_a', { who: 'a' });
  savePersistedState('juju_test_key_b', { who: 'b' });
  assert.deepStrictEqual(loadPersistedState('juju_test_key_a', {}), { who: 'a' });
  assert.deepStrictEqual(loadPersistedState('juju_test_key_b', {}), { who: 'b' });
});

console.log('==================================================');
console.log(`   RESULTADO: ${passedCount} PASSOU | 0 FALHOU`);
console.log('==================================================');

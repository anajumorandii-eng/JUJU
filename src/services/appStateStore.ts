const memoryStore = new Map<string, string>();

function getStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (k: string) => memoryStore.get(k) ?? null,
    setItem: (k: string, v: string) => { memoryStore.set(k, v); },
    removeItem: (k: string) => { memoryStore.delete(k); },
  };
}

export function loadPersistedState<T>(key: string, fallback: T): T {
  try {
    const raw = getStorage().getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Could not read persisted state for "${key}":`, e);
    return fallback;
  }
}

export function savePersistedState<T>(key: string, value: T): void {
  try {
    getStorage().setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Could not persist state for "${key}":`, e);
  }
}

export function clearPersistedState(key: string): void {
  try {
    getStorage().removeItem(key);
  } catch (e) {
    console.warn(`Could not clear persisted state for "${key}":`, e);
  }
}

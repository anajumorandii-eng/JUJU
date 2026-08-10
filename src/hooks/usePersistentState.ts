import { useEffect, useState } from 'react';
import { loadPersistedState, savePersistedState } from '../services/appStateStore';

export function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => loadPersistedState(key, initialValue));

  useEffect(() => {
    savePersistedState(key, state);
  }, [key, state]);

  return [state, setState] as const;
}

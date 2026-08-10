import { DiagnosticDraft } from '../types';

const DRAFT_KEY_PREFIX = 'juju_diag_draft_';
const memoryStore = new Map<string, string>();

function getStorage(): Storage | { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (k: string) => memoryStore.get(k) || null,
    setItem: (k: string, v: string) => { memoryStore.set(k, v); },
    removeItem: (k: string) => { memoryStore.delete(k); },
  };
}

export const DiagnosticDraftRepository = {
  saveDraft(userId: string, draft: DiagnosticDraft): void {
    try {
      if (!userId) return;
      const key = `${DRAFT_KEY_PREFIX}${userId}`;
      getStorage().setItem(key, JSON.stringify(draft));
    } catch (e) {
      console.warn('Could not save diagnostic draft:', e);
    }
  },

  getDraft(userId: string): DiagnosticDraft | null {
    try {
      if (!userId) return null;
      const key = `${DRAFT_KEY_PREFIX}${userId}`;
      const raw = getStorage().getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as DiagnosticDraft;
    } catch (e) {
      console.warn('Could not read diagnostic draft:', e);
      return null;
    }
  },

  clearDraft(userId: string): void {
    try {
      if (!userId) return;
      const key = `${DRAFT_KEY_PREFIX}${userId}`;
      getStorage().removeItem(key);
    } catch (e) {
      console.warn('Could not clear diagnostic draft:', e);
    }
  }
};

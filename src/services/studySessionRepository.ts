import { StudySession } from '../types';

export interface StudySessionRepository {
  saveSession(session: StudySession): StudySession;
  getSessionsByUser(userId: string): StudySession[];
}

const STUDY_SESSIONS_KEY = 'juju_study_sessions_v1';

const memoryStore: Record<string, string> = {};

function getItem(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryStore[key] || null;
}

function setItem(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  } else {
    memoryStore[key] = value;
  }
}

function isSessionIdentical(a: StudySession, b: StudySession): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    (a.taskId || null) === (b.taskId || null) &&
    a.subjectId === b.subjectId &&
    (a.topicId || null) === (b.topicId || null) &&
    a.plannedMinutes === b.plannedMinutes &&
    a.actualMinutes === b.actualMinutes &&
    a.energyLevel === b.energyLevel &&
    a.comprehensionScore === b.comprehensionScore &&
    a.canExplain === b.canExplain &&
    a.methodUsed === b.methodUsed &&
    (a.notes || '') === (b.notes || '') &&
    a.completedAt === b.completedAt
  );
}

export class LocalStudySessionRepository implements StudySessionRepository {
  saveSession(session: StudySession): StudySession {
    if (!session.userId) {
      throw new Error('StudySession requires a valid userId');
    }
    const sessions = this.getSessions();
    const existingIdx = sessions.findIndex(s => s.id === session.id && s.userId === session.userId);
    if (existingIdx >= 0) {
      const existing = sessions[existingIdx];
      if (isSessionIdentical(existing, session)) {
        return existing;
      }
      throw new Error('StudySession is immutable. Cannot overwrite session with different historical data.');
    }
    sessions.push(session);
    setItem(STUDY_SESSIONS_KEY, JSON.stringify(sessions));
    return session;
  }

  getSessionsByUser(userId: string): StudySession[] {
    if (!userId) return [];
    return this.getSessions().filter(s => s.userId === userId);
  }

  private getSessions(): StudySession[] {
    try {
      const raw = getItem(STUDY_SESSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading study sessions from localStorage:', e);
      return [];
    }
  }
}

export const studySessionRepository = new LocalStudySessionRepository();

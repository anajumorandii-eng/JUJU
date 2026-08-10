import { Question, Attempt, LearningEvidence } from '../types';

export interface QuestionRepository {
  saveQuestion(question: Question): Question;
  getQuestionById(id: string, userId: string): Question | null;
  getQuestionsByUser(userId: string): Question[];
}

export interface AttemptRepository {
  saveAttempt(attempt: Attempt): Attempt;
  updateAttemptReasoning(attemptId: string, userId: string, reasoningText: string): Attempt | null;
  getAttemptsByUser(userId: string): Attempt[];
  getAttemptsByQuestion(questionId: string, userId: string): Attempt[];
  getAttemptsByReview(reviewId: string, userId: string): Attempt[];
  getQuestionsToRevisit(userId: string, questions: Question[]): { question: Question; lastAttempt: Attempt; attemptCount: number }[];
}

export interface LearningEvidenceRepository {
  saveEvidence(evidence: LearningEvidence): LearningEvidence;
  getEvidencesByUser(userId: string): LearningEvidence[];
}

// ==========================================
// LOCAL STORAGE IMPLEMENTATIONS
// ==========================================

const QUESTIONS_KEY = 'juju_questions_v2';
const ATTEMPTS_KEY = 'juju_attempts_v2';
const EVIDENCES_KEY = 'juju_learning_evidences_v2';

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

function isQuestionIdentical(a: Question, b: Question): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    a.title === b.title &&
    a.statement === b.statement &&
    a.subjectId === b.subjectId &&
    JSON.stringify(a.topicIds || []) === JSON.stringify(b.topicIds || []) &&
    (a.sourceType || null) === (b.sourceType || null) &&
    (a.exam || null) === (b.exam || null) &&
    (a.year || null) === (b.year || null) &&
    (a.sourceName || null) === (b.sourceName || null) &&
    (a.questionNumber || null) === (b.questionNumber || null) &&
    (a.difficulty || null) === (b.difficulty || null) &&
    (a.imageUrl || null) === (b.imageUrl || null) &&
    (a.correctAnswer || null) === (b.correctAnswer || null) &&
    (a.answerReference || null) === (b.answerReference || null) &&
    (a.questionType || null) === (b.questionType || null) &&
    (a.createdAt || null) === (b.createdAt || null)
  );
}

function isAttemptIdentical(a: Attempt, b: Attempt): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    a.questionId === b.questionId &&
    (a.reviewId || null) === (b.reviewId || null) &&
    a.result === b.result &&
    (a.confidence ?? null) === (b.confidence ?? null) &&
    (a.startedAt || null) === (b.startedAt || null) &&
    (a.completedAt || null) === (b.completedAt || null) &&
    (a.durationSeconds || null) === (b.durationSeconds || null) &&
    (a.selectedAnswer || null) === (b.selectedAnswer || null) &&
    (a.usedHint ?? null) === (b.usedHint ?? null) &&
    (a.hintCount ?? null) === (b.hintCount ?? null) &&
    (a.reflectionTag || null) === (b.reflectionTag || null) &&
    (a.changedAnswer ?? null) === (b.changedAnswer ?? null) &&
    (a.selfCorrection ?? null) === (b.selfCorrection ?? null) &&
    (a.correctionBeforeSolution ?? null) === (b.correctionBeforeSolution ?? null) &&
    (a.retryAfterSolution ?? null) === (b.retryAfterSolution ?? null) &&
    (a.createdAt || null) === (b.createdAt || null) &&
    JSON.stringify(a.firstAttempt || null) === JSON.stringify(b.firstAttempt || null) &&
    JSON.stringify(a.secondAttempt || null) === JSON.stringify(b.secondAttempt || null)
  );
}

function isEvidenceIdentical(a: LearningEvidence, b: LearningEvidence): boolean {
  return (
    a.id === b.id &&
    a.userId === b.userId &&
    a.subjectId === b.subjectId &&
    JSON.stringify(a.topicIds || []) === JSON.stringify(b.topicIds || []) &&
    a.type === b.type &&
    a.sourceId === b.sourceId &&
    (a.createdAt || null) === (b.createdAt || null) &&
    a.signal === b.signal &&
    (a.result || null) === (b.result || null) &&
    (a.confidence ?? null) === (b.confidence ?? null) &&
    (a.difficulty || null) === (b.difficulty || null) &&
    (a.durationSeconds || null) === (b.durationSeconds || null) &&
    JSON.stringify(a.metadata || null) === JSON.stringify(b.metadata || null)
  );
}

export class LocalQuestionRepository implements QuestionRepository {
  saveQuestion(question: Question): Question {
    if (!question.userId) {
      throw new Error('Question requires a valid userId');
    }
    const questions = this.getQuestions();
    const existingIdx = questions.findIndex(q => q.id === question.id && q.userId === question.userId);
    if (existingIdx >= 0) {
      const existing = questions[existingIdx];
      if (isQuestionIdentical(existing, question)) {
        return existing;
      }
      throw new Error('Question with this ID already exists with different content.');
    }
    questions.push(question);
    setItem(QUESTIONS_KEY, JSON.stringify(questions));
    return question;
  }

  getQuestionById(id: string, userId: string): Question | null {
    if (!userId) return null;
    const questions = this.getQuestionsByUser(userId);
    return questions.find(q => q.id === id) || null;
  }

  getQuestionsByUser(userId: string): Question[] {
    if (!userId) return [];
    const questions = this.getQuestions();
    return questions.filter(q => q.userId === userId);
  }

  private getQuestions(): Question[] {
    try {
      const raw = getItem(QUESTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading questions from localStorage:', e);
      return [];
    }
  }
}

export class LocalAttemptRepository implements AttemptRepository {
  saveAttempt(attempt: Attempt): Attempt {
    if (!attempt.userId || !attempt.questionId) {
      throw new Error('Attempt requires valid userId and questionId');
    }
    const attempts = this.getAttempts();
    const existingIndex = attempts.findIndex(a => a.id === attempt.id && a.userId === attempt.userId);
    if (existingIndex >= 0) {
      const existing = attempts[existingIndex];
      if (isAttemptIdentical(existing, attempt)) {
        return existing;
      }
      throw new Error('Attempt is immutable. Cannot overwrite attempt with different historical data.');
    }
    attempts.push(attempt);
    setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    return attempt;
  }

  updateAttemptReasoning(attemptId: string, userId: string, reasoningText: string): Attempt | null {
    if (!attemptId || !userId) return null;
    const attempts = this.getAttempts();
    const index = attempts.findIndex(a => a.id === attemptId && a.userId === userId);
    if (index === -1) return null;
    
    attempts[index] = {
      ...attempts[index],
      reasoningText,
      reasoningUpdatedAt: new Date().toISOString(),
    };
    setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    return attempts[index];
  }

  getAttemptsByUser(userId: string): Attempt[] {
    if (!userId) return [];
    const attempts = this.getAttempts();
    return attempts.filter(a => a.userId === userId);
  }

  getAttemptsByQuestion(questionId: string, userId: string): Attempt[] {
    if (!userId || !questionId) return [];
    const userAttempts = this.getAttemptsByUser(userId);
    return [...userAttempts]
      .filter(a => a.questionId === questionId)
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
  }

  getAttemptsByReview(reviewId: string, userId: string): Attempt[] {
    if (!userId || !reviewId) return [];
    const userAttempts = this.getAttemptsByUser(userId);
    return userAttempts.filter(a => a.reviewId === reviewId);
  }

  getQuestionsToRevisit(userId: string, questions: Question[]): { question: Question; lastAttempt: Attempt; attemptCount: number }[] {
    if (!userId) return [];
    const userAttempts = this.getAttemptsByUser(userId);
    const userQuestions = questions.filter(q => q.userId === userId);

    const result: { question: Question; lastAttempt: Attempt; attemptCount: number }[] = [];

    userQuestions.forEach(question => {
      const qAttempts = [...userAttempts]
        .filter(a => a.questionId === question.id)
        .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

      if (qAttempts.length > 0) {
        const lastAttempt = qAttempts[0];
        // Questions to revisit are those where last result is WRONG, CORRECT_UNCERTAIN, or CORRECT_GUESS
        if (['WRONG', 'CORRECT_UNCERTAIN', 'CORRECT_GUESS', 'BLANK', 'NO_TIME'].includes(lastAttempt.result)) {
          result.push({
            question,
            lastAttempt,
            attemptCount: qAttempts.length,
          });
        }
      }
    });

    return result.sort((a, b) => new Date(b.lastAttempt.completedAt || b.lastAttempt.createdAt).getTime() - new Date(a.lastAttempt.completedAt || a.lastAttempt.createdAt).getTime());
  }

  private getAttempts(): Attempt[] {
    try {
      const raw = getItem(ATTEMPTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading attempts from localStorage:', e);
      return [];
    }
  }
}

export class LocalLearningEvidenceRepository implements LearningEvidenceRepository {
  saveEvidence(evidence: LearningEvidence): LearningEvidence {
    if (!evidence.userId) {
      throw new Error('LearningEvidence requires valid userId');
    }
    const evidences = this.getEvidences();
    const existingIndex = evidences.findIndex(e => e.id === evidence.id && e.userId === evidence.userId);
    if (existingIndex >= 0) {
      const existing = evidences[existingIndex];
      if (isEvidenceIdentical(existing, evidence)) {
        return existing;
      }
      throw new Error('LearningEvidence is immutable. Cannot overwrite evidence with different content.');
    }
    evidences.push(evidence);
    setItem(EVIDENCES_KEY, JSON.stringify(evidences));
    return evidence;
  }

  getEvidencesByUser(userId: string): LearningEvidence[] {
    if (!userId) return [];
    const evidences = this.getEvidences();
    return evidences.filter(e => e.userId === userId);
  }

  private getEvidences(): LearningEvidence[] {
    try {
      const raw = getItem(EVIDENCES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading learning evidences from localStorage:', e);
      return [];
    }
  }
}

// Singleton instances for app-wide repository usage
export const questionRepository = new LocalQuestionRepository();
export const attemptRepository = new LocalAttemptRepository();
export const learningEvidenceRepository = new LocalLearningEvidenceRepository();

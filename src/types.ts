export interface Topic {
  id: string;
  name: string;
  subject: string;
  prerequisites: string[]; // IDs of other topics
  incidence: 'baixa' | 'média' | 'alta' | 'muito_alta'; // exam-board weight
}

// Domain stage scale shared by the study manuals:
// 0 = não reconhece, 1 = recupera com ajuda, 2 = independente,
// 3 = transferência, 4 = retenção após intervalo
export type MasteryStage = 0 | 1 | 2 | 3 | 4;

export interface TopicMastery {
  topicId: string;
  level: number; // 0 to 100, continuous score used for ranking
  stage: MasteryStage; // discrete domain stage, drives which exercise type to generate
  uncertainty: number; // 0 to 1 (0 = highly certain of level, 1 = low confidence in the level metric)
  lastReviewed: string; // ISO Date
  errorSignals: number; // recent consecutive errors
  nextReviewDate: string; // ISO Date — explicit spaced-repetition schedule
  currentIntervalDays: number; // grows/shrinks adaptively based on ReviewEvent outcomes
  consecutiveSuccesses: number; // consecutive outcomes >= 2, drives interval growth
}

// One row per recall attempt — audit trail feeding the spaced-repetition scheduler
export interface ReviewEvent {
  id: string;
  topicId: string;
  date: string; // ISO Date
  outcome: MasteryStage; // errou / c.ajuda / independente / transferência / retido
  consultedMaterial: boolean;
  intervalBeforeDays: number;
  intervalAfterDays: number;
}

export interface Question {
  id: string;
  topicId: string;
  format: 'objetiva' | 'discursiva' | 'recuperacao_livre';
  banca?: string;
  prompt: string;
  answerKey?: string;
  generatedBy: 'gemini' | 'manual';
  createdAt: string; // ISO Date
}

// One PONTE/A.C.T.I.V.A. cycle: pré-teste -> recuperação -> aplicação -> correção
export interface StudySession {
  id: string;
  topicId: string;
  startedAt: string; // ISO Date
  finishedAt?: string; // ISO Date
  steps: {
    preTest?: { questionIds: string[]; outcome: number };
    recall?: { freeTextProduced: string };
    application?: { questionIds: string[]; correctCount: number; totalCount: number };
    correction?: { errorLogIds: string[] };
  };
  resultingOutcome?: MasteryStage; // feeds ReviewEvent + TopicMastery update
}

export interface UserProfile {
  targetCourse: string;
  targetUniversities: string[];
  targetExams: string[];
  availableHoursPerWeek: number;
  currentEnergyLevel: 'low' | 'medium' | 'high';
  autonomyIndex: number; // 0 to 100
}

export interface ErrorLog {
  id: string;
  topicId: string;
  questionId: string;
  date: string;
  type: 'conceptual' | 'interpretation' | 'calculation' | 'strategy' | 'attention' | 'time' | 'prerequisite';
  firstWrongStep: string; // "ponto de ruptura" — where the reasoning first diverged
  ignoredSignal?: string; // word, unit or condition in the prompt that should have guided the answer
  correctiveRule: string; // the general rule that prevents repeating this error
  notes: string;
  aiHypothesis?: string;
  retestScheduledFor?: string; // ISO Date
  retestOutcome?: 'pending' | 'success' | 'repeated_error';
}

export interface StudyAction {
  id: string;
  type: 'review' | 'practice' | 'theory' | 'error_analysis';
  topicId: string;
  topicName: string;
  subject: string;
  estimatedMinutes: number;
  priorityScore: number; // Assigned by Efficiency Engine
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
}

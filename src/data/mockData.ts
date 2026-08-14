import { Topic, TopicMastery, UserProfile, ErrorLog, ReviewEvent, Question, StudySession } from '../types';

export const mockTopics: Topic[] = [
  { id: 'bio_01', name: 'Citologia', subject: 'Biologia', prerequisites: [], incidence: 'alta' },
  { id: 'bio_02', name: 'Genética', subject: 'Biologia', prerequisites: ['bio_01'], incidence: 'muito_alta' },
  { id: 'mat_01', name: 'Funções de 1º Grau', subject: 'Matemática', prerequisites: [], incidence: 'muito_alta' },
  { id: 'mat_02', name: 'Análise Combinatória', subject: 'Matemática', prerequisites: [], incidence: 'média' },
  { id: 'fis_01', name: 'Cinemática', subject: 'Física', prerequisites: ['mat_01'], incidence: 'alta' },
  { id: 'fis_02', name: 'Eletrodinâmica', subject: 'Física', prerequisites: [], incidence: 'média' }
];

const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export const mockMastery: TopicMastery[] = [
  { topicId: 'bio_01', level: 85, stage: 3, uncertainty: 0.1, lastReviewed: days(5), errorSignals: 0, nextReviewDate: inDays(9), currentIntervalDays: 14, consecutiveSuccesses: 3 },
  { topicId: 'bio_02', level: 30, stage: 1, uncertainty: 0.8, lastReviewed: days(1), errorSignals: 1, nextReviewDate: inDays(2), currentIntervalDays: 3, consecutiveSuccesses: 0 },
  { topicId: 'mat_01', level: 95, stage: 4, uncertainty: 0.05, lastReviewed: days(15), errorSignals: 0, nextReviewDate: inDays(20), currentIntervalDays: 45, consecutiveSuccesses: 5 },
  { topicId: 'mat_02', level: 60, stage: 1, uncertainty: 0.4, lastReviewed: days(3), errorSignals: 4, nextReviewDate: days(0), currentIntervalDays: 3, consecutiveSuccesses: 0 },
  { topicId: 'fis_01', level: 75, stage: 2, uncertainty: 0.2, lastReviewed: days(2), errorSignals: 1, nextReviewDate: inDays(8), currentIntervalDays: 10, consecutiveSuccesses: 1 },
  { topicId: 'fis_02', level: 10, stage: 0, uncertainty: 0.9, lastReviewed: days(10), errorSignals: 2, nextReviewDate: days(3), currentIntervalDays: 1, consecutiveSuccesses: 0 }
];

export const mockProfile: UserProfile = {
  targetCourse: 'Medicina',
  targetUniversities: ['USP', 'UNICAMP', 'UNESP'],
  targetExams: ['ENEM', 'FUVEST'],
  availableHoursPerWeek: 40,
  currentEnergyLevel: 'medium',
  autonomyIndex: 35 // starts low, increases over time
};

export const mockErrorLogs: ErrorLog[] = [
  {
    id: 'err_1',
    topicId: 'mat_02',
    questionId: 'q_mat_02_1',
    date: new Date().toISOString(),
    type: 'interpretation',
    firstWrongStep: 'Classificou o evento como "exatamente um" ao montar a contagem.',
    ignoredSignal: 'O enunciado dizia "pelo menos um", não "exatamente um".',
    correctiveRule: 'Antes de contar, reescrever o enunciado em uma condição lógica explícita (e/ou, mínimo/máximo).',
    notes: 'Confundi "pelo menos um" com "exatamente um".',
    aiHypothesis: 'A hipótese provável é falha na decodificação do jargão lógico de combinatória. Recomendo mapear as palavras-chave (e/ou, no mínimo/no máximo).',
    retestScheduledFor: inDays(3),
    retestOutcome: 'pending'
  }
];

export const mockReviewEvents: ReviewEvent[] = [
  { id: 'review_mat_01_1', topicId: 'mat_01', date: days(15), outcome: 4, consultedMaterial: false, intervalBeforeDays: 30, intervalAfterDays: 45 },
  { id: 'review_mat_02_1', topicId: 'mat_02', date: days(3), outcome: 1, consultedMaterial: true, intervalBeforeDays: 7, intervalAfterDays: 3 }
];

export const mockQuestions: Question[] = [
  {
    id: 'q_mat_02_1',
    topicId: 'mat_02',
    format: 'objetiva',
    banca: 'FUVEST',
    prompt: 'Em uma urna com 5 bolas numeradas, calcule a probabilidade de sortear pelo menos uma bola par em duas retiradas sem reposição.',
    answerKey: '7/10',
    generatedBy: 'gemini',
    createdAt: days(3)
  }
];

export const mockStudySessions: StudySession[] = [
  {
    id: 'session_mat_02_1',
    topicId: 'mat_02',
    startedAt: days(3),
    finishedAt: days(3),
    steps: {
      preTest: { questionIds: ['q_mat_02_1'], outcome: 1 },
      application: { questionIds: ['q_mat_02_1'], correctCount: 0, totalCount: 1 },
      correction: { errorLogIds: ['err_1'] }
    },
    resultingOutcome: 1
  }
];

import { Question, Attempt } from '../types';

export const DEMO_USER_ID = 'demo_user_ana';

export const DEMO_QUESTIONS: Question[] = [
  {
    id: 'q_demo_1',
    userId: DEMO_USER_ID,
    title: 'Questão 14 — Lista de Geometria',
    statement: 'Num triângulo retângulo, as projeções dos catetos sobre a hipotenusa medem 4 cm e 9 cm. Calcule a altura relativa à hipotenusa.',
    subjectId: 'mat',
    topicIds: ['mat_sem_tri'],
    sourceType: 'EXAM',
    exam: 'FUVEST',
    year: 2023,
    difficulty: 'MEDIUM',
    questionNumber: '14',
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: 'q_demo_2',
    userId: DEMO_USER_ID,
    title: 'Questão 08 — Simulado de Física',
    statement: 'Um bloco de massa 2 kg desce um plano inclinado de 30° com aceleração constante de 2 m/s². Determine a força de atrito.',
    subjectId: 'fis',
    topicIds: ['fis_dinamica'],
    sourceType: 'SIMULATED',
    exam: 'ENEM',
    year: 2024,
    difficulty: 'HARD',
    questionNumber: '08',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    id: 'q_demo_3',
    userId: DEMO_USER_ID,
    title: 'Questão 22 — Apostila de Biologia',
    statement: 'Em um cruzamento entre dois heterozigotos Aa x Aa, qual a probabilidade de nascer um indivíduo recessivo?',
    subjectId: 'bio',
    topicIds: ['bio_genetica'],
    sourceType: 'MATERIAL',
    difficulty: 'EASY',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  }
];

export const DEMO_ATTEMPTS: Attempt[] = [
  {
    id: 'att_demo_1',
    userId: DEMO_USER_ID,
    questionId: 'q_demo_1',
    result: 'CORRECT_CONFIDENT',
    confidence: 5,
    completedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    durationSeconds: 120,
    selectedAnswer: 'h = 6 cm',
    reasoningText: 'Relação métrica no triângulo retângulo: h² = m . n -> h² = 4 . 9 = 36 -> h = 6.',
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: 'att_demo_2',
    userId: DEMO_USER_ID,
    questionId: 'q_demo_2',
    result: 'WRONG',
    confidence: 4,
    completedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    durationSeconds: 210,
    selectedAnswer: 'Fat = 5.8 N',
    reasoningText: 'Decompus Px = m.g.sin(30) = 10N. Esqueci de descontar m.a = 4N corretamente.',
    reflectionTag: 'CALCULATION_ERROR',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    id: 'att_demo_3',
    userId: DEMO_USER_ID,
    questionId: 'q_demo_3',
    result: 'CORRECT_UNCERTAIN',
    confidence: 2,
    completedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    durationSeconds: 60,
    selectedAnswer: '25%',
    reasoningText: 'Fiz o quadro de Punnett (AA, Aa, Aa, aa). 1 em 4 = 25%, mas fiquei em dúvida se pedia fenótipo ou genótipo.',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  }
];

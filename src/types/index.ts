export type EnergyLevel = 'low' | 'medium' | 'high';

export type ActionDecision = 'FAZER' | 'ADIAR' | 'NAO_FAZER';

export type TaskCategory = 'teoria' | 'questoes' | 'revisao' | 'correcao' | 'simulado';

export type ErrorType = 
  | 'conceitual' 
  | 'interpretacao' 
  | 'calculo' 
  | 'estrategia' 
  | 'atencao' 
  | 'tempo' 
  | 'pre_requisito'
  | 'outro';

export type CognitivePattern = 
  | 'proporcionalidade' 
  | 'analise_grafica' 
  | 'causa_efeito' 
  | 'conservacao' 
  | 'comparacao' 
  | 'decomposicao' 
  | 'inferencia' 
  | 'raciocinio_espacial' 
  | 'interpretacao';

export interface UserProfile {
  id: string;
  name: string;
  targetCourse: string; // e.g. 'Medicina', 'Direito', 'Engenharia de Computação'
  targetUniversities: string[]; // e.g. ['USP', 'Unicamp', 'UNESP']
  targetExams: string[]; // e.g. ['FUVEST', 'ENEM']
  availableHoursPerDay: number; // e.g. 4.5
  currentEnergyLevel: EnergyLevel;
  autonomyIndex: number; // 0 to 100
  studyDaysPerWeek: number;
  hasOnboarded: boolean;
  diagnostic?: InitialLearningDiagnostic;
}

export type HypothesisStatus = 
  | 'NEW' 
  | 'TESTING' 
  | 'SUPPORTED' 
  | 'WEAKENED' 
  | 'REJECTED' 
  | 'INSUFFICIENT_DATA';

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export type CategoryClassification = 
  | 'STRENGTH' 
  | 'PERCEIVED_STRENGTH' 
  | 'OBSERVED_POSITIVE_SIGNAL' 
  | 'OBSERVED_STRENGTH' 
  | 'FRAGILE_STRENGTH' 
  | 'BOTTLENECK' 
  | 'PERCEIVED_DIFFICULTY' 
  | 'OBSERVED_BOTTLENECK' 
  | 'UNKNOWN';

export interface GraphVisualData {
  type: 'bar' | 'line';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  labels: string[];
  values: number[];
}

export interface MicroAssessmentOption {
  id: string;
  label: string;
  isCorrect: boolean;
  distractorType?: 'superficial' | 'calculation' | 'conceptual' | 'interpretation';
}

export interface MicroAssessmentActivity {
  id: string;
  activityType: 'logic' | 'geometry' | 'graph' | 'stoichiometry' | 'interpretation';
  title: string;
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  topicName?: string;
  context: string;
  graphData?: GraphVisualData;
  options: MicroAssessmentOption[];
  hintText: string;
  requiresReasoningExplanation?: boolean;
  cognitivePatterns: string[];
  isTimedAssessment?: boolean;
  timeLimitSeconds?: number;
}

export interface MicroAssessmentResult {
  id: string;
  activityId: string;
  activityType: string;
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  topicName?: string;
  chosenOptionId?: string;
  chosenDistractorType?: 'superficial' | 'calculation' | 'conceptual' | 'interpretation';
  correct: boolean;
  confidenceBefore: ConfidenceLevel; // 1: Chute ... 5: Certeza
  confidenceAtAnswer?: ConfidenceLevel;
  responseTimeSeconds: number;
  hintCount: number;
  changedAnswer: boolean;
  reasoningText?: string;
  selfCorrection?: boolean;
  cognitivePatterns: string[];
  isTimedAssessment?: boolean;

  // Two-attempt detailed fields (Rodada 1.3)
  firstAttemptOptionId?: string;
  firstAttemptCorrect?: boolean;
  firstAttemptConfidence?: ConfidenceLevel;
  firstAttemptReasoningText?: string;
  secondAttemptOptionId?: string;
  secondAttemptCorrect?: boolean;
  secondAttemptConfidence?: ConfidenceLevel;
  secondAttemptReasoningText?: string;
}

export interface DiagnosticInsightItem {
  id: string;
  title: string;
  description: string;
  category: CategoryClassification;
  source: 'perceived' | 'observed';
  cognitivePattern?: string;
}

export type DiagnosticHypothesisType = 
  | 'PASSIVE_CORRECTION'
  | 'CONFIDENCE_RESULT_DIVERGENCE'
  | 'OVERPRACTICE_SAME_LEVEL'
  | 'LOW_CONFIDENCE_CORRECT'
  | 'INSUFFICIENT_DATA';

export interface DiagnosticHypothesis {
  id: string;
  type: DiagnosticHypothesisType;
  text: string;
  confidence: 'BAIXA' | 'MODERADA' | 'ALTA';
  factObserved: string;
  hypothesisText: string;
  howToVerify: string;
  whyReasons: string[];
  status: HypothesisStatus;
}

export interface SevenDayExperiment {
  id: string;
  hypothesis: string;
  coreChanges: string[]; // 1 to 2 changes max
  rulesToFollow: string[];
  metricsToWatch: string;
  durationDays: number;
}

export interface InitialLearningDiagnostic {
  id: string;
  userId: string;
  createdAt: string;
  completedAt?: string;
  currentStep: number; // 1-7 Camada A, 8 Camada B, 9 Resumo
  
  // Camada A: Autopercepção
  selfReportedState: string[];
  errorHandlingProfile: string[];
  errorRepeatReaction: string;
  reasoningAwareness?: string;
  successHandlingProfile: string;
  successStreakBehavior: string;
  perceivedDifficulties: string[];
  perceivedStrengths: string[];
  currentStudyMethods: Record<string, 'Nunca' | 'Pouco' | 'Às vezes' | 'Frequentemente' | 'Muito' | null>;
  biggestTimeDrain: string;
  efficiencyPerception: number | null; // 1-5 or null
  planCompletionFrequency: string;
  unfinishedPlanBehavior: string;

  // Camada B: Microdiagnóstico Objetivo
  microAssessmentResults: MicroAssessmentResult[];

  // Separação Estrutural de Percepção vs Observação
  perceivedStrengthInsights?: DiagnosticInsightItem[];
  perceivedDifficultyInsights?: DiagnosticInsightItem[];
  observedPositiveSignals?: DiagnosticInsightItem[];
  observedBottlenecks?: DiagnosticInsightItem[];

  // Compatibilidade Legada / Aliases
  strengths: DiagnosticInsightItem[];
  fragileStrengths: DiagnosticInsightItem[];
  bottlenecks: DiagnosticInsightItem[];
  unknowns: DiagnosticInsightItem[];
  
  initialHypothesis?: DiagnosticHypothesis;
  firstExperiment?: SevenDayExperiment;
}

export interface DiagnosticDraft {
  id: string;
  userId: string;
  currentStep: number;
  formState: {
    selfReportedState: string[];
    errorHandling: string[];
    errorRepeatReaction: string;
    reasoningAwareness?: string;
    successHandling: string;
    successStreakBehavior: string;
    difficulties: string[];
    strengths: string[];
    studyMethods: Record<string, 'Nunca' | 'Pouco' | 'Às vezes' | 'Frequentemente' | 'Muito' | null>;
    biggestTimeDrain: string;
    efficiencyPerception: number | null;
    planCompletionFrequency: string;
    unfinishedPlanBehavior: string;
  };
  currentMicroIdx: number;
  microResults: MicroAssessmentResult[];
  selectedActivityIds: string[];
  finalDiagnostic?: InitialLearningDiagnostic;
  timestamp: string;
}

export interface LearningProfile {
  userId: string;
  diagnostic: InitialLearningDiagnostic;
  lastUpdated: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  iconName: string;
}

export interface TopicNode {
  id: string;
  subjectId: string;
  name: string;
  masteryLevel: number; // 1 to 10 (1=Nunca vi, 5=Compreendo mas não aplico, 8=Resolvo difíceis, 10=Consigo transferir)
  prerequisites: string[]; // array of topic IDs
  weightInExam: number; // 1 to 10 (incidence)
  lastReviewedAt?: string;
  cognitivePattern?: CognitivePattern;
}

export interface TaskItem {
  id: string;
  subjectId: string;
  topicId?: string;
  title: string;
  durationMinutes: number;
  energyRequired: EnergyLevel;
  decision: ActionDecision;
  rationale: string;
  urgency: number; // 1-10
  impact: number; // 1-10
  isCritical: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  category: TaskCategory;
  dueDate?: string;
  abandonReason?: string;
}

export interface ErrorEntry {
  id: string;
  questionTitle: string;
  subjectId: string;
  topicId: string;
  examSource?: string;
  errorType: ErrorType;
  studentReasoning: string;
  correctedReasoning: string;
  keyInsight: string;
  recordedAt: string;
  reviewStatus: 'pending' | 'mastered';
  aiAnalysis?: string;
  questionId?: string;
  attemptId?: string;
  confidenceAtAttempt?: ConfidenceLevel | null;
  reflectionTag?: AttemptReflectionTag;
}

export interface StudySession {
  id: string;
  userId: string;
  taskId?: string;
  subjectId: string;
  topicId?: string;
  plannedMinutes: number;
  actualMinutes: number;
  energyLevel: EnergyLevel;
  comprehensionScore: number; // 1 to 5
  canExplain: boolean;
  methodUsed: string;
  notes: string;
  completedAt: string;
}

export interface MethodExperiment {
  id: string;
  name: string;
  methodType: string; // e.g. 'Feynman', 'Pomodoro 45/15', 'Questões Antes da Teoria'
  problem: string;
  hypothesis: string;
  startDate: string;
  status: 'active' | 'completed';
  resultDecision: 'MANTER' | 'ADAPTAR' | 'ABANDONAR';
  keyInsights: string;
}

export interface Discovery {
  id: string;
  title: string;
  description: string;
  discoveredAt: string;
  category: 'method' | 'timing' | 'format' | 'subject';
}

export interface PodcastChapter {
  timestampSeconds: number;
  title: string;
}

export interface PodcastTranscript {
  timestampSeconds: number;
  speaker: string;
  text: string;
}

export interface PodcastRecallQuestion {
  id: string;
  question: string;
  answer: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  subjectId: string;
  topicId?: string;
  durationSeconds: number;
  focusType: 'Aprender do Zero' | 'Revisar Erros' | 'Pré-Prova' | 'Conexões Interdisciplinares' | 'Pré-Requisitos';
  chapters: PodcastChapter[];
  transcript: PodcastTranscript[];
  activeRecallQuestions: PodcastRecallQuestion[];
  keyTakeaways: string[];
  createdAt: string;
  audioBlobUrl?: string;
}

export interface GoogleIntegration {
  id: string;
  service: 'Calendar' | 'Drive' | 'Classroom' | 'Docs' | 'Sheets';
  connected: boolean;
  accountEmail?: string;
  lastSyncedAt?: string;
  description: string;
}

// ==========================================
// RODADA 2: QUESTÕES, TENTATIVAS E EVIDÊNCIAS
// ==========================================

export type AttemptResult = 
  | 'CORRECT_CONFIDENT' // Acertei com segurança
  | 'CORRECT_UNCERTAIN' // Acertei, mas fiquei em dúvida
  | 'CORRECT_GUESS'     // Acertei por chute/eliminação sem segurança
  | 'WRONG'             // Errei
  | 'BLANK'             // Deixei em branco
  | 'NO_TIME';          // Sem tempo de concluir

export type AttemptReflectionTag = 
  | 'DIDNT_KNOW_CONCEPT'
  | 'DIDNT_KNOW_STRATEGY'
  | 'MISINTERPRETED'
  | 'CALCULATION_ERROR'
  | 'ATTENTION_ERROR'
  | 'TIME_PROBLEM'
  | 'PREREQUISITE_GAP'
  | 'UNSURE'
  | 'OTHER';

export type QuestionSourceType = 'MANUAL' | 'MATERIAL' | 'EXAM' | 'SIMULATED' | 'OTHER';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'UNKNOWN';

export interface Question {
  id: string;
  userId: string;
  title: string;
  statement?: string;
  subjectId: string;
  topicIds: string[];
  sourceType: QuestionSourceType;
  exam?: string;
  year?: number;
  sourceName?: string;
  questionNumber?: string;
  difficulty?: QuestionDifficulty;
  imageUrl?: string;
  correctAnswer?: string;
  answerReference?: string;
  questionType?: 'OBJECTIVE' | 'DISCURSIVE';
  createdAt: string;
}

export interface AttemptStage {
  result?: AttemptResult;
  answer?: string;
  correct?: boolean;
  confidence?: ConfidenceLevel | null;
  reasoningText?: string;
  reflectionTag?: AttemptReflectionTag;
  timestamp?: string;
  assistanceContext?: 'INDEPENDENT_RETRY' | 'AFTER_SOLUTION';
}

export interface Attempt {
  id: string;
  userId: string;
  questionId: string;
  reviewId?: string;
  result: AttemptResult;
  confidence: ConfidenceLevel | null;
  startedAt?: string;
  completedAt: string;
  durationSeconds?: number;
  selectedAnswer?: string;
  reasoningText?: string;
  reasoningUpdatedAt?: string;
  usedHint?: boolean;
  hintCount?: number;
  reflectionTag?: AttemptReflectionTag;
  firstAttempt?: AttemptStage;
  secondAttempt?: AttemptStage;
  changedAnswer?: boolean;
  selfCorrection?: boolean;
  correctionBeforeSolution?: boolean | null;
  retryAfterSolution?: boolean;
  errorEntryId?: string;
  createdAt: string;
}

export interface ReviewQuestionContext {
  reviewId: string;
  subjectId: string;
  topicId: string;
  sourceAttemptId?: string;
  questionId?: string;
}

export type LearningEvidenceSignal = 
  | 'STRONG_POSITIVE'
  | 'FRAGILE_POSITIVE'
  | 'NEGATIVE_SIGNAL'
  | 'CONFIDENCE_DIVERGENCE'
  | 'TIME_SIGNAL'
  | 'SELF_CORRECTION'
  | 'POST_SOLUTION'
  | 'UNKNOWN';

export interface LearningEvidence {
  id: string;
  userId: string;
  subjectId: string;
  topicIds: string[];
  type: 'QUESTION_ATTEMPT' | 'REVIEW_RESULT';
  sourceId: string; // Attempt ID or Review ID
  createdAt: string;
  signal: LearningEvidenceSignal;
  result?: AttemptResult;
  attemptResult?: AttemptResult;
  reviewOutcome?: ReviewCompletionOutcome;
  confidence: ConfidenceLevel | null;
  difficulty?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface AttemptInterpretation {
  signalType: LearningEvidenceSignal;
  title: string;
  explanation: string;
  recommendedNextAction?: 'ANALISAR_ERRO' | 'REVISITAR_DEPOIS' | 'JUSTIFICAR_RACIOCINIO' | 'CONCLUIR';
  confidence: ConfidenceLevel | null;
}

export interface ConfidenceCalibrationSummary {
  totalAttempts: number;
  totalRegisteredAttempts: number;
  eligibleAttempts: number;
  highConfidenceAttempts: number;
  highConfidenceCorrect: number;
  highConfidenceWrong: number;
  uncertainCorrect: number;
  guessCorrect: number;
  status: 'INSUFFICIENT_DATA' | 'AVAILABLE';
  sampleSizeNote: string;
}

// ==========================================
// MASTERY ENGINE TYPES (RODADA 3A)
// ==========================================

export type MasteryStatus = 
  | 'UNKNOWN'
  | 'INSUFFICIENT_EVIDENCE'
  | 'EMERGING'
  | 'FRAGILE'
  | 'ESTIMATED'
  | 'CONFLICTED';

export type MasteryConfidence = 'LOW' | 'MODERATE' | 'HIGH';

export type MasteryTrend = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';

export interface MasteryState {
  userId: string;
  topicId: string;
  status: MasteryStatus;
  estimatedLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | null;
  confidence: MasteryConfidence;
  evidenceCount: number;
  independentSourceCount: number;

  levelSupportingIndependentSourceCount: number;
  informativeIndependentSourceCount: number;
  fragileIndependentSourceCount: number;
  contradictingIndependentSourceCount: number;
  assistedIndependentSourceCount: number;

  strongPositiveCount: number;
  fragilePositiveCount: number;
  negativeCount: number;
  confidenceDivergenceCount: number;
  selfCorrectionCount: number;
  postSolutionCount: number;
  timeSignalCount: number;

  difficultiesObserved: QuestionDifficulty[];

  levelSupportingEvidenceIds: string[];
  fragileEvidenceIds: string[];
  assistedEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  timeEvidenceIds: string[];
  supportingEvidenceIds: string[]; // Deprecated alias for levelSupportingEvidenceIds

  lastEvidenceAt?: string;

  trend: MasteryTrend;

  uncertaintyReasons: string[];

  updatedAt?: string;
}

// ==================================================
// RODADA 3B — REVISÃO ADAPTATIVA
// ==================================================

export type ReviewType = 
  | 'ACTIVE_RECALL'
  | 'TARGETED_QUESTIONS'
  | 'ERROR_REVIEW'
  | 'REATTEMPT_WITHOUT_SUPPORT'
  | 'MINI_LIST'
  | 'ORAL_EXPLANATION'
  | 'FORMULA_RECONSTRUCTION'
  | 'THEORY_REFRESH'
  | 'DIAGNOSTIC_RETEST';

export type ReviewTriggerReason = 
  | 'FRAGILE_MASTERY'
  | 'CONFIDENCE_DIVERGENCE'
  | 'CORRECT_UNCERTAIN'
  | 'CORRECT_GUESS'
  | 'SELF_CORRECTION'
  | 'POST_SOLUTION_DEPENDENCY'
  | 'CONFLICTED_MASTERY'
  | 'RETENTION_CHECK'
  | 'ERROR_RECURRENCE'
  | 'EXAM_RELEVANCE'
  | 'MANUAL_REQUEST';

export type ReviewPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'MAINTENANCE';

export type ReviewStatus = 
  | 'SCHEDULED'
  | 'AVAILABLE'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELED'
  | 'REASSESS';

export type RecommendationConfidence = 'LOW' | 'MODERATE' | 'HIGH';

export type ReviewAction = 'NO_REVIEW_NOW' | 'SCHEDULE_REVIEW' | 'DIAGNOSTIC_RETEST';

export interface Review {
  id: string;
  userId: string;

  subjectId: string;
  topicId: string;

  reviewType: ReviewType;
  triggerReason: ReviewTriggerReason;

  status: ReviewStatus;
  priority: ReviewPriority;

  sourceEvidenceIds: string[];
  sourceAttemptIds?: string[];
  sourceErrorIds?: string[];

  createdAt: string;

  notBefore?: string;
  recommendedWindowStart?: string;
  recommendedWindowEnd?: string;

  estimatedMinutes: number;

  rationale: string;

  recommendationConfidence: RecommendationConfidence;

  policyVersion: string;
}

export interface ReviewDecision {
  action: ReviewAction;

  reviewType?: ReviewType;

  triggerReason?: ReviewTriggerReason;

  priority?: ReviewPriority;

  rationale: string;

  estimatedMinutes?: number;

  recommendedWindow?: {
    start: string;
    end: string;
  };

  recommendationConfidence: RecommendationConfidence;

  sourceEvidenceIds: string[];
  sourceAttemptIds?: string[];
  sourceErrorIds?: string[];
}

export type ReviewCompletionOutcome = 
  | 'SUCCESS_CONFIDENT'
  | 'SUCCESS_EFFORTFUL'
  | 'PARTIAL'
  | 'FAILED'
  | 'NOT_COMPLETED';

export interface ReviewCompletion {
  id: string;
  userId: string;
  reviewId: string;

  outcome: ReviewCompletionOutcome;

  confidence?: 1 | 2 | 3 | 4 | 5;

  actualMinutes?: number;

  linkedAttemptIds?: string[];

  notes?: string;

  completedAt: string;
}




import React, { useState, useEffect } from 'react';
import { 
  Question, 
  Attempt, 
  AttemptResult, 
  AttemptReflectionTag, 
  UserProfile, 
  Subject, 
  TopicNode, 
  ConfidenceLevel,
  AttemptInterpretation,
  ReviewQuestionContext
} from '../types';
import { Icon } from './Icon';
import { 
  questionRepository, 
  attemptRepository, 
  learningEvidenceRepository 
} from '../services/questionRepository';
import { 
  interpretAttempt, 
  createLearningEvidencesFromAttempt, 
  validateAttemptConsistency,
  getConfidenceCalibrationSummary,
  MIN_SAMPLE_SIZE_FOR_CALIBRATION
} from '../services/questionsEngine';
import { DEMO_QUESTIONS, DEMO_ATTEMPTS, DEMO_USER_ID } from '../data/demoQuestions';

interface QuestionsViewProps {
  user: UserProfile;
  subjects: Subject[];
  topics: TopicNode[];
  reviewContext?: ReviewQuestionContext | null;
  onReviewContextConsumed?: () => void;
  onReturnToReviews?: () => void;
  onOpenErrorNotebookWithError?: (errorData: {
    title: string;
    subjectId: string;
    topicId: string;
    reasoning: string;
    questionId?: string;
    attemptId?: string;
    confidence?: ConfidenceLevel | null;
    reflectionTag?: AttemptReflectionTag;
  }) => void;
}

export const QuestionsView: React.FC<QuestionsViewProps> = ({
  user,
  subjects,
  topics,
  reviewContext,
  onReviewContextConsumed,
  onReturnToReviews,
  onOpenErrorNotebookWithError,
}) => {
  const userId = user.id;

  // Active Subtab inside Questions View
  const [activeSubTab, setActiveSubTab] = useState<'recent' | 'revisit' | 'calibration'>('recent');

  // State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Modal State
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [selectedQuestionForRevisit, setSelectedQuestionForRevisit] = useState<Question | null>(null);

  // Form State for Attempt / Question Registration
  const [formSubjectId, setFormSubjectId] = useState<string>(subjects[0]?.id || 'mat');
  const [formTopicId, setFormTopicId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSourceType, setFormSourceType] = useState<Question['sourceType']>('MANUAL');
  const [formExam, setFormExam] = useState<string>('');
  const [formYear, setFormYear] = useState<string>('');
  const [formDifficulty, setFormDifficulty] = useState<Question['difficulty']>('MEDIUM');
  const [formStatement, setFormStatement] = useState<string>('');
  const [showDetailedFields, setShowDetailedFields] = useState<boolean>(false);

  // Attempt Form State (Confidence starts strictly as null)
  const [formResult, setFormResult] = useState<AttemptResult | null>(null);
  const [formConfidence, setFormConfidence] = useState<ConfidenceLevel | null>(null);
  const [formReasoning, setFormReasoning] = useState<string>('');
  const [formReflectionTag, setFormReflectionTag] = useState<AttemptReflectionTag | undefined>(undefined);
  const [formSelectedAnswer, setFormSelectedAnswer] = useState<string>('');
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Two attempt / Self-correction state
  const [firstAttemptResult, setFirstAttemptResult] = useState<AttemptResult | null>(null);
  const [firstAttemptConfidence, setFirstAttemptConfidence] = useState<ConfidenceLevel | null>(null);
  const [firstAttemptReasoning, setFirstAttemptReasoning] = useState<string>('');
  const [firstAttemptAnswer, setFirstAttemptAnswer] = useState<string>('');
  const [firstAttemptTime, setFirstAttemptTime] = useState<string>('');
  const [firstAttemptReflectionTag, setFirstAttemptReflectionTag] = useState<AttemptReflectionTag | undefined>(undefined);
  
  const [isSecondStage, setIsSecondStage] = useState<boolean>(false);
  const [correctionBeforeSolution, setCorrectionBeforeSolution] = useState<boolean | null>(null);

  // Justification input inside submitted interpretation feedback
  const [justificationInput, setJustificationInput] = useState<string>('');
  const [justificationSaved, setJustificationSaved] = useState<boolean>(false);

  // Submitted Attempt Feedback
  const [submittedInterpretation, setSubmittedInterpretation] = useState<{
    interpretation: AttemptInterpretation;
    attempt: Attempt;
    question: Question;
  } | null>(null);

  // History Drawer State
  const [historyQuestion, setHistoryQuestion] = useState<Question | null>(null);

  // Review Context State
  const [activeReviewContext, setActiveReviewContext] = useState<ReviewQuestionContext | null>(null);
  const [missingOriginalNotice, setMissingOriginalNotice] = useState<boolean>(false);

  const clearActiveReviewContext = () => {
    setActiveReviewContext(null);
    setMissingOriginalNotice(false);
  };

  // Load Data
  const loadRepositoryData = () => {
    if (!userId) return;
    const loadedQs = questionRepository.getQuestionsByUser(userId);
    const loadedAtts = attemptRepository.getAttemptsByUser(userId);

    setQuestions(loadedQs);
    setAttempts(loadedAtts);
  };

  useEffect(() => {
    if (userId) {
      loadRepositoryData();
    }
  }, [userId]);

  // Handle ReviewContext from navigation
  useEffect(() => {
    if (reviewContext) {
      setActiveReviewContext(reviewContext);
      setMissingOriginalNotice(false);

      let foundQuestion: Question | null = null;

      if (reviewContext.questionId) {
        foundQuestion = questionRepository.getQuestionById(reviewContext.questionId, userId) || null;
      } else if (reviewContext.sourceAttemptId) {
        const userAtts = attemptRepository.getAttemptsByUser(userId);
        const sourceAtt = userAtts.find(a => a.id === reviewContext.sourceAttemptId);
        if (sourceAtt) {
          foundQuestion = questionRepository.getQuestionById(sourceAtt.questionId, userId) || null;
        }
      }

      if (foundQuestion) {
        handleOpenRegisterModal(foundQuestion);
      } else if (reviewContext.questionId || reviewContext.sourceAttemptId) {
        setMissingOriginalNotice(true);
        handleOpenRegisterModal();
        setFormSubjectId(reviewContext.subjectId);
        setFormTopicId(reviewContext.topicId);
      } else {
        handleOpenRegisterModal();
        setFormSubjectId(reviewContext.subjectId);
        setFormTopicId(reviewContext.topicId);
      }

      onReviewContextConsumed?.();
    }
  }, [reviewContext, userId, onReviewContextConsumed]);

  // Set default topic when subject changes, preserving existing topic if valid
  useEffect(() => {
    const subjectTopics = topics.filter(t => t.subjectId === formSubjectId);
    if (subjectTopics.length > 0) {
      if (!subjectTopics.some(t => t.id === formTopicId)) {
        setFormTopicId(subjectTopics[0].id);
      }
    } else {
      setFormTopicId('');
    }
  }, [formSubjectId, topics, formTopicId]);

  // Handle opening modal
  const handleOpenRegisterModal = (questionToRevisit?: Question) => {
    setSubmittedInterpretation(null);
    setJustificationInput('');
    setJustificationSaved(false);
    setIsSecondStage(false);
    setFirstAttemptResult(null);
    setFirstAttemptConfidence(null);
    setFirstAttemptReasoning('');
    setFirstAttemptAnswer('');
    setFirstAttemptTime('');
    setFirstAttemptReflectionTag(undefined);
    setCorrectionBeforeSolution(null);
    setFormErrorMessage(null);

    if (questionToRevisit) {
      setSelectedQuestionForRevisit(questionToRevisit);
      setFormSubjectId(questionToRevisit.subjectId);
      setFormTopicId(questionToRevisit.topicIds[0] || '');
      setFormTitle(questionToRevisit.title);
      setFormSourceType(questionToRevisit.sourceType);
      setFormExam(questionToRevisit.exam || '');
      setFormYear(questionToRevisit.year ? String(questionToRevisit.year) : '');
      setFormDifficulty(questionToRevisit.difficulty || 'MEDIUM');
      setFormStatement(questionToRevisit.statement || '');
    } else {
      setSelectedQuestionForRevisit(null);
      setFormTitle('');
      setFormStatement('');
      setFormExam('');
      setFormYear('');
      setFormSubjectId(subjects[0]?.id || 'mat');
      const subjectTopics = topics.filter(t => t.subjectId === (subjects[0]?.id || 'mat'));
      setFormTopicId(subjectTopics[0]?.id || '');
    }

    setFormResult(null);
    setFormConfidence(null); // Explicit null - no default confidence
    setFormReasoning('');
    setFormReflectionTag(undefined);
    setFormSelectedAnswer('');
    setShowRegisterModal(true);
  };

  // Explicit demo mode handlers
  const handleToggleDemoMode = () => {
    setIsDemoMode(!isDemoMode);
  };

  const handleSeedDemoData = () => {
    if (!userId) return;
    DEMO_QUESTIONS.forEach(q => {
      const qToSave = { ...q, userId };
      try { questionRepository.saveQuestion(qToSave); } catch (_e) {}
    });

    DEMO_ATTEMPTS.forEach(a => {
      const aToSave = { ...a, userId };
      try { attemptRepository.saveAttempt(aToSave); } catch (_e) {}
      const q = DEMO_QUESTIONS.find(item => item.id === a.questionId);
      if (q) {
        const evidences = createLearningEvidencesFromAttempt(aToSave, { ...q, userId });
        evidences.forEach(ev => {
          try { learningEvidenceRepository.saveEvidence(ev); } catch (_e) {}
        });
      }
    });

    setIsDemoMode(false);
    loadRepositoryData();
  };

  // Switch to stage 2 in 2-attempt mode
  const handleAdvanceToSecondAttemptStage = (beforeSolution: boolean) => {
    setFormErrorMessage(null);
    const consistency = validateAttemptConsistency(formResult, formConfidence);
    if (!consistency.valid) {
      setFormErrorMessage(consistency.errorMessage || 'Verifique o resultado e nível de confiança.');
      return;
    }

    setFirstAttemptResult(formResult);
    setFirstAttemptConfidence(formConfidence);
    setFirstAttemptReasoning(formReasoning);
    setFirstAttemptAnswer(formSelectedAnswer);
    setFirstAttemptTime(new Date().toISOString());
    setFirstAttemptReflectionTag(formReflectionTag);
    setCorrectionBeforeSolution(beforeSolution);

    setIsSecondStage(true);
    setFormResult(null); // Student must enter second result explicitly
    setFormConfidence(null); // Student must answer confidence again (do NOT auto-increment!)
    setFormReasoning('');
    setFormReflectionTag(undefined);
  };

  // Save Justification
  const handleSaveJustification = () => {
    if (!submittedInterpretation) return;
    const { attempt } = submittedInterpretation;
    const updated = attemptRepository.updateAttemptReasoning(attempt.id, attempt.userId, justificationInput.trim());
    if (updated) {
      setSubmittedInterpretation({
        ...submittedInterpretation,
        attempt: updated,
      });
      setJustificationSaved(true);
      loadRepositoryData();
    }
  };

  // Save Attempt
  const handleSaveAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMessage(null);

    const consistency = validateAttemptConsistency(formResult, formConfidence);
    if (!consistency.valid) {
      setFormErrorMessage(consistency.errorMessage || 'Verifique as escolhas de resultado e confiança.');
      return;
    }

    if (!userId) {
      setFormErrorMessage('Sessão de usuário inválida.');
      return;
    }

    const topicIds = formTopicId ? [formTopicId] : [];
    
    // 1. Create or get Question
    let questionToSave: Question;
    if (selectedQuestionForRevisit) {
      questionToSave = selectedQuestionForRevisit;
    } else {
      const qId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      questionToSave = {
        id: qId,
        userId,
        title: formTitle.trim() || `Questão — ${subjects.find(s => s.id === formSubjectId)?.name || 'Geral'}`,
        statement: formStatement.trim() || undefined,
        subjectId: formSubjectId,
        topicIds,
        sourceType: formSourceType,
        exam: formExam.trim() || undefined,
        year: formYear ? parseInt(formYear, 10) : undefined,
        difficulty: formDifficulty,
        questionType: 'OBJECTIVE',
        createdAt: new Date().toISOString(),
      };
      questionRepository.saveQuestion(questionToSave);
    }

    // 2. Determine outcome, selfCorrection & changedAnswer
    let finalResult = formResult!;
    let finalConfidence = formResult === 'BLANK' || formResult === 'NO_TIME' ? null : formConfidence;
    let finalReasoning = formReasoning.trim() || undefined;
    let selfCorrection = false;
    let changedAnswer: boolean | undefined = undefined;

    if (isSecondStage && firstAttemptResult) {
      if (firstAttemptAnswer && formSelectedAnswer) {
        changedAnswer = firstAttemptAnswer !== formSelectedAnswer;
      }
      if (
        firstAttemptResult === 'WRONG' && 
        ['CORRECT_CONFIDENT', 'CORRECT_UNCERTAIN', 'CORRECT_GUESS'].includes(finalResult) &&
        correctionBeforeSolution === true
      ) {
        selfCorrection = true;
      }
    }

    // 3. Create Attempt object
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const attemptToSave: Attempt = {
      id: attemptId,
      userId,
      questionId: questionToSave.id,
      reviewId: activeReviewContext?.reviewId || undefined,
      result: finalResult,
      confidence: finalConfidence,
      completedAt: nowIso,
      selectedAnswer: formSelectedAnswer.trim() || undefined,
      reasoningText: finalReasoning,
      reflectionTag: formReflectionTag,
      changedAnswer,
      selfCorrection,
      correctionBeforeSolution: isSecondStage ? (correctionBeforeSolution ?? undefined) : undefined,
      firstAttempt: firstAttemptResult ? {
        result: firstAttemptResult,
        correct: firstAttemptResult.startsWith('CORRECT'),
        confidence: firstAttemptConfidence,
        reasoningText: firstAttemptReasoning,
        answer: firstAttemptAnswer,
        reflectionTag: firstAttemptReflectionTag,
        timestamp: firstAttemptTime || nowIso,
      } : undefined,
      secondAttempt: isSecondStage ? {
        result: finalResult,
        correct: finalResult.startsWith('CORRECT'),
        confidence: finalConfidence,
        reasoningText: finalReasoning,
        answer: formSelectedAnswer,
        reflectionTag: formReflectionTag,
        timestamp: nowIso,
      } : undefined,
      createdAt: nowIso,
    };

    attemptRepository.saveAttempt(attemptToSave);

    // 4. Create Learning Evidences (preserves error history on self-correction!)
    const evidences = createLearningEvidencesFromAttempt(attemptToSave, questionToSave);
    evidences.forEach(ev => learningEvidenceRepository.saveEvidence(ev));

    // 5. Calculate interpretation
    const interpretation = interpretAttempt(attemptToSave, questionToSave);

    setSubmittedInterpretation({
      interpretation,
      attempt: attemptToSave,
      question: questionToSave,
    });

    // Refresh state lists
    loadRepositoryData();
  };

  const handleAnalyzeError = () => {
    if (!submittedInterpretation) return;
    const { question, attempt } = submittedInterpretation;

    if (onOpenErrorNotebookWithError) {
      onOpenErrorNotebookWithError({
        title: question.title,
        subjectId: question.subjectId,
        topicId: question.topicIds[0] || '',
        reasoning: attempt.reasoningText || '',
        questionId: question.id,
        attemptId: attempt.id,
        confidence: attempt.confidence,
        reflectionTag: attempt.reflectionTag || attempt.firstAttempt?.reflectionTag,
      });
    }
    setShowRegisterModal(false);
  };

  const displayQuestions = isDemoMode ? DEMO_QUESTIONS : questions;
  const displayAttempts = isDemoMode ? DEMO_ATTEMPTS : attempts;
  const effectiveUserId = isDemoMode ? DEMO_USER_ID : userId;

  // Get revisit items
  const revisitItems = attemptRepository.getQuestionsToRevisit(effectiveUserId, displayQuestions);

  // Confidence Calibration Summary
  const calibrationSummary = getConfidenceCalibrationSummary(effectiveUserId, displayAttempts);

  // Helper for topic name
  const getTopicName = (topicId?: string) => {
    if (!topicId) return 'Tópico Geral';
    const top = topics.find(t => t.id === topicId);
    return top ? top.name : topicId;
  };

  // Helper for subject name
  const getSubjectObj = (subjectId: string) => {
    return subjects.find(s => s.id === subjectId) || { name: subjectId, color: '#3b82f6' };
  };

  if (!userId) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
        <p className="font-bold text-rose-400">Identificação de usuário não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Questões & Tentativas</h1>
            {isDemoMode && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                MODO DEMONSTRAÇÃO ATIVO
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Registre suas tentativas práticas, observe sua confiança metacognitiva e alimente seu caderno de evidências.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onReturnToReviews && activeReviewContext && (
            <button
              onClick={() => {
                clearActiveReviewContext();
                onReturnToReviews();
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 flex items-center gap-2 transition"
            >
              <Icon name="ArrowLeft" size={15} />
              <span>Voltar para Revisões</span>
            </button>
          )}

          <button
            onClick={handleToggleDemoMode}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition"
          >
            <Icon name="Eye" size={15} className="text-blue-400" />
            <span>{isDemoMode ? 'Sair da Demonstração' : 'Ver Exemplos (Modo Demo)'}</span>
          </button>

          {isDemoMode && (
            <button
              onClick={handleSeedDemoData}
              className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/30 flex items-center gap-2 transition"
              title="Salvar dados de exemplo para seu histórico pessoal"
            >
              <Icon name="DownloadCloud" size={15} />
              <span>Fixar Exemplos no Meu Perfil</span>
            </button>
          )}

          <button
            onClick={() => handleOpenRegisterModal()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2 transition"
          >
            <Icon name="Plus" size={16} />
            <span>Registrar Tentativa</span>
          </button>
        </div>
      </div>

      {/* Persistent Active Review Context Banner */}
      {activeReviewContext && (
        <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-indigo-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Icon name="Target" size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Revisão adaptativa ativa — {topics.find((t) => t.id === activeReviewContext.topicId)?.name || 'Tópico'}
              </p>
              <p className="text-xs text-indigo-300/80 mt-0.5">
                As próximas tentativas serão vinculadas a esta revisão.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={clearActiveReviewContext}
              className="px-3.5 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-500/40 rounded-xl text-indigo-200 text-xs font-semibold transition"
            >
              Encerrar Contexto
            </button>
            {onReturnToReviews && (
              <button
                type="button"
                onClick={() => {
                  clearActiveReviewContext();
                  onReturnToReviews();
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Icon name="ArrowLeft" size={14} />
                <span>Voltar para Revisões</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('recent')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'recent'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Icon name="History" size={15} />
          <span>Tentativas Recentes ({displayAttempts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('revisit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'revisit'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Icon name="RotateCcw" size={15} />
          <span>Para Revisitar ({revisitItems.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('calibration')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'calibration'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Icon name="Gauge" size={15} />
          <span>Calibração de Confiança</span>
        </button>
      </div>

      {/* SUBTAB 1: TENTATIVAS RECENTES */}
      {activeSubTab === 'recent' && (
        <div className="space-y-4">
          {displayAttempts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Icon name="CheckSquare" size={24} />
              </div>
              <h3 className="text-sm font-bold text-white">Nenhuma tentativa registrada ainda</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Ao fazer questões de listas, materiais ou simulados, registre suas respostas para acompanhar sua precisão e calibração de confiança.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleOpenRegisterModal()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-2"
                >
                  <Icon name="Plus" size={16} />
                  <span>Registrar Primeira Questão</span>
                </button>
                <button
                  onClick={handleToggleDemoMode}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 inline-flex items-center gap-2"
                >
                  <Icon name="Eye" size={15} />
                  <span>Ver Exemplos de Demonstração</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...displayAttempts]
                .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
                .map((att) => {
                  const q = displayQuestions.find(item => item.id === att.questionId);
                  const subj = q ? getSubjectObj(q.subjectId) : { name: 'Geral', color: '#3b82f6' };

                  let resultBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                  let resultLabel: string = att.result;

                  switch (att.result) {
                    case 'CORRECT_CONFIDENT':
                      resultBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                      resultLabel = 'Acertei com Segurança';
                      break;
                    case 'CORRECT_UNCERTAIN':
                      resultBadgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                      resultLabel = 'Acertei com Dúvida';
                      break;
                    case 'CORRECT_GUESS':
                      resultBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                      resultLabel = 'Acertei por Acaso';
                      break;
                    case 'WRONG':
                      resultBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                      resultLabel = 'Errei';
                      break;
                    case 'BLANK':
                      resultBadgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
                      resultLabel = 'Em Branco';
                      break;
                    case 'NO_TIME':
                      resultBadgeClass = 'bg-orange-500/10 text-orange-400 border-orange-500/30';
                      resultLabel = 'Sem Tempo';
                      break;
                  }

                  return (
                    <div
                      key={att.id}
                      className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider text-white"
                            style={{ backgroundColor: `${subj.color}25`, border: `1px solid ${subj.color}50`, color: subj.color }}
                          >
                            {subj.name}
                          </span>

                          <span className="text-[10px] text-slate-500">
                            {new Date(att.completedAt || att.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-white leading-snug line-clamp-2">
                          {q ? q.title : 'Questão do Aluno'}
                        </h4>

                        <p className="text-[11px] text-slate-400">
                          {q ? getTopicName(q.topicIds[0]) : 'Tópico Geral'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className={`px-2 py-0.5 rounded border font-semibold text-[10px] ${resultBadgeClass}`}>
                            {resultLabel}
                          </span>

                          <div className="flex items-center gap-1 text-amber-400" title={`Confiança: ${att.confidence !== null ? `${att.confidence}/5` : 'Não informada'}`}>
                            <span className="text-[10px] font-bold text-slate-400 mr-1">Confiança:</span>
                            {att.confidence !== null ? (
                              Array.from({ length: 5 }).map((_, idx) => (
                                <Icon
                                  key={idx}
                                  name="Star"
                                  size={11}
                                  className={idx < (att.confidence || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}
                                />
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">N/A</span>
                            )}
                          </div>
                        </div>

                        {att.reasoningText && (
                          <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded border border-slate-800/60 line-clamp-2">
                            "{att.reasoningText}"
                          </p>
                        )}

                        {att.selfCorrection && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <Icon name="CheckCircle2" size={12} />
                            <span>Autocorreção registrada</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1">
                          {q && (
                            <button
                              onClick={() => {
                                setHistoryQuestion(q);
                              }}
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                            >
                              <Icon name="History" size={12} />
                              <span>Ver Histórico</span>
                            </button>
                          )}

                          {q && (
                            <button
                              onClick={() => handleOpenRegisterModal(q)}
                              className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                            >
                              <Icon name="RotateCcw" size={12} />
                              <span>Revisitar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: QUESTÕES PARA REVISITAR */}
      {activeSubTab === 'revisit' && (
        <div className="space-y-4">
          {revisitItems.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <Icon name="CheckCircle2" size={24} />
              </div>
              <h3 className="text-sm font-bold text-white">Nenhuma questão precisando de revisita imediata</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Questões onde você registrou dúvida, chute ou erro serão listadas aqui para novos testes práticos sem apagar o histórico anterior.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {revisitItems.map(({ question, lastAttempt, attemptCount }) => {
                const subj = getSubjectObj(question.subjectId);

                return (
                  <div
                    key={question.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: `${subj.color}25`, border: `1px solid ${subj.color}50`, color: subj.color }}
                        >
                          {subj.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {getTopicName(question.topicIds[0])}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          • {attemptCount} {attemptCount === 1 ? 'tentativa' : 'tentativas'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">
                        {question.title}
                      </h4>

                      {question.statement && (
                        <p className="text-xs text-slate-400 line-clamp-1">
                          {question.statement}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                        <span>Último resultado:</span>
                        <span className="font-semibold text-slate-300">
                          {lastAttempt.result === 'WRONG' && 'Errou'}
                          {lastAttempt.result === 'CORRECT_UNCERTAIN' && 'Acertou com Dúvida'}
                          {lastAttempt.result === 'CORRECT_GUESS' && 'Acertou por Acaso'}
                          {lastAttempt.result === 'NO_TIME' && 'Sem Tempo'}
                          {lastAttempt.result === 'BLANK' && 'Em Branco'}
                        </span>
                        <span>(Confiança {lastAttempt.confidence !== null ? `${lastAttempt.confidence}/5` : 'N/A'})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => setHistoryQuestion(question)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <Icon name="History" size={14} />
                        <span>Histórico</span>
                      </button>

                      <button
                        onClick={() => handleOpenRegisterModal(question)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                      >
                        <Icon name="RotateCcw" size={14} />
                        <span>Revisitar Agora</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: CALIBRAÇÃO DE CONFIANÇA */}
      {activeSubTab === 'calibration' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="Gauge" size={16} className="text-blue-400" />
                  <span>Sua Calibração de Confiança Metacognitiva</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparação factual entre a confiança assinalada e o resultado obtido.
                </p>
              </div>

              <span className="text-[11px] font-semibold text-slate-400 px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
                {calibrationSummary.sampleSizeNote}
              </span>
            </div>

            {calibrationSummary.status === 'INSUFFICIENT_DATA' ? (
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800/80 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Icon name="Info" size={20} />
                </div>
                <h4 className="text-xs font-bold text-slate-300">Amostra em construção</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {calibrationSummary.sampleSizeNote} Continue registrando suas questões para acompanhar sua calibração de confiança.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[11px] text-slate-400 font-medium">Alta Confiança (4-5/5)</p>
                  <p className="text-xl font-extrabold text-white">
                    {calibrationSummary.highConfidenceAttempts} <span className="text-xs font-normal text-slate-400">tentativas</span>
                  </p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    • <strong className="text-emerald-400">{calibrationSummary.highConfidenceCorrect} acertos</strong> | <strong className="text-rose-400">{calibrationSummary.highConfidenceWrong} erros</strong>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[11px] text-slate-400 font-medium">Acertos com Dúvida</p>
                  <p className="text-xl font-extrabold text-blue-400">
                    {calibrationSummary.uncertainCorrect} <span className="text-xs font-normal text-slate-400">questões</span>
                  </p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Questões que você acertou, mas marcou com dúvida.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[11px] text-slate-400 font-medium">Acertos por Acaso / Chute</p>
                  <p className="text-xl font-extrabold text-amber-400">
                    {calibrationSummary.guessCorrect} <span className="text-xs font-normal text-slate-400">questões</span>
                  </p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Acertos por chute/eliminação serão tratados como evidência frágil, não como evidência forte.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                  <Icon name="CheckSquare" size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedQuestionForRevisit ? `Revisitar: ${selectedQuestionForRevisit.title}` : (isSecondStage ? '2ª Tentativa — Testar Autocorreção' : 'Registrar Nova Tentativa')}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedQuestionForRevisit ? 'Nova tentativa preservando o histórico anterior' : 'Registro factual de resolução'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            {activeReviewContext && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-indigo-300 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <Icon name="Target" size={16} className="text-indigo-400 shrink-0" />
                  <div>
                    <span>Origem: Revisão Adaptativa ({topics.find(t => t.id === activeReviewContext.topicId)?.name || 'Tópico'})</span>
                    <p className="text-[10px] text-indigo-300/70 font-normal">As tentativas já registradas continuarão vinculadas a esta revisão.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={clearActiveReviewContext}
                    className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 rounded-lg text-indigo-200 text-[11px] font-bold transition"
                  >
                    Encerrar Contexto
                  </button>
                  {onReturnToReviews && (
                    <button
                      type="button"
                      onClick={() => {
                        clearActiveReviewContext();
                        onReturnToReviews();
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <Icon name="ArrowLeft" size={12} />
                      <span>Voltar para Revisões</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {missingOriginalNotice && (
              <div className="mx-5 mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-xs font-medium">
                <Icon name="AlertTriangle" size={16} className="text-amber-400" />
                <span>A questão original não foi localizada. Registre uma questão semelhante deste tópico.</span>
              </div>
            )}

            {/* Modal Body */}
            {submittedInterpretation ? (
              /* IMMEDIATE FEEDBACK CARD AFTER SUBMIT */
              <div className="p-6 space-y-5">
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                      <Icon name="Zap" size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        Interpretação JUJU
                      </span>
                      <h4 className="text-base font-bold text-white leading-tight">
                        {submittedInterpretation.interpretation.title}
                      </h4>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    {submittedInterpretation.interpretation.explanation}
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {submittedInterpretation.interpretation.recommendedNextAction === 'ANALISAR_ERRO' && (
                      <button
                        onClick={handleAnalyzeError}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2"
                      >
                        <Icon name="AlertTriangle" size={15} />
                        <span>Analisar Erro no Caderno de Erros</span>
                      </button>
                    )}

                    {submittedInterpretation.interpretation.recommendedNextAction === 'JUSTIFICAR_RACIOCINIO' && (
                      <div className="w-full space-y-2 pt-2 border-t border-slate-800">
                        <label className="block text-xs font-semibold text-amber-300">
                          Registrar Justificativa de Raciocínio (por que a escolha fazia sentido?):
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Explique o que motivou seu raciocínio nesta questão..."
                          value={justificationInput}
                          onChange={(e) => setJustificationInput(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveJustification}
                            disabled={!justificationInput.trim()}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Icon name="FileText" size={14} />
                            <span>Salvar Justificativa</span>
                          </button>
                          {justificationSaved && (
                            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                              <Icon name="Check" size={14} />
                              <span>Justificativa registrada com sucesso!</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {submittedInterpretation.interpretation.recommendedNextAction === 'REVISITAR_DEPOIS' && (
                      <div className="w-full space-y-2">
                        <p className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                          <Icon name="RotateCcw" size={14} />
                          <span>Esta questão foi adicionada a Para Revisitar.</span>
                        </p>
                        <button
                          onClick={() => {
                            setShowRegisterModal(false);
                            setActiveSubTab('revisit');
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-2"
                        >
                          <span>Ver Lista Para Revisitar</span>
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setShowRegisterModal(false)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2"
                    >
                      <Icon name="Check" size={15} />
                      <span>Concluir</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* INPUT FORM */
              <form onSubmit={handleSaveAttempt} className="p-6 space-y-5">
                {formErrorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <Icon name="AlertTriangle" size={16} />
                    <span>{formErrorMessage}</span>
                  </div>
                )}

                {/* 1. Question Context (if new) */}
                {!selectedQuestionForRevisit && !isSecondStage && (
                  <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Identificação da Questão</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Matéria *</label>
                        <select
                          value={formSubjectId}
                          onChange={(e) => setFormSubjectId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Tópico *</label>
                        <select
                          value={formTopicId}
                          onChange={(e) => setFormTopicId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          {topics
                            .filter(t => t.subjectId === formSubjectId)
                            .map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Identificação / Título *</label>
                      <input
                        type="text"
                        placeholder="Ex: Questão 14 — Lista de Geometria ou FUVEST 2024"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Toggle Detailed Fields */}
                    <button
                      type="button"
                      onClick={() => setShowDetailedFields(!showDetailedFields)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 pt-1"
                    >
                      <Icon name={showDetailedFields ? 'ChevronUp' : 'ChevronDown'} size={14} />
                      <span>{showDetailedFields ? 'Ocultar campos detalhados' : 'Adicionar campos detalhados (Banca, Ano, Enunciado...)'}</span>
                    </button>

                    {showDetailedFields && (
                      <div className="space-y-3 pt-2 border-t border-slate-800/80">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">Banca / Origem</label>
                            <input
                              type="text"
                              placeholder="Ex: FUVEST, ENEM"
                              value={formExam}
                              onChange={(e) => setFormExam(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">Ano</label>
                            <input
                              type="number"
                              placeholder="Ex: 2024"
                              value={formYear}
                              onChange={(e) => setFormYear(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">Dificuldade</label>
                            <select
                              value={formDifficulty}
                              onChange={(e) => setFormDifficulty(e.target.value as Question['difficulty'])}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                            >
                              <option value="EASY">Fácil</option>
                              <option value="MEDIUM">Média</option>
                              <option value="HARD">Difícil</option>
                              <option value="UNKNOWN">Não sei avaliar</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Texto do Enunciado (opcional)</label>
                          <textarea
                            rows={2}
                            placeholder="Resumo do comando ou enunciado..."
                            value={formStatement}
                            onChange={(e) => setFormStatement(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Second Attempt Retrospective Header */}
                {isSecondStage && (
                  <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/60 space-y-1.5">
                    <p className="text-xs font-bold text-blue-200">
                      1ª Tentativa: <span className="text-rose-400">Errei</span> (Confiança {firstAttemptConfidence !== null ? `${firstAttemptConfidence}/5` : 'N/A'})
                    </p>
                    <p className="text-xs text-slate-300">
                      2ª Tentativa ({correctionBeforeSolution === true ? 'Tentei antes da resolução' : 'Consultei a resolução antes'})
                    </p>
                  </div>
                )}

                {/* 2. RESULT SELECTION (6 STATES) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-200">
                    {isSecondStage ? 'Resultado da 2ª Tentativa *' : 'Resultado da Tentativa *'}
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => { setFormResult('CORRECT_CONFIDENT'); setFormErrorMessage(null); }}
                      className={`p-3 rounded-xl border text-left transition ${
                        formResult === 'CORRECT_CONFIDENT'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold ring-1 ring-emerald-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">Acertei com Segurança</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Sem dúvida no raciocínio</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFormResult('CORRECT_UNCERTAIN'); setFormErrorMessage(null); }}
                      className={`p-3 rounded-xl border text-left transition ${
                        formResult === 'CORRECT_UNCERTAIN'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold ring-1 ring-blue-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">Acertei com Dúvida</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Fiquei vacilante</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFormResult('CORRECT_GUESS'); setFormErrorMessage(null); }}
                      className={`p-3 rounded-xl border text-left transition ${
                        formResult === 'CORRECT_GUESS'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold ring-1 ring-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">Acertei por Acaso</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Chute / eliminação</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFormResult('WRONG'); setFormErrorMessage(null); }}
                      className={`p-3 rounded-xl border text-left transition ${
                        formResult === 'WRONG'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold ring-1 ring-rose-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">Errei</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Resposta incorreta</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFormResult('BLANK'); setFormErrorMessage(null); }}
                      className={`p-3 rounded-xl border text-left transition ${
                        formResult === 'BLANK'
                          ? 'bg-slate-700/40 border-slate-500 text-slate-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">Em Branco</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Não tentei</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFormResult('NO_TIME'); setFormErrorMessage(null); }}
                      className={`p-3 rounded-xl border text-left transition ${
                        formResult === 'NO_TIME'
                          ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold ring-1 ring-orange-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">Sem Tempo</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Tempo estourado</p>
                    </button>
                  </div>
                </div>

                {/* 3. CONFIDENCE LEVEL (1 to 5) - Hidden for Blank / No Time */}
                {formResult !== 'BLANK' && formResult !== 'NO_TIME' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-200">
                        Nível de Confiança Registrado (1 a 5) *
                      </label>
                      {formConfidence === null && formResult && (
                        <span className="text-[10px] text-amber-400 font-semibold">
                          Selecione seu nível de confiança
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {([1, 2, 3, 4, 5] as ConfidenceLevel[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => { setFormConfidence(level); setFormErrorMessage(null); }}
                          className={`py-2 rounded-xl border text-center font-bold text-xs transition ${
                            formConfidence === level
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {level} {level === 1 && '(Chute)'} {level === 5 && '(Certeza)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. OPTIONAL ALTERNATIVE / ANSWER FIELD */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Sua resposta / alternativa assinalada (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Letra B, ou 42 cm²"
                    value={formSelectedAnswer}
                    onChange={(e) => setFormSelectedAnswer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                {/* 5. REFLECTION TAG (If Wrong, Blank or No Time) */}
                {(formResult === 'WRONG' || formResult === 'BLANK' || formResult === 'NO_TIME') && (
                  <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <label className="block text-xs font-bold text-amber-300">
                      O que parece ter acontecido? (Autopercepção)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {[
                        { tag: 'DIDNT_KNOW_CONCEPT', label: 'Não lembrava o conceito' },
                        { tag: 'DIDNT_KNOW_STRATEGY', label: 'Não sabia como começar' },
                        { tag: 'MISINTERPRETED', label: 'Interpretei errado' },
                        { tag: 'CALCULATION_ERROR', label: 'Erro de cálculo' },
                        { tag: 'ATTENTION_ERROR', label: 'Erro de atenção' },
                        { tag: 'TIME_PROBLEM', label: 'Faltou tempo' },
                        { tag: 'PREREQUISITE_GAP', label: 'Faltava pré-requisito' },
                        { tag: 'UNSURE', label: 'Não sei identificar' },
                      ].map(({ tag, label }) => (
                        <label
                          key={tag}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition ${
                            formReflectionTag === tag
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-semibold'
                              : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reflectionTag"
                            checked={formReflectionTag === tag}
                            onChange={() => setFormReflectionTag(tag as AttemptReflectionTag)}
                            className="hidden"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. REASONING TEXT (Optional) */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Como você pensou? / Raciocínio (opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Breve anotação do seu caminho de resolução..."
                    value={formReasoning}
                    onChange={(e) => setFormReasoning(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                {/* 7. TWO-ATTEMPT MODE TOGGLE (Self-Correction retrospective options) */}
                {!isSecondStage && formResult === 'WRONG' && (
                  <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/60 space-y-2">
                    <p className="text-xs font-bold text-blue-200">Você fez uma segunda tentativa desta questão?</p>
                    <p className="text-[10px] text-blue-300/80">
                      O JUJU registrará sua 1ª tentativa incorreta e abrirá o formulário para a 2ª tentativa.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAdvanceToSecondAttemptStage(true)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                      >
                        Sim (Tentei antes da resolução)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdvanceToSecondAttemptStage(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                      >
                        Sim (Consultei a resolução antes)
                      </button>
                    </div>
                  </div>
                )}

                {/* Modal Actions */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={!formResult}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/20"
                  >
                    Salvar Tentativa
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* QUESTION HISTORY DRAWER */}
      {historyQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Histórico de Tentativas
                </span>
                <h3 className="text-sm font-bold text-white">{historyQuestion.title}</h3>
              </div>
              <button
                onClick={() => setHistoryQuestion(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {attemptRepository.getAttemptsByQuestion(historyQuestion.id, effectiveUserId).map((att, idx, arr) => (
                <div key={att.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300">
                      Tentativa #{arr.length - idx}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(att.completedAt || att.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-blue-400">{att.result}</span>
                    <span className="text-amber-400 font-medium">Confiança: {att.confidence !== null ? `${att.confidence}/5` : 'N/A'}</span>
                  </div>

                  {att.reasoningText && (
                    <p className="text-xs text-slate-400 italic">
                      "{att.reasoningText}"
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setHistoryQuestion(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

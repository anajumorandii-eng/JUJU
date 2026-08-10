import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Subject, TopicNode, ErrorEntry, LearningEvidence, ReviewQuestionContext } from '../types';
import { Icon } from './Icon';
import {
  LocalReviewRepository,
  LocalReviewCompletionRepository,
} from '../services/reviewRepository';
import { LocalLearningEvidenceRepository, LocalAttemptRepository, LocalQuestionRepository } from '../services/questionRepository';
import {
  syncAdaptiveReviewsForUser,
  groupReviewsForDisplay,
  GroupedReviews,
  completeAdaptiveReview,
} from '../services/reviewOrchestrator';
import { Review, ReviewDecision, MasteryState, ReviewCompletionOutcome } from '../types';
import {
  formatReviewType,
  formatReviewPriority,
  formatReviewTriggerReason,
  formatConfidenceLabel,
  formatMasteryStatusLabel,
  formatReviewWindow,
  getReviewTypeInstruction,
  getInformativeNoReviewDecisions,
  formatReviewCompletionOutcome,
  summarizeReviewAttempts,
} from '../services/reviewPresentation';

export interface ReviewsViewProps {
  user: UserProfile;
  subjects: Subject[];
  topics: TopicNode[];
  errors: ErrorEntry[];
  focusReviewId?: string | null;
  onFocusReviewConsumed?: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenQuestionsFromReview?: (context: ReviewQuestionContext) => void;
  onOpenErrorFromReview?: (errorId: string) => void;
}

interface WhyModalData {
  topicId: string;
  topicName: string;
  subjectName: string;
  actionLabel: string;
  reviewType?: Review['reviewType'];
  triggerReason?: Review['triggerReason'];
  priority?: Review['priority'];
  recommendationConfidence?: Review['recommendationConfidence'];
  rationale: string;
  recommendedWindowStart?: string;
  recommendedWindowEnd?: string;
  sourceEvidenceIds: string[];
  sourceAttemptIds?: string[];
  sourceErrorIds?: string[];
  estimatedMinutes?: number;
}

interface InstructionModalData {
  review: Review;
  topicName: string;
  subjectName: string;
  reviewType: Review['reviewType'];
  estimatedMinutes: number;
  instruction: string;
}

interface CompletionModalData {
  review: Review;
  topicName: string;
  subjectName: string;
}

export const ReviewsView: React.FC<ReviewsViewProps> = ({
  user,
  subjects,
  topics,
  errors,
  focusReviewId,
  onFocusReviewConsumed,
  onNavigateTab,
  onOpenQuestionsFromReview,
  onOpenErrorFromReview,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<GroupedReviews | null>(null);
  const [masteryStates, setMasteryStates] = useState<Record<string, MasteryState>>({});
  const [userEvidences, setUserEvidences] = useState<LearningEvidence[]>([]);
  const [whyModal, setWhyModal] = useState<WhyModalData | null>(null);
  const [instructionModal, setInstructionModal] = useState<InstructionModalData | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [reevaluationNotice, setReevaluationNotice] = useState<string | null>(null);

  const [completionModal, setCompletionModal] = useState<CompletionModalData | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<ReviewCompletionOutcome | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<(1 | 2 | 3 | 4 | 5) | null>(null);
  const [inputActualMinutes, setInputActualMinutes] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const reviewRepo = useMemo(() => new LocalReviewRepository(), []);
  const completionRepo = useMemo(() => new LocalReviewCompletionRepository(), []);
  const evidenceRepo = useMemo(() => new LocalLearningEvidenceRepository(), []);
  const attemptRepo = useMemo(() => new LocalAttemptRepository(), []);
  const questionRepo = useMemo(() => new LocalQuestionRepository(), []);

  const handleOpenCompletionModal = (review: Review, topicName: string, subjectName: string) => {
    setCompletionModal({ review, topicName, subjectName });
    setSelectedOutcome(null);
    setSelectedConfidence(null);
    setInputActualMinutes('');
    setInputNotes('');
    setCompletionError(null);
  };

  const handleConfirmCompletion = () => {
    if (!completionModal || !selectedOutcome || isCompleting) return;

    const review = completionModal.review;
    const linkedAttempts = attemptRepo.getAttemptsByReview(review.id, user.id);
    const linkedAttemptIds = linkedAttempts.map((a) => a.id);

    const isQuestionBased = ['TARGETED_QUESTIONS', 'REATTEMPT_WITHOUT_SUPPORT', 'DIAGNOSTIC_RETEST'].includes(review.reviewType);
    if (isQuestionBased && linkedAttemptIds.length === 0 && selectedOutcome !== 'NOT_COMPLETED') {
      setCompletionError("Nenhuma tentativa foi registrada nesta revisão. Registre ao menos uma tentativa para concluir ou selecione 'Não consegui fazer agora'.");
      return;
    }

    setIsCompleting(true);
    setCompletionError(null);

    try {
      let actualMinutes: number | undefined = undefined;
      if (inputActualMinutes.trim() !== '') {
        const parsedMinutes = Number(inputActualMinutes.trim());
        if (isNaN(parsedMinutes) || !isFinite(parsedMinutes) || parsedMinutes <= 0) {
          setCompletionError('Informe um tempo válido em minutos.');
          return;
        }
        actualMinutes = Math.round(parsedMinutes);
      }

      completeAdaptiveReview({
        reviewId: review.id,
        userId: user.id,
        outcome: selectedOutcome,
        confidence: selectedConfidence || undefined,
        actualMinutes,
        linkedAttemptIds,
        notes: inputNotes.trim() || undefined,
        reviewRepository: reviewRepo,
        reviewCompletionRepository: completionRepo,
        learningEvidenceRepository: evidenceRepo,
      });

      setCompletionModal(null);
      loadAndSyncReviews();
    } catch (err: any) {
      console.error('Erro ao concluir revisão:', err);
      setCompletionError(err?.message || 'Erro ao registrar conclusão da revisão.');
      loadAndSyncReviews();
    } finally {
      setIsCompleting(false);
    }
  };

  const subjectsMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const topicsMap = useMemo(() => {
    const map = new Map<string, TopicNode>();
    topics.forEach((t) => map.set(t.id, t));
    return map;
  }, [topics]);

  const loadAndSyncReviews = () => {
    try {
      setLoading(true);
      setError(null);

      const evidences = evidenceRepo.getEvidencesByUser(user.id);
      setUserEvidences(evidences);

      const syncResult = syncAdaptiveReviewsForUser({
        userId: user.id,
        topics,
        evidences,
        errors,
        reviewRepository: reviewRepo,
        reviewCompletionRepository: completionRepo,
      });

      setMasteryStates(syncResult.masteryStates);

      const groupedResult = groupReviewsForDisplay({
        reviews: syncResult.reviews,
        noReviewDecisions: syncResult.noReviewDecisions,
      });

      setGrouped(groupedResult);
    } catch (err: any) {
      console.error('Erro ao sincronizar revisões adaptativas:', err);
      setError(err?.message || 'Falha na sincronização do motor de revisões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAndSyncReviews();
  }, [user.id, topics, errors]);

  // EFFECT A: Consumir foco externo recebido do App (focusReviewId)
  useEffect(() => {
    if (!focusReviewId || loading || !grouped) return;

    const availableMatch = grouped.available.find(r => r.id === focusReviewId);

    if (availableMatch) {
      setFocusedCardId(availableMatch.id);
      setReevaluationNotice(null);

      const { topicName, subjectName } = getTopicAndSubjectName(availableMatch.topicId);
      handleOpenInstructionModal(availableMatch, topicName, subjectName);
    } else {
      setReevaluationNotice('Esta recomendação foi reavaliada com os dados mais recentes.');
    }

    onFocusReviewConsumed?.();
  }, [focusReviewId, grouped, loading]);

  // EFFECT B: Lifecycle do destaque visual e scroll para o card focado (focusedCardId)
  useEffect(() => {
    if (!focusedCardId) return;

    const rafId = requestAnimationFrame(() => {
      const el = document.getElementById(`review-card-${focusedCardId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    const focusTimer = setTimeout(() => {
      setFocusedCardId(null);
    }, 4000);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(focusTimer);
    };
  }, [focusedCardId]);

  const getTopicAndSubjectName = (topicId: string) => {
    const topic = topicsMap.get(topicId);
    const subject = topic ? subjectsMap.get(topic.subjectId) : undefined;
    return {
      topicName: topic ? topic.name : topicId,
      subjectName: subject ? subject.name : 'Geral',
    };
  };

  const informativeNoReview = useMemo(() => {
    if (!grouped) return [];
    return getInformativeNoReviewDecisions({
      noReviewDecisions: grouped.noReviewNow,
      masteryStates,
      limit: 5,
    });
  }, [grouped, masteryStates]);

  const totalInformativeCount =
    (grouped?.available.length || 0) +
    (grouped?.scheduled.length || 0) +
    (grouped?.completed.length || 0) +
    informativeNoReview.length;

  const getPriorityBadgeStyle = (priority?: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'HIGH':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'MAINTENANCE':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/30';
    }
  };

  const handleOpenInstructionModal = (
    review: Review,
    topicName: string,
    subjectName: string
  ) => {
    setInstructionModal({
      review,
      topicName,
      subjectName,
      reviewType: review.reviewType,
      estimatedMinutes: review.estimatedMinutes,
      instruction: getReviewTypeInstruction(review.reviewType),
    });
  };

  const handleExecuteReviewAction = (review: Review) => {
    switch (review.reviewType) {
      case 'TARGETED_QUESTIONS':
      case 'DIAGNOSTIC_RETEST': {
        const context: ReviewQuestionContext = {
          reviewId: review.id,
          subjectId: review.subjectId,
          topicId: review.topicId,
        };
        onOpenQuestionsFromReview?.(context);
        break;
      }
      case 'REATTEMPT_WITHOUT_SUPPORT': {
        let questionId: string | undefined = undefined;
        let sourceAttemptId: string | undefined = review.sourceAttemptIds?.[0];

        if (sourceAttemptId) {
          const attempts = attemptRepo.getAttemptsByUser(user.id);
          const sourceAtt = attempts.find(a => a.id === sourceAttemptId);
          if (sourceAtt) {
            const q = questionRepo.getQuestionById(sourceAtt.questionId, user.id);
            if (q) {
              questionId = q.id;
            }
          }
        }

        const context: ReviewQuestionContext = {
          reviewId: review.id,
          subjectId: review.subjectId,
          topicId: review.topicId,
          sourceAttemptId,
          questionId,
        };
        onOpenQuestionsFromReview?.(context);
        break;
      }
      case 'ERROR_REVIEW': {
        const errorId = review.sourceErrorIds?.[0];
        const validError = errorId ? errors.find(e => e.id === errorId) : null;
        if (validError) {
          onOpenErrorFromReview?.(validError.id);
        } else {
          onOpenErrorFromReview?.('');
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Icon name="RotateCw" size={16} className="animate-spin-slow" />
            <span>Revisões Adaptativas JUJU</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Painel de Revisões</h1>
          <p className="text-xs text-slate-400 mt-1">
            O JUJU recomenda revisar apenas quando as evidências indicam que vale a pena investir tempo.
          </p>
        </div>

        <button
          onClick={loadAndSyncReviews}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition disabled:opacity-50 self-start md:self-auto"
        >
          <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
          <span>Sincronizar Agora</span>
        </button>
      </div>

      {/* Metric Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Revisar Agora</p>
            <p className="text-2xl font-bold text-white mt-1">{grouped?.available.length || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Icon name="PlayCircle" size={20} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wider">Próximas</p>
            <p className="text-2xl font-bold text-white mt-1">{grouped?.scheduled.length || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Icon name="Calendar" size={20} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Pode Esperar</p>
            <p className="text-2xl font-bold text-white mt-1">{informativeNoReview.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Icon name="CheckCircle2" size={20} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Concluídas</p>
            <p className="text-2xl font-bold text-white mt-1">{grouped?.completed.length || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
            <Icon name="History" size={20} />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Sincronizando evidências e calculando ciclo adaptativo...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-6 flex items-start gap-4">
          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
            <Icon name="AlertTriangle" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-rose-200">Erro no Processamento de Revisões</h3>
            <p className="text-xs text-rose-300/80 mt-1">{error}</p>
            <button
              onClick={loadAndSyncReviews}
              className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Content State */}
      {!loading && !error && (
        <>
          {/* True Empty State */}
          {totalInformativeCount === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <Icon name="Sparkles" size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Nenhuma revisão necessária agora.</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  O JUJU cria revisões apenas quando as evidências indicam que esse é um bom uso do seu tempo. Continue praticando no módulo de questões!
                </p>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('questoes')}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition inline-flex items-center gap-2"
                >
                  <Icon name="CheckSquare" size={16} />
                  <span>Registrar Questões</span>
                </button>
              )}
            </div>
          )}

          {/* Re-evaluation notice when focused review is no longer available */}
          {reevaluationNotice && (
            <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon name="Info" size={16} className="text-blue-400 shrink-0" />
                <span>{reevaluationNotice}</span>
              </div>
              <button
                onClick={() => setReevaluationNotice(null)}
                className="text-slate-400 hover:text-white"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          )}

          {/* Section 1: REVISAR AGORA (grouped.available) */}
          {grouped && grouped.available.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <h2 className="text-lg font-bold text-white tracking-tight">Revisar Agora</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                    {grouped.available.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Intervenções prontas na janela recomendada</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grouped.available.map((review) => {
                  const { topicName, subjectName } = getTopicAndSubjectName(review.topicId);
                  const linkedAttempts = attemptRepo.getAttemptsByReview(review.id, user.id);

                  return (
                    <div
                      key={review.id}
                      id={`review-card-${review.id}`}
                      className={`bg-slate-900 border ${
                        focusedCardId === review.id
                          ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                          : 'border-slate-800 hover:border-slate-700'
                      } p-5 rounded-2xl space-y-4 transition-all shadow-sm hover:shadow-md flex flex-col justify-between`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                              {subjectName}
                            </span>
                            <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                              {topicName}
                            </h3>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getPriorityBadgeStyle(
                              review.priority
                            )}`}
                          >
                            {formatReviewPriority(review.priority)}
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {linkedAttempts.length > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1.5">
                              <Icon name="CheckCircle2" size={12} className="text-emerald-400" />
                              <span>{linkedAttempts.length} tentativa(s) registrada(s)</span>
                            </span>
                          )}

                          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold flex items-center gap-1.5">
                            <Icon name="Target" size={12} />
                            {formatReviewType(review.reviewType)}
                          </span>

                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-medium flex items-center gap-1.5">
                            <Icon name="Zap" size={12} className="text-amber-400" />
                            {formatReviewTriggerReason(review.triggerReason)}
                          </span>

                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-medium flex items-center gap-1.5">
                            <Icon name="Clock" size={12} />
                            {review.estimatedMinutes} min
                          </span>

                          <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 font-medium flex items-center gap-1.5">
                            <Icon name="ShieldCheck" size={12} className="text-indigo-400" />
                            Confiança da recomendação: {formatConfidenceLabel(review.recommendationConfidence)}
                          </span>
                        </div>

                        {/* Rationale Snippet */}
                        {review.rationale && (
                          <p className="text-xs text-slate-300/90 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                            {review.rationale}
                          </p>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() =>
                            setWhyModal({
                              topicId: review.topicId,
                              topicName,
                              subjectName,
                              actionLabel: 'Revisar Agora',
                              reviewType: review.reviewType,
                              triggerReason: review.triggerReason,
                              priority: review.priority,
                              recommendationConfidence: review.recommendationConfidence,
                              rationale: review.rationale,
                              recommendedWindowStart: review.recommendedWindowStart,
                              recommendedWindowEnd: review.recommendedWindowEnd,
                              sourceEvidenceIds: review.sourceEvidenceIds,
                              sourceAttemptIds: review.sourceAttemptIds,
                              sourceErrorIds: review.sourceErrorIds,
                              estimatedMinutes: review.estimatedMinutes,
                            })
                          }
                          className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition"
                        >
                          <Icon name="HelpCircle" size={14} className="text-indigo-400" />
                          <span>Por Quê?</span>
                        </button>

                        <button
                          onClick={() =>
                            handleOpenInstructionModal(
                              review,
                              topicName,
                              subjectName
                            )
                          }
                          className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition"
                        >
                          <Icon name="BookOpen" size={14} />
                          <span>Ver como fazer</span>
                        </button>

                        <button
                          onClick={() => handleOpenCompletionModal(review, topicName, subjectName)}
                          className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition"
                        >
                          <Icon name="CheckCircle2" size={14} />
                          <span>Finalizar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: PRÓXIMAS REVISÕES (grouped.scheduled) */}
          {grouped && grouped.scheduled.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                <div className="flex items-center gap-2">
                  <Icon name="Calendar" size={18} className="text-blue-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">Próximas Revisões</h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[11px] font-bold">
                    {grouped.scheduled.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Agendadas para janelas futuras de retenção</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped.scheduled.map((review) => {
                  const { topicName, subjectName } = getTopicAndSubjectName(review.topicId);
                  const windowFormatted = formatReviewWindow(
                    review.recommendedWindowStart,
                    review.recommendedWindowEnd
                  );

                  return (
                    <div
                      key={review.id}
                      className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {subjectName}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-semibold border border-slate-700">
                            Janela sugerida: {windowFormatted}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white truncate">{topicName}</h4>

                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                            {formatReviewType(review.reviewType)}
                          </span>
                          <span className="text-slate-400">{review.estimatedMinutes} min</span>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setWhyModal({
                            topicId: review.topicId,
                            topicName,
                            subjectName,
                            actionLabel: 'Agendada Futura',
                            reviewType: review.reviewType,
                            triggerReason: review.triggerReason,
                            priority: review.priority,
                            recommendationConfidence: review.recommendationConfidence,
                            rationale: review.rationale,
                            recommendedWindowStart: review.recommendedWindowStart,
                            recommendedWindowEnd: review.recommendedWindowEnd,
                            sourceEvidenceIds: review.sourceEvidenceIds,
                            sourceAttemptIds: review.sourceAttemptIds,
                            sourceErrorIds: review.sourceErrorIds,
                            estimatedMinutes: review.estimatedMinutes,
                          })
                        }
                        className="w-full py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition"
                      >
                        <Icon name="HelpCircle" size={13} className="text-indigo-400" />
                        <span>Por Quê?</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: PODE ESPERAR (informativeNoReview) */}
          {informativeNoReview.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircle2" size={18} className="text-amber-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">Pode Esperar</h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                    {informativeNoReview.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Conteúdos em que revisar agora não parece ser o melhor uso do tempo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {informativeNoReview.map(({ topicId, decision }) => {
                  const { topicName, subjectName } = getTopicAndSubjectName(topicId);

                  return (
                    <div
                      key={topicId}
                      className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {subjectName}
                        </span>
                        <h4 className="text-sm font-bold text-slate-200 truncate">{topicName}</h4>
                        <div className="text-[11px] font-semibold text-emerald-400">
                          Não precisa revisar agora.
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {decision.rationale}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          setWhyModal({
                            topicId,
                            topicName,
                            subjectName,
                            actionLabel: 'Não Precisa Revisar Agora',
                            rationale: decision.rationale,
                            recommendationConfidence: decision.recommendationConfidence,
                            sourceEvidenceIds: decision.sourceEvidenceIds,
                            sourceAttemptIds: decision.sourceAttemptIds,
                            sourceErrorIds: decision.sourceErrorIds,
                          })
                        }
                        className="mt-2 w-full py-1.5 px-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold rounded-lg border border-slate-700/60 flex items-center justify-center gap-1 transition"
                      >
                        <Icon name="HelpCircle" size={13} className="text-indigo-400" />
                        <span>Por Quê?</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: CONCLUÍDAS E HISTÓRICO (grouped.completed) */}
          {grouped && grouped.completed.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                <div className="flex items-center gap-2">
                  <Icon name="History" size={18} className="text-slate-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">Histórico de Concluídas</h2>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-bold">
                    {grouped.completed.length}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {grouped.completed.map((review) => {
                  const { topicName, subjectName } = getTopicAndSubjectName(review.topicId);
                  const isSkipped = review.status === 'SKIPPED';
                  const completion = completionRepo.getCompletionsByReview(review.id).find((c) => c.userId === user.id) ?? null;

                  const statusText = completion
                    ? formatReviewCompletionOutcome(completion.outcome)
                    : isSkipped
                    ? 'Não realizada'
                    : 'Concluída';

                  return (
                    <div
                      key={review.id}
                      className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isSkipped
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          <Icon name={isSkipped ? 'SkipForward' : 'Check'} size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-200">{topicName}</p>
                          <p className="text-[10px] text-slate-500">
                            {subjectName} • {formatReviewType(review.reviewType)}
                            {completion?.actualMinutes ? ` • ${completion.actualMinutes} min` : ''}
                          </p>
                          {completion?.notes && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5">
                              "{completion.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-300 font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: "POR QUÊ?" (Explicabilidade Detalhada) */}
      {whyModal && (() => {
        const mastery = masteryStates[whyModal.topicId];
        const linkedEvidences = userEvidences.filter((ev) =>
          whyModal.sourceEvidenceIds.includes(ev.id)
        );

        const selfCorrectionCount = linkedEvidences.filter((e) => e.signal === 'SELF_CORRECTION').length;
        const postSolutionCount = linkedEvidences.filter((e) => e.signal === 'POST_SOLUTION').length;
        const confidenceDivergenceCount = linkedEvidences.filter((e) => e.signal === 'CONFIDENCE_DIVERGENCE').length;
        const negativeCount = linkedEvidences.filter((e) => e.signal === 'NEGATIVE_SIGNAL').length;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in text-slate-100 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {whyModal.subjectName}
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    {whyModal.topicName}
                  </h3>
                </div>
                <button
                  onClick={() => setWhyModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>

              {/* Action & Parameters Overview */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">AÇÃO SUGERIDA</span>
                  <span className="font-bold text-white">{whyModal.actionLabel}</span>
                </div>

                {whyModal.reviewType && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">MÉTODO</span>
                    <span className="font-bold text-indigo-300">{formatReviewType(whyModal.reviewType)}</span>
                  </div>
                )}

                {whyModal.triggerReason && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">GATILHO</span>
                    <span className="font-bold text-amber-300">{formatReviewTriggerReason(whyModal.triggerReason)}</span>
                  </div>
                )}

                {whyModal.priority && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">PRIORIDADE</span>
                    <span className="font-bold text-slate-200">{formatReviewPriority(whyModal.priority)}</span>
                  </div>
                )}
              </div>

              {/* Real Mastery Information Section */}
              <div className="space-y-2 p-3 bg-indigo-950/20 rounded-xl border border-indigo-500/20 text-xs">
                <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                  <Icon name="Brain" size={14} />
                  <span>Estado Atual no Motor de Domínio (Mastery)</span>
                </span>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Status de Domínio</span>
                    <span className="font-bold text-white">
                      {formatMasteryStatusLabel(mastery?.status)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block">Nível Estimado</span>
                    <span className="font-bold text-indigo-200">
                      {mastery?.estimatedLevel !== null && mastery?.estimatedLevel !== undefined
                        ? `Nível de aplicação estimado: ${mastery.estimatedLevel}/10`
                        : 'Sem nível estimado ainda.'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block">Confiança da Estimativa</span>
                    <span className="font-bold text-slate-200">
                      {formatConfidenceLabel(mastery?.confidence)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block">Base de Fontes</span>
                    <span className="font-bold text-slate-200">
                      {mastery
                        ? `Baseado em ${mastery.independentSourceCount} fonte(s) independente(s)`
                        : 'Sem dados suficientes'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rationale Text */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Icon name="MessageSquare" size={14} className="text-indigo-400" />
                  <span>Fundamentação Pedagógica</span>
                </span>
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-slate-200 leading-relaxed">
                  {whyModal.rationale}
                </div>
              </div>

              {/* Factual Evidence Breakdown */}
              <div className="space-y-2 text-xs">
                <span className="text-[11px] font-bold text-slate-300 block">
                  Evidências Fatuais do Usuário Vinculadas
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="text-base font-bold text-indigo-400 block">
                      {whyModal.sourceEvidenceIds.length}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium uppercase">Evidências Totais</span>
                  </div>

                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="text-base font-bold text-amber-400 block">
                      {selfCorrectionCount}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium uppercase">Autocorreções</span>
                  </div>

                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="text-base font-bold text-blue-400 block">
                      {postSolutionCount}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium uppercase">Pós-Soluções</span>
                  </div>

                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="text-base font-bold text-rose-400 block">
                      {confidenceDivergenceCount + negativeCount}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium uppercase">Diverg. / Erros</span>
                  </div>
                </div>

                {/* Source IDs list */}
                <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
                  {whyModal.sourceAttemptIds && whyModal.sourceAttemptIds.length > 0 && (
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {whyModal.sourceAttemptIds.length} tentativa(s) relacionada(s)
                    </span>
                  )}
                  {whyModal.sourceErrorIds && whyModal.sourceErrorIds.length > 0 && (
                    <span className="px-2 py-1 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60">
                      {whyModal.sourceErrorIds.length} erro(s) relacionado(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2">
                <button
                  onClick={() => setWhyModal(null)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: "VER COMO FAZER" (Orientação de Execução) */}
      {instructionModal && (() => {
        let ctaLabel: string | null = null;
        switch (instructionModal.reviewType) {
          case 'TARGETED_QUESTIONS':
            ctaLabel = 'Ir para Questões';
            break;
          case 'DIAGNOSTIC_RETEST':
            ctaLabel = 'Gerar Nova Evidência';
            break;
          case 'REATTEMPT_WITHOUT_SUPPORT':
            ctaLabel = 'Revisitar Questão';
            break;
          case 'ERROR_REVIEW':
            ctaLabel = 'Abrir Erro';
            break;
          default:
            ctaLabel = null;
            break;
        }

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in text-slate-100">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {instructionModal.subjectName}
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    {instructionModal.topicName}
                  </h3>
                </div>
                <button
                  onClick={() => setInstructionModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                    Método de Revisão
                  </span>
                  <p className="text-sm font-bold text-white">
                    {formatReviewType(instructionModal.reviewType)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Tempo estimado: {instructionModal.estimatedMinutes} minutos
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Instrução de Execução
                  </span>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-200 leading-relaxed text-xs">
                    {instructionModal.instruction}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                {ctaLabel && (
                  <button
                    onClick={() => {
                      const rev = instructionModal.review;
                      setInstructionModal(null);
                      handleExecuteReviewAction(rev);
                    }}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <Icon name="ArrowRight" size={14} />
                    <span>{ctaLabel}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const rev = instructionModal.review;
                    const topName = instructionModal.topicName;
                    const subName = instructionModal.subjectName;
                    setInstructionModal(null);
                    handleOpenCompletionModal(rev, topName, subName);
                  }}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <Icon name="CheckCircle2" size={14} />
                  <span>Finalizar Revisão</span>
                </button>
                <button
                  onClick={() => setInstructionModal(null)}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: "COMO FOI ESTA REVISÃO?" (Conclusão de Revisão Adaptativa) */}
      {completionModal && (() => {
        const review = completionModal.review;
        const linkedAttempts = attemptRepo.getAttemptsByReview(review.id, user.id);
        const attemptSummary = summarizeReviewAttempts(linkedAttempts);
        const isQuestionBased = ['TARGETED_QUESTIONS', 'REATTEMPT_WITHOUT_SUPPORT', 'DIAGNOSTIC_RETEST'].includes(review.reviewType);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in text-slate-100 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {completionModal.subjectName}
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    Como foi esta revisão?
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {completionModal.topicName} • {formatReviewType(review.reviewType)}
                  </p>
                </div>
                <button
                  onClick={() => setCompletionModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>

              {/* Attempt Factual Summary if question-based */}
              {isQuestionBased && (
                <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  attemptSummary.total > 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <Icon name={attemptSummary.total > 0 ? 'CheckCircle2' : 'AlertTriangle'} size={15} />
                    <span>
                      {attemptSummary.total > 0
                        ? `${attemptSummary.total} tentativa(s) registrada(s) nesta revisão`
                        : 'Nenhuma tentativa registrada nesta revisão'}
                    </span>
                  </div>
                  {attemptSummary.total > 0 ? (
                    <p className="text-[11px] text-emerald-200/80 mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                      <span>Acertos: {attemptSummary.totalCorrect}</span>
                      {attemptSummary.wrong > 0 && <span>• Erros: {attemptSummary.wrong}</span>}
                      {attemptSummary.blank > 0 && <span>• Em branco: {attemptSummary.blank}</span>}
                      {attemptSummary.noTime > 0 && <span>• Sem tempo: {attemptSummary.noTime}</span>}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-200/80 mt-1">
                      Para concluir com sucesso/parcial/falha, registre ao menos uma tentativa em Questões ou escolha "Não consegui fazer agora".
                    </p>
                  )}
                </div>
              )}

              {/* Outcome Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  Selecione o resultado da revisão <span className="text-rose-400">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'SUCCESS_CONFIDENT' as ReviewCompletionOutcome,
                      label: 'Consegui com segurança',
                      desc: 'Compreendi e resolvi sem grandes dúvidas',
                      icon: 'CheckCircle2',
                      color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20',
                    },
                    {
                      id: 'SUCCESS_EFFORTFUL' as ReviewCompletionOutcome,
                      label: 'Consegui, mas com esforço',
                      desc: 'Resolvi, porém exigiu bastante raciocínio ou revisão adicional',
                      icon: 'Zap',
                      color: 'border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20',
                    },
                    {
                      id: 'PARTIAL' as ReviewCompletionOutcome,
                      label: 'Consegui parcialmente',
                      desc: 'Acertei partes ou entendi parcialmente o conteúdo',
                      icon: 'MinusCircle',
                      color: 'border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20',
                    },
                    {
                      id: 'FAILED' as ReviewCompletionOutcome,
                      label: 'Não consegui nesta tentativa',
                      desc: 'Errei ou não consegui desenvolver o raciocínio esperado',
                      icon: 'XCircle',
                      color: 'border-rose-500/40 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20',
                    },
                    {
                      id: 'NOT_COMPLETED' as ReviewCompletionOutcome,
                      label: 'Não consegui fazer agora',
                      desc: 'A revisão será adiada sem contabilizar evidência de aprendizagem',
                      icon: 'SkipForward',
                      color: 'border-slate-700 text-slate-300 bg-slate-800/80 hover:bg-slate-800',
                    },
                  ].map((opt) => {
                    const isSelected = selectedOutcome === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSelectedOutcome(opt.id);
                          setCompletionError(null);
                        }}
                        className={`w-full p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                          isSelected
                            ? `${opt.color} ring-2 ring-indigo-500`
                            : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          <Icon name={opt.icon} size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Fields (only if outcome selected and !== NOT_COMPLETED) */}
              {selectedOutcome && selectedOutcome !== 'NOT_COMPLETED' && (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  {/* Confidence (1-5) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Qual seu nível de confiança no resultado? (Opcional)
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((level) => {
                        const isSel = selectedConfidence === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setSelectedConfidence(isSel ? null : (level as any))}
                            className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition ${
                              isSel
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actual Minutes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Tempo praticado em minutos (Opcional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder={`Sugerido: ${review.estimatedMinutes} min`}
                      value={inputActualMinutes}
                      onChange={(e) => setInputActualMinutes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Observações ou anotações pessoais (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Tive dificuldade na segunda etapa do cálculo..."
                      value={inputNotes}
                      onChange={(e) => setInputNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {completionError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <Icon name="AlertCircle" size={15} className="shrink-0" />
                  <span>{completionError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCompletionModal(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={!selectedOutcome || isCompleting}
                  onClick={() => handleConfirmCompletion()}
                  className={`flex-1 py-2.5 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 ${
                    !selectedOutcome || isCompleting
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                  }`}
                >
                  <Icon name="CheckCircle2" size={15} />
                  <span>{isCompleting ? 'Salvando...' : 'Finalizar Revisão'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

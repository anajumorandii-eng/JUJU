import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  InitialLearningDiagnostic, 
  MicroAssessmentResult, 
  ConfidenceLevel, 
  GraphVisualData,
  DiagnosticDraft
} from '../types';
import { Icon } from './Icon';
import { selectMicroActivities, ALL_MICRO_ACTIVITIES } from '../data/microActivities';
import { calculateInitialDiagnostic, calculateTwoAttemptOutcome } from '../services/diagnosticEngine';
import { DiagnosticDraftRepository } from '../services/diagnosticDraftRepository';
import { 
  SELF_REPORTED_STATE_OPTIONS,
  ERROR_HANDLING_OPTIONS,
  ERROR_REPEAT_OPTIONS,
  REASONING_AWARENESS_OPTIONS,
  SUCCESS_STREAK_OPTIONS,
  PERCEIVED_DIFFICULTIES_OPTIONS,
  PERCEIVED_STRENGTHS_OPTIONS,
  TIME_DRAIN_OPTIONS,
  PLAN_COMPLETION_OPTIONS,
  UNFINISHED_PLAN_OPTIONS,
  toggleLimitedExclusiveSelection
} from '../data/diagnosticOptions';

interface AdaptiveDiagnosticModalProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onClose: () => void;
  onFinishDiagnostic: (diag: InitialLearningDiagnostic) => void;
}

const VisualGraphRenderer: React.FC<{ data: GraphVisualData }> = ({ data }) => {
  const maxVal = Math.max(...data.values, 1);
  const isLine = data.type === 'line';

  const accessibleDesc = `Gráfico de ${isLine ? 'linha' : 'barras'}: ${data.title || 'dados'}. ` +
    data.labels.map((l, i) => `${l}: ${data.values[i]}`).join(', ');

  if (isLine) {
    const width = 300;
    const height = 120;
    const padding = 25;
    const pointsCount = data.values.length;

    const points = data.values.map((val, idx) => {
      const x = padding + (idx / Math.max(1, pointsCount - 1)) * (width - 2 * padding);
      const y = height - padding - (val / maxVal) * (height - 2 * padding);
      return { x, y, val, label: data.labels[idx] };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div 
        aria-label={accessibleDesc} 
        tabIndex={0}
        className="my-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {data.title && <div className="text-xs font-bold text-slate-300 mb-2 text-center">{data.title}</div>}
        <div className="relative w-full flex justify-center">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 max-w-md overflow-visible">
            {[0, 0.5, 1].map((ratio, i) => {
              const y = height - padding - ratio * (height - 2 * padding);
              return (
                <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
              );
            })}

            <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {points.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" />
                <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#60a5fa" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  {p.val}
                </text>
                <text x={p.x} y={height - 5} textAnchor="middle" fill="#94a3b8" fontSize="9">
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-1">
          <span>{data.xLabel || 'Eixo X (Tempo)'}</span>
          <span>{data.yLabel || 'Eixo Y (Velocidade)'}</span>
        </div>
        <div className="sr-only">{accessibleDesc}</div>
      </div>
    );
  }

  return (
    <div 
      aria-label={accessibleDesc} 
      tabIndex={0}
      className="my-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {data.title && <div className="text-xs font-bold text-slate-300 mb-2 text-center">{data.title}</div>}
      <div className="relative h-36 w-full flex items-end justify-between gap-3 pt-6 px-4 pb-2 border-b border-l border-slate-700">
        {data.values.map((val, idx) => {
          const heightPercent = Math.round((val / maxVal) * 100);
          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
              <span className="text-[10px] font-mono text-blue-400 mb-1">{val}</span>
              <div
                style={{ height: `${Math.max(10, heightPercent)}%` }}
                className="w-full max-w-[28px] bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t shadow"
              />
              <span className="text-[10px] text-slate-400 mt-2 truncate max-w-full">
                {data.labels[idx]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
        <span>{data.xLabel || 'Eixo X'}</span>
        <span>{data.yLabel || 'Eixo Y'}</span>
      </div>
      <div className="sr-only">{accessibleDesc}</div>
    </div>
  );
};

export const AdaptiveDiagnosticModal: React.FC<AdaptiveDiagnosticModalProps> = ({
  user,
  setUser,
  onClose,
  onFinishDiagnostic,
}) => {
  const userId = user.id;

  // Check for saved draft
  const savedDraft = DiagnosticDraftRepository.getDraft(userId);

  // Step manager (1 to 7 = Camada A, 8 = Camada B, 9 = Resumo)
  const [step, setStep] = useState<number>(savedDraft?.currentStep || 1);

  // Form State - Camada A
  const [selfReportedState, setSelfReportedState] = useState<string[]>(
    savedDraft?.formState?.selfReportedState || []
  );
  const [errorHandling, setErrorHandling] = useState<string[]>(
    savedDraft?.formState?.errorHandling || []
  );
  const [errorRepeatReaction, setErrorRepeatReaction] = useState<string>(
    savedDraft?.formState?.errorRepeatReaction || ''
  );
  const [reasoningAwareness, setReasoningAwareness] = useState<string>(
    savedDraft?.formState?.reasoningAwareness || ''
  );
  const [successHandling, setSuccessHandling] = useState<string>(
    savedDraft?.formState?.successHandling || ''
  );
  const [successStreakBehavior, setSuccessStreakBehavior] = useState<string>(
    savedDraft?.formState?.successStreakBehavior || ''
  );
  const [difficulties, setDifficulties] = useState<string[]>(
    savedDraft?.formState?.difficulties || []
  );
  const [strengths, setStrengths] = useState<string[]>(
    savedDraft?.formState?.strengths || []
  );
  const [studyMethods, setStudyMethods] = useState<Record<string, 'Nunca' | 'Pouco' | 'Às vezes' | 'Frequentemente' | 'Muito' | null>>(
    savedDraft?.formState?.studyMethods || {
      'Videoaulas': null,
      'Questões': null,
      'Resumos': null,
      'Revisão': null,
      'Flashcards': null,
      'Explicação em voz alta': null,
    }
  );
  const [biggestTimeDrain, setBiggestTimeDrain] = useState<string>(
    savedDraft?.formState?.biggestTimeDrain || ''
  );
  const [efficiencyPerception, setEfficiencyPerception] = useState<number | null>(
    savedDraft?.formState?.efficiencyPerception ?? null
  );
  const [planCompletionFrequency, setPlanCompletionFrequency] = useState<string>(
    savedDraft?.formState?.planCompletionFrequency || ''
  );
  const [unfinishedPlanBehavior, setUnfinishedPlanBehavior] = useState<string>(
    savedDraft?.formState?.unfinishedPlanBehavior || ''
  );

  // Frozen activities set
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>(() => {
    if (savedDraft?.selectedActivityIds && savedDraft.selectedActivityIds.length > 0) {
      return savedDraft.selectedActivityIds;
    }
    const initialSelected = selectMicroActivities({
      targetCourse: user.targetCourse,
      targetExams: user.targetExams,
      perceivedDifficulties: difficulties,
      perceivedStrengths: strengths,
      selfReportedState,
    });
    return initialSelected.map(a => a.id);
  });

  const selectedActivities = ALL_MICRO_ACTIVITIES.filter(act => selectedActivityIds.includes(act.id));

  // Form State - Camada B (Microdiagnóstico)
  const [currentMicroIdx, setCurrentMicroIdx] = useState<number>(savedDraft?.currentMicroIdx || 0);
  const [microResults, setMicroResults] = useState<MicroAssessmentResult[]>(
    savedDraft?.microResults || []
  );

  // Microactivity Two-Attempt Machine State
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [reasoningText, setReasoningText] = useState<string>('');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [activityStartTime, setActivityStartTime] = useState<number>(Date.now());

  const [firstAttemptOptionId, setFirstAttemptOptionId] = useState<string | null>(null);
  const [firstAttemptConfidence, setFirstAttemptConfidence] = useState<ConfidenceLevel | null>(null);
  const [firstAttemptReasoningText, setFirstAttemptReasoningText] = useState<string>('');
  const [showSelfCorrectionOffer, setShowSelfCorrectionOffer] = useState<boolean>(false);
  const [isSecondAttemptMode, setIsSecondAttemptMode] = useState<boolean>(false);

  // Final Generated Diagnostic
  const [finalDiagnostic, setFinalDiagnostic] = useState<InitialLearningDiagnostic | null>(
    savedDraft?.finalDiagnostic || null
  );
  const [showDraftNotice, setShowDraftNotice] = useState<boolean>(!!savedDraft);

  useEffect(() => {
    setActivityStartTime(Date.now());
    setSelectedOptionId(null);
    setConfidence(null);
    setShowHint(false);
    setReasoningText('');
    setFirstAttemptOptionId(null);
    setFirstAttemptConfidence(null);
    setFirstAttemptReasoningText('');
    setShowSelfCorrectionOffer(false);
    setIsSecondAttemptMode(false);
  }, [currentMicroIdx, step]);

  // Save draft whenever state updates
  const saveCurrentDraft = (
    customStep?: number, 
    customActivityIds?: string[], 
    customMicroIdx?: number, 
    customMicroResults?: MicroAssessmentResult[],
    customFinalDiag?: InitialLearningDiagnostic
  ) => {
    const draft: DiagnosticDraft = {
      id: `draft_${userId}`,
      userId,
      currentStep: customStep ?? step,
      formState: {
        selfReportedState,
        errorHandling,
        errorRepeatReaction,
        reasoningAwareness,
        successHandling,
        successStreakBehavior,
        difficulties,
        strengths,
        studyMethods,
        biggestTimeDrain,
        efficiencyPerception,
        planCompletionFrequency,
        unfinishedPlanBehavior,
      },
      currentMicroIdx: customMicroIdx ?? currentMicroIdx,
      microResults: customMicroResults ?? microResults,
      selectedActivityIds: customActivityIds || selectedActivityIds,
      finalDiagnostic: customFinalDiag || finalDiagnostic || undefined,
      timestamp: new Date().toISOString(),
    };
    DiagnosticDraftRepository.saveDraft(userId, draft);
  };

  const handleCloseAndSaveDraft = () => {
    saveCurrentDraft();
    onClose();
  };

  const handleTransitionToCamadaB = () => {
    const freshSelected = selectMicroActivities({
      targetCourse: user.targetCourse,
      targetExams: user.targetExams,
      perceivedDifficulties: difficulties,
      perceivedStrengths: strengths,
      selfReportedState,
    });
    const ids = freshSelected.map(a => a.id);
    setSelectedActivityIds(ids);
    setStep(8);
    saveCurrentDraft(8, ids);
  };

  // Record Microactivity Result and Advance
  const recordAndAdvance = (payload: {
    chosenOptionId: string;
    correct: boolean;
    confidenceBefore: ConfidenceLevel;
    confidenceAtAnswer: ConfidenceLevel;
    responseTimeSeconds: number;
    hintCount: number;
    changedAnswer: boolean;
    selfCorrection: boolean;
    reasoningText?: string;
    firstAttemptOptionId?: string;
    firstAttemptCorrect?: boolean;
    firstAttemptConfidence?: ConfidenceLevel;
    firstAttemptReasoningText?: string;
    secondAttemptOptionId?: string;
    secondAttemptCorrect?: boolean;
    secondAttemptConfidence?: ConfidenceLevel;
    secondAttemptReasoningText?: string;
  }) => {
    const currentAct = selectedActivities[currentMicroIdx];
    const selectedOpt = currentAct.options.find(o => o.id === payload.chosenOptionId);

    const result: MicroAssessmentResult = {
      id: `mres_${Date.now()}_${currentMicroIdx}`,
      activityId: currentAct.id,
      activityType: currentAct.activityType,
      subjectId: currentAct.subjectId,
      subjectName: currentAct.subjectName,
      topicId: currentAct.topicId,
      topicName: currentAct.topicName,
      chosenOptionId: payload.chosenOptionId,
      chosenDistractorType: selectedOpt?.distractorType,
      correct: payload.correct,
      confidenceBefore: payload.confidenceBefore,
      confidenceAtAnswer: payload.confidenceAtAnswer,
      responseTimeSeconds: payload.responseTimeSeconds,
      hintCount: payload.hintCount,
      changedAnswer: payload.changedAnswer,
      selfCorrection: payload.selfCorrection,
      reasoningText: payload.reasoningText,
      cognitivePatterns: currentAct.cognitivePatterns || [currentAct.activityType],
      isTimedAssessment: currentAct.isTimedAssessment,
      firstAttemptOptionId: payload.firstAttemptOptionId,
      firstAttemptCorrect: payload.firstAttemptCorrect,
      firstAttemptConfidence: payload.firstAttemptConfidence,
      firstAttemptReasoningText: payload.firstAttemptReasoningText,
      secondAttemptOptionId: payload.secondAttemptOptionId,
      secondAttemptCorrect: payload.secondAttemptCorrect,
      secondAttemptConfidence: payload.secondAttemptConfidence,
      secondAttemptReasoningText: payload.secondAttemptReasoningText,
    };

    const updatedResults = [...microResults, result];
    setMicroResults(updatedResults);

    if (currentMicroIdx < selectedActivities.length - 1) {
      const nextIdx = currentMicroIdx + 1;
      setCurrentMicroIdx(nextIdx);
      saveCurrentDraft(8, undefined, nextIdx, updatedResults);
    } else {
      // Finished all microactivities -> generate final diagnostic!
      const generated = calculateInitialDiagnostic({
        userId,
        selfReportedState,
        errorHandlingProfile: errorHandling,
        errorRepeatReaction,
        reasoningAwareness,
        successHandlingProfile: successHandling,
        successStreakBehavior,
        perceivedDifficulties: difficulties,
        perceivedStrengths: strengths,
        currentStudyMethods: studyMethods,
        biggestTimeDrain,
        efficiencyPerception,
        planCompletionFrequency,
        unfinishedPlanBehavior,
        microAssessmentResults: updatedResults,
      });

      setFinalDiagnostic(generated);
      setStep(9);
      saveCurrentDraft(9, undefined, undefined, updatedResults, generated);
    }
  };

  const submitFirstAttempt = () => {
    if (!selectedOptionId || confidence === null) return;
    const currentAct = selectedActivities[currentMicroIdx];
    const selectedOpt = currentAct.options.find(o => o.id === selectedOptionId);

    setFirstAttemptOptionId(selectedOptionId);
    setFirstAttemptConfidence(confidence);
    setFirstAttemptReasoningText(reasoningText);

    if (!selectedOpt?.isCorrect) {
      setShowSelfCorrectionOffer(true);
    } else {
      recordAndAdvance({
        chosenOptionId: selectedOptionId,
        correct: true,
        confidenceBefore: confidence,
        confidenceAtAnswer: confidence,
        responseTimeSeconds: Math.max(1, Math.round((Date.now() - activityStartTime) / 1000)),
        hintCount: showHint ? 1 : 0,
        changedAnswer: false,
        selfCorrection: false,
        reasoningText: reasoningText.trim() || undefined,
        firstAttemptOptionId: selectedOptionId,
        firstAttemptCorrect: true,
        firstAttemptConfidence: confidence,
        firstAttemptReasoningText: reasoningText.trim() || undefined,
      });
    }
  };

  const acceptFirstAttemptAndContinue = () => {
    if (!firstAttemptOptionId || !firstAttemptConfidence) return;
    const currentAct = selectedActivities[currentMicroIdx];
    const firstOpt = currentAct.options.find(o => o.id === firstAttemptOptionId);

    recordAndAdvance({
      chosenOptionId: firstAttemptOptionId,
      correct: !!firstOpt?.isCorrect,
      confidenceBefore: firstAttemptConfidence,
      confidenceAtAnswer: firstAttemptConfidence,
      responseTimeSeconds: Math.max(1, Math.round((Date.now() - activityStartTime) / 1000)),
      hintCount: showHint ? 1 : 0,
      changedAnswer: false,
      selfCorrection: false,
      reasoningText: firstAttemptReasoningText.trim() || undefined,
      firstAttemptOptionId: firstAttemptOptionId,
      firstAttemptCorrect: !!firstOpt?.isCorrect,
      firstAttemptConfidence: firstAttemptConfidence,
      firstAttemptReasoningText: firstAttemptReasoningText.trim() || undefined,
    });
  };

  const startSecondAttempt = () => {
    setShowSelfCorrectionOffer(false);
    setIsSecondAttemptMode(true);
  };

  const submitSecondAttempt = () => {
    if (!selectedOptionId || confidence === null || !firstAttemptOptionId || !firstAttemptConfidence) return;

    const currentAct = selectedActivities[currentMicroIdx];
    const firstOpt = currentAct.options.find(o => o.id === firstAttemptOptionId);
    const secondOpt = currentAct.options.find(o => o.id === selectedOptionId);

    const firstCorrect = !!firstOpt?.isCorrect;
    const secondCorrect = !!secondOpt?.isCorrect;

    const outcome = calculateTwoAttemptOutcome({
      firstOptionId: firstAttemptOptionId,
      firstCorrect,
      firstConfidence: firstAttemptConfidence,
      firstReasoningText: firstAttemptReasoningText,
      secondOptionId: selectedOptionId,
      secondCorrect,
      secondConfidence: confidence,
      secondReasoningText: reasoningText,
    });

    recordAndAdvance({
      chosenOptionId: outcome.finalOptionId,
      correct: outcome.finalCorrect,
      confidenceBefore: firstAttemptConfidence,
      confidenceAtAnswer: outcome.finalConfidence,
      responseTimeSeconds: Math.max(1, Math.round((Date.now() - activityStartTime) / 1000)),
      hintCount: showHint ? 1 : 0,
      changedAnswer: outcome.changedAnswer,
      selfCorrection: outcome.selfCorrection,
      reasoningText: outcome.finalReasoningText,
      firstAttemptOptionId: firstAttemptOptionId,
      firstAttemptCorrect: false,
      firstAttemptConfidence: firstAttemptConfidence,
      firstAttemptReasoningText: firstAttemptReasoningText.trim() || undefined,
      secondAttemptOptionId: selectedOptionId,
      secondAttemptCorrect: secondCorrect,
      secondAttemptConfidence: confidence,
      secondAttemptReasoningText: reasoningText.trim() || undefined,
    });
  };

  const handleFinishAndSaveToUser = () => {
    if (!finalDiagnostic) return;

    setUser(prev => ({
      ...prev,
      diagnostic: finalDiagnostic,
    }));

    DiagnosticDraftRepository.clearDraft(userId);
    onFinishDiagnostic(finalDiagnostic);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 text-slate-100 shadow-2xl my-8 relative">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
              <Icon name="Activity" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Diagnóstico Inicial Adaptativo JUJU</h2>
              <p className="text-xs text-slate-400">
                {step <= 7 && `Etapa ${step} de 7 — Camada A (Autopercepção)`}
                {step === 8 && `Atividade ${currentMicroIdx + 1} de ${selectedActivities.length || 4} — Camada B (Microdiagnóstico Objetivo)`}
                {step === 9 && 'Resumo e Hipótese Inicial'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseAndSaveDraft}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Salvar Rascunho e Fechar"
          >
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        {/* Draft Notice Banner */}
        {showDraftNotice && step < 9 && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="RotateCcw" className="w-4 h-4 text-indigo-400" />
              <span>Você possui um progresso salvo. Continuando de onde parou.</span>
            </div>
            <button
              onClick={() => setShowDraftNotice(false)}
              className="text-indigo-400 hover:text-white font-medium underline"
            >
              Entendi
            </button>
          </div>
        )}

        {/* STEP CONTENT */}
        <div className="py-6">
          {/* STEP 1: Estado Autodeclarado */}
          {step === 1 && (
            <div>
              <h3 className="text-base font-semibold text-white mb-1">
                Com qual das situações abaixo você mais se identifica no momento?
              </h3>
              <p className="text-xs text-slate-400 mb-4">Escolha até 3 opções que melhor descrevem sua rotina.</p>

              <div className="space-y-2">
                {SELF_REPORTED_STATE_OPTIONS.map((opt) => {
                  const isSelected = selfReportedState.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setSelfReportedState(
                          toggleLimitedExclusiveSelection(selfReportedState, opt.id, SELF_REPORTED_STATE_OPTIONS, 3)
                        )
                      }
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-center gap-3 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-blue-200 font-medium'
                          : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border text-xs ${
                        isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-slate-700'
                      }`}>
                        {isSelected && '✓'}
                      </div>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { saveCurrentDraft(2); setStep(2); }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Reação ao Erro */}
          {step === 2 && (
            <div>
              <h3 className="text-base font-semibold text-white mb-1">
                Quando você erra uma questão durante os estudos, qual costuma ser sua primeira reação?
              </h3>
              <p className="text-xs text-slate-400 mb-4">Selecione a opção que reflete seu comportamento real habitual.</p>

              <div className="space-y-2">
                {ERROR_HANDLING_OPTIONS.map((opt) => {
                  const isSelected = errorHandling.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setErrorHandling([opt.id])}
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-center gap-3 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-blue-200 font-medium'
                          : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-700'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => { saveCurrentDraft(3); setStep(3); }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Consciência de Raciocínio nos Acertos */}
          {step === 3 && (
            <div>
              <h3 className="text-base font-semibold text-white mb-1">
                Quando você acerta uma questão, costuma saber por que acertou?
              </h3>
              <p className="text-xs text-slate-400 mb-4">Essa informação ajuda a separar acertos casuais de domínio firme.</p>

              <div className="space-y-2">
                {REASONING_AWARENESS_OPTIONS.map((opt) => {
                  const isSelected = reasoningAwareness === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setReasoningAwareness(opt.id)}
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-center gap-3 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-blue-200 font-medium'
                          : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-700'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => { saveCurrentDraft(4); setStep(4); }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Erro Repetido e Sequência de Acertos */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  E quando você acerta várias questões seguidas do mesmo tópico, o que costuma fazer?
                </h3>
                <div className="space-y-2">
                  {SUCCESS_STREAK_OPTIONS.map((opt) => {
                    const isSelected = successStreakBehavior === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSuccessStreakBehavior(opt.id)}
                        className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-center gap-3 ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-blue-200 font-medium'
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-700'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => { saveCurrentDraft(5); setStep(5); }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Dificuldades Percebidas */}
          {step === 5 && (
            <div>
              <h3 className="text-base font-semibold text-white mb-1">
                Quais são suas maiores dificuldades percebidas nos estudos?
              </h3>
              <p className="text-xs text-slate-400 mb-4">Escolha até 3 opções (ou escolha "Não sei identificar").</p>

              <div className="space-y-2">
                {PERCEIVED_DIFFICULTIES_OPTIONS.map((opt) => {
                  const isSelected = difficulties.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setDifficulties(
                          toggleLimitedExclusiveSelection(difficulties, opt.id, PERCEIVED_DIFFICULTIES_OPTIONS, 3)
                        )
                      }
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-center gap-3 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-blue-200 font-medium'
                          : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border text-xs ${
                        isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-slate-700'
                      }`}>
                        {isSelected && '✓'}
                      </div>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(4)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => { saveCurrentDraft(6); setStep(6); }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Forças Percebidas */}
          {step === 6 && (
            <div>
              <h3 className="text-base font-semibold text-white mb-1">
                Quais pontos você considera seus pontos fortes ou facilidades de estudo?
              </h3>
              <p className="text-xs text-slate-400 mb-4">Escolha até 3 opções (ou escolha "Não sei identificar").</p>

              <div className="space-y-2">
                {PERCEIVED_STRENGTHS_OPTIONS.map((opt) => {
                  const isSelected = strengths.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setStrengths(
                          toggleLimitedExclusiveSelection(strengths, opt.id, PERCEIVED_STRENGTHS_OPTIONS, 3)
                        )
                      }
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-center gap-3 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-blue-200 font-medium'
                          : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border text-xs ${
                        isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-slate-700'
                      }`}>
                        {isSelected && '✓'}
                      </div>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(5)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => { saveCurrentDraft(7); setStep(7); }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Dreno de Tempo e Métodos */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  Qual é o seu maior dreno de tempo atualmente?
                </h3>
                <div className="space-y-2">
                  {TIME_DRAIN_OPTIONS.map((opt) => {
                    const isSelected = biggestTimeDrain === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setBiggestTimeDrain(opt.id)}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition flex items-center gap-3 ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-blue-200 font-medium'
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-700'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-3">
                <Icon name="Brain" className="w-5 h-5 text-blue-400 shrink-0" />
                <span>
                  Camada A finalizada! Agora faremos 3 a 4 microatividades práticas curtas para verificar a fluidez do raciocínio.
                </span>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(6)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleTransitionToCamadaB}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition flex items-center gap-2"
                >
                  Ir para Microdiagnóstico Prático →
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: Camada B — Microdiagnóstico Prático */}
          {step === 8 && selectedActivities.length > 0 && (
            <div>
              {(() => {
                const currentAct = selectedActivities[currentMicroIdx];
                return (
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                      <span>{currentAct.title}</span>
                      <span className="font-mono text-blue-400">
                        {currentMicroIdx + 1} / {selectedActivities.length}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-200 mb-4 leading-relaxed whitespace-pre-line">
                      {currentAct.context}
                    </div>

                    {/* Render visual graph if activity provides graphData */}
                    {currentAct.graphData && (
                      <VisualGraphRenderer data={currentAct.graphData} />
                    )}

                    {/* Hint Banner */}
                    {showHint ? (
                      <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                        <Icon name="Lightbulb" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Pista Pedagógica:</strong> {currentAct.hintText}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowHint(true)}
                        className="mb-4 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition"
                      >
                        <Icon name="Lightbulb" className="w-3.5 h-3.5" />
                        <span>Ver pista pedagógica (registra uso)</span>
                      </button>
                    )}

                    {/* Options list */}
                    <div className="space-y-2 mb-6">
                      {currentAct.options.map((opt) => {
                        const isSelected = selectedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setSelectedOptionId(opt.id)}
                            className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-start gap-3 ${
                              isSelected
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-medium'
                                : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 uppercase ${
                              isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-700 text-slate-400'
                            }`}>
                              {opt.id}
                            </span>
                            <span className="mt-0.5">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Confidence Selector */}
                    <div className="mb-6 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        Qual é o seu nível de confiança nesta resposta?
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((lvl) => {
                          const isConfSelected = confidence === lvl;
                          return (
                            <button
                              key={lvl}
                              onClick={() => setConfidence(lvl as ConfidenceLevel)}
                              className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${
                                isConfSelected
                                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="font-bold text-sm">{lvl}</div>
                              <div className="text-[10px] opacity-80">
                                {lvl === 1 && 'Chute'}
                                {lvl === 2 && 'Inseguro'}
                                {lvl === 3 && 'Médio'}
                                {lvl === 4 && 'Seguro'}
                                {lvl === 5 && 'Certeza'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Optional Reasoning Text if required */}
                    {currentAct.requiresReasoningExplanation && (
                      <div className="mb-6">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Justificativa rápida em poucas palavras (opcional):
                        </label>
                        <input
                          type="text"
                          value={reasoningText}
                          onChange={(e) => setReasoningText(e.target.value)}
                          placeholder="Ex: Área varia com k² porque é bidimensional..."
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    {/* Self-Correction Modal Offer */}
                    {showSelfCorrectionOffer && (
                      <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3">
                        <div className="font-semibold flex items-center gap-2 text-amber-300">
                          <Icon name="AlertCircle" className="w-4 h-4 text-amber-400" />
                          <span>Deseja reavaliar sua resposta antes de avançar?</span>
                        </div>
                        <p className="text-slate-300">
                          A primeira tentativa não foi confirmada como correta. Você pode reanalisar o enunciado e tentar uma 2ª tentativa.
                        </p>
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={acceptFirstAttemptAndContinue}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs"
                          >
                            Manter e Continuar
                          </button>
                          <button
                            onClick={startSecondAttempt}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition text-xs"
                          >
                            Tentar Novamente (2ª Tentativa)
                          </button>
                        </div>
                      </div>
                    )}

                    {!showSelfCorrectionOffer && (
                      <div className="flex justify-end">
                        <button
                          disabled={!selectedOptionId || confidence === null}
                          onClick={isSecondAttemptMode ? submitSecondAttempt : submitFirstAttempt}
                          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-medium text-sm transition"
                        >
                          {isSecondAttemptMode ? 'Confirmar 2ª Tentativa →' : 'Confirmar Resposta →'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* STEP 9: Resumo e Hipótese Inicial */}
          {step === 9 && finalDiagnostic && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold text-sm">
                  <Icon name="Target" className="w-5 h-5 text-indigo-400" />
                  <span>SÍNTESE DO DIAGNÓSTICO E HIPÓTESE INICIAL</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {finalDiagnostic.initialHypothesis?.factObserved}
                </p>
              </div>

              {/* Hypothesis Block */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-semibold text-slate-400">Hipótese Inicial Proposta</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    finalDiagnostic.initialHypothesis?.confidence === 'ALTA'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : finalDiagnostic.initialHypothesis?.confidence === 'MODERADA'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    Confiança: {finalDiagnostic.initialHypothesis?.confidence || 'BAIXA'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {finalDiagnostic.initialHypothesis?.hypothesisText}
                </p>
                <div className="text-xs text-slate-400">
                  <strong>Como verificar:</strong> {finalDiagnostic.initialHypothesis?.howToVerify}
                </div>
              </div>

              {/* Strengths and Bottlenecks Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Icon name="CheckCircle" className="w-4 h-4" />
                    <span>Indícios e Facilidades ({finalDiagnostic.strengths.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {finalDiagnostic.strengths.map((s) => (
                      <div key={s.id} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs">
                        <div className="font-semibold text-slate-200">{s.title}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{s.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Icon name="AlertTriangle" className="w-4 h-4" />
                    <span>Pontos de Atenção ({finalDiagnostic.bottlenecks.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {finalDiagnostic.bottlenecks.map((b) => (
                      <div key={b.id} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs">
                        <div className="font-semibold text-slate-200">{b.title}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{b.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Unknowns Section */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Icon name="HelpCircle" className="w-4 h-4 text-slate-500" />
                  <span>Unknowns — Domínios Não Observados ({finalDiagnostic.unknowns.length})</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {finalDiagnostic.unknowns.map((u) => (
                    <div key={u.id} className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-xs">
                      <div className="font-semibold text-slate-300">{u.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{u.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleFinishAndSaveToUser}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  Concluir e Ir para o Plano de Estudos →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

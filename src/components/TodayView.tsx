import React, { useState } from 'react';
import { TaskItem, UserProfile, Subject, TopicNode, EnergyLevel, ErrorEntry } from '../types';
import { Icon } from './Icon';
import { 
  calculatePlanFeasibility, 
  generateEstouPerdidoPlan,
  autoReorganizeTasks
} from '../services/efficiencyEngine';
import {
  generateDecidePorMimV2,
  EfficiencyEngineOutput,
  RankedEfficiencyCandidate,
} from '../services/efficiencyDecisionOrchestrator';
import { resolveEfficiencyAction } from '../services/efficiencyActionResolver';

interface TodayViewProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  subjects: Subject[];
  topics: TopicNode[];
  errors?: ErrorEntry[];
  onStartSession: (task: TaskItem) => void;
  onCreatePodcast: (topicName: string) => void;
  onOpenDiagnostic?: () => void;
  onOpenReviewRecommendation?: (reviewId: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  user,
  setUser,
  tasks,
  setTasks,
  subjects,
  topics,
  errors = [],
  onStartSession,
  onCreatePodcast,
  onOpenDiagnostic,
  onOpenReviewRecommendation,
}) => {
  const [showDecideModal, setShowDecideModal] = useState(false);
  const [showPerdidoModal, setShowPerdidoModal] = useState(false);
  const [showAtomicModal, setShowAtomicModal] = useState(false);
  const [atomicStepIndex, setAtomicStepIndex] = useState(0);

  // Decide por Mim V2 Modal explicit states
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [decisionOutput, setDecisionOutput] = useState<EfficiencyEngineOutput | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeciding, setIsDeciding] = useState<boolean>(false);
  const [showAlternatives, setShowAlternatives] = useState<boolean>(false);

  const feasibility = calculatePlanFeasibility(user, tasks);

  const handleEnergyChange = (level: EnergyLevel) => {
    setUser(prev => ({ ...prev, currentEnergyLevel: level }));
  };

  const handleReorganize = () => {
    const reorganized = autoReorganizeTasks(user, tasks, topics);
    setTasks(reorganized);
  };

  const handleTaskStatusToggle = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newStatus = t.status === 'completed' ? 'pending' : 'completed';
        return { ...t, status: newStatus };
      }
      return t;
    }));
  };

  const openDecideModal = () => {
    setShowDecideModal(true);
    setSelectedMinutes(null);
    setDecisionOutput(null);
    setDecisionError(null);
    setActionError(null);
    setIsDeciding(false);
    setShowAlternatives(false);
  };

  const closeDecideModal = () => {
    setShowDecideModal(false);
    setSelectedMinutes(null);
    setDecisionOutput(null);
    setDecisionError(null);
    setActionError(null);
    setIsDeciding(false);
    setShowAlternatives(false);
  };

  const handleResetTimeSelection = () => {
    setSelectedMinutes(null);
    setDecisionOutput(null);
    setDecisionError(null);
    setActionError(null);
    setShowAlternatives(false);
  };

  const handleSelectMinutes = (mins: number) => {
    setSelectedMinutes(mins);
    setDecisionOutput(null);
    setDecisionError(null);
    setActionError(null);
    setShowAlternatives(false);
  };

  const handleDecideV2 = () => {
    if (selectedMinutes === null) return;
    if (!user.id) {
      setDecisionError('Não foi possível identificar o usuário desta sessão.');
      return;
    }

    setIsDeciding(true);
    setDecisionError(null);
    setActionError(null);
    setDecisionOutput(null);
    setShowAlternatives(false);

    const decisionNow = new Date().toISOString();

    try {
      const output = generateDecidePorMimV2({
        userId: user.id,
        tasks,
        topics,
        errors,
        availableMinutes: selectedMinutes,
        energyLevel: user.currentEnergyLevel,
        now: decisionNow,
      });
      setDecisionOutput(output);
    } catch (err: any) {
      console.error('Erro ao avaliar Motor de Eficiência V2:', err);
      setDecisionError(err?.message || 'Não foi possível calcular uma recomendação agora.');
    } finally {
      setIsDeciding(false);
    }
  };

  const handleExecuteEfficiencyCandidate = (candidate: RankedEfficiencyCandidate) => {
    if (selectedMinutes === null) return;
    setActionError(null);

    const resolution = resolveEfficiencyAction(candidate, tasks, selectedMinutes);

    if (resolution.type === 'START_TASK') {
      closeDecideModal();
      onStartSession(resolution.task);
    } else if (resolution.type === 'OPEN_REVIEW') {
      closeDecideModal();
      if (onOpenReviewRecommendation) {
        onOpenReviewRecommendation(resolution.reviewId);
      }
    } else if (resolution.type === 'BLOCKED') {
      setActionError(resolution.reason);
    }
  };

  const getSubjectName = (subjectId?: string) => {
    if (!subjectId) return null;
    const subj = subjects.find(s => s.id === subjectId);
    return subj ? subj.name : null;
  };

  const getTopicName = (topicId?: string) => {
    if (!topicId) return null;
    const top = topics.find(t => t.id === topicId);
    return top ? top.name : null;
  };

  const perdidoPlan = generateEstouPerdidoPlan(tasks, subjects);

  const activeDoTasks = tasks.filter(t => t.decision === 'FAZER' && t.status !== 'abandoned');
  const postponedTasks = tasks.filter(t => t.decision === 'ADIAR' || t.decision === 'NAO_FAZER' || t.status === 'abandoned');

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header & Energy Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              SISTEMA OPERACIONAL DE APRENDIZAGEM
            </span>
            <span className="text-xs text-slate-400">• Hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
            Olá, {user.name}. O que vamos aprender hoje?
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Foco em eficiência: maior retenção real com zero desperdício de tempo.
          </p>
        </div>

        {/* Energy Picker */}
        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex items-center gap-3">
          <div className="text-xs font-medium text-slate-400 pl-1 flex items-center gap-1.5">
            <Icon name="Zap" size={15} className="text-amber-400" />
            <span>Energia Atual:</span>
          </div>
          <div className="flex gap-1">
            {(['low', 'medium', 'high'] as EnergyLevel[]).map(level => {
              const labels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
              const colors = {
                low: 'hover:bg-amber-500/20 text-amber-300',
                medium: 'hover:bg-blue-500/20 text-blue-300',
                high: 'hover:bg-emerald-500/20 text-emerald-300',
              };
              const active = user.currentEnergyLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => handleEnergyChange(level)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition ${
                    active
                      ? 'bg-slate-700 text-white font-semibold shadow-sm'
                      : `text-slate-400 ${colors[level]}`
                  }`}
                >
                  {labels[level]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Plan Feasibility & Anti-Overload Banner */}
      <div className={`p-5 rounded-2xl border ${
        feasibility.isOverloaded 
          ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' 
          : 'bg-slate-900 border-slate-800 text-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon 
                name={feasibility.isOverloaded ? 'AlertCircle' : 'CheckCircle2'} 
                className={feasibility.isOverloaded ? 'text-amber-400' : 'text-emerald-400'} 
                size={20} 
              />
              <span className="font-semibold text-sm">
                Viabilidade do Plano: {feasibility.feasibilityPercentage}% ({Math.round(feasibility.plannedMinutes / 60 * 10) / 10}h planejad{feasibility.plannedMinutes > 60 ? 'as' : 'a'} / {user.availableHoursPerDay}h disponívei{user.availableHoursPerDay > 1 ? 's' : 'l'})
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {feasibility.statusText}
            </p>
          </div>

          {feasibility.isOverloaded && (
            <button
              onClick={handleReorganize}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Icon name="SlidersHorizontal" size={16} />
              Reorganizar com Eficiência
            </button>
          )}
        </div>
      </div>

      {/* Diagnóstico Inicial Adaptativo Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 text-slate-200 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                DIAGNÓSTICO INICIAL ADAPTATIVO
              </span>
              {user.diagnostic?.completedAt ? (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <Icon name="CheckCircle2" size={13} /> Concluído
                </span>
              ) : (
                <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                  <Icon name="Clock" size={13} /> Pendente de Construção
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white">
              {user.diagnostic?.completedAt ? 'Seu Ponto de Partida Investigativo' : 'Descubra suas primeiras hipóteses de aprendizado'}
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {user.diagnostic?.completedAt
                ? `Primeira Hipótese: "${user.diagnostic.initialHypothesis?.hypothesisText || 'Ajuste de metacognição e correção ativa'}" • Confiança: ${user.diagnostic.initialHypothesis?.confidence || 'MODERADA'}`
                : 'Responda a 7 passos leves + 4 microatividades curtas para entender como você lida com erros, acertos e travas de raciocínio.'}
            </p>
          </div>

          <button
            onClick={onOpenDiagnostic}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 shrink-0"
          >
            <Icon name="Target" size={16} />
            <span>{user.diagnostic?.completedAt ? 'Ver Resultado Completo' : 'Iniciar Diagnóstico'}</span>
          </button>
        </div>
      </div>

      {/* Emergency & Quick Decision Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Decide por mim */}
        <button
          onClick={openDecideModal}
          className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20 transition text-left flex items-center justify-between group"
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
              <Icon name="Sparkles" size={16} />
              <span>DECIDE POR MIM</span>
            </div>
            <p className="text-sm font-bold mt-1">Melhor uso do seu tempo agora</p>
            <p className="text-[11px] text-blue-100/80 mt-0.5">
              O JUJU compara as ações disponíveis considerando aprendizagem, obrigação, tempo e energia.
            </p>
          </div>
          <Icon name="ArrowRight" size={20} className="group-hover:translate-x-1 transition" />
        </button>

        {/* Estou Perdido */}
        <button
          onClick={() => setShowPerdidoModal(true)}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-left flex items-center justify-between group"
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Icon name="Compass" size={16} />
              <span>ESTOU PERDIDO</span>
            </div>
            <p className="text-sm font-bold mt-1">Plano Mínimo Sem Culpa</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Sinta clareza instantânea sem tentar cobrir tudo.</p>
          </div>
          <Icon name="ArrowRight" size={20} className="group-hover:translate-x-1 transition text-slate-400" />
        </button>

        {/* Não Consigo Começar */}
        <button
          onClick={() => {
            setAtomicStepIndex(0);
            setShowAtomicModal(true);
          }}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-left flex items-center justify-between group"
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Icon name="Target" size={16} />
              <span>NÃO CONSIGO COMEÇAR</span>
            </div>
            <p className="text-sm font-bold mt-1">Ação Atômica (8 minutos)</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Destrave o atrito inicial em passos mínimos.</p>
          </div>
          <Icon name="ArrowRight" size={20} className="group-hover:translate-x-1 transition text-slate-400" />
        </button>
      </div>

      {/* Main Essential Task List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="CheckSquare" className="text-blue-500" size={20} />
            <span>Tarefas Essenciais de Hoje</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
              {activeDoTasks.filter(t => t.status === 'completed').length} de {activeDoTasks.length} concluídas
            </span>
          </h2>
        </div>

        {activeDoTasks.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <Icon name="Sparkles" size={32} className="mx-auto text-emerald-400" />
            <p className="font-semibold text-white">Nenhuma tarefa essencial pendente!</p>
            <p className="text-xs text-slate-400">Você já concluiu ou reorganizou suas atividades diárias.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDoTasks.map(task => {
              const subj = subjects.find(s => s.id === task.subjectId);
              const isDone = task.status === 'completed';

              return (
                <div
                  key={task.id}
                  className={`p-5 rounded-2xl border transition ${
                    isDone 
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-60' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <button
                        onClick={() => handleTaskStatusToggle(task.id)}
                        className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition ${
                          isDone 
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950' 
                            : 'border-slate-700 hover:border-blue-500 text-transparent'
                        }`}
                      >
                        <Icon name="Check" size={14} className={isDone ? 'stroke-[3]' : ''} />
                      </button>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                            style={{ backgroundColor: `${subj?.color || '#3b82f6'}20`, color: subj?.color || '#3b82f6' }}
                          >
                            {subj?.name || 'Geral'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                            FAZER
                          </span>
                          {task.isCritical && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                              CRÍTICO
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Icon name="Clock" size={13} />
                            {task.durationMinutes} min
                          </span>
                        </div>

                        <h3 className={`font-semibold text-sm text-slate-100 ${isDone ? 'line-through text-slate-400' : ''}`}>
                          {task.title}
                        </h3>

                        {/* Por quê & Como */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
                            <span className="font-semibold text-blue-400">POR QUÊ: </span>
                            <span className="text-slate-300">{task.rationale}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
                            <span className="font-semibold text-emerald-400">COMO: </span>
                            <span className="text-slate-300">
                              {task.category === 'questoes' && 'Resolva com foco em diagnóstico. Marque dúvidas.'}
                              {task.category === 'correcao' && 'Identifique o gargalo no caderno de erros.'}
                              {task.category === 'revisao' && 'Esquematize em folha em branco de memória.'}
                              {task.category === 'teoria' && 'Estudo ativo e direcionado aos pré-requisitos.'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => onStartSession(task)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow transition flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Icon name="Play" size={14} />
                        Começar
                      </button>
                      <button
                        onClick={() => onCreatePodcast(task.title)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] rounded-xl transition flex items-center gap-1 whitespace-nowrap"
                      >
                        <Icon name="Headphones" size={13} />
                        Gerar Áudio
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pode Esperar (Subtração / Adiados / Não Fazer) */}
      {postponedTasks.length > 0 && (
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
              <Icon name="MinusCircle" size={16} />
              <span>PODE ESPERAR OU ELIMINADO (Princípio da Subtração)</span>
            </h3>
          </div>

          <div className="space-y-2">
            {postponedTasks.map(task => {
              const subj = subjects.find(s => s.id === task.subjectId);
              const isNoDo = task.decision === 'NAO_FAZER' || task.status === 'abandoned';

              return (
                <div
                  key={task.id}
                  className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 text-slate-400 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                        isNoDo ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isNoDo ? 'NÃO FAZER' : 'ADIADO'}
                      </span>
                      <span className="text-xs font-medium text-slate-300">{task.title}</span>
                      <span className="text-[10px] text-slate-500">({subj?.name})</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{task.rationale}</p>
                  </div>

                  <button
                    onClick={() => {
                      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, decision: 'FAZER', status: 'pending' } : t));
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition whitespace-nowrap"
                  >
                    Reincluir
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Decide Por Mim (Motor V2) */}
      {showDecideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 text-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-base">
                <Icon name="Sparkles" size={20} />
                <span>Decisão JUJU para os Próximos Minutos</span>
              </div>
              <button onClick={closeDecideModal} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* Subtitle / Tagline */}
            <div className="flex items-center justify-between bg-blue-950/20 border border-blue-500/20 px-3.5 py-2 rounded-xl text-xs text-blue-200">
              <span className="font-bold flex items-center gap-1.5">
                <Icon name="ShieldCheck" size={15} className="text-blue-400" />
                O JUJU recomenda. Você decide.
              </span>
              <span className="text-[11px] text-slate-400">Motor de Eficiência V2</span>
            </div>

            {/* Time Window & Energy Selection */}
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Icon name="Clock" size={14} className="text-blue-400" />
                  Quanto tempo você tem agora?
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {[15, 30, 60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      onClick={() => handleSelectMinutes(mins)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        selectedMinutes === mins
                          ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400/50'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Icon name="Zap" size={14} className="text-amber-400" />
                  Energia Atual:
                </span>
                <span className="font-semibold text-slate-200 uppercase">
                  {user.currentEnergyLevel === 'low' && 'Baixa'}
                  {user.currentEnergyLevel === 'medium' && 'Média'}
                  {user.currentEnergyLevel === 'high' && 'Alta'}
                </span>
              </div>
            </div>

            {/* DECIDIR Button (shown when no output & no error, or when resetting) */}
            {decisionOutput === null && decisionError === null && (
              <div className="pt-2">
                <button
                  onClick={handleDecideV2}
                  disabled={selectedMinutes === null || isDeciding}
                  className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 ${
                    selectedMinutes === null || isDeciding
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                  }`}
                >
                  {isDeciding ? (
                    <>
                      <Icon name="RefreshCw" size={16} className="animate-spin text-blue-200" />
                      <span>Analisando as ações disponíveis…</span>
                    </>
                  ) : (
                    <>
                      <Icon name="Sparkles" size={16} />
                      <span>DECIDIR MELHOR USO DO TEMPO</span>
                    </>
                  )}
                </button>
                {selectedMinutes === null && (
                  <p className="text-[11px] text-slate-400 text-center mt-2">
                    Escolha quanto tempo você tem disponível acima para decidir.
                  </p>
                )}
              </div>
            )}

            {/* Error State */}
            {decisionError && (
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 space-y-3">
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-red-300">
                    <Icon name="AlertTriangle" size={16} className="text-red-400" />
                    Não foi possível calcular uma recomendação agora.
                  </p>
                  <p className="text-slate-300">{decisionError}</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleDecideV2}
                    disabled={selectedMinutes === null}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50"
                  >
                    TENTAR NOVAMENTE
                  </button>
                  <button
                    onClick={closeDecideModal}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
                  >
                    FECHAR
                  </button>
                </div>
              </div>
            )}

            {/* Action Execution Error Banner (BLOCKED state) */}
            {actionError && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                <div className="flex items-start gap-2">
                  <Icon name="AlertTriangle" size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-300">A situação mudou desde que esta decisão foi calculada.</p>
                    <p className="text-slate-300 text-[11px] mt-0.5">{actionError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setDecisionOutput(null);
                      setActionError(null);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition"
                  >
                    RECALCULAR
                  </button>
                  <button
                    onClick={() => setActionError(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
                  >
                    VOLTAR
                  </button>
                </div>
              </div>
            )}

            {/* Recommendation Result */}
            {decisionOutput && (
              <div className="space-y-4">
                {decisionOutput.primaryCandidate ? (
                  <div className="space-y-4">
                    {/* Primary Candidate Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-500/40 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                            {decisionOutput.primaryCandidate.candidate.sourceType === 'REVIEW' ? 'Revisão Adaptativa' : 'Tarefa'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {decisionOutput.primaryCandidate.candidate.durationMinutes} min
                          </span>
                          {getSubjectName(decisionOutput.primaryCandidate.candidate.subjectId) && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800/80 text-blue-200">
                              {getSubjectName(decisionOutput.primaryCandidate.candidate.subjectId)}
                            </span>
                          )}
                          {getTopicName(decisionOutput.primaryCandidate.candidate.topicId) && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                              {getTopicName(decisionOutput.primaryCandidate.candidate.topicId)}
                            </span>
                          )}
                        </div>

                        {/* Confidence Badge */}
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          decisionOutput.recommendationConfidence === 'HIGH'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : decisionOutput.recommendationConfidence === 'MODERATE'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          Confiança {decisionOutput.recommendationConfidence === 'HIGH' ? 'Alta' : decisionOutput.recommendationConfidence === 'MODERATE' ? 'Moderada' : 'Baixa'}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-white">
                          {decisionOutput.primaryCandidate.candidate.title}
                        </h4>
                        <p className="text-xs text-blue-200/90 mt-1 leading-relaxed">
                          {decisionOutput.primaryCandidate.rationale}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Indica quanto os dados atuais sustentam esta escolha.
                        </p>
                      </div>

                      {/* POR QUE ISSO? */}
                      {decisionOutput.primaryCandidate.reasons.length > 0 && (
                        <div className="pt-2.5 border-t border-blue-500/20 space-y-1">
                          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                            POR QUE ISSO?
                          </span>
                          <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc">
                            {decisionOutput.primaryCandidate.reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* O que ainda não sabemos */}
                      {decisionOutput.uncertainties.length > 0 && (
                        <div className="pt-2 border-t border-amber-500/20 space-y-1">
                          <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                            <Icon name="HelpCircle" size={13} />
                            O que ainda não sabemos:
                          </span>
                          <ul className="text-[11px] text-amber-200/90 space-y-0.5 pl-4 list-disc">
                            {decisionOutput.uncertainties.map((u, i) => (
                              <li key={i}>{u}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Primary Execution CTA Button */}
                      <div className="pt-3 border-t border-blue-500/20">
                        <button
                          onClick={() => handleExecuteEfficiencyCandidate(decisionOutput.primaryCandidate!)}
                          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
                        >
                          <Icon name={decisionOutput.primaryCandidate.candidate.sourceType === 'REVIEW' ? 'BookOpen' : 'Play'} size={16} />
                          <span>
                            {decisionOutput.primaryCandidate.candidate.sourceType === 'REVIEW' ? 'ABRIR REVISÃO' : 'INICIAR TAREFA'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Alternatives and Action buttons */}
                    {(() => {
                      const alternativeCandidates = decisionOutput.rankedCandidates.filter(
                        c => c.candidate.id !== decisionOutput.primaryCandidate?.candidate.id
                      );

                      return (
                        <>
                          {/* Alternatives list when DISCORDO clicked */}
                          {showAlternatives && (
                            <div className="space-y-2 pt-2 border-t border-slate-800">
                              <p className="text-xs text-slate-300 font-medium">
                                Tudo bem. Estas foram outras ações consideradas.
                              </p>
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {alternativeCandidates.slice(0, 3).map((alt, idx) => {
                                  const fits = alt.candidate.durationMinutes <= (selectedMinutes || 0);
                                  const isNoDo = alt.decision === 'NAO_FAZER';

                                  const decisionLabel =
                                    alt.decision === 'FAZER'
                                      ? 'Fazer agora'
                                      : alt.decision === 'ADIAR'
                                      ? 'Pode esperar'
                                      : 'Não vale priorizar agora';

                                  const decisionColor =
                                    alt.decision === 'FAZER'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : isNoDo
                                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                      : 'bg-slate-800 text-slate-400 border-slate-700';

                                  return (
                                    <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between gap-3">
                                      <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-bold text-slate-200 truncate">{alt.candidate.title}</p>
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${decisionColor}`}>
                                            {decisionLabel}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">{alt.rationale}</p>
                                      </div>

                                      <div className="shrink-0 flex items-center gap-2">
                                        {!fits ? (
                                          <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-semibold text-amber-400">
                                              Não cabe em {selectedMinutes} min.
                                            </span>
                                            <button
                                              onClick={handleResetTimeSelection}
                                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg transition"
                                            >
                                              ALTERAR TEMPO
                                            </button>
                                          </div>
                                        ) : isNoDo ? (
                                          <button
                                            onClick={() => handleExecuteEfficiencyCandidate(alt)}
                                            className="px-2.5 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white font-bold text-[11px] rounded-lg transition"
                                          >
                                            ESCOLHER MESMO ASSIM
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleExecuteEfficiencyCandidate(alt)}
                                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-lg transition"
                                          >
                                            ESCOLHER ESTA
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Result Action Buttons (ENTENDI, ALTERAR TEMPO, DISCORDO) */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-800 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={closeDecideModal}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                              >
                                ENTENDI
                              </button>
                              <button
                                onClick={handleResetTimeSelection}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
                              >
                                ALTERAR TEMPO
                              </button>
                            </div>
                            {!showAlternatives && alternativeCandidates.length > 0 && (
                              <button
                                onClick={() => setShowAlternatives(true)}
                                className="px-3.5 py-2 text-slate-400 hover:text-white font-medium text-xs rounded-xl transition"
                              >
                                DISCORDO
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  /* Primary Candidate is NULL */
                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
                    <Icon name="Clock" size={24} className="mx-auto text-amber-400" />
                    {decisionOutput.rankedCandidates.length > 0 ? (
                      /* CASO A: Existem ações, mas nenhuma cabe / é adequada como FAZER agora */
                      <>
                        <p className="font-bold text-sm text-white">Nenhuma atividade cabe na janela de tempo selecionada.</p>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                          {decisionOutput.reasons[0] || 'Selecione uma janela de tempo maior para acomodar as atividades pendentes.'}
                        </p>
                        <div className="pt-2 flex justify-center gap-2">
                          <button
                            onClick={handleResetTimeSelection}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition"
                          >
                            ALTERAR TEMPO
                          </button>
                          <button
                            onClick={closeDecideModal}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
                          >
                            FECHAR
                          </button>
                        </div>
                      </>
                    ) : (
                      /* CASO B: Não existem candidatas */
                      <>
                        <p className="font-bold text-sm text-white">Nenhuma tarefa ou revisão disponível precisa ser priorizada agora.</p>
                        <div className="pt-2 flex justify-center">
                          <button
                            onClick={closeDecideModal}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
                          >
                            FECHAR
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Estou Perdido */}
      {showPerdidoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Icon name="Compass" size={20} />
                <span>Estou Perdido — Resgate de Ritmo</span>
              </div>
              <button onClick={() => setShowPerdidoModal(false)} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            <p className="text-xs text-amber-200 bg-amber-950/30 p-3 rounded-xl border border-amber-500/20 leading-relaxed">
              {perdidoPlan.reassuringMessage}
            </p>

            {perdidoPlan.singleTask && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400">Única Tarefa Essencial de Resgate:</span>
                <h4 className="font-bold text-sm text-white">{perdidoPlan.singleTask.title}</h4>
                <p className="text-xs text-slate-400">{perdidoPlan.singleTask.rationale}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPerdidoModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Fechar
              </button>
              {perdidoPlan.singleTask && (
                <button
                  onClick={() => {
                    setShowPerdidoModal(false);
                    onStartSession(perdidoPlan.singleTask!);
                  }}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow flex items-center gap-2"
                >
                  <Icon name="Play" size={16} />
                  Fazer Apenas Esta
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Não Consigo Começar (Passos Atômicos) */}
      {showAtomicModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <Icon name="Target" size={20} />
                <span>Passo Atômico de 8 Minutos</span>
              </div>
              <button onClick={() => setShowAtomicModal(false)} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2 text-center">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Passo {atomicStepIndex + 1} de 3
                </p>
                {atomicStepIndex === 0 && (
                  <h4 className="font-bold text-base text-white">1. Abra o material da questão 1 na tela.</h4>
                )}
                {atomicStepIndex === 1 && (
                  <h4 className="font-bold text-base text-white">2. Leia apenas o enunciado e grife o comando final.</h4>
                )}
                {atomicStepIndex === 2 && (
                  <h4 className="font-bold text-base text-white">3. Tente anotar os dados por apenas 3 minutos.</h4>
                )}
                <p className="text-xs text-slate-400">
                  Zero pressão. Se quiser parar aos 8 minutos, você já venceu a procrastinação.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setShowAtomicModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-medium"
              >
                Sair
              </button>

              <button
                onClick={() => {
                  if (atomicStepIndex < 2) {
                    setAtomicStepIndex(atomicStepIndex + 1);
                  } else {
                    setShowAtomicModal(false);
                    if (activeDoTasks.length > 0) onStartSession(activeDoTasks[0]);
                  }
                }}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow flex items-center gap-2"
              >
                <span>{atomicStepIndex < 2 ? 'Próximo Micro-Passo' : 'Entrar no Ritmo'}</span>
                <Icon name="ArrowRight" size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

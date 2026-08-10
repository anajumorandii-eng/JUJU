import React, { useState, useEffect } from 'react';
import { TaskItem, StudySession, Subject, EnergyLevel } from '../types';
import { Icon } from './Icon';

interface StudySessionViewProps {
  userId: string;
  currentTask: TaskItem | null;
  subjects: Subject[];
  onCompleteSession: (session: StudySession) => void;
  onCancelSession: () => void;
}

export const StudySessionView: React.FC<StudySessionViewProps> = ({
  userId,
  currentTask,
  subjects,
  onCompleteSession,
  onCancelSession,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [notes, setNotes] = useState('');
  const [showReflectionModal, setShowReflectionModal] = useState(false);

  // Reflection form state
  const [comprehensionScore, setComprehensionScore] = useState(4);
  const [canExplain, setCanExplain] = useState(true);
  const [methodFeedback, setMethodFeedback] = useState('O método gerou alta retenção.');

  const subj = currentTask ? subjects.find(s => s.id === currentTask.subjectId) : null;

  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinishClick = () => {
    setIsRunning(false);
    setShowReflectionModal(true);
  };

  const handleSaveSession = () => {
    const actualMins = Math.max(1, Math.round(seconds / 60));
    const newSession: StudySession = {
      id: `sess_${Date.now()}`,
      userId,
      taskId: currentTask?.id,
      subjectId: currentTask?.subjectId || 'mat',
      topicId: currentTask?.topicId,
      plannedMinutes: currentTask?.durationMinutes || 30,
      actualMinutes: actualMins,
      energyLevel: currentTask?.energyRequired || 'medium',
      comprehensionScore,
      canExplain,
      methodUsed: currentTask?.category || 'questoes',
      notes,
      completedAt: new Date().toISOString(),
    };

    onCompleteSession(newSession);
  };

  if (!currentTask) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto">
          <Icon name="PlayCircle" size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Nenhuma Sessão Ativa</h2>
        <p className="text-xs text-slate-400">
          Selecione uma tarefa essencial na "Tela Hoje" ou no seu Planejamento para iniciar um bloco de estudo focado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: subj?.color || '#3b82f6' }}
          />
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">{subj?.name}</span>
            <h1 className="text-xl font-bold text-white">{currentTask.title}</h1>
          </div>
        </div>
        <button
          onClick={onCancelSession}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
        >
          Encerrar sem salvar
        </button>
      </div>

      {/* Main Timer Display */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-xl">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
            TEMPO DE SESSÃO ATIVA
          </span>
          <div className="text-6xl font-extrabold text-white font-mono tracking-tight my-2">
            {formatTime(seconds)}
          </div>
          <p className="text-xs text-slate-400">
            Meta planejada: {currentTask.durationMinutes} minutos (Bloco de alta eficiência)
          </p>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition flex items-center gap-2 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            <Icon name={isRunning ? 'Pause' : 'Play'} size={18} />
            <span>{isRunning ? 'Pausar Bloco' : 'Iniciar Foco'}</span>
          </button>

          <button
            onClick={handleFinishClick}
            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-2xl shadow transition flex items-center gap-2"
          >
            <Icon name="CheckCircle2" size={18} />
            <span>Concluir e Refletir</span>
          </button>
        </div>
      </div>

      {/* Active Guidance & Scratchpad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Icon name="Compass" className="text-blue-400" size={18} />
            <span>Guia Metodológico da Sessão</span>
          </h3>
          <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">•</span>
              <span><strong>Mantenha o foco ativo:</strong> Em vez de reler passivamente, resolva ou tente explicar de memória.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span><strong>Anote os bloqueios:</strong> Se empacar em um passo, registre o motivo no rascunho.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span><strong>Pause ao esgotar:</strong> Se sentir queda drástica de atenção, encerre a sessão. Menos tempo com mais foco vence horas arrastadas.</span>
            </li>
          </ul>
        </div>

        {/* Notes Scratchpad */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 flex flex-col">
          <label className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Icon name="Edit3" className="text-amber-400" size={18} />
            <span>Rascunho Rápido de Dúvidas / Descobertas</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anote dúvidas, fórmulas chave ou sacadas que surgirem durante a resolução..."
            className="w-full h-32 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      {/* MODAL: Post-Session Metacognitive Reflection */}
      {showReflectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <Icon name="Brain" size={20} />
                <span>Reflexão Metacognitiva Pós-Estudo</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              JUJU não quer saber apenas o tempo estudado. O que realmente importa é a qualidade do aprendizado gerado.
            </p>

            <div className="space-y-4 text-xs">
              {/* Question 1: Comprehension */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200">1. Quanto do conteúdo você realmente compreendeu?</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => setComprehensionScore(score)}
                      className={`flex-1 py-2 rounded-xl font-bold transition ${
                        comprehensionScore === score
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {score}★
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2: Explainability */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200">2. Conseguiria explicar este raciocínio sem consultar o material?</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCanExplain(true)}
                    className={`flex-1 py-2 rounded-xl font-semibold transition ${
                      canExplain ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Sim, tranquilamente
                  </button>
                  <button
                    onClick={() => setCanExplain(false)}
                    className={`flex-1 py-2 rounded-xl font-semibold transition ${
                      !canExplain ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Não / Parcialmente
                  </button>
                </div>
              </div>

              {/* Question 3: Method Feedback */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200">3. Como foi a eficiência da técnica utilizada?</label>
                <input
                  type="text"
                  value={methodFeedback}
                  onChange={(e) => setMethodFeedback(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleSaveSession}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
              >
                Salvar Sessão e Atualizar Domínio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

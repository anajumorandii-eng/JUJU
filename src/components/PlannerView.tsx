import React from 'react';
import { UserProfile, TaskItem, Subject, TopicNode } from '../types';
import { Icon } from './Icon';
import { calculatePlanFeasibility, autoReorganizeTasks } from '../services/efficiencyEngine';

interface PlannerViewProps {
  user: UserProfile;
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  subjects: Subject[];
  topics: TopicNode[];
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  user,
  tasks,
  setTasks,
  subjects,
  topics,
}) => {
  const feasibility = calculatePlanFeasibility(user, tasks);

  const handleReorganize = () => {
    const reorganized = autoReorganizeTasks(user, tasks, topics);
    setTasks(reorganized);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              PLANEJAMENTO SUSTENTÁVEL
            </span>
            <span className="text-xs text-slate-400">• Rotina & Orçamento de Tempo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
            Planejamento Semanal Eficiente
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evite a ilusão do cronograma lotado. Planeje apenas o que você consegue executar com alta qualidade.
          </p>
        </div>

        <button
          onClick={handleReorganize}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 whitespace-nowrap"
        >
          <Icon name="SlidersHorizontal" size={16} />
          Reorganizar por ROI de Aprendizado
        </button>
      </div>

      {/* Time Budget & Feasibility Indicator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase">Tempo Disponível Real</span>
          <p className="text-2xl font-extrabold text-white">{user.availableHoursPerDay} horas/dia</p>
          <p className="text-[11px] text-slate-400">Sincronizado com o Google Calendar sem sobreposição.</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase">Tempo Planejado Ativo</span>
          <p className="text-2xl font-extrabold text-blue-400">{Math.round(feasibility.plannedMinutes / 60 * 10) / 10} horas/dia</p>
          <p className="text-[11px] text-slate-400">Total de atividades com decisão "FAZER".</p>
        </div>

        <div className={`p-5 rounded-2xl border ${
          feasibility.isOverloaded ? 'bg-amber-950/30 border-amber-500/40' : 'bg-slate-900 border-slate-800'
        }`}>
          <span className="text-xs font-semibold text-slate-400 uppercase">Índice de Viabilidade</span>
          <p className={`text-2xl font-extrabold ${feasibility.isOverloaded ? 'text-amber-400' : 'text-emerald-400'}`}>
            {feasibility.feasibilityPercentage}%
          </p>
          <p className="text-[11px] text-slate-400">{feasibility.statusText}</p>
        </div>
      </div>

      {/* Weekly Days Schedule Grid */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Icon name="Calendar" className="text-blue-400" size={20} />
          <span>Visão da Semana</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day, idx) => {
            const isToday = idx === 1; // e.g. Terça
            return (
              <div
                key={day}
                className={`p-4 rounded-2xl border space-y-3 ${
                  isToday ? 'bg-blue-950/20 border-blue-500/40' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>{day}</span>
                  {isToday && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-slate-950">HOJE</span>}
                </div>

                <div className="space-y-2 text-xs">
                  {tasks.slice(0, 2).map((t, tIdx) => {
                    const subj = subjects.find(s => s.id === t.subjectId);
                    return (
                      <div key={tIdx} className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[9px] font-bold text-blue-400 uppercase">{subj?.name}</span>
                        <p className="text-[11px] text-slate-200 font-medium truncate">{t.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

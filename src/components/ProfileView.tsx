import React from 'react';
import { UserProfile } from '../types';
import { Icon } from './Icon';

interface ProfileViewProps {
  user: UserProfile;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenOnboarding: () => void;
  onOpenDiagnostic: () => void;
  onNavigateTab: (tab: string) => void;
}

const ENERGY_LABEL: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const MORE_FEATURES = [
  { id: 'questoes', label: 'Questões & Tentativas', icon: 'CheckSquare', description: 'Banco de questões, tentativas e evidências de aprendizado.' },
  { id: 'revisoes', label: 'Revisões Adaptativas', icon: 'RotateCw', description: 'O que revisar agora, com base em evidência real.' },
  { id: 'erros', label: 'Caderno de Erros', icon: 'AlertTriangle', description: 'Padrões de erro e causa raiz de cada dificuldade.' },
  { id: 'podcast', label: 'Podcast JUJU', icon: 'Headphones', description: 'Sessões de aprendizagem em áudio, sob medida.' },
  { id: 'aprender', label: 'Tutor Socrático', icon: 'Bot', description: 'Pergunta, pista, raciocínio — nunca resposta pronta.' },
  { id: 'laboratorio', label: 'Laboratório & Métodos', icon: 'FlaskConical', description: 'Teste hipóteses sobre o que funciona para você.' },
  { id: 'conexoes', label: 'Conexões Google', icon: 'Link2', description: 'Calendar, Drive, Classroom, Docs e Sheets.' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  darkMode,
  setDarkMode,
  onOpenOnboarding,
  onOpenDiagnostic,
  onNavigateTab,
}) => {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xl">
            {user.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{user.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {user.targetCourse} • {user.targetUniversities.join(', ')}
            </p>
          </div>
        </div>
        <button
          onClick={onOpenOnboarding}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-2 self-start md:self-auto"
        >
          <Icon name="Pencil" size={14} />
          Editar perfil
        </button>
      </div>

      {/* Diagnostic status */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon name="Target" size={20} className="text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-white">Diagnóstico Adaptativo</p>
            <p className="text-xs text-slate-400">
              {user.diagnostic?.completedAt
                ? `Concluído em ${new Date(user.diagnostic.completedAt).toLocaleDateString('pt-BR')}`
                : 'Ainda não realizado — ajuda o JUJU a entender seus pontos fortes e gargalos.'}
            </p>
          </div>
        </div>
        <button
          onClick={onOpenDiagnostic}
          className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold transition whitespace-nowrap"
        >
          {user.diagnostic?.completedAt ? 'Ver resultado' : 'Iniciar'}
        </button>
      </div>

      {/* Metas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Horas/dia</p>
          <p className="text-lg font-bold text-white mt-1">{user.availableHoursPerDay}h</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Dias/semana</p>
          <p className="text-lg font-bold text-white mt-1">{user.studyDaysPerWeek}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Energia atual</p>
          <p className="text-lg font-bold text-white mt-1">{ENERGY_LABEL[user.currentEnergyLevel] || user.currentEnergyLevel}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Autonomia (autoavaliação)</p>
          <p className="text-lg font-bold text-white mt-1">{user.autonomyIndex}/100</p>
        </div>
      </div>

      {user.targetExams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {user.targetExams.map((exam) => (
            <span key={exam} className="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              {exam}
            </span>
          ))}
        </div>
      )}

      {/* Preferências */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon name={darkMode ? 'Moon' : 'Sun'} size={18} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-200">Tema {darkMode ? 'escuro' : 'claro'}</p>
        </div>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          Alternar
        </button>
      </div>

      {/* Mais recursos */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Mais recursos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MORE_FEATURES.map((feature) => (
            <button
              key={feature.id}
              onClick={() => onNavigateTab(feature.id)}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-left transition flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                <Icon name={feature.icon} size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{feature.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{feature.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

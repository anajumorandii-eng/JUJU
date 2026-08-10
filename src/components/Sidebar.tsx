import React from 'react';
import { UserProfile } from '../types';
import { Icon } from './Icon';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: UserProfile;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenOnboarding: () => void;
  onOpenDiagnostic: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  darkMode,
  setDarkMode,
  onOpenOnboarding,
  onOpenDiagnostic,
}) => {
  const navItems = [
    { id: 'hoje', label: 'Hoje', icon: 'Sun', badge: 'Central' },
    { id: 'plano', label: 'Plano', icon: 'Calendar' },
    { id: 'estudar', label: 'Sessão de Estudo', icon: 'PlayCircle' },
    { id: 'questoes', label: 'Questões & Tentativas', icon: 'CheckSquare', badge: 'Novo' },
    { id: 'revisoes', label: 'Revisões Adaptativas', icon: 'RotateCw', badge: 'Motor' },
    { id: 'erros', label: 'Caderno de Erros', icon: 'AlertTriangle', badge: 'IA' },
    { id: 'podcast', label: 'Podcast JUJU', icon: 'Headphones', badge: 'Áudio' },
    { id: 'aprender', label: 'Tutor Socrático', icon: 'Bot', badge: 'IA' },
    { id: 'laboratorio', label: 'Laboratório & Métodos', icon: 'FlaskConical' },
    { id: 'evolucao', label: 'Evolução & Domínio', icon: 'TrendingUp' },
    { id: 'conexoes', label: 'Conexões Google', icon: 'Link2' },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 text-slate-200 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-500/20">
              J
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight leading-none">JUJU</h1>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide mt-1">INTELIGÊNCIA DE ESTUDO</p>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Alternar Tema"
          >
            <Icon name={darkMode ? 'Sun' : 'Moon'} size={18} />
          </button>
        </div>

        {/* User Mini Banner */}
        <div className="mx-3 my-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-semibold text-xs">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.targetCourse} • {user.targetUniversities[0]}</p>
              </div>
            </div>
            <button
              onClick={onOpenOnboarding}
              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition"
            >
              Perfil
            </button>
          </div>

          <button
            onClick={onOpenDiagnostic}
            className="w-full py-1.5 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 flex items-center justify-between text-[10px] font-bold transition"
          >
            <div className="flex items-center gap-1.5">
              <Icon name="Target" size={13} className="text-blue-400" />
              <span>Diagnóstico Adaptativo</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-200">
              {user.diagnostic?.completedAt ? 'Ver Resultado' : 'Iniciar'}
            </span>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon name={item.icon} size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Mantra */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="text-[11px] text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Aprenda a aprender.</p>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Eficiência = Máximo aprendizado com mínimo desperdício.
          </p>
        </div>
      </div>
    </aside>
  );
};

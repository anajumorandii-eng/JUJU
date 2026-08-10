import React from 'react';
import { Icon } from './Icon';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const PRIMARY_NAV_ITEMS = [
  { id: 'hoje', label: 'Hoje', icon: 'Sun' },
  { id: 'plano', label: 'Plano', icon: 'Calendar' },
  { id: 'estudar', label: 'Estudar', icon: 'PlayCircle' },
  { id: 'evolucao', label: 'Evolução', icon: 'TrendingUp' },
  { id: 'perfil', label: 'Perfil', icon: 'User' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-5">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[10px] font-semibold transition-colors ${
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon name={item.icon} size={20} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React from 'react';
import { Icon } from './Icon';

interface DiagnosticInvitationModalProps {
  onStartNow: () => void;
  onDoLater: () => void;
}

export const DiagnosticInvitationModal: React.FC<DiagnosticInvitationModalProps> = ({
  onStartNow,
  onDoLater,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Icon name="Target" className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
              SEU PONTO DE PARTIDA
            </span>
            <h2 className="text-lg font-bold text-white mt-1">Diagnóstico Inicial Adaptativo</h2>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-6">
          Antes de recomendar seu plano de estudos, queremos entender melhor seu ponto de partida: como você estuda hoje, como reage a erros/acertos e quais os seus principais pontos de atrito.
        </p>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-6 space-y-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Icon name="CheckCircle2" className="w-4 h-4 text-emerald-400" />
            <span>Camada A: 7 perguntas rápidas de autopercepção</span>
          </div>
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Icon name="Activity" className="w-4 h-4 text-blue-400" />
            <span>Camada B: 3 a 4 microatividades práticas curtas</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onDoLater}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
          >
            FAZER DEPOIS
          </button>
          <button
            onClick={onStartNow}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <Icon name="Sparkles" className="w-4 h-4" />
            <span>COMEÇAR AGORA</span>
          </button>
        </div>
      </div>
    </div>
  );
};

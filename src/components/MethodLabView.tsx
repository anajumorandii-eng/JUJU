import React, { useState } from 'react';
import { MethodExperiment, Discovery } from '../types';
import { Icon } from './Icon';

interface MethodLabViewProps {
  experiments: MethodExperiment[];
  setExperiments: React.Dispatch<React.SetStateAction<MethodExperiment[]>>;
  discoveries: Discovery[];
}

export const MethodLabView: React.FC<MethodLabViewProps> = ({
  experiments,
  setExperiments,
  discoveries,
}) => {
  const [activeTab, setActiveTab] = useState<'experimentos' | 'biblioteca' | 'descobertas'>('experimentos');

  const libraryMethods = [
    {
      name: 'Inverted Active Learning (Questões Antes)',
      what: 'Tentar resolver 3 questões do assunto antes de abrir qualquer videoaula ou resumo.',
      whenToUse: 'Quando você já possui vaga lembrança do assunto ou quer identificar gargalos exatos.',
      whenNOTToUse: 'Em assuntos 100% inéditos onde você desconhece os termos fundamentais.',
      impact: 'Economiza até 60% do tempo de teoria inútil.',
    },
    {
      name: 'Técnica de Feynman em Voz Alta',
      what: 'Explicar o conceito como se estivesse ensinando uma criança de 10 anos.',
      whenToUse: 'Assuntos conceituais e teóricos de Biologia, História ou Química.',
      whenNOTToUse: 'Resolução pura de contas e manipulação algébrica repetitiva.',
      impact: 'Revela lacunas de memória e ilusão de competência.',
    },
    {
      name: 'Blocos Adaptativos de 45 Minutos',
      what: '45 minutos de foco contínuo seguidos de 8 minutos de pausa real sem telas.',
      whenToUse: 'Matemática e Física avançadas que exigem alta carga de memória de trabalho.',
      whenNOTToUse: 'Atividades leves de organização de materiais ou leitura fluida.',
      impact: 'Reduz a taxa de erro por desatenção no final dos blocos.',
    }
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              DESCUBRA COMO VOCÊ APRENDE
            </span>
            <span className="text-xs text-slate-400">• Ciência da Aprendizagem Pessoal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
            Laboratório de Métodos & Descobertas
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            "Você não precisa copiar a rotina do aprovado. Precisa descobrir como você aprende."
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl text-xs font-medium">
          <button
            onClick={() => setActiveTab('experimentos')}
            className={`px-3.5 py-2 rounded-xl transition ${
              activeTab === 'experimentos' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Meus Experimentos
          </button>
          <button
            onClick={() => setActiveTab('biblioteca')}
            className={`px-3.5 py-2 rounded-xl transition ${
              activeTab === 'biblioteca' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Biblioteca de Métodos
          </button>
          <button
            onClick={() => setActiveTab('descobertas')}
            className={`px-3.5 py-2 rounded-xl transition ${
              activeTab === 'descobertas' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Minhas Descobertas
          </button>
        </div>
      </div>

      {/* TAB 1: Experimentos */}
      {activeTab === 'experimentos' && (
        <div className="space-y-4">
          {experiments.map(exp => (
            <div key={exp.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                    {exp.methodType}
                  </span>
                  <h3 className="font-bold text-base text-white mt-1">{exp.name}</h3>
                </div>
                <span className={`text-xs font-extrabold px-3 py-1 rounded-xl uppercase ${
                  exp.resultDecision === 'MANTER' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  DECISÃO: {exp.resultDecision}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="font-semibold text-amber-400">Problema:</span>
                  <p className="text-slate-300 leading-relaxed">{exp.problem}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="font-semibold text-blue-400">Hipótese Testada:</span>
                  <p className="text-slate-300 leading-relaxed">{exp.hypothesis}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs space-y-1">
                <span className="font-bold text-emerald-400">Resultado & Aprendizado Real:</span>
                <p className="text-emerald-100/90 leading-relaxed">{exp.keyInsights}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Biblioteca de Métodos */}
      {activeTab === 'biblioteca' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {libraryMethods.map((m, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-white">{m.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{m.what}</p>

              <div className="space-y-2 text-xs pt-2 border-t border-slate-800">
                <div>
                  <span className="font-semibold text-emerald-400">Quando usar:</span>
                  <p className="text-slate-400">{m.whenToUse}</p>
                </div>
                <div>
                  <span className="font-semibold text-red-400">Quando NÃO usar:</span>
                  <p className="text-slate-400">{m.whenNOTToUse}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Minhas Descobertas */}
      {activeTab === 'descobertas' && (
        <div className="space-y-3">
          {discoveries.map(disc => (
            <div key={disc.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Icon name="Lightbulb" size={18} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white">{disc.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{disc.description}</p>
                <span className="text-[10px] text-slate-500 block pt-1">Descoberto em {disc.discoveredAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

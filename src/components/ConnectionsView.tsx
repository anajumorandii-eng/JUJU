import React, { useState } from 'react';
import { GoogleIntegration } from '../types';
import { Icon } from './Icon';

interface ConnectionsViewProps {
  integrations: GoogleIntegration[];
  setIntegrations: React.Dispatch<React.SetStateAction<GoogleIntegration[]>>;
  onStudyMaterial: (materialTitle: string) => void;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  integrations,
  setIntegrations,
  onStudyMaterial,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const toggleConnection = (id: string) => {
    setIntegrations(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          connected: !item.connected,
          accountEmail: !item.connected ? 'anaju.morandii@gmail.com' : undefined,
          lastSyncedAt: !item.connected ? 'Agora mesmo' : undefined,
        };
      }
      return item;
    }));
  };

  const handleFileSearch = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    setTimeout(() => {
      setSearchResults([
        {
          title: 'Apostila FUVEST 2026 - Geometria Plana Avançada.pdf',
          page: 'Página 14, Parágrafo 3',
          excerpt: '...a razão entre as áreas de dois triângulos semelhantes é igual ao quadrado da razão de semelhança k²...',
          relevance: '98% de Relevância',
        },
        {
          title: 'Resumo Manuscrito de Trigonometria e Proporção.pdf',
          page: 'Página 2',
          excerpt: '...atenção nos ângulos opostos pelo vértice para identificar os lados homólogos do triângulo...',
          relevance: '89% de Relevância',
        }
      ]);
      setSearching(false);
    }, 600);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              INTEGRAÇÃO INTELIGENTE
            </span>
            <span className="text-xs text-slate-400">• Workspace & File Search</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
            Central de Conexões Google & Materiais
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Toda integração existe apenas para reduzir seu trabalho manual e tomar decisões mais precisas.
          </p>
        </div>
      </div>

      {/* File Search Drive Library */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Icon name="Search" className="text-blue-400" size={20} />
          <span>Pesquisa Inteligente em Apostilas e Materiais (File Search)</span>
        </h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFileSearch()}
            placeholder="Ex: Em quais materiais tenho explicação de semelhança de triângulos e razão k²?"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleFileSearch}
            disabled={searching}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2"
          >
            <Icon name="Search" size={16} />
            <span>{searching ? 'Buscando...' : 'Pesquisar'}</span>
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3 pt-2">
            {searchResults.map((res, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-300">{res.title} • {res.page}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    {res.relevance}
                  </span>
                </div>
                <p className="text-slate-300 italic">{res.excerpt}</p>

                <button
                  onClick={() => onStudyMaterial(res.title)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-xl transition flex items-center gap-1.5"
                >
                  <Icon name="BookOpen" size={14} />
                  <span>Estudar Este Material Agora</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Services Integrations Grid */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Icon name="Link2" className="text-emerald-400" size={20} />
          <span>Serviços Conectados</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map(item => (
            <div key={item.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 flex items-center justify-center font-bold">
                    <Icon name={item.service === 'Calendar' ? 'Calendar' : item.service === 'Drive' ? 'HardDrive' : 'FileText'} size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Google {item.service}</h4>
                    <p className="text-[11px] text-slate-400">{item.accountEmail || 'Não conectado'}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleConnection(item.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                    item.connected
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                  }`}
                >
                  {item.connected ? 'Conectado' : 'Conectar'}
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

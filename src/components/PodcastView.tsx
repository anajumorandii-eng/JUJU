import React, { useState, useEffect } from 'react';
import { PodcastEpisode, Subject, TopicNode } from '../types';
import { Icon } from './Icon';

interface PodcastViewProps {
  podcasts: PodcastEpisode[];
  setPodcasts: React.Dispatch<React.SetStateAction<PodcastEpisode[]>>;
  subjects: Subject[];
  topics: TopicNode[];
}

export const PodcastView: React.FC<PodcastViewProps> = ({
  podcasts,
  setPodcasts,
  subjects,
  topics,
}) => {
  const [activeEpisode, setActiveEpisode] = useState<PodcastEpisode | null>(podcasts[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecallTestModal, setShowRecallTestModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  // New podcast form state
  const [newTopicName, setNewTopicName] = useState(topics[0]?.name || 'Semelhança de Triângulos');
  const [newFocusType, setNewFocusType] = useState<'Aprender do Zero' | 'Revisar Erros' | 'Pré-Prova' | 'Conexões Interdisciplinares' | 'Pré-Requisitos'>('Revisar Erros');

  // Active recall quiz state
  const [userAnswers, setUserAnswers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let interval: any = null;
    if (isPlaying && activeEpisode) {
      interval = setInterval(() => {
        setCurrentSeconds(prev => {
          if (prev + 1 >= activeEpisode.durationSeconds) {
            setIsPlaying(false);
            setShowRecallTestModal(true); // Trigger post-podcast recall check!
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, activeEpisode, playbackSpeed]);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGeneratePodcast = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: newTopicName,
          focusType: newFocusType,
          targetExam: 'FUVEST/ENEM',
        }),
      });

      const data = await res.json();
      const newEp: PodcastEpisode = {
        id: `pod_${Date.now()}`,
        title: data.title || `Podcast JUJU: ${newTopicName}`,
        subjectId: subjects[0]?.id || 'mat',
        topicId: topics[0]?.id,
        durationSeconds: 360,
        focusType: newFocusType,
        chapters: data.chapters || [],
        transcript: data.transcript || [],
        activeRecallQuestions: data.activeRecallQuestions || [],
        keyTakeaways: data.keyTakeaways || [],
        createdAt: new Date().toISOString().split('T')[0],
      };

      setPodcasts(prev => [newEp, ...prev]);
      setActiveEpisode(newEp);
      setShowCreateModal(false);
      setCurrentSeconds(0);
    } catch (err) {
      console.error('Failed to generate podcast:', err);
    } finally {
      setGenerating(false);
    }
  };

  const activeSubj = activeEpisode ? subjects.find(s => s.id === activeEpisode.subjectId) : null;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              SESSÕES DE APRENDIZAGEM EM ÁUDIO
            </span>
            <span className="text-xs text-slate-400">• Ouvir & Raciocinar</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
            Podcast JUJU — Aprendizado Focado
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Transforme tempo morto em aprendizado real com episódios construídos exatamente para os seus gargalos.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 whitespace-nowrap"
        >
          <Icon name="Plus" size={16} />
          Gerar Novo Episódio
        </button>
      </div>

      {/* Main Active Episode Player */}
      {activeEpisode && (
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: activeSubj?.color || '#8b5cf6' }}
              >
                <Icon name="Headphones" size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                  {activeSubj?.name} • {activeEpisode.focusType}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-white">{activeEpisode.title}</h2>
              </div>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium px-2">Velocidade:</span>
              {[0.8, 1.0, 1.2, 1.5, 1.8, 2.0].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 rounded-lg font-bold transition ${
                    playbackSpeed === speed ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Progress Bar & Audio Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>{formatTime(currentSeconds)}</span>
              <span>{formatTime(activeEpisode.durationSeconds)}</span>
            </div>

            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                setCurrentSeconds(Math.round(pos * activeEpisode.durationSeconds));
              }}
              className="w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden cursor-pointer relative"
            >
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-200"
                style={{ width: `${(currentSeconds / activeEpisode.durationSeconds) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setCurrentSeconds(Math.max(0, currentSeconds - 15))}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="-15s"
              >
                <Icon name="RotateCcw" size={18} />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 transition"
              >
                <Icon name={isPlaying ? 'Pause' : 'Play'} size={24} className={isPlaying ? '' : 'ml-0.5'} />
              </button>

              <button
                onClick={() => setCurrentSeconds(Math.min(activeEpisode.durationSeconds, currentSeconds + 15))}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="+15s"
              >
                <Icon name="RotateCw" size={18} />
              </button>
            </div>
          </div>

          {/* Chapters & Transcript Split View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Chapters */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="font-bold text-xs text-slate-300 flex items-center gap-2">
                <Icon name="List" className="text-purple-400" size={16} />
                <span>Capítulos do Episódio</span>
              </h3>
              <div className="space-y-1.5">
                {activeEpisode.chapters.map((chap, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSeconds(chap.timestampSeconds)}
                    className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-left transition flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-200 truncate">{chap.title}</span>
                    <span className="font-mono text-slate-400 text-[11px] ml-2">{formatTime(chap.timestampSeconds)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Synchronized Transcript */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col h-64 overflow-y-auto">
              <h3 className="font-bold text-xs text-slate-300 flex items-center gap-2 sticky top-0 bg-slate-950 pb-2">
                <Icon name="FileText" className="text-blue-400" size={16} />
                <span>Transcrição Sincronizada</span>
              </h3>
              <div className="space-y-3">
                {activeEpisode.transcript.map((t, idx) => {
                  const isCurrent = currentSeconds >= t.timestampSeconds && (idx === activeEpisode.transcript.length - 1 || currentSeconds < activeEpisode.transcript[idx + 1].timestampSeconds);
                  return (
                    <div
                      key={idx}
                      onClick={() => setCurrentSeconds(t.timestampSeconds)}
                      className={`p-2.5 rounded-xl text-xs cursor-pointer transition ${
                        isCurrent ? 'bg-purple-950/40 border border-purple-500/40 text-purple-100 font-medium' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-purple-400 mr-2">[{formatTime(t.timestampSeconds)}]</span>
                      <span>{t.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Episode Library */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Icon name="Headphones" className="text-purple-400" size={20} />
          <span>Sua Biblioteca de Áudios de Aprendizado</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {podcasts.map(ep => {
            const subj = subjects.find(s => s.id === ep.subjectId);
            const isCurrent = activeEpisode?.id === ep.id;

            return (
              <div
                key={ep.id}
                onClick={() => {
                  setActiveEpisode(ep);
                  setCurrentSeconds(0);
                }}
                className={`p-5 rounded-2xl border cursor-pointer transition ${
                  isCurrent ? 'bg-purple-950/30 border-purple-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                        style={{ backgroundColor: `${subj?.color || '#8b5cf6'}20`, color: subj?.color || '#8b5cf6' }}
                      >
                        {subj?.name}
                      </span>
                      <span className="text-[10px] text-slate-400">{ep.focusType}</span>
                    </div>
                    <h4 className="font-bold text-sm text-white mt-1">{ep.title}</h4>
                    <p className="text-xs text-slate-400">{ep.keyTakeaways[0] || 'Episódio direcionado para consolidação.'}</p>
                  </div>

                  <button className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow">
                    <Icon name="Play" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: Create New Episode */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-base">
                <Icon name="Headphones" size={20} />
                <span>Gerar Episódio de Aprendizado por IA</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300">Tema ou Conteúdo Desejado</label>
                <select
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  {topics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-300">Objetivo do Episódio</label>
                <select
                  value={newFocusType}
                  onChange={(e) => setNewFocusType(e.target.value as any)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="Revisar Erros">Revisar Erros Frequentes do Simulado</option>
                  <option value="Aprender do Zero">Aprender Raciocínio do Zero</option>
                  <option value="Pré-Prova">Revisão Express Pré-Prova (FUVEST/ENEM)</option>
                  <option value="Conexões Interdisciplinares">Conexões entre Disciplinas</option>
                  <option value="Pré-Requisitos">Sessão de Pré-Requisitos</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleGeneratePodcast}
                disabled={generating}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-2"
              >
                <Icon name="Sparkles" size={16} className={generating ? 'animate-spin' : ''} />
                <span>{generating ? 'Roteirizando Áudio...' : 'Gerar Episódio'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Post-Audio Recall Check */}
      {showRecallTestModal && activeEpisode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <Icon name="CheckSquare" size={20} />
                <span>Teste de Ativação Pós-Áudio</span>
              </div>
              <button onClick={() => setShowRecallTestModal(false)} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Ouvir não basta. Vamos testar se a informação se fixou na sua memória de longo prazo:
            </p>

            <div className="space-y-4 text-xs">
              {activeEpisode.activeRecallQuestions.map((q, idx) => (
                <div key={q.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <p className="font-bold text-white">{idx + 1}. {q.question}</p>
                  <button
                    onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium underline"
                  >
                    {userAnswers[q.id] ? 'Ocultar Resposta' : 'Revelar Resposta de Referência'}
                  </button>
                  {userAnswers[q.id] && (
                    <p className="text-xs text-emerald-300 font-medium bg-emerald-950/30 p-2 rounded border border-emerald-500/20 mt-1">
                      {q.answer}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowRecallTestModal(false)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow"
              >
                Concluir Validação e Salvar Progresso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Subject, TopicNode, UserProfile, MasteryState, MasteryStatus } from '../types';
import { Icon } from './Icon';
import { learningEvidenceRepository } from '../services/questionRepository';
import { computeAllMasteryStates } from '../services/masteryEngine';
import { studySessionRepository } from '../services/studySessionRepository';

interface EvolutionViewProps {
  user: UserProfile;
  subjects: Subject[];
  topics: TopicNode[];
}

export const EvolutionView: React.FC<EvolutionViewProps> = ({
  user,
  subjects,
  topics,
}) => {
  const [selectedTopicMastery, setSelectedTopicMastery] = useState<{ topic: TopicNode; mastery: MasteryState } | null>(null);

  // Load real learning evidences for user
  const evidences = useMemo(() => {
    return learningEvidenceRepository.getEvidencesByUser(user.id);
  }, [user.id]);

  // Compute real derived mastery states for all topics
  const masteryMap = useMemo(() => {
    return computeAllMasteryStates({
      userId: user.id,
      topics,
      evidences,
    });
  }, [user.id, topics, evidences]);

  // Load real study session history (self-reported reflections, separate from evidence-based mastery)
  const studySessions = useMemo(() => {
    return studySessionRepository
      .getSessionsByUser(user.id)
      .slice()
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [user.id]);

  const SESSION_HISTORY_LIMIT = 8;
  const [showAllSessions, setShowAllSessions] = useState(false);
  const visibleSessions = showAllSessions ? studySessions : studySessions.slice(0, SESSION_HISTORY_LIMIT);

  const getStatusBadge = (status: MasteryStatus) => {
    switch (status) {
      case 'UNKNOWN':
        return { label: 'Sem dados', bg: 'bg-slate-800/60 text-slate-400 border-slate-700' };
      case 'INSUFFICIENT_EVIDENCE':
        return { label: 'Evidência insuficiente', bg: 'bg-blue-950/50 text-blue-300 border-blue-800/60' };
      case 'EMERGING':
        return { label: 'Emergente', bg: 'bg-indigo-950/50 text-indigo-300 border-indigo-800/60' };
      case 'FRAGILE':
        return { label: 'Frágil', bg: 'bg-amber-950/50 text-amber-300 border-amber-800/60' };
      case 'CONFLICTED':
        return { label: 'Conflitante', bg: 'bg-orange-950/50 text-orange-300 border-orange-800/60' };
      case 'ESTIMATED':
        return { label: 'Estimado', bg: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60' };
      default:
        return { label: status, bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getMasteryLabel = (level: number | null) => {
    if (level === null) return 'Nível de aplicação não estimado (dados insuficientes)';
    if (level <= 6) return 'Nível 6: Aplicação observada em questões simples.';
    if (level === 7) return 'Nível 7: Aplicação observada em questões médias.';
    if (level >= 8) return 'Nível 8: Aplicação observada em questões difíceis.';
    return `Nível ${level}: Aplicação observada em questões.`;
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              MÉTRICAS BASEADAS EM EVIDÊNCIAS
            </span>
            <span className="text-xs text-slate-400">• Aprendizado Real vs Estimativas Falsas</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
            Mapa de Domínio Real
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Não inventamos porcentagens de precisão. Exibimos o que as evidências reais da sua prática permitem afirmar.
          </p>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 text-xs text-slate-300">
          <Icon name="ShieldCheck" className="text-emerald-400" size={20} />
          <div>
            <span className="font-bold text-white">Índice de Autonomia</span>
            <p className="text-[10px] text-slate-400">
              A autonomia será estimada quando houver dados suficientes de intervenção.
            </p>
          </div>
        </div>
      </div>

      {/* Real Observations Summary */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Icon name="TrendingUp" className="text-blue-400" size={20} />
          <span>Diagnóstico de Domínio (Base Histórica Real)</span>
        </h3>

        {evidences.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            Você ainda não realizou tentativas de questões registradas no sistema. Comece a responder questões para construir seu mapa de domínio baseado em evidências.
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
            <p className="font-semibold text-slate-200">
              Total de Evidências Registradas: <span className="text-blue-400 font-bold">{evidences.length}</span>
            </p>
            <p className="text-slate-400">
              As estimativas de nível dependem de tentativas independentes em questões com dificuldades classificadas. Sem evidências suficientes, o sistema mantém o status transparente (Sem dados / Evidência insuficiente).
            </p>
          </div>
        )}
      </div>

      {/* Map of Mastery by Subject & Topic */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Icon name="Grid" className="text-purple-400" size={20} />
          <span>Rede de Conhecimento por Disciplina e Tópico</span>
        </h3>

        <div className="space-y-4">
          {subjects.map(subj => {
            const subjTopics = topics.filter(t => t.subjectId === subj.id);
            if (subjTopics.length === 0) return null;

            // Compute subject summary stats
            let estimatedCount = 0;
            let fragileOrConflictedCount = 0;
            let unknownOrInsufficientCount = 0;

            subjTopics.forEach(t => {
              const m = masteryMap[t.id];
              if (!m || m.status === 'UNKNOWN' || m.status === 'INSUFFICIENT_EVIDENCE') {
                unknownOrInsufficientCount++;
              } else if (m.status === 'ESTIMATED') {
                estimatedCount++;
              } else if (m.status === 'FRAGILE' || m.status === 'CONFLICTED' || m.status === 'EMERGING') {
                fragileOrConflictedCount++;
              }
            });

            return (
              <div key={subj.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: subj.color }}
                    />
                    <h4 className="font-bold text-sm text-white">{subj.name}</h4>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>
                      ESTIMADOS: <strong className="text-emerald-400">{estimatedCount}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      EM OBSERVAÇÃO: <strong className="text-amber-400">{fragileOrConflictedCount}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      SEM ESTIMATIVA: <strong className="text-slate-400">{unknownOrInsufficientCount}</strong>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {subjTopics.map(t => {
                    const m = masteryMap[t.id] || {
                      status: 'UNKNOWN',
                      estimatedLevel: null,
                      confidence: 'LOW',
                      independentSourceCount: 0,
                      evidenceCount: 0,
                      levelSupportingIndependentSourceCount: 0,
                    };

                    const badge = getStatusBadge(m.status);

                    return (
                      <div key={t.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-200 block">{t.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {m.independentSourceCount} tentativa(s) independente(s) ({m.evidenceCount} eventos)
                              {m.estimatedLevel !== null && ` • ${m.levelSupportingIndependentSourceCount} sustentam este nível`}
                            </span>
                            {m.lastEvidenceAt && (
                              <span className="text-[10px] text-slate-500 block">
                                Última evidência: {m.lastEvidenceAt.split('T')[0]}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Discrete Level Representation (No Percentage Bar) */}
                        {m.status === 'CONFLICTED' ? (
                          <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-900/50 text-amber-300 text-[11px]">
                            Nível atual: aguardando nova evidência
                          </div>
                        ) : m.estimatedLevel !== null ? (
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-200 font-bold">
                                NÍVEL ESTIMADO: {m.estimatedLevel} / 10
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Confiança: {m.confidence === 'HIGH' ? 'Alta' : m.confidence === 'MODERATE' ? 'Moderada' : 'Baixa'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {[6, 7, 8].map(lvl => (
                                <span
                                  key={lvl}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                                    m.estimatedLevel === lvl
                                      ? 'bg-blue-600 text-white border-blue-400 shadow'
                                      : 'bg-slate-950 text-slate-500 border-slate-800'
                                  }`}
                                >
                                  Nível {lvl}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                            <span>Sem estimativa de nível</span>
                            <span className="text-[10px]">
                              Confiança: {m.confidence === 'HIGH' ? 'Alta' : m.confidence === 'MODERATE' ? 'Moderada' : 'Baixa'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[10px]">
                          <span className="text-slate-400 italic">
                            {getMasteryLabel(m.estimatedLevel)}
                          </span>

                          <button
                            type="button"
                            onClick={() => setSelectedTopicMastery({ topic: t, mastery: m })}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold border border-blue-500/30 transition flex items-center gap-1"
                          >
                            <Icon name="Info" size={12} />
                            <span>POR QUÊ?</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Study Session History (self-report, kept separate from evidence-based mastery above) */}
      <div className="space-y-4">
        <div>
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Icon name="History" className="text-emerald-400" size={20} />
            <span>Histórico de Sessões de Estudo</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Autorrelato pós-sessão. Não altera as estimativas de domínio acima — domínio depende de evidência objetiva (questões e revisões), não de autopercepção.
          </p>
        </div>

        {studySessions.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            Você ainda não concluiu nenhuma sessão de estudo registrada. Sessões concluídas em "Sessão de Estudo" aparecerão aqui com sua reflexão pós-estudo.
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleSessions.map((session) => {
              const subj = subjects.find((s) => s.id === session.subjectId);
              const topic = topics.find((t) => t.id === session.topicId);
              const completedDate = new Date(session.completedAt);

              return (
                <div
                  key={session.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                        style={{ backgroundColor: `${subj?.color || '#3b82f6'}20`, color: subj?.color || '#3b82f6' }}
                      >
                        {subj?.name || 'Geral'}
                      </span>
                      {topic && (
                        <span className="text-[10px] font-semibold text-slate-400">{topic.name}</span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {completedDate.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-slate-300">
                      {session.actualMinutes} min estudados (meta: {session.plannedMinutes} min)
                      {session.notes && <span className="text-slate-500"> — "{session.notes}"</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        session.canExplain
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {session.canExplain ? 'Consegue explicar' : 'Ainda não explica sozinho'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      Compreensão {session.comprehensionScore}/5
                    </span>
                  </div>
                </div>
              );
            })}

            {studySessions.length > SESSION_HISTORY_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllSessions((prev) => !prev)}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition"
              >
                {showAllSessions ? 'Mostrar menos' : `Mostrar todas (${studySessions.length})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal: "POR QUE ESTE NÍVEL?" */}
      {selectedTopicMastery && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  JUSTIFICATIVA DO MASTERY ENGINE
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedTopicMastery.topic.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTopicMastery(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Summary Header in Modal */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px]">Status do Tópico</span>
                  <span className="font-bold text-white text-sm">
                    {getStatusBadge(selectedTopicMastery.mastery.status).label}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Nível Estimado</span>
                  <span className="font-extrabold text-blue-400 text-sm">
                    {selectedTopicMastery.mastery.status === 'CONFLICTED'
                      ? 'Aguardando evidência'
                      : selectedTopicMastery.mastery.estimatedLevel !== null
                      ? `Nível ${selectedTopicMastery.mastery.estimatedLevel}/10`
                      : 'Sem estimativa'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Confiança</span>
                  <span className="font-bold text-emerald-400 text-xs">
                    {selectedTopicMastery.mastery.confidence === 'HIGH' ? 'Alta' : selectedTopicMastery.mastery.confidence === 'MODERATE' ? 'Moderada' : 'Baixa'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-0.5">
                <p>• <strong>{selectedTopicMastery.mastery.independentSourceCount}</strong> tentativa(s) independente(s) registradas ({selectedTopicMastery.mastery.evidenceCount} eventos em total).</p>
                {selectedTopicMastery.mastery.estimatedLevel !== null && (
                  <p>• <strong>{selectedTopicMastery.mastery.levelSupportingIndependentSourceCount}</strong> tentativa(s) sustentam diretamente esta estimativa de nível.</p>
                )}
                {selectedTopicMastery.mastery.lastEvidenceAt && (
                  <p>• Última evidência em: <strong>{selectedTopicMastery.mastery.lastEvidenceAt.split('T')[0]}</strong>.</p>
                )}
              </div>

              {/* SEÇÃO A — EVIDÊNCIAS QUE SUSTENTAM A ESTIMATIVA */}
              <div className="space-y-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Icon name="CheckCircle" size={14} />
                  <span>EVIDÊNCIAS QUE SUSTENTAM A ESTIMATIVA</span>
                </span>
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-emerald-100/90 space-y-1">
                  <p>• Acertos com segurança independentes: <strong>{selectedTopicMastery.mastery.strongPositiveCount}</strong></p>
                </div>
              </div>

              {/* SEÇÃO B — SINAIS POSITIVOS QUE AINDA PRECISAM DE CONFIRMAÇÃO */}
              <div className="space-y-2">
                <span className="font-bold text-blue-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Icon name="HelpCircle" size={14} />
                  <span>SINAIS POSITIVOS QUE AINDA PRECISAM DE CONFIRMAÇÃO</span>
                </span>
                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/40 text-blue-100/90 space-y-1">
                  <p>• Acertos com dúvida / chutes: <strong>{selectedTopicMastery.mastery.fragilePositiveCount}</strong></p>
                  <p>• Autocorreções após erro inicial: <strong>{selectedTopicMastery.mastery.selfCorrectionCount}</strong></p>
                  <p>• Desempenho após consultar resolução: <strong>{selectedTopicMastery.mastery.postSolutionCount}</strong></p>
                </div>
              </div>

              {/* SEÇÃO C — CONTRADIÇÕES E ERROS */}
              <div className="space-y-2">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Icon name="AlertTriangle" size={14} />
                  <span>CONTRADIÇÕES E ERROS</span>
                </span>
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-rose-100/90 space-y-1">
                  <p>• Divergência de confiança (seguro porém errou): <strong>{selectedTopicMastery.mastery.confidenceDivergenceCount}</strong></p>
                  <p>• Erros em tentativas: <strong>{selectedTopicMastery.mastery.negativeCount}</strong></p>
                  {selectedTopicMastery.mastery.selfCorrectionCount > 0 && (
                    <p className="text-[10px] text-amber-300/80 italic mt-1">
                      *(Erros iniciais seguidos de autocorreção foram classificados como fontes assistidas e não como contradições puras)*
                    </p>
                  )}
                </div>
              </div>

              {/* SEÇÃO D — SINAIS DE EXECUÇÃO */}
              {selectedTopicMastery.mastery.timeSignalCount > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-purple-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Icon name="Clock" size={14} />
                    <span>SINAIS DE EXECUÇÃO</span>
                  </span>
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/40 text-purple-100/90 space-y-1">
                    <p>• Sinais de tempo / velocidade registrados: <strong>{selectedTopicMastery.mastery.timeSignalCount}</strong></p>
                  </div>
                </div>
              )}

              {/* SEÇÃO E — INCERTEZAS */}
              <div className="space-y-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Icon name="AlertCircle" size={14} />
                  <span>INCERTEZAS E FATORES LIMITANTES</span>
                </span>
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-amber-100/90 space-y-1">
                  {selectedTopicMastery.mastery.uncertaintyReasons.length > 0 ? (
                    selectedTopicMastery.mastery.uncertaintyReasons.map((reason, idx) => (
                      <p key={idx}>• {reason}</p>
                    ))
                  ) : (
                    <p>• Nenhuma incerteza crítica identificada para as evidências atuais.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTopicMastery(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

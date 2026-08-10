import React, { useState, useEffect } from 'react';
import { ErrorEntry, Subject, TopicNode, ErrorType, ConfidenceLevel, AttemptReflectionTag } from '../types';
import { Icon } from './Icon';

export interface ErrorDraftData {
  questionTitle: string;
  subjectId: string;
  topicId: string;
  studentReasoning: string;
  questionId?: string;
  attemptId?: string;
  confidenceAtAttempt?: ConfidenceLevel | null;
  reflectionTag?: AttemptReflectionTag;
}

interface ErrorNotebookViewProps {
  errors: ErrorEntry[];
  setErrors: React.Dispatch<React.SetStateAction<ErrorEntry[]>>;
  subjects: Subject[];
  topics: TopicNode[];
  draftError?: ErrorDraftData | null;
  onClearDraftError?: () => void;
  focusErrorId?: string | null;
  onFocusErrorConsumed?: () => void;
  onReturnToReviews?: () => void;
}

export function mapReflectionTagToErrorType(tag?: AttemptReflectionTag): ErrorType {
  switch (tag) {
    case 'CALCULATION_ERROR':
      return 'calculo';
    case 'MISINTERPRETED':
      return 'interpretacao';
    case 'PREREQUISITE_GAP':
      return 'pre_requisito';
    case 'DIDNT_KNOW_CONCEPT':
      return 'conceitual';
    case 'ATTENTION_ERROR':
      return 'atencao';
    case 'TIME_PROBLEM':
      return 'tempo';
    case 'DIDNT_KNOW_STRATEGY':
      return 'estrategia';
    case 'UNSURE':
    case 'OTHER':
    default:
      return 'outro';
  }
}

export const ErrorNotebookView: React.FC<ErrorNotebookViewProps> = ({
  errors,
  setErrors,
  subjects,
  topics,
  draftError,
  onClearDraftError,
  focusErrorId,
  onFocusErrorConsumed,
  onReturnToReviews,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [highlightedErrorId, setHighlightedErrorId] = useState<string | null>(null);
  const [cameFromReviewFocus, setCameFromReviewFocus] = useState<boolean>(false);

  // Effect 1: Foco no erro vindo de revisão
  useEffect(() => {
    if (focusErrorId) {
      setHighlightedErrorId(focusErrorId);
      setCameFromReviewFocus(true);

      const targetErr = errors.find((e) => e.id === focusErrorId);
      if (targetErr) {
        setSelectedSubject('all');
        setSelectedType('all');
      }

      setTimeout(() => {
        const el = document.getElementById(`error-entry-${focusErrorId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      onFocusErrorConsumed?.();
    }
  }, [focusErrorId, errors, onFocusErrorConsumed]);

  // Effect 2: Remoção temporária do destaque
  useEffect(() => {
    if (!highlightedErrorId) return;
    const timer = setTimeout(() => {
      setHighlightedErrorId(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [highlightedErrorId]);

  // New error form
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || 'mat');
  const [newTopicId, setNewTopicId] = useState('');
  const [newType, setNewType] = useState<ErrorType>('outro');
  const [newStudentReasoning, setNewStudentReasoning] = useState('');
  const [newCorrectedReasoning, setNewCorrectedReasoning] = useState('');
  const [newInsight, setNewInsight] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [currentDraft, setCurrentDraft] = useState<ErrorDraftData | null>(null);

  // Clear newTopicId if current newTopicId does not belong to newSubjectId
  useEffect(() => {
    if (newTopicId) {
      const validTopics = topics.filter(t => t.subjectId === newSubjectId);
      if (!validTopics.some(t => t.id === newTopicId)) {
        setNewTopicId('');
      }
    }
  }, [newSubjectId, topics, newTopicId]);

  useEffect(() => {
    if (draftError) {
      setCurrentDraft(draftError);
      setNewTitle(draftError.questionTitle);
      setNewSubjectId(draftError.subjectId);
      const validTopic = topics.find(t => t.id === draftError.topicId && t.subjectId === draftError.subjectId);
      setNewTopicId(validTopic?.id || '');
      setNewStudentReasoning(draftError.studentReasoning);
      setNewType(mapReflectionTagToErrorType(draftError.reflectionTag));
      setNewCorrectedReasoning('');
      setNewInsight('');
      setFormError(null);
      setShowAddModal(true);
    }
  }, [draftError, topics]);

  const filteredErrors = errors.filter(e => {
    if (selectedSubject !== 'all' && e.subjectId !== selectedSubject) return false;
    if (selectedType !== 'all' && e.errorType !== selectedType) return false;
    return true;
  });

  // Calculate statistics
  const totalCount = errors.length;
  const typeCounts = errors.reduce((acc, e) => {
    acc[e.errorType] = (acc[e.errorType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setCurrentDraft(null);
    setFormError(null);
    if (onClearDraftError) onClearDraftError();
  };

  const handleAddError = () => {
    setFormError(null);
    if (!newTitle || !newStudentReasoning) {
      setFormError('Preencha o título da questão e seu raciocínio.');
      return;
    }

    if (!newTopicId) {
      setFormError('Selecione um tópico compatível com esta disciplina.');
      return;
    }

    // Validate topic belongs to selected subject
    const topicMatch = topics.find(t => t.id === newTopicId);
    if (!topicMatch || topicMatch.subjectId !== newSubjectId) {
      setFormError('Selecione um tópico compatível com esta disciplina.');
      return;
    }

    const newEntry: ErrorEntry = {
      id: `err_${Date.now()}`,
      questionTitle: newTitle,
      subjectId: newSubjectId,
      topicId: newTopicId,
      errorType: newType,
      studentReasoning: newStudentReasoning,
      correctedReasoning: newCorrectedReasoning.trim(),
      keyInsight: newInsight.trim(),
      recordedAt: new Date().toISOString().split('T')[0],
      reviewStatus: 'pending',
      questionId: currentDraft?.questionId,
      attemptId: currentDraft?.attemptId,
      confidenceAtAttempt: currentDraft?.confidenceAtAttempt,
      reflectionTag: currentDraft?.reflectionTag,
    };

    setErrors(prev => [newEntry, ...prev]);
    handleCloseModal();
    setNewTitle('');
    setNewStudentReasoning('');
    setNewCorrectedReasoning('');
    setNewInsight('');
    setNewType('outro');
  };

  const handleRunAIDiagnosis = async (errorId: string) => {
    setDiagnosingId(errorId);
    const targetError = errors.find(e => e.id === errorId);
    if (!targetError) return;

    const subj = subjects.find(s => s.id === targetError.subjectId);
    const topic = topics.find(t => t.id === targetError.topicId);

    try {
      const res = await fetch('/api/errors/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionTitle: targetError.questionTitle,
          studentReasoning: targetError.studentReasoning,
          subject: subj?.name || 'Geral',
          topic: topic?.name || 'Tópico',
        }),
      });

      const data = await res.json();
      setErrors(prev => prev.map(e => {
        if (e.id === errorId) {
          return {
            ...e,
            aiAnalysis: `${data.diagnosis} Intervenção sugerida: ${data.recommendedAction}`,
          };
        }
        return e;
      }));
    } catch (err) {
      console.error('Diagnosis error:', err);
    } finally {
      setDiagnosingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ERROS COMO DADOS
            </span>
            <span className="text-xs text-slate-400">• Laboratório Diagnóstico</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
            Caderno de Erros Inteligente
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Transforme falhas em dados. Investigamos o padrão de raciocínio que causou o erro.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onReturnToReviews && cameFromReviewFocus && (
            <button
              onClick={() => {
                setCameFromReviewFocus(false);
                onReturnToReviews();
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 flex items-center gap-2 transition"
            >
              <Icon name="ArrowLeft" size={15} />
              <span>Voltar para Revisões</span>
            </button>
          )}

          <button
            onClick={() => {
              setCurrentDraft(null);
            setNewTitle('');
            setNewTopicId('');
            setFormError(null);
            setNewStudentReasoning('');
            setNewCorrectedReasoning('');
            setNewInsight('');
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 whitespace-nowrap"
        >
          <Icon name="Plus" size={16} />
          Registrar Novo Erro
        </button>
      </div>
      </div>

      {/* Pattern Distribution Overview */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="font-bold text-sm text-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="PieChart" className="text-blue-400" size={18} />
            <span>Padrões de Erro Recorrentes ({totalCount} registrados)</span>
          </div>
          <span className="text-xs font-normal text-slate-400">
            Distribuição Factual por Categoria
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            { label: 'Interpretação', type: 'interpretacao', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
            { label: 'Pré-requisito', type: 'pre_requisito', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
            { label: 'Conceitual', type: 'conceitual', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
            { label: 'Cálculo / Atenção', type: 'calculo_atencao', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
          ].map(item => {
            const count = item.type === 'calculo_atencao'
              ? (typeCounts['calculo'] || 0) + (typeCounts['atencao'] || 0)
              : (typeCounts[item.type] || 0);
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            return (
              <div key={item.label} className={`p-3 rounded-xl border ${item.color}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</p>
                <p className="text-xl font-extrabold mt-0.5">{pct}% <span className="text-xs font-normal">({count})</span></p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Icon name="Filter" size={14} />
          <span>Filtrar:</span>
        </div>

        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-xl focus:outline-none"
        >
          <option value="all">Todas as Disciplinas</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-xl focus:outline-none"
        >
          <option value="all">Todos os Tipos de Erro</option>
          <option value="interpretacao">Interpretação</option>
          <option value="pre_requisito">Pré-requisito</option>
          <option value="conceitual">Conceitual</option>
          <option value="calculo">Cálculo</option>
          <option value="estrategia">Estratégia</option>
          <option value="atencao">Atenção</option>
          <option value="tempo">Tempo</option>
          <option value="outro">Outro / A Investigar</option>
        </select>
      </div>

      {/* Error Entries Cards */}
      <div className="space-y-4">
        {filteredErrors.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <p className="font-semibold text-slate-300">Nenhum erro encontrado com estes filtros.</p>
          </div>
        ) : (
          filteredErrors.map(err => {
            const subj = subjects.find(s => s.id === err.subjectId);
            const isDiagnosing = diagnosingId === err.id;
            const isHighlighted = highlightedErrorId === err.id;

            return (
              <div
                key={err.id}
                id={`error-entry-${err.id}`}
                className={`p-5 rounded-2xl bg-slate-900 border transition space-y-4 ${
                  isHighlighted
                    ? 'border-amber-500 ring-2 ring-amber-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                        style={{ backgroundColor: `${subj?.color || '#3b82f6'}20`, color: subj?.color || '#3b82f6' }}
                      >
                        {subj?.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                        {err.errorType}
                      </span>
                      {err.examSource && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {err.examSource}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-white mt-1">{err.questionTitle}</h3>
                  </div>

                  <button
                    onClick={() => handleRunAIDiagnosis(err.id)}
                    disabled={isDiagnosing}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Icon name="Sparkles" size={14} className={isDiagnosing ? 'animate-spin' : ''} />
                    <span>{isDiagnosing ? 'Analisando...' : 'Investigar Causa Raiz IA'}</span>
                  </button>
                </div>

                {/* Comparative Reasoning */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 space-y-1">
                    <span className="font-semibold text-red-400">O que pensei na hora (Falha):</span>
                    <p className="text-slate-300 leading-relaxed">{err.studentReasoning}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                    <span className="font-semibold text-emerald-400">Raciocínio Correto:</span>
                    <p className="text-slate-300 leading-relaxed">
                      {err.correctedReasoning ? err.correctedReasoning : <span className="italic text-slate-500">Pendente de revisão</span>}
                    </p>
                  </div>
                </div>

                {/* Key Insight & AI Diagnosis if available */}
                {err.keyInsight && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-400 text-xs">Gatilho / Regra de Ouro: </span>
                    <span className="text-xs text-slate-200 font-medium">{err.keyInsight}</span>
                  </div>
                )}

                {err.aiAnalysis && (
                  <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-1 text-xs">
                    <span className="font-bold text-blue-300 flex items-center gap-1">
                      <Icon name="Bot" size={14} /> Análise da IA JUJU:
                    </span>
                    <p className="text-blue-100/90 leading-relaxed">{err.aiAnalysis}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Register / Review Error Draft */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Icon name="AlertTriangle" className="text-amber-400" size={20} />
                <span>{currentDraft ? 'Analisar e Salvar Registro de Erro' : 'Registrar Novo Erro de Estudo'}</span>
              </div>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            {currentDraft && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                {(!currentDraft.reflectionTag || currentDraft.reflectionTag === 'UNSURE' || currentDraft.reflectionTag === 'OTHER') ? (
                  <span>Você ainda não classificou a causa deste erro.</span>
                ) : (
                  <span>
                    Tipo sugerido com base no que você marcou:{' '}
                    <strong>
                      {currentDraft.reflectionTag === 'CALCULATION_ERROR' && 'Cálculo'}
                      {currentDraft.reflectionTag === 'MISINTERPRETED' && 'Interpretação'}
                      {currentDraft.reflectionTag === 'PREREQUISITE_GAP' && 'Pré-requisito'}
                      {currentDraft.reflectionTag === 'DIDNT_KNOW_CONCEPT' && 'Conceitual'}
                      {currentDraft.reflectionTag === 'ATTENTION_ERROR' && 'Atenção'}
                      {currentDraft.reflectionTag === 'TIME_PROBLEM' && 'Tempo'}
                      {currentDraft.reflectionTag === 'DIDNT_KNOW_STRATEGY' && 'Estratégia'}
                    </strong>
                    . Você pode alterar antes de salvar.
                  </span>
                )}
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {formError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300">Título / Questão / Prova *</label>
                <input
                  type="text"
                  placeholder="Ex: FUVEST 2025 - Q12 Geometria"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Disciplina</label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-300">Tópico *</label>
                  <select
                    value={newTopicId}
                    onChange={(e) => setNewTopicId(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="">Selecione o Tópico...</option>
                    {topics.filter(t => t.subjectId === newSubjectId).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-300">Tipo de Erro</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ErrorType)}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="outro">Outro / A Investigar</option>
                    <option value="interpretacao">Interpretação</option>
                    <option value="pre_requisito">Pré-requisito</option>
                    <option value="conceitual">Conceitual</option>
                    <option value="calculo">Cálculo</option>
                    <option value="estrategia">Estratégia</option>
                    <option value="atencao">Atenção</option>
                    <option value="tempo">Tempo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300">O que você pensou na hora? (Falha) *</label>
                <textarea
                  placeholder="Descreva a suposição errada que fez..."
                  value={newStudentReasoning}
                  onChange={(e) => setNewStudentReasoning(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 h-20 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300">Qual é o raciocínio correto? (opcional)</label>
                <textarea
                  placeholder="Onde estava a virada de chave..."
                  value={newCorrectedReasoning}
                  onChange={(e) => setNewCorrectedReasoning(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 h-20 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300">Aprendizado / Gatilho de Ouro (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Pureza é entrada, Rendimento é saída."
                  value={newInsight}
                  onChange={(e) => setNewInsight(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddError}
                disabled={!newTitle.trim() || !newStudentReasoning.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow"
              >
                Salvar no Caderno de Erros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Subject, TopicNode } from '../types';
import { Icon } from './Icon';

interface ChatMessage {
  id: string;
  sender: 'user' | 'juju';
  text: string;
  suggestedNextQuestions?: string[];
  timestamp: string;
}

interface TutorViewProps {
  subjects: Subject[];
  topics: TopicNode[];
}

export const TutorView: React.FC<TutorViewProps> = ({ subjects, topics }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'juju',
      text: 'Olá Ana! Sou o Tutor Socrático do JUJU. Meu papel não é dar respostas prontas, mas te ajudar a enxergar o raciocínio correto por conta própria. Sobre qual assunto você quer debater agora?',
      suggestedNextQuestions: [
        'Tenho dúvida em Semelhança de Triângulos na FUVEST',
        'Quero entender Lei de Ohm sem decorar a fórmula',
        'Como identificar reagente limitante em Química?'
      ],
      timestamp: 'Agora'
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || 'Matemática');
  const [selectedTopic, setSelectedTopic] = useState(topics[0]?.name || 'Semelhança');
  const [tutorMode, setTutorMode] = useState<'ME_FACA_PENSAR' | 'EXPLIQUE_DO_ZERO' | 'DUVIDA_RAPIDA' | 'ANALISE_RACIOCINIO'>('ME_FACA_PENSAR');
  const [helpLevel, setHelpLevel] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() && !uploadedImage) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: text + (uploadedImage ? ' [Imagem Anexada]' : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setUploadedImage(null);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.sender, content: m.text }));

      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: tutorMode,
          subject: selectedSubject,
          topic: selectedTopic,
          history,
          helpLevel,
        }),
      });

      const data = await res.json();

      const jujuMsg: ChatMessage = {
        id: `juju_${Date.now()}`,
        sender: 'juju',
        text: data.reply || 'Qual é a primeira informação que o enunciado garante?',
        suggestedNextQuestions: data.suggestedNextQuestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, jujuMsg]);
    } catch (err) {
      console.error('Failed to chat with tutor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImage(URL.createObjectURL(file));
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 flex flex-col h-[calc(100vh-2rem)]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              MÉTODO SOCRÁTICO GUIADO
            </span>
            <span className="text-xs text-slate-400">• Inteligência Metacognitiva</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
            Tutor JUJU — Desenvolva Seu Raciocínio
          </h1>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          {[
            { id: 'ME_FACA_PENSAR', label: 'Me Faça Pensar' },
            { id: 'EXPLIQUE_DO_ZERO', label: 'Explique do Zero' },
            { id: 'ANALISE_RACIOCINIO', label: 'Analise Raciocínio' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setTutorMode(m.id as any)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition ${
                tutorMode === m.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject & Help Level Controls */}
      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">Contexto:</span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-xl"
          >
            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-xl"
          >
            {topics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">Nível de Pista/Ajuda:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[1, 2, 3, 4].map(lvl => (
              <button
                key={lvl}
                onClick={() => setHelpLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  helpLevel === lvl ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title={lvl === 1 ? 'Socrático Puro' : lvl === 4 ? 'Explicação Direta' : 'Pistas Progressivas'}
              >
                Nível {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Conversation Box */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-4">
        {messages.map((m) => {
          const isJuju = m.sender === 'juju';

          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isJuju ? '' : 'flex-row-reverse'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  isJuju
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isJuju ? 'J' : 'Ana'}
              </div>

              <div className={`space-y-2 max-w-[80%] ${isJuju ? '' : 'items-end'}`}>
                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed ${
                    isJuju
                      ? 'bg-slate-950 border border-slate-800 text-slate-200'
                      : 'bg-blue-600 text-white font-medium'
                  }`}
                >
                  <p>{m.text}</p>
                </div>

                {/* Suggested Followup Questions */}
                {m.suggestedNextQuestions && m.suggestedNextQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.suggestedNextQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        className="text-[11px] px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl border border-slate-700 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-2">
            <Icon name="Sparkles" className="animate-spin text-blue-400" size={16} />
            <span>Tutor JUJU formulando pergunta socrática...</span>
          </div>
        )}
      </div>

      {/* Image Preview if uploaded */}
      {uploadedImage && (
        <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Icon name="Image" size={16} className="text-blue-400" />
            <span>Foto de Questão ou Raciocínio anexada</span>
          </div>
          <button onClick={() => setUploadedImage(null)} className="text-slate-400 hover:text-white">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
        <label className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition">
          <Icon name="Camera" size={20} />
          <input type="file" accept="image/*" onChange={handleSimulateImageUpload} className="hidden" />
        </label>

        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Digite sua dúvida ou o raciocínio que você tentou usar..."
          className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none px-2"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={loading}
          className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow transition"
        >
          <Icon name="Send" size={18} />
        </button>
      </div>
    </div>
  );
};

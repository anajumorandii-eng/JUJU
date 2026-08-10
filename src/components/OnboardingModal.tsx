import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Icon } from './Icon';

interface OnboardingModalProps {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  user,
  setUser,
  onClose,
}) => {
  const [step, setStep] = useState(1);

  // Form state
  const [course, setCourse] = useState(user.targetCourse || 'Medicina');
  const [university, setUniversity] = useState(user.targetUniversities[0] || 'USP (FUVEST)');
  const [availableHours, setAvailableHours] = useState(user.availableHoursPerDay || 4.5);
  const [bottleneck, setBottleneck] = useState('Procrastinação / Atração Inicial ao Começar');

  const handleFinish = () => {
    setUser(prev => ({
      ...prev,
      targetCourse: course,
      targetUniversities: [university],
      availableHoursPerDay: availableHours,
      hasOnboarded: true,
    }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 text-slate-200 shadow-2xl">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>ONBOARDING DIAGNÓSTICO</span>
            <span>Etapa {step} de 7</span>
          </div>
          <div className="w-full h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(step / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Objective */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">1. Qual é o seu objetivo acadêmico?</h2>
              <p className="text-xs text-slate-400">JUJU adapta toda a inteligência ao seu curso e vestibular alvo.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300">Curso Desejado</label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full mt-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300">Vestibular Alvo Principal</label>
                <select
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full mt-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="USP (FUVEST)">USP / FUVEST</option>
                  <option value="ENEM 2026">ENEM 2026</option>
                  <option value="UNICAMP">UNICAMP</option>
                  <option value="UNESP">UNESP / VUNESP</option>
                  <option value="Outro Exame">Outro Exame Regional</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Routine */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">2. Quanto tempo você REALMENTE possui por dia?</h2>
              <p className="text-xs text-slate-400">Seja honesto. Não diga o tempo ideal, mas o tempo sustentável.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <span className="text-3xl font-extrabold text-blue-400">{availableHours} horas/dia</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={availableHours}
                  onChange={(e) => setAvailableHours(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 & 4 & 5: Bottleneck */}
        {step >= 3 && step <= 6 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Qual é o seu maior gargalo hoje?</h2>
              <p className="text-xs text-slate-400">O que te impede de evoluir nos simulados?</p>
            </div>

            <div className="space-y-2 text-xs">
              {[
                'Dificuldade em começar (Procrastinação inicial)',
                'Acúmulo de matérias e cronogramas impossíveis',
                'Estudo muita teoria e erro questões no simulado',
                'Falta de método de revisão contínua',
              ].map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setBottleneck(opt)}
                  className={`w-full p-3.5 rounded-xl border text-left font-medium transition ${
                    bottleneck === opt ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: Initial Diagnosis Hypothesis */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">7. Hipótese Inicial de Diagnóstico JUJU</h2>
              <p className="text-xs text-slate-400">Baseado nas suas respostas, formulamos um plano de intervenção:</p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2 text-xs">
              <span className="font-bold text-blue-300">DIAGNÓSTICO:</span>
              <p className="text-blue-100 leading-relaxed">
                Seu gargalo principal não é falta de inteligência ou esforço, mas sim <strong>{bottleneck}</strong>.
              </p>
              <p className="text-blue-200/80 pt-1">
                Criamos um experimento de 7 dias para recalibrar seu orçamento diário de estudo para {availableHours}h com foco em atrito zero.
              </p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
            >
              Voltar
            </button>
          ) : <div />}

          {step < 7 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow"
            >
              Próxima Etapa
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow"
            >
              Iniciar Experiência JUJU
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

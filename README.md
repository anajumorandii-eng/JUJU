# JUJU — Inteligência de Estudo

**Aprenda a aprender.**

JUJU é um sistema adaptativo de decisão para aprendizagem, focado em maximizar aprendizado real por unidade de tempo, energia e atenção — não em maximizar horas estudadas.

## Stack

- React 19 + Vite 6 + TypeScript
- Express (server.ts) servindo o app e endpoints de IA (Gemini) com fallback determinístico quando `GEMINI_API_KEY` não está configurada
- Tailwind CSS v4

## Arquitetura de domínio (cadeia de evidência)

```
Question → Attempt → LearningEvidence → Mastery → Review Decision → Review → Atividade → ReviewCompletion → Nova Evidência → Reassessment
```

Serviços centrais em `src/services/`:

- `diagnosticEngine` — diagnóstico inicial de aprendizagem (autopercepção + microavaliação objetiva)
- `questionsEngine` / `questionRepository` — banco de questões e tentativas
- `masteryEngine` — domínio derivado de evidências (nunca de campos manuais)
- `reviewEngine` / `reviewPolicy` / `reviewOrchestrator` / `reviewPresentation` / `reviewRepository` — revisão adaptativa
- `efficiencyEngineV2` / `efficiencyDecisionOrchestrator` / `efficiencyActionResolver` — Motor de Eficiência ("Decide por Mim")

## Rodando localmente

**Pré-requisitos:** Node.js 22+

1. Instalar dependências:
   ```
   npm install
   ```
2. (Opcional) Definir `GEMINI_API_KEY` em `.env.local` para respostas de IA reais do Tutor, diagnóstico de erros e Podcast. Sem a chave, os endpoints respondem com fallback determinístico.
3. Rodar em desenvolvimento:
   ```
   npm run dev
   ```

## Scripts

- `npm run dev` — servidor de desenvolvimento (Express + Vite middleware)
- `npm run build` — build de produção
- `npm start` — servidor de produção (após build)
- `npm run lint` — typecheck (`tsc --noEmit`)
- `npm test` — roda todas as suítes de teste dos engines

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const getAppDirname = () => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return path.dirname(fileURLToPath(import.meta.url));
};

const appDirname = getAppDirname();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Helper lazy getter for Gemini API
  const getGeminiAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({ apiKey });
  };

  // API Routes
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', name: 'JUJU - Inteligência de Estudo', timestamp: new Date().toISOString() });
  });

  // Tutor Socratic Chat
  app.post('/api/tutor/chat', async (req: Request, res: Response) => {
    try {
      const { message, mode, subject, topic, history, helpLevel } = req.body;
      const ai = getGeminiAI();

      if (!ai) {
        // Fallback simulated response if no API key set
        return res.json({
          reply: `[Modo Socrático Demo] Você perguntou sobre ${topic || subject || 'estudos'}. Qual é o primeiro princípio ou hipótese que você pode testar antes de aplicar uma fórmula?`,
          suggestedNextQuestions: [
            'Qual é a informação principal do enunciado?',
            'Tenho algum pré-requisito faltando?',
            'Como posso verificar minha resposta?'
          ]
        });
      }

      const prompt = `
Você é o Tutor Socrático do JUJU (Sistema Adaptativo de Decisão para Aprendizagem).
Missão: Ensinar o estudante a PENSAR e RACIOCINAR por conta própria, NUNCA dar respostas prontas imediatamente.

Modo de Atuação: ${mode || 'SOCRATICO'} (Nível de ajuda: ${helpLevel || 1}/4)
Disciplina: ${subject || 'Geral'}
Tópico: ${topic || 'Não especificado'}

Contexto recente do diálogo:
${JSON.stringify(history || [])}

Mensagem atual do estudante: "${message}"

Regras inegociáveis:
1. Responda em tom calmo, acolhedor, inteligente e sem julgamento ou infantilização.
2. Não entregue a resposta da questão de primeira. Faça 1 pergunta provocativa ou dê 1 pista socrática para que ele perceba o próximo passo.
3. Se o estudante estiver muito bloqueado, dê uma pista de pré-requisito.
4. Retorne um JSON válido com o formato:
{
  "reply": "Sua resposta com a pergunta socrática ou pista",
  "suggestedNextQuestions": ["Opção de resposta 1", "Opção de resposta 2"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const responseText = response.text || '{}';
      const parsed = JSON.parse(responseText);
      return res.json(parsed);
    } catch (err: any) {
      console.error('Error in /api/tutor/chat:', err);
      return res.status(500).json({
        reply: 'Percebi uma oscilação na conexão com a IA, mas vamos continuar: Qual é a informação principal que você enxerga nesse enunciado?',
        suggestedNextQuestions: ['Revisar os dados numéricos', 'Identificar a pergunta do enunciado']
      });
    }
  });

  // AI Error Root Cause Diagnosis
  app.post('/api/errors/diagnose', async (req: Request, res: Response) => {
    try {
      const { questionTitle, studentReasoning, subject, topic } = req.body;
      const ai = getGeminiAI();

      if (!ai) {
        return res.json({
          diagnosis: 'Sua dificuldade parece estar associada à validação preliminar de hipóteses antes do cálculo. Dica: verifique se não há pegadinhas de unidade ou condições no enunciado.',
          recommendedAction: 'Fazer 3 questões de validação curta com foco no comando.',
          cognitivePattern: 'comparacao'
        });
      }

      const prompt = `
Você é o Diagnosticador de Erros do JUJU (Inteligência de Estudo).
Examine este erro de estudo e identifique a CAUSA RAIZ real (conceitual, interpretação, pré-requisito, cálculo ou estratégia).

Questão: "${questionTitle}"
Disciplina: "${subject}" / Tópico: "${topic}"
Raciocínio usado pelo estudante: "${studentReasoning}"

Forneça uma análise objetiva e acionável em JSON:
{
  "diagnosis": "Diagnóstico claro da falha de raciocínio em 2 frases",
  "recommendedAction": "Instrução exata de intervenção mínima (ex: 3 questões de pré-requisito x ou revisão do gatilho y)",
  "cognitivePattern": "proporcionalidade|analise_grafica|causa_efeito|conservacao|comparacao|decomposicao|inferencia|raciocinio_espacial|interpretacao"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (err) {
      console.error('Error in /api/errors/diagnose:', err);
      return res.json({
        diagnosis: 'Erro no padrão cognitivo de interpretação de restrições do enunciado.',
        recommendedAction: 'Grifar o comando e os dados numéricos antes de tentar equacionar.',
        cognitivePattern: 'interpretacao'
      });
    }
  });

  // AI Podcast Audio Learning Generator
  app.post('/api/podcast/generate', async (req: Request, res: Response) => {
    try {
      const { topic, focusType, targetExam, errorContext } = req.body;
      const ai = getGeminiAI();

      if (!ai) {
        return res.json({
          title: `Podcast JUJU: ${topic || 'Revisão Eficiente'} (${focusType})`,
          chapters: [
            { timestampSeconds: 0, title: 'Introdução e Relevância na Prova' },
            { timestampSeconds: 90, title: 'O Ponto de Virada do Raciocínio' },
            { timestampSeconds: 210, title: 'Pergunta de Ativação' },
            { timestampSeconds: 330, title: 'Síntese Final' }
          ],
          transcript: [
            { timestampSeconds: 0, speaker: 'JUJU', text: `Bem-vindo ao Podcast JUJU. Hoje vamos direto ao gargalo em ${topic || 'Estudo Eficiente'}.` },
            { timestampSeconds: 90, speaker: 'JUJU', text: 'O erro comum aqui é tentar aplicar a regra sem verificar as condições iniciais. Lembre-se: o que a banca testar é sua capacidade de análise.' },
            { timestampSeconds: 210, speaker: 'JUJU', text: 'Pense por 5 segundos: qual é o pré-requisito fundamental antes de resolver essa questão?' },
            { timestampSeconds: 330, speaker: 'JUJU', text: 'Excelente. Mantenha essa clareza e aplique na sua próxima lista.' }
          ],
          activeRecallQuestions: [
            { id: 'q1', question: 'Qual é o erro mais frequente neste assunto?', answer: 'Ignorar a condição de validade antes da fórmula.' }
          ],
          keyTakeaways: [
            'Sempre valide as condições iniciais do enunciado.',
            'Evite contas desnecessárias focando nas alternativas.'
          ]
        });
      }

      const prompt = `
Você é o Roteirista do Podcast JUJU (Aprenda a Aprender).
Gere um episódio de aprendizado em áudio altamente focado, direto ao ponto, sem enrolações.

Tema: ${topic}
Tipo de Foco: ${focusType}
Banca Alvo: ${targetExam || 'FUVEST/ENEM'}
Contexto de Erros Anteriores: ${errorContext || 'Nenhum'}

Regras:
1. Sem saudações longas ou propagandas. Vá direto ao raciocínio pedagógico que o estudante precisa ouvir.
2. Inclua 1 pausa explicita no roteiro para "Revisão Ativa" (uma pergunta de recall com pausa para o estudante refletir).
3. Formato JSON estrito:
{
  "title": "Título chamativo e focado do podcast",
  "chapters": [
    { "timestampSeconds": 0, "title": "Capítulo 1" },
    { "timestampSeconds": 90, "title": "Capítulo 2" }
  ],
  "transcript": [
    { "timestampSeconds": 0, "speaker": "JUJU", "text": "Texto dito no áudio..." }
  ],
  "activeRecallQuestions": [
    { "id": "q1", "question": "Pergunta?", "answer": "Resposta sintética" }
  ],
  "keyTakeaways": ["Ponto 1", "Ponto 2"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (err) {
      console.error('Error in /api/podcast/generate:', err);
      return res.status(500).json({ error: 'Erro ao gerar podcast por IA.' });
    }
  });

  // Mount Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JUJU Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start JUJU server:', err);
});

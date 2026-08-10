import { 
  UserProfile, 
  Subject, 
  TopicNode, 
  TaskItem, 
  ErrorEntry, 
  StudySession, 
  MethodExperiment, 
  Discovery, 
  PodcastEpisode, 
  GoogleIntegration 
} from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'demo_user_ana',
  name: 'Ana',
  targetCourse: 'Medicina',
  targetUniversities: ['USP (FUVEST)', 'UNICAMP', 'UNESP'],
  targetExams: ['FUVEST 2026', 'ENEM 2026'],
  availableHoursPerDay: 4.5,
  currentEnergyLevel: 'medium',
  autonomyIndex: 68,
  studyDaysPerWeek: 6,
  hasOnboarded: true,
};

export const INITIAL_SUBJECTS: Subject[] = [
  { id: 'mat', name: 'Matemática', color: '#3b82f6', iconName: 'Calculator' },
  { id: 'fis', name: 'Física', color: '#8b5cf6', iconName: 'Zap' },
  { id: 'qui', name: 'Química', color: '#ec4899', iconName: 'FlaskConical' },
  { id: 'bio', name: 'Biologia', color: '#10b981', iconName: 'Dna' },
  { id: 'his', name: 'História', color: '#f59e0b', iconName: 'Hourglass' },
  { id: 'por', name: 'Português', color: '#6366f1', iconName: 'BookOpen' },
];

export const INITIAL_TOPICS: TopicNode[] = [
  // Matemática
  { id: 'mat_razao', subjectId: 'mat', name: 'Razão e Proporção', masteryLevel: 8, prerequisites: [], weightInExam: 10, cognitivePattern: 'proporcionalidade' },
  { id: 'mat_trig', subjectId: 'mat', name: 'Trigonometria no Triângulo Retângulo', masteryLevel: 6, prerequisites: ['mat_razao'], weightInExam: 8, cognitivePattern: 'raciocinio_espacial' },
  { id: 'mat_sem_tri', subjectId: 'mat', name: 'Semelhança de Triângulos', masteryLevel: 5, prerequisites: ['mat_razao'], weightInExam: 9, cognitivePattern: 'comparacao' },
  { id: 'mat_fun_2', subjectId: 'mat', name: 'Função Quadrática e Máximos/Mínimos', masteryLevel: 4, prerequisites: ['mat_razao'], weightInExam: 9, cognitivePattern: 'analise_grafica' },

  // Física
  { id: 'fis_vetores', subjectId: 'fis', name: 'Vetores e Decomposição', masteryLevel: 6, prerequisites: ['mat_trig'], weightInExam: 7, cognitivePattern: 'decomposicao' },
  { id: 'fis_dinamica', subjectId: 'fis', name: 'Leis de Newton e Dinâmica', masteryLevel: 4, prerequisites: ['fis_vetores'], weightInExam: 9, cognitivePattern: 'causa_efeito' },
  { id: 'fis_eletro', subjectId: 'fis', name: 'Circuitos Elétricos e Lei de Ohm', masteryLevel: 3, prerequisites: ['mat_razao'], weightInExam: 10, cognitivePattern: 'conservacao' },

  // Biologia
  { id: 'bio_citologia', subjectId: 'bio', name: 'Organelas e Respiração Celular', masteryLevel: 7, prerequisites: [], weightInExam: 8, cognitivePattern: 'causa_efeito' },
  { id: 'bio_genetica', subjectId: 'bio', name: 'Primeira e Segunda Lei de Mendel', masteryLevel: 5, prerequisites: ['mat_razao'], weightInExam: 10, cognitivePattern: 'proporcionalidade' },

  // Química
  { id: 'qui_estequio', subjectId: 'qui', name: 'Estequiometria e Rendimento', masteryLevel: 4, prerequisites: ['mat_razao'], weightInExam: 10, cognitivePattern: 'proporcionalidade' },
  { id: 'qui_termo', subjectId: 'qui', name: 'Termoquímica e Lei de Hess', masteryLevel: 6, prerequisites: ['qui_estequio'], weightInExam: 8, cognitivePattern: 'conservacao' },

  // História
  { id: 'his_brasil_imp', subjectId: 'his', name: 'Segundo Reinado e Guerra do Paraguai', masteryLevel: 7, prerequisites: [], weightInExam: 7, cognitivePattern: 'inferencia' },
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 't1',
    subjectId: 'mat',
    topicId: 'mat_sem_tri',
    title: 'Lista de 6 questões de Semelhança em Provas FUVEST',
    durationMinutes: 40,
    energyRequired: 'high',
    decision: 'FAZER',
    rationale: 'Alta incidência na FUVEST (peso 9) + seu desempenho recente caiu em comparações geométricas. Maior ROI de aprendizado hoje.',
    urgency: 9,
    impact: 9,
    isCritical: true,
    status: 'pending',
    category: 'questoes',
  },
  {
    id: 't2',
    subjectId: 'qui',
    topicId: 'qui_estequio',
    title: 'Correção focada dos 3 erros de Estequiometria do último simulado',
    durationMinutes: 25,
    energyRequired: 'medium',
    decision: 'FAZER',
    rationale: 'Identificado padrão de erro em reagente limitante. Corrigir o raciocínio evita arrastar a lacuna para Termoquímica.',
    urgency: 8,
    impact: 9,
    isCritical: true,
    status: 'pending',
    category: 'correcao',
  },
  {
    id: 't3',
    subjectId: 'fis',
    topicId: 'fis_eletro',
    title: 'Revisão ativa por desenho do circuito e Lei de Ohm',
    durationMinutes: 30,
    energyRequired: 'medium',
    decision: 'FAZER',
    rationale: 'Retenção abaixo de 40% nas revisões passadas. Fazer esquema visual ativo em vez de ler teoria.',
    urgency: 7,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'revisao',
  },
  {
    id: 't4',
    subjectId: 'bio',
    topicId: 'bio_genetica',
    title: 'Assistir videoaula completa de 2 horas sobre Genética Humana',
    durationMinutes: 120,
    energyRequired: 'high',
    decision: 'NAO_FAZER',
    rationale: 'Subtração eficiente: Você já compreende a teoria básica (nível 5/10). Assistir 2h de teoria tem ROI baixo. Faça 4 questões direcionadas.',
    urgency: 2,
    impact: 3,
    isCritical: false,
    status: 'abandoned',
    abandonReason: 'Substituído por prática de questões ativas recomendada pelo JUJU.',
    category: 'teoria',
  },
  {
    id: 't5',
    subjectId: 'his',
    topicId: 'his_brasil_imp',
    title: 'Leitura de resumo de 15 páginas do Segundo Reinado',
    durationMinutes: 50,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: 'Seu domínio atual é 7/10 e não é gargalo desta semana. Adiar para liberar energia para Matemática e Química.',
    urgency: 3,
    impact: 5,
    isCritical: false,
    status: 'pending',
    category: 'teoria',
  }
];

export const INITIAL_ERRORS: ErrorEntry[] = [
  {
    id: 'e1',
    questionTitle: 'FUVEST 2024 - Questão 34 (Geometria Plana)',
    subjectId: 'mat',
    topicId: 'mat_sem_tri',
    examSource: 'FUVEST 2024',
    errorType: 'interpretacao',
    studentReasoning: 'Presumi que os triângulos eram congruentes porque pareciam iguais no desenho da prova e usei igualdade de lados diretamente.',
    correctedReasoning: 'O enunciado não garantia congruência. Era necessário provar semelhança pelos ângulos opostos pelo vértice antes de montar a razão de proporção x/y.',
    keyInsight: 'Nunca confiar na sensação visual do desenho. Sempre validar ângulos para provar semelhança antes da proporção.',
    recordedAt: '2026-08-06',
    reviewStatus: 'pending',
    aiAnalysis: 'Gargalo no padrão cognitivo "Comparação". Você tende a pular a etapa de verificação de hipóteses angulares em provas da FUVEST.',
  },
  {
    id: 'e2',
    questionTitle: 'UNICAMP 2025 - Estequiometria com Pureza',
    subjectId: 'qui',
    topicId: 'qui_estequio',
    examSource: 'UNICAMP 2025',
    errorType: 'pre_requisito',
    studentReasoning: 'Calculei a massa do produto usando a massa bruta do reagente fornecida na questão.',
    correctedReasoning: 'A amostra tinha apenas 80% de pureza. Era necessário aplicar a porcentagem de pureza sobre a massa inicial ANTES da regra de três estequiométrica.',
    keyInsight: 'Pureza se aplica ANTES da reação; Rendimento se aplica DEPOIS no produto obtido.',
    recordedAt: '2026-08-07',
    reviewStatus: 'pending',
    aiAnalysis: 'Erro clássico de pré-requisito em Razão e Porcentagem. Lembre-se do gatilho: Pureza = Entrada, Rendimento = Saída.',
  },
  {
    id: 'e3',
    questionTitle: 'ENEM 2024 - Circuito Misto e Lâmpadas',
    subjectId: 'fis',
    topicId: 'fis_eletro',
    examSource: 'ENEM 2024',
    errorType: 'conceitual',
    studentReasoning: 'Achei que ao fechar a chave a resistência equivalente do circuito aumentaria.',
    correctedReasoning: 'Adicionar um resistor em paralelo SEMPRE diminui a resistência equivalente total do circuito, aumentando a corrente da geradora.',
    keyInsight: 'Em paralelo: mais caminhos = menor resistência total = maior corrente total.',
    recordedAt: '2026-08-05',
    reviewStatus: 'pending',
    aiAnalysis: 'Gargalo no padrão cognitivo de "Conservação e Relações Inversas".',
  }
];

export const INITIAL_EXPERIMENTS: MethodExperiment[] = [
  {
    id: 'exp1',
    name: 'Questões Práticas Antes da Teoria em Física',
    methodType: 'Inverted Active Learning',
    problem: 'Passava 2 horas assistindo videoaulas de Física e, quando chegava nos exercícios, esquecia as fórmulas e não sabia aplicar.',
    hypothesis: 'Tentar resolver 3 questões primeiro me dará clareza exata de qual conceito preciso buscar na teoria.',
    startDate: '2026-07-20',
    status: 'completed',
    resultDecision: 'MANTER',
    keyInsights: 'Economia de 50 minutos de videoaula por assunto. Minha retenção nas questões difíceis subiu de 40% para 72%.',
  },
  {
    id: 'exp2',
    name: 'Blocos Intenso de 90 Minutos Sem Pausa em Matemática',
    methodType: 'Deep Work 90m',
    problem: 'Sessões muito longas geravam fadiga mental no final.',
    hypothesis: 'Blocos de 90m seriam mais produtivos para Matemática avançada.',
    startDate: '2026-07-28',
    status: 'completed',
    resultDecision: 'ABANDONAR',
    keyInsights: 'O índice de erros por desatenção após 50 minutos aumentou em 45%. Para a Ana, blocos de 45 minutos com 8 minutos de pausa têm eficiência superior.',
  }
];

export const INITIAL_DISCOVERIES: Discovery[] = [
  {
    id: 'disc1',
    title: 'Sessões de 45m têm 38% mais aprendizado retido do que blocos de 90m',
    description: 'Após a marca dos 50 minutos contínuos em exatas, sua taxa de erro por desatenção triplica. Dividir em blocos de 45m renova o foco.',
    discoveredAt: '2026-08-01',
    category: 'timing',
  },
  {
    id: 'disc2',
    title: 'Ouvir podcasts interativos no transporte substitui revisões passivas de biologia',
    description: 'A retenção por escuta ativa com perguntas no áudio gerou o mesmo resultado em provas que reler resumos escritos de 30 minutos.',
    discoveredAt: '2026-08-04',
    category: 'format',
  }
];

export const INITIAL_PODCASTS: PodcastEpisode[] = [
  {
    id: 'pod1',
    title: 'Semelhança de Triângulos & Raciocínio de Prova FUVEST',
    subjectId: 'mat',
    topicId: 'mat_sem_tri',
    durationSeconds: 420, // 7 min
    focusType: 'Revisar Erros',
    chapters: [
      { timestampSeconds: 0, title: 'Por que errar Semelhança custa caro na FUVEST' },
      { timestampSeconds: 90, title: 'O gatilho visual que te engana na prova' },
      { timestampSeconds: 210, title: 'Teste de Ativação: Onde está a proporção?' },
      { timestampSeconds: 330, title: 'Síntese de Raciocínio de Prova' }
    ],
    transcript: [
      { timestampSeconds: 0, speaker: 'JUJU', text: 'Olá Ana. Vamos ao ponto sem perda de tempo. Na FUVEST, semelhança de triângulos não é sobre fazer contas gigantes, é sobre enxergar a proporção escondida.' },
      { timestampSeconds: 90, speaker: 'JUJU', text: 'Você cometeu um erro recorrente no simulado: assumir que dois triângulos são parecidos só porque o desenho sugere. Cuidado! A FUVEST desenha triângulos propositalmente fora de escala.' },
      { timestampSeconds: 210, speaker: 'JUJU', text: 'Agora, uma pausa para você pensar: se temos dois ângulos opostos pelo vértice e duas retas paralelas cortadas por uma transversal, qual teorema garante que os triângulos são semelhantes?' },
      { timestampSeconds: 330, speaker: 'JUJU', text: 'Exato! O caso Ângulo-Ângulo. Guarde isso: primeiro identifique 2 ângulos iguais, depois monte a razão de semelhança.' }
    ],
    activeRecallQuestions: [
      { id: 'q1', question: 'Qual é a primeira condição obrigatória antes de montar uma razão de proporção em triângulos?', answer: 'Garantir que os triângulos possuem pelo menos 2 ângulos correspondentes iguais (Caso AA).' },
      { id: 'q2', question: 'Por que não podemos confiar nas proporções do desenho impresso na prova da FUVEST?', answer: 'Porque as bancas frequentemente desenham figuras fora de escala para testar a validação geométrica rigorosa.' }
    ],
    keyTakeaways: [
      'Valide 2 ângulos iguais (Caso AA) antes de escrever qualquer fração de proporção.',
      'Identifique os lados homólogos (opostos aos mesmos ângulos) para não inverter os denominadores.'
    ],
    createdAt: '2026-08-07',
  }
];

export const INITIAL_INTEGRATIONS: GoogleIntegration[] = [
  { id: 'cal', service: 'Calendar', connected: true, accountEmail: 'anaju.morandii@gmail.com', lastSyncedAt: 'Hoje às 18:30', description: 'Lê compromissos e calcula janela real de estudo sem invasão.' },
  { id: 'drv', service: 'Drive', connected: true, accountEmail: 'anaju.morandii@gmail.com', lastSyncedAt: 'Hoje às 18:30', description: 'Acessa apostilas e listas autorizadas em PDF para File Search.' },
  { id: 'cls', service: 'Classroom', connected: false, description: 'Importa tarefas de cursinho e prazos acadêmicos.' },
  { id: 'doc', service: 'Docs', connected: true, accountEmail: 'anaju.morandii@gmail.com', lastSyncedAt: 'Ontem', description: 'Exporta rascunhos de redação e análises de raciocínio.' },
  { id: 'sht', service: 'Sheets', connected: false, description: 'Importa relatórios de simulados e notas históricas.' },
];

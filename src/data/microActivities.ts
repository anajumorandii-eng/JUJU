import { MicroAssessmentActivity, UserProfile } from '../types';

export const ALL_MICRO_ACTIVITIES: MicroAssessmentActivity[] = [
  {
    id: 'act_1_geometry',
    activityType: 'geometry',
    title: 'Microatividade 1: Proporção e Razão de Áreas',
    subjectId: 'mat',
    subjectName: 'Matemática',
    topicId: 'mat_sem_tri',
    topicName: 'Geometria Plana / Semelhança',
    context: 'Um triângulo T1 possui lados 6 cm, 8 cm e 10 cm. Um triângulo T2 possui lados 9 cm, 12 cm e 15 cm. Uma estudante afirma que a área de T2 é 1,5 vezes maior que a área de T1 porque a razão entre os lados correspondentes é k = 1,5.',
    options: [
      {
        id: 'a',
        label: 'A afirmação está incorreta: a razão entre as áreas de figuras semelhantes é k² (1,5² = 2,25 vezes).',
        isCorrect: true,
      },
      {
        id: 'b',
        label: 'A afirmação está correta: a razão de áreas segue exatamente a mesma proporção linear dos lados.',
        isCorrect: false,
        distractorType: 'superficial',
      },
      {
        id: 'c',
        label: 'Não é possível determinar sem saber a medida dos ângulos internos de T1 e T2.',
        isCorrect: false,
        distractorType: 'conceptual',
      },
      {
        id: 'd',
        label: 'A área de T2 é 3 vezes a área de T1 porque cada lado aumentou 3 unidades.',
        isCorrect: false,
        distractorType: 'calculation',
      },
    ],
    hintText: 'Pense em como a área depende de duas dimensões (base e altura). Se ambas as dimensões são multiplicadas por k, a área é multiplicada por k x k.',
    requiresReasoningExplanation: true,
    cognitivePatterns: ['proporcionalidade_geometrica', 'raciocinio_espacial'],
  },
  {
    id: 'act_2_logic',
    activityType: 'logic',
    title: 'Microatividade 2: Análise de Premissas e Dedução',
    subjectId: 'por',
    subjectName: 'Português / Lógica',
    topicId: undefined,
    topicName: 'Inferência e Dedução Lógica',
    context: 'Considere rigorosamente as duas premissas a seguir:\n1. Todos os relatórios submetidos no prazo contêm o carimbo da comissão.\n2. O relatório de pesquisa de Carlos contém o carimbo da comissão.',
    options: [
      {
        id: 'a',
        label: 'O relatório de Carlos obrigatoriamente foi submetido no prazo.',
        isCorrect: false,
        distractorType: 'superficial',
      },
      {
        id: 'b',
        label: 'Carlos é o presidente da comissão avaliadora.',
        isCorrect: false,
        distractorType: 'conceptual',
      },
      {
        id: 'c',
        label: 'Não é possível concluir com certeza se o relatório de Carlos foi submetido no prazo (ter o carimbo é condição necessária para quem entregou no prazo, mas pode existir outra razão para ter o carimbo).',
        isCorrect: true,
      },
      {
        id: 'd',
        label: 'O relatório de Carlos foi recusado pela comissão.',
        isCorrect: false,
        distractorType: 'interpretation',
      },
    ],
    hintText: 'Cuidado com a conversão da condicional: se A implica B, ter B garante obrigatoriamente que ocorreu A?',
    requiresReasoningExplanation: false,
    cognitivePatterns: ['deducao_logica', 'interpretacao_enunciado'],
  },
  {
    id: 'act_3_stoichiometry',
    activityType: 'stoichiometry',
    title: 'Microatividade 3: Reagente Limitante e Rendimento',
    subjectId: 'qui',
    subjectName: 'Química',
    topicId: 'qui_estequio',
    topicName: 'Estequiometria',
    context: 'Na reação química balanceada A + 2B → C, um recipiente é carregado com exatamente 2 mols da substância A e 2 mols da substância B para reagir completamente.',
    options: [
      {
        id: 'a',
        label: 'Ambos os reagentes serão consumidos totalmente pois foram colocados em quantidades molar idênticas.',
        isCorrect: false,
        distractorType: 'superficial',
      },
      {
        id: 'b',
        label: 'A substância B é o reagente limitante: consumirão 2 mols de B com 1 mol de A, forming 1 mol de C e sobrando 1 mol de A.',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'A substância A é o reagente limitante porque seu coeficiente na equação é menor (1 para 2).',
        isCorrect: false,
        distractorType: 'conceptual',
      },
      {
        id: 'd',
        label: 'Serão formados 2 mols do produto C pois haviam 2 mols iniciais de A.',
        isCorrect: false,
        distractorType: 'calculation',
      },
    ],
    hintText: 'A proporção exige 2 mols de B para cada 1 mol de A. Se você possui 2 mols de B, quantos mols de A serão efetivamente consumidos?',
    requiresReasoningExplanation: true,
    cognitivePatterns: ['raciocinio_proporcional', 'aplicacao_de_conceitos'],
  },
  {
    id: 'act_4_graph',
    activityType: 'graph',
    title: 'Microatividade 4: Interpretação Gráfica e Movimento',
    subjectId: 'fis',
    subjectName: 'Física / Dados',
    topicId: undefined,
    topicName: 'Cinemática / Análise de Gráficos',
    context: 'O gráfico a seguir descreve a velocidade v (m/s) de um objeto ao longo do tempo t (segundos):',
    graphData: {
      type: 'line',
      title: 'Velocidade x Tempo',
      xLabel: 'Tempo t (s)',
      yLabel: 'Velocidade v (m/s)',
      labels: ['0s', '10s', '20s', '30s', '40s'],
      values: [0, 15, 30, 30, 10],
    },
    options: [
      {
        id: 'a',
        label: 'No intervalo entre 20s e 30s o móvel esteve totalmente parado.',
        isCorrect: false,
        distractorType: 'conceptual',
      },
      {
        id: 'b',
        label: 'A velocidade aumentou constantemente durante todos os 40 segundos.',
        isCorrect: false,
        distractorType: 'superficial',
      },
      {
        id: 'c',
        label: 'No trecho de 0s a 20s, a aceleração escalar média foi de 1,5 m/s².',
        isCorrect: true,
      },
      {
        id: 'd',
        label: 'A aceleração média entre 0s e 20s foi de 30 m/s².',
        isCorrect: false,
        distractorType: 'calculation',
      },
    ],
    hintText: 'Lembre-se de que aceleração média é a variação da velocidade dividida pela variação do tempo (Δv / Δt).',
    requiresReasoningExplanation: false,
    cognitivePatterns: ['analise_grafica', 'interpretacao_dados'],
  },
  {
    id: 'act_5_interpretation',
    activityType: 'interpretation',
    title: 'Microatividade 5: Análise de Texto e Tese Principal',
    subjectId: 'his',
    subjectName: 'História / Análise Textual',
    topicId: undefined,
    topicName: 'Análise de Fontes Históricas',
    context: 'Texto: "A expansão das redes ferroviárias no século XIX não apenas encurtou distâncias geográficas, mas reconfigurou a própria percepção de tempo de trabalho e consumo das populações urbanas."\n\nCom base exclusivamente no trecho, assinale a tese sustentada pelo autor:',
    options: [
      {
        id: 'a',
        label: 'O impacto das ferrovias limitou-se ao transporte de mercadorias agrícolas.',
        isCorrect: false,
        distractorType: 'superficial',
      },
      {
        id: 'b',
        label: 'O avanço tecnológico ferroviário gerou transformações culturais e organizacionais no cotidiano urbano além do transporte físico.',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'As ferrovias provocaram a falência generalizada das indústrias urbanas.',
        isCorrect: false,
        distractorType: 'conceptual',
      },
      {
        id: 'd',
        label: 'A velocidade dos trens no século XIX superava a velocidade dos transportes aéreos modernos.',
        isCorrect: false,
        distractorType: 'interpretation',
      },
    ],
    hintText: 'Observe a expressão "não apenas... mas reconfigurou a própria percepção de tempo...". O autor enfatiza uma transformação mais ampla.',
    requiresReasoningExplanation: false,
    cognitivePatterns: ['sintese_textual', 'interpretacao_enunciado'],
  },
];

export interface AdaptiveSelectionInput {
  targetCourse?: string;
  targetExams?: string[];
  perceivedDifficulties?: string[];
  perceivedStrengths?: string[];
  selfReportedState?: string[];
}

/**
 * Dynamically selects 3 to 5 micro-activities based on context/responses from Camada A
 */
export function selectMicroActivities(input?: UserProfile | AdaptiveSelectionInput): MicroAssessmentActivity[] {
  if (!input) {
    return ALL_MICRO_ACTIVITIES.slice(0, 4);
  }

  let difficulties: string[] = [];
  let selfReported: string[] = [];

  if ('diagnostic' in input && input.diagnostic) {
    difficulties = input.diagnostic.perceivedDifficulties || [];
    selfReported = input.diagnostic.selfReportedState || [];
  } else if ('perceivedDifficulties' in input) {
    difficulties = input.perceivedDifficulties || [];
    selfReported = input.selfReportedState || [];
  }

  const selectedIds = new Set<string>();

  // If student reports graphic/image difficulty
  if (difficulties.includes('GRAPH_IMAGE_ANALYSIS')) {
    selectedIds.add('act_4_graph');
  }

  // If student reports calculations/formulas or logic difficulty
  if (difficulties.includes('LONG_CALCULATIONS') || difficulties.includes('SELECT_CORRECT_STRATEGY')) {
    selectedIds.add('act_1_geometry');
    selectedIds.add('act_3_stoichiometry');
  }

  // If student reports text/enunciado difficulty
  if (difficulties.includes('INTERPRET_ENUNCIADOS') || selfReported.includes('UNDERSTAND_THEORY_FAIL_QUESTIONS')) {
    selectedIds.add('act_2_logic');
    selectedIds.add('act_5_interpretation');
  }

  // Fallback / Base set if fewer than 3 were selected
  const defaultOrder = ['act_1_geometry', 'act_2_logic', 'act_3_stoichiometry', 'act_4_graph', 'act_5_interpretation'];
  for (const actId of defaultOrder) {
    if (selectedIds.size >= 4) break;
    selectedIds.add(actId);
  }

  return ALL_MICRO_ACTIVITIES.filter(act => selectedIds.has(act.id));
}

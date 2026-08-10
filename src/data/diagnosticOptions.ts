export interface OptionItem {
  id: string;
  label: string;
  isExclusive?: boolean;
}

// 1. Estado Autodeclarado (Max 3)
export const SELF_REPORTED_STATE_OPTIONS: OptionItem[] = [
  {
    id: 'UNDERSTAND_THEORY_FAIL_QUESTIONS',
    label: 'Compreendo a teoria nas aulas, mas travo na hora de fazer questões sozinho.',
  },
  {
    id: 'FORGET_PREVIOUS_TOPICS',
    label: 'Esqueço o conteúdo estudado algumas semanas depois de ter visto.',
  },
  {
    id: 'DONT_KNOW_HOW_TO_START',
    label: 'Sinto dificuldade em começar o estudo ou organizar a rotina do dia.',
  },
  {
    id: 'SLOW_QUESTION_SOLVING',
    label: 'Demoro muito tempo para resolver cada questão e fico atrasado no cronograma.',
  },
  {
    id: 'HIGH_SIMULATED_ANXIETY',
    label: 'Tenho ansiedade/branco no momento de fazer simulados e provas.',
  },
  {
    id: 'UNCERTAIN_ABOUT_METHOD',
    label: 'Sinto que estudo muito, mas não sei se estou estudando da forma certa.',
  },
  {
    id: 'UNSURE_STATE',
    label: 'Não sei identificar exatamente.',
    isExclusive: true,
  },
];

// 2. Perfil de Reação ao Erro
export const ERROR_HANDLING_OPTIONS: OptionItem[] = [
  {
    id: 'READ_SOLUTION_IMMEDIATELY',
    label: 'Leio a resolução imediatamente para entender a resposta.',
  },
  {
    id: 'RETRY_WITHOUT_SOLUTION',
    label: 'Tento fazer de novo do zero antes de olhar a resposta.',
  },
  {
    id: 'INVESTIGATE_ERROR_POINT',
    label: 'Tento descobrir exatamente a linha de raciocínio onde errei.',
  },
  {
    id: 'CHECK_ANSWER_AND_MOVE_ON',
    label: 'Apenas vejo o gabarito e sigo para a próxima questão.',
  },
  {
    id: 'AVOID_AFTER_ERROR',
    label: 'Fico frustrado e mudo de matéria ou faço uma pausa.',
  },
];

// 3. Reação ao Erro Repetido
export const ERROR_REPEAT_OPTIONS: OptionItem[] = [
  {
    id: 'FRUSTRATED_PAUSE',
    label: 'Fico frustrado e paro de estudar ou troco de matéria.',
  },
  {
    id: 'INVESTIGATE_PREREQUISITE',
    label: 'Volto na teoria básica para identificar a lacuna de conhecimento.',
  },
  {
    id: 'PRACTICE_MORE_SIMILAR',
    label: 'Busco mais questões parecidas para treinar até acertar.',
  },
  {
    id: 'IGNORE_AND_ADVANCE',
    label: 'Ignoro e sigo o cronograma para não atrasar a matéria.',
  },
];

// 4. Consciência de Raciocínio nos Acertos (Pergunta recuperada para diferenciação acerto x domínio)
export const REASONING_AWARENESS_OPTIONS: OptionItem[] = [
  {
    id: 'ALWAYS_KNOW_REASONING',
    label: 'Sei exatamente qual conceito usei e por que a resposta é correta.',
  },
  {
    id: 'USUALLY_KNOW',
    label: 'Na maioria das vezes sei, mas às vezes fico na dúvida se foi sorte.',
  },
  {
    id: 'SOMETIMES_ELIMINATION',
    label: 'Com frequência acerto eliminando alternativas absurdas sem ter certeza.',
  },
  {
    id: 'OFTEN_UNSURE',
    label: 'Raramente tenho certeza se meu raciocínio estava correto.',
  },
];

// 5. Comportamento em Sequência de Acertos
export const SUCCESS_STREAK_OPTIONS: OptionItem[] = [
  {
    id: 'KEEP_PRACTICING_SAME_LEVEL',
    label: 'Continuo praticando o mesmo conteúdo no mesmo nível de dificuldade.',
  },
  {
    id: 'INCREASE_DIFFICULTY',
    label: 'Aumento o nível de dificuldade das questões imediatamente.',
  },
  {
    id: 'MOVE_TO_NEXT_TOPIC',
    label: 'Encerro a matéria e mudo para o próximo assunto do cronograma.',
  },
  {
    id: 'UNSURE_SUCCESS_BEHAVIOR',
    label: 'Não tenho um padrão definido de reação.',
  },
];

// 6. Dificuldades Percebidas (Max 3)
export const PERCEIVED_DIFFICULTIES_OPTIONS: OptionItem[] = [
  {
    id: 'INTERPRET_ENUNCIADOS',
    label: 'Interpretar enunciados longos e complexos',
  },
  {
    id: 'LONG_CALCULATIONS',
    label: 'Cálculos numéricos longos e aplicação de fórmulas',
  },
  {
    id: 'GRAPH_IMAGE_ANALYSIS',
    label: 'Interpretação de gráficos, tabelas e imagens',
  },
  {
    id: 'MEMORIZING_CONCEPTS',
    label: 'Memorização de conceitos, nomes e detalhes',
  },
  {
    id: 'TIME_PRESSURE',
    label: 'Gerenciamento do tempo sob pressão',
  },
  {
    id: 'SELECT_CORRECT_STRATEGY',
    label: 'Identificar qual ferramenta ou fórmula utilizar na questão',
  },
  {
    id: 'UNSURE_DIFFICULTY',
    label: 'Não sei identificar',
    isExclusive: true,
  },
];

// 7. Forças Percebidas (Max 3)
export const PERCEIVED_STRENGTHS_OPTIONS: OptionItem[] = [
  {
    id: 'QUICK_THEORY_GRASP',
    label: 'Aprender teoria e conceitos rapidamente',
  },
  {
    id: 'PATTERN_RECOGNITION',
    label: 'Reconhecer padrões de questões repetidas',
  },
  {
    id: 'LONG_FOCUS_STAMINA',
    label: 'Manter foco e concentração por longos períodos',
  },
  {
    id: 'INTERPRETING_TEXTS',
    label: 'Boa interpretação de textos e enunciados',
  },
  {
    id: 'DISCIPLINE_CONSISTENCY',
    label: 'Disciplina e consistência na rotina de estudos',
  },
  {
    id: 'LOGICAL_REASONING',
    label: 'Raciocínio lógico e dedutivo',
  },
  {
    id: 'UNSURE_STRENGTH',
    label: 'Não sei identificar',
    isExclusive: true,
  },
];

// 8. Maior Dreno de Tempo
export const TIME_DRAIN_OPTIONS: OptionItem[] = [
  {
    id: 'BEAUTIFUL_SUMMARIES',
    label: 'Fazer resumos bonitos e passar anotações a limpo',
  },
  {
    id: 'SEARCHING_MATERIALS',
    label: 'Procurar materiais, videoaulas e PDFs na internet',
  },
  {
    id: 'SOCIAL_MEDIA_DISTRACTION',
    label: 'Redes sociais, notificações e distrações no celular',
  },
  {
    id: 'RE_READING_THEORY',
    label: 'Reeler a teoria várias vezes por medo de esquecer',
  },
  {
    id: 'OVERTHINKING_PLANNING',
    label: 'Reorganizar o cronograma e planejamento continuamente',
  },
];

// 9. Frequência de Cumprimento do Plano
export const PLAN_COMPLETION_OPTIONS: OptionItem[] = [
  {
    id: 'ALWAYS_COMPLETE',
    label: 'Consigo cumprir quase 100% das tarefas planejadas',
  },
  {
    id: 'MOSTLY_COMPLETE',
    label: 'Cumpro a maior parte (70% a 90%)',
  },
  {
    id: 'HALF_COMPLETE',
    label: 'Cumpro cerca de metade do planejado (50%)',
  },
  {
    id: 'RARELY_COMPLETE',
    label: 'Dificilmente consigo cumprir o que planejei',
  },
];

// 10. Reação a Tarefas Não Cumpri
export const UNFINISHED_PLAN_OPTIONS: OptionItem[] = [
  {
    id: 'CUMULATE_NEXT_DAY',
    label: 'Acumulo as tarefas para o dia seguinte',
  },
  {
    id: 'ADJUST_TIMELINE',
    label: 'Reorganizo o cronograma sem me culpar',
  },
  {
    id: 'CUT_LESS_IMPORTANT',
    label: 'Elimino tarefas menos prioritárias para manter o ritmo',
  },
  {
    id: 'ANXIOUS_OVERWORK',
    label: 'Tento estudar de madrugada ou compensar no fim de semana com ansiedade',
  },
];

/**
 * Helper function for exclusive selection & max limits.
 * Pure logic function for toggling selections safely.
 */
export function toggleLimitedExclusiveSelection(
  currentList: string[],
  optionId: string,
  options: OptionItem[],
  maxAllowed = 3
): string[] {
  const targetOption = options.find(o => o.id === optionId);
  if (!targetOption) return currentList;

  // If option is exclusive ("não sei identificar")
  if (targetOption.isExclusive) {
    return currentList.includes(optionId) ? [] : [optionId];
  }

  // Remove any exclusive option if picking a normal option
  const nonExclusiveList = currentList.filter(id => {
    const opt = options.find(o => o.id === id);
    return !opt?.isExclusive;
  });

  if (nonExclusiveList.includes(optionId)) {
    return nonExclusiveList.filter(id => id !== optionId);
  }

  if (nonExclusiveList.length >= maxAllowed) {
    return nonExclusiveList;
  }

  return [...nonExclusiveList, optionId];
}

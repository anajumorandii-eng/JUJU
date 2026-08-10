import { 
  Question, 
  Attempt, 
  AttemptResult,
  ConfidenceLevel,
  AttemptInterpretation, 
  LearningEvidence, 
  LearningEvidenceSignal,
  ConfidenceCalibrationSummary
} from '../types';

export const MIN_SAMPLE_SIZE_FOR_CALIBRATION = 5;

/**
 * Pure function to validate consistency between AttemptResult and ConfidenceLevel
 */
export function validateAttemptConsistency(
  result: AttemptResult | null,
  confidence: ConfidenceLevel | null,
  _metadata?: Record<string, unknown>
): { valid: boolean; errorMessage?: string } {
  if (!result) {
    return { valid: false, errorMessage: 'Selecione o resultado da tentativa.' };
  }

  // BLANK and NO_TIME: confidence is optional
  if (result === 'BLANK' || result === 'NO_TIME') {
    return { valid: true };
  }

  // All other results require explicit confidence selection
  if (confidence === null || confidence === undefined) {
    return { valid: false, errorMessage: 'Por favor, selecione seu nível de confiança (1 a 5).' };
  }

  if (result === 'CORRECT_CONFIDENT') {
    if (confidence < 4) {
      return { 
        valid: false, 
        errorMessage: 'Essas duas respostas parecem contraditórias. Qual descreve melhor o que aconteceu?' 
      };
    }
  }

  if (result === 'CORRECT_UNCERTAIN') {
    if (confidence >= 4) {
      return { 
        valid: false, 
        errorMessage: 'Essas duas respostas parecem contraditórias. Qual descreve melhor o que aconteceu?' 
      };
    }
  }

  if (result === 'CORRECT_GUESS') {
    if (confidence >= 4) {
      return { 
        valid: false, 
        errorMessage: 'Essas duas respostas parecem contraditórias. Qual descreve melhor o que aconteceu?' 
      };
    }
  }

  if (result === 'WRONG') {
    if (confidence < 1 || confidence > 5) {
      return { valid: false, errorMessage: 'Por favor, selecione seu nível de confiança (1 a 5).' };
    }
  }

  return { valid: true };
}

/**
 * Helper to map an attempt stage (result + confidence) to a LearningEvidenceSignal
 */
export function signalFromAttemptStage(stage: { result: AttemptResult; confidence?: ConfidenceLevel | null }): LearningEvidenceSignal {
  const result = stage.result;
  const conf = stage.confidence ?? null;

  if (result === 'CORRECT_CONFIDENT') {
    return (conf !== null && conf < 4) ? 'FRAGILE_POSITIVE' : 'STRONG_POSITIVE';
  }
  if (result === 'CORRECT_UNCERTAIN' || result === 'CORRECT_GUESS') {
    return 'FRAGILE_POSITIVE';
  }
  if (result === 'WRONG') {
    return (conf !== null && conf >= 4) ? 'CONFIDENCE_DIVERGENCE' : 'NEGATIVE_SIGNAL';
  }
  if (result === 'NO_TIME') {
    return 'TIME_SIGNAL';
  }
  if (result === 'BLANK') {
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

/**
 * Pure function to interpret a single question attempt
 */
export function interpretAttempt(attempt: Attempt, question: Question): AttemptInterpretation {
  if (!attempt.userId || !question.id) {
    throw new Error('interpretAttempt requires valid attempt and question objects.');
  }

  if (attempt.questionId !== question.id || attempt.userId !== question.userId) {
    throw new Error('Mismatched attempt and question: questionId and userId must match.');
  }

  // Self-correction takes precedence if triggered and explicitly done before solution
  if (attempt.selfCorrection && attempt.correctionBeforeSolution === true) {
    return {
      signalType: 'SELF_CORRECTION',
      title: 'Autocorreção Bem-Sucedida',
      explanation: 'Você errou na primeira tentativa, mas identificou o ponto de ajuste e acertou na segunda antes de consultar a resolução.',
      recommendedNextAction: 'CONCLUIR',
      confidence: attempt.confidence,
    };
  }

  // Second attempt correct after solution
  if (
    attempt.firstAttempt?.result === 'WRONG' &&
    attempt.correctionBeforeSolution === false &&
    attempt.secondAttempt &&
    ['CORRECT_CONFIDENT', 'CORRECT_UNCERTAIN', 'CORRECT_GUESS'].includes(attempt.secondAttempt.result || '')
  ) {
    return {
      signalType: 'FRAGILE_POSITIVE',
      title: 'Acerto Após Consulta da Resolução',
      explanation: 'Você conseguiu resolver após consultar a resolução. Isso é um sinal útil, mas ainda precisamos confirmar se consegue reproduzir o raciocínio sem apoio.',
      recommendedNextAction: 'REVISITAR_DEPOIS',
      confidence: attempt.confidence,
    };
  }

  switch (attempt.result) {
    case 'CORRECT_CONFIDENT':
      if (!attempt.confidence || attempt.confidence < 4) {
        return {
          signalType: 'FRAGILE_POSITIVE',
          title: 'Dados Inconsistentes no Registro',
          explanation: 'Registrado como acerto com segurança, mas a confiança marcada foi baixa.',
          recommendedNextAction: 'REVISITAR_DEPOIS',
          confidence: attempt.confidence,
        };
      }
      return {
        signalType: 'STRONG_POSITIVE',
        title: 'Bom sinal nesta tentativa',
        explanation: 'Você acertou com segurança. Precisamos de outras evidências antes de considerar esse tópico consolidado.',
        recommendedNextAction: 'CONCLUIR',
        confidence: attempt.confidence,
      };

    case 'CORRECT_UNCERTAIN':
      return {
        signalType: 'FRAGILE_POSITIVE',
        title: 'Acerto com Dúvida',
        explanation: 'Você chegou à resposta correta, mas o conhecimento ainda parece instável.',
        recommendedNextAction: 'REVISITAR_DEPOIS',
        confidence: attempt.confidence,
      };

    case 'CORRECT_GUESS':
      return {
        signalType: 'FRAGILE_POSITIVE',
        title: 'Acerto por Acaso / Chute',
        explanation: 'A resposta estava correta, mas ainda precisamos confirmar o raciocínio.',
        recommendedNextAction: 'JUSTIFICAR_RACIOCINIO',
        confidence: attempt.confidence,
      };

    case 'WRONG':
      if (attempt.confidence !== null && attempt.confidence >= 4) {
        return {
          signalType: 'CONFIDENCE_DIVERGENCE',
          title: 'Divergência de Confiança',
          explanation: 'Você estava bastante seguro, mas o resultado foi diferente. Isso merece investigação antes de rever toda a teoria.',
          recommendedNextAction: 'ANALISAR_ERRO',
          confidence: attempt.confidence,
        };
      } else if (attempt.confidence === 3) {
        return {
          signalType: 'NEGATIVE_SIGNAL',
          title: 'Resultado Inesperado / Dúvida Intermediária',
          explanation: 'Esta tentativa terminou em erro, mas a confiança intermediária não permite inferir um padrão claro.',
          recommendedNextAction: 'ANALISAR_ERRO',
          confidence: attempt.confidence,
        };
      } else {
        return {
          signalType: 'NEGATIVE_SIGNAL',
          title: 'Insegurança Confirmada',
          explanation: 'Você já estava pouco seguro nesta tentativa.',
          recommendedNextAction: 'ANALISAR_ERRO',
          confidence: attempt.confidence,
        };
      }

    case 'NO_TIME':
      return {
        signalType: 'TIME_SIGNAL',
        title: 'Questão Sem Tempo',
        explanation: 'Falta de tempo para concluir a questão. Sinal de gestão de tempo ou complexidade na execução.',
        recommendedNextAction: 'REVISITAR_DEPOIS',
        confidence: attempt.confidence,
      };

    case 'BLANK':
    default:
      return {
        signalType: 'UNKNOWN',
        title: 'Questão em Branco',
        explanation: 'Deixou em branco sem tentar. Vale investigar se foi por falta de conteúdo, estratégia ou hesitação.',
        recommendedNextAction: 'REVISITAR_DEPOIS',
        confidence: attempt.confidence,
      };
  }
}

/**
 * Creates one or more structured LearningEvidences from a Question attempt.
 * Deterministic IDs derived from attempt.id ensure idempotency.
 */
export function createLearningEvidencesFromAttempt(attempt: Attempt, question: Question): LearningEvidence[] {
  if (!attempt.userId || !attempt.questionId) {
    throw new Error('Attempt requires userId and questionId to create LearningEvidence.');
  }

  if (attempt.questionId !== question.id || attempt.userId !== question.userId) {
    throw new Error('Mismatched attempt and question: questionId and userId must match.');
  }

  // 2-stage attempt (first attempt was WRONG, second attempt exists)
  if (attempt.firstAttempt && attempt.firstAttempt.result === 'WRONG' && attempt.secondAttempt) {
    const firstAttemptConf = attempt.firstAttempt.confidence ?? null;
    const firstSignal = signalFromAttemptStage({ result: 'WRONG', confidence: firstAttemptConf });

    const ev1: LearningEvidence = {
      id: `ev_${attempt.id}_first`,
      userId: attempt.userId,
      subjectId: question.subjectId,
      topicIds: question.topicIds || [],
      type: 'QUESTION_ATTEMPT',
      sourceId: attempt.id,
      createdAt: attempt.firstAttempt.timestamp || attempt.createdAt,
      signal: firstSignal,
      result: attempt.firstAttempt.result || 'WRONG',
      confidence: firstAttemptConf,
      difficulty: question.difficulty,
      durationSeconds: attempt.durationSeconds,
      metadata: {
        stage: 'FIRST_ATTEMPT',
        questionTitle: question.title,
        reflectionTag: attempt.firstAttempt.reflectionTag || attempt.reflectionTag,
      },
    };

    const isSecondCorrect = ['CORRECT_CONFIDENT', 'CORRECT_UNCERTAIN', 'CORRECT_GUESS'].includes(attempt.secondAttempt.result || '');

    if (isSecondCorrect && attempt.correctionBeforeSolution === true) {
      const ev2: LearningEvidence = {
        id: `ev_${attempt.id}_self_correction`,
        userId: attempt.userId,
        subjectId: question.subjectId,
        topicIds: question.topicIds || [],
        type: 'QUESTION_ATTEMPT',
        sourceId: attempt.id,
        createdAt: attempt.secondAttempt.timestamp || attempt.completedAt || new Date().toISOString(),
        signal: 'SELF_CORRECTION',
        result: attempt.secondAttempt.result || attempt.result,
        confidence: attempt.secondAttempt.confidence ?? attempt.confidence,
        difficulty: question.difficulty,
        durationSeconds: attempt.durationSeconds,
        metadata: {
          stage: 'SELF_CORRECTION',
          questionTitle: question.title,
          changedAnswer: attempt.changedAnswer,
          selfCorrection: true,
          correctionBeforeSolution: true,
        },
      };
      return [ev1, ev2];
    } else if (isSecondCorrect && attempt.correctionBeforeSolution === false) {
      const ev2: LearningEvidence = {
        id: `ev_${attempt.id}_post_solution`,
        userId: attempt.userId,
        subjectId: question.subjectId,
        topicIds: question.topicIds || [],
        type: 'QUESTION_ATTEMPT',
        sourceId: attempt.id,
        createdAt: attempt.secondAttempt.timestamp || attempt.completedAt || new Date().toISOString(),
        signal: 'POST_SOLUTION',
        result: attempt.secondAttempt.result || attempt.result,
        confidence: attempt.secondAttempt.confidence ?? attempt.confidence,
        difficulty: question.difficulty,
        durationSeconds: attempt.durationSeconds,
        metadata: {
          stage: 'POST_SOLUTION',
          questionTitle: question.title,
          changedAnswer: attempt.changedAnswer,
          selfCorrection: false,
          afterSolution: true,
          correctionBeforeSolution: false,
        },
      };
      return [ev1, ev2];
    } else {
      const secondSignal = signalFromAttemptStage({
        result: (attempt.secondAttempt.result || 'WRONG') as AttemptResult,
        confidence: attempt.secondAttempt.confidence ?? attempt.confidence,
      });
      const ev2: LearningEvidence = {
        id: `ev_${attempt.id}_second`,
        userId: attempt.userId,
        subjectId: question.subjectId,
        topicIds: question.topicIds || [],
        type: 'QUESTION_ATTEMPT',
        sourceId: attempt.id,
        createdAt: attempt.secondAttempt.timestamp || attempt.completedAt || new Date().toISOString(),
        signal: secondSignal,
        result: attempt.secondAttempt.result || attempt.result,
        confidence: attempt.secondAttempt.confidence ?? attempt.confidence,
        difficulty: question.difficulty,
        durationSeconds: attempt.durationSeconds,
        metadata: {
          stage: 'SECOND_ATTEMPT',
          questionTitle: question.title,
          changedAnswer: attempt.changedAnswer,
          selfCorrection: false,
          correctionBeforeSolution: attempt.correctionBeforeSolution,
        },
      };
      return [ev1, ev2];
    }
  }

  const interpretation = interpretAttempt(attempt, question);

  let signal: LearningEvidenceSignal = interpretation.signalType;
  if (attempt.result === 'CORRECT_CONFIDENT' && attempt.confidence !== null && attempt.confidence >= 4) {
    signal = 'STRONG_POSITIVE';
  } else if (attempt.result === 'CORRECT_CONFIDENT' && (attempt.confidence === null || attempt.confidence < 4)) {
    signal = 'FRAGILE_POSITIVE';
  } else if (attempt.result === 'CORRECT_UNCERTAIN' || attempt.result === 'CORRECT_GUESS') {
    signal = 'FRAGILE_POSITIVE';
  } else if (attempt.result === 'WRONG' && attempt.confidence !== null && attempt.confidence >= 4) {
    signal = 'CONFIDENCE_DIVERGENCE';
  } else if (attempt.result === 'WRONG') {
    signal = 'NEGATIVE_SIGNAL';
  } else if (attempt.result === 'NO_TIME') {
    signal = 'TIME_SIGNAL';
  } else if (attempt.result === 'BLANK') {
    signal = 'UNKNOWN';
  }

  const singleEv: LearningEvidence = {
    id: `ev_${attempt.id}_primary`,
    userId: attempt.userId,
    subjectId: question.subjectId,
    topicIds: question.topicIds || [],
    type: 'QUESTION_ATTEMPT',
    sourceId: attempt.id,
    createdAt: attempt.completedAt || new Date().toISOString(),
    signal,
    result: attempt.result,
    confidence: attempt.confidence,
    difficulty: question.difficulty,
    durationSeconds: attempt.durationSeconds,
    metadata: {
      questionTitle: question.title,
      reflectionTag: attempt.reflectionTag,
      changedAnswer: attempt.changedAnswer,
      selfCorrection: attempt.selfCorrection,
    },
  };

  return [singleEv];
}

/**
 * Legacy single evidence generator (for backward compatibility)
 */
export function createLearningEvidenceFromAttempt(attempt: Attempt, question: Question): LearningEvidence {
  const list = createLearningEvidencesFromAttempt(attempt, question);
  return list[0];
}

/**
 * Calculates factual summary of confidence calibration for a user
 */
export function getConfidenceCalibrationSummary(
  userId: string, 
  attempts: Attempt[]
): ConfidenceCalibrationSummary {
  const userAttempts = attempts.filter(a => a.userId === userId);
  const totalRegisteredAttempts = userAttempts.length;

  const eligibleAttemptsList = userAttempts.filter(
    a => a.result !== 'BLANK' && a.result !== 'NO_TIME' && a.confidence !== null && a.confidence !== undefined
  );
  const eligibleAttempts = eligibleAttemptsList.length;

  if (eligibleAttempts < MIN_SAMPLE_SIZE_FOR_CALIBRATION) {
    return {
      totalAttempts: eligibleAttempts,
      totalRegisteredAttempts,
      eligibleAttempts,
      highConfidenceAttempts: 0,
      highConfidenceCorrect: 0,
      highConfidenceWrong: 0,
      uncertainCorrect: 0,
      guessCorrect: 0,
      status: 'INSUFFICIENT_DATA',
      sampleSizeNote: `Calibração baseada em ${eligibleAttempts} tentativas elegíveis de ${totalRegisteredAttempts} registradas. (Mínimo recomendado: ${MIN_SAMPLE_SIZE_FOR_CALIBRATION})`,
    };
  }

  const highConfidenceAttempts = eligibleAttemptsList.filter(a => a.confidence! >= 4).length;
  const highConfidenceCorrect = eligibleAttemptsList.filter(a => a.confidence! >= 4 && (a.result === 'CORRECT_CONFIDENT' || a.result === 'CORRECT_UNCERTAIN')).length;
  const highConfidenceWrong = eligibleAttemptsList.filter(a => a.confidence! >= 4 && a.result === 'WRONG').length;
  const uncertainCorrect = eligibleAttemptsList.filter(a => a.result === 'CORRECT_UNCERTAIN').length;
  const guessCorrect = eligibleAttemptsList.filter(a => a.result === 'CORRECT_GUESS').length;

  return {
    totalAttempts: eligibleAttempts,
    totalRegisteredAttempts,
    eligibleAttempts,
    highConfidenceAttempts,
    highConfidenceCorrect,
    highConfidenceWrong,
    uncertainCorrect,
    guessCorrect,
    status: 'AVAILABLE',
    sampleSizeNote: `Calibração baseada em ${eligibleAttempts} tentativas elegíveis de ${totalRegisteredAttempts} registradas.`,
  };
}

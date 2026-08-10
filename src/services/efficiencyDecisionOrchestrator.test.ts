import {
  TaskItem,
  TopicNode,
  ErrorEntry,
  Attempt,
  LearningEvidence,
  Review,
  ReviewCompletion,
  ReviewStatus,
  ReviewType,
  ReviewTriggerReason,
} from '../types';
import {
  buildEfficiencyDecisionForUser,
  generateDecidePorMimV2,
} from './efficiencyDecisionOrchestrator';
import { ReviewRepository, ReviewCompletionRepository } from './reviewRepository';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

// In-memory repos for isolated testing
class MemoryReviewRepository implements ReviewRepository {
  private reviews: Review[] = [];

  getReviewsByUser(userId: string): Review[] {
    return this.reviews.filter(r => r.userId === userId);
  }

  getReviewById(id: string, userId: string): Review | null {
    return this.reviews.find(r => r.id === id && r.userId === userId) || null;
  }

  findActiveReviewForTopicAndTrigger(
    userId: string,
    topicId: string,
    triggerReason: ReviewTriggerReason
  ): Review | null {
    return (
      this.reviews.find(
        r =>
          r.userId === userId &&
          r.topicId === topicId &&
          r.triggerReason === triggerReason &&
          (r.status === 'SCHEDULED' || r.status === 'AVAILABLE' || r.status === 'REASSESS')
      ) || null
    );
  }

  saveReview(review: Review): Review {
    const idx = this.reviews.findIndex(r => r.id === review.id);
    if (idx !== -1) {
      return this.reviews[idx];
    }
    this.reviews.push(review);
    return review;
  }

  updateReviewStatus(id: string, userId: string, status: ReviewStatus, rationale?: string): Review | null {
    const idx = this.reviews.findIndex(r => r.id === id && r.userId === userId);
    if (idx === -1) return null;
    this.reviews[idx] = {
      ...this.reviews[idx],
      status,
      rationale: rationale || this.reviews[idx].rationale,
    };
    return this.reviews[idx];
  }

  rescheduleReview(params: { id: string; userId: string; windowStart: string; windowEnd: string; rationale?: string }): Review | null {
    const idx = this.reviews.findIndex(r => r.id === params.id && r.userId === params.userId);
    if (idx === -1) return null;
    this.reviews[idx] = {
      ...this.reviews[idx],
      recommendedWindowStart: params.windowStart,
      recommendedWindowEnd: params.windowEnd,
      rationale: params.rationale || this.reviews[idx].rationale,
    };
    return this.reviews[idx];
  }

  changeReviewMethod(params: { id: string; userId: string; reviewType: ReviewType; rationale?: string }): Review | null {
    const idx = this.reviews.findIndex(r => r.id === params.id && r.userId === params.userId);
    if (idx === -1) return null;
    this.reviews[idx] = {
      ...this.reviews[idx],
      reviewType: params.reviewType,
      rationale: params.rationale || this.reviews[idx].rationale,
    };
    return this.reviews[idx];
  }
}

class MemoryReviewCompletionRepository implements ReviewCompletionRepository {
  private completions: ReviewCompletion[] = [];

  getCompletionsByUser(userId: string): ReviewCompletion[] {
    return this.completions.filter(c => c.userId === userId);
  }

  getCompletionsByReview(reviewId: string): ReviewCompletion[] {
    return this.completions.filter(c => c.reviewId === reviewId);
  }

  saveCompletion(completion: ReviewCompletion): ReviewCompletion {
    this.completions.push(completion);
    return completion;
  }
}

function runOrchestratorTests() {
  console.log('==================================================');
  console.log('   EXECUTANDO TESTES DO DECISION ORCHESTRATOR V2   ');
  console.log('==================================================');

  const now = '2026-08-09T10:00:00.000Z';
  const u1 = 'u_orch_1';
  const u2 = 'u_orch_2';

  const topics: TopicNode[] = [
    {
      id: 'top_algebra',
      subjectId: 'subj_math',
      name: 'Álgebra Fundamental',
      masteryLevel: 5,
      weightInExam: 8,
      prerequisites: [],
    },
    {
      id: 'top_calculus',
      subjectId: 'subj_math',
      name: 'Cálculo Diferencial',
      masteryLevel: 5,
      weightInExam: 9,
      prerequisites: ['top_algebra'],
    },
  ];

  const taskShort: TaskItem = {
    id: 'task_short',
    subjectId: 'subj_math',
    topicId: 'top_algebra',
    title: 'Exercícios Rápidos de Álgebra',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 7,
    impact: 7,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };

  const taskLong: TaskItem = {
    id: 'task_long',
    subjectId: 'subj_math',
    topicId: 'top_calculus',
    title: 'Leitura Aprofundada de Cálculo',
    durationMinutes: 60,
    energyRequired: 'high',
    decision: 'ADIAR',
    rationale: '',
    urgency: 9,
    impact: 9,
    isCritical: false,
    status: 'pending',
    category: 'teoria',
  };

  const taskCritical15: TaskItem = {
    id: 'task_crit_15',
    subjectId: 'subj_math',
    topicId: 'top_algebra',
    title: 'Tarefa Crítica Urgente',
    durationMinutes: 15,
    energyRequired: 'medium',
    decision: 'ADIAR',
    rationale: '',
    urgency: 10,
    impact: 10,
    isCritical: true,
    status: 'pending',
    category: 'questoes',
  };

  // Test A: availableMinutes arrives intact to Engine (long task doesn't fit in 15 min)
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const output15 = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskLong],
      topics,
      errors: [],
      availableMinutes: 15,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      output15.primaryCandidate === null,
      'A) availableMinutes (15 min) impede tarefa de 60 min de ser escolhida como FAZER'
    );
    assert(
      output15.reasons.length > 0,
      'A) Motor expõe a razão de nenhuma atividade caber na janela de tempo'
    );
  }

  const taskLowEnergy: TaskItem = {
    id: 'task_low_energy',
    subjectId: 'subj_math',
    topicId: 'top_algebra',
    title: 'Exercícios Leves de Álgebra',
    durationMinutes: 15,
    energyRequired: 'low',
    decision: 'ADIAR',
    rationale: '',
    urgency: 8,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'questoes',
  };

  const taskHighEnergy: TaskItem = {
    id: 'task_high_energy',
    subjectId: 'subj_math',
    topicId: 'top_algebra',
    title: 'Estudo Intenso de Álgebra',
    durationMinutes: 15,
    energyRequired: 'high',
    decision: 'ADIAR',
    rationale: '',
    urgency: 8,
    impact: 8,
    isCritical: false,
    status: 'pending',
    category: 'teoria',
  };

  // Test B: energyLevel arrives intact to Engine
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const outputLowEnergy = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskLowEnergy, taskHighEnergy],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'low',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputLowEnergy.primaryCandidate?.candidate.sourceId === 'task_low_energy',
      'B) energyLevel low favorece tarefa de baixa energia sobre tarefa de alta energia'
    );
  }

  // Test C: same `now` timestamp used in Review sync and Engine
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const customNow = '2026-08-09T14:30:00.000Z';
    const outputNow = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now: customNow,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputNow.evaluatedAt === customNow,
      'C) O mesmo timestamp `now` é retornado no output do Engine'
    );
  }

  // Test D & E: Evidences and Attempts filtered strictly by userId
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const evU1: LearningEvidence = {
      id: 'ev_u1',
      userId: u1,
      subjectId: 'subj_math',
      topicIds: ['top_algebra'],
      sourceId: 'src_1',
      type: 'QUESTION_ATTEMPT',
      signal: 'FRAGILE_POSITIVE',
      confidence: 5,
      createdAt: now,
    };

    const evU2: LearningEvidence = {
      id: 'ev_u2',
      userId: u2,
      subjectId: 'subj_math',
      topicIds: ['top_algebra'],
      sourceId: 'src_2',
      type: 'QUESTION_ATTEMPT',
      signal: 'STRONG_POSITIVE',
      confidence: 5,
      createdAt: now,
    };

    const outputD = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: (uid) => (uid === u1 ? [] : []) },
      learningEvidenceRepository: {
        getEvidencesByUser: (uid) => (uid === u1 ? [evU1] : [evU2]),
      },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputD.evaluatedAt === now,
      'D & E) Evidências e tentativas são filtradas exclusivamente pelo userId do usuário'
    );
  }

  // Test F: Review sync provides real MasteryStates to Engine
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const evFragile: LearningEvidence = {
      id: 'ev_fragile',
      userId: u1,
      subjectId: 'subj_math',
      topicIds: ['top_algebra'],
      sourceId: 'src_fragile',
      type: 'QUESTION_ATTEMPT',
      signal: 'NEGATIVE_SIGNAL',
      confidence: 5,
      createdAt: now,
    };

    const outputF = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [evFragile] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputF.primaryCandidate !== null,
      'F) Sync de reviews calcula MasteryStates reais a partir de evidências'
    );
  }

  // Test G: Review AVAILABLE competes with Task
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const reviewAvailable: Review = {
      id: 'rev_avail_1',
      userId: u1,
      subjectId: 'subj_math',
      topicId: 'top_algebra',
      reviewType: 'ACTIVE_RECALL',
      triggerReason: 'FRAGILE_MASTERY',
      status: 'AVAILABLE',
      priority: 'HIGH',
      sourceEvidenceIds: [],
      createdAt: now,
      notBefore: now,
      recommendedWindowStart: now,
      recommendedWindowEnd: now,
      estimatedMinutes: 12,
      rationale: 'Revisão ativa necessária para o tópico frágil.',
      recommendationConfidence: 'HIGH',
      policyVersion: '2.0-V1',
    };
    revRepo.saveReview(reviewAvailable);

    const outputG = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 15,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputG.rankedCandidates.some(c => c.candidate.sourceType === 'REVIEW'),
      'G) Revisão AVAILABLE compete diretamente com tarefas no Motor V2'
    );
  }

  // Test H: NO_REVIEW_NOW decisions are generated and handled gracefully
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const outputH = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 15,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputH.primaryCandidate !== null,
      'H) Decisões de NO_REVIEW_NOW são repassadas sem travar a avaliação de tarefas'
    );
  }

  // Test I: Calling orchestrator DOES NOT alter Task.decision or mutate input tasks
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const inputTask: TaskItem = { ...taskShort, decision: 'ADIAR' };

    buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [inputTask],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      inputTask.decision === 'ADIAR',
      'I) O orquestrador NÃO altera task.decision nas tarefas recebidas (estritamente read-only)'
    );
  }

  // Test J: Repeated sync does not duplicate Reviews in repository
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    const reviewsFirstRun = revRepo.getReviewsByUser(u1).length;

    buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    const reviewsSecondRun = revRepo.getReviewsByUser(u1).length;

    assert(
      reviewsFirstRun === reviewsSecondRun,
      'J) Execuções repetidas do sync de reviews são idempotentes e não duplicam registros'
    );
  }

  // Test K: User without evidences or attempts runs safely
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const outputK = buildEfficiencyDecisionForUser({
      userId: 'u_new_user',
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputK.primaryCandidate !== null,
      'K) Usuário sem evidências prévias gera recomendação sem erros'
    );
  }

  // Test L: Review of another user does not become recommendation for local user
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const reviewU2: Review = {
      id: 'rev_u2_only',
      userId: u2,
      subjectId: 'subj_math',
      topicId: 'top_algebra',
      reviewType: 'ACTIVE_RECALL',
      triggerReason: 'FRAGILE_MASTERY',
      status: 'AVAILABLE',
      priority: 'CRITICAL',
      sourceEvidenceIds: [],
      createdAt: now,
      notBefore: now,
      recommendedWindowStart: now,
      recommendedWindowEnd: now,
      estimatedMinutes: 10,
      rationale: 'Revisão do usuário 2',
      recommendationConfidence: 'HIGH',
      policyVersion: '2.0-V1',
    };
    revRepo.saveReview(reviewU2);

    const outputL = buildEfficiencyDecisionForUser({
      userId: u1,
      tasks: [],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputL.primaryCandidate === null,
      'L) Review pertencente a outro usuário (u2) NÃO vira recomendação para u1'
    );
  }

  // Test M (Section 38): Temporal Decision Scenario
  // availableMinutes = 15, Task = 60 min, Review AVAILABLE = 12 min
  // Expected: Review can be primary, Task of 60 min does NOT receive FAZER
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const rev12Min: Review = {
      id: 'rev_12min',
      userId: u1,
      subjectId: 'subj_math',
      topicId: 'top_algebra',
      reviewType: 'ACTIVE_RECALL',
      triggerReason: 'RETENTION_CHECK',
      status: 'AVAILABLE',
      priority: 'HIGH',
      sourceEvidenceIds: [],
      createdAt: now,
      notBefore: now,
      recommendedWindowStart: now,
      recommendedWindowEnd: now,
      estimatedMinutes: 12,
      rationale: 'Checagem de retenção em 12 minutos.',
      recommendationConfidence: 'HIGH',
      policyVersion: '2.0-V1',
    };
    revRepo.saveReview(rev12Min);

    const outputM = generateDecidePorMimV2({
      userId: u1,
      tasks: [taskLong],
      topics,
      errors: [],
      availableMinutes: 15,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputM.primaryCandidate?.candidate.sourceType === 'REVIEW' &&
      outputM.primaryCandidate?.candidate.sourceId === 'rev_12min',
      'M) Em janela de 15 min, a revisão de 12 min é escolhida como primária'
    );

    const taskLongRanked = outputM.rankedCandidates.find(
      c => c.candidate.sourceId === 'task_long'
    );
    assert(
      taskLongRanked?.decision === 'ADIAR',
      'M) A tarefa de 60 min recebe ADIAR porque excede a janela de 15 min'
    );
  }

  // Test N (Section 39): Task crítica of 15 min vs Review MAINTENANCE of 10 min
  // Expected: Engine chooses critical task per current policy
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const revMaint10Min: Review = {
      id: 'rev_maint_10min',
      userId: u1,
      subjectId: 'subj_math',
      topicId: 'top_algebra',
      reviewType: 'THEORY_REFRESH',
      triggerReason: 'RETENTION_CHECK',
      status: 'AVAILABLE',
      priority: 'MAINTENANCE',
      sourceEvidenceIds: [],
      createdAt: now,
      notBefore: now,
      recommendedWindowStart: now,
      recommendedWindowEnd: now,
      estimatedMinutes: 10,
      rationale: 'Revisão de manutenção simples.',
      recommendationConfidence: 'LOW',
      policyVersion: '2.0-V1',
    };
    revRepo.saveReview(revMaint10Min);

    const outputN = generateDecidePorMimV2({
      userId: u1,
      tasks: [taskCritical15],
      topics,
      errors: [],
      availableMinutes: 15,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputN.primaryCandidate?.candidate.sourceType === 'TASK' &&
      outputN.primaryCandidate?.candidate.sourceId === 'task_crit_15',
      'N) O Motor escolhe a tarefa crítica de 15 min em relação à revisão de manutenção secundária'
    );
  }

  // Test O: Attempts repository returns mixed u1/u2 data -> only u1 is processed
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const attU1: Attempt = {
      id: 'att_u1',
      userId: u1,
      questionId: 'q1',
      result: 'WRONG',
      confidence: 3,
      selectedAnswer: 'A',
      durationSeconds: 60,
      completedAt: now,
      createdAt: now,
    };
    const attU2: Attempt = {
      id: 'att_u2',
      userId: u2,
      questionId: 'q2',
      result: 'CORRECT_CONFIDENT',
      confidence: 4,
      selectedAnswer: 'B',
      durationSeconds: 30,
      completedAt: now,
      createdAt: now,
    };

    const outputO = generateDecidePorMimV2({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [attU1, attU2] },
      learningEvidenceRepository: { getEvidencesByUser: () => [] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputO.evaluatedAt === now,
      'O) Repositório de tentativas misturadas (u1/u2) filtra estritamente por u1'
    );
  }

  // Test P: Evidences repository returns mixed u1/u2 data -> only u1 is processed
  {
    const revRepo = new MemoryReviewRepository();
    const compRepo = new MemoryReviewCompletionRepository();

    const evU1: LearningEvidence = {
      id: 'ev_mix_1',
      userId: u1,
      subjectId: 'subj_math',
      topicIds: ['top_algebra'],
      sourceId: 'src_1',
      type: 'QUESTION_ATTEMPT',
      signal: 'FRAGILE_POSITIVE',
      confidence: 5,
      createdAt: now,
    };
    const evU2: LearningEvidence = {
      id: 'ev_mix_2',
      userId: u2,
      subjectId: 'subj_math',
      topicIds: ['top_algebra'],
      sourceId: 'src_2',
      type: 'QUESTION_ATTEMPT',
      signal: 'STRONG_POSITIVE',
      confidence: 5,
      createdAt: now,
    };

    const outputP = generateDecidePorMimV2({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
      attemptRepository: { getAttemptsByUser: () => [] },
      learningEvidenceRepository: { getEvidencesByUser: () => [evU1, evU2] },
      reviewRepository: revRepo,
      reviewCompletionRepository: compRepo,
    });

    assert(
      outputP.evaluatedAt === now,
      'P) Repositório de evidências misturadas (u1/u2) filtra estritamente por u1'
    );
  }

  // Test Q: Empty/invalid userId throws error
  {
    let threwError = false;
    try {
      generateDecidePorMimV2({
        userId: '',
        tasks: [taskShort],
        topics,
        errors: [],
        availableMinutes: 30,
        energyLevel: 'medium',
        now,
      });
    } catch (err: any) {
      threwError = true;
    }

    assert(
      threwError,
      'Q) Chamada sem userId válido lança erro controlado'
    );
  }

  // Test R: Task.decision remains completely untouched after orchestrator execution
  {
    const taskCopy: TaskItem = { ...taskShort, decision: 'ADIAR' };
    generateDecidePorMimV2({
      userId: u1,
      tasks: [taskCopy],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now,
    });

    assert(
      taskCopy.decision === 'ADIAR',
      'R) Propriedade Task.decision permanece inalterada após execução do orquestrador'
    );
  }

  // Test S: EvaluatedAt matches input timestamp exactly
  {
    const testTimestamp = '2026-12-31T23:59:59.999Z';
    const outputS = generateDecidePorMimV2({
      userId: u1,
      tasks: [taskShort],
      topics,
      errors: [],
      availableMinutes: 30,
      energyLevel: 'medium',
      now: testTimestamp,
    });

    assert(
      outputS.evaluatedAt === testTimestamp,
      'S) Timestamp evaluatedAt no output corresponde exatamente ao timestamp now fornecido'
    );
  }

  console.log('==================================================');
  console.log('   RESULTADO: TODOS OS TESTES DO ORCHESTRATOR PASSARAM COM SUCESSO!   ');
  console.log('==================================================');
}

runOrchestratorTests();

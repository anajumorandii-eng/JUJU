import React, { useState, useEffect } from 'react';
import { 
  INITIAL_USER_PROFILE, 
  INITIAL_SUBJECTS, 
  INITIAL_TOPICS, 
  INITIAL_TASKS, 
  INITIAL_ERRORS, 
  INITIAL_EXPERIMENTS, 
  INITIAL_DISCOVERIES, 
  INITIAL_PODCASTS, 
  INITIAL_INTEGRATIONS 
} from './data/initialData';

import { TaskItem, StudySession, ReviewQuestionContext } from './types';
import { usePersistentState } from './hooks/usePersistentState';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { ProfileView } from './components/ProfileView';
import { TodayView } from './components/TodayView';
import { StudySessionView } from './components/StudySessionView';
import { QuestionsView } from './components/QuestionsView';
import { ReviewsView } from './components/ReviewsView';
import { ErrorNotebookView, ErrorDraftData } from './components/ErrorNotebookView';
import { PodcastView } from './components/PodcastView';
import { TutorView } from './components/TutorView';
import { PlannerView } from './components/PlannerView';
import { MethodLabView } from './components/MethodLabView';
import { EvolutionView } from './components/EvolutionView';
import { ConnectionsView } from './components/ConnectionsView';
import { OnboardingModal } from './components/OnboardingModal';
import { AdaptiveDiagnosticModal } from './components/AdaptiveDiagnosticModal';
import { DiagnosticInvitationModal } from './components/DiagnosticInvitationModal';
import { InitialLearningDiagnostic } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('hoje');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showDiagnostic, setShowDiagnostic] = useState<boolean>(false);
  const [showDiagnosticInvitation, setShowDiagnosticInvitation] = useState<boolean>(false);

  // App Data State (persisted locally so progress survives a reload)
  const [user, setUser] = usePersistentState('juju_app_user_v1', INITIAL_USER_PROFILE);
  const [subjects] = useState(INITIAL_SUBJECTS);
  const [topics] = useState(INITIAL_TOPICS);
  const [tasks, setTasks] = usePersistentState<TaskItem[]>('juju_app_tasks_v1', INITIAL_TASKS);
  const [errors, setErrors] = usePersistentState('juju_app_errors_v1', INITIAL_ERRORS);
  const [experiments, setExperiments] = usePersistentState('juju_app_experiments_v1', INITIAL_EXPERIMENTS);
  const [discoveries] = useState(INITIAL_DISCOVERIES);
  const [podcasts, setPodcasts] = usePersistentState('juju_app_podcasts_v1', INITIAL_PODCASTS);
  const [integrations, setIntegrations] = usePersistentState('juju_app_integrations_v1', INITIAL_INTEGRATIONS);

  // Active Session State
  const [activeTaskForSession, setActiveTaskForSession] = useState<TaskItem | null>(null);
  const [errorDraft, setErrorDraft] = useState<ErrorDraftData | null>(null);
  const [reviewQuestionContext, setReviewQuestionContext] = useState<ReviewQuestionContext | null>(null);
  const [focusedReviewErrorId, setFocusedReviewErrorId] = useState<string | null>(null);
  const [focusedEfficiencyReviewId, setFocusedEfficiencyReviewId] = useState<string | null>(null);

  useEffect(() => {
    // Show non-intrusive diagnostic invitation after onboarding check
    if (user.hasOnboarded && !user.diagnostic?.completedAt && !showOnboarding) {
      const dismissed = sessionStorage.getItem('juju_diag_invitation_dismissed');
      if (dismissed !== 'true') {
        setShowDiagnosticInvitation(true);
      }
    }
  }, [user.hasOnboarded, user.diagnostic, showOnboarding]);

  const handleStartSession = (task: TaskItem) => {
    setActiveTaskForSession(task);
    setActiveTab('estudar');
  };

  const handleCompleteSession = (_session: StudySession) => {
    if (activeTaskForSession) {
      setTasks(prev => prev.map(t => t.id === activeTaskForSession.id ? { ...t, status: 'completed' } : t));
    }
    setActiveTaskForSession(null);
    setActiveTab('hoje');
  };

  const handleCreatePodcast = (_topicName: string) => {
    setActiveTab('podcast');
  };

  const handleStudyMaterial = (_materialTitle: string) => {
    if (tasks.length > 0) {
      handleStartSession(tasks[0]);
    } else {
      setActiveTab('hoje');
    }
  };

  const handleDismissDiagnosticInvitation = () => {
    sessionStorage.setItem('juju_diag_invitation_dismissed', 'true');
    setShowDiagnosticInvitation(false);
  };

  const handleAcceptDiagnosticInvitation = () => {
    setShowDiagnosticInvitation(false);
    setShowDiagnostic(true);
  };

  return (
    <div className={`min-h-screen flex text-slate-100 ${darkMode ? 'bg-slate-950' : 'bg-slate-900'} antialiased font-sans`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenDiagnostic={() => setShowDiagnostic(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {activeTab === 'hoje' && (
          <TodayView
            user={user}
            setUser={setUser}
            tasks={tasks}
            setTasks={setTasks}
            subjects={subjects}
            topics={topics}
            errors={errors}
            onStartSession={handleStartSession}
            onCreatePodcast={handleCreatePodcast}
            onOpenDiagnostic={() => setShowDiagnostic(true)}
            onOpenReviewRecommendation={(reviewId) => {
              setFocusedEfficiencyReviewId(reviewId);
              setActiveTab('revisoes');
            }}
          />
        )}

        {activeTab === 'plano' && (
          <PlannerView
            user={user}
            tasks={tasks}
            setTasks={setTasks}
            subjects={subjects}
            topics={topics}
          />
        )}

        {activeTab === 'estudar' && (
          <StudySessionView
            currentTask={activeTaskForSession}
            subjects={subjects}
            onCompleteSession={handleCompleteSession}
            onCancelSession={() => {
              setActiveTaskForSession(null);
              setActiveTab('hoje');
            }}
          />
        )}

        {activeTab === 'questoes' && (
          <QuestionsView
            user={user}
            subjects={subjects}
            topics={topics}
            reviewContext={reviewQuestionContext}
            onReviewContextConsumed={() => setReviewQuestionContext(null)}
            onReturnToReviews={() => setActiveTab('revisoes')}
            onOpenErrorNotebookWithError={(errorData) => {
              setErrorDraft({
                questionTitle: errorData.title,
                subjectId: errorData.subjectId,
                topicId: errorData.topicId || '',
                studentReasoning: errorData.reasoning,
                questionId: errorData.questionId,
                attemptId: errorData.attemptId,
                confidenceAtAttempt: errorData.confidence,
                reflectionTag: errorData.reflectionTag,
              });
              setActiveTab('erros');
            }}
          />
        )}

        {activeTab === 'revisoes' && (
          <ReviewsView
            user={user}
            subjects={subjects}
            topics={topics}
            errors={errors}
            focusReviewId={focusedEfficiencyReviewId}
            onFocusReviewConsumed={() => setFocusedEfficiencyReviewId(null)}
            onNavigateTab={setActiveTab}
            onOpenQuestionsFromReview={(context) => {
              setReviewQuestionContext(context);
              setActiveTab('questoes');
            }}
            onOpenErrorFromReview={(errorId) => {
              setFocusedReviewErrorId(errorId);
              setActiveTab('erros');
            }}
          />
        )}

        {activeTab === 'erros' && (
          <ErrorNotebookView
            errors={errors}
            setErrors={setErrors}
            subjects={subjects}
            topics={topics}
            draftError={errorDraft}
            onClearDraftError={() => setErrorDraft(null)}
            focusErrorId={focusedReviewErrorId}
            onFocusErrorConsumed={() => setFocusedReviewErrorId(null)}
            onReturnToReviews={() => setActiveTab('revisoes')}
          />
        )}

        {activeTab === 'podcast' && (
          <PodcastView
            podcasts={podcasts}
            setPodcasts={setPodcasts}
            subjects={subjects}
            topics={topics}
          />
        )}

        {activeTab === 'aprender' && (
          <TutorView
            subjects={subjects}
            topics={topics}
          />
        )}

        {activeTab === 'laboratorio' && (
          <MethodLabView
            experiments={experiments}
            setExperiments={setExperiments}
            discoveries={discoveries}
          />
        )}

        {activeTab === 'evolucao' && (
          <EvolutionView
            user={user}
            subjects={subjects}
            topics={topics}
          />
        )}

        {activeTab === 'conexoes' && (
          <ConnectionsView
            integrations={integrations}
            setIntegrations={setIntegrations}
            onStudyMaterial={handleStudyMaterial}
          />
        )}

        {activeTab === 'perfil' && (
          <ProfileView
            user={user}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onOpenOnboarding={() => setShowOnboarding(true)}
            onOpenDiagnostic={() => setShowDiagnostic(true)}
            onNavigateTab={setActiveTab}
          />
        )}
      </main>

      {/* Mobile Primary Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Onboarding Diagnostic Modal */}
      {showOnboarding && (
        <OnboardingModal
          user={user}
          setUser={setUser}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {/* Adaptive Diagnostic Invitation Modal */}
      {showDiagnosticInvitation && (
        <DiagnosticInvitationModal
          onStartNow={handleAcceptDiagnosticInvitation}
          onDoLater={handleDismissDiagnosticInvitation}
        />
      )}

      {/* Adaptive Learning Diagnostic Modal (Rodada 1) */}
      {showDiagnostic && (
        <AdaptiveDiagnosticModal
          user={user}
          setUser={setUser}
          onClose={() => setShowDiagnostic(false)}
          onFinishDiagnostic={(diag: InitialLearningDiagnostic) => {
            setUser(prev => ({
              ...prev,
              diagnostic: diag,
            }));
          }}
        />
      )}
    </div>
  );
}

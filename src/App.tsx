import { AppShell } from "./components/AppShell";
import { Modal } from "./components/Modal";
import { LoadingScreen, Notice } from "./components/Status";
import { WorkoutDuration } from "./components/WorkoutDuration";
import { useAuth } from "./lib/AuthContext";
import { useHashRoute } from "./lib/useHashRoute";
import { useWorkoutData } from "./lib/useWorkoutData";
import { completedRepCount, completedSetCount, getCurrentExclusions } from "./lib/rules";
import { sessionTitle } from "./lib/format";
import { exerciseById } from "./programData";
import { AuthScreen } from "./screens/AuthScreen";
import { WorkoutScreen } from "./screens/WorkoutScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { ProgramsScreen } from "./screens/ProgramsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

export default function App() {
  const auth = useAuth();
  const { route, navigate } = useHashRoute();
  const data = useWorkoutData(auth.user?.id ?? null);

  if (auth.loading) return <LoadingScreen label="Checking your sign-in…" />;
  if (!auth.user) return <AuthScreen configured={auth.configured} onSendLink={auth.sendLink} />;

  const renderScreen = () => {
    if (data.loading) return <LoadingScreen />;
    switch (route) {
      case "workout":
        return (
          <WorkoutScreen
            userId={auth.user!.id}
            sessions={data.sessions}
            active={data.active}
            saveState={data.saveState}
            onStart={data.start}
            onUpdateActive={data.updateActive}
            onFinish={data.finish}
            onDiscard={data.discard}
          />
        );
      case "history":
        return <HistoryScreen sessions={data.sessions} onSave={data.savePastSession} onDelete={data.removePastSession} />;
      case "progress":
        return <ProgressScreen sessions={data.sessions} />;
      case "programs":
        return <ProgramsScreen />;
      case "settings":
        return <SettingsScreen email={auth.user!.email ?? "Signed-in user"} onSignOut={auth.signOut} />;
    }
  };

  const summary = data.lastCompleted;
  const exclusions = getCurrentExclusions(data.sessions);

  return (
    <AppShell route={route} navigate={navigate} activeWorkout={Boolean(data.active)}>
      {data.error && !data.loading ? (
        <Notice tone="error">
          <strong>Data connection issue.</strong> {data.error} <button className="inline-link" type="button" onClick={() => data.reload()}>Try again</button>
        </Notice>
      ) : null}
      {renderScreen()}

      {summary ? (
        <Modal
          title="Workout complete"
          onClose={() => data.setLastCompleted(null)}
          actions={<button type="button" className="primary-button" onClick={() => data.setLastCompleted(null)}>Done</button>}
        >
          <div className="completion-hero"><span aria-hidden="true">✓</span><div><strong>{sessionTitle(summary)}</strong><p>Your history and progress have been updated.</p></div></div>
          <div className="review-summary">
            <div><span>Sets</span><strong>{completedSetCount(summary)}</strong></div>
            <div><span>Reps</span><strong>{completedRepCount(summary)}</strong></div>
            <div><span>Substitutions</span><strong>{summary.substitutionsUsed ? "Yes" : "No"}</strong></div>
            <div><span>Duration</span><strong><WorkoutDuration seconds={summary.durationSeconds} /></strong></div>
          </div>
          <div className="completion-exclusions">
            <span>Excluded from your next completed workout</span>
            <div className="chip-list">
              {[...exclusions].map((id) => <span className={`exercise-chip ${exerciseById.get(id)?.category ?? ""}`} key={id}>{exerciseById.get(id)?.name}</span>)}
            </div>
          </div>
          <p className="muted">Your selected location and day have not changed.</p>
        </Modal>
      ) : null}
    </AppShell>
  );
}

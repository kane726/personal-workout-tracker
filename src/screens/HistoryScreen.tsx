import { useState } from "react";
import { WorkoutCalendar } from "../components/WorkoutCalendar";
import { EmptyState, Notice } from "../components/Status";
import { Modal } from "../components/Modal";
import { ExerciseDetails, ExerciseMeta } from "../components/ExerciseInfo";
import { SetEditor } from "../components/SetEditor";
import { exerciseById } from "../programData";
import { completedRepCount, completedSetCount, formatLoad } from "../lib/rules";
import { formatDate, formatDateTime, sessionTitle } from "../lib/format";
import type { SetLog, WorkoutSession } from "../types";

export function HistoryScreen({
  sessions,
  onSave,
  onDelete,
}: {
  sessions: WorkoutSession[];
  onSave: (session: WorkoutSession) => Promise<void>;
  onDelete: (session: WorkoutSession) => Promise<void>;
}) {
  const [selected, setSelected] = useState<WorkoutSession | null>(null);

  return (
    <div className="screen-stack">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Training log</p>
          <h1>Workout history</h1>
          <p>Open any completed session to review, correct, or delete its full record.</p>
        </div>
        <span className="heading-count">{sessions.length}<small>workouts</small></span>
      </header>

      {!sessions.length ? (
        <EmptyState title="No completed workouts" description="Your calendar and full workout records will appear here after you finish the first session." />
      ) : (
        <>
          <section className="panel calendar-panel">
            <div className="panel-heading"><h2>Workout calendar</h2><span>Completed dates</span></div>
            <WorkoutCalendar sessions={sessions} onOpen={setSelected} />
          </section>

          <section className="history-list-section">
            <div className="section-heading"><h2>All workouts</h2><span>Newest first</span></div>
            <div className="history-list">
              {sessions.map((session) => (
                <article className="history-card" key={session.id}>
                  <div className={`history-location ${session.location}`}><span>{session.location === "office" ? "▥" : "⌂"}</span></div>
                  <div className="history-copy">
                    <div className="history-title-row">
                      <div>
                        <span>{session.completedAt ? formatDate(session.completedAt) : "Unknown date"}</span>
                        <h3>{sessionTitle(session)}</h3>
                      </div>
                      {session.substitutionsUsed ? <span className="substitution-badge">Substitutions</span> : null}
                    </div>
                    <div className="history-metrics">
                      <span><strong>{completedSetCount(session)}</strong> sets</span>
                      <span><strong>{completedRepCount(session)}</strong> reps</span>
                      <span><strong>{session.exercises.filter((item) => item.setLogs.some((set) => set.completed)).length}</strong> exercises</span>
                    </div>
                    <div className="history-exercise-names">
                      {session.exercises.filter((item) => item.setLogs.some((set) => set.completed)).map((performed) => (
                        <span key={performed.id}>{exerciseById.get(performed.actualExerciseId)?.name}</span>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="secondary-button history-open" onClick={() => setSelected(session)}>Open record</button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {selected ? (
        <WorkoutRecord
          session={selected}
          onClose={() => setSelected(null)}
          onSave={async (updated) => {
            await onSave(updated);
            setSelected(updated);
          }}
          onDelete={async () => {
            await onDelete(selected);
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

function WorkoutRecord({
  session,
  onClose,
  onSave,
  onDelete,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onSave: (session: WorkoutSession) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => structuredClone(session));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSet = (performedId: string, next: SetLog) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((performed) =>
        performed.id === performedId
          ? { ...performed, setLogs: performed.setLogs.map((set) => set.id === next.id ? next : set) }
          : performed,
      ),
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const substitutionsUsed = draft.exercises.some((performed) => performed.actualExerciseId !== performed.scheduledExerciseId);
      const updated = { ...draft, substitutionsUsed };
      await onSave(updated);
      setDraft(updated);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The workout could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The workout could not be deleted.");
      setSaving(false);
    }
  };

  return (
    <Modal title={sessionTitle(session)} onClose={onClose}>
      <div className="record-header">
        <div>
          <span>Completed</span>
          <strong>{session.completedAt ? formatDateTime(session.completedAt) : "Unknown"}</strong>
        </div>
        <div className="record-header-actions">
          {editing ? (
            <>
              <button type="button" className="secondary-button" onClick={() => { setDraft(structuredClone(session)); setEditing(false); }}>Cancel edits</button>
              <button type="button" className="primary-button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save corrections"}</button>
            </>
          ) : (
            <button type="button" className="secondary-button" onClick={() => setEditing(true)}>Correct record</button>
          )}
        </div>
      </div>

      <div className="review-summary record-summary">
        <div><span>Sets</span><strong>{completedSetCount(draft)}</strong></div>
        <div><span>Reps</span><strong>{completedRepCount(draft)}</strong></div>
        <div><span>Substitutions</span><strong>{draft.substitutionsUsed ? "Yes" : "No"}</strong></div>
      </div>

      <div className="record-exercises">
        {draft.exercises.map((performed) => {
          const actual = exerciseById.get(performed.actualExerciseId)!;
          const scheduled = exerciseById.get(performed.scheduledExerciseId)!;
          return (
            <article className={`record-exercise category-border-${actual.category}`} key={performed.id}>
              <ExerciseMeta exercise={actual} />
              <h3>{performed.slotPosition}. {actual.name}</h3>
              {actual.id !== scheduled.id ? <p className="substitution-note">Replaced {scheduled.name}</p> : null}
              <ExerciseDetails exercise={actual} performed={performed} />
              {editing ? (
                <div className="record-set-editors">
                  {performed.setLogs.map((set) => <SetEditor key={set.id} set={set} performed={performed} exercise={actual} onChange={(next) => updateSet(performed.id, next)} />)}
                </div>
              ) : (
                <div className="record-set-table">
                  {performed.setLogs.map((set) => (
                    <div key={set.id} className={set.completed ? "" : "incomplete"}>
                      <strong>Set {set.setNumber}</strong>
                      <span>{formatLoad(set, actual.loadMode)}</span>
                      <span>{set.actualReps ?? "—"} reps</span>
                      <span>Effort {set.effort ?? "—"}</span>
                      {set.note ? <small>{set.note}</small> : null}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <label className="record-notes">
        <span>Workout notes</span>
        {editing ? <textarea rows={3} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /> : <p>{draft.notes || "No notes recorded."}</p>}
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="record-delete">
        {!confirmDelete ? (
          <button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}>Delete workout</button>
        ) : (
          <Notice tone="warning">
            <strong>Delete this workout permanently?</strong>
            <p>Progress, summaries, and the current exclusion state will be recalculated.</p>
            <div className="inline-actions">
              <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="danger-button" onClick={remove} disabled={saving}>{saving ? "Deleting…" : "Confirm delete"}</button>
            </div>
          </Notice>
        )}
      </div>
    </Modal>
  );
}

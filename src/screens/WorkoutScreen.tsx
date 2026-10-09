import { useEffect, useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { ExerciseDetails, ExerciseMeta, PreviousPerformance } from "../components/ExerciseInfo";
import { SetEditor } from "../components/SetEditor";
import { Notice } from "../components/Status";
import { OverallWorkoutTimer, SupersetRoundTimer, useWorkoutTimers } from "../components/WorkoutTimers";
import { categoryLabels, exerciseById, getTemplate } from "../programData";
import {
  completedRepCount,
  completedSetCount,
  createDraftSession,
  currentWeekSessions,
  getCurrentExclusions,
  getEligibleSubstitutions,
  getLoadFields,
  isValidSubstitution,
} from "../lib/rules";
import { formatDate, sessionTitle, titleCase } from "../lib/format";
import type { Location, SaveState, SetLog, WorkoutSession } from "../types";

const selectionKey = "personal-workout-selection";

function readSelection(): { location: Location; day: 1 | 2 | 3 } {
  try {
    const parsed = JSON.parse(localStorage.getItem(selectionKey) ?? "null");
    if ((parsed?.location === "office" || parsed?.location === "home") && [1, 2, 3].includes(parsed?.day)) {
      return parsed;
    }
  } catch {
    // Use the stable default below.
  }
  return { location: "office", day: 1 };
}

export function WorkoutScreen({
  userId,
  sessions,
  active,
  saveState,
  onStart,
  onUpdateActive,
  onFinish,
  onDiscard,
}: {
  userId: string;
  sessions: WorkoutSession[];
  active: WorkoutSession | null;
  saveState: SaveState;
  onStart: (session: WorkoutSession) => Promise<void>;
  onUpdateActive: (updater: (session: WorkoutSession) => WorkoutSession) => void;
  onFinish: () => Promise<WorkoutSession | null>;
  onDiscard: () => Promise<void>;
}) {
  if (active) {
    return (
      <ActiveWorkout
        session={active}
        history={sessions}
        exclusions={getCurrentExclusions(sessions)}
        saveState={saveState}
        onChange={onUpdateActive}
        onFinish={onFinish}
        onDiscard={onDiscard}
      />
    );
  }
  return <WorkoutDashboard userId={userId} sessions={sessions} onStart={onStart} />;
}

function WorkoutDashboard({
  userId,
  sessions,
  onStart,
}: {
  userId: string;
  sessions: WorkoutSession[];
  onStart: (session: WorkoutSession) => Promise<void>;
}) {
  const [selection, setSelection] = useState(readSelection);
  const [selectedByPosition, setSelectedByPosition] = useState<Record<number, string>>({});
  const [showFourthWarning, setShowFourthWarning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const template = getTemplate(selection.location, selection.day);
  const weekSessions = currentWeekSessions(sessions);
  const exclusions = useMemo(() => getCurrentExclusions(sessions), [sessions]);
  const recent = sessions[0] ?? null;

  useEffect(() => {
    localStorage.setItem(selectionKey, JSON.stringify(selection));
  }, [selection]);

  useEffect(() => {
    const initial: Record<number, string> = {};
    for (const slot of template.slots) {
      initial[slot.position] = exclusions.has(slot.scheduledExerciseId) ? "" : slot.scheduledExerciseId;
    }
    setSelectedByPosition(initial);
  }, [template.id, exclusions]);

  const selectedIds = Object.values(selectedByPosition).filter(Boolean);
  const missingReplacement = template.slots.some((slot) => !selectedByPosition[slot.position]);
  const duplicates = selectedIds.length !== new Set(selectedIds).size;

  const startWorkout = async (confirmedFourth = false) => {
    if (missingReplacement || duplicates) return;
    if (weekSessions.length >= 3 && !confirmedFourth) {
      setShowFourthWarning(true);
      return;
    }
    setShowFourthWarning(false);
    setStartError(null);
    setStarting(true);
    try {
      const draft = createDraftSession({ userId, template, selectedByPosition });
      await onStart(draft);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "The workout could not be started.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="screen-stack">
      <header className="screen-heading dashboard-heading">
        <div>
          <p className="eyebrow">This week</p>
          <h1>{weekSessions.length} of 3 workouts</h1>
          <p>Monday through Sunday · choose your location and day manually</p>
        </div>
        <div className={`week-ring ${weekSessions.length >= 3 ? "limit" : ""}`} aria-label={`${weekSessions.length} workouts completed this week`}>
          <strong>{weekSessions.length}</strong>
          <span>/ 3</span>
        </div>
      </header>

      {weekSessions.length >= 3 ? (
        <Notice tone="warning"><strong>Weekly target reached.</strong> You can still log another workout, but the app will require confirmation.</Notice>
      ) : null}

      <section className="dashboard-grid">
        <div className="panel selection-panel">
          <div className="panel-heading">
            <div>
              <span className="step-kicker">1</span>
              <h2>Choose location</h2>
            </div>
          </div>
          <div className="segmented location-options" role="group" aria-label="Workout location">
            {(["office", "home"] as const).map((location) => (
              <button
                type="button"
                key={location}
                className={selection.location === location ? "selected" : ""}
                onClick={() => setSelection((current) => ({ ...current, location }))}
                aria-pressed={selection.location === location}
              >
                <span aria-hidden="true">{location === "office" ? "▥" : "⌂"}</span>
                <strong>{titleCase(location)}</strong>
                <small>{location === "office" ? "Rack, cables, bench" : "Dumbbells and bands"}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel selection-panel">
          <div className="panel-heading">
            <div>
              <span className="step-kicker">2</span>
              <h2>Choose day</h2>
            </div>
            <span className="manual-label">Manual selection</span>
          </div>
          <div className="day-options" role="group" aria-label="Program day">
            {([1, 2, 3] as const).map((day) => (
              <button
                type="button"
                key={day}
                className={selection.day === day ? "selected" : ""}
                onClick={() => setSelection((current) => ({ ...current, day }))}
                aria-pressed={selection.day === day}
              >
                <span>Day</span>
                <strong>{day}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel exclusions-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Next-session exclusion</p>
            <h2>Currently unavailable</h2>
          </div>
          <span className="count-pill">{exclusions.size}</span>
        </div>
        {exclusions.size ? (
          <div className="chip-list">
            {[...exclusions].map((id) => (
              <span key={id} className={`exercise-chip ${exerciseById.get(id)?.category ?? ""}`}>
                {exerciseById.get(id)?.name ?? id}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">Complete a workout to create the next-session exclusion list.</p>
        )}
      </section>

      <section className="panel workout-preview">
        <div className="preview-top">
          <div>
            <p className="eyebrow">Workout preview</p>
            <h2>{titleCase(template.location)} · Day {template.day}</h2>
            <p><strong>Superset {template.firstSuperset} is performed first.</strong> Finish it before starting the second superset.</p>
          </div>
          <div className="preview-stats">
            <span><strong>4</strong> exercises</span>
            <span><strong>12</strong> working sets</span>
            <span><strong>≤60</strong> minutes</span>
          </div>
        </div>

        <div className="preview-exercises">
          {template.slots.map((slot) => {
            const scheduled = exerciseById.get(slot.scheduledExerciseId)!;
            const selectedId = selectedByPosition[slot.position] ?? "";
            const selected = exerciseById.get(selectedId);
            const unavailable = exclusions.has(scheduled.id);
            const otherSelected = selectedIds.filter((id) => id !== selectedId);
            const candidates = getEligibleSubstitutions({
              slot,
              location: template.location,
              selectedExerciseIds: otherSelected,
              excludedExerciseIds: exclusions,
            });
            return (
              <article key={slot.id} className={`preview-exercise category-border-${scheduled.category} ${unavailable && !selected ? "needs-replacement" : ""}`}>
                <div className="slot-order"><span>{slot.position}</span></div>
                <div className="preview-exercise-copy">
                  <div className="exercise-title-row">
                    <div>
                      <span className={`superset-label superset-${slot.superset.toLowerCase()}`}>Superset {slot.superset}</span>
                      <h3>{selected?.name ?? scheduled.name}</h3>
                    </div>
                    {unavailable ? <span className="unavailable-badge">Scheduled exercise unavailable</span> : null}
                  </div>
                  {selected && selected.id !== scheduled.id ? <p className="substitution-note">Replaces {scheduled.name} for this workout only.</p> : null}
                  <p className="target-line">3 sets · {slot.repMin}–{slot.repMax} reps{slot.perSide ? " per side" : ""} · {categoryLabels[scheduled.category]}</p>
                  <label className="substitution-select">
                    <span>{unavailable ? "Required replacement" : "Exercise for this slot"}</span>
                    <select
                      value={selectedId}
                      onChange={(event) =>
                        setSelectedByPosition((current) => ({ ...current, [slot.position]: event.target.value }))
                      }
                    >
                      {unavailable ? <option value="">Choose an eligible {categoryLabels[scheduled.category].toLowerCase()} exercise…</option> : null}
                      {!unavailable && !otherSelected.includes(scheduled.id) ? <option value={scheduled.id}>{scheduled.name} (scheduled)</option> : null}
                      {candidates
                        .filter((candidate) => candidate.id !== scheduled.id)
                        .map((candidate) => (
                          <option value={candidate.id} key={candidate.id}>
                            {candidate.name}{candidate.subtype && candidate.subtype === scheduled.subtype ? " · same subtype" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  {!selected && candidates.length === 0 ? <p className="field-error">No eligible substitution is available for this slot.</p> : null}
                </div>
              </article>
            );
          })}
        </div>

        {duplicates ? <Notice tone="error">Each exercise can appear only once in a workout. Choose a different substitute.</Notice> : null}
        {startError ? <Notice tone="error">{startError}</Notice> : null}
        <div className="preview-actions">
          <p>Weights are always your choice. Target effort is <strong>8–9</strong>.</p>
          <button className="primary-button start-button" type="button" onClick={() => startWorkout()} disabled={missingReplacement || duplicates || starting}>
            {starting ? "Starting…" : "Start workout"}
          </button>
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <h2>Most recent workout</h2>
          {recent?.completedAt ? <span>{formatDate(recent.completedAt)}</span> : null}
        </div>
        {recent ? (
          <div className="recent-row">
            <div><strong>{sessionTitle(recent)}</strong><span>{completedSetCount(recent)} sets · {completedRepCount(recent)} reps</span></div>
            <span>{recent.substitutionsUsed ? "Substitutions used" : "As programmed"}</span>
          </div>
        ) : (
          <p className="muted">No completed workout yet.</p>
        )}
      </section>

      {showFourthWarning ? (
        <Modal
          title="This would be workout 4 this week"
          onClose={() => setShowFourthWarning(false)}
          actions={
            <>
              <button className="secondary-button" type="button" onClick={() => setShowFourthWarning(false)}>Cancel</button>
              <button className="warning-button" type="button" onClick={() => startWorkout(true)} disabled={starting}>Start fourth workout</button>
            </>
          }
        >
          <Notice tone="warning">You have already completed {weekSessions.length} workouts since Monday. Confirm only if you deliberately want an additional session.</Notice>
        </Modal>
      ) : null}
    </div>
  );
}

function ActiveWorkout({
  session,
  history,
  exclusions,
  saveState,
  onChange,
  onFinish,
  onDiscard,
}: {
  session: WorkoutSession;
  history: WorkoutSession[];
  exclusions: Set<string>;
  saveState: SaveState;
  onChange: (updater: (session: WorkoutSession) => WorkoutSession) => void;
  onFinish: () => Promise<WorkoutSession | null>;
  onDiscard: () => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const completedSets = completedSetCount(session);
  const workoutTimers = useWorkoutTimers(session.id);
  const groups = useMemo(() => {
    const order = [session.exercises[0]?.superset, session.exercises.find((item) => item.superset !== session.exercises[0]?.superset)?.superset].filter(Boolean);
    return order.map((superset) => ({
      superset: superset as "A" | "B",
      exercises: session.exercises.filter((item) => item.superset === superset).sort((a, b) => a.slotPosition - b.slotPosition),
    }));
  }, [session.exercises]);

  const updateSet = (performedId: string, nextSet: SetLog) => {
    onChange((current) => ({
      ...current,
      exercises: current.exercises.map((performed) =>
        performed.id === performedId
          ? { ...performed, setLogs: performed.setLogs.map((set) => (set.id === nextSet.id ? nextSet : set)) }
          : performed,
      ),
    }));
  };

  const substitute = (performedId: string, nextExerciseId: string) => {
    onChange((current) => {
      const target = current.exercises.find((item) => item.id === performedId)!;
      const scheduled = exerciseById.get(target.scheduledExerciseId)!;
      const next = exerciseById.get(nextExerciseId)!;
      const selected = current.exercises.filter((item) => item.id !== performedId).map((item) => item.actualExerciseId);
      if (!isValidSubstitution({ scheduled, substitute: next, location: current.location, selectedExerciseIds: selected, excludedExerciseIds: exclusions })) {
        return current;
      }
      const exercises = current.exercises.map((item) => item.id === performedId ? { ...item, actualExerciseId: nextExerciseId } : item);
      return {
        ...current,
        substitutionsUsed: exercises.some((item) => item.actualExerciseId !== item.scheduledExerciseId),
        exercises,
      };
    });
  };

  const finish = async () => {
    setFinishing(true);
    setActionError(null);
    try {
      await onFinish();
      setReviewing(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The workout could not be finished.");
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    setFinishing(true);
    setActionError(null);
    try {
      await onDiscard();
      setDiscarding(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The draft could not be discarded.");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="screen-stack active-workout">
      <header className="active-header">
        <div>
          <p className="eyebrow">Active workout</p>
          <h1>{sessionTitle(session)}</h1>
          <p>Started {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(session.startedAt))}</p>
        </div>
        <div className="active-progress">
          <strong>{completedSets}<span>/12</span></strong>
          <small>sets complete</small>
        </div>
      </header>

      <div className={`save-status ${saveState}`} role="status">
        <span aria-hidden="true">{saveState === "saved" ? "✓" : saveState === "saving" ? "↻" : "!"}</span>
        {saveState === "saved" ? "Progress saved" : saveState === "saving" ? "Saving progress…" : saveState === "offline" ? "Saved on this device; waiting to sync" : "Sync problem; your device copy is safe"}
      </div>

      <OverallWorkoutTimer
        timerState={workoutTimers.timerState}
        nowMs={workoutTimers.nowMs}
        audioEnabled={workoutTimers.audioEnabled}
        onAudioChange={workoutTimers.setAudio}
        onStart={workoutTimers.startOverall}
        onPause={workoutTimers.pauseOverall}
        onResume={workoutTimers.resumeOverall}
      />

      <section className="effort-guide panel">
        <div><span>Normal target</span><strong>Effort 8–9</strong></div>
        <dl>
          <div><dt>8</dt><dd>About 2 good reps remained</dd></div>
          <div><dt>9</dt><dd>About 1 good rep remained</dd></div>
          <div><dt>10</dt><dd>Another clean rep was not possible</dd></div>
        </dl>
      </section>

      {groups.map((group, groupIndex) => (
        <section key={group.superset} className={`superset-panel superset-panel-${group.superset.toLowerCase()}`}>
          <div className="superset-heading">
            <div>
              <span>{groupIndex === 0 ? "Perform first" : "Perform second"}</span>
              <h2>Superset {group.superset}</h2>
            </div>
            <p>Alternate the two exercises each round.</p>
          </div>

          <div className="superset-exercise-intros">
            {group.exercises.map((performed) => {
              const actual = exerciseById.get(performed.actualExerciseId)!;
              const scheduled = exerciseById.get(performed.scheduledExerciseId)!;
              const hasCompletedSet = performed.setLogs.some((set) => set.completed);
              const selectedIds = session.exercises.filter((item) => item.id !== performed.id).map((item) => item.actualExerciseId);
              const candidates = getEligibleSubstitutions({
                slot: {
                  id: performed.id,
                  position: performed.slotPosition,
                  superset: performed.superset,
                  scheduledExerciseId: performed.scheduledExerciseId,
                  sets: 3,
                  repMin: performed.repMin,
                  repMax: performed.repMax,
                  perSide: performed.perSide,
                },
                location: session.location,
                selectedExerciseIds: selectedIds,
                excludedExerciseIds: exclusions,
              });
              return (
                <article className={`active-exercise-card category-border-${actual.category}`} key={performed.id}>
                  <div className="exercise-title-row">
                    <div>
                      <ExerciseMeta exercise={actual} />
                      <h3>{performed.slotPosition}. {actual.name}</h3>
                    </div>
                    <span className={exclusions.has(scheduled.id) ? "unavailable-badge" : "eligible-badge"}>
                      {exclusions.has(scheduled.id) ? "Scheduled exercise excluded" : "Eligible"}
                    </span>
                  </div>
                  {actual.id !== scheduled.id ? <p className="substitution-note">Substitution for {scheduled.name}. The original program is unchanged.</p> : null}
                  <PreviousPerformance exercise={actual} history={history} />
                  <ExerciseDetails exercise={actual} performed={performed} />
                  <label className="substitution-select active-substitution">
                    <span>Substitution {hasCompletedSet ? "locked after first completed set" : "for this workout only"}</span>
                    <select value={actual.id} disabled={hasCompletedSet} onChange={(event) => substitute(performed.id, event.target.value)}>
                      {candidates.concat(candidates.some((item) => item.id === actual.id) ? [] : [actual]).map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                      ))}
                    </select>
                  </label>
                </article>
              );
            })}
          </div>

          <div className="rounds">
            {([0, 1, 2] as const).map((roundIndex) => (
              <div className="round" key={roundIndex}>
                <div className="round-title"><span>Round {roundIndex + 1}</span><small>{group.exercises[0]?.slotPosition} then {group.exercises[1]?.slotPosition}</small></div>
                {group.exercises.map((performed, exerciseIndex) => {
                  const actual = exerciseById.get(performed.actualExerciseId)!;
                  const set = performed.setLogs[roundIndex];
                  return (
                    <div className="round-exercise-group" key={performed.id}>
                      <div className="round-exercise">
                        <h4><span>{performed.slotPosition}</span>{actual.name}</h4>
                        <SetEditor set={set} performed={performed} exercise={actual} onChange={(next) => updateSet(performed.id, next)} />
                      </div>
                      {exerciseIndex === 0 ? (
                        <SupersetRoundTimer
                          superset={group.superset}
                          roundIndex={roundIndex}
                          activeTimer={workoutTimers.timerState.superset}
                          nowMs={workoutTimers.nowMs}
                          secondExerciseCompleted={Boolean(group.exercises[1]?.setLogs[roundIndex]?.completed)}
                          audioEnabled={workoutTimers.audioEnabled}
                          onStart={() => workoutTimers.startSuperset(group.superset, roundIndex)}
                          onClear={workoutTimers.clearSuperset}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="panel workout-notes">
        <label>
          <span>Overall workout notes <i>optional</i></span>
          <textarea
            rows={4}
            value={session.notes}
            onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
            placeholder="How the workout felt, setup changes, anything to remember…"
          />
        </label>
      </section>

      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      <div className="finish-bar">
        <button className="text-button danger-text" type="button" onClick={() => setDiscarding(true)}>Discard workout</button>
        <div>
          <span>{completedSets} of 12 sets completed</span>
          <button className="primary-button" type="button" onClick={() => setReviewing(true)} disabled={completedSets === 0}>Review workout</button>
        </div>
      </div>

      {reviewing ? (
        <Modal
          title="Review workout"
          onClose={() => setReviewing(false)}
          actions={
            <>
              <button className="secondary-button" type="button" onClick={() => setReviewing(false)}>Keep editing</button>
              <button className="primary-button" type="button" onClick={finish} disabled={finishing}>{finishing ? "Finishing…" : "Finish workout"}</button>
            </>
          }
        >
          <div className="review-summary">
            <div><span>Completed sets</span><strong>{completedSets} / 12</strong></div>
            <div><span>Total reps</span><strong>{completedRepCount(session)}</strong></div>
            <div><span>Exercises performed</span><strong>{session.exercises.filter((item) => item.setLogs.some((set) => set.completed)).length}</strong></div>
          </div>
          {completedSets < 12 ? <Notice tone="warning">This record contains {12 - completedSets} incomplete set{12 - completedSets === 1 ? "" : "s"}. Only exercises with at least one completed set will be excluded next time.</Notice> : null}
          <ol className="review-list">
            {session.exercises.map((performed) => (
              <li key={performed.id}>
                <span>{exerciseById.get(performed.actualExerciseId)?.name}</span>
                <strong>{performed.setLogs.filter((set) => set.completed).length}/3 sets</strong>
              </li>
            ))}
          </ol>
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        </Modal>
      ) : null}

      {discarding ? (
        <Modal
          title="Discard active workout?"
          onClose={() => setDiscarding(false)}
          actions={
            <>
              <button className="secondary-button" type="button" onClick={() => setDiscarding(false)}>Keep workout</button>
              <button className="danger-button" type="button" onClick={discard} disabled={finishing}>{finishing ? "Discarding…" : "Discard permanently"}</button>
            </>
          }
        >
          <p>This removes the draft and its set entries. It will not change the current exercise exclusions.</p>
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        </Modal>
      ) : null}
    </div>
  );
}

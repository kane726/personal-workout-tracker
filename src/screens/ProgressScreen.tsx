import { useMemo, useState } from "react";
import { EmptyState } from "../components/Status";
import { MiniLineChart } from "../components/MiniLineChart";
import { categoryLabels, exerciseById } from "../programData";
import {
  currentMonthSessions,
  currentWeekSessions,
  formatLoad,
  summarizeSessions,
} from "../lib/rules";
import { formatNumber, formatShortDate, sessionTitle } from "../lib/format";
import type { Exercise, PerformedExercise, SetLog, WorkoutSession } from "../types";

interface PerformanceSet {
  session: WorkoutSession;
  performed: PerformedExercise;
  set: SetLog;
}

function allSetsForExercise(sessions: WorkoutSession[], exerciseId: string) {
  return sessions
    .flatMap((session) =>
      session.exercises
        .filter((performed) => performed.actualExerciseId === exerciseId)
        .flatMap((performed) => performed.setLogs.filter((set) => set.completed).map((set) => ({ session, performed, set }))),
    )
    .sort((a, b) => Date.parse(a.session.completedAt ?? a.session.startedAt) - Date.parse(b.session.completedAt ?? b.session.startedAt));
}

function loadValue(item: PerformanceSet, exercise: Exercise) {
  if (exercise.loadMode === "band") return item.set.estimatedResistanceLbs;
  if (exercise.loadMode === "bodyweight") return null;
  return item.set.loadValue;
}

function bestTargetSet(items: PerformanceSet[], exercise: Exercise) {
  const inRange = items.filter((item) => {
    const reps = item.set.actualReps;
    return reps !== null && reps >= item.performed.repMin && reps <= item.performed.repMax;
  });
  return inRange.sort((a, b) => {
    const loadDifference = (loadValue(b, exercise) ?? 0) - (loadValue(a, exercise) ?? 0);
    return loadDifference || (b.set.actualReps ?? 0) - (a.set.actualReps ?? 0);
  })[0] ?? null;
}

export function ProgressScreen({ sessions }: { sessions: WorkoutSession[] }) {
  const performedIds = useMemo(
    () => [...new Set(sessions.flatMap((session) => session.exercises.filter((performed) => performed.setLogs.some((set) => set.completed)).map((performed) => performed.actualExerciseId)))],
    [sessions],
  );
  const [selectedId, setSelectedId] = useState<string>(performedIds[0] ?? "");
  const effectiveSelectedId = performedIds.includes(selectedId) ? selectedId : performedIds[0] ?? "";
  const selectedExercise = exerciseById.get(effectiveSelectedId) ?? null;
  const weekSummary = summarizeSessions(currentWeekSessions(sessions));
  const monthSummary = summarizeSessions(currentMonthSessions(sessions));

  return (
    <div className="screen-stack">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Trends and records</p>
          <h1>Progress</h1>
          <p>Compare like-for-like sets without combining incompatible load types.</p>
        </div>
      </header>

      <section className="summary-split">
        <SummaryPanel title="This week" summary={weekSummary} />
        <SummaryPanel title="This month" summary={monthSummary} />
      </section>

      {!performedIds.length || !selectedExercise ? (
        <EmptyState title="No exercise progress yet" description="Complete at least one set in a finished workout to start exercise charts and personal records." />
      ) : (
        <>
          <section className="panel exercise-picker-panel">
            <label>
              <span>Exercise</span>
              <select value={effectiveSelectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {performedIds
                  .map((id) => exerciseById.get(id))
                  .filter(Boolean)
                  .sort((a, b) => a!.name.localeCompare(b!.name))
                  .map((exercise) => <option key={exercise!.id} value={exercise!.id}>{exercise!.name}</option>)}
              </select>
            </label>
          </section>
          <ExerciseProgress exercise={selectedExercise} sessions={sessions} />
        </>
      )}
    </div>
  );
}

function SummaryPanel({ title, summary }: { title: string; summary: ReturnType<typeof summarizeSessions> }) {
  return (
    <section className="panel summary-panel">
      <div className="panel-heading"><h2>{title}</h2><span>{summary.office} office · {summary.home} home</span></div>
      <div className="summary-metrics">
        <div><strong>{summary.workouts}</strong><span>Workouts</span></div>
        <div><strong>{summary.sets}</strong><span>Sets</span></div>
        <div><strong>{summary.reps}</strong><span>Reps</span></div>
        <div><strong>{formatNumber(summary.averageEffort)}</strong><span>Avg effort</span></div>
      </div>
      <div className="frequent-list">
        <span>Most performed</span>
        {summary.frequentExercises.length ? summary.frequentExercises.slice(0, 3).map((item) => (
          <p key={item.exerciseId}>{exerciseById.get(item.exerciseId)?.name}<strong>{item.count}×</strong></p>
        )) : <p className="muted">No completed exercises.</p>}
      </div>
    </section>
  );
}

function ExerciseProgress({ exercise, sessions }: { exercise: Exercise; sessions: WorkoutSession[] }) {
  const items = allSetsForExercise(sessions, exercise.id);
  const descending = [...items].reverse();
  const last = descending[0] ?? null;
  const heaviest = items.reduce<PerformanceSet | null>((best, item) => {
    if (!best) return item;
    return (loadValue(item, exercise) ?? -1) > (loadValue(best, exercise) ?? -1) ? item : best;
  }, null);
  const mostReps = items.reduce<PerformanceSet | null>((best, item) => !best || (item.set.actualReps ?? 0) > (best.set.actualReps ?? 0) ? item : best, null);
  const targetBest = bestTargetSet(items, exercise);
  const loadPoints = items.flatMap((item) => {
    const value = loadValue(item, exercise);
    return value === null ? [] : [{ value, label: formatShortDate(item.session.completedAt ?? item.session.startedAt) }];
  });
  const repPoints = items.flatMap((item) => item.set.actualReps === null ? [] : [{ value: item.set.actualReps, label: formatShortDate(item.session.completedAt ?? item.session.startedAt) }]);
  const effortPoints = items.flatMap((item) => item.set.effort === null ? [] : [{ value: item.set.effort, label: formatShortDate(item.session.completedAt ?? item.session.startedAt) }]);
  const loadRecordLabel = exercise.loadMode === "band" ? "Highest estimated resistance" : exercise.loadMode === "bodyweight" ? null : "Heaviest recorded load";

  return (
    <>
      <section className={`progress-hero category-border-${exercise.category}`}>
        <div>
          <span className={`category-chip ${exercise.category}`}>{categoryLabels[exercise.category]}</span>
          <h2>{exercise.name}</h2>
          <p>{exercise.equipment.join(" · ")}</p>
        </div>
        <div className="last-performance-card">
          <span>Last performance</span>
          {last ? (
            <>
              <strong>{formatLoad(last.set, exercise.loadMode)} × {last.set.actualReps}</strong>
              <small>Effort {last.set.effort} · {last.session.completedAt ? formatShortDate(last.session.completedAt) : ""} · {sessionTitle(last.session)}</small>
            </>
          ) : <strong>—</strong>}
        </div>
      </section>

      <section className="records-grid">
        {loadRecordLabel ? (
          <RecordCard label={loadRecordLabel} value={heaviest ? formatLoad(heaviest.set, exercise.loadMode) : "—"} detail={heaviest ? `${heaviest.set.actualReps} reps @ ${heaviest.set.effort}` : "No record"} />
        ) : null}
        <RecordCard label="Most completed reps" value={mostReps?.set.actualReps?.toString() ?? "—"} detail={mostReps ? `${formatLoad(mostReps.set, exercise.loadMode)} @ ${mostReps.set.effort}` : "No record"} />
        <RecordCard label="Best set in target range" value={targetBest ? `${targetBest.set.actualReps} reps` : "—"} detail={targetBest ? `${formatLoad(targetBest.set, exercise.loadMode)} @ ${targetBest.set.effort}` : "No target-range set"} />
      </section>

      <section className="chart-grid">
        {exercise.loadMode !== "bodyweight" ? (
          <MiniLineChart title={exercise.loadMode === "band" ? "Estimated resistance progression" : "Load progression"} values={loadPoints} format={(value) => `${value} lb`} tone="gold" />
        ) : null}
        <MiniLineChart title="Rep progression" values={repPoints} format={(value) => `${value} reps`} tone="blue" />
        <MiniLineChart title="Effort progression" values={effortPoints} format={(value) => `${value}/10`} tone="coral" />
      </section>

      <section className="panel set-history-panel">
        <div className="panel-heading"><h2>Full set history</h2><span>{items.length} completed sets</span></div>
        <div className="set-history-table" role="table" aria-label={`${exercise.name} set history`}>
          <div className="set-history-head" role="row">
            <span>Date</span><span>Workout</span><span>Set</span><span>Load</span><span>Reps</span><span>Effort</span>
          </div>
          {descending.map((item) => {
            const inTarget = item.set.actualReps !== null && item.set.actualReps >= item.performed.repMin && item.set.actualReps <= item.performed.repMax;
            return (
              <div className="set-history-row" role="row" key={item.set.id}>
                <span data-label="Date">{item.session.completedAt ? formatShortDate(item.session.completedAt) : "—"}</span>
                <span data-label="Workout">{sessionTitle(item.session)}</span>
                <span data-label="Set">{item.set.setNumber}</span>
                <span data-label="Load">{formatLoad(item.set, exercise.loadMode)}</span>
                <span data-label="Reps" className={inTarget ? "target-hit" : "target-miss"}>{item.set.actualReps} <small>target {item.performed.repMin}–{item.performed.repMax}</small></span>
                <span data-label="Effort">{item.set.effort}/10</span>
                {item.set.note ? <small className="history-note">{item.set.note}</small> : null}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function RecordCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="record-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

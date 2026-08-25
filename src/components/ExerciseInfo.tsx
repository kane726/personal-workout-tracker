import { categoryLabels, subtypeLabels } from "../programData";
import type { Exercise, PerformedExercise, WorkoutSession } from "../types";
import { formatLoad } from "../lib/rules";

export function ExerciseMeta({ exercise }: { exercise: Exercise }) {
  return (
    <div className="exercise-meta">
      <span className={`category-chip ${exercise.category}`}>{categoryLabels[exercise.category]}</span>
      {exercise.subtype ? <span className="subtype-chip">{subtypeLabels[exercise.subtype]}</span> : null}
    </div>
  );
}

export function PreviousPerformance({
  exercise,
  history,
}: {
  exercise: Exercise;
  history: WorkoutSession[];
}) {
  const previous = history
    .filter((session) => session.status === "completed")
    .flatMap((session) =>
      session.exercises
        .filter((performed) => performed.actualExerciseId === exercise.id)
        .map((performed) => ({ session, performed })),
    )
    .sort((a, b) => Date.parse(b.session.completedAt ?? "") - Date.parse(a.session.completedAt ?? ""))[0];

  if (!previous) return <p className="previous-line">No previous performance recorded.</p>;
  const sets = previous.performed.setLogs.filter((set) => set.completed);
  if (!sets.length) return <p className="previous-line">No completed sets in the previous entry.</p>;
  return (
    <div className="previous-block">
      <span>Previous</span>
      <p>
        {sets.map((set) => `${formatLoad(set, exercise.loadMode)} × ${set.actualReps ?? "—"} @ ${set.effort ?? "—"}`).join(" · ")}
      </p>
    </div>
  );
}

export function ExerciseDetails({ exercise, performed }: { exercise: Exercise; performed: PerformedExercise }) {
  return (
    <div className="exercise-details">
      <div>
        <span>Equipment</span>
        <p>{exercise.equipment.join(" · ")}</p>
      </div>
      <div>
        <span>Target</span>
        <p>3 sets × {performed.repMin}–{performed.repMax}{performed.perSide ? " per side" : ""}</p>
      </div>
      <div className="detail-wide">
        <span>Form cue</span>
        <p>{exercise.instructions}</p>
      </div>
      <div className="detail-wide">
        <span>Demonstration</span>
        {exercise.demonstrationUrl ? (
          <a href={exercise.demonstrationUrl} target="_blank" rel="noreferrer">Open demonstration</a>
        ) : (
          <p>Demonstration link not added.</p>
        )}
      </div>
    </div>
  );
}

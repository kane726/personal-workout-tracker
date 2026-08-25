import { getLoadFields, repsOutsideTarget, setHasRequiredData } from "../lib/rules";
import type { Exercise, PerformedExercise, SetLog } from "../types";

function numericValue(value: string) {
  return value === "" ? null : Number(value);
}

function integerValue(value: string) {
  return value === "" ? null : Math.trunc(Number(value));
}

export function SetEditor({
  set,
  performed,
  exercise,
  onChange,
  readOnly = false,
}: {
  set: SetLog;
  performed: PerformedExercise;
  exercise: Exercise;
  onChange: (next: SetLog) => void;
  readOnly?: boolean;
}) {
  const fields = getLoadFields(exercise.loadMode);
  const outsideTarget = repsOutsideTarget(set, performed);
  const ready = setHasRequiredData(set, exercise.loadMode);
  const update = <K extends keyof SetLog>(key: K, value: SetLog[K]) => {
    const next = { ...set, [key]: value };
    if (key !== "completed" && next.completed && !setHasRequiredData(next, exercise.loadMode)) {
      next.completed = false;
    }
    onChange(next);
  };

  return (
    <div className={`set-editor ${set.completed ? "complete" : ""}`}>
      <div className="set-number">
        <span>Set</span>
        <strong>{set.setNumber}</strong>
      </div>

      {fields.map((field) => (
        <label key={field.key} className={field.key === "bandDescription" ? "field-wide" : ""}>
          <span>{field.label}</span>
          <input
            type={field.inputMode === "text" ? "text" : "number"}
            inputMode={field.inputMode}
            min={field.inputMode === "decimal" ? 0 : undefined}
            step={field.inputMode === "decimal" ? "any" : undefined}
            value={set[field.key] ?? ""}
            onChange={(event) =>
              update(
                field.key,
                (field.inputMode === "text" ? event.target.value : numericValue(event.target.value)) as never,
              )
            }
            disabled={readOnly}
          />
        </label>
      ))}

      <label className={outsideTarget ? "field-alert" : ""}>
        <span>Actual reps</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={set.actualReps ?? ""}
          onChange={(event) => update("actualReps", integerValue(event.target.value))}
          disabled={readOnly}
          aria-describedby={outsideTarget ? `${set.id}-reps-note` : undefined}
        />
        {outsideTarget ? <small id={`${set.id}-reps-note`}>Outside {performed.repMin}–{performed.repMax}</small> : null}
      </label>

      <label>
        <span>Effort (1–10)</span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="10"
          step="1"
          value={set.effort ?? ""}
          onChange={(event) => update("effort", integerValue(event.target.value))}
          disabled={readOnly}
        />
      </label>

      <label className="field-wide">
        <span>Set note <i>optional</i></span>
        <input
          type="text"
          value={set.note}
          onChange={(event) => update("note", event.target.value)}
          placeholder="Grip, tempo, setup…"
          disabled={readOnly}
        />
      </label>

      <label className={`complete-control ${!ready && !set.completed ? "not-ready" : ""}`}>
        <input
          type="checkbox"
          checked={set.completed}
          onChange={(event) => update("completed", event.target.checked && ready)}
          disabled={readOnly || (!ready && !set.completed)}
        />
        <span>{set.completed ? "Completed" : ready ? "Mark complete" : "Enter set data"}</span>
      </label>
    </div>
  );
}

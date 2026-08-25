import { useState } from "react";
import { ExerciseMeta } from "../components/ExerciseInfo";
import { categoryLabels, exerciseById, exercises, templates } from "../programData";
import { getLoadFields } from "../lib/rules";
import { titleCase } from "../lib/format";
import type { Category, Location } from "../types";

const categories: Category[] = ["squat", "pull", "hamstring", "push"];

export function ProgramsScreen() {
  const [location, setLocation] = useState<Location>("office");
  const locationTemplates = templates.filter((template) => template.location === location);

  return (
    <div className="screen-stack">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Fixed plan</p>
          <h1>Programs</h1>
          <p>Six approved workouts. Substitutions affect one session only and never change these templates.</p>
        </div>
      </header>

      <div className="segmented program-tabs" role="group" aria-label="Program location">
        {(["office", "home"] as const).map((item) => (
          <button type="button" key={item} className={location === item ? "selected" : ""} onClick={() => setLocation(item)} aria-pressed={location === item}>
            {titleCase(item)} program
          </button>
        ))}
      </div>

      <div className="program-list">
        {locationTemplates.map((template) => {
          const orderedSupersets = [template.firstSuperset, template.firstSuperset === "A" ? "B" : "A"] as const;
          return (
            <section className="panel program-card" key={template.id}>
              <div className="program-card-heading">
                <div><span>{titleCase(location)}</span><h2>Day {template.day}</h2></div>
                <strong>Superset {template.firstSuperset} first</strong>
              </div>
              {orderedSupersets.map((superset, index) => (
                <div className={`program-superset superset-panel-${superset.toLowerCase()}`} key={superset}>
                  <div className="program-superset-heading"><strong>{index + 1}. Superset {superset}</strong><span>Alternate for 3 rounds</span></div>
                  {template.slots.filter((slot) => slot.superset === superset).map((slot) => {
                    const exercise = exerciseById.get(slot.scheduledExerciseId)!;
                    const loadFields = getLoadFields(exercise.loadMode);
                    return (
                      <article className="program-exercise" key={slot.id}>
                        <span className="program-position">{slot.position}</span>
                        <div>
                          <ExerciseMeta exercise={exercise} />
                          <h3>{exercise.name}</h3>
                          <p>3 sets × {slot.repMin}–{slot.repMax}{slot.perSide ? " per side" : ""}</p>
                          <small>{exercise.equipment.join(" · ")}</small>
                          <small>{loadFields.length ? `Log: ${loadFields.map((field) => field.label).join(" + ")}` : "Log: reps and effort only"}</small>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <section className="panel exercise-pool-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Eligible substitutions</p><h2>{titleCase(location)} exercise pool</h2></div>
          <span>{exercises.filter((exercise) => exercise.locations.includes(location)).length} exercises</span>
        </div>
        <p className="muted">The app offers the same subtype first, then other exercises in the required broad movement category.</p>
        <div className="pool-grid">
          {categories.map((category) => (
            <details key={category} className={`pool-category category-border-${category}`} open>
              <summary><span>{categoryLabels[category]}</span><strong>{exercises.filter((exercise) => exercise.category === category && exercise.locations.includes(location)).length}</strong></summary>
              <ul>
                {exercises.filter((exercise) => exercise.category === category && exercise.locations.includes(location)).map((exercise) => (
                  <li key={exercise.id}>
                    <div><strong>{exercise.name}</strong>{exercise.subtype ? <span>{titleCase(exercise.subtype)}</span> : null}</div>
                    <small>{exercise.equipment.join(" · ")}</small>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

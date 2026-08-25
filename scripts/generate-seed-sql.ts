import { exercises, templates } from "../src/programData.ts";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const textArray = (values: string[]) => `array[${values.map(quote).join(", ")}]::text[]`;

console.log("insert into public.exercises (id, name, category, subtype, locations, equipment, load_mode, instructions, demonstration_url) values");
console.log(
  exercises
    .map((exercise) =>
      `  (${[
        quote(exercise.id),
        quote(exercise.name),
        quote(exercise.category),
        exercise.subtype ? quote(exercise.subtype) : "null",
        textArray(exercise.locations),
        textArray(exercise.equipment),
        quote(exercise.loadMode),
        quote(exercise.instructions),
        exercise.demonstrationUrl ? quote(exercise.demonstrationUrl) : "null",
      ].join(", ")})`,
    )
    .join(",\n") + ";",
);

console.log("\ninsert into public.workout_templates (id, location, workout_day, first_superset) values");
console.log(
  templates
    .map((template) => `  (${quote(template.id)}, ${quote(template.location)}, ${template.day}, ${quote(template.firstSuperset)})`)
    .join(",\n") + ";",
);

console.log("\ninsert into public.workout_template_slots (id, template_id, slot_position, superset, scheduled_exercise_id, target_sets, rep_min, rep_max, per_side) values");
console.log(
  templates
    .flatMap((template) =>
      template.slots.map(
        (slot) =>
          `  (${quote(slot.id)}, ${quote(template.id)}, ${slot.position}, ${quote(slot.superset)}, ${quote(slot.scheduledExerciseId)}, ${slot.sets}, ${slot.repMin}, ${slot.repMax}, ${slot.perSide})`,
      ),
    )
    .join(",\n") + ";",
);

console.log("\ncommit;");

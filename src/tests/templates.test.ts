import test from "node:test";
import assert from "node:assert/strict";
import { exerciseById, templates } from "../programData.ts";

const expected = {
  "office-day-1": [
    ["Double-dumbbell front squat", "A", 6, 8],
    ["Kneeling cable lat pulldown", "A", 8, 10],
    ["Standing single-leg cable hamstring curl", "B", 10, 12],
    ["Barbell bench press", "B", 10, 12],
  ],
  "office-day-2": [
    ["Dumbbell Romanian deadlift", "B", 6, 8],
    ["Seated dumbbell shoulder press", "B", 8, 10],
    ["Dumbbell Bulgarian split squat", "A", 10, 12],
    ["Chest-supported dumbbell row", "A", 10, 12],
  ],
  "office-day-3": [
    ["Heel-elevated dumbbell squat", "A", 6, 8],
    ["Straight-arm cable pulldown", "A", 8, 10],
    ["Single-leg dumbbell Romanian deadlift", "B", 10, 12],
    ["Incline dumbbell bench press", "B", 10, 12],
  ],
  "home-day-1": [
    ["Dumbbell goblet squat", "A", 6, 8],
    ["Kneeling two-arm band lat pulldown", "A", 8, 10],
    ["Prone band hamstring curl on the floor", "B", 10, 12],
    ["Dumbbell floor press", "B", 10, 12],
  ],
  "home-day-2": [
    ["B-stance dumbbell Romanian deadlift", "B", 6, 8],
    ["Standing dumbbell overhead press", "B", 8, 10],
    ["Band-resisted squat", "A", 10, 12],
    ["One-arm dumbbell row braced against the thigh", "A", 10, 12],
  ],
  "home-day-3": [
    ["Dumbbell split squat with both feet on the floor", "A", 6, 8],
    ["Straight-arm band pulldown", "A", 8, 10],
    ["Seated single-leg band hamstring curl from the floor", "B", 10, 12],
    ["Standing band chest press", "B", 10, 12],
  ],
} as const;

test("the six approved templates have the exact order, supersets, sets, and reps", () => {
  assert.equal(templates.length, 6);
  for (const template of templates) {
    assert.equal(template.slots.length, 4);
    const rendered = template.slots.map((slot) => [
      exerciseById.get(slot.scheduledExerciseId)?.name,
      slot.superset,
      slot.repMin,
      slot.repMax,
    ]);
    assert.deepEqual(rendered, expected[template.id as keyof typeof expected]);
    assert.ok(template.slots.every((slot) => slot.sets === 3));
    assert.equal(template.slots[0].superset, template.firstSuperset);
    assert.equal(template.slots[1].superset, template.firstSuperset);
  }
});

test("all template exercises exist and are compatible with their location", () => {
  for (const template of templates) {
    for (const slot of template.slots) {
      const exercise = exerciseById.get(slot.scheduledExerciseId);
      assert.ok(exercise, `${slot.scheduledExerciseId} must exist`);
      assert.ok(exercise!.locations.includes(template.location), `${exercise!.name} must support ${template.location}`);
    }
  }
});

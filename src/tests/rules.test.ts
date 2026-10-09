import test from "node:test";
import assert from "node:assert/strict";
import { exerciseById, getTemplate } from "../programData.ts";
import {
  getCurrentExclusions,
  getEligibleSubstitutions,
  getLoadFields,
  getRouteFromHash,
  inheritSlot,
  isValidSubstitution,
} from "../lib/rules.ts";
import type { PerformedExercise, WorkoutSession } from "../types.ts";

function performed(actualExerciseId: string, completed = true): PerformedExercise {
  return {
    id: crypto.randomUUID(),
    scheduledExerciseId: actualExerciseId,
    actualExerciseId,
    slotPosition: 1,
    superset: "A",
    sets: 3,
    repMin: 6,
    repMax: 8,
    perSide: false,
    setLogs: [1, 2, 3].map((setNumber) => ({
      id: crypto.randomUUID(),
      setNumber: setNumber as 1 | 2 | 3,
      actualReps: completed && setNumber === 1 ? 8 : null,
      effort: completed && setNumber === 1 ? 8 : null,
      completed: completed && setNumber === 1,
      note: "",
      loadValue: completed && setNumber === 1 ? 30 : null,
      bandDescription: "",
      estimatedResistanceLbs: null,
      weightUnit: "lb",
    })),
  };
}

function session(args: {
  id: string;
  status: "draft" | "completed";
  completedAt: string | null;
  location: "office" | "home";
  exerciseId: string;
}): WorkoutSession {
  return {
    id: args.id,
    userId: "user-a",
    templateId: `${args.location}-day-1`,
    location: args.location,
    workoutDay: 1,
    status: args.status,
    startedAt: "2026-08-20T12:00:00.000Z",
    completedAt: args.completedAt,
    durationSeconds: null,
    notes: "",
    substitutionsUsed: false,
    exercises: [performed(args.exerciseId)],
  };
}

test("exercise exclusion uses the most recent completed workout across both locations", () => {
  const sessions = [
    session({ id: "office-old", status: "completed", completedAt: "2026-08-20T12:00:00.000Z", location: "office", exerciseId: "barbell-bench-press" }),
    session({ id: "home-new", status: "completed", completedAt: "2026-08-22T12:00:00.000Z", location: "home", exerciseId: "push-up" }),
  ];
  assert.deepEqual([...getCurrentExclusions(sessions)], ["push-up"]);
});

test("draft workouts do not change exclusions", () => {
  const sessions = [
    session({ id: "complete", status: "completed", completedAt: "2026-08-21T12:00:00.000Z", location: "office", exerciseId: "barbell-bench-press" }),
    session({ id: "draft", status: "draft", completedAt: null, location: "home", exerciseId: "push-up" }),
  ];
  assert.deepEqual([...getCurrentExclusions(sessions)], ["barbell-bench-press"]);
});

test("only exercises with at least one completed set become excluded", () => {
  const newest = session({ id: "complete", status: "completed", completedAt: "2026-08-22T12:00:00.000Z", location: "office", exerciseId: "barbell-bench-press" });
  newest.exercises.push(performed("dumbbell-romanian-deadlift", false));
  assert.deepEqual([...getCurrentExclusions([newest])], ["barbell-bench-press"]);
});

test("substitutions stay in the same broad category and selected or excluded options are ineligible", () => {
  const template = getTemplate("office", 1);
  const pullSlot = template.slots[1];
  const scheduled = exerciseById.get(pullSlot.scheduledExerciseId)!;
  const horizontalPull = exerciseById.get("seated-low-cable-row")!;
  const push = exerciseById.get("barbell-bench-press")!;

  assert.equal(isValidSubstitution({ scheduled, substitute: horizontalPull, location: "office", selectedExerciseIds: [], excludedExerciseIds: new Set() }), true);
  assert.equal(isValidSubstitution({ scheduled, substitute: push, location: "office", selectedExerciseIds: [], excludedExerciseIds: new Set() }), false);
  assert.equal(isValidSubstitution({ scheduled, substitute: horizontalPull, location: "office", selectedExerciseIds: [horizontalPull.id], excludedExerciseIds: new Set() }), false);
  assert.equal(isValidSubstitution({ scheduled, substitute: horizontalPull, location: "office", selectedExerciseIds: [], excludedExerciseIds: new Set([horizontalPull.id]) }), false);
});

test("eligible substitutions prefer the scheduled subtype, then allow another subtype", () => {
  const slot = getTemplate("office", 1).slots[1];
  const options = getEligibleSubstitutions({ slot, location: "office", selectedExerciseIds: [slot.scheduledExerciseId], excludedExerciseIds: new Set() });
  const firstHorizontal = options.findIndex((exercise) => exercise.subtype === "horizontal");
  const lastVertical = options.map((exercise) => exercise.subtype).lastIndexOf("vertical");
  assert.ok(firstHorizontal > lastVertical);
});

test("a substitute inherits the original slot sets and rep range", () => {
  const slot = getTemplate("office", 2).slots[2];
  const result = inheritSlot(slot, "dumbbell-goblet-squat");
  assert.equal(result.sets, 3);
  assert.equal(result.repMin, 10);
  assert.equal(result.repMax, 12);
  assert.equal(result.slotPosition, 3);
  assert.equal(result.superset, "A");
  assert.equal(result.setLogs.length, 3);
});

test("load fields match dumbbells, barbells, cables, bands, and bodyweight", () => {
  assert.deepEqual(getLoadFields("dumbbell_pair").map((field) => field.label), ["Each dumbbell (lb)"]);
  assert.deepEqual(getLoadFields("dumbbell_single").map((field) => field.label), ["Dumbbell weight (lb)"]);
  assert.deepEqual(getLoadFields("barbell_total").map((field) => field.label), ["Total barbell weight (lb)"]);
  assert.deepEqual(getLoadFields("cable_stack").map((field) => field.label), ["Displayed stack weight (lb)"]);
  assert.deepEqual(getLoadFields("band").map((field) => field.label), ["Band color or combination", "Estimated resistance (lb)"]);
  assert.deepEqual(getLoadFields("bodyweight"), []);
});

test("hash navigation supports direct access and refresh-safe routes", () => {
  assert.equal(getRouteFromHash("#/history"), "history");
  assert.equal(getRouteFromHash("#/progress?exercise=push-up"), "progress");
  assert.equal(getRouteFromHash(""), "workout");
  assert.equal(getRouteFromHash("#/not-a-route"), "workout");
});

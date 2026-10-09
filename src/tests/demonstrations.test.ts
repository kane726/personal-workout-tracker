import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demonstrationUrlsByExerciseId, exercises } from "../programData.ts";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, "../../supabase/migrations/202609010001_add_workout_duration_and_demonstration_links.sql"),
  "utf8",
);
const exerciseDetails = readFileSync(resolve(here, "../components/ExerciseInfo.tsx"), "utf8");
const verificationTable = readFileSync(resolve(here, "../../DEMONSTRATION_LINKS.md"), "utf8");

const intentionallyUnresolved = new Set([
  "one-arm-dumbbell-row-thigh-braced",
  "prone-band-hamstring-curl-floor",
  "seated-single-leg-band-hamstring-curl-floor",
]);

test("every exercise has a unique stable ID and either a verified HTTPS URL or an explicit unresolved entry", () => {
  assert.equal(exercises.length, 47);
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, 47);
  assert.equal(Object.keys(demonstrationUrlsByExerciseId).length, 44);

  for (const exercise of exercises) {
    assert.ok(verificationTable.includes(`\`${exercise.id}\``), exercise.id);
    if (intentionallyUnresolved.has(exercise.id)) {
      assert.equal(exercise.demonstrationUrl, null, exercise.id);
    } else {
      assert.match(exercise.demonstrationUrl ?? "", /^https:\/\//, exercise.id);
      assert.doesNotMatch(exercise.demonstrationUrl ?? "", /search|results/i, exercise.id);
      assert.ok(verificationTable.includes(exercise.demonstrationUrl!), exercise.id);
    }
  }
});

test("the additive migration updates every resolved link by stable exercise ID", () => {
  assert.match(migration, /add column if not exists duration_seconds integer/i);
  assert.match(migration, /duration_seconds is null or duration_seconds >= 0/i);
  for (const [exerciseId, url] of Object.entries(demonstrationUrlsByExerciseId)) {
    assert.match(migration, new RegExp(`'${exerciseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
    assert.ok(migration.includes(url), exerciseId);
  }
  for (const exerciseId of intentionallyUnresolved) {
    assert.doesNotMatch(migration, new RegExp(`\\('${exerciseId}'\\s*,`));
  }
});

test("demonstration links use safe new-tab attributes and keep the unresolved fallback", () => {
  assert.match(exerciseDetails, /target="_blank"/);
  assert.match(exerciseDetails, /rel="noopener noreferrer"/);
  assert.match(exerciseDetails, /Demonstration link not added\./);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(resolve(here, "../../supabase/migrations/202608230001_initial_workout_schema.sql"), "utf8");
const additiveMigration = readFileSync(resolve(here, "../../supabase/migrations/202609010001_add_workout_duration_and_demonstration_links.sql"), "utf8");
const workflow = readFileSync(resolve(here, "../../.github/workflows/deploy-pages.yml"), "utf8");
const viteConfig = readFileSync(resolve(here, "../../vite.config.ts"), "utf8");

test("workout history tables enforce authenticated-user isolation with RLS", () => {
  for (const table of ["workout_sessions", "session_exercises", "set_logs"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, "i"));
  }
  assert.ok((migration.match(/\(select auth\.uid\(\)\) = user_id/g) ?? []).length >= 12);
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(migration, new RegExp(`on public\\.workout_sessions for ${operation} to authenticated`, "i"));
    assert.match(migration, new RegExp(`on public\\.session_exercises for ${operation} to authenticated`, "i"));
    assert.match(migration, new RegExp(`on public\\.set_logs for ${operation} to authenticated`, "i"));
  }
});

test("the schema preserves scheduled and actual exercises and validates ownership", () => {
  assert.match(migration, /scheduled_exercise_id text not null/);
  assert.match(migration, /actual_exercise_id text not null/);
  assert.match(migration, /Session exercise owner must match workout owner/);
  assert.match(migration, /Set ownership must match its performed exercise/);
  assert.match(migration, /A substitute must remain in the scheduled broad category/);
});

test("no service-role secret is referenced by client or deployment configuration", () => {
  assert.doesNotMatch(workflow, /service[_-]?role/i);
  assert.doesNotMatch(viteConfig, /service[_-]?role/i);
  assert.match(workflow, /VITE_SUPABASE_PUBLISHABLE_KEY/);
});

test("GitHub Pages build uses relative assets and hash navigation deployment", () => {
  assert.match(viteConfig, /base:\s*["']\.\/["']/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm test/);
});

test("the additive migration preserves RLS and accepts existing records without a duration", () => {
  assert.match(additiveMigration, /add column if not exists duration_seconds integer/i);
  assert.match(additiveMigration, /duration_seconds is null or duration_seconds >= 0/i);
  assert.doesNotMatch(additiveMigration, /disable row level security|drop policy|drop table/i);
  assert.doesNotMatch(migration, /duration_seconds/i);
});

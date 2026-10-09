import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkoutDuration } from "../components/WorkoutDuration.tsx";
import {
  emptyWorkoutTimerState,
  getSupersetTimerView,
  loadWorkoutTimerState,
  overallElapsedMs,
  pauseOverallTimer,
  resumeOverallTimer,
  saveWorkoutTimerState,
  startOverallTimer,
  startSupersetTimer,
} from "../lib/timers.ts";
import { prepareWorkoutForCompletion } from "../lib/workoutCompletion.ts";
import type { WorkoutSession } from "../types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repositorySource = readFileSync(resolve(here, "../lib/repository.ts"), "utf8");
const historySource = readFileSync(resolve(here, "../screens/HistoryScreen.tsx"), "utf8");
const timerUiSource = readFileSync(resolve(here, "../components/WorkoutTimers.tsx"), "utf8");

const session = (durationSeconds: number | null = null): WorkoutSession => ({
  id: "session-1",
  userId: "user-1",
  templateId: "office-day-1",
  location: "office",
  workoutDay: 1,
  status: "draft",
  startedAt: "2026-09-01T10:00:00.000Z",
  completedAt: null,
  durationSeconds,
  notes: "",
  substitutionsUsed: false,
  exercises: [],
});

test("five-minute timer follows every required phase transition", () => {
  const timer = startSupersetTimer("A", 0, 1_000_000);
  assert.deepEqual(getSupersetTimerView(timer, 1_000_000, false), {
    phase: "rest_after_exercise_1",
    label: "Rest after Exercise 1",
    remainingMs: 300_000,
    prominent: false,
  });
  assert.equal(getSupersetTimerView(timer, 1_119_999, false).phase, "rest_after_exercise_1");
  assert.equal(getSupersetTimerView(timer, 1_120_000, false).phase, "perform_exercise_2");
  assert.equal(getSupersetTimerView(timer, 1_120_000, true).phase, "rest_until_next_round");
  assert.equal(getSupersetTimerView(timer, 1_300_000, true).phase, "begin_next_round");
});

test("two-minute and end-of-cycle visual notifications are prominent", () => {
  const timer = startSupersetTimer("B", 2, 0);
  const exerciseTwoCue = getSupersetTimerView(timer, 120_000, false);
  assert.equal(exerciseTwoCue.label, "Perform Exercise 2");
  assert.equal(exerciseTwoCue.prominent, true);
  assert.equal(exerciseTwoCue.remainingMs, 180_000);
  assert.match(timerUiSource, /role=\{view\.prominent \? "alert" : "status"\}/);
  assert.match(timerUiSource, /aria-live=\{view\.prominent \? "assertive" : "polite"\}/);

  const nextRoundCue = getSupersetTimerView(timer, 300_000, true);
  assert.equal(nextRoundCue.label, "Begin next round");
  assert.equal(nextRoundCue.prominent, true);
  assert.equal(nextRoundCue.remainingMs, 0);
});

test("five-minute timer does not restart automatically", () => {
  const timer = startSupersetTimer("A", 1, 5_000);
  assert.equal(getSupersetTimerView(timer, 305_000, true).phase, "begin_next_round");
  assert.equal(getSupersetTimerView(timer, 905_000, true).phase, "begin_next_round");
  assert.equal(timer.startedAtMs, 5_000);
});

test("overall timer starts, pauses, and resumes without counting paused time", () => {
  const started = startOverallTimer(emptyWorkoutTimerState().overall, 10_000);
  assert.equal(started.status, "running");
  assert.equal(overallElapsedMs(started, 70_000), 60_000);

  const paused = pauseOverallTimer(started, 70_000);
  assert.equal(paused.status, "paused");
  assert.equal(overallElapsedMs(paused, 370_000), 60_000);

  const resumed = resumeOverallTimer(paused, 370_000);
  assert.equal(resumed.status, "running");
  assert.equal(overallElapsedMs(resumed, 400_000), 90_000);
});

test("timer state restores from its saved timestamp after refresh", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const state = {
    ...emptyWorkoutTimerState(),
    superset: startSupersetTimer("A", 2, 20_000),
    overall: startOverallTimer(emptyWorkoutTimerState().overall, 10_000),
  };
  saveWorkoutTimerState("session-1", state, storage);
  const restored = loadWorkoutTimerState("session-1", storage);
  assert.deepEqual(restored, state);
  assert.equal(getSupersetTimerView(restored.superset!, 140_000, false).phase, "perform_exercise_2");
  assert.equal(overallElapsedMs(restored.overall, 140_000), 130_000);
});

test("completion saves elapsed duration with pauses excluded", () => {
  const started = startOverallTimer(emptyWorkoutTimerState().overall, 10_000);
  const paused = pauseOverallTimer(started, 70_000);
  const resumed = resumeOverallTimer(paused, 370_000);
  const result = prepareWorkoutForCompletion(
    session(),
    { ...emptyWorkoutTimerState(), overall: resumed },
    400_500,
  );
  assert.equal(result.session.durationSeconds, 90);
  assert.equal(result.timerState.overall.status, "stopped");
});

test("completion and history display a saved duration and preserve missing legacy durations", () => {
  assert.equal(renderToStaticMarkup(createElement(WorkoutDuration, { seconds: 754 })), "12:34");
  assert.equal(renderToStaticMarkup(createElement(WorkoutDuration, { seconds: null })), "Not recorded");

  const result = prepareWorkoutForCompletion(session(), emptyWorkoutTimerState(), 500_000);
  assert.equal(result.session.durationSeconds, null);
  assert.match(repositorySource, /duration_seconds:\s*session\.durationSeconds/);
  assert.match(repositorySource, /durationSeconds:\s*row\.duration_seconds/);
  assert.match(historySource, /<WorkoutDuration seconds=\{draft\.durationSeconds\}/);
});

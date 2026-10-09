import type { Superset } from "../types";

export const SUPERSET_DURATION_MS = 5 * 60 * 1000;
export const EXERCISE_TWO_CUE_MS = 2 * 60 * 1000;

export type SupersetTimerPhase =
  | "rest_after_exercise_1"
  | "perform_exercise_2"
  | "rest_until_next_round"
  | "begin_next_round";

export interface SupersetTimerState {
  superset: Superset;
  roundIndex: 0 | 1 | 2;
  startedAtMs: number;
}

export interface OverallTimerState {
  status: "not_started" | "running" | "paused" | "stopped";
  startedAtMs: number | null;
  accumulatedMs: number;
}

export interface WorkoutTimerState {
  version: 1;
  superset: SupersetTimerState | null;
  overall: OverallTimerState;
}

export interface SupersetTimerView {
  phase: SupersetTimerPhase;
  label: string;
  remainingMs: number;
  prominent: boolean;
}

export const emptyOverallTimer = (): OverallTimerState => ({
  status: "not_started",
  startedAtMs: null,
  accumulatedMs: 0,
});

export const emptyWorkoutTimerState = (): WorkoutTimerState => ({
  version: 1,
  superset: null,
  overall: emptyOverallTimer(),
});

export function startSupersetTimer(
  superset: Superset,
  roundIndex: 0 | 1 | 2,
  nowMs: number,
): SupersetTimerState {
  return { superset, roundIndex, startedAtMs: nowMs };
}

export function getSupersetTimerView(
  timer: SupersetTimerState,
  nowMs: number,
  secondExerciseCompleted: boolean,
): SupersetTimerView {
  const elapsedMs = Math.max(0, nowMs - timer.startedAtMs);
  const remainingMs = Math.max(0, SUPERSET_DURATION_MS - elapsedMs);

  if (elapsedMs >= SUPERSET_DURATION_MS) {
    return { phase: "begin_next_round", label: "Begin next round", remainingMs: 0, prominent: true };
  }
  if (elapsedMs < EXERCISE_TWO_CUE_MS) {
    return {
      phase: "rest_after_exercise_1",
      label: "Rest after Exercise 1",
      remainingMs,
      prominent: false,
    };
  }
  if (!secondExerciseCompleted) {
    return {
      phase: "perform_exercise_2",
      label: "Perform Exercise 2",
      remainingMs,
      prominent: true,
    };
  }
  return {
    phase: "rest_until_next_round",
    label: "Rest until next round",
    remainingMs,
    prominent: false,
  };
}

export function startOverallTimer(timer: OverallTimerState, nowMs: number): OverallTimerState {
  if (timer.status !== "not_started") return timer;
  return { status: "running", startedAtMs: nowMs, accumulatedMs: 0 };
}

export function pauseOverallTimer(timer: OverallTimerState, nowMs: number): OverallTimerState {
  if (timer.status !== "running" || timer.startedAtMs === null) return timer;
  return {
    status: "paused",
    startedAtMs: null,
    accumulatedMs: timer.accumulatedMs + Math.max(0, nowMs - timer.startedAtMs),
  };
}

export function resumeOverallTimer(timer: OverallTimerState, nowMs: number): OverallTimerState {
  if (timer.status !== "paused") return timer;
  return { ...timer, status: "running", startedAtMs: nowMs };
}

export function stopOverallTimer(timer: OverallTimerState, nowMs: number): OverallTimerState {
  if (timer.status === "not_started" || timer.status === "stopped") return timer;
  const accumulatedMs =
    timer.status === "running" && timer.startedAtMs !== null
      ? timer.accumulatedMs + Math.max(0, nowMs - timer.startedAtMs)
      : timer.accumulatedMs;
  return { status: "stopped", startedAtMs: null, accumulatedMs };
}

export function overallElapsedMs(timer: OverallTimerState, nowMs: number) {
  if (timer.status === "running" && timer.startedAtMs !== null) {
    return timer.accumulatedMs + Math.max(0, nowMs - timer.startedAtMs);
  }
  return timer.accumulatedMs;
}

export function finalDurationSeconds(timer: OverallTimerState, nowMs: number): number | null {
  if (timer.status === "not_started") return null;
  return Math.floor(overallElapsedMs(timer, nowMs) / 1000);
}

export const timerStorageKey = (sessionId: string) => `personal-workout-timers:${sessionId}`;
export const timerAudioStorageKey = "personal-workout-timer-audio";

function isFiniteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parseWorkoutTimerState(raw: string | null): WorkoutTimerState {
  if (!raw) return emptyWorkoutTimerState();
  try {
    const parsed = JSON.parse(raw) as Partial<WorkoutTimerState>;
    const overall = parsed.overall;
    const superset = parsed.superset;
    const validOverall =
      overall &&
      ["not_started", "running", "paused", "stopped"].includes(overall.status) &&
      (overall.startedAtMs === null || isFiniteNonnegative(overall.startedAtMs)) &&
      isFiniteNonnegative(overall.accumulatedMs) &&
      (overall.status === "running" ? overall.startedAtMs !== null : overall.startedAtMs === null);
    const validSuperset =
      superset === null ||
      (superset &&
        (superset.superset === "A" || superset.superset === "B") &&
        [0, 1, 2].includes(superset.roundIndex) &&
        isFiniteNonnegative(superset.startedAtMs));
    if (parsed.version !== 1 || !validOverall || !validSuperset) return emptyWorkoutTimerState();
    return parsed as WorkoutTimerState;
  } catch {
    return emptyWorkoutTimerState();
  }
}

export function loadWorkoutTimerState(sessionId: string, storage: Pick<Storage, "getItem"> = localStorage) {
  return parseWorkoutTimerState(storage.getItem(timerStorageKey(sessionId)));
}

export function saveWorkoutTimerState(
  sessionId: string,
  state: WorkoutTimerState,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(timerStorageKey(sessionId), JSON.stringify(state));
}

export function clearWorkoutTimerState(sessionId: string, storage: Pick<Storage, "removeItem"> = localStorage) {
  storage.removeItem(timerStorageKey(sessionId));
}

export function readTimerAudioEnabled(storage: Pick<Storage, "getItem"> = localStorage) {
  return storage.getItem(timerAudioStorageKey) === "true";
}

export function saveTimerAudioEnabled(enabled: boolean, storage: Pick<Storage, "setItem"> = localStorage) {
  storage.setItem(timerAudioStorageKey, String(enabled));
}

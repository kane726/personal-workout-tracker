import type { WorkoutSession } from "../types";
import { finalDurationSeconds, stopOverallTimer, type WorkoutTimerState } from "./timers";

export function prepareWorkoutForCompletion(
  session: WorkoutSession,
  timerState: WorkoutTimerState,
  finishedAtMs: number,
) {
  const stoppedTimerState: WorkoutTimerState = {
    ...timerState,
    overall: stopOverallTimer(timerState.overall, finishedAtMs),
  };
  return {
    session: {
      ...session,
      durationSeconds: finalDurationSeconds(stoppedTimerState.overall, finishedAtMs),
    },
    timerState: stoppedTimerState,
  };
}

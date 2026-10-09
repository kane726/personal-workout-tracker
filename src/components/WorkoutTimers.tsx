import { useEffect, useRef, useState } from "react";
import {
  getSupersetTimerView,
  loadWorkoutTimerState,
  overallElapsedMs,
  pauseOverallTimer,
  readTimerAudioEnabled,
  resumeOverallTimer,
  saveTimerAudioEnabled,
  saveWorkoutTimerState,
  startOverallTimer,
  startSupersetTimer,
  type SupersetTimerPhase,
  type SupersetTimerState,
  type WorkoutTimerState,
} from "../lib/timers";
import type { Superset } from "../types";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextConstructor = window.AudioContext;
  audioContext = new AudioContextConstructor();
  return audioContext;
}

async function primeTimerAudio() {
  try {
    await getAudioContext().resume();
  } catch {
    // Visual notifications remain available if the browser blocks audio.
  }
}

function playTimerCue() {
  try {
    const context = getAudioContext();
    const play = () => {
      const startAt = context.currentTime;
      [0, 0.18].forEach((offset, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = index === 0 ? 740 : 940;
        gain.gain.setValueAtTime(0.0001, startAt + offset);
        gain.gain.exponentialRampToValueAtTime(0.16, startAt + offset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.14);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(startAt + offset);
        oscillator.stop(startAt + offset + 0.15);
      });
    };
    if (context.state === "suspended") void context.resume().then(play).catch(() => undefined);
    else play();
  } catch {
    // Audio is optional. The on-screen alert is the primary notification.
  }
}

export function formatTimerClock(milliseconds: number, rounding: "up" | "down" = "up") {
  const totalSeconds = Math.max(0, rounding === "up" ? Math.ceil(milliseconds / 1000) : Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function useWorkoutTimers(sessionId: string) {
  const [timerState, setTimerState] = useState<WorkoutTimerState>(() => loadWorkoutTimerState(sessionId));
  const [nowMs, setNowMs] = useState(Date.now);
  const [audioEnabled, setAudioEnabled] = useState(readTimerAudioEnabled);

  useEffect(() => {
    setTimerState(loadWorkoutTimerState(sessionId));
    setNowMs(Date.now());
  }, [sessionId]);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const interval = window.setInterval(tick, 250);
    const updateWhenVisible = () => tick();
    document.addEventListener("visibilitychange", updateWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, []);

  const updateTimerState = (updater: (current: WorkoutTimerState, operationNow: number) => WorkoutTimerState) => {
    const operationNow = Date.now();
    setNowMs(operationNow);
    setTimerState((current) => {
      const next = updater(current, operationNow);
      saveWorkoutTimerState(sessionId, next);
      return next;
    });
  };

  const setAudio = (enabled: boolean) => {
    setAudioEnabled(enabled);
    saveTimerAudioEnabled(enabled);
    if (enabled) void primeTimerAudio();
  };

  return {
    timerState,
    nowMs,
    audioEnabled,
    setAudio,
    startOverall: () => updateTimerState((current, operationNow) => ({ ...current, overall: startOverallTimer(current.overall, operationNow) })),
    pauseOverall: () => updateTimerState((current, operationNow) => ({ ...current, overall: pauseOverallTimer(current.overall, operationNow) })),
    resumeOverall: () => updateTimerState((current, operationNow) => ({ ...current, overall: resumeOverallTimer(current.overall, operationNow) })),
    startSuperset: (superset: Superset, roundIndex: 0 | 1 | 2) =>
      updateTimerState((current, operationNow) => ({ ...current, superset: startSupersetTimer(superset, roundIndex, operationNow) })),
    clearSuperset: () => updateTimerState((current) => ({ ...current, superset: null })),
  };
}

export function OverallWorkoutTimer({
  timerState,
  nowMs,
  audioEnabled,
  onAudioChange,
  onStart,
  onPause,
  onResume,
}: {
  timerState: WorkoutTimerState;
  nowMs: number;
  audioEnabled: boolean;
  onAudioChange: (enabled: boolean) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const overall = timerState.overall;
  const elapsed = overallElapsedMs(overall, nowMs);
  const statusLabel =
    overall.status === "not_started"
      ? "Not started"
      : overall.status === "running"
        ? "Running"
        : overall.status === "paused"
          ? "Paused"
          : "Stopped";

  return (
    <section className="overall-timer panel" aria-label="Overall workout timer">
      <div className="overall-timer-copy">
        <span>Overall workout timer</span>
        <strong aria-live="off">{formatTimerClock(elapsed, "down")}</strong>
        <small className={`timer-status timer-status-${overall.status}`}>{statusLabel}</small>
      </div>
      <div className="overall-timer-actions">
        {overall.status === "not_started" ? <button type="button" className="primary-button" onClick={onStart}>Start timer</button> : null}
        {overall.status === "running" ? <button type="button" className="secondary-button" onClick={onPause}>Pause</button> : null}
        {overall.status === "paused" ? <button type="button" className="primary-button" onClick={onResume}>Resume</button> : null}
        {overall.status === "stopped" ? <span className="timer-finished-label">Saved when workout finishes</span> : null}
        <label className="audio-toggle">
          <input type="checkbox" checked={audioEnabled} onChange={(event) => onAudioChange(event.target.checked)} />
          <span>Audio cues</span>
          <small>Optional, off by default</small>
        </label>
      </div>
    </section>
  );
}

export function SupersetRoundTimer({
  superset,
  roundIndex,
  activeTimer,
  nowMs,
  secondExerciseCompleted,
  audioEnabled,
  onStart,
  onClear,
}: {
  superset: Superset;
  roundIndex: 0 | 1 | 2;
  activeTimer: SupersetTimerState | null;
  nowMs: number;
  secondExerciseCompleted: boolean;
  audioEnabled: boolean;
  onStart: () => void;
  onClear: () => void;
}) {
  const belongsToRound = activeTimer?.superset === superset && activeTimer.roundIndex === roundIndex;
  const activeView = activeTimer
    ? getSupersetTimerView(activeTimer, nowMs, belongsToRound ? secondExerciseCompleted : false)
    : null;
  const view = belongsToRound ? activeView : null;
  const blockingTimer = Boolean(activeTimer && activeView?.phase !== "begin_next_round" && !belongsToRound);
  const previousPhase = useRef<SupersetTimerPhase | null>(view?.phase ?? null);

  useEffect(() => {
    if (!view) {
      previousPhase.current = null;
      return;
    }
    const justReachedCue =
      previousPhase.current !== view.phase &&
      (view.phase === "perform_exercise_2" || view.phase === "begin_next_round");
    previousPhase.current = view.phase;
    if (justReachedCue && audioEnabled) playTimerCue();
  }, [audioEnabled, view]);

  if (!view) {
    return (
      <div className="superset-timer superset-timer-idle">
        <div><span>Five-minute round timer</span><strong>5:00</strong></div>
        <button type="button" className="secondary-button" onClick={onStart} disabled={blockingTimer}>
          {blockingTimer ? "Another round timer is active" : "Start after Exercise 1"}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`superset-timer superset-timer-${view.phase} ${view.prominent ? "prominent" : ""}`}
      role={view.prominent ? "alert" : "status"}
      aria-live={view.prominent ? "assertive" : "polite"}
    >
      <div className="superset-timer-clock">
        <span>Round {roundIndex + 1} timer</span>
        <strong>{formatTimerClock(view.remainingMs)}</strong>
      </div>
      <div className="superset-timer-phase">
        <span>Current phase</span>
        <strong>{view.label}</strong>
        {view.phase === "perform_exercise_2" ? <small>Complete Exercise 2, then rest until the timer ends.</small> : null}
        {view.phase === "begin_next_round" ? <small>The timer is stopped. Start the next timer manually after Exercise 1.</small> : null}
      </div>
      <button type="button" className="text-button" onClick={onClear}>Clear timer</button>
    </div>
  );
}

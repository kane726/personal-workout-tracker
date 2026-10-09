import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState, WorkoutSession } from "../types";
import {
  completeSession as persistCompletion,
  deleteSession,
  getLatestDraft,
  listCompletedSessions,
  saveSessionSnapshot,
} from "./repository";
import {
  clearWorkoutTimerState,
  loadWorkoutTimerState,
  saveWorkoutTimerState,
} from "./timers";
import { prepareWorkoutForCompletion } from "./workoutCompletion";

const localKey = (userId: string) => `personal-workout-active:${userId}`;

function readLocalDraft(userId: string) {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutSession;
    return parsed.userId === userId && parsed.status === "draft"
      ? { ...parsed, durationSeconds: parsed.durationSeconds ?? null }
      : null;
  } catch {
    return null;
  }
}

export function useWorkoutData(userId: string | null) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastCompleted, setLastCompleted] = useState<WorkoutSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const hydratedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const completed = await listCompletedSessions(userId);
    setSessions(completed);
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    hydratedRef.current = false;
    setSessions([]);
    setActive(null);
    setLastCompleted(null);
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    Promise.all([listCompletedSessions(userId), getLatestDraft(userId)])
      .then(([completed, remoteDraft]) => {
        if (!mounted) return;
        const localDraft = readLocalDraft(userId);
        const chosenDraft =
          localDraft && remoteDraft
            ? Date.parse(localDraft.startedAt) >= Date.parse(remoteDraft.startedAt)
              ? localDraft
              : remoteDraft
            : localDraft ?? remoteDraft;
        setSessions(completed);
        setActive(chosenDraft);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!mounted) return;
        const localDraft = readLocalDraft(userId);
        setActive(localDraft);
        setError(loadError instanceof Error ? loadError.message : "Could not load workout history.");
      })
      .finally(() => {
        if (!mounted) return;
        hydratedRef.current = true;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (active) localStorage.setItem(localKey(userId), JSON.stringify(active));
    else localStorage.removeItem(localKey(userId));

    if (!active || !hydratedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(() => {
      const snapshot = structuredClone(active);
      saveChainRef.current = saveChainRef.current
        .then(() => saveSessionSnapshot(snapshot))
        .then(() => setSaveState("saved"))
        .catch((saveError: unknown) => {
          setSaveState(navigator.onLine ? "error" : "offline");
          setError(saveError instanceof Error ? saveError.message : "Autosave failed.");
        });
    }, 650);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, userId]);

  const start = async (session: WorkoutSession) => {
    setSaveState("saving");
    setError(null);
    try {
      await saveSessionSnapshot(session);
      setActive(session);
      setSaveState("saved");
    } catch (startError) {
      setSaveState("error");
      setError(startError instanceof Error ? startError.message : "The workout could not be started.");
      throw startError;
    }
  };

  const updateActive = (updater: (current: WorkoutSession) => WorkoutSession) => {
    setActive((current) => (current ? updater(current) : current));
  };

  const finish = async () => {
    if (!active || !userId) return null;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    const finishedAtMs = Date.now();
    const timerState = loadWorkoutTimerState(active.id);
    const prepared = prepareWorkoutForCompletion(structuredClone(active), timerState, finishedAtMs);
    const snapshot = prepared.session;
    saveWorkoutTimerState(active.id, prepared.timerState);
    await saveChainRef.current;
    const completed = await persistCompletion(snapshot);
    setLastCompleted(completed);
    setActive(null);
    localStorage.removeItem(localKey(userId));
    clearWorkoutTimerState(completed.id);
    setSessions((current) => [completed, ...current.filter((item) => item.id !== completed.id)]);
    setSaveState("saved");
    return completed;
  };

  const discard = async () => {
    if (!active || !userId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    await saveChainRef.current;
    await deleteSession(active.id, userId);
    setActive(null);
    localStorage.removeItem(localKey(userId));
    clearWorkoutTimerState(active.id);
    setSaveState("saved");
  };

  const savePastSession = async (session: WorkoutSession) => {
    await saveSessionSnapshot(session);
    setSessions((current) =>
      current
        .map((item) => (item.id === session.id ? session : item))
        .sort((a, b) => Date.parse(b.completedAt ?? b.startedAt) - Date.parse(a.completedAt ?? a.startedAt)),
    );
  };

  const removePastSession = async (session: WorkoutSession) => {
    await deleteSession(session.id, session.userId);
    setSessions((current) => current.filter((item) => item.id !== session.id));
  };

  return {
    sessions,
    active,
    loading,
    error,
    saveState,
    lastCompleted,
    setLastCompleted,
    reload,
    start,
    updateActive,
    finish,
    discard,
    savePastSession,
    removePastSession,
  };
}

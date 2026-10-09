import { exerciseById, exercises } from "../programData";
import type {
  Exercise,
  LoadMode,
  Location,
  PerformedExercise,
  SessionSummary,
  SetLog,
  TemplateSlot,
  WorkoutSession,
  WorkoutTemplate,
} from "../types";

export function latestCompletedSession(sessions: WorkoutSession[]) {
  return sessions
    .filter((session) => session.status === "completed" && session.completedAt)
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))[0] ?? null;
}

export function getCurrentExclusions(sessions: WorkoutSession[]) {
  const latest = latestCompletedSession(sessions);
  if (!latest) return new Set<string>();
  return new Set(
    latest.exercises
      .filter((performed) => performed.setLogs.some((set) => set.completed))
      .map((performed) => performed.actualExerciseId),
  );
}

export function getEligibleSubstitutions(args: {
  slot: TemplateSlot;
  location: Location;
  selectedExerciseIds: string[];
  excludedExerciseIds: Set<string>;
}) {
  const scheduled = exerciseById.get(args.slot.scheduledExerciseId);
  if (!scheduled) return [];

  return exercises
    .filter((candidate) => candidate.category === scheduled.category)
    .filter((candidate) => candidate.locations.includes(args.location))
    .filter((candidate) => !args.excludedExerciseIds.has(candidate.id))
    .filter((candidate) => !args.selectedExerciseIds.includes(candidate.id))
    .sort((a, b) => {
      const aSubtype = a.subtype === scheduled.subtype ? 0 : 1;
      const bSubtype = b.subtype === scheduled.subtype ? 0 : 1;
      return aSubtype - bSubtype || a.name.localeCompare(b.name);
    });
}

export function isValidSubstitution(args: {
  scheduled: Exercise;
  substitute: Exercise;
  location: Location;
  selectedExerciseIds: string[];
  excludedExerciseIds: Set<string>;
}) {
  return (
    args.scheduled.category === args.substitute.category &&
    args.substitute.locations.includes(args.location) &&
    !args.selectedExerciseIds.includes(args.substitute.id) &&
    !args.excludedExerciseIds.has(args.substitute.id)
  );
}

export function inheritSlot(slot: TemplateSlot, actualExerciseId: string): PerformedExercise {
  return {
    id: crypto.randomUUID(),
    scheduledExerciseId: slot.scheduledExerciseId,
    actualExerciseId,
    slotPosition: slot.position,
    superset: slot.superset,
    sets: slot.sets,
    repMin: slot.repMin,
    repMax: slot.repMax,
    perSide: slot.perSide,
    setLogs: ([1, 2, 3] as const).map((setNumber) => createEmptySet(setNumber)),
  };
}

export function createEmptySet(setNumber: 1 | 2 | 3): SetLog {
  return {
    id: crypto.randomUUID(),
    setNumber,
    actualReps: null,
    effort: null,
    completed: false,
    note: "",
    loadValue: null,
    bandDescription: "",
    estimatedResistanceLbs: null,
    weightUnit: "lb",
  };
}

export function createDraftSession(args: {
  userId: string;
  template: WorkoutTemplate;
  selectedByPosition: Record<number, string>;
  now?: Date;
}): WorkoutSession {
  const exercisesForSession = args.template.slots.map((slot) =>
    inheritSlot(slot, args.selectedByPosition[slot.position] ?? slot.scheduledExerciseId),
  );
  return {
    id: crypto.randomUUID(),
    userId: args.userId,
    templateId: args.template.id,
    location: args.template.location,
    workoutDay: args.template.day,
    status: "draft",
    startedAt: (args.now ?? new Date()).toISOString(),
    completedAt: null,
    durationSeconds: null,
    notes: "",
    substitutionsUsed: exercisesForSession.some(
      (performed) => performed.actualExerciseId !== performed.scheduledExerciseId,
    ),
    exercises: exercisesForSession,
  };
}

export interface LoadFieldDefinition {
  key: "loadValue" | "bandDescription" | "estimatedResistanceLbs";
  label: string;
  inputMode: "decimal" | "text";
}

export function getLoadFields(loadMode: LoadMode): LoadFieldDefinition[] {
  switch (loadMode) {
    case "dumbbell_pair":
      return [{ key: "loadValue", label: "Each dumbbell (lb)", inputMode: "decimal" }];
    case "dumbbell_single":
      return [{ key: "loadValue", label: "Dumbbell weight (lb)", inputMode: "decimal" }];
    case "barbell_total":
      return [{ key: "loadValue", label: "Total barbell weight (lb)", inputMode: "decimal" }];
    case "cable_stack":
      return [{ key: "loadValue", label: "Displayed stack weight (lb)", inputMode: "decimal" }];
    case "band":
      return [
        { key: "bandDescription", label: "Band color or combination", inputMode: "text" },
        { key: "estimatedResistanceLbs", label: "Estimated resistance (lb)", inputMode: "decimal" },
      ];
    case "bodyweight":
      return [];
  }
}

export function repsOutsideTarget(set: SetLog, performed: PerformedExercise) {
  return (
    set.actualReps !== null &&
    (set.actualReps < performed.repMin || set.actualReps > performed.repMax)
  );
}

export function setHasRequiredData(set: SetLog, loadMode: LoadMode) {
  const common = set.actualReps !== null && set.actualReps >= 0 && set.effort !== null && set.effort >= 1 && set.effort <= 10;
  if (!common) return false;
  if (loadMode === "bodyweight") return true;
  if (loadMode === "band") {
    return Boolean(set.bandDescription.trim()) && set.estimatedResistanceLbs !== null && set.estimatedResistanceLbs >= 0;
  }
  return set.loadValue !== null && set.loadValue >= 0;
}

export function mondayStart(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

export function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function sessionsBetween(sessions: WorkoutSession[], start: Date, end: Date) {
  return sessions.filter((session) => {
    if (session.status !== "completed" || !session.completedAt) return false;
    const completed = new Date(session.completedAt);
    return completed >= start && completed < end;
  });
}

export function currentWeekSessions(sessions: WorkoutSession[], now = new Date()) {
  const start = mondayStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return sessionsBetween(sessions, start, end);
}

export function currentMonthSessions(sessions: WorkoutSession[], now = new Date()) {
  const start = monthStart(now);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return sessionsBetween(sessions, start, end);
}

export function summarizeSessions(sessions: WorkoutSession[]): SessionSummary {
  const sets = sessions.flatMap((session) => session.exercises.flatMap((exercise) => exercise.setLogs));
  const completedSets = sets.filter((set) => set.completed);
  const efforts = completedSets.flatMap((set) => (set.effort === null ? [] : [set.effort]));
  const frequency = new Map<string, number>();

  for (const session of sessions) {
    for (const performed of session.exercises) {
      if (performed.setLogs.some((set) => set.completed)) {
        frequency.set(performed.actualExerciseId, (frequency.get(performed.actualExerciseId) ?? 0) + 1);
      }
    }
  }

  return {
    workouts: sessions.length,
    sets: completedSets.length,
    reps: completedSets.reduce((total, set) => total + (set.actualReps ?? 0), 0),
    averageEffort: efforts.length
      ? efforts.reduce((total, effort) => total + effort, 0) / efforts.length
      : null,
    office: sessions.filter((session) => session.location === "office").length,
    home: sessions.filter((session) => session.location === "home").length,
    frequentExercises: [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([exerciseId, count]) => ({ exerciseId, count })),
  };
}

export function completedSetCount(session: WorkoutSession) {
  return session.exercises.reduce(
    (total, performed) => total + performed.setLogs.filter((set) => set.completed).length,
    0,
  );
}

export function completedRepCount(session: WorkoutSession) {
  return session.exercises.reduce(
    (total, performed) =>
      total +
      performed.setLogs.reduce(
        (exerciseTotal, set) => exerciseTotal + (set.completed ? set.actualReps ?? 0 : 0),
        0,
      ),
    0,
  );
}

export function formatLoad(set: SetLog, mode: LoadMode) {
  if (mode === "bodyweight") return "Bodyweight";
  if (mode === "band") {
    const pieces = [set.bandDescription, set.estimatedResistanceLbs !== null ? `~${set.estimatedResistanceLbs} lb` : ""];
    return pieces.filter(Boolean).join(" · ") || "Not recorded";
  }
  return set.loadValue === null ? "Not recorded" : `${set.loadValue} lb`;
}

export function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function getRouteFromHash(hash: string) {
  const cleaned = hash.replace(/^#\/?/, "").split("?")[0].replace(/^\/+|\/+$/g, "");
  const route = cleaned || "workout";
  return ["workout", "history", "progress", "programs", "settings"].includes(route)
    ? route
    : "workout";
}

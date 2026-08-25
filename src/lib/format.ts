import { exerciseById } from "../programData";
import type { PerformedExercise, WorkoutSession } from "../types";

export const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options ?? { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}

export function formatShortDate(value: string) {
  return formatDate(value, { month: "short", day: "numeric" });
}

export function formatDateTime(value: string) {
  return formatDate(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function sessionTitle(session: WorkoutSession) {
  return `${titleCase(session.location)} · Day ${session.workoutDay}`;
}

export function exerciseName(performed: PerformedExercise) {
  return exerciseById.get(performed.actualExerciseId)?.name ?? "Unknown exercise";
}

export function formatNumber(value: number | null, digits = 1) {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

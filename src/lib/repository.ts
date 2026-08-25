import { getSupabase } from "./supabase";
import type { PerformedExercise, SetLog, WorkoutSession } from "../types";

type DbSet = {
  id: string;
  set_number: number;
  actual_reps: number | null;
  effort: number | null;
  completed: boolean;
  note: string | null;
  load_value: number | string | null;
  band_description: string | null;
  estimated_resistance_lbs: number | string | null;
  weight_unit: "lb";
};

type DbExercise = {
  id: string;
  scheduled_exercise_id: string;
  actual_exercise_id: string;
  slot_position: number;
  superset: "A" | "B";
  target_sets: number;
  rep_min: number;
  rep_max: number;
  per_side: boolean;
  set_logs?: DbSet[];
};

type DbSession = {
  id: string;
  user_id: string;
  template_id: string;
  location: "office" | "home";
  workout_day: 1 | 2 | 3;
  status: "draft" | "completed";
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  substitutions_used: boolean;
  session_exercises?: DbExercise[];
};

const selectSession = `
  id,
  user_id,
  template_id,
  location,
  workout_day,
  status,
  started_at,
  completed_at,
  notes,
  substitutions_used,
  session_exercises (
    id,
    scheduled_exercise_id,
    actual_exercise_id,
    slot_position,
    superset,
    target_sets,
    rep_min,
    rep_max,
    per_side,
    set_logs (
      id,
      set_number,
      actual_reps,
      effort,
      completed,
      note,
      load_value,
      band_description,
      estimated_resistance_lbs,
      weight_unit
    )
  )
`;

function numberOrNull(value: number | string | null) {
  return value === null ? null : Number(value);
}

function mapSet(row: DbSet): SetLog {
  return {
    id: row.id,
    setNumber: row.set_number as 1 | 2 | 3,
    actualReps: row.actual_reps,
    effort: row.effort,
    completed: row.completed,
    note: row.note ?? "",
    loadValue: numberOrNull(row.load_value),
    bandDescription: row.band_description ?? "",
    estimatedResistanceLbs: numberOrNull(row.estimated_resistance_lbs),
    weightUnit: row.weight_unit,
  };
}

function mapExercise(row: DbExercise): PerformedExercise {
  return {
    id: row.id,
    scheduledExerciseId: row.scheduled_exercise_id,
    actualExerciseId: row.actual_exercise_id,
    slotPosition: row.slot_position as 1 | 2 | 3 | 4,
    superset: row.superset,
    sets: row.target_sets as 3,
    repMin: row.rep_min,
    repMax: row.rep_max,
    perSide: row.per_side,
    setLogs: (row.set_logs ?? []).map(mapSet).sort((a, b) => a.setNumber - b.setNumber),
  };
}

function mapSession(row: DbSession): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    location: row.location,
    workoutDay: row.workout_day,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes ?? "",
    substitutionsUsed: row.substitutions_used,
    exercises: (row.session_exercises ?? [])
      .map(mapExercise)
      .sort((a, b) => a.slotPosition - b.slotPosition),
  };
}

function sessionRow(session: WorkoutSession) {
  return {
    id: session.id,
    user_id: session.userId,
    template_id: session.templateId,
    location: session.location,
    workout_day: session.workoutDay,
    status: session.status,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    notes: session.notes,
    substitutions_used: session.substitutionsUsed,
  };
}

export async function listCompletedSessions(userId: string) {
  const { data, error } = await getSupabase()
    .from("workout_sessions")
    .select(selectSession)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as DbSession[]).map(mapSession);
}

export async function getLatestDraft(userId: string) {
  const { data, error } = await getSupabase()
    .from("workout_sessions")
    .select(selectSession)
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data as unknown as DbSession) : null;
}

export async function saveSessionSnapshot(session: WorkoutSession) {
  const client = getSupabase();
  const { error: sessionError } = await client
    .from("workout_sessions")
    .upsert(sessionRow(session), { onConflict: "id" });
  if (sessionError) throw sessionError;

  const exerciseRows = session.exercises.map((performed) => ({
    id: performed.id,
    session_id: session.id,
    user_id: session.userId,
    slot_position: performed.slotPosition,
    superset: performed.superset,
    scheduled_exercise_id: performed.scheduledExerciseId,
    actual_exercise_id: performed.actualExerciseId,
    target_sets: performed.sets,
    rep_min: performed.repMin,
    rep_max: performed.repMax,
    per_side: performed.perSide,
  }));
  const { error: exerciseError } = await client
    .from("session_exercises")
    .upsert(exerciseRows, { onConflict: "id" });
  if (exerciseError) throw exerciseError;

  const setRows = session.exercises.flatMap((performed) =>
    performed.setLogs.map((set) => ({
      id: set.id,
      session_exercise_id: performed.id,
      session_id: session.id,
      user_id: session.userId,
      set_number: set.setNumber,
      actual_reps: set.actualReps,
      effort: set.effort,
      completed: set.completed,
      note: set.note,
      load_value: set.loadValue,
      band_description: set.bandDescription || null,
      estimated_resistance_lbs: set.estimatedResistanceLbs,
      weight_unit: set.weightUnit,
    })),
  );
  const { error: setError } = await client.from("set_logs").upsert(setRows, { onConflict: "id" });
  if (setError) throw setError;
}

export async function completeSession(session: WorkoutSession) {
  await saveSessionSnapshot({ ...session, status: "draft", completedAt: null });
  const completed: WorkoutSession = {
    ...session,
    status: "completed",
    completedAt: session.completedAt ?? new Date().toISOString(),
  };
  const { error } = await getSupabase()
    .from("workout_sessions")
    .update({ status: "completed", completed_at: completed.completedAt })
    .eq("id", completed.id)
    .eq("user_id", completed.userId);
  if (error) throw error;
  return completed;
}

export async function deleteSession(sessionId: string, userId: string) {
  const { error } = await getSupabase()
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw error;
}

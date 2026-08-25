export type Location = "office" | "home";
export type Category = "squat" | "pull" | "hamstring" | "push";
export type Subtype = "horizontal" | "vertical" | "hinge" | "curl";
export type Superset = "A" | "B";
export type LoadMode =
  | "dumbbell_pair"
  | "dumbbell_single"
  | "barbell_total"
  | "cable_stack"
  | "band"
  | "bodyweight";

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  subtype?: Subtype;
  locations: Location[];
  equipment: string[];
  loadMode: LoadMode;
  instructions: string;
  demonstrationUrl: string | null;
}

export interface TemplateSlot {
  id: string;
  position: 1 | 2 | 3 | 4;
  superset: Superset;
  scheduledExerciseId: string;
  sets: 3;
  repMin: number;
  repMax: number;
  perSide: boolean;
}

export interface WorkoutTemplate {
  id: string;
  location: Location;
  day: 1 | 2 | 3;
  firstSuperset: Superset;
  slots: TemplateSlot[];
}

export interface SetLog {
  id: string;
  setNumber: 1 | 2 | 3;
  actualReps: number | null;
  effort: number | null;
  completed: boolean;
  note: string;
  loadValue: number | null;
  bandDescription: string;
  estimatedResistanceLbs: number | null;
  weightUnit: "lb";
}

export interface PerformedExercise {
  id: string;
  scheduledExerciseId: string;
  actualExerciseId: string;
  slotPosition: 1 | 2 | 3 | 4;
  superset: Superset;
  sets: 3;
  repMin: number;
  repMax: number;
  perSide: boolean;
  setLogs: SetLog[];
}

export type WorkoutStatus = "draft" | "completed";

export interface WorkoutSession {
  id: string;
  userId: string;
  templateId: string;
  location: Location;
  workoutDay: 1 | 2 | 3;
  status: WorkoutStatus;
  startedAt: string;
  completedAt: string | null;
  notes: string;
  substitutionsUsed: boolean;
  exercises: PerformedExercise[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
  };
}

export type SaveState = "saved" | "saving" | "offline" | "error";

export interface SessionSummary {
  workouts: number;
  sets: number;
  reps: number;
  averageEffort: number | null;
  office: number;
  home: number;
  frequentExercises: Array<{ exerciseId: string; count: number }>;
}

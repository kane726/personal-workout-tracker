import { formatDuration } from "../lib/format";

export function WorkoutDuration({ seconds }: { seconds: number | null }) {
  return formatDuration(seconds);
}

import { useMemo, useState } from "react";
import type { WorkoutSession } from "../types";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function WorkoutCalendar({
  sessions,
  onOpen,
}: {
  sessions: WorkoutSession[];
  onOpen: (session: WorkoutSession) => void;
}) {
  const initialDate = sessions[0]?.completedAt ? new Date(sessions[0].completedAt) : new Date();
  const [month, setMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const byDate = useMemo(() => {
    const result = new Map<string, WorkoutSession[]>();
    sessions.forEach((session) => {
      if (!session.completedAt) return;
      const key = dateKey(session.completedAt);
      result.set(key, [...(result.get(key) ?? []), session]);
    });
    return result;
  }, [sessions]);

  const start = new Date(month);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });

  const moveMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <button type="button" className="icon-button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
        <h3>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month)}</h3>
        <button type="button" className="icon-button" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
      </div>
      <div className="calendar-grid calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="calendar-grid">
        {days.map((date) => {
          const daySessions = byDate.get(dateKey(date)) ?? [];
          const outside = date.getMonth() !== month.getMonth();
          return (
            <button
              type="button"
              key={date.toISOString()}
              className={`calendar-day ${outside ? "outside" : ""} ${daySessions.length ? "has-workout" : ""}`}
              onClick={() => daySessions[0] && onOpen(daySessions[0])}
              disabled={!daySessions.length}
              aria-label={`${date.toLocaleDateString()}${daySessions.length ? `, ${daySessions.length} completed workout` : ""}`}
            >
              <span>{date.getDate()}</span>
              {daySessions.map((session) => <i key={session.id} className={session.location} aria-hidden="true" />)}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend"><span><i className="office" />Office</span><span><i className="home" />Home</span></div>
    </div>
  );
}

import type { ReactNode } from "react";

export function LoadingScreen({ label = "Loading your workout data…" }: { label?: string }) {
  return (
    <div className="center-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "error" | "success"; children: ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

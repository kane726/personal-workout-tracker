import type { ReactNode } from "react";
import type { RouteName } from "../lib/useHashRoute";

const navItems: Array<{ route: RouteName; label: string; icon: string }> = [
  { route: "workout", label: "Workout", icon: "＋" },
  { route: "history", label: "History", icon: "▦" },
  { route: "progress", label: "Progress", icon: "↗" },
  { route: "programs", label: "Programs", icon: "≡" },
  { route: "settings", label: "Account", icon: "○" },
];

export function AppShell({
  route,
  navigate,
  children,
  activeWorkout,
}: {
  route: RouteName;
  navigate: (route: RouteName) => void;
  children: ReactNode;
  activeWorkout: boolean;
}) {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">W</span>
          <div>
            <strong>Workout</strong>
            <span>Personal tracker</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.route}
              className={route === item.route ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.route)}
              aria-current={route === item.route ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.route === "workout" && activeWorkout ? <i className="active-dot" aria-label="Active workout" /> : null}
            </button>
          ))}
        </nav>
        <p className="sidebar-note">Strength work. Logged clearly.</p>
      </aside>

      <div className="content-shell">
        <header className="mobile-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">W</span>
            <div>
              <strong>Workout</strong>
              <span>{activeWorkout ? "Active session saved" : "Personal tracker"}</span>
            </div>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.route}
            className={route === item.route ? "active" : ""}
            onClick={() => navigate(item.route)}
            aria-current={route === item.route ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
            {item.route === "workout" && activeWorkout ? <i className="active-dot" aria-label="Active workout" /> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

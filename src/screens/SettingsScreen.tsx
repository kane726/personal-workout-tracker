import { useState } from "react";
import { Notice } from "../components/Status";

export function SettingsScreen({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await onSignOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Sign out failed.");
      setSigningOut(false);
    }
  };

  return (
    <div className="screen-stack">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Account</h1>
          <p>Your workout data is tied to this authenticated account.</p>
        </div>
      </header>

      <section className="panel account-panel">
        <div className="account-avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</div>
        <div><span>Signed in as</span><strong>{email}</strong></div>
        <button type="button" className="secondary-button" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </section>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="panel settings-list">
        <div className="setting-row"><div><span>Weight unit</span><p>All weight entry fields default to pounds.</p></div><strong>lb</strong></div>
        <div className="setting-row"><div><span>Workout day</span><p>Location and Day 1–3 remain manually selected. The app never advances them automatically.</p></div><strong>Manual</strong></div>
        <div className="setting-row"><div><span>Weight progression</span><p>The app shows prior performance but never prescribes or automatically increases load.</p></div><strong>Your choice</strong></div>
      </section>

      <section className="panel security-panel">
        <div className="security-icon" aria-hidden="true">✓</div>
        <div>
          <h2>Database-enforced privacy</h2>
          <p>Supabase Row Level Security checks your authenticated user ID for every workout, performed exercise, and set-log read or write. The browser never receives a service-role key.</p>
        </div>
      </section>

      <section className="panel effort-settings">
        <h2>Effort reference</h2>
        <div className="effort-scale">
          <div><strong>8</strong><span>Approximately two good reps remained</span><i>Normal target</i></div>
          <div><strong>9</strong><span>Approximately one good rep remained</span><i>Normal target</i></div>
          <div><strong>10</strong><span>Another clean rep was not possible</span></div>
        </div>
        <p>You may record any whole-number effort score from 1 through 10.</p>
      </section>
    </div>
  );
}

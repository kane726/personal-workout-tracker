import { useState, type FormEvent } from "react";
import { Notice } from "../components/Status";

export function AuthScreen({
  configured,
  onSendLink,
}: {
  configured: boolean;
  onSendLink: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      await onSendLink(email.trim());
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The sign-in link could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-lockup auth-brand">
          <span className="brand-mark" aria-hidden="true">W</span>
          <div>
            <strong>Workout Tracker</strong>
            <span>Office and home strength sessions</span>
          </div>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">Private training log</p>
          <h1>Pick up where you left off.</h1>
          <p>Your workouts, set history, and exercise progress stay synchronized across your devices.</p>
        </div>

        {!configured ? (
          <Notice tone="warning">
            <strong>Setup required.</strong> Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then rebuild the site. The README includes the exact steps.
          </Notice>
        ) : sent ? (
          <Notice tone="success">
            <strong>Check your email.</strong> Open the secure magic link on this device to finish signing in.
          </Notice>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <button className="primary-button" type="submit" disabled={sending || !email.trim()}>
              {sending ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
        <p className="fine-print">No password to remember. Only your signed-in account can access your workout records.</p>
      </section>
    </main>
  );
}

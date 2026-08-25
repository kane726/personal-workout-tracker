import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, sendMagicLink, signOut as supabaseSignOut, supabaseConfigured } from "./supabase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  sendLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const client = getSupabase();
    let mounted = true;

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.error(error);
        setUser(data.session?.user ?? null);
        setLoading(false);
        if (data.session && window.location.search.includes("code=")) {
          window.history.replaceState({}, "", `${window.location.pathname}#/workout`);
        }
      })
      .catch(() => mounted && setLoading(false));

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session && !window.location.hash.startsWith("#/")) window.location.hash = "#/workout";
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: supabaseConfigured,
      sendLink: sendMagicLink,
      signOut: supabaseSignOut,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

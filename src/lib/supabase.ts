import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && publishableKey);

let singleton: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured. Add the two VITE_SUPABASE environment variables.");
  }
  singleton ??= createClient(supabaseUrl, publishableKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "personal-workout-tracker-auth",
    },
  });
  return singleton;
}

export async function sendMagicLink(email: string) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export function getUserIdentity(user: User) {
  return {
    id: user.id,
    email: user.email ?? "Signed-in user",
  };
}

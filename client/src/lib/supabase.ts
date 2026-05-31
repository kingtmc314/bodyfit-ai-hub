import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://awvpavxgsikzmmrwspqp.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * Sign in with Google OAuth via Supabase.
 * Supabase handles the OAuth flow and redirects back to /auth/callback.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

/**
 * Sign in with GitHub OAuth via Supabase.
 */
export async function signInWithGithub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

/**
 * Sign in with magic link (OTP email) via Supabase.
 * Supabase sends an email with a link that redirects back to /auth/callback.
 */
export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      shouldCreateUser: false, // Only allow existing users
    },
  });
  if (error) throw error;
}

/**
 * Sign out from both Supabase and our app session.
 */
export async function supabaseSignOut() {
  await supabase.auth.signOut();
}

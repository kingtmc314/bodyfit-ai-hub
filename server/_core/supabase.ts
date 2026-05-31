import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

/**
 * Supabase admin client (service role) — for server-side operations that bypass RLS.
 * Never expose this to the frontend.
 */
export const supabaseAdmin = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Verify a Supabase access token and return the user's email + id.
 * Used in the auth context to identify the logged-in user.
 */
export async function verifySupabaseToken(
  accessToken: string
): Promise<{ id: string; email: string | undefined } | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

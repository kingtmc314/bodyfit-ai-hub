import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

/**
 * AuthCallback page — Supabase redirects here after OAuth completes.
 * We detect the session from the URL hash/code, exchange it for our app session cookie,
 * then redirect to the home page.
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    async function handleCallback() {
      try {
        // Supabase client automatically handles the URL hash/code exchange
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[AuthCallback] Supabase session error:", error);
          setLocation("/?auth_error=1");
          return;
        }

        if (!data.session?.access_token) {
          // Wait briefly for Supabase to process the URL hash
          await new Promise((r) => setTimeout(r, 1000));
          const { data: retryData } = await supabase.auth.getSession();
          if (!retryData.session?.access_token) {
            console.error("[AuthCallback] No session after retry");
            setLocation("/?auth_error=1");
            return;
          }
          // Exchange with server
          await exchangeSession(retryData.session.access_token);
        } else {
          await exchangeSession(data.session.access_token);
        }

        // Invalidate auth cache and redirect home
        await utils.auth.me.invalidate();
        setLocation("/");
      } catch (err) {
        console.error("[AuthCallback] Unexpected error:", err);
        setLocation("/?auth_error=1");
      }
    }

    async function exchangeSession(accessToken: string) {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Session exchange failed");
      }
    }

    handleCallback();
  }, [setLocation, utils]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}

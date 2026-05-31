import { Activity, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithMagicLink } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("kingsleytsemc314@gmail.com");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAuthError(null);
    setIsLoading(true);
    try {
      await signInWithMagicLink(email.trim());
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send magic link";
      // "Email not found" means user doesn't exist — show a friendly message
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("user not found")) {
        setAuthError("This email is not registered. Only the owner can log in.");
      } else {
        setAuthError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">{t("app.title")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("login.description")}</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 card-glow">
          {sent ? (
            /* Success state */
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/15 mb-2">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
              <p className="text-muted-foreground text-sm">
                We sent a magic link to <span className="font-medium text-foreground">{email}</span>.
                Click the link to sign in — it expires in 1 hour.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Didn't receive it? Check your spam folder, or{" "}
                <button
                  className="text-primary underline underline-offset-2"
                  onClick={() => { setSent(false); setAuthError(null); }}
                >
                  try again
                </button>.
              </p>
            </div>
          ) : (
            /* Email form */
            <>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("login.welcome_back")}</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Enter your email to receive a magic sign-in link
              </p>

              {authError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 mb-4">
                  {authError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11"
                    required
                    autoComplete="email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold gap-2"
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Send magic link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground mt-3">
                All login methods are linked to the same account by email
              </p>
            </>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 text-center border-t border-border pt-5">
            {[
              { label: t("nav.nutrition"), sub: t("nutrition.subtitle") },
              { label: t("nav.workout"), sub: t("workout.subtitle") },
              { label: t("nav.sleep"), sub: t("sleep.subtitle") },
            ].map(f => (
              <div key={f.label} className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Synced with King's Running AI Analytics
        </p>
      </div>
    </div>
  );
}

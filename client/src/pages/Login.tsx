import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">BodyFit AI Hub</h1>
          <p className="text-muted-foreground mt-2 text-sm">Your personal health & fitness command centre</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 card-glow">
          <h2 className="text-xl font-semibold text-foreground mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-6">Sign in to access your health data</p>

          <Button
            className="w-full h-11 font-semibold"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            <Activity className="w-4 h-4 mr-2" />
            Sign in with Manus
          </Button>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Nutrition", sub: "Track meals & macros" },
              { label: "Fitness", sub: "Log workouts" },
              { label: "Health", sub: "Body & sleep data" },
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

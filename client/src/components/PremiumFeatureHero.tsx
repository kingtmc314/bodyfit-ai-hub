import type { ElementType, ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeatureHeroMetric = {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
};

type PremiumFeatureHeroProps = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  icon: ElementType;
  tone: "nutrition" | "workout" | "sleep";
  actions?: ReactNode;
  metrics: FeatureHeroMetric[];
};

/**
 * Shared premium header for data-focused health pages.
 * Keeps hierarchy and responsive metrics consistent with the dashboard hero.
 */
export default function PremiumFeatureHero({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  tone,
  actions,
  metrics,
}: PremiumFeatureHeroProps) {
  return (
    <section className={cn("feature-hero", `feature-hero-${tone}`)}>
      <div className="feature-hero-orbit feature-hero-orbit-one" />
      <div className="feature-hero-orbit feature-hero-orbit-two" />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="feature-hero-eyebrow">
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>{eyebrow ?? "健康數據中心"}</span>
            </div>
            <h1 className="feature-hero-title">{title}</h1>
            <p className="feature-hero-subtitle">{subtitle}</p>
          </div>
          {actions && <div className="feature-hero-actions">{actions}</div>}
        </div>

        <div className={cn(
          "feature-hero-metrics",
          metrics.length <= 3
            ? "feature-hero-metrics-three"
            : metrics.length === 4
              ? "feature-hero-metrics-four"
              : "feature-hero-metrics-many"
        )}>
          {metrics.map((metric) => (
            <div key={metric.label} className="feature-hero-metric">
              <p className="feature-hero-metric-label">{metric.label}</p>
              <p className="feature-hero-metric-value">
                {metric.value ?? "—"}
                {metric.unit && <span>{metric.unit}</span>}
              </p>
              {metric.detail && <div className="feature-hero-metric-detail">{metric.detail}</div>}
            </div>
          ))}
        </div>
      </div>

      <Sparkles className="feature-hero-sparkle" aria-hidden="true" />
    </section>
  );
}

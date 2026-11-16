import { useTranslation } from "react-i18next";
import MuscleAreaMap from "@/components/MuscleAreaMap";
import { cn } from "@/lib/utils";
import {
  getExerciseAnatomy,
  type AnatomyExerciseInput,
  type ExerciseAnatomy,
  type MuscleRole,
} from "@shared/exerciseMotionMuscles";

export const MUSCLE_ROLE_COLORS = {
  primary: "#f59e0b",
  secondary: "#0d9488",
} as const;
export const MUSCLE_ROLE_STROKES = {
  primary: "#92400e",
  secondary: "#115e59",
} as const;

export interface ExerciseMuscleAnatomyProps {
  exercise: AnatomyExerciseInput;
  compact?: boolean;
  className?: string;
}

/** Shared textual legend: roles remain understandable without color perception. */
export function ExerciseMuscleLegend({
  anatomy,
  compact = false,
  locations = false,
}: {
  anatomy: ExerciseAnatomy;
  compact?: boolean;
  locations?: boolean;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  return (
    <div
      data-exercise-muscle-legend
      className={cn("space-y-3", compact && "space-y-2")}
    >
      {(["primary", "secondary"] as MuscleRole[]).map(role => (
        <div
          key={role}
          data-muscle-role={role}
          className="flex flex-wrap items-start gap-x-3 gap-y-1.5"
        >
          <div className="inline-flex min-w-24 items-center gap-2 pt-1 text-xs font-semibold">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-sm border-2"
              style={{
                background: MUSCLE_ROLE_COLORS[role],
                borderColor: MUSCLE_ROLE_STROKES[role],
                borderStyle: role === "primary" ? "solid" : "dashed",
              }}
            />
            {role === "primary"
              ? zh
                ? "主要肌群"
                : "Primary muscles"
              : zh
                ? "輔助肌群"
                : "Secondary muscles"}
          </div>
          <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {anatomy[role].map(muscle => (
              <li
                key={muscle.id}
                data-anatomy-muscle-id={muscle.id}
                className={cn(
                  "min-w-0 rounded-lg border px-2.5 py-1",
                  role === "primary"
                    ? "border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border-dashed border-teal-300/60 bg-teal-50 text-teal-950 dark:border-teal-700/50 dark:bg-teal-950/40 dark:text-teal-100",
                  locations && "w-full"
                )}
              >
                <span className="block text-xs font-semibold leading-relaxed">
                  {zh ? muscle.zh : muscle.en}
                </span>
                <span className="block text-[10px] leading-relaxed opacity-80">
                  {zh ? muscle.en : muscle.zh}
                </span>
                {locations && (
                  <p className="mt-1 text-[11px] leading-relaxed opacity-80">
                    {zh ? muscle.locationZh : muscle.locationEn}
                  </p>
                )}
              </li>
            ))}
            {!anatomy[role].length && (
              <li className="py-1 text-[11px] text-muted-foreground">
                {zh ? "未指定" : "Not assigned"}
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Reuses the standard front/back muscle geometry; scoped tones never alter volume maps or 3D panels. */
export default function ExerciseMuscleAnatomy({
  exercise,
  compact = false,
  className,
}: ExerciseMuscleAnatomyProps) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const anatomy = getExerciseAnatomy(exercise);
  return (
    <section
      data-exercise-muscle-anatomy
      data-anatomy-basis={anatomy.basis}
      aria-label={
        zh ? "動作肌肉位置與角色" : "Exercise muscle locations and roles"
      }
      className={cn(
        "rounded-2xl border border-border/50 bg-card p-3 sm:p-4",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {zh ? "肌肉位置" : "Muscle anatomy"}
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
            {zh ? "Muscle anatomy" : "肌肉位置"}
          </span>
        </h3>
        <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
          {zh ? "定性解剖示意" : "Qualitative anatomy"}
        </span>
      </div>
      {anatomy.basis === "category" && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {zh
            ? "尚無此動作的專屬肌群資料；以下只表示所選肌群分類，不代表此動作已獲核實，亦不會用其他動作代替動畫。"
            : "No exercise-specific muscle mapping. Only the selected category is shown; it does not verify this movement or enable a substitute animation."}
        </p>
      )}
      {!anatomy.primary.length && !anatomy.secondary.length ? (
        <p className="text-xs text-muted-foreground">
          {zh ? "未有可標示的肌肉位置。" : "No muscle locations assigned."}
        </p>
      ) : (
        <div
          className={cn(
            "grid items-start gap-4",
            !compact && "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
          )}
        >
          <MuscleAreaMap
            primary={anatomy.primary.map(m => m.id)}
            secondary={anatomy.secondary.map(m => m.id)}
            showLegend={false}
            className={cn(
              "!p-2 [&_path[data-muscle-tone=primary]]:!fill-amber-500 [&_path[data-muscle-tone=primary]]:!stroke-amber-800 [&_path[data-muscle-tone=secondary]]:!fill-teal-600 [&_path[data-muscle-tone=secondary]]:!stroke-teal-950 [&_path[data-muscle-tone=secondary]]:[stroke-dasharray:3_1.5] [&_path[data-muscle-tone=neutral]]:!fill-slate-200 dark:[&_path[data-muscle-tone=neutral]]:!fill-slate-700",
              compact ? "[&_svg]:!max-h-[190px]" : "[&_svg]:!max-h-[280px]"
            )}
          />
          <ExerciseMuscleLegend
            anatomy={anatomy}
            compact={compact}
            locations={!compact}
          />
        </div>
      )}
      <p className="mt-3 border-t border-border/50 pt-3 text-[10px] leading-relaxed text-muted-foreground">
        {zh
          ? "琥珀色＋實線＝主要；青綠色＋虛線＝輔助。前／後圖為位置參考，臀中肌等深層區域為示意露出；不是精確肌肉邊界。分類不表示每塊肌肉同樣出力，亦非實測 EMG、活化比例、疲勞或個人姿勢評估。"
          : "Amber + solid outline = primary; teal + dashed outline = secondary. Front/back location reference; deep regions such as gluteus medius are exposed schematically, not exact muscle boundaries. Roles do not imply equal effort, measured EMG, activation percentages, fatigue or a personal posture assessment."}
      </p>
    </section>
  );
}

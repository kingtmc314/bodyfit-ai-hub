import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity as ActivityIcon,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  History,
  Star,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { getExerciseMuscles } from "@shared/exerciseMuscles";
import { getExerciseGuide } from "@shared/exerciseGuides";
import { getGymworkReference } from "@shared/gymworkReferences";
import ExerciseMotionPreview from "./ExerciseMotionPreview";

export const STUDIO_MUSCLE_LABELS: Record<string, [string, string]> = {
  chest: ["胸肌", "Chest"],
  back: ["背肌", "Back"],
  lats: ["背闊肌", "Lats"],
  shoulders: ["三角肌", "Deltoids"],
  biceps: ["肱二頭肌", "Biceps"],
  triceps: ["肱三頭肌", "Triceps"],
  forearms: ["前臂", "Forearms"],
  abs: ["腹直肌", "Abs"],
  obliques: ["腹斜肌", "Obliques"],
  core: ["核心", "Core"],
  quads: ["股四頭肌", "Quads"],
  hamstrings: ["腿後肌", "Hamstrings"],
  glutes: ["臀肌", "Glutes"],
  calves: ["小腿肌", "Calves"],
  traps: ["斜方肌", "Traps"],
  adductors: ["髖內收肌", "Hip adductors"],
  abductors: ["髖外展肌", "Hip abductors"],
  glute_medius: ["臀中肌", "Gluteus medius"],
  lower_back: ["下背豎脊肌", "Lower back"],
  cardio: ["有氧訓練", "Cardio"],
};
export function studioMuscleLabel(id: string, isZh = true) {
  return (
    STUDIO_MUSCLE_LABELS[id]?.[isZh ? 0 : 1] ||
    id ||
    (isZh ? "肌群未分類" : "Unclassified muscle")
  );
}
export function useStudioLanguage() {
  const { i18n } = useTranslation();
  return !i18n?.language || i18n.language.startsWith("zh");
}

/** Scoped studio tokens include portal dialogs without changing the surrounding app. */
export function WorkoutStudioStyles() {
  return (
    <style>{`
    .workout-studio,.workout-studio-dialog{--background:#f7f7f4;--foreground:#172b3b;--card:#fff;--card-foreground:#172b3b;--popover:#fff;--popover-foreground:#172b3b;--primary:#126b64;--primary-foreground:#fff;--secondary:#eef3f1;--secondary-foreground:#334b53;--muted:#eff2f0;--muted-foreground:#64717a;--accent:#e7f2ee;--accent-foreground:#126b64;--border:#e1e6e3;--input:#d7ded9;--ring:#126b64;--destructive:#b43b3b;color:var(--foreground);color-scheme:light}
    .dark .workout-studio,.dark .workout-studio-dialog{--background:#101b24;--foreground:#e2ebed;--card:#16242e;--card-foreground:#e2ebed;--popover:#16242e;--popover-foreground:#e2ebed;--primary:#278d80;--primary-foreground:#fff;--secondary:#20333c;--secondary-foreground:#c5d6da;--muted:#203039;--muted-foreground:#a4b5bc;--accent:#203b3c;--accent-foreground:#8bd0bf;--border:#2a3b43;--input:#32444c;--ring:#72c6b3;color-scheme:dark}
    .workout-studio{background:var(--background);border-radius:24px;isolation:isolate;min-width:0;overflow-wrap:anywhere;padding-bottom:calc(24px + env(safe-area-inset-bottom))}
    .workout-studio *,.workout-studio-dialog *{box-sizing:border-box}
    .workout-studio button,.workout-studio [role=combobox],.workout-studio input,.workout-studio select,.workout-studio-dialog button,.workout-studio-dialog input,.workout-studio-dialog select{min-height:44px}
    .workout-studio button,.workout-studio-dialog button{cursor:pointer;touch-action:manipulation}
    .workout-studio button:disabled,.workout-studio-dialog button:disabled{cursor:not-allowed}
    .workout-studio button:focus-visible,.workout-studio-dialog button:focus-visible{outline:2px solid var(--ring);outline-offset:3px}
    .workout-studio .studio-icon-action{min-width:44px;width:44px;height:44px;padding:0;flex-shrink:0}
    .workout-studio .studio-session-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
    .workout-studio .studio-session-log{min-width:0;order:0}
    .workout-studio .studio-muscle-aside{min-width:0;order:1;align-self:start}
    .workout-studio .studio-set-head,.workout-studio .studio-set-row{display:grid;grid-template-columns:30px minmax(0,1fr) minmax(0,1fr) 44px;gap:8px;align-items:center;padding:8px 12px}
    .workout-studio .studio-set-head{background:var(--muted);color:var(--muted-foreground);font-size:12px;font-weight:500}
    .workout-studio .studio-set-row{border-bottom:1px solid var(--border);min-width:0}
    .workout-studio .studio-set-actions{grid-column:2 / -1;display:flex;justify-content:flex-end;gap:4px;align-items:center}
    .workout-studio .studio-rest-dock{position:sticky;bottom:calc(92px + env(safe-area-inset-bottom));z-index:20;box-shadow:0 8px 32px #15294712}
    .workout-studio [data-muscle-area-map]{background:var(--muted)!important;color:var(--foreground)!important}
    .workout-studio [data-muscle-area-map] p{color:var(--muted-foreground)!important}
    .workout-studio .studio-stat{font-variant-numeric:tabular-nums}
    .workout-studio-dialog{max-width:calc(100vw - 24px);padding-bottom:calc(24px + env(safe-area-inset-bottom));background:var(--card)}
    .workout-exercise-detail{padding-bottom:0;width:min(768px,calc(100vw - 24px));gap:0}
    .workout-studio .studio-nav{display:flex;height:auto;max-width:100%;overflow-x:auto;justify-content:flex-start;border-radius:0;border:0;border-bottom:1px solid var(--border);background:transparent;padding:0;gap:20px;scrollbar-width:none}
    .workout-studio .studio-nav>button{flex:none;white-space:nowrap;border-radius:0;border-bottom:2px solid transparent;background:transparent;padding:12px 2px;font-size:13px;box-shadow:none;color:var(--muted-foreground)}
    .workout-studio .studio-nav>button[data-state=active]{border-bottom-color:var(--primary);color:var(--foreground);font-weight:600}
    .workout-studio .studio-exercise-card{box-shadow:0 2px 8px #172b3b04}
    .workout-studio .studio-session-log{gap:20px}
    .workout-studio .text-blue-600,.workout-studio .text-purple-500,.workout-studio-dialog .text-blue-600{color:var(--primary)}
    .workout-studio .bg-blue-600{background:var(--primary)}
    .dark .workout-studio .bg-white,.dark .workout-studio-dialog .bg-white{background:var(--card)}
    .dark .workout-studio .bg-slate-50,.dark .workout-studio .bg-slate-100{background:var(--muted)}
    .dark .workout-studio .text-slate-600,.dark .workout-studio .text-slate-700{color:var(--muted-foreground)}
    @media(min-width:768px){.workout-studio .studio-set-head,.workout-studio .studio-set-row{grid-template-columns:44px minmax(0,1fr) minmax(0,1fr) 44px 144px;padding:8px 20px}.workout-studio .studio-set-actions{grid-column:auto}}
    @media(min-width:1024px){.workout-studio .studio-session-layout{grid-template-columns:minmax(0,1fr) 300px}.workout-studio .studio-muscle-aside{order:1}.workout-studio .studio-session-log{order:0}.workout-studio .studio-rest-dock{bottom:12px}}
    @media(prefers-reduced-motion:no-preference){.workout-studio button,.workout-studio-dialog button{transition:background-color 160ms ease-out,transform 160ms ease-out}.workout-studio button:active,.workout-studio-dialog button:active{transform:scale(.98)}}
  `}</style>
  );
}

export function WorkoutStudioHeader({
  title,
  subtitle,
  status,
  actions,
  workoutTime,
  timeNote,
  volume,
  energy,
  sets,
  onFinish,
  finishing,
}: {
  title: string;
  subtitle: string;
  status: string;
  actions: ReactNode;
  workoutTime: string;
  timeNote: string;
  volume: string;
  energy: string;
  sets: number | null;
  onFinish?: () => void;
  finishing?: boolean;
}) {
  const isZh = useStudioLanguage();
  return (
    <header className="overflow-hidden rounded-3xl border border-border/70 bg-card text-card-foreground shadow-[0_4px_24px_rgba(23,43,59,0.035)]">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div className="min-w-0">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.18em] text-primary">
            BODYFIT / WORKOUT STUDIO
          </p>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
            {status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      <div className="flex items-center justify-between gap-4 border-y border-border/60 bg-muted/25 px-5 py-5 sm:px-7">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            {isZh ? "訓練時間" : "Workout time"}
          </p>
          <p className="studio-stat mt-1 text-3xl font-semibold tracking-tight">
            {workoutTime}
          </p>
          <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
            {timeNote}
          </p>
        </div>
        {onFinish && (
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing}
            className="flex min-w-24 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {finishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isZh ? "結束訓練" : "Finish"}
          </button>
        )}
      </div>
      <dl className="grid grid-cols-3 divide-x divide-border px-3 py-4 sm:px-5">
        {[
          [isZh ? "訓練量" : "Volume", volume, "kg"],
          [isZh ? "活動熱量估算" : "Est. active energy", energy, "kcal"],
          [
            isZh ? "已記錄組數" : "Logged sets",
            sets == null ? "—" : String(sets),
            isZh ? "組" : "sets",
          ],
        ].map(([label, value, unit]) => (
          <div key={label} className="min-w-0 px-2 sm:px-4">
            <dt className="text-xs font-medium leading-5 text-muted-foreground">
              {label}
            </dt>
            <dd className="studio-stat mt-2 break-words text-xl font-semibold sm:text-2xl">
              {value}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {unit}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

type StudioExercise = {
  name: string;
  nameZh?: string;
  muscleGroup: string;
  equipment: string;
  instructions?: string;
  identityNotice?: string;
  variantLabel?: string;
};
export function WorkoutStudioExerciseHeading({
  exercise,
  onOpen,
  active = false,
}: {
  exercise: StudioExercise;
  onOpen: () => void;
  active?: boolean;
}) {
  const isZh = useStudioLanguage();
  const anatomy = getExerciseMuscles(exercise);
  const guide = getExerciseGuide(exercise.name, exercise.equipment);
  const demoLabel = guide
    ? isZh
      ? "動作示範"
      : "Movement demonstration"
    : isZh
      ? "肌群與步驟"
      : "Muscles & steps";
  return (
    <div className="flex min-w-0 items-start gap-4">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${demoLabel} ${exercise.name}`}
        title={`${demoLabel} ${exercise.name}`}
        className="flex w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/30 p-1 text-primary sm:w-24"
      >
        {guide ? (
          <ExerciseMotionPreview
            exercise={exercise}
            compact
            autoplay={false}
            className="w-full"
          />
        ) : (
          <span className="flex flex-col items-center gap-1 py-2">
            <ActivityIcon aria-hidden="true" className="h-5 w-5" />
            <span className="text-[10px] leading-4">
              {isZh ? "肌群與步驟" : "Muscles & steps"}
            </span>
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${isZh ? "查看訓練紀錄" : "View history"} ${exercise.name}`}
          className="min-h-11 text-left text-base font-semibold leading-6 hover:text-primary"
        >
          {isZh ? exercise.nameZh || exercise.name : exercise.name}
        </button>
        {exercise.variantLabel && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {exercise.variantLabel}
          </p>
        )}
        {isZh && exercise.nameZh && (
          <p className="text-xs text-muted-foreground">{exercise.name}</p>
        )}
        <p className="mt-2 text-xs font-medium leading-5 text-primary">
          {anatomy.primary.length
            ? anatomy.primary.map(id => studioMuscleLabel(id, isZh)).join(" · ")
            : studioMuscleLabel(exercise.muscleGroup, isZh)}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {exercise.equipment ||
            (isZh ? "器材未記錄" : "Equipment not recorded")}
        </p>
        {anatomy.secondary.length > 0 && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isZh ? "輔助" : "Secondary"}:{" "}
            {anatomy.secondary
              .map(id => studioMuscleLabel(id, isZh))
              .join(" · ")}
          </p>
        )}
        {exercise.identityNotice && exercise.variantLabel && (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {exercise.identityNotice}
          </p>
        )}
        {anatomy.basis === "category" && exercise.muscleGroup !== "cardio" && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {isZh ? "分類肌群，需核對" : "Category mapping — verify"}
          </p>
        )}
      </div>
    </div>
  );
}

export function WorkoutStudioRestBar({
  seconds,
  preset,
  running,
  onPreset,
  onAdjust,
  onToggle,
  onReset,
  onAddExercise,
  onAddSet,
  exerciseName,
}: {
  seconds: number;
  preset: number;
  running: boolean;
  onPreset: (seconds: number) => void;
  onAdjust: (delta: number) => void;
  onToggle: () => void;
  onReset: () => void;
  onAddExercise: () => void;
  onAddSet?: () => void;
  exerciseName?: string;
}) {
  const isZh = useStudioLanguage();
  return (
    <section
      aria-label={
        isZh ? "休息計時器與新增動作" : "Rest timer and workout actions"
      }
      className="studio-rest-dock rounded-2xl border border-blue-200 bg-white p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isZh ? "休息計時器" : "Rest timer"}
            </p>
            <p
              role="timer"
              aria-label={isZh ? "剩餘休息時間" : "Remaining rest"}
              className="studio-stat text-2xl font-bold"
            >
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="studio-icon-action rounded-lg bg-slate-100"
            aria-label={isZh ? "減少休息 15 秒" : "Subtract 15 seconds"}
            onClick={() => onAdjust(-15)}
          >
            <Minus className="mx-auto h-4 w-4" />
          </button>
          <button
            type="button"
            className="studio-icon-action rounded-lg bg-slate-100"
            aria-label={isZh ? "增加休息 15 秒" : "Add 15 seconds"}
            onClick={() => onAdjust(15)}
          >
            <Plus className="mx-auto h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={seconds === 0}
            className="studio-icon-action rounded-lg bg-blue-50 text-blue-600 disabled:opacity-40"
            aria-label={
              running
                ? isZh
                  ? "暫停休息"
                  : "Pause rest"
                : isZh
                  ? "繼續休息"
                  : "Resume rest"
            }
            onClick={onToggle}
          >
            {running ? (
              <Pause className="mx-auto h-4 w-4" />
            ) : (
              <Play className="mx-auto h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {[45, 60, 90, 120].map(value => (
          <button
            type="button"
            key={value}
            aria-pressed={preset === value}
            onClick={() => onPreset(value)}
            className={`min-w-12 rounded-lg px-2 text-xs font-semibold ${preset === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {value}s
          </button>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 text-xs text-slate-500"
        >
          <RotateCcw className="h-3 w-3" />
          {isZh ? "重設" : "Reset"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAddExercise}
          className="flex items-center justify-center gap-1 rounded-xl border border-blue-200 px-2 text-xs font-bold text-blue-600"
        >
          <Plus className="h-4 w-4" />
          {isZh ? "新增動作" : "Add exercise"}
        </button>
        <button
          type="button"
          onClick={onAddSet || onAddExercise}
          className="flex min-w-0 items-center justify-center gap-1 rounded-xl bg-blue-600 px-2 text-xs font-bold text-white"
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {onAddSet
              ? isZh
                ? "下一組 · 一鍵預填"
                : "Next set"
              : isZh
                ? "記錄第一組"
                : "Log first set"}
          </span>
        </button>
      </div>
      {exerciseName && (
        <p className="mt-2 truncate text-[10px] text-muted-foreground">
          {isZh ? "下一組" : "Next"}: {exerciseName}
        </p>
      )}
    </section>
  );
}

export function WorkoutStudioLibraryCard({
  exercise,
  onOpen,
  onAdd,
  onFavourite,
  favourite,
  onDelete,
}: {
  exercise: StudioExercise & { id?: number; isCustom?: boolean };
  onOpen: () => void;
  onAdd?: () => void;
  onFavourite?: () => void;
  favourite?: boolean;
  onDelete?: () => void;
}) {
  const isZh = useStudioLanguage();
  const anatomy = getExerciseMuscles(exercise);
  const guide = getExerciseGuide(exercise.name, exercise.equipment);
  const reference = getGymworkReference(exercise.name, exercise.equipment);
  const label = guide
    ? isZh
      ? "動作示範"
      : "Movement demonstration"
    : isZh
      ? "肌群與步驟"
      : "Muscles & steps";
  return (
    <article
      data-exercise-name={exercise.name}
      className="studio-exercise-card group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground transition-colors hover:border-primary/40"
    >
      <div className="flex min-h-36 items-center justify-center border-b border-border/40 bg-muted/25 px-5 py-4">
        {guide ? (
          <ExerciseMotionPreview
            exercise={exercise}
            compact
            autoplay={false}
            className="w-full max-w-48"
          />
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded-xl text-muted-foreground">
            <ActivityIcon aria-hidden="true" className="h-8 w-8 stroke-[1.3]" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3>
              <button
                type="button"
                onClick={onOpen}
                aria-label={`${isZh ? "查看訓練紀錄" : "View history"} ${exercise.name}`}
                className="min-h-11 text-left text-base font-semibold leading-6 hover:text-primary"
              >
                {isZh ? exercise.nameZh || exercise.name : exercise.name}
              </button>
            </h3>
            {isZh && exercise.nameZh && (
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {exercise.name}
              </p>
            )}
            {exercise.variantLabel && (
              <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-400">
                {exercise.variantLabel}
              </p>
            )}
          </div>
          {(onFavourite || onDelete) && (
            <button
              type="button"
              onClick={onDelete || onFavourite}
              aria-label={
                onDelete
                  ? `刪除自訂動作 ${exercise.name}`
                  : `切換收藏 ${exercise.name}`
              }
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${favourite ? "text-amber-600" : "text-muted-foreground hover:bg-muted"}`}
            >
              {onDelete ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <Star
                  className={`h-4 w-4 ${favourite ? "fill-current" : ""}`}
                />
              )}
            </button>
          )}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {exercise.equipment}
          {exercise.isCustom ? (isZh ? " · 自訂" : " · Custom") : ""}
        </p>
        <p className="mt-1 text-sm leading-6 text-primary">
          {anatomy.primary.length
            ? anatomy.primary.map(id => studioMuscleLabel(id, isZh)).join(" · ")
            : studioMuscleLabel(exercise.muscleGroup, isZh)}
        </p>
        {exercise.variantLabel && exercise.identityNotice && (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {exercise.identityNotice}
          </p>
        )}
        <div className="mt-auto flex gap-2 pt-5">
          <button
            type="button"
            onClick={onOpen}
            aria-label={`${label} ${exercise.name}`}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/40"
          >
            <History className="h-4 w-4" />
            {isZh ? "紀錄與詳情" : "History & details"}
          </button>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`新增 ${exercise.name} 至課程`}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {isZh ? "加入" : "Add"}
            </button>
          )}
        </div>
        {reference && (
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Gymwork 原作 ${exercise.name}`}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4"
          >
            Gymwork {isZh ? "外部參考" : "external reference"}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}

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
} from "lucide-react";
import { getExerciseMuscles } from "@shared/exerciseMuscles";
import { getGymworkReference } from "@shared/gymworkReferences";

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

/** Light studio tokens are deliberately local, including portal-based workout dialogs. */
export function WorkoutStudioStyles() {
  return (
    <style>{`
    .workout-studio,.workout-studio-dialog{--background:#f6f8fb;--foreground:#111827;--card:#fff;--card-foreground:#111827;--popover:#fff;--popover-foreground:#111827;--primary:#2563eb;--primary-foreground:#fff;--secondary:#eff4fb;--secondary-foreground:#334155;--muted:#eef2f7;--muted-foreground:#596579;--accent:#eaf1ff;--accent-foreground:#1e40af;--border:#dde4ed;--input:#d8e0ec;--ring:#2563eb;--destructive:#c53030;color:#111827;color-scheme:light}
    .workout-studio{background:#f6f8fb;border-radius:24px;isolation:isolate;min-width:0;overflow-wrap:anywhere;padding-bottom:calc(24px + env(safe-area-inset-bottom))}
    .workout-studio *,.workout-studio-dialog *{box-sizing:border-box}
    .workout-studio button,.workout-studio [role=combobox],.workout-studio input,.workout-studio select,.workout-studio-dialog button,.workout-studio-dialog input,.workout-studio-dialog select{min-height:44px}
    .workout-studio button,.workout-studio-dialog button{cursor:pointer;touch-action:manipulation}
    .workout-studio button:disabled,.workout-studio-dialog button:disabled{cursor:not-allowed}
    .workout-studio button:focus-visible,.workout-studio-dialog button:focus-visible{outline:2px solid #2563eb;outline-offset:3px}
    .workout-studio .studio-icon-action{min-width:44px;width:44px;height:44px;padding:0;flex-shrink:0}
    .workout-studio .studio-session-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
    .workout-studio .studio-session-log{min-width:0;order:0}
    .workout-studio .studio-muscle-aside{min-width:0;order:1;align-self:start}
    .workout-studio .studio-set-head,.workout-studio .studio-set-row{display:grid;grid-template-columns:30px minmax(0,1fr) minmax(0,1fr) 44px;gap:8px;align-items:center;padding:8px 12px}
    .workout-studio .studio-set-head{background:#f8fafc;color:#64748b;font-size:11px;font-weight:600}
    .workout-studio .studio-set-row{border-bottom:1px solid #edf1f6;min-width:0}
    .workout-studio .studio-set-actions{grid-column:2 / -1;display:flex;justify-content:flex-end;gap:4px;align-items:center}
    .workout-studio .studio-rest-dock{position:sticky;bottom:calc(92px + env(safe-area-inset-bottom));z-index:20;box-shadow:0 8px 32px #1529471c}
    .workout-studio [data-muscle-area-map]{background:#f8fafc!important;color:#334155!important}
    .workout-studio [data-muscle-area-map] p{color:#64748b!important}
    .workout-studio .studio-stat{font-variant-numeric:tabular-nums}
    .workout-studio-dialog{max-width:calc(100vw - 24px);padding-bottom:calc(24px + env(safe-area-inset-bottom));background:#fff}
    @media(min-width:768px){.workout-studio .studio-set-head,.workout-studio .studio-set-row{grid-template-columns:44px minmax(0,1fr) minmax(0,1fr) 44px 144px;padding:8px 20px}.workout-studio .studio-set-actions{grid-column:auto}}
    @media(min-width:1024px){.workout-studio .studio-session-layout{grid-template-columns:minmax(0,1fr) 300px}.workout-studio .studio-muscle-aside{order:1}.workout-studio .studio-session-log{order:0}.workout-studio .studio-rest-dock{bottom:12px}}
    @media(prefers-reduced-motion:no-preference){.workout-studio button{transition:background-color 160ms ease-out,transform 160ms ease-out}.workout-studio button:active{transform:scale(.98)}}
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
    <header className="overflow-hidden rounded-3xl border border-border bg-white">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.2em] text-blue-600">
            BODYFIT / WORKOUT STUDIO
          </p>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {subtitle}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            {status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      <div className="flex items-center justify-between gap-3 border-y border-border bg-slate-50 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Timer className="h-3.5 w-3.5" />
            {isZh ? "訓練時間" : "Workout time"}
          </p>
          <p className="studio-stat mt-1 text-3xl font-bold tracking-tight">
            {workoutTime}
          </p>
          <p className="mt-1 max-w-64 text-[10px] leading-4 text-muted-foreground">
            {timeNote}
          </p>
        </div>
        {onFinish && (
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing}
            className="flex min-w-28 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {finishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isZh ? "結束訓練 · Finish" : "Finish"}
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
            <dt className="text-[10px] font-medium text-muted-foreground sm:text-xs">
              {label}
            </dt>
            <dd className="studio-stat mt-1 break-words text-xl font-extrabold sm:text-2xl">
              {value}
              <span className="ml-1 text-[10px] font-medium text-muted-foreground">
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
  const reference = getGymworkReference(exercise.name, exercise.equipment);
  return (
    <div className="flex min-w-0 items-start gap-3">
      {reference ? (
        <a
          href={reference.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Gymwork 原作 ${exercise.name}`}
          className="flex h-20 w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600"
        >
          <Play className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold">
            Gymwork {isZh ? "原作 ↗" : "original ↗"}
          </span>
        </a>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${isZh ? "肌群與步驟" : "Muscles and steps"} ${exercise.name}`}
          className="flex h-20 w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600"
        >
          <ActivityIcon />
          <span className="mt-1 text-[10px] font-semibold">
            {isZh ? "肌群與步驟" : "View steps"}
          </span>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="text-left text-sm font-bold leading-5"
        >
          {isZh ? exercise.nameZh || exercise.name : exercise.name}
        </button>
        {isZh && exercise.nameZh && (
          <p className="text-[11px] text-muted-foreground">{exercise.name}</p>
        )}
        {reference && (
          <p className="text-[10px] text-muted-foreground">
            {isZh
              ? "原作於 Gymwork 官網開啟，未嵌入或複製素材。"
              : "Original opens on Gymwork; not embedded or copied."}
          </p>
        )}
        <p className="mt-1 text-[11px] font-medium text-blue-600">
          {anatomy.primary.length
            ? anatomy.primary.map(id => studioMuscleLabel(id, isZh)).join(" · ")
            : studioMuscleLabel(exercise.muscleGroup, isZh)}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {exercise.equipment ||
            (isZh ? "器材未記錄" : "Equipment not recorded")}
          {anatomy.secondary.length
            ? ` · ${isZh ? "輔助" : "Secondary"}: ${anatomy.secondary.map(id => studioMuscleLabel(id, isZh)).join(" / ")}`
            : ""}
        </p>
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

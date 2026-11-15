import { lazy, Suspense, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  ExternalLink,
  Boxes,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EXERCISE_DESCRIPTIONS } from "@/data/exerciseDescriptions";
import MuscleAreaMap from "./MuscleAreaMap";
import ExerciseMotionPreview from "./ExerciseMotionPreview";
import { getGymworkReference } from "@shared/gymworkReferences";
import { getExerciseGuide, EXERCISE_GUIDES } from "@shared/exerciseGuides";
import { getExerciseMuscles } from "@shared/exerciseMuscles";
const MuscleModel3D = lazy(() => import("./MuscleModel3D"));
interface Exercise {
  name: string;
  nameZh?: string;
  muscleGroup: string;
  equipment: string;
  instructions?: string;
}
interface Props {
  exercise: Exercise | null;
  open: boolean;
  onClose: () => void;
  onAddToSession?: () => void;
  hasActiveSession?: boolean;
}
const descriptionAliases: Record<string, string> = {
  "Dumbbell Fly": "Dumbbell Flyes",
  "Push-up": "Push-Up",
  "Pec Deck": "Pec Deck Machine",
};
function description(name: string) {
  const exact = descriptionAliases[name] ?? name;
  return (
    EXERCISE_DESCRIPTIONS[exact] ??
    Object.entries(EXERCISE_DESCRIPTIONS).find(
      ([key]) => key.toLowerCase() === exact.toLowerCase()
    )?.[1]
  );
}
export default function ExerciseDetailModal({
  exercise,
  open,
  onClose,
  onAddToSession,
  hasActiveSession,
}: Props) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [show3D, setShow3D] = useState(false);
  if (!exercise) return null;
  const desc = description(exercise.name),
    anatomy = getExerciseMuscles(exercise),
    guide = getExerciseGuide(exercise.name, exercise.equipment);
  const reference = getGymworkReference(exercise.name, exercise.equipment);
  const related = EXERCISE_GUIDES.filter(
    m =>
      m.id !== guide?.id && m.primary.some(id => anatomy.primary.includes(id))
  ).slice(0, 3);
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="max-w-3xl max-h-[92dvh] overflow-y-auto rounded-3xl border-border/50 p-0"
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <DialogHeader className="px-5 pb-2 pt-6 text-left sm:px-7">
          <DialogTitle className="pr-7 text-2xl font-bold tracking-tight">
            {zh ? exercise.nameZh || exercise.name : exercise.name}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>{exercise.name}</span>
            <span>·</span>
            <span>{exercise.equipment}</span>
            <Badge variant="outline" className="text-[10px]">
              {guide
                ? zh
                  ? "簡化動畫"
                  : "Simplified animation"
                : zh
                  ? "肌群與步驟"
                  : "Muscles & steps"}
            </Badge>
          </DialogDescription>
        </DialogHeader>
        {open && (
          <div
            className="space-y-6 px-4 pb-5 sm:px-7"
            key={`${exercise.name}:${exercise.equipment}`}
          >
            {guide ? (
              <section
                aria-label={
                  zh ? "簡化動作示範" : "Simplified movement demonstration"
                }
              >
                <h3 className="mb-3 text-lg font-semibold">
                  {zh ? "簡化動畫" : "Simplified animation"}
                </h3>
                <ExerciseMotionPreview exercise={exercise} autoplay={open} />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {zh
                    ? "免費通用動作示意，非 Gymwork 原作；不保證與現場品牌器械的結構或軌跡完全一致，請配合下方步驟及器械調校。"
                    : "Free generic movement illustration, not a Gymwork original. It may differ from your branded machine's structure or path; follow the technique and machine setup below."}
                </p>
              </section>
            ) : (
              <section
                className="rounded-2xl border border-border/40 bg-muted/30 p-4"
                aria-label={zh ? "肌群與步驟" : "Muscles & steps"}
              >
                <h3 className="font-semibold">
                  {zh ? "肌群與步驟" : "Muscles & steps"}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {zh
                    ? "此動作暫未支援簡化動畫；保留已知肌群與動作說明，不以其他動作代替。"
                    : "Simplified animation is not available for this exercise. Known muscles and instructions remain below; no other movement is substituted."}
                </p>
              </section>
            )}
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {zh ? "肌肉分布" : "Muscle area"}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShow3D(!show3D)}
                >
                  <Boxes className="mr-1.5 h-4 w-4" />
                  {show3D
                    ? zh
                      ? "返回前後面"
                      : "Front & back"
                    : zh
                      ? "3D 肌群檢視"
                      : "Inspect 3D muscles"}
                </Button>
              </div>
              <MuscleAreaMap
                primary={anatomy.primary}
                secondary={anatomy.secondary}
              />
              {show3D && (
                <div className="mt-3">
                  <Suspense
                    fallback={
                      <p className="p-8 text-center text-xs text-muted-foreground">
                        {zh ? "正在載入 3D 肌群…" : "Loading 3D muscles…"}
                      </p>
                    }
                  >
                    <MuscleModel3D
                      primary={anatomy.primary}
                      secondary={anatomy.secondary}
                    />
                  </Suspense>
                </div>
              )}
              {anatomy.basis === "category" && (
                <p className="mt-2 text-[10px] text-amber-700">
                  {zh
                    ? "此自訂動作只按原有分類顯示，未核對逐動作肌群。"
                    : "This custom exercise uses its recorded category, not verified exercise-specific muscles."}
                </p>
              )}
            </section>
            {guide ? (
              <section>
                <h3 className="mb-3 text-lg font-semibold">
                  {zh ? "動作說明" : "Exercise description"}
                </h3>
                <div className="space-y-5 rounded-2xl bg-muted/35 p-5">
                  {[
                    {
                      title: zh ? "起始位置" : "Starting position",
                      items: guide.setup,
                    },
                    {
                      title: zh ? "動作過程" : "During the exercise",
                      items: guide.movement,
                    },
                  ].map(({ title, items }) => (
                    <div key={title}>
                      <h4 className="mb-2 font-semibold">{title}</h4>
                      <ol className="space-y-2 text-sm leading-7">
                        {items.map((text, i) => (
                          <li key={text}>
                            {i + 1}. {text}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  <div>
                    <h4 className="mb-2 font-semibold">
                      {zh ? "呼吸提示" : "Breathing tips"}
                    </h4>
                    <p className="text-sm leading-7">{guide.breathing}</p>
                  </div>
                </div>
                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {guide.safety}
                </p>
              </section>
            ) : desc ? (
              <>
                {[
                  {
                    title: zh ? "動作步驟" : "How to do it",
                    items: zh ? desc.stepsZh : desc.steps,
                    Icon: BookOpen,
                  },
                  {
                    title: zh ? "訓練提示" : "Training tips",
                    items: zh ? desc.tipsZh : desc.tips,
                    Icon: Lightbulb,
                  },
                  {
                    title: zh ? "常見錯誤" : "Common mistakes",
                    items: zh ? desc.mistakesZh : desc.mistakes,
                    Icon: AlertTriangle,
                  },
                ].map(({ title, items, Icon }) => (
                  <section key={title} className="rounded-2xl bg-muted/30 p-5">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold">
                      <Icon className="h-4 w-4 text-blue-600" />
                      {title}
                    </h3>
                    <ol className="space-y-3 text-sm leading-relaxed">
                      {items.map((text, i) => (
                        <li key={text}>
                          {i + 1}. {text}
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </>
            ) : exercise.instructions ? (
              <section className="rounded-2xl bg-muted/30 p-5 text-sm leading-relaxed">
                {exercise.instructions}
              </section>
            ) : null}
            {guide && (
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                {guide.sources.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-8 items-center gap-1 underline"
                  >
                    {zh ? "操作參考" : "Technique reference"} {i + 1}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            )}
            {reference && (
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground underline"
              >
                Gymwork{" "}
                {zh ? "原作（外部參考）" : "original (external reference)"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {!!related.length && (
              <section>
                <h3 className="mb-3 text-lg font-semibold">
                  {zh ? "相關器械動作" : "Related machine movements"}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {related.map(r => {
                    const reference = getGymworkReference(
                      r.name,
                      r.equipment[0]
                    );
                    return (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-border/40 bg-card p-4"
                      >
                        <p className="text-xs font-semibold">
                          {zh ? r.nameZh : r.name}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {r.name}
                        </p>
                        {reference && (
                          <a
                            href={reference.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex min-h-8 items-center gap-1 text-xs text-blue-600"
                          >
                            Gymwork {zh ? "原作" : "original"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border/40 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-7 sm:px-7">
              {hasActiveSession && onAddToSession && (
                <Button
                  className="min-h-11 flex-1 bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    onAddToSession();
                    onClose();
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {zh ? "加入訓練" : "Add to session"}
                </Button>
              )}
              <Button
                className="min-h-11 flex-1"
                variant="outline"
                onClick={onClose}
              >
                {zh ? "關閉" : "Close"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

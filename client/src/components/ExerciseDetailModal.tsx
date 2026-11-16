import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  ExternalLink,
  Boxes,
  History,
  Play,
  Activity,
} from "lucide-react";
import { EXERCISE_DESCRIPTIONS } from "@/data/exerciseDescriptions";
import ExerciseMuscleAnatomy from "./ExerciseMuscleAnatomy";
import ExerciseMotionPreview from "./ExerciseMotionPreview";
import WorkoutExerciseHistoryPanel from "./WorkoutExerciseHistoryPanel";
import { getGymworkReference } from "@shared/gymworkReferences";
import { getExerciseGuide, EXERCISE_GUIDES } from "@shared/exerciseGuides";
import { getExerciseMuscles } from "@shared/exerciseMuscles";
import { WorkoutStudioStyles } from "./WorkoutStudio";
const MuscleModel3D = lazy(() => import("./MuscleModel3D"));
interface Exercise {
  name: string;
  nameZh?: string;
  muscleGroup: string;
  equipment: string;
  instructions?: string;
  identityNotice?: string;
  variantLabel?: string;
}
interface Props {
  exercise: Exercise | null;
  open: boolean;
  onClose: () => void;
  onAddToSession?: () => void;
  hasActiveSession?: boolean;
  weightUnit?: "kg" | "lbs";
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

export default function ExerciseDetailModal(props: Props) {
  const { exercise, open, onClose } = props;
  if (!exercise) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="workout-studio-dialog workout-exercise-detail flex max-h-[92dvh] flex-col overflow-hidden rounded-3xl border-border/60 p-0 sm:max-w-3xl"
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <WorkoutStudioStyles />
        {open && (
          <ExerciseDetailContent
            key={`${exercise.name}:${exercise.equipment}:${exercise.variantLabel ?? ""}`}
            {...props}
            exercise={exercise}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExerciseDetailContent({
  exercise,
  open,
  onClose,
  onAddToSession,
  hasActiveSession,
  weightUnit = "kg",
}: Props & { exercise: Exercise }) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [tab, setTab] = useState("history");
  const [show3D, setShow3D] = useState(false);
  const desc = description(exercise.name);
  const anatomy = getExerciseMuscles(exercise);
  const guide = getExerciseGuide(exercise.name, exercise.equipment);
  const reference = getGymworkReference(exercise.name, exercise.equipment);
  const related = EXERCISE_GUIDES.filter(
    m =>
      m.id !== guide?.id && m.primary.some(id => anatomy.primary.includes(id))
  ).slice(0, 3);
  return (
    <>
      <DialogHeader className="shrink-0 border-b border-border/60 px-5 pb-5 pt-6 text-left sm:px-7">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-teal-700 dark:text-teal-400">
          {zh ? "動作檔案" : "MOVEMENT PROFILE"}
        </p>
        <DialogTitle className="pr-7 text-xl font-semibold leading-8 tracking-tight sm:text-2xl">
          {zh ? exercise.nameZh || exercise.name : exercise.name}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm leading-6">
          {zh && exercise.nameZh ? `${exercise.name} · ` : ""}
          {exercise.equipment || (zh ? "器材未記錄" : "Equipment not recorded")}
          {exercise.variantLabel && (
            <span className="ml-2 text-amber-700 dark:text-amber-400">
              {exercise.variantLabel}
            </span>
          )}
        </DialogDescription>
      </DialogHeader>
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 px-4 py-3 sm:px-7">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/55 p-1 [&>button]:min-h-11 [&>button]:gap-1.5 [&>button]:text-xs sm:[&>button]:text-sm">
            <TabsTrigger value="history">
              <History className="h-4 w-4" />
              {zh ? "訓練紀錄" : "History"}
            </TabsTrigger>
            <TabsTrigger value="demonstration">
              <Play className="h-4 w-4" />
              {zh ? "動作與技巧" : "Demo & technique"}
            </TabsTrigger>
            <TabsTrigger value="muscles">
              <Activity className="h-4 w-4" />
              {zh ? "肌群 / 3D" : "Muscles / 3D"}
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-7">
          {exercise.identityNotice && (
            <p className="mb-4 rounded-xl bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
              {exercise.identityNotice}
            </p>
          )}
          <TabsContent
            value="history"
            forceMount
            className="mt-0 data-[state=inactive]:hidden"
          >
            <WorkoutExerciseHistoryPanel
              exerciseName={exercise.name}
              open={open}
              weightUnit={weightUnit}
            />
          </TabsContent>
          <TabsContent value="demonstration" className="mt-0 space-y-6">
            {guide ? (
              <section
                aria-label={
                  zh ? "簡化動作示範" : "Simplified movement demonstration"
                }
              >
                <ExerciseMotionPreview
                  exercise={exercise}
                  autoplay={open && tab === "demonstration"}
                />
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {zh
                    ? "免費通用動作示意，非 Gymwork 原作；不保證與現場品牌器械的結構或軌跡完全一致。請配合下方步驟及器械調校。"
                    : "Free generic movement illustration, not a Gymwork original. The structure or path may differ from your machine; use the technique and setup below."}
                </p>
              </section>
            ) : (
              <section
                className="rounded-2xl border border-border/50 bg-muted/25 p-5"
                aria-label={zh ? "肌群與步驟" : "Muscles & steps"}
              >
                <h3 className="font-semibold">
                  {zh ? "肌群與步驟" : "Muscles & steps"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {zh
                    ? "此動作暫未支援簡化動畫；保留已知肌群與動作說明，不以其他動作代替。"
                    : "Simplified animation is not available for this exercise. Known muscles and instructions remain; no other movement is substituted."}
                </p>
              </section>
            )}
            {guide ? (
              <section>
                <h3 className="mb-4 text-lg font-semibold">
                  {zh ? "動作說明" : "Exercise description"}
                </h3>
                <div className="space-y-5 rounded-2xl bg-muted/30 p-5">
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
                      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
                      <ol className="list-decimal space-y-2 pl-5 text-sm leading-7">
                        {items.map(text => (
                          <li key={text}>{text}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">
                      {zh ? "呼吸提示" : "Breathing tips"}
                    </h4>
                    <p className="text-sm leading-7">{guide.breathing}</p>
                  </div>
                </div>
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/5 p-4 text-xs leading-6 text-muted-foreground">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
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
                      <Icon className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                      {title}
                    </h3>
                    <ol className="list-decimal space-y-3 pl-5 text-sm leading-7">
                      {items.map(text => (
                        <li key={text}>{text}</li>
                      ))}
                    </ol>
                  </section>
                ))}
              </>
            ) : exercise.instructions ? (
              <section className="rounded-2xl bg-muted/30 p-5 text-sm leading-7">
                {exercise.instructions}
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">
                {zh
                  ? "此動作尚未提供詳細技巧說明。"
                  : "Detailed technique notes have not been provided for this movement."}
              </p>
            )}
            {guide && (
              <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                {guide.sources.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4"
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
                className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground underline underline-offset-4"
              >
                Gymwork{" "}
                {zh ? "原作（外部參考）" : "original (external reference)"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </TabsContent>
          <TabsContent value="muscles" className="mt-0 space-y-5">
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">
                  {zh ? "肌肉分布" : "Muscle area"}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2 rounded-xl text-xs"
                  onClick={() => setShow3D(!show3D)}
                >
                  <Boxes className="h-4 w-4" />
                  {show3D
                    ? zh
                      ? "返回前後面"
                      : "Front & back"
                    : zh
                      ? "3D 肌群檢視"
                      : "Inspect 3D muscles"}
                </Button>
              </div>
              <ExerciseMuscleAnatomy exercise={exercise} />
              {show3D && (
                <div className="mt-4">
                  <Suspense
                    fallback={
                      <p
                        role="status"
                        className="p-8 text-center text-sm text-muted-foreground"
                      >
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
                <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-400">
                  {zh
                    ? "此自訂動作只按原有分類顯示，未核對逐動作肌群。"
                    : "This custom exercise uses its recorded category, not verified exercise-specific muscles."}
                </p>
              )}
            </section>
            {!!related.length && (
              <section>
                <h3 className="mb-3 text-base font-semibold">
                  {zh ? "相關器械動作" : "Related machine movements"}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {related.map(r => {
                    const relatedReference = getGymworkReference(
                      r.name,
                      r.equipment[0]
                    );
                    return (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-border/50 bg-card p-4"
                      >
                        <p className="text-sm font-medium">
                          {zh ? r.nameZh : r.name}
                        </p>
                        {zh && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.name}
                          </p>
                        )}
                        {relatedReference && (
                          <a
                            href={relatedReference.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-teal-700 dark:text-teal-400"
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
          </TabsContent>
        </div>
      </Tabs>
      <div className="flex shrink-0 gap-3 border-t border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
        {hasActiveSession && onAddToSession && (
          <Button
            className="min-h-11 flex-1 gap-2 rounded-xl"
            onClick={() => {
              onAddToSession();
              onClose();
            }}
          >
            <Plus className="h-4 w-4" />
            {zh ? "加入訓練" : "Add to session"}
          </Button>
        )}
        <Button
          className="min-h-11 flex-1 rounded-xl"
          variant="outline"
          onClick={onClose}
        >
          {zh ? "關閉" : "Close"}
        </Button>
      </div>
    </>
  );
}

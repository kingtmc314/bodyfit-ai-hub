import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Zap, Info, ChevronRight, Lightbulb, AlertTriangle, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EXERCISE_DESCRIPTIONS } from "@/data/exerciseDescriptions";

// wger muscle IDs mapped to our muscleGroup strings
// Each entry: { wgerId, name, isFront }
const WGER_MUSCLES: Record<string, { id: number; isFront: boolean; label: string }[]> = {
  chest:     [{ id: 4, isFront: true,  label: "Chest" }],
  back:      [{ id: 12, isFront: false, label: "Lats" }],
  lats:      [{ id: 12, isFront: false, label: "Lats" }],
  shoulders: [{ id: 2, isFront: true,  label: "Shoulders" }],
  biceps:    [{ id: 1, isFront: true,  label: "Biceps" }],
  triceps:   [{ id: 5, isFront: false, label: "Triceps" }],
  quads:     [{ id: 10, isFront: true, label: "Quads" }],
  hamstrings:[{ id: 11, isFront: false, label: "Hamstrings" }],
  glutes:    [{ id: 8, isFront: false, label: "Glutes" }],
  calves:    [{ id: 7, isFront: false, label: "Calves" }],
  abs:       [{ id: 6, isFront: true,  label: "Abs" }],
  obliques:  [{ id: 14, isFront: true, label: "Obliques" }],
  traps:     [{ id: 9, isFront: false, label: "Traps" }],
  forearms:  [{ id: 13, isFront: true, label: "Forearms" }],
};

// Secondary muscles for common exercises
const SECONDARY_MUSCLES: Record<string, string[]> = {
  chest:     ["shoulders", "triceps"],
  back:      ["biceps", "forearms"],
  lats:      ["biceps", "back"],
  shoulders: ["triceps", "traps"],
  biceps:    ["forearms", "back"],
  triceps:   ["chest", "shoulders"],
  quads:     ["glutes", "hamstrings"],
  hamstrings:["glutes", "calves"],
  glutes:    ["hamstrings", "quads"],
  calves:    [],
  abs:       ["obliques"],
  obliques:  ["abs"],
  traps:     ["shoulders", "back"],
  forearms:  ["biceps"],
};

const MUSCLE_COLORS: Record<string, string> = {
  chest: "#ef4444", back: "#f97316", lats: "#f97316",
  shoulders: "#eab308", biceps: "#22c55e", triceps: "#3b82f6",
  quads: "#a855f7", hamstrings: "#ec4899", glutes: "#f43f5e",
  calves: "#06b6d4", abs: "#10b981", obliques: "#84cc16",
  traps: "#6366f1", forearms: "#14b8a6",
};

const EQUIPMENT_ICONS: Record<string, string> = {
  Barbell: "🏋️", Dumbbell: "💪", Cable: "🔗", Machine: "⚙️",
  Bodyweight: "🤸", "Pull-up Bar": "🔝", "EZ Bar": "〰️",
  "Resistance Band": "🎗️", Kettlebell: "🫙", "Smith Machine": "🏗️",
};

const WGER_BASE = "https://wger.de/static/images/muscles";

interface Exercise {
  name: string;
  nameZh: string;
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

// Fuzzy name lookup - handles slight name differences between BUILT_IN_EXERCISES and EXERCISE_DESCRIPTIONS
function lookupDescription(name: string) {
  if (EXERCISE_DESCRIPTIONS[name]) return EXERCISE_DESCRIPTIONS[name];
  // Try case-insensitive match
  const lower = name.toLowerCase();
  const key = Object.keys(EXERCISE_DESCRIPTIONS).find(k => k.toLowerCase() === lower);
  if (key) return EXERCISE_DESCRIPTIONS[key];
  // Try partial match (e.g. "Dumbbell Fly" matches "Dumbbell Flyes", "Push-up" matches "Push-Up")
  const partial = Object.keys(EXERCISE_DESCRIPTIONS).find(k => {
    const kl = k.toLowerCase();
    return kl.startsWith(lower) || lower.startsWith(kl) ||
      kl.replace(/[-\s]/g, "") === lower.replace(/[-\s]/g, "");
  });
  if (partial) return EXERCISE_DESCRIPTIONS[partial];
  // Word-based match: check if all words of the shorter name appear in the longer
  const words = lower.split(/\s+/);
  const wordMatch = Object.keys(EXERCISE_DESCRIPTIONS).find(k => {
    const kWords = k.toLowerCase().split(/\s+/);
    return words.every(w => kWords.includes(w)) || kWords.every(w => words.includes(w));
  });
  return wordMatch ? EXERCISE_DESCRIPTIONS[wordMatch] : null;
}

function MuscleDiagram({ muscleGroup }: { muscleGroup: string }) {
  const primary = WGER_MUSCLES[muscleGroup] ?? [];
  const secondaryGroups = SECONDARY_MUSCLES[muscleGroup] ?? [];
  const secondary = secondaryGroups.flatMap(g => WGER_MUSCLES[g] ?? []);

  const frontMuscles = primary.filter(m => m.isFront);
  const backMuscles = primary.filter(m => !m.isFront);
  const frontSecondary = secondary.filter(m => m.isFront);
  const backSecondary = secondary.filter(m => !m.isFront);

  const hasFront = frontMuscles.length > 0 || frontSecondary.length > 0;
  const hasBack = backMuscles.length > 0 || backSecondary.length > 0;

  return (
    <div className="flex gap-4 justify-center">
      {/* Front view */}
      <div className="relative flex flex-col items-center">
        <p className="text-xs text-muted-foreground mb-1">前面</p>
        <div className="relative w-[100px] h-[200px]">
          <img
            src={`${WGER_BASE}/muscular_system_front.svg`}
            alt="Front body"
            className="absolute inset-0 w-full h-full object-contain opacity-30"
          />
          {frontSecondary.map(m => (
            <img
              key={`fs-${m.id}`}
              src={`${WGER_BASE}/secondary/muscle-${m.id}.${getMuscleSvgHash(m.id, false)}.svg`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: "invert(60%) sepia(100%) saturate(400%) hue-rotate(15deg)" }}
            />
          ))}
          {frontMuscles.map(m => (
            <img
              key={`fp-${m.id}`}
              src={`${WGER_BASE}/main/muscle-${m.id}.${getMuscleSvgHash(m.id, true)}.svg`}
              alt={m.label}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: "invert(20%) sepia(100%) saturate(500%) hue-rotate(330deg)" }}
            />
          ))}
          {!hasFront && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50">—</span>
            </div>
          )}
        </div>
      </div>
      {/* Back view */}
      <div className="relative flex flex-col items-center">
        <p className="text-xs text-muted-foreground mb-1">後面</p>
        <div className="relative w-[100px] h-[200px]">
          <img
            src={`${WGER_BASE}/muscular_system_back.svg`}
            alt="Back body"
            className="absolute inset-0 w-full h-full object-contain opacity-30"
          />
          {backSecondary.map(m => (
            <img
              key={`bs-${m.id}`}
              src={`${WGER_BASE}/secondary/muscle-${m.id}.${getMuscleSvgHash(m.id, false)}.svg`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: "invert(60%) sepia(100%) saturate(400%) hue-rotate(15deg)" }}
            />
          ))}
          {backMuscles.map(m => (
            <img
              key={`bp-${m.id}`}
              src={`${WGER_BASE}/main/muscle-${m.id}.${getMuscleSvgHash(m.id, true)}.svg`}
              alt={m.label}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: "invert(20%) sepia(100%) saturate(500%) hue-rotate(330deg)" }}
            />
          ))}
          {!hasBack && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50">—</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Map wger muscle IDs to their SVG hash suffixes (from the API response)
function getMuscleSvgHash(id: number, isMain: boolean): string {
  const mainHashes: Record<number, string> = {
    1: "8790f8a0b3b9", 2: "e1e1205a3202", 3: "356ffc861a30",
    4: "c9fa9a228bc8", 5: "8a2b934b5486", 6: "592f938fa8c7",
    7: "edbd8c381b0c", 8: "fbdfb46f3bc0", 9: "b491050a7108",
    10: "b1445ea1acf6", 11: "54ef31755917", 12: "6a5de7a0e373",
    13: "3fd85231b089", 14: "153978038d0b", 15: "ae8e305fc9e4",
  };
  const secHashes: Record<number, string> = {
    1: "e08c58a194b9", 2: "74ea636ad97b", 3: "4c09bf907827",
    4: "955e74ea6083", 5: "68eb84d675a5", 6: "370f77c2860e",
    7: "2f836b0cd383", 8: "605e4e1a0277", 9: "be1b5e41906b",
    10: "55e36d852778", 11: "a2bc76fe157a", 12: "974a8c6def63",
    13: "0a7e5d52821b", 14: "afd582849ae9", 15: "9bdd8751b3e7",
  };
  return isMain ? (mainHashes[id] ?? "") : (secHashes[id] ?? "");
}

const DIFFICULTY_STYLE: Record<string, string> = {
  Beginner: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
  Intermediate: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
  Advanced: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
};

const DIFFICULTY_ZH: Record<string, string> = {
  Beginner: "初級",
  Intermediate: "中級",
  Advanced: "高級",
};

export default function ExerciseDetailModal({ exercise, open, onClose, onAddToSession, hasActiveSession }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === "zh";

  if (!exercise) return null;

  const primaryMuscles = WGER_MUSCLES[exercise.muscleGroup] ?? [];
  const secondaryGroups = SECONDARY_MUSCLES[exercise.muscleGroup] ?? [];
  const color = MUSCLE_COLORS[exercise.muscleGroup] ?? "#6366f1";
  const equipIcon = EQUIPMENT_ICONS[exercise.equipment] ?? "🏋️";
  const desc = lookupDescription(exercise.name);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-no-padding="true" style={{ maxHeight: "90dvh" }}>
        <DialogHeader className="shrink-0 px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">{equipIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold">{exercise.name}</p>
                {desc && (
                  <Badge variant="outline" className={`text-xs font-medium ${DIFFICULTY_STYLE[desc.difficulty] ?? ""}`}>
                    {isZh ? (DIFFICULTY_ZH[desc.difficulty] ?? desc.difficulty) : desc.difficulty}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-normal">{exercise.nameZh}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          <div className="space-y-4 px-6 pb-6 pt-4">
            {/* Muscle diagram */}
            <div className="bg-muted/30 rounded-xl p-4">
              <MuscleDiagram muscleGroup={exercise.muscleGroup} />
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  {isZh ? "主要肌肉" : "Primary"}
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  {isZh ? "輔助肌肉" : "Secondary"}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Badge style={{ backgroundColor: color + "22", color, borderColor: color + "44" }} variant="outline" className="capitalize font-medium">
                <Zap className="w-3 h-3 mr-1" />
                {exercise.muscleGroup}
              </Badge>
              <Badge variant="secondary">
                <span className="mr-1">{equipIcon}</span>
                {exercise.equipment}
              </Badge>
              {primaryMuscles.map(m => (
                <Badge key={m.id} variant="outline" className="text-xs">{m.label}</Badge>
              ))}
            </div>

            {/* Secondary muscles */}
            {secondaryGroups.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Info className="w-3 h-3" /> {isZh ? "輔助肌肉" : "Secondary Muscles"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {secondaryGroups.map(g => (
                    <Badge key={g} variant="outline" className="text-xs capitalize text-muted-foreground">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed description from EXERCISE_DESCRIPTIONS */}
            {desc ? (
              <>
                {/* Step-by-step instructions */}
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/40">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs font-semibold">{isZh ? "動作步驟" : "How To Do It"}</p>
                  </div>
                  <div className="divide-y divide-border/30">
                    {(isZh ? desc.stepsZh : desc.steps).map((step, i) => (
                      <div key={i} className="flex gap-3 px-3 py-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pro Tips */}
                <div className="rounded-xl border border-yellow-200/60 overflow-hidden dark:border-yellow-800/40">
                  <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50/50 border-b border-yellow-200/40 dark:bg-yellow-950/20 dark:border-yellow-800/30">
                    <Lightbulb className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                      {isZh ? "訓練提示" : "Pro Tips"}
                    </p>
                  </div>
                  <div className="divide-y divide-yellow-100/60 dark:divide-yellow-900/30">
                    {(isZh ? desc.tipsZh : desc.tips).map((tip, i) => (
                      <div key={i} className="flex gap-2 px-3 py-2.5">
                        <ChevronRight className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm leading-relaxed text-foreground/80">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Common Mistakes */}
                <div className="rounded-xl border border-red-200/60 overflow-hidden dark:border-red-800/40">
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50/50 border-b border-red-200/40 dark:bg-red-950/20 dark:border-red-800/30">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {isZh ? "常見錯誤" : "Common Mistakes"}
                    </p>
                  </div>
                  <div className="divide-y divide-red-100/60 dark:divide-red-900/30">
                    {(isZh ? desc.mistakesZh : desc.mistakes).map((mistake, i) => (
                      <div key={i} className="flex gap-2 px-3 py-2.5">
                        <span className="text-red-400 flex-shrink-0 mt-0.5 text-xs font-bold leading-5">✗</span>
                        <p className="text-sm leading-relaxed text-foreground/80">{mistake}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Fallback: show old instructions if no detailed desc */
              exercise.instructions && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs font-medium mb-1 text-muted-foreground">
                    {isZh ? "動作說明" : "Instructions"}
                  </p>
                  <p className="text-sm leading-relaxed">{exercise.instructions}</p>
                </div>
              )
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1 pb-1">
              {hasActiveSession && onAddToSession && (
                <Button className="flex-1 gap-2" onClick={() => { onAddToSession(); onClose(); }}>
                  <Plus className="w-4 h-4" /> {isZh ? "加入訓練" : "Add to Session"}
                </Button>
              )}
              <Button variant="outline" className={hasActiveSession ? "flex-1" : "w-full"} onClick={onClose}>
                {isZh ? "關閉" : "Close"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

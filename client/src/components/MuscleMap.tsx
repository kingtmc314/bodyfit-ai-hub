import { useState } from "react";
import { cn } from "@/lib/utils";

export const MUSCLE_GROUPS = [
  { id: "chest", label: "Chest", labelZh: "胸肌", color: "#e74c3c" },
  { id: "back", label: "Back", labelZh: "背肌", color: "#3498db" },
  { id: "shoulders", label: "Shoulders", labelZh: "肩膀", color: "#9b59b6" },
  { id: "biceps", label: "Biceps", labelZh: "二頭肌", color: "#e67e22" },
  { id: "triceps", label: "Triceps", labelZh: "三頭肌", color: "#f39c12" },
  { id: "forearms", label: "Forearms", labelZh: "前臂", color: "#1abc9c" },
  { id: "abs", label: "Abs", labelZh: "腹肌", color: "#2ecc71" },
  { id: "obliques", label: "Obliques", labelZh: "側腹", color: "#27ae60" },
  { id: "quads", label: "Quads", labelZh: "股四頭肌", color: "#e74c3c" },
  { id: "hamstrings", label: "Hamstrings", labelZh: "腿後肌", color: "#c0392b" },
  { id: "glutes", label: "Glutes", labelZh: "臀肌", color: "#8e44ad" },
  { id: "calves", label: "Calves", labelZh: "小腿", color: "#16a085" },
  { id: "traps", label: "Traps", labelZh: "斜方肌", color: "#2980b9" },
  { id: "lats", label: "Lats", labelZh: "背闊肌", color: "#1a5276" },
];

interface MuscleMapProps {
  activeMuscles?: string[];
  onSelect?: (muscleId: string) => void;
  selectedMuscle?: string | null;
  view?: "front" | "back";
}

export default function MuscleMap({ activeMuscles = [], onSelect, selectedMuscle, view = "front" }: MuscleMapProps) {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<"front" | "back">(view);

  const getMuscleColor = (muscleId: string) => {
    const isActive = activeMuscles.includes(muscleId);
    const isSelected = selectedMuscle === muscleId;
    const isHovered = hoveredMuscle === muscleId;
    if (isSelected) return "oklch(0.72 0.19 160)";
    if (isActive) return "oklch(0.68 0.22 25)";
    if (isHovered) return "oklch(0.72 0.19 160 / 0.6)";
    return "oklch(0.30 0.015 240)";
  };

  const handleClick = (muscleId: string) => onSelect?.(muscleId);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* View Toggle */}
      <div className="flex gap-2 bg-muted/50 rounded-lg p-1">
        <button onClick={() => setCurrentView("front")}
          className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", currentView === "front" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          Front
        </button>
        <button onClick={() => setCurrentView("back")}
          className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", currentView === "back" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          Back
        </button>
      </div>

      {/* SVG Body */}
      <div className="relative">
        {currentView === "front" ? (
          <svg viewBox="0 0 200 420" className="w-40 h-72" xmlns="http://www.w3.org/2000/svg">
            {/* Head */}
            <ellipse cx="100" cy="28" rx="22" ry="26" fill="oklch(0.28 0.015 240)" stroke="oklch(0.35 0.015 240)" strokeWidth="1" />
            {/* Neck */}
            <rect x="91" y="50" width="18" height="16" rx="4" fill="oklch(0.28 0.015 240)" />
            {/* Torso */}
            <path d="M65 66 L135 66 L140 160 L60 160 Z" fill="oklch(0.22 0.015 240)" stroke="oklch(0.30 0.015 240)" strokeWidth="0.5" />
            {/* Chest */}
            <path id="chest-l" d="M70 72 Q100 80 100 100 Q82 105 68 95 Z"
              fill={getMuscleColor("chest")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("chest")}
              onMouseEnter={() => setHoveredMuscle("chest")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path id="chest-r" d="M130 72 Q100 80 100 100 Q118 105 132 95 Z"
              fill={getMuscleColor("chest")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("chest")}
              onMouseEnter={() => setHoveredMuscle("chest")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Shoulders */}
            <ellipse cx="58" cy="80" rx="14" ry="18"
              fill={getMuscleColor("shoulders")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("shoulders")}
              onMouseEnter={() => setHoveredMuscle("shoulders")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <ellipse cx="142" cy="80" rx="14" ry="18"
              fill={getMuscleColor("shoulders")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("shoulders")}
              onMouseEnter={() => setHoveredMuscle("shoulders")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Abs */}
            <rect x="86" y="105" width="12" height="10" rx="3"
              fill={getMuscleColor("abs")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("abs")}
              onMouseEnter={() => setHoveredMuscle("abs")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <rect x="102" y="105" width="12" height="10" rx="3"
              fill={getMuscleColor("abs")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("abs")}
              onMouseEnter={() => setHoveredMuscle("abs")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <rect x="86" y="118" width="12" height="10" rx="3"
              fill={getMuscleColor("abs")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("abs")}
              onMouseEnter={() => setHoveredMuscle("abs")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <rect x="102" y="118" width="12" height="10" rx="3"
              fill={getMuscleColor("abs")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("abs")}
              onMouseEnter={() => setHoveredMuscle("abs")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <rect x="86" y="131" width="12" height="10" rx="3"
              fill={getMuscleColor("abs")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("abs")}
              onMouseEnter={() => setHoveredMuscle("abs")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <rect x="102" y="131" width="12" height="10" rx="3"
              fill={getMuscleColor("abs")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("abs")}
              onMouseEnter={() => setHoveredMuscle("abs")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Obliques */}
            <path d="M68 105 Q78 115 74 145 Q64 140 62 120 Z"
              fill={getMuscleColor("obliques")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("obliques")}
              onMouseEnter={() => setHoveredMuscle("obliques")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M132 105 Q122 115 126 145 Q136 140 138 120 Z"
              fill={getMuscleColor("obliques")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("obliques")}
              onMouseEnter={() => setHoveredMuscle("obliques")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Biceps */}
            <path d="M44 100 Q36 115 38 140 Q48 140 52 115 Z"
              fill={getMuscleColor("biceps")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("biceps")}
              onMouseEnter={() => setHoveredMuscle("biceps")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M156 100 Q164 115 162 140 Q152 140 148 115 Z"
              fill={getMuscleColor("biceps")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("biceps")}
              onMouseEnter={() => setHoveredMuscle("biceps")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Triceps (visible from front) */}
            <path d="M40 100 Q32 115 34 140 Q40 138 44 115 Z"
              fill={getMuscleColor("triceps")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("triceps")}
              onMouseEnter={() => setHoveredMuscle("triceps")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M160 100 Q168 115 166 140 Q160 138 156 115 Z"
              fill={getMuscleColor("triceps")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("triceps")}
              onMouseEnter={() => setHoveredMuscle("triceps")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Forearms */}
            <path d="M36 142 Q30 160 32 180 Q42 178 46 158 Q44 142 38 142 Z"
              fill={getMuscleColor("forearms")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("forearms")}
              onMouseEnter={() => setHoveredMuscle("forearms")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M164 142 Q170 160 168 180 Q158 178 154 158 Q156 142 162 142 Z"
              fill={getMuscleColor("forearms")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("forearms")}
              onMouseEnter={() => setHoveredMuscle("forearms")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Quads */}
            <path d="M68 162 Q62 200 64 240 Q80 242 82 200 Q84 165 76 162 Z"
              fill={getMuscleColor("quads")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("quads")}
              onMouseEnter={() => setHoveredMuscle("quads")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M84 162 Q88 200 88 240 Q96 242 98 200 Q98 165 90 162 Z"
              fill={getMuscleColor("quads")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("quads")}
              onMouseEnter={() => setHoveredMuscle("quads")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M132 162 Q138 200 136 240 Q120 242 118 200 Q116 165 124 162 Z"
              fill={getMuscleColor("quads")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("quads")}
              onMouseEnter={() => setHoveredMuscle("quads")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M116 162 Q112 200 112 240 Q104 242 102 200 Q102 165 110 162 Z"
              fill={getMuscleColor("quads")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("quads")}
              onMouseEnter={() => setHoveredMuscle("quads")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Calves */}
            <path d="M66 258 Q62 285 64 310 Q76 312 78 285 Q80 258 72 256 Z"
              fill={getMuscleColor("calves")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("calves")}
              onMouseEnter={() => setHoveredMuscle("calves")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M134 258 Q138 285 136 310 Q124 312 122 285 Q120 258 128 256 Z"
              fill={getMuscleColor("calves")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("calves")}
              onMouseEnter={() => setHoveredMuscle("calves")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Pelvis/Hip area */}
            <path d="M62 158 L138 158 L136 172 L100 176 L64 172 Z" fill="oklch(0.22 0.015 240)" stroke="oklch(0.30 0.015 240)" strokeWidth="0.5" />
            {/* Lower legs */}
            <rect x="62" y="240" width="20" height="18" rx="4" fill="oklch(0.22 0.015 240)" />
            <rect x="118" y="240" width="20" height="18" rx="4" fill="oklch(0.22 0.015 240)" />
            {/* Feet */}
            <ellipse cx="72" cy="320" rx="12" ry="8" fill="oklch(0.22 0.015 240)" />
            <ellipse cx="128" cy="320" rx="12" ry="8" fill="oklch(0.22 0.015 240)" />
            {/* Tooltip */}
            {hoveredMuscle && (
              <text x="100" y="15" textAnchor="middle" fill="oklch(0.72 0.19 160)" fontSize="9" fontWeight="600">
                {MUSCLE_GROUPS.find(m => m.id === hoveredMuscle)?.label}
              </text>
            )}
          </svg>
        ) : (
          <svg viewBox="0 0 200 420" className="w-40 h-72" xmlns="http://www.w3.org/2000/svg">
            {/* Head */}
            <ellipse cx="100" cy="28" rx="22" ry="26" fill="oklch(0.28 0.015 240)" stroke="oklch(0.35 0.015 240)" strokeWidth="1" />
            {/* Neck */}
            <rect x="91" y="50" width="18" height="16" rx="4" fill="oklch(0.28 0.015 240)" />
            {/* Torso back */}
            <path d="M65 66 L135 66 L140 160 L60 160 Z" fill="oklch(0.22 0.015 240)" stroke="oklch(0.30 0.015 240)" strokeWidth="0.5" />
            {/* Traps */}
            <path d="M80 66 L100 72 L120 66 L130 80 L100 88 L70 80 Z"
              fill={getMuscleColor("traps")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("traps")}
              onMouseEnter={() => setHoveredMuscle("traps")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Shoulders back */}
            <ellipse cx="58" cy="80" rx="14" ry="18"
              fill={getMuscleColor("shoulders")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("shoulders")}
              onMouseEnter={() => setHoveredMuscle("shoulders")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <ellipse cx="142" cy="80" rx="14" ry="18"
              fill={getMuscleColor("shoulders")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("shoulders")}
              onMouseEnter={() => setHoveredMuscle("shoulders")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Lats */}
            <path d="M68 90 Q62 120 66 150 Q80 152 82 120 Q84 90 76 88 Z"
              fill={getMuscleColor("lats")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("lats")}
              onMouseEnter={() => setHoveredMuscle("lats")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M132 90 Q138 120 134 150 Q120 152 118 120 Q116 90 124 88 Z"
              fill={getMuscleColor("lats")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("lats")}
              onMouseEnter={() => setHoveredMuscle("lats")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Back middle */}
            <path d="M84 90 Q100 95 116 90 L118 150 Q100 155 82 150 Z"
              fill={getMuscleColor("back")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("back")}
              onMouseEnter={() => setHoveredMuscle("back")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Triceps back */}
            <path d="M44 100 Q36 120 38 145 Q48 145 52 120 Z"
              fill={getMuscleColor("triceps")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("triceps")}
              onMouseEnter={() => setHoveredMuscle("triceps")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M156 100 Q164 120 162 145 Q152 145 148 120 Z"
              fill={getMuscleColor("triceps")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("triceps")}
              onMouseEnter={() => setHoveredMuscle("triceps")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Forearms back */}
            <path d="M36 147 Q30 165 32 185 Q42 183 46 163 Q44 147 38 147 Z"
              fill={getMuscleColor("forearms")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("forearms")}
              onMouseEnter={() => setHoveredMuscle("forearms")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M164 147 Q170 165 168 185 Q158 183 154 163 Q156 147 162 147 Z"
              fill={getMuscleColor("forearms")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("forearms")}
              onMouseEnter={() => setHoveredMuscle("forearms")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Glutes */}
            <path d="M66 160 Q62 185 68 200 Q84 204 100 200 Q116 204 132 200 Q138 185 134 160 Z"
              fill={getMuscleColor("glutes")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("glutes")}
              onMouseEnter={() => setHoveredMuscle("glutes")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Hamstrings */}
            <path d="M68 202 Q64 235 66 255 Q80 258 84 230 Q86 205 76 202 Z"
              fill={getMuscleColor("hamstrings")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("hamstrings")}
              onMouseEnter={() => setHoveredMuscle("hamstrings")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M132 202 Q136 235 134 255 Q120 258 116 230 Q114 205 124 202 Z"
              fill={getMuscleColor("hamstrings")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("hamstrings")}
              onMouseEnter={() => setHoveredMuscle("hamstrings")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Calves back */}
            <path d="M66 258 Q62 285 64 310 Q76 312 78 285 Q80 258 72 256 Z"
              fill={getMuscleColor("calves")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("calves")}
              onMouseEnter={() => setHoveredMuscle("calves")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            <path d="M134 258 Q138 285 136 310 Q124 312 122 285 Q120 258 128 256 Z"
              fill={getMuscleColor("calves")} stroke="oklch(0.35 0.015 240)" strokeWidth="0.5"
              className="cursor-pointer transition-all duration-150"
              onClick={() => handleClick("calves")}
              onMouseEnter={() => setHoveredMuscle("calves")}
              onMouseLeave={() => setHoveredMuscle(null)} />
            {/* Feet */}
            <ellipse cx="72" cy="320" rx="12" ry="8" fill="oklch(0.22 0.015 240)" />
            <ellipse cx="128" cy="320" rx="12" ry="8" fill="oklch(0.22 0.015 240)" />
            {/* Tooltip */}
            {hoveredMuscle && (
              <text x="100" y="15" textAnchor="middle" fill="oklch(0.72 0.19 160)" fontSize="9" fontWeight="600">
                {MUSCLE_GROUPS.find(m => m.id === hoveredMuscle)?.label}
              </text>
            )}
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center max-w-xs">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm" style={{ background: "oklch(0.68 0.22 25)" }} />
          <span>Trained today</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm" style={{ background: "oklch(0.72 0.19 160)" }} />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}

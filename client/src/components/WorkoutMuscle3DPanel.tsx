import { lazy, Suspense, useState } from "react";
import { Boxes, ChevronDown } from "lucide-react";
import { useStudioLanguage } from "./WorkoutStudio";
const MuscleModel3D = lazy(() => import("./MuscleModel3D"));
export default function WorkoutMuscle3DPanel({
  primary,
  secondary,
}: {
  primary: string[];
  secondary: string[];
}) {
  const zh = useStudioLanguage();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 text-sm font-semibold"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-blue-600" />
          {zh ? "3D 肌群檢視" : "Inspect 3D muscle areas"}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>
      <p className="text-[10px] leading-5 text-muted-foreground">
        {zh
          ? "按需要載入，可旋轉、看前後面。此模型是肌群位置示意，不是 Gymwork 動作動畫。"
          : "Load on demand and inspect front/back by rotation. This is a muscle-location schematic, not a Gymwork exercise animation."}
      </p>
      {open && (
        <div className="mt-3">
          <Suspense
            fallback={
              <p className="p-6 text-xs text-muted-foreground">
                {zh ? "正在載入肌群模型…" : "Loading muscle model…"}
              </p>
            }
          >
            <MuscleModel3D primary={primary} secondary={secondary} />
          </Suspense>
        </div>
      )}
    </section>
  );
}

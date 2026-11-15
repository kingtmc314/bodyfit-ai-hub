import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getExerciseMotion,
  getMotionApparatus,
  getMotionPose,
  type ApparatusSegment,
  type ExerciseMotionSpec,
  type MotionPose,
  type Point3,
} from "@shared/exerciseMotion";
import { cn } from "@/lib/utils";

export interface ExerciseMotionPreviewProps {
  exercise: { name: string; muscleGroup?: string; equipment?: string };
  compact?: boolean;
  autoplay?: boolean;
  className?: string;
}
const projected = (p: Point3): [number, number] => [
  185 + p[0] * 108 + p[2] * 78,
  247 - p[1] * 102 - p[2] * 12,
];
const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function MotionSvg({
  spec,
  pose,
  phase,
  zh,
}: {
  spec: ExerciseMotionSpec;
  pose: MotionPose;
  phase: number;
  zh: boolean;
}) {
  const segments = getMotionApparatus(spec.id, pose).segments;
  const line = (a: Point3, b: Point3, color: string, width: number) => (
    <line
      x1={projected(a)[0]}
      y1={projected(a)[1]}
      x2={projected(b)[0]}
      y2={projected(b)[1]}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
  const apparatus = (segment: ApparatusSegment) => {
    const { a, b, kind, part } = segment;
    const width =
      kind === "pad"
        ? 12
        : kind === "footplate"
          ? 10
          : kind === "cable"
            ? 2
            : 5;
    return (
      <g key={part} data-apparatus-part={part} data-apparatus-kind={kind}>
        {line(
          a,
          b,
          kind === "pad"
            ? "#334155"
            : kind === "handle"
              ? "#0f172a"
              : "#7a899b",
          width
        )}
      </g>
    );
  };
  const head = projected(pose.head);
  return (
    <svg
      viewBox="45 0 320 265"
      role="img"
      aria-label={`${spec.name} — ${zh ? "簡化動作示意" : "Simplified motion"}`}
      data-motion-phase={phase.toFixed(4)}
      data-motion-stroke={pose.contraction.toFixed(3)}
      className="h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>
        {zh
          ? `${spec.nameZh}：通用人體與器械示意`
          : `${spec.name}: generic human and machine schematic`}
      </title>
      <rect x="45" y="0" width="320" height="265" fill="#f6f8fc" />
      <path d="M60 250H350" stroke="#cbd5e1" strokeWidth="2" />
      <g data-motion-apparatus={spec.id}>
        {segments
          .filter(
            s =>
              s.kind === "frame" ||
              s.kind === "lever" ||
              s.kind === "cable" ||
              s.part === "seat" ||
              s.part === "back-pad"
          )
          .map(apparatus)}
      </g>
      <g data-motion-human="true">
        {[0, 1].map(i => (
          <g key={`leg-${i}`} opacity={i === 0 ? 0.7 : 1}>
            {line(pose.hips[i], pose.knees[i], "#4c83db", 14)}
            {line(pose.knees[i], pose.feet[i], "#73a0e6", 10)}
            {line(
              pose.feet[i],
              [
                pose.feet[i][0],
                pose.feet[i][1] - 0.015,
                pose.feet[i][2] + 0.12,
              ],
              "#334155",
              9
            )}
          </g>
        ))}
        {line(pose.hip, pose.neck, "#4c83db", 28)}
        {line(pose.shoulders[0], pose.shoulders[1], "#4c83db", 14)}
        {[0, 1].map(i => (
          <g key={`arm-${i}`} opacity={i === 0 ? 0.7 : 1}>
            {line(pose.shoulders[i], pose.elbows[i], "#4c83db", 10)}
            {line(pose.elbows[i], pose.hands[i], "#73a0e6", 7)}
            <circle
              cx={projected(pose.hands[i])[0]}
              cy={projected(pose.hands[i])[1]}
              r="4"
              fill="#334155"
            />
          </g>
        ))}
        {line(pose.neck, pose.head, "#93afe0", 10)}
        <ellipse cx={head[0]} cy={head[1]} rx="10" ry="14" fill="#93afe0" />
      </g>
      <g data-motion-contacts="true">
        {segments
          .filter(
            s =>
              (s.kind === "pad" &&
                s.part !== "seat" &&
                s.part !== "back-pad") ||
              s.kind === "handle" ||
              s.kind === "footplate"
          )
          .map(apparatus)}
      </g>
    </svg>
  );
}

/** A keyed player isolates a genuine exercise change from parent timer re-renders. */
function MotionPlayer({
  spec,
  compact,
  autoplay,
  className,
  zh,
}: {
  spec: ExerciseMotionSpec;
  compact: boolean;
  autoplay: boolean;
  className?: string;
  zh: boolean;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(0);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(
    () => autoplay && !compact && !reducedMotion()
  );
  const [speed, setSpeed] = useState(1);
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden
  );
  // Where supported, do not start until the observer confirms the surface is visible.
  const [inViewport, setInViewport] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    if (compact) return;
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onPreference = () => {
      if (media?.matches) setPlaying(false);
    };
    if (media?.addEventListener) media.addEventListener("change", onPreference);
    else media?.addListener?.(onPreference);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (media?.removeEventListener)
        media.removeEventListener("change", onPreference);
      else media?.removeListener?.(onPreference);
    };
  }, [compact]);

  useEffect(() => {
    if (compact || typeof IntersectionObserver === "undefined") return;
    let disposed = false;
    const observer = new IntersectionObserver(
      entries => {
        if (!disposed)
          setInViewport(entries.some(entry => entry.isIntersecting));
      },
      { threshold: 0 }
    );
    if (surface.current) observer.observe(surface.current);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [compact]);

  useEffect(() => {
    if (compact || !playing || !visible || !inViewport) return;
    let frame: number;
    let last: number | undefined;
    let disposed = false;
    const tick = (now: number) => {
      if (disposed) return;
      if (last !== undefined) {
        // Resume from the current phase without catching up hidden time.
        const delta = Math.max(0, Math.min((now - last) / 1000, 0.1));
        phaseRef.current = (phaseRef.current + (delta * speed) / 4) % 1;
        setPhase(phaseRef.current);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [compact, playing, visible, inViewport, speed]);

  const scrub = (value: number) => {
    const next = Math.max(0, Math.min(1, value));
    phaseRef.current = next;
    setPhase(next);
  };
  const label = zh ? "簡化動作示意" : "Simplified motion";
  if (compact) {
    return (
      <div
        data-exercise-motion="compact"
        data-motion-id={spec.id}
        className={cn(
          "relative overflow-hidden rounded-xl bg-[#f6f8fc]",
          className
        )}
      >
        <MotionSvg
          spec={spec}
          pose={getMotionPose(spec.id, 0)}
          phase={0}
          zh={zh}
        />
        <span className="absolute bottom-1 right-1 rounded bg-white/90 px-2 py-1 text-[10px] text-slate-600">
          {label}
        </span>
      </div>
    );
  }
  return (
    <section
      data-exercise-motion="svg"
      data-motion-id={spec.id}
      data-motion-phase={phase.toFixed(4)}
      data-motion-playing={playing}
      className={cn(
        "overflow-hidden rounded-2xl border border-border/50 bg-card",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1 bg-[#f6f8fc] px-3 pt-3 text-xs">
        <span className="font-semibold text-blue-700">{label}</span>
        <span className="text-slate-600">{zh ? spec.nameZh : spec.name}</span>
      </div>
      <div
        ref={surface}
        className="h-[260px] w-full bg-[#f6f8fc] sm:h-[340px] lg:h-[380px]"
      >
        <MotionSvg
          spec={spec}
          pose={getMotionPose(spec.id, phase)}
          phase={phase}
          zh={zh}
        />
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={
              playing
                ? zh
                  ? "暫停動作"
                  : "Pause motion"
                : zh
                  ? "播放動作"
                  : "Play motion"
            }
            onClick={() => setPlaying(p => !p)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {playing ? (zh ? "暫停" : "Pause") : zh ? "播放" : "Play"}
          </button>
          <button
            type="button"
            aria-label={zh ? "重新示範" : "Restart motion"}
            onClick={() => {
              scrub(0);
              setPlaying(true);
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-muted"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            {zh ? "速度" : "Speed"}
            <select
              aria-label={zh ? "動作播放速度" : "Motion speed"}
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="min-h-11 rounded-xl border border-border bg-background px-2"
            >
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="1.5">1.5×</option>
            </select>
          </label>
        </div>
        <label className="block text-xs text-muted-foreground">
          {zh
            ? "拖動檢查往返路徑（非實測關節角度）"
            : "Scrub the back-and-forth path (not measured joint angles)"}
          <input
            type="range"
            aria-label={zh ? "動作階段" : "Motion phase"}
            aria-valuetext={
              phase < 0.5
                ? zh
                  ? "發力路徑"
                  : "Working stroke"
                : zh
                  ? "回程路徑"
                  : "Return stroke"
            }
            min="0"
            max="100"
            step="0.1"
            value={phase * 100}
            onChange={e => {
              setPlaying(false);
              scrub(Number(e.target.value) / 100);
            }}
            className="mt-1 block min-h-8 w-full accent-blue-600"
          />
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {zh
            ? "人體與器械為通用簡化示意，不代表特定品牌、實測肌肉活化或你的姿勢評估。請按現場器械調校；首次操作請向教練確認。"
            : "Generic simplified human and machine schematic, not a specific brand, measured muscle activation or an assessment of your posture. Adjust to the actual machine; consult a trainer before first use."}
        </p>
      </div>
    </section>
  );
}

export default function ExerciseMotionPreview({
  exercise,
  compact = false,
  autoplay = true,
  className,
}: ExerciseMotionPreviewProps) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const spec = getExerciseMotion(exercise.name, exercise.equipment);
  if (!spec) {
    return (
      <div
        data-exercise-motion="unavailable"
        role="status"
        className={cn(
          "rounded-2xl bg-muted/25 p-4 text-xs text-muted-foreground",
          className
        )}
      >
        <p className="mb-1 font-semibold">
          {zh ? "簡化動作示意" : "Simplified motion"}
        </p>
        {zh
          ? "此動作尚無完全匹配的示意；保持靜態，不使用其他動作或器械代替。"
          : "No exact motion match. Static state only; another exercise or machine is never substituted."}
      </div>
    );
  }
  const identity = JSON.stringify([
    exercise.name,
    exercise.equipment,
    exercise.muscleGroup,
    compact,
    autoplay,
  ]);
  return (
    <MotionPlayer
      key={identity}
      spec={spec}
      compact={compact}
      autoplay={autoplay}
      className={className}
      zh={zh}
    />
  );
}

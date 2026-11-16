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
import {
  getExerciseAnatomy,
  getMotionMuscleShapes,
  motionLimbContour,
  motionTorsoContour,
  projectMotionPoint,
  ANATOMICAL_MUSCLES,
} from "@shared/exerciseMotionMuscles";
import {
  ExerciseMuscleLegend,
  MUSCLE_ROLE_COLORS,
  MUSCLE_ROLE_STROKES,
} from "@/components/ExerciseMuscleAnatomy";

export interface ExerciseMotionPreviewProps {
  exercise: { name: string; muscleGroup?: string; equipment?: string };
  compact?: boolean;
  autoplay?: boolean;
  className?: string;
}
const projected = projectMotionPoint;
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
  const muscles = getMotionMuscleShapes(spec, pose);
  const contour = (a: Point3, b: Point3, width: number, end: number) => (
    <path
      d={motionLimbContour(a, b, width, end)}
      fill="#d8cfc4"
      stroke="#9b9187"
      strokeWidth="0.8"
    />
  );
  const muscle = (shape: (typeof muscles)[number], index: number) => (
    <g
      key={`${shape.id}-${shape.side}-${index}`}
      data-motion-muscle-id={shape.id}
      data-muscle-role={shape.role}
      data-muscle-side={shape.side}
      data-muscle-anchors={JSON.stringify(shape.anchors)}
    >
      <title>{`${ANATOMICAL_MUSCLES[shape.id].zh} / ${ANATOMICAL_MUSCLES[shape.id].en} — ${shape.role === "primary" ? (zh ? "主要肌群" : "Primary muscle") : zh ? "輔助肌群" : "Secondary muscle"}`}</title>
      <path
        data-motion-muscle-belly
        d={shape.path}
        fill={MUSCLE_ROLE_COLORS[shape.role]}
        stroke={MUSCLE_ROLE_STROKES[shape.role]}
        strokeWidth={shape.role === "primary" ? 1 : 0.85}
        strokeDasharray={shape.role === "secondary" ? "2 1.3" : undefined}
      />
      <path
        d={shape.fibers}
        fill="none"
        stroke={MUSCLE_ROLE_STROKES[shape.role]}
        strokeWidth=".55"
        opacity=".45"
      />
    </g>
  );
  const torsoIds = new Set([
    "chest",
    "lats",
    "back",
    "traps",
    "lower_back",
    "abs",
    "obliques",
    "glutes",
    "glute_medius",
  ]);
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
      <desc>
        {zh
          ? "肌肉形狀依原有關節位置移動。琥珀色實線為主要肌群，青綠色虛線為輔助肌群；背側與深層肌肉為示意透視，並非肌肉活化測量。"
          : "Muscle shapes follow the original joint positions. Amber solid outlines mark primary muscles; teal dashed outlines mark secondary muscles. Posterior and deep regions are schematic cutaways, not activation measurements."}
      </desc>
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
          <g key={`leg-${i}`}>
            {contour(pose.hips[i], pose.knees[i], 11, 6)}
            {contour(pose.knees[i], pose.feet[i], 7.5, 3.5)}
            {muscles
              .filter(
                m =>
                  m.side === i &&
                  ["quads", "hamstrings", "adductors", "calves"].includes(m.id)
              )
              .map(muscle)}
            <ellipse
              cx={projected(pose.knees[i])[0]}
              cy={projected(pose.knees[i])[1]}
              rx="4"
              ry="4.5"
              fill="#eee7df"
              stroke="#b5a89a"
              strokeWidth=".7"
            />
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
        <path
          data-motion-body-contour
          d={motionTorsoContour(pose)}
          fill="#ded6cc"
          stroke="#9b9187"
          strokeWidth=".9"
        />
        <path
          d={`M${projected(pose.neck)[0]} ${projected(pose.neck)[1] + 5} L${projected(pose.hip)[0]} ${projected(pose.hip)[1] - 2}`}
          stroke="#b8ada0"
          strokeWidth=".65"
          fill="none"
        />
        {muscles.filter(m => torsoIds.has(m.id)).map(muscle)}
        {[0, 1].map(i => (
          <g key={`arm-${i}`}>
            {contour(pose.shoulders[i], pose.elbows[i], 7.5, 3.8)}
            {contour(pose.elbows[i], pose.hands[i], 5, 2.7)}
            {muscles
              .filter(
                m =>
                  m.side === i &&
                  ["shoulders", "biceps", "triceps", "forearms"].includes(m.id)
              )
              .map(muscle)}
            <circle
              cx={projected(pose.elbows[i])[0]}
              cy={projected(pose.elbows[i])[1]}
              r="2.8"
              fill="#eee7df"
              stroke="#b5a89a"
              strokeWidth=".6"
            />
            <circle
              cx={projected(pose.hands[i])[0]}
              cy={projected(pose.hands[i])[1]}
              r="4"
              fill="#334155"
            />
          </g>
        ))}
        {line(pose.neck, pose.head, "#d8cfc4", 10)}
        <ellipse
          cx={head[0]}
          cy={head[1]}
          rx="10"
          ry="14"
          fill="#ded6cc"
          stroke="#9b9187"
          strokeWidth=".8"
        />
        <path
          d={`M${head[0] + 4} ${head[1] - 5} Q${head[0] + 7} ${head[1] + 1} ${head[0] + 4} ${head[1] + 5}`}
          stroke="#b5a89a"
          strokeWidth=".8"
          fill="none"
        />
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
  const anatomy = getExerciseAnatomy({
    name: spec.name,
    equipment: spec.equipment[0],
  });
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
          {label} · {zh ? "琥珀＝主要" : "Amber = primary"}
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
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
          <ExerciseMuscleLegend anatomy={anatomy} compact />
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {zh
              ? "實線＝主要；虛線＝輔助。肌肉輪廓隨關節移動；背側／深層位置為示意透視，非精確解剖邊界。主要與輔助肌群在受控回程亦有參與，顏色不代表出力多少。"
              : "Solid outline = primary; dashed outline = secondary. Muscle contours follow the joints; posterior/deep regions are schematic cutaways, not exact anatomical boundaries. Both roles also participate during the controlled return; colors do not quantify effort."}
          </p>
        </div>
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

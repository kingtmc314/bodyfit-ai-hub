// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  getExerciseMotion,
  getMotionApparatus,
  getMotionPose,
} from "../shared/exerciseMotion";
import {
  getMotionMuscleShapes,
  projectMotionPoint,
} from "../shared/exerciseMotionMuscles";

const locale = vi.hoisted(() => ({ language: "zh-TW" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: locale }) }));
import ExerciseMotionPreview from "../client/src/components/ExerciseMotionPreview";
import ExerciseMuscleAnatomy from "../client/src/components/ExerciseMuscleAnatomy";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  locale.language = "zh-TW";
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }))
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function scrub(value: string) {
  const input = host.querySelector<HTMLInputElement>("input[type=range]")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
// SVG title/desc are accessible metadata, not text painted over the thumbnail.
function visibleText(element: Element) {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll("svg title, svg desc").forEach(node => node.remove());
  return copy.textContent?.trim();
}
const pectoralFly = {
  name: "Pectoral Fly",
  equipment: "Machine",
  muscleGroup: "chest",
};
const cases = [
  {
    name: "Chest Press Machine",
    equipment: "Machine",
    id: "chest-press",
    primary: "chest",
    en: "Pectoralis major",
    zh: "胸大肌",
  },
  {
    ...pectoralFly,
    id: "pec-deck",
    primary: "chest",
    en: "Pectoralis major",
    zh: "胸大肌",
  },
  {
    name: "Hip Abduction",
    equipment: "Machine",
    id: "hip-abduction",
    primary: "glute_medius",
    en: "Gluteus medius",
    zh: "臀中肌",
  },
  {
    name: "Hip Adduction",
    equipment: "Machine",
    id: "hip-adduction",
    primary: "adductors",
    en: "Hip adductors",
    zh: "髖內收肌群",
  },
  {
    name: "Leg Extension",
    equipment: "Machine",
    id: "leg-extension",
    primary: "quads",
    en: "Quadriceps femoris",
    zh: "股四頭肌",
  },
  {
    name: "Lat Pulldown",
    equipment: "Cable",
    id: "lat-pulldown",
    primary: "lats",
    en: "Latissimus dorsi",
    zh: "背闊肌",
  },
];

describe("motion muscle patches and reusable anatomical panel", () => {
  it.each(cases)(
    "$id has muscle-shaped closed patches, correct labels and exact original pose / apparatus",
    async exercise => {
      await act(async () =>
        root.render(
          React.createElement(ExerciseMotionPreview, {
            exercise,
            autoplay: false,
          })
        )
      );
      expect(
        host.querySelector(
          `[data-exercise-motion=svg][data-motion-id=${exercise.id}]`
        )
      ).not.toBeNull();
      const legend = host.querySelector("[data-exercise-muscle-legend]")!;
      expect(legend.textContent).toContain(exercise.en);
      expect(legend.textContent).toContain(exercise.zh);
      expect(
        legend.querySelector(
          `[data-muscle-role=primary] [data-anatomy-muscle-id=${exercise.primary}]`
        )
      ).not.toBeNull();
      expect(host.textContent).toContain("顏色不代表出力多少");
      const spec = getExerciseMotion(exercise.name, exercise.equipment)!;
      for (const phase of ["0", "25", "50", "75", "100"]) {
        await scrub(phase);
        const pose = getMotionPose(spec.id, Number(phase) / 100);
        expect(
          host
            .querySelector("svg[data-motion-stroke]")!
            .getAttribute("data-motion-stroke")
        ).toBe(pose.contraction.toFixed(3));
        const expected = getMotionMuscleShapes(spec, pose);
        const actual = host.querySelectorAll<SVGGElement>(
          "[data-motion-muscle-id]"
        );
        expect(actual.length).toBe(expected.length);
        for (const group of Array.from(actual)) {
          const id = group.getAttribute("data-motion-muscle-id"),
            side = Number(group.getAttribute("data-muscle-side"));
          const anchors = JSON.parse(
            group.getAttribute("data-muscle-anchors")!
          );
          const path = group.querySelector("[data-motion-muscle-belly]")!;
          const matching = expected.filter(m => m.id === id && m.side === side);
          expect(matching.some(m => m.path === path.getAttribute("d"))).toBe(
            true
          );
          expect(
            matching.some(
              m => JSON.stringify(m.anchors) === JSON.stringify(anchors)
            )
          ).toBe(true);
          expect(path.getAttribute("d")).toMatch(/^M.*Z$/);
          expect(path.getAttribute("d")).toMatch(/[CQ]/);
          const role = group.getAttribute("data-muscle-role");
          expect(path.getAttribute("fill")).toBe(
            role === "primary" ? "#f59e0b" : "#0d9488"
          );
          expect(path.hasAttribute("stroke-dasharray")).toBe(
            role === "secondary"
          );
        }
        for (const part of getMotionApparatus(spec.id, pose).segments) {
          const line = host.querySelector(
            `[data-apparatus-part='${part.part}'] line`
          )!;
          expect(line).not.toBeNull();
          const a = projectMotionPoint(part.a),
            b = projectMotionPoint(part.b);
          expect(
            ["x1", "y1", "x2", "y2"].map(attr =>
              Number(line.getAttribute(attr))
            )
          ).toEqual([...a, ...b]);
        }
        // Optional local vector QA export, never a runtime dependency or browser interaction.
        if (process.env.MUSCLE_PREVIEW_DIR && ["0", "50"].includes(phase)) {
          mkdirSync(process.env.MUSCLE_PREVIEW_DIR, { recursive: true });
          writeFileSync(
            `${process.env.MUSCLE_PREVIEW_DIR}/${exercise.id}-${phase}.svg`,
            host.querySelector("svg[data-motion-phase]")!.outerHTML
          );
        }
      }
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(
        host.querySelector("iframe, img, image, video, canvas, svg animate")
      ).toBeNull();
    }
  );

  it.each(cases)(
    "$id reuses front/back MuscleAreaMap with named primary and secondary roles",
    async exercise => {
      await act(async () =>
        root.render(React.createElement(ExerciseMuscleAnatomy, { exercise }))
      );
      expect(
        host.querySelector(
          "[data-exercise-muscle-anatomy][data-anatomy-basis=exercise]"
        )
      ).not.toBeNull();
      expect(host.querySelector("[data-muscle-area-map]")).not.toBeNull();
      expect(host.querySelectorAll("svg[role=img]")).toHaveLength(2);
      expect(
        host.querySelectorAll(
          `[data-muscle-id=${exercise.primary}][data-muscle-tone=primary]`
        ).length
      ).toBeGreaterThan(0);
      expect(host.textContent).toContain(exercise.en);
      expect(host.textContent).toContain(exercise.zh);
      expect(host.textContent).toContain("琥珀色＋實線＝主要");
      expect(host.textContent).toContain("青綠色＋虛線＝輔助");
      expect(host.textContent).toContain("非實測 EMG");
      expect(
        host.querySelector("button, select, input, iframe, img, canvas")
      ).toBeNull();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    }
  );

  it("uses the same palette only inside the anatomy panel, without volume values or global styles", async () => {
    await act(async () =>
      root.render(
        React.createElement(ExerciseMuscleAnatomy, { exercise: cases[0] })
      )
    );
    const map = host.querySelector("[data-muscle-area-map]")!;
    expect(map.className).toContain(
      "[&_path[data-muscle-tone=primary]]:!fill-amber-500"
    );
    expect(map.className).toContain(
      "[&_path[data-muscle-tone=secondary]]:!fill-teal-600"
    );
    expect(host.querySelector("style, [data-muscle-tone=volume]")).toBeNull();
  });

  it("has bilingual roles and specific anatomical names in English locale too", async () => {
    locale.language = "en";
    await act(async () =>
      root.render(
        React.createElement(ExerciseMuscleAnatomy, {
          exercise: cases[0],
          compact: true,
        })
      )
    );
    expect(host.textContent).toContain("Primary muscles");
    expect(host.textContent).toContain("Secondary muscles");
    expect(host.textContent).toContain("Pectoralis major");
    expect(host.textContent).toContain("胸大肌");
    expect(host.textContent).toContain("Anterior deltoid");
    expect(host.textContent).toContain("not exact muscle boundaries");
  });

  it.each([
    { name: "Chest Press", muscleGroup: "chest", equipment: "Dumbbell" },
    {
      name: "Hip Abduction custom",
      muscleGroup: "glute_medius",
      equipment: "Machine",
    },
    { name: "Lat Pulldown custom", muscleGroup: "lats", equipment: "Cable" },
  ])(
    "anatomy category never bypasses exact-motion availability for $name",
    async exercise => {
      await act(async () =>
        root.render(
          React.createElement(
            "div",
            null,
            React.createElement(ExerciseMotionPreview, { exercise }),
            React.createElement(ExerciseMuscleAnatomy, { exercise })
          )
        )
      );
      const unavailable = host.querySelector(
        "[data-exercise-motion=unavailable]"
      )!;
      expect(unavailable).not.toBeNull();
      expect(unavailable.querySelector("svg, button, input")).toBeNull();
      expect(
        host.querySelector(
          "[data-exercise-muscle-anatomy][data-anatomy-basis=category]"
        )
      ).not.toBeNull();
      expect(host.textContent).toContain("不會用其他動作代替動畫");
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    }
  );

  it.each([
    { language: "zh-TW", name: "Pectoral Fly" },
    { language: "en", name: "Pectoral Fly" },
    { language: "zh-TW", name: "蝴蝶機夾胸" },
  ])(
    "$language $name compact thumbnail is text-free, neutral and sized for 72–96 px cards",
    async ({ language, name }) => {
      locale.language = language;
      vi.useFakeTimers();
      const listen = vi.spyOn(document, "addEventListener");
      const observer = vi.fn();
      const media = { matches: false, addEventListener: vi.fn() };
      vi.stubGlobal("IntersectionObserver", observer);
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => media)
      );
      const spec = getExerciseMotion(name, pectoralFly.equipment)!;
      expect(spec.id).toBe("pec-deck");
      let initialSvg: string | undefined;
      for (const width of [72, 80, 96]) {
        await act(async () =>
          root.render(
            React.createElement(
              "div",
              { style: { width } },
              React.createElement(ExerciseMotionPreview, {
                exercise: { ...pectoralFly, name },
                compact: true,
                autoplay: true,
                className: "w-full",
              })
            )
          )
        );
        const thumbnail = host.querySelector<HTMLDivElement>(
          "[data-exercise-motion=compact][data-motion-id=pec-deck]"
        )!;
        expect(thumbnail).not.toBeNull();
        expect(thumbnail.style.aspectRatio).toBe("320 / 265");
        const svg = thumbnail.querySelector("svg[role=img]")!;
        expect(svg.getAttribute("viewBox")).toBe("45 0 320 265");
        expect(svg.getAttribute("width")).toBe("320");
        expect(svg.getAttribute("height")).toBe("265");
        expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
        expect(svg.getAttribute("class")).toContain("h-auto w-full");
        expect(svg.getAttribute("style")).toContain("aspect-ratio: 320 / 265");
        expect(svg.getAttribute("aria-label")).toContain(
          language.startsWith("zh") ? spec.nameZh : spec.name
        );
        expect(svg.querySelector("desc")?.textContent).toContain(
          language.startsWith("zh") ? "靜態動作示意" : "Static schematic"
        );
        expect(svg.querySelector("desc")?.textContent).not.toMatch(
          /琥珀|青綠|Amber|teal|primary muscles|secondary muscles/i
        );
        expect(visibleText(thumbnail)).toBe("");
        expect(
          thumbnail.querySelector(
            "span, p, label, button, input, select, text, foreignObject, [data-exercise-muscle-legend], [data-motion-muscle-id], [data-motion-muscle-belly], [data-muscle-role]"
          )
        ).toBeNull();
        const human = svg.querySelector("[data-motion-human=true]")!;
        expect(
          human.querySelector("[data-motion-body-contour]")
        ).not.toBeNull();
        expect(human.querySelector("path[fill='#ded6cc']")).not.toBeNull();
        expect(
          svg.querySelector("[fill='#f59e0b'], [fill='#0d9488']")
        ).toBeNull();
        expect(
          svg.querySelector("[data-motion-apparatus=pec-deck]")
        ).not.toBeNull();
        expect(
          svg.querySelector("[data-apparatus-part=fly-crossbeam]")
        ).not.toBeNull();
        const pose = getMotionPose(spec.id, 0);
        for (const part of getMotionApparatus(spec.id, pose).segments) {
          const line = svg.querySelector(
            `[data-apparatus-part='${part.part}'] line`
          )!;
          expect(line).not.toBeNull();
          expect(
            ["x1", "y1", "x2", "y2"].map(attr =>
              Number(line.getAttribute(attr))
            )
          ).toEqual([
            ...projectMotionPoint(part.a),
            ...projectMotionPoint(part.b),
          ]);
        }
        expect(svg.getAttribute("data-motion-phase")).toBe("0.0000");
        expect(svg.getAttribute("data-motion-stroke")).toBe("0.000");
        initialSvg ??= svg.outerHTML;
        expect(svg.outerHTML).toBe(initialSvg);
      }
      expect(vi.getTimerCount()).toBe(0);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(observer).not.toHaveBeenCalled();
      expect(media.addEventListener).not.toHaveBeenCalled();
      expect(
        listen.mock.calls.some(([type]) => type === "visibilitychange")
      ).toBe(false);
      expect(
        host.querySelector(
          "svg animate, svg animateTransform, iframe, img, image, video, canvas"
        )
      ).toBeNull();
    }
  );

  it.each(["zh-TW", "en"])(
    "%s Pectoral Fly full detail retains muscle colors, accessible legend, controls and disclaimers",
    async language => {
      locale.language = language;
      const zh = language.startsWith("zh");
      await act(async () =>
        root.render(
          React.createElement(ExerciseMotionPreview, {
            exercise: pectoralFly,
            autoplay: false,
          })
        )
      );
      const player = host.querySelector("[data-exercise-motion=svg]")!;
      const legend = player.querySelector("[data-exercise-muscle-legend]")!;
      expect(legend.textContent).toContain(zh ? "主要肌群" : "Primary muscles");
      expect(legend.textContent).toContain(
        zh ? "輔助肌群" : "Secondary muscles"
      );
      expect(legend.textContent).toContain("Pectoralis major");
      expect(legend.textContent).toContain("胸大肌");
      expect(legend.textContent).toContain("Anterior deltoid");
      for (const [role, fill, stroke] of [
        ["primary", "#f59e0b", "#92400e"],
        ["secondary", "#0d9488", "#115e59"],
      ]) {
        const group = player.querySelector(
          `[data-motion-muscle-id][data-muscle-role=${role}]`
        )!;
        const path = group.querySelector("[data-motion-muscle-belly]")!;
        expect(path.getAttribute("fill")).toBe(fill);
        expect(path.getAttribute("stroke")).toBe(stroke);
        expect(path.hasAttribute("stroke-dasharray")).toBe(
          role === "secondary"
        );
        expect(group.querySelector("title")?.textContent).toContain(
          role === "primary"
            ? zh
              ? "主要肌群"
              : "Primary muscle"
            : zh
              ? "輔助肌群"
              : "Secondary muscle"
        );
      }
      expect(
        player.querySelector(
          `button[aria-label='${zh ? "播放動作" : "Play motion"}']`
        )
      ).not.toBeNull();
      expect(
        player.querySelector(
          `button[aria-label='${zh ? "重新示範" : "Restart motion"}']`
        )
      ).not.toBeNull();
      expect(
        player.querySelector(
          `select[aria-label='${zh ? "動作播放速度" : "Motion speed"}']`
        )
      ).not.toBeNull();
      expect(
        player.querySelector(
          `input[aria-label='${zh ? "動作階段" : "Motion phase"}']`
        )
      ).not.toBeNull();
      expect(player.textContent).toContain(
        zh ? "顏色不代表出力多少" : "colors do not quantify effort"
      );
      expect(player.textContent).toContain(
        zh
          ? "不代表特定品牌、實測肌肉活化或你的姿勢評估"
          : "not a specific brand, measured muscle activation or an assessment of your posture"
      );
      expect(player.querySelector("svg desc")?.textContent).toContain(
        zh ? "並非肌肉活化測量" : "not activation measurements"
      );
      const initialPatches = [
        ...player.querySelectorAll("[data-motion-muscle-belly]"),
      ].map(path => path.getAttribute("d"));
      await scrub("50");
      expect(
        player
          .querySelector("svg[data-motion-phase]")
          ?.getAttribute("data-motion-phase")
      ).toBe("0.5000");
      expect(
        [...player.querySelectorAll("[data-motion-muscle-belly]")].map(path =>
          path.getAttribute("d")
        )
      ).not.toEqual(initialPatches);
    }
  );

  it.each([
    { name: "Pectoral Fly", equipment: "Dumbbell", muscleGroup: "chest" },
    { name: "Pectoral Fly custom", equipment: "Machine", muscleGroup: "chest" },
    { name: "unknown", equipment: "Machine", muscleGroup: "lats" },
  ])(
    "$name unsupported compact uses only a neutral accessible placeholder; full message is preserved",
    async exercise => {
      vi.useFakeTimers();
      for (const language of ["zh-TW", "en"]) {
        locale.language = language;
        const zh = language.startsWith("zh");
        await act(async () =>
          root.render(
            React.createElement(ExerciseMotionPreview, {
              exercise,
              compact: true,
            })
          )
        );
        const placeholder = host.querySelector<HTMLDivElement>(
          "[data-exercise-motion=unavailable][data-motion-compact=true][role=img]"
        )!;
        expect(placeholder).not.toBeNull();
        expect(placeholder.style.aspectRatio).toBe("320 / 265");
        expect(placeholder.getAttribute("aria-label")).toContain(exercise.name);
        expect(placeholder.getAttribute("aria-label")).toContain(
          zh ? "動作示意暫不可用" : "Motion preview unavailable"
        );
        expect(visibleText(placeholder)).toBe("");
        expect(placeholder.querySelectorAll("svg")).toHaveLength(1);
        expect(
          placeholder.querySelector("svg.lucide-image-off[aria-hidden=true]")
        ).not.toBeNull();
        expect(placeholder.querySelector("svg")?.getAttribute("fill")).toBe(
          "none"
        );
        expect(
          placeholder.querySelector(
            "span, p, label, button, select, input, text, [data-motion-id], [data-motion-human], [data-motion-apparatus], [data-apparatus-part], [data-motion-muscle-id], [data-exercise-muscle-legend]"
          )
        ).toBeNull();
        await act(async () =>
          root.render(React.createElement(ExerciseMotionPreview, { exercise }))
        );
        const unavailable = host.querySelector(
          "[data-exercise-motion=unavailable][role=status]"
        )!;
        expect(unavailable).not.toBeNull();
        expect(unavailable.textContent).toContain(
          zh ? "簡化動作示意" : "Simplified motion"
        );
        expect(unavailable.textContent).toContain(
          zh
            ? "此動作尚無完全匹配的示意；保持靜態，不使用其他動作或器械代替。"
            : "No exact motion match. Static state only; another exercise or machine is never substituted."
        );
        expect(
          unavailable.querySelector("svg, button, select, input")
        ).toBeNull();
      }
      expect(vi.getTimerCount()).toBe(0);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    }
  );

  it("all 91 compact library cards stay timer-free with only neutral humans and matching apparatus", async () => {
    vi.useFakeTimers();
    await act(async () =>
      root.render(
        React.createElement(
          "div",
          null,
          ...Array.from({ length: 91 }, (_, i) =>
            React.createElement(ExerciseMotionPreview, {
              key: i,
              exercise: cases[i % cases.length],
              compact: true,
            })
          )
        )
      )
    );
    expect(
      host.querySelectorAll("[data-exercise-motion=compact]")
    ).toHaveLength(91);
    expect(host.querySelectorAll("[data-motion-human=true]")).toHaveLength(91);
    expect(host.querySelectorAll("[data-motion-apparatus]")).toHaveLength(91);
    expect(
      host.querySelector(
        "[data-motion-muscle-belly], [data-motion-muscle-id], [data-exercise-muscle-legend], [data-muscle-role]"
      )
    ).toBeNull();
    expect(visibleText(host)).toBe("");
    expect(host.querySelector("button, input, select")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(host.querySelector("svg animate, svg animateTransform")).toBeNull();
  });
});

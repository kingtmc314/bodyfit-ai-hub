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
  vi.unstubAllGlobals();
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

  it("all 91 compact library cards stay timer-free while still rendering muscle bellies", async () => {
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
    expect(
      host.querySelectorAll("[data-motion-muscle-belly]").length
    ).toBeGreaterThan(91);
    expect(host.querySelector("button, input, select")).toBeNull();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(host.querySelector("svg animate, svg animateTransform")).toBeNull();
  });
});

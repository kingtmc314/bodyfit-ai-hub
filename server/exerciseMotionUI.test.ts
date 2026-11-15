// @vitest-environment jsdom
import React, { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXERCISE_MOTIONS } from "../shared/exerciseMotion";

const locale = vi.hoisted(() => ({ language: "zh-TW" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: locale }) }));
import ExerciseMotionPreview, {
  type ExerciseMotionPreviewProps,
} from "../client/src/components/ExerciseMotionPreview";

let root: Root;
let host: HTMLDivElement;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let observers: MockObserver[];
let media: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
let preferenceCallback: (() => void) | undefined;
const exercise = {
  name: "Lat Pulldown",
  equipment: "Cable",
  muscleGroup: "lats",
};

class MockObserver {
  callback: IntersectionObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
  setVisible(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  locale.language = "zh-TW";
  frames = new Map();
  nextFrame = 0;
  observers = [];
  preferenceCallback = undefined;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id))
  );
  vi.stubGlobal("IntersectionObserver", MockObserver);
  media = {
    matches: false,
    addEventListener: vi.fn((_event: string, callback: () => void) => {
      preferenceCallback = callback;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media)
  );
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  expect(frames.size).toBe(0);
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(props: Partial<ExerciseMotionPreviewProps> = {}) {
  await act(async () =>
    root.render(
      React.createElement(ExerciseMotionPreview, { exercise, ...props })
    )
  );
}
async function visible(value = true) {
  await act(async () => observers[observers.length - 1].setVisible(value));
}
async function advance(now: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  await act(async () => callbacks.forEach(callback => callback(now)));
}
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}
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
const phase = () =>
  Number(
    host
      .querySelector("svg[data-motion-phase]")
      ?.getAttribute("data-motion-phase")
  );
const playing = () =>
  host.querySelector("section")?.getAttribute("data-motion-playing");

describe("inline simplified SVG motion React DOM", () => {
  it("always uses an accessible SVG, no WebGL, image, video or external assets", async () => {
    await mount();
    expect(
      host.querySelector(
        "section[data-exercise-motion='svg'][data-motion-id='lat-pulldown'] svg[data-motion-phase]"
      )
    ).not.toBeNull();
    expect(
      host.querySelector("svg[role='img']")?.getAttribute("aria-label")
    ).toContain("簡化動作示意");
    expect(host.textContent).toContain(
      "不代表特定品牌、實測肌肉活化或你的姿勢評估"
    );
    expect(
      host.querySelector("canvas, iframe, video, img, image, script, a[href]")
    ).toBeNull();
    expect(
      host.querySelectorAll("svg animate, svg animateTransform")
    ).toHaveLength(0);
    expect(frames.size).toBe(0);
    await visible();
    expect(frames.size).toBe(1);
  });

  it("play/pause, restart, all speed choices and controlled scrub operate on the same player", async () => {
    await mount();
    await visible();
    await advance(0);
    await advance(100);
    expect(phase()).toBeCloseTo(0.025);
    const slider = host.querySelector<HTMLInputElement>("input[type=range]")!;
    expect(Number(slider.value)).toBeCloseTo(2.5);
    await click("暫停動作");
    expect(frames.size).toBe(0);
    expect(playing()).toBe("false");
    await scrub("50");
    expect(phase()).toBe(0.5);
    expect(
      host
        .querySelector("svg[data-motion-stroke]")
        ?.getAttribute("data-motion-stroke")
    ).toBe("1.000");
    expect(Number(slider.value)).toBe(50);
    await click("重新示範");
    expect(phase()).toBe(0);
    expect(Number(slider.value)).toBe(0);
    expect(playing()).toBe("true");
    const select = host.querySelector<HTMLSelectElement>("select")!;
    expect([...select.options].map(o => o.value)).toEqual(["0.5", "1", "1.5"]);
    for (const speed of [0.5, 1, 1.5]) {
      await act(async () => {
        select.value = String(speed);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const before = phase();
      await advance(1000);
      await advance(1100);
      expect(phase() - before).toBeCloseTo(0.025 * speed, 4);
      expect(Number(slider.value)).toBeCloseTo(phase() * 100, 2);
    }
    expect(observers).toHaveLength(1);
  });

  it("keeps phase, speed, pause state and observer stable through parent timer re-renders", async () => {
    vi.useFakeTimers();
    function TimerParent() {
      const [tick, setTick] = useState(0);
      useEffect(() => {
        const timer = setInterval(() => setTick(n => n + 1), 1000);
        return () => clearInterval(timer);
      }, []);
      return React.createElement(
        "div",
        null,
        React.createElement("output", null, tick),
        React.createElement(ExerciseMotionPreview, {
          exercise: { ...exercise },
        })
      );
    }
    await act(async () => root.render(React.createElement(TimerParent)));
    await visible();
    await scrub("25");
    const select = host.querySelector<HTMLSelectElement>("select")!;
    await act(async () => {
      select.value = "1.5";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(host.querySelector("output")?.textContent).toBe("6");
    expect(phase()).toBe(0.25);
    expect(playing()).toBe("false");
    expect(select.value).toBe("1.5");
    expect(observers).toHaveLength(1);
    expect(observers[0].disconnect).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("reduced motion starts paused but explicit play/restart works, preference changes pause", async () => {
    media.matches = true;
    await mount();
    await visible();
    expect(playing()).toBe("false");
    expect(frames.size).toBe(0);
    await click("播放動作");
    await advance(0);
    await advance(100);
    expect(phase()).toBeGreaterThan(0);
    await act(async () => preferenceCallback!());
    expect(playing()).toBe("false");
    expect(frames.size).toBe(0);
    await click("重新示範");
    expect(phase()).toBe(0);
    expect(frames.size).toBe(1);
  });

  it("autoplay false remains paused even when becoming visible", async () => {
    await mount({ autoplay: false });
    await visible();
    expect(playing()).toBe("false");
    expect(frames.size).toBe(0);
    await click("播放動作");
    expect(frames.size).toBe(1);
  });

  it("cancels rAF offscreen and hidden, resumes without catching up, cleans observer/listeners on unmount", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    await mount();
    await visible();
    await advance(0);
    await advance(100);
    const before = phase();
    await visible(false);
    expect(frames.size).toBe(0);
    expect(playing()).toBe("true");
    await visible(true);
    await advance(100000);
    expect(phase()).toBe(before);
    await act(async () => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(frames.size).toBe(0);
    await act(async () => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(frames.size).toBe(1);
    const queuedCallback = [...frames.values()][0];
    await act(async () => root.render(null));
    expect(frames.size).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(media.removeEventListener).toHaveBeenCalledWith(
      "change",
      preferenceCallback
    );
    expect(
      remove.mock.calls.some(([type]) => type === "visibilitychange")
    ).toBe(true);
    await act(async () => queuedCallback(200000));
    expect(frames.size).toBe(0);
  });

  it("does not schedule while already hidden or restart a paused player on visibility changes", async () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    await mount();
    await visible();
    expect(frames.size).toBe(0);
    await click("暫停動作");
    await act(async () => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await visible(false);
    await visible(true);
    expect(frames.size).toBe(0);
  });

  it("exercise changes reset phase/speed/playstate; same props do not reset; unknown cleans the player", async () => {
    await mount();
    await visible();
    await scrub("50");
    await mount({ exercise: { ...exercise } });
    expect(phase()).toBe(0.5);
    expect(playing()).toBe("false");
    expect(observers).toHaveLength(1);
    await mount({
      exercise: { name: "Seated Leg Curl", equipment: "Machine" },
    });
    expect(phase()).toBe(0);
    expect(playing()).toBe("true");
    expect(host.querySelector("section")?.getAttribute("data-motion-id")).toBe(
      "leg-curl"
    );
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    await visible();
    await mount({
      exercise: {
        name: "custom curl",
        muscleGroup: "hamstrings",
        equipment: "Machine",
      },
    });
    expect(frames.size).toBe(0);
    expect(
      host.querySelector("[data-exercise-motion=unavailable]")
    ).not.toBeNull();
    expect(host.querySelector("svg, button, input")).toBeNull();
    await mount();
    expect(phase()).toBe(0);
    expect(playing()).toBe("true");
  });

  it.each([
    { name: "Pec Deck", equipment: "Dumbbell" },
    { name: "Lat Pulldown custom", equipment: "Cable" },
    { name: "unknown", muscleGroup: "lats", equipment: "Machine" },
  ])(
    "unknown or incompatible $name is a static no-match state",
    async exercise => {
      await mount({ exercise });
      expect(
        host.querySelector("[data-exercise-motion=unavailable][role=status]")
      ).not.toBeNull();
      expect(host.textContent).toContain("不使用其他動作或器械代替");
      expect(
        host.querySelector("svg, canvas, button, select, input, iframe")
      ).toBeNull();
      expect(observers).toHaveLength(0);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    }
  );

  it("compact cards are truly static and never allocate per-card animation/listeners", async () => {
    const listen = vi.spyOn(document, "addEventListener");
    await mount({ compact: true });
    expect(
      host.querySelector(
        "[data-exercise-motion=compact] svg[data-motion-phase='0.0000']"
      )
    ).not.toBeNull();
    expect(host.textContent).toContain("簡化動作示意");
    expect(host.querySelector("button, input, select")).toBeNull();
    expect(observers).toHaveLength(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(media.addEventListener).not.toHaveBeenCalled();
    expect(
      listen.mock.calls.some(([type]) => type === "visibilitychange")
    ).toBe(false);
    await mount({ compact: false });
    await visible();
    expect(frames.size).toBe(1);
    await mount({ compact: true });
    expect(frames.size).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("works without IntersectionObserver and with the older iOS media listener API", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const legacy = {
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => legacy)
    );
    await mount();
    expect(legacy.addListener).toHaveBeenCalledTimes(1);
    expect(playing()).toBe("false");
    await click("播放動作");
    expect(frames.size).toBe(1);
    await act(async () => root.render(null));
    expect(legacy.removeListener).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });

  it("has English controls and limitations when the app language is English", async () => {
    locale.language = "en";
    await mount({ autoplay: false });
    expect(host.textContent).toContain("Simplified motion");
    expect(host.textContent).toContain(
      "not a specific brand, measured muscle activation or an assessment of your posture"
    );
    expect(
      host.querySelector("button[aria-label='Play motion']")
    ).not.toBeNull();
    expect(
      host.querySelector("button[aria-label='Restart motion']")
    ).not.toBeNull();
    expect(
      host.querySelector("select[aria-label='Motion speed']")
    ).not.toBeNull();
    expect(
      host.querySelector("input[aria-label='Motion phase']")
    ).not.toBeNull();
  });

  it.each(EXERCISE_MOTIONS)(
    "renders $id with its own apparatus and finite SVG endpoints",
    async spec => {
      await mount({
        exercise: { name: spec.name, equipment: spec.equipment[0] },
        autoplay: false,
      });
      expect(
        host.querySelector(`[data-motion-apparatus='${spec.id}']`)
      ).not.toBeNull();
      expect(host.querySelector("[data-motion-human=true]")).not.toBeNull();
      for (const position of ["0", "25", "50", "75", "100"]) {
        await scrub(position);
        for (const line of host.querySelectorAll("line")) {
          for (const attribute of ["x1", "y1", "x2", "y2"]) {
            const value = Number(line.getAttribute(attribute));
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThan(0);
            expect(value).toBeLessThan(365);
          }
        }
      }
    }
  );
});

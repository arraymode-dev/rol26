import { track, type AnalyticsProperties } from "./analytics.ts";
/** Capture completed input gestures, never camera animation frames or GPS coordinates. */
export function attachMapAnalytics(
  canvas: HTMLElement,
  host: Window,
  zoomLevel: () => string = () => "unknown",
  emit: (name: string, p: AnalyticsProperties) => void = track,
) {
  const points = new Map<number, { x: number; y: number }>();
  let start = 0,
    distance = 0,
    maxPointers = 0,
    input = "",
    button = 0,
    cancelled = false;
  const gestures = new Set<string>();
  let wheelTimer: ReturnType<typeof setTimeout> | undefined,
    keyTimer: ReturnType<typeof setTimeout> | undefined,
    wheelStart = 0,
    wheelSum = 0,
    wheelPinch = false,
    keyStart = 0;
  const keys = new Set<string>();
  const finish = () => {
    if (start && (distance >= 4 || gestures.size)) {
      emit("Map gesture", {
        input,
        gestures: [...gestures].sort().join(","),
        max_pointers: maxPointers,
        distance_px: Math.round(distance),
        duration_ms: Math.round(performance.now() - start),
        cancelled,
        zoom_level: zoomLevel(),
      });
    }
    start = 0;
    distance = 0;
    maxPointers = 0;
    points.clear();
    gestures.clear();
    cancelled = false;
  };
  const down = (event: PointerEvent) => {
    if (event.target !== canvas) return;
    if (!points.size) {
      start = performance.now();
      input = event.pointerType || "mouse";
      button = event.button;
    }
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    maxPointers = Math.max(maxPointers, points.size);
  };
  const move = (event: PointerEvent) => {
    const old = points.get(event.pointerId);
    if (!old) return;
    const next = { x: event.clientX, y: event.clientY };
    const delta = Math.hypot(next.x - old.x, next.y - old.y);
    distance += delta;
    if (points.size === 1) {
      if (distance >= 4)
        gestures.add(
          input === "touch" || button === 0
            ? "pan"
            : button === 1
              ? "zoom"
              : "rotate",
        );
    } else {
      const other = [...points.entries()].find(
        ([id]) => id !== event.pointerId,
      )![1];
      const before = Math.hypot(old.x - other.x, old.y - other.y),
        after = Math.hypot(next.x - other.x, next.y - other.y);
      if (Math.abs(after - before) > 0.4) gestures.add("zoom");
      const angle =
        Math.atan2(next.y - other.y, next.x - other.x) -
        Math.atan2(old.y - other.y, old.x - other.x);
      if (Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) > 0.003)
        gestures.add("rotate");
      if (Math.abs(next.y - old.y) > 0.5) gestures.add("tilt");
    }
    points.set(event.pointerId, next);
  };
  const up = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.delete(event.pointerId);
    cancelled ||= event.type === "pointercancel";
    if (!points.size) finish();
  };
  const flushWheel = () => {
    clearTimeout(wheelTimer);
    wheelTimer = undefined;
    if (wheelStart)
      emit("Map gesture", {
        input: wheelPinch ? "trackpad-pinch" : "wheel",
        gestures: "zoom",
        wheel_direction: wheelSum < 0 ? "in" : "out",
        duration_ms: Math.round(performance.now() - wheelStart),
        zoom_level: zoomLevel(),
      });
    wheelStart = 0;
    wheelSum = 0;
    wheelPinch = false;
  };
  const wheel = (event: WheelEvent) => {
    if (event.target !== canvas || event.deltaY === 0) return;
    wheelStart ||= performance.now();
    wheelSum += event.deltaY;
    wheelPinch ||= event.ctrlKey;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(flushWheel, 300);
  };
  const flushKey = () => {
    clearTimeout(keyTimer);
    keyTimer = undefined;
    if (keyStart)
      emit("Map gesture", {
        input: "keyboard",
        gestures: [...keys].sort().join(","),
        duration_ms: Math.round(performance.now() - keyStart),
        zoom_level: zoomLevel(),
      });
    keys.clear();
    keyStart = 0;
  };
  const key = (event: KeyboardEvent) => {
    if (
      event.target !== canvas ||
      ![
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "+",
        "=",
        "-",
      ].includes(event.key)
    )
      return;
    keyStart ||= performance.now();
    keys.add(event.key.startsWith("Arrow") ? "pan" : "zoom");
    clearTimeout(keyTimer);
    keyTimer = setTimeout(flushKey, 300);
  };
  const blur = () => {
    cancelled = true;
    finish();
    flushWheel();
    flushKey();
  };
  // Window capture precedes the camera's stopImmediatePropagation wheel handler.
  host.addEventListener("pointerdown", down, { capture: true, passive: true });
  host.addEventListener("pointermove", move, { capture: true, passive: true });
  host.addEventListener("pointerup", up, true);
  host.addEventListener("pointercancel", up, true);
  host.addEventListener("wheel", wheel, { capture: true, passive: true });
  host.addEventListener("keydown", key, true);
  host.addEventListener("blur", blur);
  host.addEventListener("pagehide", blur);
  return () => {
    host.removeEventListener("pointerdown", down, { capture: true });
    host.removeEventListener("pointermove", move, { capture: true });
    host.removeEventListener("pointerup", up, { capture: true });
    host.removeEventListener("pointercancel", up, { capture: true });
    host.removeEventListener("wheel", wheel, { capture: true });
    host.removeEventListener("keydown", key, { capture: true });
    host.removeEventListener("blur", blur);
    host.removeEventListener("pagehide", blur);
    clearTimeout(wheelTimer);
    clearTimeout(keyTimer);
  };
}

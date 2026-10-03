import { useEffect, useRef } from "react";

/** Demand-rendered desktop orbit: input stops it synchronously, timers wake it. */
export function useIdleOrbit(
  selected: string | null,
  selectionSequence: number,
  reducedMotion: boolean,
  invalidate: () => void,
) {
  const active = useRef(false);
  useEffect(() => {
    const desktop = matchMedia(
      "(min-width: 701px) and (hover: hover) and (pointer: fine)",
    );
    const pointers = new Set<number>();
    const keys = new Set<string>();
    let focused = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const eligible = () =>
      !!selected &&
      !reducedMotion &&
      desktop.matches &&
      focused &&
      document.visibilityState === "visible" &&
      !pointers.size &&
      !keys.size;
    const stop = () => {
      active.current = false;
      clearTimeout(timer);
    };
    const activity = () => {
      stop();
      if (eligible())
        timer = setTimeout(() => {
          if (eligible()) {
            active.current = true;
            invalidate();
          }
        }, 4000);
    };
    const down = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      activity();
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      activity();
    };
    const keyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      activity();
    };
    const keyUp = (event: KeyboardEvent) => {
      keys.delete(event.code);
      activity();
    };
    const blur = () => {
      focused = false;
      pointers.clear();
      keys.clear();
      stop();
    };
    const focus = () => {
      focused = true;
      activity();
    };
    const options = { capture: true, passive: true };
    window.addEventListener("pointerdown", down, options);
    window.addEventListener("pointerup", up, options);
    window.addEventListener("pointercancel", up, options);
    window.addEventListener("pointermove", activity, options);
    window.addEventListener("wheel", activity, options);
    window.addEventListener("keydown", keyDown, options);
    window.addEventListener("keyup", keyUp, options);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", activity);
    desktop.addEventListener("change", activity);
    activity();
    return () => {
      stop();
      window.removeEventListener("pointerdown", down, options);
      window.removeEventListener("pointerup", up, options);
      window.removeEventListener("pointercancel", up, options);
      window.removeEventListener("pointermove", activity, options);
      window.removeEventListener("wheel", activity, options);
      window.removeEventListener("keydown", keyDown, options);
      window.removeEventListener("keyup", keyUp, options);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", activity);
      desktop.removeEventListener("change", activity);
    };
  }, [selected, selectionSequence, reducedMotion, invalidate]);
  return active;
}

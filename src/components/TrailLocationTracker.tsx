import { track } from "../lib/analytics";
import { useEffect } from "react";
import type { TrailLocationStore } from "../lib/trail-location";

/** Mounted only in trail mode; hiding or leaving the page stops GPS. */
export function TrailLocationTracker({ store }: { store: TrailLocationStore }) {
  const start = () =>
    store.start(navigator.geolocation, window.isSecureContext);
  useEffect(() => {
    let previous = store.getSnapshot().status;
    const unsubscribe = store.subscribe(() => {
      const status = store.getSnapshot().status;
      if (status === previous) return;
      previous = status;
      track("GPS status changed", { status });
    });
    const resume = () => {
      if (document.visibilityState === "visible") start();
      else store.stop("paused");
    };
    const pause = () => store.stop("paused");
    resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", resume);
      store.stop();
      unsubscribe();
    };
  }, [store]);
  return null;
}

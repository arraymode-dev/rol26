import { useEffect, useSyncExternalStore } from "react";
import type { TrailLocationStore, LocationStatus } from "../lib/trail-location";

const messages: Record<LocationStatus, string> = {
  off: "Location off",
  locating: "Finding you… Allow location when asked",
  active: "You are here",
  denied: "Location blocked · allow location in browser settings",
  unavailable: "Location unavailable · check your phone’s location settings",
  timeout: "Waiting for GPS · try an open space",
  unsupported: "Location is unavailable in this browser",
  insecure: "Open this map over HTTPS to use GPS",
  paused: "Location paused while the map is in the background",
  stale: "GPS signal lost · waiting for a fresh location",
};

/** Mounted only in trail mode; hiding or leaving the page stops GPS. */
export function TrailLocationStatus({ store }: { store: TrailLocationStore }) {
  const { status, fix } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const start = () =>
    store.start(navigator.geolocation, window.isSecureContext);
  useEffect(() => {
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
    };
  }, [store]);
  const retry = ["denied", "unavailable", "timeout", "stale"].includes(status);
  return (
    <div className="trail-location-status">
      <span
        className={`location-status-dot${fix ? " is-live" : ""}`}
        aria-hidden="true"
      />
      <span role="status">
        {fix
          ? `You are here · GPS ±${Math.ceil(fix.accuracy)} m`
          : messages[status]}
      </span>
      {retry && <button onClick={start}>Retry GPS</button>}
    </div>
  );
}

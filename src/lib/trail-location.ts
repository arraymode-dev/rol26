export interface LocationFix {
  longitude: number;
  latitude: number;
  accuracy: number;
  timestamp: number;
}
export type LocationStatus =
  | "off"
  | "locating"
  | "active"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "insecure"
  | "paused"
  | "stale";
export interface LocationSnapshot {
  status: LocationStatus;
  fix: LocationFix | null;
}
export const LOCATION_MAX_AGE = 30_000;

/** One browser watch, in memory only. Generation checks reject late callbacks. */
export function createTrailLocation() {
  let snapshot: LocationSnapshot = { status: "off", fix: null };
  const listeners = new Set<() => void>();
  let generation = 0;
  let cancelWatch: (() => void) | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const publish = (status: LocationStatus, fix: LocationFix | null = null) => {
    snapshot = { status, fix };
    listeners.forEach((listener) => listener());
  };
  const clear = () => {
    generation++;
    cancelWatch?.();
    cancelWatch = undefined;
    clearTimeout(expiry);
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stop(status: "off" | "paused" = "off") {
      clear();
      publish(status);
    },
    start(
      geolocation:
        Pick<Geolocation, "watchPosition" | "clearWatch"> | undefined,
      secure = true,
      maximumAge = 5000,
    ) {
      clear();
      if (!secure) {
        publish("insecure");
        return;
      }
      if (!geolocation) {
        publish("unsupported");
        return;
      }
      publish("locating");
      const session = generation;
      try {
        const id = geolocation.watchPosition(
          ({ coords, timestamp }) => {
            if (session !== generation) return;
            const { longitude, latitude, accuracy } = coords;
            if (
              !Number.isFinite(longitude) ||
              !Number.isFinite(latitude) ||
              !Number.isFinite(accuracy) ||
              accuracy < 0 ||
              Math.abs(latitude) > 90 ||
              Math.abs(longitude) > 180 ||
              !Number.isFinite(timestamp)
            ) {
              publish("unavailable");
              return;
            }
            clearTimeout(expiry);
            const remaining =
              LOCATION_MAX_AGE - Math.max(0, Date.now() - timestamp);
            if (remaining <= 0) {
              publish("stale");
              return;
            }
            publish("active", { longitude, latitude, accuracy, timestamp });
            expiry = setTimeout(() => {
              if (session === generation) publish("stale");
            }, remaining);
          },
          (error) => {
            if (session !== generation) return;
            clearTimeout(expiry);
            if (error.code === 1) {
              clear();
              publish("denied");
            } else publish(error.code === 3 ? "timeout" : "unavailable");
          },
          { enableHighAccuracy: true, maximumAge, timeout: 15000 },
        );
        // Also safe with synchronously responding test providers.
        if (session === generation)
          cancelWatch = () => geolocation.clearWatch(id);
        else geolocation.clearWatch(id);
      } catch {
        clear();
        publish("unavailable");
      }
    },
  };
}
export type TrailLocationStore = ReturnType<typeof createTrailLocation>;

import { useSyncExternalStore } from "react";
import { Html } from "@react-three/drei";
import { project } from "../lib/geo";
import type { TrailLocationStore } from "../lib/trail-location";

/** Only this tiny overlay subscribes to fixes; city geometry stays untouched. */
export function UserLocationMarker({ store }: { store: TrailLocationStore }) {
  const { fix } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (!fix) return null;
  const [x, z] = project(fix.longitude, fix.latitude);
  return (
    <Html
      center
      position={[x, 3, z]}
      zIndexRange={[25, 21]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="user-location-marker"
        role="img"
        aria-label={`Your location, accuracy ${Math.ceil(fix.accuracy)} metres`}
      >
        <span className="user-location-dot" />
        <span className="user-location-label">You</span>
      </div>
    </Html>
  );
}

import { memo, useEffect, useMemo } from "react";
import {
  buildWaterfrontLandmark,
  WATERFRONT_LANDMARK_IDS,
  type LandmarkFootprint,
} from "../lib/waterfront-landmarks";
import type { MapFeature } from "../types";
export { WATERFRONT_LANDMARK_IDS };
const Landmark = memo(function Landmark({
  footprint,
  night,
}: {
  footprint: LandmarkFootprint;
  night: boolean;
}) {
  const parts = useMemo(() => buildWaterfrontLandmark(footprint), [footprint]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  return (
    <group userData={{ ghostBuilding: true, ghostFootprint: footprint }}>
      {parts.map(({ material, geometry }) => (
        <mesh key={material} geometry={geometry} castShadow receiveShadow>
          {material === "clock" ? (
            <meshBasicMaterial color={night ? "#f1e8ca" : "#fcf6e6"} />
          ) : (
            <meshStandardMaterial
              color={
                material === "glass" || material === "metal"
                  ? "#14212a"
                  : "#c5c7cb"
              }
              roughness={material === "glass" ? 0.45 : 0.85}
            />
          )}
        </mesh>
      ))}
    </group>
  );
});
export const WaterfrontLandmarks = memo(function WaterfrontLandmarks({
  buildings,
  night,
}: {
  buildings: MapFeature[];
  night: boolean;
}) {
  return (
    <group>
      {buildings
        .filter((b) => WATERFRONT_LANDMARK_IDS.includes(b.id))
        .map((b) => (
          <Landmark key={b.id} footprint={b} night={night} />
        ))}
    </group>
  );
});

import { memo, useEffect, useMemo } from "react";
import type { MapData } from "../types";
import { buildDockBoats, dockBoatLayout } from "../lib/dock-boats";
export const DockBoats = memo(function DockBoats({ data }: { data: MapData }) {
  const batches = useMemo(() => buildDockBoats(dockBoatLayout(data)), [data]);
  useEffect(
    () => () => batches.forEach((b) => b.geometry.dispose()),
    [batches],
  );
  return (
    <group>
      {batches.map((b) => (
        <mesh key={b.colour} geometry={b.geometry} castShadow receiveShadow>
          <meshStandardMaterial color={b.colour} roughness={0.68} flatShading />
        </mesh>
      ))}
    </group>
  );
});

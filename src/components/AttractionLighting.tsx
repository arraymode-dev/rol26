import { EVENT_SITE_IDS } from "../lib/event-lighting";
import { TOWN_HALL } from "./TownHall";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { installations } from "../data/installations";
import { project } from "../lib/geo";
import { PRIMARY } from "../lib/palette";

// One shadowed local light, shared by the nearest close-up, rather than 13 lights.
export function AttractionLighting({
  night,
  selected,
}: {
  night: boolean;
  selected: string | null;
}) {
  const light = useRef<THREE.PointLight>(null);
  const sites = useMemo(
    () =>
      installations.map((i) => {
        const [x, z] =
          i.id === "the-anooki"
            ? [
                TOWN_HALL.x + Math.sin(TOWN_HALL.rotation) * 35,
                TOWN_HALL.z + Math.cos(TOWN_HALL.rotation) * 35,
              ]
            : project(...i.coordinates);
        return new THREE.Vector3(
          x,
          i.number === 1 ? 18 : i.number === 4 ? 14 : 10,
          z,
        );
      }),
    [],
  );
  useFrame(({ camera }) => {
    const selectedIndex = installations.findIndex((i) => i.id === selected);
    const nearest =
      selectedIndex >= 0
        ? sites[selectedIndex]
        : sites.reduce((a, b) =>
            camera.position.distanceToSquared(a) <
            camera.position.distanceToSquared(b)
              ? a
              : b,
          );
    const detail =
      1 -
      THREE.MathUtils.smoothstep(camera.position.distanceTo(nearest), 190, 500);
    light.current!.position.copy(nearest);
    const isPilot = EVENT_SITE_IDS.includes(
      installations[sites.indexOf(nearest)].id,
    );
    light.current!.intensity = night && !isPilot ? 700 * detail : 0;
    light.current!.visible = night && !isPilot && detail > 0;
  });
  return (
    <pointLight
      ref={light}
      color={PRIMARY}
      intensity={0}
      distance={85}
      decay={2}
      castShadow
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.0002}
      shadow-normalBias={0.2}
    />
  );
}

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import * as THREE from "three";
import { EVENT_POOLS } from "../lib/event-lighting";

/** Two non-shadowed lights shared by the nearest artwork. Static surface
 * washes remain visible everywhere, including low quality; these only add local
 * response on the sculpture and adjacent surfaces when the camera is close. */
export function EventLighting({ night }: { night: boolean }) {
  const key = useRef<THREE.PointLight>(null);
  const fill = useRef<THREE.PointLight>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, controls }) => {
    const target =
      (controls as OrbitControls | null)?.target ?? camera.position;
    const nearest = EVENT_POOLS.reduce((a, b) =>
      Math.hypot(a.x - target.x, a.z - target.z) <
      Math.hypot(b.x - target.x, b.z - target.z)
        ? a
        : b,
    );
    point.set(nearest.x, nearest.y + 5, nearest.z);
    const detail =
      1 -
      THREE.MathUtils.smoothstep(camera.position.distanceTo(point), 180, 620);
    const proximity =
      1 -
      THREE.MathUtils.smoothstep(
        Math.hypot(target.x - nearest.x, target.z - nearest.z),
        65,
        150,
      );
    const intensity = night ? detail * proximity : 0;
    key.current!.position.copy(point);
    key.current!.color.set(nearest.colour);
    key.current!.intensity = 230 * intensity;
    fill.current!.position.set(nearest.x + 5, nearest.y + 3, nearest.z + 3);
    fill.current!.color.set(nearest.secondary);
    fill.current!.intensity = 110 * intensity;
  });
  return (
    <group name="Artwork area lighting">
      <pointLight ref={key} intensity={0} distance={32} decay={2} />
      <pointLight ref={fill} intensity={0} distance={24} decay={2} />
    </group>
  );
}

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import * as THREE from "three";

/** Keep shadow detail on the area being viewed, including at street scale. */
export function MapSunlight({
  night,
  shadows,
}: {
  night: boolean;
  shadows: boolean;
}) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ camera, controls }) => {
    const sun = light.current;
    if (!sun || !controls) return;
    const centre = (controls as OrbitControls).target;
    target.position.set(centre.x, 0, centre.z);
    target.updateMatrixWorld();
    sun.position.set(centre.x - 600, 1200, centre.z - 400);

    // The old fixed 2.6 km shadow view blurred contact across several metres
    // when zoomed in. Fit this same texture to the current camera distance.
    const radius = THREE.MathUtils.clamp(
      camera.position.distanceTo(centre) * 0.9,
      100,
      1700,
    );
    const shadowCamera = sun.shadow.camera;
    if (Math.abs(shadowCamera.right - radius) > 0.01) {
      shadowCamera.left = shadowCamera.bottom = -radius;
      shadowCamera.right = shadowCamera.top = radius;
      shadowCamera.updateProjectionMatrix();
    }
  }, 0.5);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        position={[-600, 1200, -400]}
        intensity={night ? 1.1 : 1.65}
        color={night ? "#c5daf4" : "#fff2d5"}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={3200}
        shadow-normalBias={0.04}
      />
    </>
  );
}

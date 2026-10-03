import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { ANCHOR_ORIGIN, buildAnchorCourtyard } from "../lib/anchor-courtyard";

export const AnchorCourtyard = memo(function AnchorCourtyard() {
  const batches = useMemo(buildAnchorCourtyard, []);
  useEffect(
    () => () => batches.forEach(({ geometry }) => geometry.dispose()),
    [batches],
  );
  const meshes = (detail: boolean) =>
    batches
      .filter((b) => b.detail === detail)
      .map((b, i) => (
        <mesh key={i} geometry={b.geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={b.colour}
            roughness={0.9}
            side={b.material === "leaf" ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
      ));
  return (
    <group position={[ANCHOR_ORIGIN[0], 0, ANCHOR_ORIGIN[1]]}>
      {meshes(false)}
      <Detailed distances={[0, 320]} hysteresis={0.12}>
        <group>{meshes(true)}</group>
        <group />
      </Detailed>
    </group>
  );
});

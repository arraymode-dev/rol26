import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildParadigm, PARADIGM } from "../lib/paradigm";
import { PARADIGM_SCALE } from "../lib/paradigm-placement";

export const Paradigm = memo(function Paradigm({ night }: { night: boolean }) {
  const model = useMemo(buildParadigm, []);
  const halo = useMemo(() => {
    const size = 32,
      data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(
          ((x + 0.5) / size) * 2 - 1,
          ((y + 0.5) / size) * 2 - 1,
        );
        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(Math.max(0, 1 - r) ** 3 * 255);
      }
    const texture = new THREE.DataTexture(data, size, size);
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(
    () => () => {
      Object.values(model).forEach((g) => g.dispose());
      halo.dispose();
    },
    [model, halo],
  );
  return (
    <group scale={PARADIGM_SCALE}>
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.15, 0.18, 32]} />
        <meshStandardMaterial color="#252b30" roughness={0.85} />
      </mesh>
      <mesh position={[0, PARADIGM.centreY / 2, 0]}>
        <cylinderGeometry args={[0.13, 0.2, PARADIGM.centreY, 8]} />
        <meshStandardMaterial color="#35353a" roughness={0.6} />
      </mesh>
      <mesh position={[0, PARADIGM.centreY, 0]}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial
          color="#24282e"
          metalness={0.45}
          roughness={0.5}
        />
      </mesh>
      <mesh geometry={model.rods}>
        <meshStandardMaterial
          color="#857064"
          emissive="#ff610c"
          emissiveIntensity={night ? 0.22 : 0}
          metalness={0.65}
          roughness={0.38}
        />
      </mesh>
      <mesh geometry={model.sockets}>
        <meshStandardMaterial color="#693d22" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh geometry={model.tips}>
        <meshStandardMaterial
          color="#ffe1a1"
          emissive="#ff790c"
          emissiveIntensity={night ? 5 : 0}
          toneMapped={false}
        />
      </mesh>
      {night && (
        <points geometry={model.glows} renderOrder={2}>
          <pointsMaterial
            map={halo}
            color="#ff630d"
            size={1.1 * PARADIGM_SCALE}
            transparent
            opacity={0.85}
            fog={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      )}
    </group>
  );
});

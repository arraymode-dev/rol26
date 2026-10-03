import { memo, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MapData } from "../types";
import { riverFurnitureLayout } from "../lib/river-furniture";

// Shared geometry for the full waterfront: no per-fixture lights or shadows.
export const RiverFurniture = memo(function RiverFurniture({
  data,
  night,
}: {
  data: MapData;
  night: boolean;
}) {
  const assets = useMemo(() => {
    const layout = riverFurnitureLayout(data),
      root = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({
      color: "#303a3a",
      roughness: 0.87,
    });
    const orange = new THREE.MeshStandardMaterial({
      color: "#e5793c",
      roughness: 0.8,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: "#ecdfbf",
      emissive: "#ffe1a3",
      emissiveIntensity: night ? 0.7 : 0,
    });
    const batches = new Map<
      string,
      {
        geometry: THREE.BufferGeometry;
        material: THREE.Material;
        matrices: THREE.Matrix4[];
      }
    >();
    batches.set("rod", {
      geometry: new THREE.CylinderGeometry(1, 1, 1, 6),
      material: iron,
      matrices: [],
    });
    batches.set("base", {
      geometry: new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8),
      material: iron,
      matrices: [],
    });
    batches.set("stem", {
      geometry: new THREE.CylinderGeometry(0.065, 0.12, 3.4, 8),
      material: iron,
      matrices: [],
    });
    batches.set("glass", {
      geometry: new THREE.CylinderGeometry(0.3, 0.18, 0.66, 4),
      material: glass,
      matrices: [],
    });
    batches.set("cap", {
      geometry: new THREE.ConeGeometry(0.43, 0.3, 4),
      material: iron,
      matrices: [],
    });
    batches.set("bin", {
      geometry: new THREE.CylinderGeometry(0.34, 0.34, 1.04, 12),
      material: iron,
      matrices: [],
    });
    batches.set("ring", {
      geometry: new THREE.TorusGeometry(0.35, 0.09, 6, 16),
      material: orange,
      matrices: [],
    });
    const obj = new THREE.Object3D();
    const add = (
      name: string,
      x: number,
      y: number,
      z: number,
      rotation = 0,
    ) => {
      obj.position.set(x, y, z);
      obj.rotation.set(0, rotation, 0);
      obj.scale.set(1, 1, 1);
      obj.updateMatrix();
      batches.get(name)!.matrices.push(obj.matrix.clone());
    };
    const rod = (a: number[], b: number[], radius: number) => {
      const from = new THREE.Vector3(...a),
        to = new THREE.Vector3(...b),
        delta = to.clone().sub(from);
      obj.position.copy(from.add(to).multiplyScalar(0.5));
      obj.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.clone().normalize(),
      );
      obj.scale.set(radius, delta.length(), radius);
      obj.updateMatrix();
      batches.get("rod")!.matrices.push(obj.matrix.clone());
    };
    const posts = new Set<string>();
    for (const [a, b] of layout.chains) {
      for (const p of [a, b]) {
        const key = p.map((v) => v.toFixed(3)).join(",");
        if (!posts.has(key)) {
          posts.add(key);
          rod([p[0], -0.04, p[1]], [p[0], 1.26, p[1]], 0.085);
        }
      }
      for (const y of [0.45, 0.8, 1.2])
        for (let k = 0; k < 4; k++) {
          const at = (t: number) => [
            a[0] + (b[0] - a[0]) * t,
            y - 0.16 * Math.sin(Math.PI * t),
            a[1] + (b[1] - a[1]) * t,
          ];
          rod(at(k / 4), at((k + 1) / 4), 0.024);
        }
    }
    for (const {
      lamp: [x, z],
      bin,
      ring,
      angle,
    } of layout.groups) {
      add("base", x, 0.24, z);
      add("stem", x, 2.1, z);
      add("glass", x, 4.02, z);
      add("cap", x, 4.43, z);
      rod([x, 4.56, z], [x, 4.8, z], 0.055);
      for (const dx of [-0.16, 0.16])
        for (const dz of [-0.16, 0.16])
          rod(
            [x + dx, 3.68, z + dz],
            [x + dx * 1.65, 4.35, z + dz * 1.65],
            0.025,
          );
      add("bin", bin[0], 0.51, bin[1]);
      rod([ring[0], -0.04, ring[1]], [ring[0], 1.65, ring[1]], 0.05);
      add("ring", ring[0], 1.2, ring[1], -angle);
    }
    for (const { geometry, material, matrices } of batches.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
    return {
      root,
      dispose: () => {
        for (const b of batches.values()) b.geometry.dispose();
        iron.dispose();
        orange.dispose();
        glass.dispose();
      },
    };
  }, [data, night]);
  useEffect(() => () => assets.dispose(), [assets]);
  useFrame(({ camera }) => {
    // Tiny quay fittings contribute only subpixel noise from overview height.
    // Keep their shared batches resident, so approaching does not rebuild them.
    assets.root.visible = camera.position.y < (assets.root.visible ? 320 : 260);
  });
  return <primitive object={assets.root} />;
});

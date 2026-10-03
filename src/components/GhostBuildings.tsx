import { GHOST_DEPTH_LAYER } from "./BoundaryDepth";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Footprint } from "../lib/attraction-boundary";
import { splitGhostGeometry } from "../lib/ghost-geometry";

/** Applies the same footprint mask to every custom model, including its windows. */
export function GhostBuildings({
  footprints,
  night,
  children,
}: {
  footprints: readonly Footprint[];
  night: boolean;
  children: ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const group = root.current!;
    group.updateWorldMatrix(true, true);
    const restore: (() => void)[] = [];
    const meshes: THREE.Mesh[] = [];
    group.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        !(object instanceof THREE.InstancedMesh)
      )
        meshes.push(object);
    });
    if (footprints.length)
      for (const mesh of meshes) {
        if (Array.isArray(mesh.material)) continue;
        const original = mesh.geometry;
        let parent: THREE.Object3D | null = mesh;
        let buildingOnly = false;
        let preserve = false;
        let ownedFootprint: Footprint | undefined;
        while (parent && parent !== group) {
          preserve ||= parent.userData.ghostPreserve === true;
          buildingOnly ||= parent.userData.ghostBuilding === true;
          ownedFootprint ??= parent.userData.ghostFootprint;
          parent = parent.parent;
        }
        if (preserve) continue;
        // A single landmark owns its body, towers and facade details. Use its
        // footprint once, rather than fading each attachment independently.
        if (ownedFootprint && !footprints.includes(ownedFootprint)) continue;
        const split = splitGhostGeometry(
          original,
          mesh.matrixWorld,
          footprints,
          buildingOnly,
          !!ownedFootprint,
        );
        if (!split) continue;
        const material = new THREE.MeshStandardMaterial({
          color: night ? "#809a9e" : "#c5c4b9",
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        });
        const ghost = new THREE.Mesh(split.ghost, material);
        ghost.renderOrder = 2;
        ghost.layers.enable(GHOST_DEPTH_LAYER);
        ghost.raycast = () => {}; // The original artwork retains its click target.
        mesh.geometry = split.solid;
        mesh.add(ghost);
        restore.push(() => {
          mesh.remove(ghost);
          mesh.geometry = original;
          split.solid.dispose();
          split.ghost.dispose();
          material.dispose();
        });
      }
    invalidate();
    return () => {
      restore.forEach((fn) => fn());
    };
  }, [footprints, night, invalidate]);
  return <group ref={root}>{children}</group>;
}

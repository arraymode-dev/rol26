import { GHOST_DEPTH_LAYER } from "./BoundaryDepth";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Footprint } from "../lib/attraction-boundary";
import {
  splitGhostGeometry,
  syncGeometryAttributes,
  disposeGeometryView,
} from "../lib/ghost-geometry";

type Selection = { id: string; footprints: readonly Footprint[] };
/** Prepare index-only cutaways at scene creation, never during a camera flight.
 * Windows, walls and furniture retain the exact same triangles and materials. */
export function GhostBuildings({
  selections,
  selected,
  night,
  opacity = 0.12,
  children,
}: {
  selections: readonly Selection[];
  selected: string | null;
  night: boolean;
  opacity?: number;
  children: ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const activate = useRef<(id: string | null) => void>(() => {});
  useLayoutEffect(() => {
    const group = root.current!;
    group.updateWorldMatrix(true, true);
    const restore: (() => void)[] = [];
    const switches: ((id: string | null) => void)[] = [];
    const meshes: THREE.Mesh[] = [];
    group.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        !(object instanceof THREE.InstancedMesh) &&
        !object.userData.cameraClearanceOverlay
      )
        meshes.push(object);
    });
    for (const mesh of meshes) {
      if (Array.isArray(mesh.material)) continue;
      const original = mesh.geometry;
      if (!original.getAttribute("position")) continue;
      let buildingOnly = false,
        preserve = false;
      let preserveFor: string | undefined, owner: Footprint | undefined;
      for (
        let parent: THREE.Object3D | null = mesh;
        parent && parent !== group;
        parent = parent.parent
      ) {
        buildingOnly ||= parent.userData.ghostBuilding === true;
        preserve ||= parent.userData.ghostPreserve === true;
        preserveFor ??= parent.userData.ghostPreserveFor;
        owner ??= parent.userData.ghostFootprint;
      }
      if (preserve) continue;
      const variants = new Map<
        string,
        NonNullable<ReturnType<typeof splitGhostGeometry>>
      >();
      for (const selection of selections) {
        if (
          selection.id === preserveFor ||
          (owner && !selection.footprints.includes(owner))
        )
          continue;
        const split = splitGhostGeometry(
          original,
          mesh.matrixWorld,
          selection.footprints,
          buildingOnly,
          !!owner,
          true,
        );
        if (split) variants.set(selection.id, split);
      }
      if (!variants.size) continue;
      const material = new THREE.MeshStandardMaterial({
        color: night ? "#809a9e" : "#c5c4b9",
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const ghost = new THREE.Mesh(
        variants.values().next().value!.ghost,
        material,
      );
      ghost.visible = false;
      ghost.renderOrder = 2;
      ghost.layers.enable(GHOST_DEPTH_LAYER);
      ghost.raycast = () => {};
      mesh.add(ghost);
      switches.push((id) => {
        const split = id ? variants.get(id) : undefined;
        mesh.geometry = split?.solid ?? original;
        ghost.visible = !!split;
        if (split) {
          // Palette attributes are installed by the parent after this layout effect.
          syncGeometryAttributes(split.solid, original);
          syncGeometryAttributes(split.ghost, original);
          ghost.geometry = split.ghost;
        }
      });
      restore.push(() => {
        mesh.remove(ghost);
        mesh.geometry = original;
        variants.forEach((split) => {
          disposeGeometryView(split.solid);
          disposeGeometryView(split.ghost);
        });
        material.dispose();
      });
    }
    activate.current = (id) => {
      switches.forEach((fn) => fn(id));
      invalidate();
    };
    return () => {
      activate.current = () => {};
      restore.forEach((fn) => fn());
    };
  }, [selections, night, opacity, invalidate]);
  useLayoutEffect(() => {
    activate.current(selected);
  }, [selected, selections, night, opacity]);
  return <group ref={root}>{children}</group>;
}

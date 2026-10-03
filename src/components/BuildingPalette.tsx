import { applyCameraClearance } from "../lib/camera-clearance";
import { applyEventSurfaceLighting } from "../lib/event-lighting";
import type { MapFeature } from "../types";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDING_COLOURS } from "../lib/palette";
import { type Footprint } from "../lib/attraction-boundary";

/** Recolour architecture only. The semantic vertex tags exclude site furniture. */
export function BuildingPalette({
  children,
  night,
  footprints,
  revision,
  buildings,
  focus,
}: {
  children: ReactNode;
  night: boolean;
  footprints: readonly Footprint[];
  revision: unknown;
  buildings: readonly MapFeature[];
  focus: [number, number] | null;
}) {
  const root = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const group = root.current!;
    group.updateWorldMatrix(true, true);
    const restore: (() => void)[] = [];
    group.traverse((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        object instanceof THREE.InstancedMesh ||
        Array.isArray(object.material)
      )
        return;
      const mesh = object;
      const geometry = mesh.geometry;
      let buildingOnly = false;
      let owner: Footprint | undefined;
      for (
        let parent: THREE.Object3D | null = mesh;
        parent && parent !== group;
        parent = parent.parent
      ) {
        buildingOnly ||= parent.userData.ghostBuilding === true;
        owner ??= parent.userData.ghostFootprint;
      }
      const tagged = geometry.getAttribute("building");
      const existing = geometry.getAttribute("buildingTone");
      if (!buildingOnly && !tagged && !existing) return;
      if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;
      if (!existing) {
        geometry.computeBoundingBox();
        const bounds = geometry
          .boundingBox!.clone()
          .applyMatrix4(mesh.matrixWorld)
          .expandByScalar(3);
        const nearby = footprints.filter(({ points }) => {
          const xs = points.map((p) => p[0]),
            zs = points.map((p) => p[1]);
          return (
            Math.max(...xs) >= bounds.min.x &&
            Math.min(...xs) <= bounds.max.x &&
            Math.max(...zs) >= bounds.min.z &&
            Math.min(...zs) <= bounds.max.z
          );
        });
        const position = geometry.getAttribute("position");
        const values = new Float32Array(position.count);
        // Each curated architectural batch keeps one tone across cornices,
        // columns and faces; do not draw a palette boundary through a facade.
        const lit = owner ? footprints.includes(owner) : nearby.length > 0;
        for (let i = 0; i < position.count; i++) {
          if (!buildingOnly && tagged?.getX(i) !== 1) continue;
          values[i] = lit ? 2 : 1;
        }
        geometry.setAttribute(
          "buildingTone",
          new THREE.BufferAttribute(values, 1),
        );
        restore.push(() => geometry.deleteAttribute("buildingTone"));
      }
      const original = mesh.material;
      const material = original.clone();
      const colours = BUILDING_COLOURS[night ? "night" : "day"];
      // Dark glazing and roof details use the darker of the same two tones.
      const detail = original.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.09;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.buildingNear = { value: new THREE.Color(colours.near) };
        shader.uniforms.buildingFar = { value: new THREE.Color(colours.far) };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute float buildingTone; varying float tone; varying vec3 buildingSurface;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\ntone = buildingTone; buildingSurface = (modelMatrix * vec4(transformed, 1.0)).xyz;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
            uniform vec3 buildingNear; uniform vec3 buildingFar;
            varying float tone; varying vec3 buildingSurface;
            float stoneHash(vec3 p) {
              p = fract(p * 0.1031);
              p += dot(p, p.yzx + 33.33);
              return fract((p.x + p.y) * p.z);
            }
            float stoneGrain(vec3 p) {
              vec3 cell = floor(p), t = fract(p);
              t = t * t * (3.0 - 2.0 * t);
              return mix(
                mix(mix(stoneHash(cell), stoneHash(cell + vec3(1,0,0)), t.x),
                    mix(stoneHash(cell + vec3(0,1,0)), stoneHash(cell + vec3(1,1,0)), t.x), t.y),
                mix(mix(stoneHash(cell + vec3(0,0,1)), stoneHash(cell + vec3(1,0,1)), t.x),
                    mix(stoneHash(cell + vec3(0,1,1)), stoneHash(cell + vec3(1,1,1)), t.x), t.y), t.z);
            }`,
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>\nif (tone > 0.5) diffuseColor.rgb = ${detail ? "buildingFar" : "mix(buildingFar, buildingNear, step(1.5, tone))"};`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
            ${
              detail
                ? ""
                : `if (tone > 1.5) {
              // Broad dielectric highlights with restrained stone variation.
              // World-space grain stays consistent across walls and roof faces.
              float grain = stoneGrain(buildingSurface * 1.8);
              float resolved = 1.0 - smoothstep(0.25, 1.0, length(fwidth(buildingSurface * 1.8)));
              roughnessFactor = 0.61 + (grain - 0.5) * 0.08 * resolved;
            }`
            }`,
          );
      };
      material.customProgramCacheKey = () => `building-palette-satin-${detail}`;
      material.emissive.set(0);
      mesh.material = material;
      restore.push(() => {
        mesh.material = original;
        material.dispose();
      });
    });
    if (night) restore.push(applyEventSurfaceLighting(group, buildings));
    restore.push(applyCameraClearance(group, focus));
    invalidate();
    return () => restore.reverse().forEach((fn) => fn());
  }, [night, footprints, revision, buildings, focus, invalidate]);
  return <group ref={root}>{children}</group>;
}

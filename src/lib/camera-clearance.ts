import { GHOST_DEPTH_LAYER } from "./scene-layers.ts";
import * as THREE from "three";

/** Smooth proximity cutaway, with opaque depth retained outside the transition. */
export function applyCameraClearance(
  root: THREE.Object3D,
  focus: [number, number] | null,
) {
  const focusUniform = {
    value: new THREE.Vector3(focus?.[0] ?? 0, focus ? 1 : 0, focus?.[1] ?? 0),
  };
  const restore: (() => void)[] = [];
  const meshes: THREE.Mesh[] = [];
  const transitions: {
    mesh: THREE.Mesh;
    source: THREE.Mesh;
    bounds: THREE.Box3;
  }[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  const materials = new Map<THREE.Material, THREE.Material>();
  for (const object of meshes) {
    const artwork = object.geometry.hasAttribute("cameraProtected");
    const facadeDetail = object.geometry.hasAttribute("facadeDetail");
    const originals = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const fading = originals.map((material) => {
      if (materials.has(material)) return materials.get(material)!;
      if (!(
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshBasicMaterial
      ))
        return material;
      const previous = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey;
      const key = cacheKey.call(material);
      const alreadyTransparent = material.transparent;
      const fade = alreadyTransparent ? material : material.clone();
      if (!alreadyTransparent) {
        fade.transparent = true;
        fade.depthWrite = false;
        fade.forceSinglePass = true;
      }
      const patch = (
        target: THREE.Material,
        pass: "solid" | "fade" | "transparent",
      ) => {
        target.onBeforeCompile = (shader, renderer) => {
          previous.call(material, shader, renderer);
          shader.uniforms.clearanceFocus = focusUniform;
          shader.vertexShader = shader.vertexShader
            .replace(
              "#include <common>",
              `#include <common>
              varying vec3 clearanceWorld;
              ${facadeDetail ? "attribute float facadeDetail; varying float clearanceFacadeDetail;" : ""}
              ${artwork ? "attribute float cameraProtected; varying float clearanceProtected;" : ""}`,
            )
            .replace(
              "#include <project_vertex>",
              `#include <project_vertex>
              vec4 clearancePosition = vec4(transformed, 1.0);
              #ifdef USE_INSTANCING
                clearancePosition = instanceMatrix * clearancePosition;
              #endif
              clearanceWorld = (modelMatrix * clearancePosition).xyz;
              ${facadeDetail ? "clearanceFacadeDetail = facadeDetail;" : ""}
              ${artwork ? "clearanceProtected = cameraProtected;" : ""}`,
            );
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              `#include <common>
              varying vec3 clearanceWorld; uniform vec3 clearanceFocus;
              ${facadeDetail ? "varying float clearanceFacadeDetail;" : ""}
              ${artwork ? "varying float clearanceProtected;" : ""}`,
            )
            .replace(
              "#include <clipping_planes_fragment>",
              `#include <clipping_planes_fragment>
              // Preserve the ground and the selected installation's setting.
              float raised = smoothstep(1.5, 3.0, clearanceWorld.y);
              ${facadeDetail ? "if (clearanceFacadeDetail > 0.5) raised = 1.0;" : ""}
              float protectedSite = clearanceFocus.y * (1.0 - smoothstep(11.0, 16.0, distance(clearanceWorld.xz, clearanceFocus.xz)));
              float proximity = smoothstep(18.0, 90.0, distance(cameraPosition, clearanceWorld));
              float visibility = mix(1.0, proximity, raised * (1.0 - protectedSite));
              ${artwork ? "if (clearanceProtected > 0.5) visibility = 1.0;" : ""}
              ${facadeDetail ? "if (clearanceFacadeDetail > 0.5 && visibility < 0.999) discard;" : ""}
              ${pass === "solid" ? "if (visibility < 0.999) discard;" : pass === "fade" ? "if (visibility >= 0.999 || visibility <= 0.001) discard;" : "if (visibility <= 0.001) discard;"}`,
            );
          if (pass !== "solid")
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <opaque_fragment>",
              "diffuseColor.a *= visibility;\n#include <opaque_fragment>",
            );
        };
        target.customProgramCacheKey = () =>
          `${key}-camera-clearance-v4-${artwork}-${facadeDetail}-${pass}`;
        target.needsUpdate = true;
      };
      patch(material, alreadyTransparent ? "transparent" : "solid");
      if (!alreadyTransparent) patch(fade, "fade");
      materials.set(material, fade);
      restore.push(() => {
        material.onBeforeCompile = previous;
        material.customProgramCacheKey = cacheKey;
        material.needsUpdate = true;
        if (fade !== material) fade.dispose();
      });
      return fade;
    });
    // Existing ghost surfaces already have a transparent pass. Opaque geometry
    // needs one separate transition pass, so fading faces cannot hide the art
    // by writing depth, and distant solid buildings still occlude correctly.
    if (fading.every((material, i) => material === originals[i])) continue;
    const material = Array.isArray(object.material) ? fading : fading[0];
    let overlay: THREE.Mesh;
    if (object instanceof THREE.InstancedMesh) {
      const instances = new THREE.InstancedMesh(
        object.geometry,
        material,
        object.count,
      );
      instances.instanceMatrix = object.instanceMatrix;
      instances.instanceColor = object.instanceColor;
      instances.boundingBox = object.boundingBox;
      instances.boundingSphere = object.boundingSphere;
      overlay = instances;
    } else overlay = new THREE.Mesh(object.geometry, material);
    overlay.receiveShadow = object.receiveShadow;
    overlay.renderOrder = 3;
    overlay.raycast = () => {};
    object.geometry.computeBoundingBox();
    const bounds =
      object instanceof THREE.InstancedMesh
        ? (object.computeBoundingBox(), object.boundingBox!.clone())
        : object.geometry.boundingBox!.clone();
    bounds.applyMatrix4(object.matrixWorld);
    overlay.userData.cameraClearanceOverlay = true;
    // The depth-only pass keeps fading trees/walls opaque to the close-up route.
    overlay.layers.enable(GHOST_DEPTH_LAYER);
    transitions.push({ mesh: overlay, source: object, bounds });
    object.add(overlay);
    restore.push(() => object.remove(overlay));
  }
  return Object.assign(() => restore.reverse().forEach((fn) => fn()), {
    setFocus(point: [number, number] | null) {
      focusUniform.value.set(point?.[0] ?? 0, point ? 1 : 0, point?.[1] ?? 0);
    },
    update(cameraPosition: THREE.Vector3) {
      // No extra fade draw calls for distant buildings or the overview.
      for (const { mesh, source, bounds } of transitions) {
        mesh.geometry = source.geometry;
        mesh.visible = bounds.distanceToPoint(cameraPosition) < 90;
      }
    },
  });
}

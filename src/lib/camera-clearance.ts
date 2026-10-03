import * as THREE from "three";

/** GPU proximity cutaway: works on merged city meshes and instanced furniture. */
export function applyCameraClearance(
  root: THREE.Object3D,
  focus: [number, number] | null,
) {
  const restore: (() => void)[] = [];
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const artwork = object.geometry.hasAttribute("cameraProtected");
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (
        seen.has(material) ||
        !(
          material instanceof THREE.MeshStandardMaterial ||
          material instanceof THREE.MeshBasicMaterial
        )
      )
        continue;
      seen.add(material);
      const previous = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey;
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms.clearanceFocus = {
          value: new THREE.Vector3(
            focus?.[0] ?? 0,
            focus ? 1 : 0,
            focus?.[1] ?? 0,
          ),
        };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>\nvarying vec3 clearanceWorld;
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
            ${artwork ? "clearanceProtected = cameraProtected;" : ""}`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>\nvarying vec3 clearanceWorld; uniform vec3 clearanceFocus;
            ${artwork ? "varying float clearanceProtected;" : ""}`,
          )
          .replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
            // Leave paving/water and the selected artwork's immediate setting intact.
            float raised = smoothstep(1.5, 3.0, clearanceWorld.y);
            float protectedSite = clearanceFocus.y * (1.0 - smoothstep(11.0, 16.0, distance(clearanceWorld.xz, clearanceFocus.xz)));
            float proximity = smoothstep(18.0, 90.0, distance(cameraPosition, clearanceWorld));
            float visibility = mix(1.0, proximity, raised * (1.0 - protectedSite));
            // Stable screen-door coverage avoids transparent sorting and additional passes.
            float coverage = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            ${artwork ? "// The attraction is never cut away, even when no artwork is selected.\n            if (clearanceProtected < 0.5 && visibility < 0.999 && coverage >= visibility) discard;" : "if (visibility < 0.999 && coverage >= visibility) discard;"}`,
          );
      };
      material.customProgramCacheKey = () =>
        `${cacheKey.call(material)}-camera-clearance-v2-${artwork}`;
      material.needsUpdate = true;
      restore.push(() => {
        material.onBeforeCompile = previous;
        material.customProgramCacheKey = cacheKey;
        material.needsUpdate = true;
      });
    }
  });
  return () => restore.reverse().forEach((fn) => fn());
}

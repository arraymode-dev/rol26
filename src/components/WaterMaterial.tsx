import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export const WATER_LEVEL = -2.2;
export const RIVER_LEVEL = -1.5;

// One palette and lighting model for the river, docks and recessed canal.
// Ripples alter the lighting, not vertex height: water never rises over quays.
export function WaterMaterial({
  night,
  moving = false,
  reducedMotion = false,
  moonlight = false,
}: {
  night: boolean;
  moving?: boolean;
  reducedMotion?: boolean;
  moonlight?: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const { material, time } = useMemo(() => {
    const time = { value: 0 };
    const material = new THREE.MeshStandardMaterial({
      color: night ? "#173847" : "#8ab7bf",
      roughness: 0.52,
      metalness: 0.12,
    });
    if (moving || moonlight) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.waterTime = time;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
            varying vec3 waterPosition;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            waterPosition = (modelMatrix * vec4(position, 1.0)).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          `#include <common>
            uniform float waterTime;
            varying vec3 waterPosition;`,
        );
        if (moving)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_begin>",
            `#include <normal_fragment_begin>
            vec2 p = waterPosition.xz;
            float a = dot(p, vec2(0.62, 0.28)) + 1.7 * sin(dot(p, vec2(0.047, -0.063))) + 0.65 * sin(p.y * 0.173) - waterTime * 0.65;
            float b = dot(p, vec2(-0.31, 0.87)) + 1.3 * sin(dot(p, vec2(0.081, 0.039))) - waterTime * 0.42;
            // Fade subpixel waves in distant views instead of letting them shimmer.
            float waveDetail = 1.0 - smoothstep(0.3, 1.4, max(fwidth(a), fwidth(b)));
            vec2 slope = (vec2(0.62, 0.28) * cos(a) + vec2(-0.31, 0.87) * cos(b) * 0.45);
            normal = normalize(normal + mat3(viewMatrix) * vec3(-slope.x, 0.0, -slope.y) * 0.12 * waveDetail);
            float crest = pow(0.5 + 0.5 * sin(a + sin(b) * 0.4), 12.0);
            diffuseColor.rgb *= 1.0 + (crest - 0.16) * 0.22 * waveDetail;`,
          );
      };
      const rippleCompile = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        rippleCompile.call(material, shader, renderer);
        if (moonlight)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            `// One distant moon direction for all water, evaluated on the ripple normal.
          vec3 moonDirection = normalize(mat3(viewMatrix) * normalize(vec3(-0.5, 0.8, -0.35)));
          vec3 moonHalf = normalize(moonDirection + geometryViewDir);
          float moonGlint = pow(max(dot(normal, moonHalf), 0.0), 55.0);
          float moonSheen = pow(max(dot(normal, moonHalf), 0.0), 9.0);
          outgoingLight += vec3(0.48, 0.64, 0.88) * (moonGlint * 0.32 + moonSheen * 0.045);
          #include <opaque_fragment>`,
          );
      };
      material.customProgramCacheKey = () =>
        `water-ripples-moon-v3-${moonlight}-${moving}`;
    }
    return { material, time };
  }, [night, moving, moonlight]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    time.value = 0;
    invalidate();
    if (!moving || reducedMotion) return;
    // Keep the demand renderer idle in hidden tabs; 30fps is ample for slow water.
    const timer = window.setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [moving, reducedMotion, time, invalidate]);
  useFrame((_, delta) => {
    if (moving && !reducedMotion && !document.hidden)
      time.value += Math.min(delta, 0.1);
  });
  return <primitive object={material} attach="material" />;
}

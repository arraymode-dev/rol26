import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  MOON_DIRECTION,
  MOON_DISTANCE,
  MOON_ANGULAR_RADIUS,
} from "../lib/moon";

function moonShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec2 moonUV;")
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nmoonUV = uv;",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
      varying vec2 moonUV;
      float moonHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float moonMottle(vec2 p) {
        vec2 cell = floor(p), t = fract(p);
        t = t * t * (3.0 - 2.0 * t);
        return mix(mix(moonHash(cell), moonHash(cell + vec2(1,0)), t.x),
                   mix(moonHash(cell + vec2(0,1)), moonHash(cell + vec2(1,1)), t.x), t.y);
      }
    `,
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 p = (moonUV - 0.5) * 8.0;
      // A full disc with restrained, stable surface variation; no image downloads.
      float radius = length(p);
      float edge = max(fwidth(radius), 0.002);
      float disc = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, radius);
      if (disc > 0.0) {
        float broad = moonMottle(p * 3.4 + vec2(3.1, 7.8));
        float fine = moonMottle(p * 13.0 + vec2(11.2, 1.7));
        float detail = 1.0 - smoothstep(0.3, 1.0, length(fwidth(p * 13.0)));
        float roundness = sqrt(max(0.0, 1.0 - dot(p, p)));
        float surface = 0.97 + (broad - 0.5) * 0.22 + (fine - 0.5) * 0.045 * detail;
        diffuseColor.rgb *= surface * mix(0.88, 1.0, roundness);
      }
      float halo = exp(-radius * radius * 1.35) * 0.045;
      halo *= 1.0 - smoothstep(2.4, 3.5, radius);
      // Soft atmospheric loss on the lower rim, without applying the city's distance fog.
      float haze = mix(0.68, 0.92, smoothstep(-1.1, 1.2, p.y));
      float surfaceAlpha = disc * haze;
      float alpha = surfaceAlpha + halo * (1.0 - surfaceAlpha);
      vec3 haloColour = vec3(0.60, 0.69, 0.76);
      diffuseColor.rgb = (diffuseColor.rgb * surfaceAlpha + haloColour * halo * (1.0 - surfaceAlpha)) / max(alpha, 0.0001);
      diffuseColor.a *= alpha;
      if (diffuseColor.a < 0.001) discard;
    `,
    );
}

/** One unlit quad, normal alpha blending, real scene-depth occlusion; no extra render loop. */
export const Moon = memo(function Moon({ night }: { night: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const direction = useMemo(() => new THREE.Vector3(...MOON_DIRECTION), []);
  const orientation = useMemo(() => {
    const matrix = new THREE.Matrix4().lookAt(
      new THREE.Vector3(),
      direction,
      new THREE.Vector3(0, 1, 0),
    );
    return new THREE.Quaternion().setFromRotationMatrix(matrix);
  }, [direction]);
  const size = Math.tan(MOON_ANGULAR_RADIUS) * MOON_DISTANCE * 8;
  useFrame(({ camera }) => {
    if (!mesh.current || !night) return;
    // Follow camera translation only. World orientation and angular size never follow its orbit or zoom.
    mesh.current.position
      .copy(camera.position)
      .addScaledVector(direction, MOON_DISTANCE);
  });
  return (
    <mesh
      ref={mesh}
      name="Mersey full moon"
      visible={night}
      quaternion={orientation}
      frustumCulled={false}
      renderOrder={-100}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        color="#fff0d1"
        transparent
        opacity={1}
        depthTest
        depthWrite={false}
        side={THREE.FrontSide}
        blending={THREE.NormalBlending}
        fog={false}
        toneMapped={false}
        onBeforeCompile={moonShader}
        customProgramCacheKey={() => "mersey-full-moon-v3"}
      />
    </mesh>
  );
});

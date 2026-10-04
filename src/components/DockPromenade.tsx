import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import paving from "../data/dock-promenade.json";
import { GROUND_COLOURS } from "../lib/palette";

export function docksideTreePosition(point: number[]) {
  return (
    paving.treeMoves.find(
      ({ from }) => from[0] === point[0] && from[1] === point[1],
    )?.to ?? point
  );
}

function cobbleShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec2 pavingPosition;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vec3 pavingWorld = (modelMatrix * vec4(position, 1.0)).xyz;
pavingPosition = mat2(0.9222, 0.3866, -0.3866, 0.9222) * pavingWorld.xz;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec2 pavingPosition;`,
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
// Staggered setts with derivative-filtered joints: no extra stone meshes or LOD swaps.
vec2 pavingCell = pavingPosition / vec2(0.4, 0.38);
pavingCell.x += mod(floor(pavingCell.y), 2.0) * 0.5;
vec2 pavingEdge = min(fract(pavingCell), 1.0 - fract(pavingCell));
vec2 pavingAA = max(fwidth(pavingPosition / vec2(0.4, 0.38)), vec2(0.001));
vec2 pavingBevel = smoothstep(vec2(0.035) - pavingAA, vec2(0.095) + pavingAA, pavingEdge);
float pavingResolved = 1.0 - smoothstep(0.25, 0.9, max(pavingAA.x, pavingAA.y));
float pavingTop = pavingBevel.x * pavingBevel.y;
float pavingHeight = pavingTop * 0.016 * pavingResolved;
diffuseColor.rgb *= mix(1.0, 0.88 + 0.12 * pavingTop, pavingResolved);
`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
// Shallow bevels catch existing scene lighting while keeping the floor's colour.
vec3 pavingDx = dFdx(-vViewPosition), pavingDy = dFdy(-vViewPosition);
vec3 pavingR1 = cross(pavingDy, normal), pavingR2 = cross(normal, pavingDx);
float pavingDet = dot(pavingDx, pavingR1);
vec3 pavingGradient = sign(pavingDet) * (dFdx(pavingHeight) * pavingR1 + dFdy(pavingHeight) * pavingR2);
normal = normalize(abs(pavingDet) * normal - pavingGradient);
`,
    );
}

export const DockPromenade = memo(function DockPromenade({
  night,
}: {
  night: boolean;
}) {
  const geometry = useMemo(() => {
    const pieces = paving.polygons.map(([outer, ...holes]) => {
      const shape = new THREE.Shape(
        outer.map(([x, z]) => new THREE.Vector2(x, -z)),
      );
      shape.holes = holes.map(
        (r) => new THREE.Path(r.map(([x, z]) => new THREE.Vector2(x, -z))),
      );
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0.515, 0);
      return g;
    });
    const merged = mergeGeometries(pieces)!;
    pieces.forEach((g) => g.dispose());
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={GROUND_COLOURS[night ? "night" : "day"]}
        roughness={0.93}
        onBeforeCompile={cobbleShader}
        customProgramCacheKey={() => "dock-cobbles-v1"}
      />
    </mesh>
  );
});

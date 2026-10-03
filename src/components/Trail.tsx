import { PRIMARY } from "../lib/palette";
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
type Point = [number, number];
interface RibbonPiece {
  polygons: Point[][][];
  corners: Point[];
  start: number;
  length: number;
}
export interface TrailData {
  segments: Point[][];
  ribbons: RibbonPiece[][];
}
// Interpolate distance across each joined strip section, never across distant parts of a loop.
function pieceUV(p: Point, piece: RibbonPiece) {
  const uvs = [
    [piece.start, 1],
    [piece.start + piece.length, 1],
    [piece.start + piece.length, -1],
    [piece.start, -1],
  ];
  for (const ids of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    const [a, b, c] = ids.map((i) => piece.corners[i]);
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-8) continue;
    const wa =
      ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / den;
    const wb =
      ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / den;
    const weights = [wa, wb, 1 - wa - wb];
    if (weights.every((w) => w >= -0.005))
      return [0, 1].map((j) =>
        ids.reduce((sum, id, i) => sum + uvs[id][j] * weights[i], 0),
      );
  }
  return [piece.start, 0];
}
export function Trail({
  data,
  reducedMotion,
  night,
}: {
  data: TrailData;
  reducedMotion: boolean;
  night: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    data.ribbons.flat().forEach((piece) =>
      piece.polygons.forEach(([outer, ...holes]) => {
        const shape = new THREE.Shape(
          outer.map(([x, z]) => new THREE.Vector2(x, -z)),
        );
        shape.holes = holes.map(
          (ring) =>
            new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))),
        );
        const g = new THREE.ShapeGeometry(shape),
          position = g.getAttribute("position"),
          uv = [];
        for (let i = 0; i < position.count; i++)
          uv.push(...pieceUV([position.getX(i), -position.getY(i)], piece));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.rotateX(-Math.PI / 2);
        g.translate(0, 1.4, 0);
        parts.push(g.index ? g.toNonIndexed() : g);
        if (g.index) g.dispose();
      }),
    );
    const merged = parts.length
      ? mergeGeometries(parts)
      : new THREE.BufferGeometry();
    parts.forEach((g) => g.dispose());
    return merged;
  }, [data]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          alpha: { value: 1 },
          base: { value: new THREE.Color(PRIMARY) },
          stripe: { value: new THREE.Color(night ? "#c8c3ff" : "#b6afff") },
        },
        vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 route;
      void main(){
        route=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
        fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform float alpha; uniform float time; uniform vec3 base; uniform vec3 stripe; varying vec2 route;
      void main(){
      #include <logdepthbuf_fragment>
      float phase=fract((route.x-time*3.5+route.y*1.2)/12.0);
      float zebra=smoothstep(0.60,0.63,phase)-smoothstep(0.92,0.95,phase);
      vec3 colour=mix(base,stripe,zebra);
      colour=mix(colour,vec3(0.84,0.94,0.95),smoothstep(0.87,0.99,abs(route.y)));
      gl_FragColor=vec4(colour,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [night],
  );
  // Draw a faint second pass only where scene depth hides the route.
  const hiddenMaterial = useMemo(() => {
    const hidden = material.clone();
    hidden.uniforms.time = material.uniforms.time;
    hidden.uniforms.alpha.value = 0.2;
    hidden.transparent = true;
    hidden.depthFunc = THREE.GreaterDepth;
    return hidden;
  }, [material]);
  useEffect(() => () => hiddenMaterial.dispose(), [hiddenMaterial]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.uniforms.time.value = 0;
    invalidate();
  }, [reducedMotion, material, invalidate]);
  useFrame((_, delta) => {
    if (!reducedMotion) {
      material.uniforms.time.value += Math.min(delta, 0.1);
      invalidate();
    }
  });
  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={3} />
      <mesh
        geometry={geometry}
        material={hiddenMaterial}
        renderOrder={4}
        raycast={() => {}}
      />
    </group>
  );
}

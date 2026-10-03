import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/georges-dock.json";
export const GEORGES_DOCK = { x: -146, z: -101, rotation: 0.49, level: 1.45 };
const c = Math.cos(0.49),
  s = Math.sin(0.49);
const local = ([x, z]: number[]) => [
  c * (x + 146) - s * (z + 101),
  s * (x + 146) + c * (z + 101),
];
function build() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const add = (g: THREE.BufferGeometry, p: number[], m: string, a = 0) => {
    g.rotateY(a);
    g.translate(p[0], p[1], p[2]);
    markBuildingGeometry(g, buildingGeometry);
    (parts[m] ??= []).push(g);
  };
  const box = (p: number[], size: [number, number, number], m: string, a = 0) =>
    add(new THREE.BoxGeometry(...size), p, m, a);
  const cyl = (
    p: number[],
    rt: number,
    rb: number,
    h: number,
    m: string,
    n = 32,
  ) => add(new THREE.CylinderGeometry(rt, rb, h, n), p, m);
  const line = (
    a: number[],
    b: number[],
    w: number,
    h: number,
    y: number,
    m: string,
  ) =>
    box(
      [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
      [Math.hypot(b[0] - a[0], b[1] - a[1]), h, w],
      m,
      -Math.atan2(b[1] - a[1], b[0] - a[0]),
    );
  const poly = (
    ps: number[][],
    y: number,
    h: number,
    m: string,
    hole?: number[][],
  ) => {
    const shape = new THREE.Shape(
      ps.map((p) => {
        const [x, z] = local(p);
        return new THREE.Vector2(x, -z);
      }),
    );
    if (hole)
      shape.holes.push(
        new THREE.Path(
          hole.map((p) => {
            const [x, z] = local(p);
            return new THREE.Vector2(x, -z);
          }),
        ),
      );
    const g = h
      ? new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      : new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    add(g, [0, y, 0], m);
  };
  // A raised forecourt bounded by the saved map walls; the height is a photo-based estimate.
  poly(site.platform, 0.45, 1, "stone");
  poly(site.platform, 1.465, 0, "paving");
  box([-1, 1.49, -0.3], [16, 0.035, 15], "sand");
  // Joint lines stay inside the trapezoidal platform.
  for (let z = -10; z < 10; z += 1.1)
    line(
      [-13.2, z],
      [10.3 + (z + 11) * 0.16, z],
      0.025,
      0.014,
      1.516,
      "detail-joint",
    );
  for (let x = -13; x < 11; x += 1.15)
    line([x, -10.7], [x, 9.7], 0.024, 0.014, 1.516, "detail-joint");
  // Existing circular cover, including the stone base, rim, bolts and radial panel seams.
  cyl([-1, 1.73, -0.3], 4.75, 4.75, 0.46, "sand", 64);
  cyl([-1, 2.03, -0.3], 4.86, 4.86, 0.2, "green", 64);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    line(
      [-1, -0.3],
      [-1 + 4.7 * Math.cos(a), -0.3 + 4.7 * Math.sin(a)],
      0.022,
      0.014,
      2.139,
      "detail-darkgreen",
    );
  }
  cyl([-1, 2.15, -0.3], 0.3, 0.3, 0.035, "green");
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI) / 24;
    cyl(
      [-1 + 4.75 * Math.cos(a), 2.19, -0.3 + 4.75 * Math.sin(a)],
      0.055,
      0.055,
      0.12,
      "detail-green",
      6,
    );
  }
  // Two stone structures frame the northern entrance; exact dimensions remain illustrative.
  for (const x of [-9.7, 7.5]) {
    box([x, 3.7, -7.8], [5.1, 4.4, 4.4], "stone");
    for (const [y, w] of [
      [1.65, 0.25],
      [2.15, 0.12],
      [5.5, 0.15],
      [5.8, 0.3],
      [6, 0.4],
    ])
      box([x, y, -7.8], [5.1 + w, 0.13, 4.4 + w], y === 6 ? "cap" : "trim");
    for (let y = 2.4; y < 5.5; y += 0.57) {
      box([x, y, -10.02], [5.1, 0.023, 0.02], "detail-joint");
      box([x - 2.56, y, -7.8], [0.02, 0.023, 4.4], "detail-joint");
      box([x + 2.56, y, -7.8], [0.02, 0.023, 4.4], "detail-joint");
    }
  }
  const rail = (a: number[], b: number[]) => {
    line(a, b, 0.42, 0.25, 1.53, "trim");
    line(a, b, 0.055, 0.065, 1.98, "detail-green");
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(len / 1.8);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      box([x, 1.78, z], [0.09, 0.45, 0.09], "detail-green");
      box([x, 1.57, z], [0.18, 0.055, 0.18], "detail-green");
    }
  };
  // Perimeter rail gaps align with three distinct stair approaches, not a continuous enclosure.
  rail([-13.4, -11], [-4, -11]);
  rail([2, -11], [10.3, -11]);
  rail([-13.7, -11], [-13.7, -3]);
  rail([-13.7, 3], [-13.7, 9.8]);
  rail([10.4, -11], [11.7, -3]);
  rail([12.6, 3], [13.6, 9.8]);
  const stairs = (x: number, z: number, a: number, w: number) => {
    for (let i = 0; i < 5; i++) {
      const d = (i + 0.5) * 0.34;
      box(
        [x + Math.sin(a) * d, 0.45 + ((i + 1) * 0.2) / 2, z + Math.cos(a) * d],
        [w, (i + 1) * 0.2, 0.35],
        "trim",
        a,
      );
    }
  };
  stairs(-1, -12.7, 0, 6);
  stairs(-15.4, 0, Math.PI / 2, 6);
  stairs(14.2, 0, -Math.PI / 2, 6);
  const lamp = (x: number, z: number) => {
    box([x, 1.23, z], [1.55, 1.55, 1.55], "stone");
    box([x, 2.03, z], [1.7, 0.16, 1.7], "trim");
    box([x, 2.22, z], [0.8, 0.2, 0.8], "green");
    add(
      new THREE.CylinderGeometry(0.21, 0.42, 0.45, 4),
      [x, 2.52, z],
      "green",
      Math.PI / 4,
    );
    box([x, 4.15, z], [0.32, 2.95, 0.32], "green");
    for (const dx of [-0.172, 0.172])
      box([x + dx, 4.15, z], [0.024, 2.8, 0.09], "detail-gold");
    for (const dz of [-0.172, 0.172])
      box([x, 4.15, z + dz], [0.09, 2.8, 0.024], "detail-gold");
    cyl([x, 6.12, z], 0.35, 0.35, 1.22, "detail-lamp", 12);
    for (const y of [5.48, 6.78]) cyl([x, y, z], 0.41, 0.41, 0.12, "green", 12);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      box(
        [x + 0.34 * Math.cos(a), 6.12, z + 0.34 * Math.sin(a)],
        [0.055, 1.35, 0.055],
        "detail-gold",
      );
    }
    for (let j = 0; j < 5; j++)
      box([x, 6.9 + j * 0.09, z], [0.35, 0.045, 0.35], "detail-green");
    const loop = new THREE.TorusGeometry(0.12, 0.018, 5, 12, Math.PI);
    add(loop, [x, 7.55, z], "detail-gold");
    for (const dx of [-0.12, 0.12])
      box([x + dx, 7.43, z], [0.028, 0.24, 0.028], "detail-gold");
  };
  for (const [x, z] of [
    [-4, -10.9],
    [2, -10.9],
    [-13.7, -3],
    [-13.7, 3],
    [11.7, -3],
    [12.6, 3],
  ])
    lamp(x, z);
  buildingGeometry = true;
  // North face of the adjoining Art Deco ventilation building, preserving its courtyard void.
  poly(site.building.points, 0.45, 19, "building", site.building.hole);
  box([0, 21, 13.9], [14.5, 4, 7.6], "building");
  box([0, 37, 31], [13.5, 35, 15], "building");
  for (const y of [5, 18.9, 22.8, 54.6])
    box([0, y, y > 23 ? 23.4 : 9.67], [y > 23 ? 14 : 28, 0.24, 0.4], "trim");
  for (let i = 0; i < 7; i++) {
    const x = -10.8 + i * 3.6;
    for (const y of [3.4, 8.2, 13.2, 17]) {
      box([x, y, 9.7], [1.55, y === 3.4 ? 2.5 : 3, 0.14], "glass");
      box([x, y, 9.59], [0.06, y === 3.4 ? 2.5 : 3, 0.1], "detail-trim");
      box([x, y, 9.59], [1.55, 0.06, 0.1], "detail-trim");
      box([x, y - 1.58, 9.53], [1.9, 0.16, 0.3], "trim");
    }
  }
  for (let x = -5.1; x < 6; x += 1.7) {
    box([x, 39, 23.43], [0.7, 25, 0.08], "detail-joint");
    box([x, 39, 23.31], [0.2, 28, 0.28], "trim");
  }
  // Cunard south elevation supplies the photographic backdrop without changing its footprint.
  const ca = local([-248, -87.4]),
    cb = local([-165.1, -128.9]);
  const dx = cb[0] - ca[0],
    dz = cb[1] - ca[1],
    len = Math.hypot(dx, dz),
    angle = -Math.atan2(dz, dx);
  for (let i = 0; i < 23; i++)
    for (let row = 0; row < 5; row++) {
      const t = (i + 0.5) / 23,
        x = ca[0] + dx * t - (dz / len) * 0.13,
        z = ca[1] + dz * t + (dx / len) * 0.13,
        y = 5 + row * 5.8;
      box([x, y, z], [2, 3.3, 0.1], "glass", angle);
      box([x, y, z + 0.06], [0.07, 3.3, 0.12], "detail-trim", angle);
    }
  return Object.fromEntries(
    Object.entries(parts).map(([m, gs]) => {
      const ns = gs.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute("uv");
        return n;
      });
      const g = mergeGeometries(ns)!;
      new Set([...gs, ...ns]).forEach((g) => g.dispose());
      return [m, g];
    }),
  );
}
export const GeorgesDock = memo(function GeorgesDock({
  night,
}: {
  night: boolean;
}) {
  const parts = useMemo(build, []);
  useEffect(
    () => () => Object.values(parts).forEach((g) => g.dispose()),
    [parts],
  );
  const colors: Record<string, string> = {
    stone: "#aaa99c",
    trim: "#cfcbba",
    cap: "#696f66",
    paving: "#8eaaa3",
    sand: "#b3ad8c",
    joint: "#777d72",
    green: "#00866e",
    darkgreen: "#367c64",
    gold: "#b39a62",
    lamp: "#c8d6cc",
    building: "#c9c5b4",
    glass: "#667f81",
  };
  const mesh = (m: string, g: THREE.BufferGeometry) => (
    <mesh key={m} geometry={g} castShadow receiveShadow>
      <meshStandardMaterial
        color={colors[m.replace("detail-", "")]}
        side={THREE.DoubleSide}
        roughness={0.85}
        flatShading
        emissive={m === "detail-lamp" ? "#fff0c9" : "#000000"}
        emissiveIntensity={night ? 0.6 : 0}
      />
    </mesh>
  );
  return (
    <group
      position={[GEORGES_DOCK.x, 0, GEORGES_DOCK.z]}
      rotation={[0, 0.49, 0]}
    >
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => mesh(m, g))}
      <Detailed distances={[0, 330]} hysteresis={0.12}>
        <group>
          {Object.entries(parts)
            .filter(([m]) => m.startsWith("detail-"))
            .map(([m, g]) => mesh(m, g))}
        </group>
        <group />
      </Detailed>
    </group>
  );
});

import { GRASS_COLOUR } from "../lib/palette";
import { markBuildingGeometry } from "../lib/ghost-geometry";
import { WaterMaterial } from "./WaterMaterial";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/pier-head.json";
export const PIER_HEAD = { x: -341, z: -143 };
export const PIER_CANAL = site.canal;
export const PIER_CUTOUT = [
  [-359, -192.2],
  [-333.6, -129.8],
  [-319.4, -136.3],
  [-344.8, -199.9],
];
const treeKeys = new Set(site.trees.map((p) => p.join(",")));
export const isPierTree = (p: number[]) => treeKeys.has(p.join(","));
function build() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const add = (g: THREE.BufferGeometry, p: number[], m: string, a = 0) => {
    g.rotateY(a);
    g.translate(p[0] - PIER_HEAD.x, p[1], p[2] - PIER_HEAD.z);
    markBuildingGeometry(g, buildingGeometry);
    (parts[m] ??= []).push(g);
  };
  const box = (p: number[], s: [number, number, number], m: string, a = 0) =>
    add(new THREE.BoxGeometry(...s), p, m, a);
  const beam = (a: number[], b: number[], r: number, m: string) => {
    const from = new THREE.Vector3(...(a as [number, number, number])),
      to = new THREE.Vector3(...(b as [number, number, number])),
      d = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(r, r, d.length(), 6);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    add(g, from.add(to).multiplyScalar(0.5).toArray(), m);
  };
  const poly = (ps: number[][], y: number, h: number, m: string) => {
    const shape = new THREE.Shape(
      ps.map((p) => new THREE.Vector2(p[0], -p[1])),
    );
    const g = h
      ? new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      : new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    add(g, [0, y, 0], m);
  };
  const quad = (v: number[][], m: string) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [v[0], v[1], v[2], v[0], v[2], v[3]].flat(),
        3,
      ),
    );
    g.computeVertexNormals();
    add(g, [0, 0, 0], m);
  };
  const line = (
    a: number[],
    b: number[],
    w: number,
    h: number,
    y: number,
    m: string,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    box(
      [(a[0] + b[0]) / 2, y + h / 2, (a[1] + b[1]) / 2],
      [Math.hypot(dx, dz), h, w],
      m,
      -Math.atan2(dz, dx),
    );
  };
  const orb = (p: number[], s: [number, number, number], m: string) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(...s);
    add(g, p, m);
  };
  // Map-aligned lawn and low shaped stone edges.
  poly(site.lawn.points, 0.42, 0.35, "grass");
  // Omit the two isolated promenade wall fragments; retain the lawn/canal edges.
  for (const wall of site.walls.filter(
    (wall) => !["1149736512", "1149736513"].includes(wall.id),
  ))
    for (let i = 1; i < wall.points.length; i++) {
      const a = wall.points[i - 1],
        b = wall.points[i];
      line(a, b, 0.7, 0.65, 0.45, "stone");
      line(a, b, 0.85, 0.12, 1.1, "coping");
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.7);
      for (let j = 1; j < n; j++) {
        const t = j / n;
        box(
          [a[0] + (b[0] - a[0]) * t, 1.16, a[1] + (b[1] - a[1]) * t],
          [0.022, 0.018, 0.87],
          "detail-joint",
          -Math.atan2(b[1] - a[1], b[0] - a[0]),
        );
      }
    }
  // Open canal is recessed below the promenade, with visible stone side walls.
  poly(site.canal.points, -2.05, 0, "water");
  const edges = [
    [
      [-349.2, -196.2],
      [-323.9, -133.8],
    ],
    [
      [-359, -192.2],
      [-333.6, -129.8],
    ],
  ];
  for (const [a, b] of edges) {
    line(a, b, 0.5, 2.5, -2, "stone");
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      n = Math.ceil(Math.hypot(dx, dz) / 2.4);
    for (let j = 0; j <= n; j++) {
      const t = j / n,
        x = a[0] + dx * t,
        z = a[1] + dz * t;
      beam([x, 0.48, z], [x, 1.65, z], 0.085, "detail-steel");
      box([x, 0.55, z], [0.3, 0.08, 0.3], "detail-steel");
    }
    for (const h of [0.75, 1.05, 1.35, 1.65])
      beam([a[0], h, a[1]], [b[0], h, b[1]], 0.04, "detail-steel");
  }
  // Canal-side walk rises toward the southern plaza; the bench wall retains its inland edge.
  quad(
    [
      [-349.2, -0.8, -196.2],
      [-344.8, -0.8, -199.9],
      [-319.4, 0.48, -136.3],
      [-323.9, 0.48, -133.8],
    ],
    "paving",
  );
  line([-344.8, -199.9], [-319.4, -136.3], 0.7, 1.5, -1, "stone");
  // A dark headwall opening under each existing canal crossing.
  for (const [a, b] of [
    [
      [-349.2, -196.2],
      [-359, -192.2],
    ],
    [
      [-323.9, -133.8],
      [-333.6, -129.8],
    ],
  ]) {
    quad(
      [
        [a[0], -2, a[1]],
        [b[0], -2, b[1]],
        [b[0], 0.15, b[1]],
        [a[0], 0.15, a[1]],
      ],
      "tunnel",
    );
    line(a, b, 1, 0.45, 0.2, "coping");
  }
  buildingGeometry = true;
  // Terminal: footprint-anchored upper volume over a recessed glazed entrance.
  const base = site.terminal.points.filter((_, i) => i !== 1).slice(0, -1);
  const cx = base.reduce((s, p) => s + p[0] / base.length, 0),
    cz = base.reduce((s, p) => s + p[1] / base.length, 0);
  const low = base.map(([x, z]) => [
    cx + (x - cx) * 0.82,
    cz + (z - cz) * 0.82,
  ]);
  poly(low, 0.48, 4.2, "glass");
  for (let i = 0; i < base.length; i++) {
    const a = base[i],
      b = base[(i + 1) % base.length],
      la = low[i],
      lb = low[(i + 1) % base.length];
    quad(
      [
        [la[0], 4.7, la[1]],
        [lb[0], 4.7, lb[1]],
        [b[0], 13.7, b[1]],
        [a[0], 13.7, a[1]],
      ],
      "terminal",
    );
    // Dark window bands sit on the sloping skin, with stone margins.
    const panel = (t: number, v: number) => {
      const x = la[0] + (lb[0] - la[0]) * t,
        z = la[1] + (lb[1] - la[1]) * t,
        tx = a[0] + (b[0] - a[0]) * t,
        tz = a[1] + (b[1] - a[1]) * t;
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      return [
        x + (tx - x) * v - (dz / len) * 0.07,
        4.7 + 9 * v,
        z + (tz - z) * v + (dx / len) * 0.07,
      ];
    };
    const spans =
      i === 3
        ? [
            [0.12, 0.38, 0.08, 0.84],
            [0.55, 0.88, 0.08, 0.84],
          ]
        : [[0.12, 0.88, 0.3, 0.79]];
    for (const [left, right, bottom, top] of spans) {
      quad(
        [
          panel(left, bottom),
          panel(right, bottom),
          panel(right, top),
          panel(left, top),
        ],
        "glass",
      );
      for (let t = left + 0.07; t < right; t += 0.085)
        beam(panel(t, bottom), panel(t, top), 0.055, "detail-frame");
      beam(panel(left, 0.52), panel(right, 0.52), 0.065, "detail-frame");
    }
  }
  poly(base, 13.72, 0.18, "roof");
  // Deep entrance canopy and slim structural piers on the landward elevation.
  const angle = 0.4;
  const tp = (x: number, y: number, z: number) => [
    cx + Math.cos(angle) * x + Math.sin(angle) * z,
    y,
    cz - Math.sin(angle) * x + Math.cos(angle) * z,
  ];
  for (const z of [-13, 0, 13])
    box(tp(11.8, 2.6, z), [0.6, 4.2, 0.6], "terminal", angle);
  box(tp(10, 4.6, 0), [5, 0.45, 28], "roof", angle);
  for (const z of [-7, -2, 3, 8])
    box(tp(12.1, 2.1, z), [0.09, 3, 3.7], "glass", angle);
  // Roof terrace parapet follows the upper outline.
  for (let i = 0; i < base.length; i++)
    line(base[i], base[(i + 1) % base.length], 0.12, 0.6, 13.9, "detail-steel");
  buildingGeometry = false;
  // Edward VII monument: map node anchors a simplified stepped plinth and horse/rider.
  const [mx, mz] = site.monument.point;
  for (const [y, w, h, d] of [
    [0.45, 9, 0.35, 6],
    [0.8, 8, 0.4, 5],
    [1.2, 6.5, 1.1, 4.1],
    [2.3, 5.8, 3.7, 3.6],
    [6, 6.4, 0.4, 4],
    [6.4, 5.9, 0.4, 3.7],
  ])
    box([mx, y + h / 2, mz], [w, h, d], "stone", angle);
  const hp = (x: number, y: number, z: number) => [
    mx + Math.cos(angle) * x + Math.sin(angle) * z,
    y,
    mz - Math.sin(angle) * x + Math.cos(angle) * z,
  ];
  const hb = (a: number[], b: number[], r: number) =>
    beam(
      hp(...(a as [number, number, number])),
      hp(...(b as [number, number, number])),
      r,
      "bronze",
    );
  const ho = (p: number[], s: [number, number, number]) =>
    orb(hp(...(p as [number, number, number])), s, "bronze");
  ho([0, 9.1, 0], [1.85, 0.8, 0.62]);
  ho([1.25, 9.65, 0], [0.55, 1.05, 0.48]);
  hb([1, 9.4, 0], [1.8, 10.6, 0], 0.38);
  ho([2.02, 10.55, 0], [0.65, 0.4, 0.35]);
  ho([2.38, 10.28, 0], [0.38, 0.32, 0.29]);
  for (const z of [-0.43, 0.43]) {
    hb([-1.15, 9, z], [-1.48, 7.9, z], 0.16);
    hb([-1.48, 7.9, z], [-1.62, 6.85, z], 0.12);
    hb([1.12, 9, z], [0.98, 7.7, z], 0.14);
    hb([0.98, 7.7, z], [1.22, 6.85, z], 0.1);
    box(hp(-1.57, 6.84, z), [0.35, 0.17, 0.25], "bronze", angle);
    box(hp(1.3, 6.84, z), [0.35, 0.17, 0.25], "bronze", angle);
  }
  hb([-1.65, 9.2, 0], [-2.2, 8.8, 0.1], 0.14);
  hb([-2.2, 8.8, 0.1], [-1.85, 8.35, 0.2], 0.11);
  for (const z of [-0.22, 0.22]) hb([1.85, 10.8, z], [1.94, 11.25, z], 0.095);
  ho([-0.25, 10.25, 0], [0.45, 0.8, 0.35]);
  ho([-0.17, 11.25, 0], [0.3, 0.35, 0.29]);
  ho([-0.2, 11.58, 0], [0.43, 0.15, 0.34]);
  hb([-0.4, 11.65, 0], [-0.6, 12.05, 0], 0.14);
  for (const z of [-0.48, 0.48]) {
    hb([-0.2, 10, z], [0.3, 9.3, z], 0.17);
    hb([0.3, 9.3, z], [0.25, 8.55, z], 0.12);
    hb([0.04, 10.6, z * 0.6], [0.6, 10, z * 0.65], 0.12);
    hb([0.6, 10, z * 0.65], [1.3, 10.1, z * 0.5], 0.08);
  }
  // Broadleaf avenue retains mapped trunk positions.
  for (const [i, [x, z]] of site.trees.entries()) {
    beam([x, 0.5, z], [x, 4.5, z], 0.16, "bark");
    for (let j = 0; j < 3; j++) {
      const a = j * 2.1 + i * 0.7;
      orb(
        [x + Math.cos(a) * 1.25, 5.6 + j * 0.35, z + Math.sin(a) * 1.25],
        [2.1, 2.6, 2],
        j % 2 ? "leaf-light" : "leaves",
      );
    }
  }
  // Photo-informed tapered lanterns and cylindrical bins.
  for (const [x, z] of [
    [-343, -211],
    [-367, -174],
    [-374, -130],
    [-348, -112],
    [-333, -111],
    [-337, -39],
    [-312, -125],
    [-301, -46],
  ]) {
    beam([x, 0.5, z], [x, 5.6, z], 0.12, "detail-steel");
    add(
      new THREE.CylinderGeometry(0.48, 0.12, 0.85, 8),
      [x, 6, z],
      "detail-lamp",
    );
    add(
      new THREE.CylinderGeometry(0.51, 0.51, 0.08, 12),
      [x, 6.48, z],
      "detail-frame",
    );
    for (let j = 0; j < 3; j++) {
      const a = (j * Math.PI * 2) / 3;
      beam(
        [x, 5.6, z],
        [x + Math.cos(a) * 0.46, 6.42, z + Math.sin(a) * 0.46],
        0.024,
        "detail-steel",
      );
    }
  }
  for (const [x, z] of [
    [-342, -188],
    [-321, -136],
    [-328, -106],
    [-310, -55],
  ]) {
    add(
      new THREE.CylinderGeometry(0.32, 0.32, 0.95, 12),
      [x, 0.98, z],
      "detail-steel",
    );
    box([x, 1.22, z + 0.31], [0.32, 0.19, 0.035], "detail-frame");
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
export const PierHead = memo(function PierHead({ night }: { night: boolean }) {
  const parts = useMemo(build, []);
  useEffect(
    () => () => Object.values(parts).forEach((g) => g.dispose()),
    [parts],
  );
  const colors: Record<string, string> = {
    grass: GRASS_COLOUR,
    paving: "#a9b1a9",
    stone: "#b9b39e",
    coping: "#d7c9ae",
    terminal: "#d7d2bd",
    glass: "#3f6669",
    roof: "#666c67",
    tunnel: "#19292b",
    steel: "#acb9b5",
    frame: "#344748",
    bronze: "#384a40",
    bark: "#777260",
    leaves: "#657d4e",
    "leaf-light": "#81915f",
    lamp: "#cbdcd4",
    joint: "#898779",
  };
  const mesh = (m: string, g: THREE.BufferGeometry) => (
    <mesh key={m} geometry={g} castShadow={m !== "water"} receiveShadow>
      {m === "water" ? (
        <WaterMaterial night={night} />
      ) : (
        <meshStandardMaterial
          color={colors[m.replace("detail-", "")]}
          roughness={m === "glass" ? 0.35 : 0.92}
          side={THREE.DoubleSide}
          flatShading
          emissive={m === "detail-lamp" ? "#ffe4ae" : "#000000"}
          emissiveIntensity={night ? 0.75 : 0}
        />
      )}
    </mesh>
  );
  return (
    <group position={[PIER_HEAD.x, 0, PIER_HEAD.z]}>
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => mesh(m, g))}
      <Detailed distances={[0, 320]} hysteresis={0.12}>
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

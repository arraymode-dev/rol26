import { PATH_COLOURS } from "../lib/palette";
import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/pump-house.json";

export const PUMP_BUILDINGS = [
  site.building.id,
  site.chimney.id,
  site.carousel.id,
];
export const isPumpTree = ([x, z]: number[]) =>
  site.trees.some(([a, b]) => Math.hypot(x - a, z - b) < 1);
const origin = [10, 245];
function build() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const add = (g: THREE.BufferGeometry, p: number[], m: string, a = 0) => {
    g.rotateY(a);
    g.translate(p[0] - origin[0], p[1], p[2] - origin[1]);
    markBuildingGeometry(g, buildingGeometry);
    (parts[m] ??= []).push(g);
  };
  const box = (p: number[], s: [number, number, number], m: string, a = 0) =>
    add(new THREE.BoxGeometry(...s), p, m, a);
  const cyl = (
    p: number[],
    rt: number,
    rb: number,
    h: number,
    m: string,
    n = 12,
  ) => add(new THREE.CylinderGeometry(rt, rb, h, n), p, m);
  const beam = (a: number[], b: number[], r: number, m: string) => {
    const av = new THREE.Vector3(a[0], a[1], a[2]),
      bv = new THREE.Vector3(b[0], b[1], b[2]),
      delta = bv.clone().sub(av);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), 5);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    add(g, av.add(bv).multiplyScalar(0.5).toArray(), m);
  };
  const poly = (ps: number[][], y: number, h: number, m: string) => {
    const g = new THREE.ExtrudeGeometry(
      new THREE.Shape(ps.map(([x, z]) => new THREE.Vector2(x, -z))),
      { depth: h, bevelEnabled: false },
    );
    g.rotateX(-Math.PI / 2);
    add(g, [0, y, 0], m);
  };
  buildingGeometry = true;
  // Saved footprint; elevations, roof proportions and furniture are photo estimates.
  poly(site.building.points, 0.5, 6.8, "brick");
  const angle = 0.384,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const local = (u: number, y: number, v: number) => [
    -2 + c * u + s * v,
    y,
    241.7 - s * u + c * v,
  ];
  const b = (
    u: number,
    y: number,
    v: number,
    size: [number, number, number],
    m: string,
  ) => box(local(u, y, v), size, m, angle);
  const roof = (
    length: number,
    width: number,
    rise: number,
    base: number,
    center: number[],
    a: number,
  ) => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: false,
    });
    g.translate(0, base, -length / 2);
    g.rotateY(Math.PI / 2);
    add(g, center, "slate", a);
  };
  roof(24, 12.5, 4.2, 7.3, [-2, 0, 241.7], angle);
  b(0, 10.9, 0, [9, 0.9, 1.7], "iron");
  for (let i = -4; i <= 4; i++)
    b(i, 10.9, 0.9, [0.16, 0.65, 0.08], "detail-slate");
  // Square tower and its horizontal courses and narrow ventilation slots.
  b(-8, 9.4, 4, [6.3, 17.8, 6.3], "brick");
  b(-8, 18.5, 4, [6.6, 0.45, 6.6], "slate");
  for (const y of [12, 13.2, 15.9, 17.4])
    b(-8, y, 4, [6.38, 0.22, 6.38], "detail-darkBrick");
  for (const u of [-9.7, -8, -6.3])
    b(u, 10.7, 7.18, [0.3, 5, 0.08], "detail-iron");
  // Side windows, lintels and timber-gabled porch on the quay-facing wall.
  for (const u of [-2, 2.5, 7, 10]) {
    b(u, 3.9, 6.12, [1.4, 2.8, 0.14], "glass");
    b(u, 5.4, 6.2, [1.7, 0.25, 0.25], "detail-darkBrick");
    b(u, 3.9, 6.23, [0.09, 2.8, 0.07], "detail-iron");
    b(u, 3.9, 6.23, [1.4, 0.1, 0.07], "detail-iron");
  }
  b(3, 2.5, 6.2, [1.5, 3.8, 0.15], "iron");
  roof(3.1, 3.8, 1.8, 4.5, local(3, 0, 7.5), angle + Math.PI / 2);
  for (const u of [1.25, 4.75])
    beam(local(u, 0.6, 8.7), local(u, 4.7, 8.7), 0.12, "detail-iron");
  for (let i = 0; i < 3; i++)
    b(3, 0.6 + i * 0.16, 9.2 - i * 0.35, [3.7, 0.18, 0.55], "stone");
  // Gable end arch: dark semicircular glazing above rectangular lower lights.
  const arch = new THREE.Shape();
  arch.moveTo(-2, 0);
  arch.lineTo(2, 0);
  arch.lineTo(2, 2);
  arch.absarc(0, 2, 2, 0, Math.PI, false);
  arch.lineTo(-2, 0);
  const ag = new THREE.ShapeGeometry(arch);
  ag.rotateY(Math.PI / 2);
  add(ag, local(12.05, 0.7, 0), "glass", angle);
  for (const v of [-3.5, 0, 3.5])
    b(12.1, 6.3, v, [0.15, 2.5, v === 0 ? 1.5 : 0.7], "glass");
  for (const v of [-1, 0, 1])
    beam(local(12.17, 0.8, v), local(12.17, 3.5, v), 0.055, "detail-iron");
  // Mapped 42 m chimney height is an OSM estimate, not a field measurement.
  const [cx, cz] = site.chimney.center,
    h = site.chimney.height;
  cyl([cx, h / 2 + 0.5, cz], 1.08, 1.72, h, "brick", 20);
  for (const y of [10, 21, 31, 39])
    cyl(
      [cx, y, cz],
      1.76 - y * 0.015,
      1.76 - y * 0.015,
      0.19,
      "detail-iron",
      20,
    );
  cyl([cx, 39.4, cz], 1.75, 1.28, 1.8, "brick", 12);
  cyl([cx, 40.5, cz], 1.28, 1.75, 0.45, "darkBrick", 12);
  cyl([cx, 42.55, cz], 1.12, 1.12, 0.25, "slate", 20);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(
      [cx + 1.56 * Math.cos(a), 39.5, cz + 1.56 * Math.sin(a)],
      [0.35, 1, 0.12],
      "detail-iron",
      Math.PI / 2 - a,
    );
  }
  buildingGeometry = false;
  // Broadleaf canopies replace the four mapped generic trees.
  site.trees.forEach(([x, z], i) => {
    box([x, 0.55, z], [2, 0.12, 2], "soil");
    cyl([x, 3.5, z], 0.3, 0.48, 6, "bark", 7);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2 + i * 0.6,
        dx = Math.cos(a) * 2.4,
        dz = Math.sin(a) * 2.4;
      beam([x, 3, z], [x + dx, 7, z + dz], 0.18, "bark");
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.scale(4.1, 3.7, 4.1);
      add(g, [x + dx, 8 + (j % 2), z + dz], j % 2 ? "leaf" : "leafLight");
    }
  });
  // Neutral path follows saved Salthouse Quay centreline, with edge lines and dashes.
  const ribbon = (
    a: number[],
    b: number[],
    w: number,
    y: number,
    m: string,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    box(
      [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
      [len, 0.05, w],
      m,
      -Math.atan2(dz, dx),
    );
  };
  const roadOffsets = site.road.map((p, i) => {
    const before = site.road[Math.max(0, i - 1)],
      after = site.road[Math.min(site.road.length - 1, i + 1)];
    const normal = (a: number[], b: number[]) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    };
    const a = i === 0 ? normal(p, after) : normal(before, p);
    const b = i === site.road.length - 1 ? a : normal(p, after);
    const sum = [a[0] + b[0], a[1] + b[1]],
      den = sum[0] * b[0] + sum[1] * b[1];
    return [sum[0] / den, sum[1] / den];
  });
  const roadEdge = (width: number) =>
    site.road.map(([x, z], i) => [
      x + roadOffsets[i][0] * width,
      z + roadOffsets[i][1] * width,
    ]);
  poly([...roadEdge(3), ...roadEdge(-3).reverse()], 0.55, 0.025, "road");
  poly(
    [
      [-22, 251],
      [11, 237],
      [29, 247],
      [20, 258],
      [-18, 267],
    ],
    0.49,
    0.035,
    "stone",
  );
  for (let row = 0; row < 26; row++)
    for (let col = 0; col < 34; col++) {
      const x = -19 + col * 1.1 + (row % 2) * 0.5,
        z = 253 + row * 0.4;
      if (z < 264 - x * 0.3)
        box(
          [x, 0.54, z],
          [1, 0.035, 0.29],
          (col + row) % 4 ? "detail-cobble" : "detail-stone",
        );
    }
  // Dock chains and bollards sit behind the trees; the slipway mouth stays open.
  const edge = [
    [0.7, 225.2],
    [20.5, 235.6],
    [27.5, 240.4],
    [32.2, 247.2],
  ];
  edge.slice(1).forEach((q, i) => {
    const p = edge[i],
      n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3);
    const at = (t: number, y: number) => [
      p[0] + (q[0] - p[0]) * t,
      y,
      p[1] + (q[1] - p[1]) * t,
    ];
    for (let j = 0; j <= n; j++)
      cyl(at(j / n, 1.25), 0.12, 0.17, 1.6, "iron", 7);
    for (let j = 0; j < n; j++)
      for (const y of [1.15, 1.85])
        for (let k = 0; k < 5; k++)
          beam(
            at((j + k / 5) / n, y - Math.sin((k / 5) * Math.PI) * 0.25),
            at(
              (j + (k + 1) / 5) / n,
              y - Math.sin(((k + 1) / 5) * Math.PI) * 0.25,
            ),
            0.025,
            "detail-iron",
          );
  });
  for (let i = 0; i < 9; i++)
    cyl([2 + i * 2.5, 0.95, 254 - i * 0.23], 0.13, 0.21, 1.2, "iron", 8);
  for (const [x, z] of [
    [20, 249],
    [-16, 255],
    [32, 281],
  ]) {
    cyl([x, 2.6, z], 0.085, 0.18, 4.3, "iron");
    cyl([x, 4.9, z], 0.45, 0.3, 0.7, "detail-lamp", 8);
    cyl([x, 5.4, z], 0, 0.6, 0.4, "iron", 8);
  }
  // Freestanding pub sign, deliberately simple and distinct from an artwork.
  box([10, 3.5, 250], [0.17, 6, 0.17], "iron");
  box([10, 6, 250], [2.7, 2, 0.15], "iron");
  box([10, 6.1, 250.09], [2.35, 1.6, 0.05], "detail-green");
  for (const [x, z] of [
    [1, 256],
    [7, 254],
  ]) {
    box([x, 1, z], [2.4, 0.13, 0.65], "detail-timber");
    box([x, 1.5, z + 0.3], [2.4, 0.65, 0.12], "detail-timber");
    for (const d of [-0.9, 0.9])
      box([x + d, 0.7, z], [0.12, 0.6, 0.6], "detail-iron");
  }
  // Existing carousel is a mapped neighbourhood feature, not Colour Rush.
  const [ax, az] = site.carousel.center,
    r = site.carousel.radius;
  cyl([ax, 0.75, az], r, r, 0.45, "red", 24);
  cyl([ax, 4.7, az], r, r, 0.65, "cream", 24);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          ax,
          6.1,
          az,
          ax + Math.cos(a) * r,
          5,
          az + Math.sin(a) * r,
          ax + Math.cos(b) * r,
          5,
          az + Math.sin(b) * r,
        ],
        3,
      ),
    );
    g.computeVertexNormals();
    add(g, [0, 0, 0], i % 2 ? "yellow" : "red");
    const x = ax + Math.cos(a) * 4.5,
      z = az + Math.sin(a) * 4.5;
    cyl([x, 2.8, z], 0.045, 0.045, 3.6, "detail-yellow", 6);
    if (i % 2 === 0) {
      box([x, 1.95, z], [1, 0.45, 0.35], "detail-cream", -a);
      box(
        [x + 0.4 * Math.cos(a), 2.3, z + 0.4 * Math.sin(a)],
        [0.3, 0.6, 0.3],
        "detail-cream",
        -a,
      );
    }
  }
  box([ax - 8, 1.8, az], [3, 2.5, 2], "cream");
  box([ax - 8, 2, az + 1.02], [2.3, 1, 0.07], "glass");
  box([ax - 8, 3.2, az], [3.3, 0.2, 2.3], "slate");
  return Object.fromEntries(
    Object.entries(parts).map(([m, gs]) => {
      const normalized = gs.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute("uv");
        return n;
      });
      const merged = mergeGeometries(normalized, false)!;
      new Set([...gs, ...normalized]).forEach((g) => g.dispose());
      return [m, merged];
    }),
  );
}
export const PumpHouse = memo(function PumpHouse({
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
    brick: "#935740",
    darkBrick: "#654537",
    slate: "#626b6b",
    iron: "#293536",
    glass: "#3b5358",
    stone: "#b9b09b",
    cobble: "#a29883",
    soil: "#665f48",
    bark: "#958d73",
    leaf: "#57714b",
    leafLight: "#718452",
    road: PATH_COLOURS[night ? "night" : "day"],
    yellow: "#d9b652",
    cream: "#e4dcc3",
    red: "#b65550",
    lamp: "#eee0b7",
    green: "#375b47",
    timber: "#837058",
  };
  const mesh = (m: string, g: THREE.BufferGeometry) => (
    <mesh key={m} geometry={g} castShadow receiveShadow>
      <meshStandardMaterial
        color={colors[m.replace("detail-", "")]}
        roughness={0.9}
        flatShading
        side={THREE.DoubleSide}
        emissive={m === "detail-lamp" ? "#ffe2ad" : "#000000"}
        emissiveIntensity={night ? 0.65 : 0}
      />
    </mesh>
  );
  return (
    <group position={[origin[0], 0, origin[1]]}>
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => mesh(m, g))}
      <Detailed distances={[0, 250]} hysteresis={0.12}>
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

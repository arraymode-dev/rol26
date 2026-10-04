import { GRASS_COLOUR } from "../lib/palette";
import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/church-gardens.json";

export const CHURCH_GARDENS = { x: -185, z: -321, elevation: site.elevation };
// Footprints and paths are map anchored; all vertical dimensions are visual estimates.
const boundary = [
  [-221, -333],
  [-219, -342],
  [-202, -351],
  [-172, -351],
  [-156, -337],
  [-139, -314],
  [-153, -304],
  [-165, -296],
  [-182, -288],
  [-185, -293],
  [-188, -291],
  [-190, -289],
];
export function inChurchGarden(x: number, z: number) {
  let inside = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const a = boundary[i],
      b = boundary[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function build() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const E = site.elevation;
  const add = (g: THREE.BufferGeometry, p: number[], m: string, a = 0) => {
    g.rotateY(a);
    g.translate(p[0] - CHURCH_GARDENS.x, p[1], p[2] - CHURCH_GARDENS.z);
    markBuildingGeometry(g, buildingGeometry);
    (parts[m] ??= []).push(g);
  };
  const box = (p: number[], s: [number, number, number], m: string, a = 0) =>
    add(new THREE.BoxGeometry(...s), p, m, a);
  const beam = (a: number[], b: number[], r: number, m: string) => {
    const from = new THREE.Vector3(...(a as [number, number, number])),
      to = new THREE.Vector3(...(b as [number, number, number])),
      d = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(r, r, d.length(), 5);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    add(g, from.add(to).multiplyScalar(0.5).toArray(), m);
  };
  const poly = (points: number[][], height: number, y: number, m: string) => {
    const shape = new THREE.Shape(
      points.map((p) => new THREE.Vector2(p[0], -p[1])),
    );
    const g = height
      ? new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      : new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    add(g, [0, y, 0], m);
  };
  const line = (
    a: number[],
    b: number[],
    width: number,
    h: number,
    y: number,
    m: string,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    box(
      [(a[0] + b[0]) / 2, y + h / 2, (a[1] + b[1]) / 2],
      [Math.hypot(dx, dz), h, width],
      m,
      -Math.atan2(dz, dx),
    );
  };
  const rail = (a: number[], b: number[], y: number, by = y) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.55);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t,
        h = y + (by - y) * t;
      beam([x, h, z], [x, h + 1.25, z], 0.035, "iron");
    }
    for (const h of [0.4, 1.12])
      beam([a[0], y + h, a[1]], [b[0], by + h, b[1]], 0.055, "iron");
  };
  const stairs = (
    a: number[],
    b: number[],
    low: number,
    high: number,
    width: number,
    count: number,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      nx = -dz / len,
      nz = dx / len;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        h = low + ((high - low) * (i + 1)) / count;
      box(
        [a[0] + dx * t, h / 2, a[1] + dz * t],
        [len / count + 0.025, h, width],
        "stone",
        -Math.atan2(dz, dx),
      );
    }
    for (const s of [-width / 2, width / 2])
      rail(
        [a[0] + nx * s, a[1] + nz * s],
        [b[0] + nx * s, b[1] + nz * s],
        low,
        high,
      );
  };
  poly(boundary, 2.15, 0, "stone");
  const upper = [
    [-218, -333],
    [-217, -341],
    [-202, -351],
    [-172, -351],
    [-156, -337],
    [-139, -314],
    [-153, -304],
    [-165, -296],
    [-182, -288],
    [-185, -293],
    [-188, -294],
    [-190, -292],
    [-215, -325.5],
    [-212, -327.5],
    [-213.4, -329.5],
    [-216.4, -327.5],
    [-219.5, -333],
  ];
  poly(upper, E - 2.15, 2.15, "stone");
  poly(upper, 0, E + 0.015, "paving");
  // Lower waterfront terrace; the main platform covers its inland edge.
  poly(
    [
      [-221, -333],
      [-219.5, -333],
      [-190, -292],
      [-190, -289],
    ],
    0,
    2.17,
    "paving",
  );
  for (const lawn of site.lawns) poly(lawn.points, 0.12, E + 0.035, "grass");
  for (const p of site.paths)
    for (let i = 1; i < p.points.length; i++)
      line(p.points[i - 1], p.points[i], 2.1, 0.055, E + 0.04, "paving");
  // Retaining edge, interrupted at the south stair; no rail across an entry.
  const west = [
    [-219, -342],
    [-221, -337],
    [-221, -333],
    [-192, -292],
  ];
  for (let i = 1; i < west.length; i++) {
    line(west[i - 1], west[i], 0.6, 0.3, 2.15, "trim");
    rail(west[i - 1], west[i], 2.45);
  }
  stairs([-190.5, -289.3], [-184.5, -293.1], 0.48, E, 2.6, 18);
  stairs([-166.6, -297], [-157.9, -301.8], 0.48, E, 2.5, 18);
  // A separate short garden stair leads to an inset lower terrace.
  stairs([-215.7, -326.5], [-212.7, -328.5], 2.15, E, 2.4, 8);
  buildingGeometry = true;
  // Church body follows the mapped footprint, with a clerestory and Gothic south windows.
  poly(site.church.points, 10, E, "sandstone");
  box([-187, E + 12.2, -340.5], [30, 4.4, 11], "sandstone");
  box([-187, E + 14.6, -340.5], [30.8, 0.35, 11.7], "roof");
  box([-187, E + 10.1, -329.45], [31, 0.4, 0.65], "trim");
  const gothic = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    m: string,
  ) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h * 0.65);
    s.quadraticCurveTo(w * 0.4, h * 0.84, 0, h);
    s.quadraticCurveTo(-w * 0.4, h * 0.84, -w / 2, h * 0.65);
    s.closePath();
    add(new THREE.ShapeGeometry(s), [x, y, z], m);
  };
  for (const x of [-199, -192, -185, -178]) {
    gothic(x, E + 2, -329.35, 4.5, 7.2, "trim");
    gothic(x, E + 2.3, -329.25, 3.9, 6.55, "window");
    for (const dx of [-0.65, 0.65])
      box([x + dx, E + 4.8, -329.15], [0.12, 5, 0.12], "trim");
    beam([x - 1.4, E + 6.4, -329.12], [x, E + 8.7, -329.12], 0.075, "trim");
    beam([x + 1.4, E + 6.4, -329.12], [x, E + 8.7, -329.12], 0.075, "trim");
    for (const dx of [-1, 0, 1])
      gothic(x + dx, E + 11, -334.9, 0.68, 2.2, "window");
  }
  gothic(-192, E, -329.03, 2.1, 3.3, "wood");
  // West clock tower and open spire: a skeletal crown instead of a solid cone.
  box([-207, E + 14, -340], [8, 28, 8], "sandstone");
  for (const y of [1, 9, 18, 28])
    box([-207, E + y, -340], [8.6, 0.4, 8.6], "trim");
  gothic(-207, E + 18.7, -335.9, 4.1, 7.6, "trim");
  gothic(-207, E + 19, -335.78, 3.5, 6.9, "window");
  for (let y = E + 19.6; y < E + 24.6; y += 0.45)
    box([-207, y, -335.62], [3, 0.09, 0.12], "sandstone");
  // Clock faces face outward along +z.
  const clock = new THREE.CircleGeometry(1.5, 24);
  add(clock, [-207, E + 16, -335.58], "clock");
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(
      [-207 + Math.sin(a) * 1.24, E + 16 + Math.cos(a) * 1.24, -335.5],
      [0.1, 0.2, 0.05],
      "iron",
      0,
    );
  }
  beam(
    [-207, E + 16, -335.44],
    [-207 + 0.65, E + 16.5, -335.44],
    0.065,
    "iron",
  );
  beam([-207, E + 16, -335.44], [-207 - 0.15, E + 17, -335.44], 0.05, "iron");
  for (const dx of [-3.5, 3.5])
    for (const dz of [-3.5, 3.5]) {
      box([-207 + dx, E + 30.5, -340 + dz], [0.7, 5, 0.7], "sandstone");
      add(
        new THREE.ConeGeometry(0.8, 3, 4),
        [-207 + dx, E + 34.5, -340 + dz],
        "sandstone",
      );
    }
  for (const y of [28, 33, 37])
    box(
      [-207, E + y, -340],
      [y === 37 ? 3.8 : 6, 0.35, y === 37 ? 3.8 : 6],
      "trim",
    );
  for (const dx of [-2.8, 2.8])
    for (const dz of [-2.8, 2.8])
      beam(
        [-207 + dx, E + 28, -340 + dz],
        [-207, E + 44, -340],
        0.28,
        "sandstone",
      );
  beam([-207, E + 43, -340], [-207, E + 45, -340], 0.09, "iron");
  add(
    new THREE.CylinderGeometry(2.3, 2.3, 3, 6),
    [-173, E + 10.8, -333],
    "sandstone",
  );
  add(new THREE.ConeGeometry(2.65, 2.6, 6), [-173, E + 13.6, -333], "copper");
  buildingGeometry = false;
  // Gated side entry: threshold at garden elevation, with no unverified accessibility claim.
  for (const x of [-216.4, -212.4]) {
    box([x, E + 1.5, -342], [0.85, 3, 0.85], "stone");
    add(new THREE.ConeGeometry(0.75, 0.9, 4), [x, E + 3.4, -342], "stone");
  }
  rail([-216.4, -342], [-216.4, -339.8], E);
  rail([-212.4, -342], [-211, -340.5], E);
  // Close-view furniture. Batched by material and culled as a group at distance.
  function bench(x: number, z: number, a = 0) {
    const part = (
      dx: number,
      y: number,
      dz: number,
      s: [number, number, number],
      m = "detail-wood",
    ) =>
      box(
        [
          x + Math.cos(a) * dx + Math.sin(a) * dz,
          E + y,
          z - Math.sin(a) * dx + Math.cos(a) * dz,
        ],
        s,
        m,
        a,
      );
    for (const dx of [-0.9, 0.9])
      for (const dz of [-0.27, 0.27]) part(dx, 0.4, dz, [0.12, 0.8, 0.12]);
    for (let i = 0; i < 4; i++) part(0, 0.82, -0.3 + i * 0.2, [2, 0.08, 0.16]);
    for (let i = 0; i < 9; i++)
      part(-0.85 + i * 0.21, 1.22, -0.35, [0.12, 0.75, 0.08]);
    part(0, 1.62, -0.35, [2.1, 0.13, 0.13]);
    for (const dx of [-1, 1]) part(dx, 1.1, 0, [0.13, 0.13, 0.85]);
  }
  for (let i = 0; i < 6; i++) bench(-197 + i * 3.7, -326.5);
  bench(-165, -316, Math.PI / 2);
  bench(-175, -302, Math.PI);
  bench(-203, -316, -0.55);
  for (const [x, z] of [
    [-190, -325.7],
    [-177, -325.7],
    [-169, -304],
  ]) {
    box([x, E + 0.62, z], [0.65, 1.25, 0.65], "detail-iron");
    box([x, E + 1.15, z], [0.7, 0.15, 0.7], "detail-trim");
    box([x, E + 0.8, z + 0.34], [0.38, 0.24, 0.03], "detail-window");
  }
  const orb = (x: number, y: number, z: number, s: number[], m: string) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(...(s as [number, number, number]));
    add(g, [x, y, z], m);
  };
  // Broadleaf crowns and clustered strap-leaf forms from the planting references.
  for (const [i, [x, z]] of [
    [-160, -330],
    [-153, -323],
    [-147, -316],
    [-173, -300],
    [-177, -316],
  ].entries()) {
    beam([x, E, z], [x, E + 5, z], 0.16, "wood");
    for (let j = 0; j < 4; j++) {
      const a = j * 2.4 + i;
      const bx = x + Math.cos(a) * 1.8,
        bz = z + Math.sin(a) * 1.8;
      beam([x, E + 3, z], [bx, E + 6, bz], 0.1, "wood");
      orb(
        bx,
        E + 6.5 + (j % 2),
        bz,
        [2.3, 2.8, 2.1],
        j % 2 ? "leaves" : "leaf-light",
      );
    }
  }
  for (const [x, z] of [
    [-202, -328],
    [-182, -328],
    [-171, -326],
    [-176, -320],
    [-200, -318],
  ])
    for (let stem = 0; stem < 3; stem++) {
      const px = x + stem * 0.7,
        pz = z + Math.sin(stem) * 0.7,
        h = 2.3 + stem * 0.6;
      beam([px, E, pz], [px + 0.25, E + h, pz], 0.1, "wood");
      for (let j = 0; j < 13; j++) {
        const a = (j * Math.PI * 2) / 13;
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            [
              0,
              0,
              0,
              Math.cos(a) * 0.3,
              0.55,
              Math.sin(a) * 0.3,
              Math.cos(a) * 1.7,
              -0.45,
              Math.sin(a) * 1.7,
            ],
            3,
          ),
        );
        g.computeVertexNormals();
        add(g, [px + 0.25, E + h, pz], j % 2 ? "leaves" : "leaf-light");
      }
    }
  for (let i = 0; i < 42; i++) {
    const a = i * 2.399,
      x = -177 + Math.cos(a) * (2 + (i % 4) * 0.7),
      z = -317 + Math.sin(a) * (2 + (i % 3) * 0.8);
    orb(x, E + 0.4, z, [0.65, 0.55, 0.6], "leaves");
    if (i % 3 === 0) orb(x, E + 0.95, z, [0.18, 0.16, 0.18], "flowers");
  }
  // Fine stone paving joints around the bench walk, visible only when close.
  for (let x = -200; x < -170; x += 1.5)
    box([x, E + 0.103, -326], [0.025, 0.018, 3], "detail-joint");
  return Object.fromEntries(
    Object.entries(parts).map(([m, gs]) => {
      const ns = gs.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute("uv");
        return n;
      });
      const g = mergeGeometries(ns)!;
      new Set([...gs, ...ns]).forEach((v) => v.dispose());
      return [m, g];
    }),
  );
}
export const ChurchGardens = memo(function ChurchGardens({
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
    stone: "#aaa08b",
    paving: "#d8c8aa",
    sandstone: "#c3a47b",
    trim: "#a98e6d",
    grass: GRASS_COLOUR,
    roof: "#62615a",
    window: "#344447",
    iron: "#303734",
    clock: "#efecd9",
    copper: "#88bfa6",
    wood: "#817462",
    leaves: "#435e3c",
    "leaf-light": "#69804a",
    flowers: "#e8cc5e",
    joint: "#a3957b",
  };
  const mesh = (m: string, g: THREE.BufferGeometry) => (
    <mesh
      key={m}
      geometry={g}
      userData={{ buildingSurface: m.replace("detail-", "") }}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={colors[m.replace("detail-", "")]}
        roughness={0.94}
        flatShading
        side={THREE.DoubleSide}
        emissive={night ? "#20302d" : "#000000"}
        emissiveIntensity={0.12}
      />
    </mesh>
  );
  return (
    <group position={[CHURCH_GARDENS.x, 0, CHURCH_GARDENS.z]}>
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => mesh(m, g))}
      <Detailed distances={[0, 240]} hysteresis={0.12}>
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

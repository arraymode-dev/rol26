import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Point = [number, number];
export interface LandmarkFootprint {
  id: string;
  points: number[][];
  holes?: number[][][];
  height?: number;
}
export const WATERFRONT_LANDMARK_IDS = [
  "24611033",
  "6524513",
  "84758669",
  "1426659206",
  "1426659207",
  "652006977",
  "656966990",
  "656966991",
  "656966993",
];
export type LandmarkPart = { material: string; geometry: THREE.BufferGeometry };

// All positions come from the saved map footprint. Heights and architectural
// details interpret the user's October 2 reference views, not a measured survey.
function frame(b: LandmarkFootprint, angle: number) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const ps = b.points.map(([x, z]) => [c * x - s * z, s * x + c * z]);
  const minX = Math.min(...ps.map((p) => p[0])),
    maxX = Math.max(...ps.map((p) => p[0]));
  const minZ = Math.min(...ps.map((p) => p[1])),
    maxZ = Math.max(...ps.map((p) => p[1]));
  const cx = (minX + maxX) / 2,
    cz = (minZ + maxZ) / 2;
  const local = ([x, z]: number[]): Point => [
    c * x - s * z - cx,
    s * x + c * z - cz,
  ];
  return {
    angle,
    x: c * cx + s * cz,
    z: -s * cx + c * cz,
    w: maxX - minX,
    d: maxZ - minZ,
    points: b.points.map(local),
    holes: b.holes?.map((h) => h.map(local)) ?? [],
  };
}
const rectangle = (x: number, z: number, w: number, d: number): Point[] => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
  [x - w / 2, z - d / 2],
];
class Builder {
  parts = new Map<string, THREE.BufferGeometry[]>();
  add(
    g: THREE.BufferGeometry,
    p: number[] = [0, 0, 0],
    material = "stone",
    rotation = 0,
  ) {
    g.rotateY(rotation);
    g.translate(p[0], p[1], p[2]);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material)!.push(g);
  }
  box(p: number[], s: [number, number, number], m = "stone", r = 0) {
    this.add(new THREE.BoxGeometry(...s), p, m, r);
  }
  cyl(p: number[], rt: number, rb: number, h: number, m = "stone", n = 16) {
    this.add(new THREE.CylinderGeometry(rt, rb, h, n), p, m);
  }
  dome(p: number[], r: number, h: number, m = "stone") {
    const g = new THREE.SphereGeometry(
      r,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    g.scale(1, h / r, 1);
    this.add(g, p, m);
  }
  beam(a: number[], b: number[], width: number, m = "stone") {
    const av = new THREE.Vector3(...(a as [number, number, number])),
      bv = new THREE.Vector3(...(b as [number, number, number]));
    const delta = bv.clone().sub(av),
      g = new THREE.CylinderGeometry(width, width, delta.length(), 6);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    this.add(g, av.add(bv).multiplyScalar(0.5).toArray(), m);
  }
  solid(
    ps: Point[],
    bottom: number,
    top: number | ((x: number, z: number) => number),
    m = "stone",
    holes: Point[][] = [],
  ) {
    const shape = new THREE.Shape(ps.map(([x, z]) => new THREE.Vector2(x, -z)));
    // ExtrudeGeometry only fixes hole winding when it also reverses the outer
    // ring. Normalize every hole explicitly so courtyard walls face inward.
    shape.holes = holes.map((ring) => {
      const points = ring.map(([x, z]) => new THREE.Vector2(x, -z));
      if (THREE.ShapeUtils.isClockWise(points)) points.reverse();
      return new THREE.Path(points);
    });
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 1,
      bevelEnabled: false,
    });
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      p.setY(
        i,
        p.getY(i) > 0.5
          ? typeof top === "number"
            ? top
            : top(p.getX(i), p.getZ(i))
          : bottom,
      );
    g.computeVertexNormals();
    this.add(g, [0, 0, 0], m);
  }
  edge(
    ps: Point[],
    y: number | ((x: number, z: number) => number),
    width: number,
    height: number,
    m = "stone",
  ) {
    ps.slice(1).forEach((p, i) => {
      const a = ps[i],
        dx = p[0] - a[0],
        dz = p[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.15) return;
      if (typeof y === "number")
        this.box(
          [(a[0] + p[0]) / 2, y, (a[1] + p[1]) / 2],
          [len, height, width],
          m,
          -Math.atan2(dz, dx),
        );
      else
        this.beam([a[0], y(...a), a[1]], [p[0], y(...p), p[1]], width / 2, m);
    });
  }
  arch(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    m = "glass",
    a = 0,
  ) {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.lineTo(w / 2, 0);
    sh.lineTo(w / 2, h - w / 2);
    sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
    sh.closePath();
    this.add(
      new THREE.ExtrudeGeometry(sh, {
        depth: 0.14,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      [x, y, z],
      m,
      a,
    );
  }
  finish(f: ReturnType<typeof frame>): LandmarkPart[] {
    return [...this.parts].map(([material, gs]) => {
      const normalized = gs.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute("uv");
        return n;
      });
      const geometry = mergeGeometries(normalized)!;
      geometry.rotateY(f.angle);
      geometry.translate(f.x, 0, f.z);
      new Set([...gs, ...normalized]).forEach((g) => g.dispose());
      return { material, geometry };
    });
  }
}
function facades(
  b: Builder,
  f: ReturnType<typeof frame>,
  top: number,
  spacing = 4.5,
  include: (x: number, y: number, z: number) => boolean = () => true,
) {
  // Follow each actual mapped wall, avoiding any rectangular facades across a setback.
  f.points.slice(1).forEach((p, i) => {
    const a = f.points[i],
      dx = p[0] - a[0],
      dz = p[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 8) return;
    const count = Math.floor(len / spacing),
      angle = -Math.atan2(dz, dx);
    // The paired thin faces make the window band visible irrespective of polygon winding.
    for (let row = 0; row < Math.floor((top - 8) / 4.5); row++)
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count,
          x = a[0] + dx * t,
          z = a[1] + dz * t,
          y = 7 + row * 4.5;
        if (!include(x, y, z)) continue;
        b.box(
          [x, y, z],
          [Math.min(2.1, (len / count) * 0.48), 2.6, 0.32],
          "glass",
          angle,
        );
        b.box([x, y - 1.48, z], [2.5, 0.22, 0.48], "stone", angle);
      }
  });
}
function liver(b: Builder, f: ReturnType<typeof frame>) {
  const court = rectangle(0, 0, 18, 28);
  b.solid(f.points, -0.1, 12);
  b.solid(f.points, 12, 48, "stone", [court]);
  for (const y of [2, 12, 44, 48.5, 50]) b.edge(f.points, y, 1.1, 0.65);
  b.edge(court, 48.7, 0.7, 1.6);
  facades(b, f, 44, 5.1);
  for (const side of [-1, 1]) {
    const z = side * (f.d / 2 - 13);
    b.box([0, 55, z], [15, 17, 15]);
    b.box([0, 64, z], [17, 1.3, 17]);
    b.box([0, 70, z], [12, 11, 12]);
    b.cyl([0, 76, z], 6.7, 6.7, 1.4);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      b.cyl([Math.cos(a) * 4.6, 80, z + Math.sin(a) * 4.6], 0.55, 0.75, 8);
    }
    b.cyl([0, 84.3, z], 4.2, 5.8, 1.5);
    b.dome([0, 85, z], 4.2, 3.8);
    b.cyl([0, 89.3, z], 0.5, 1, 1.5);
    // Small bird silhouette rather than the former pyramid cap.
    const bird = new THREE.SphereGeometry(1, 12, 8);
    bird.scale(0.85, 1.4, 0.65);
    b.add(bird, [0, 91, z], "metal");
    b.beam([0, 90, z], [1.7, 91.2, z], 0.23, "metal");
    b.beam([0, 91, z], [-1, 92.5, z], 0.3, "metal");
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const x = Math.sin(a) * 7.65,
        zz = z + Math.cos(a) * 7.65;
      const disk = new THREE.CircleGeometry(3.4, 48);
      b.add(disk, [x, 57, zz], "clock", a);
      const ring = new THREE.TorusGeometry(3.5, 0.22, 8, 48);
      b.add(ring, [x, 57, zz], "stone", a);
      const cx = x + Math.sin(a) * 0.1,
        cz = zz + Math.cos(a) * 0.1;
      b.beam([cx, 57, cz], [cx, 59.3, cz], 0.1, "metal");
      b.beam(
        [cx, 57, cz],
        [cx + Math.cos(a) * 1.7, 57.8, cz - Math.sin(a) * 1.7],
        0.12,
        "metal",
      );
    }
  }
  for (const x of [-f.w / 2 + 3.5, f.w / 2 - 3.5])
    for (const z of [-f.d / 2 + 5, f.d / 2 - 5]) {
      b.box([x, 26, z], [5.5, 49, 5.5]);
      b.cyl([x, 50.5, z], 3.1, 3.1, 2);
      b.dome([x, 51.5, z], 3.1, 4);
    }
  // Tall vertical ribs, stepped roof blocks and entrance bays.
  for (const x of [-f.w / 2, f.w / 2])
    for (let z = -f.d / 2 + 12; z < f.d / 2 - 8; z += 9)
      b.box([x, 27, z], [1.25, 44, 1.6]);
  for (const z of [-f.d / 2 + 1, f.d / 2 - 1])
    for (const x of [-18, -9, 9, 18]) b.box([x, 25, z], [1.6, 44, 1.3]);
  for (const x of [-17, 17]) b.box([x, 50, 0], [7, 3, 28]);
}
function port(b: Builder, f: ReturnType<typeof frame>) {
  // Align ornament to the long front wall, rather than placing it through
  // the stepped footprint. Keep the entrance and paired pediment bays clear.
  const frontAt = (x: number) => {
    const crossings = f.points.slice(1).flatMap((p, i) => {
      const a = f.points[i];
      if (Math.abs(p[0] - a[0]) < 0.001) return [];
      const t = (x - a[0]) / (p[0] - a[0]);
      return t >= 0 && t <= 1 ? [a[1] + t * (p[1] - a[1])] : [];
    });
    return Math.max(...crossings);
  };
  const bays = [-f.w / 2 + 13, f.w / 2 - 13];
  b.solid(f.points, -0.1, 30, "stone", f.holes);
  for (const y of [2, 11, 25.5, 29.6, 31]) b.edge(f.points, y, 0.95, 0.6);
  f.holes.forEach((h) => b.edge(h, 30.6, 0.6, 1));
  facades(
    b,
    f,
    28,
    4.5,
    (x, _y, z) =>
      z < f.d / 2 - 5 ||
      (Math.abs(x) > 7 && bays.every((bay) => Math.abs(x - bay) > 5.5)),
  );
  b.cyl([0, 33, 0], 14, 15, 5, "stone", 12);
  b.cyl([0, 39, 0], 11.8, 11.8, 9, "stone", 24);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    b.cyl([Math.cos(a) * 11.9, 39, Math.sin(a) * 11.9], 0.5, 0.65, 8);
  }
  b.cyl([0, 44, 0], 12.5, 12.5, 1);
  b.dome([0, 44.5, 0], 12.3, 10.5);
  b.cyl([0, 57, 0], 1.5, 2, 4);
  b.dome([0, 59, 0], 1.65, 1.8);
  for (const x of [-f.w / 2 + 7, f.w / 2 - 7])
    for (const z of [-f.d / 2 + 7, f.d / 2 - 7]) {
      b.cyl([x, 17, z], 5.1, 5.7, 33, "stone", 8);
      b.cyl([x, 35, z], 4.8, 4.8, 7, "stone", 12);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        b.cyl([x + Math.cos(a) * 4.7, 35, z + Math.sin(a) * 4.7], 0.28, 0.4, 6);
      }
      b.cyl([x, 39, z], 5, 5, 1);
      b.dome([x, 39.5, z], 4.7, 4.9);
      b.cyl([x, 45, z], 0.6, 0.8, 1.5);
    }
  const front = frontAt(0);
  b.box([0, 6.5, front + 0.4], [10, 13, 1.2]);
  b.arch(0, 0.7, front + 1.06, 5.4, 9);
  b.box([0, 0.4, front + 1.5], [6.4, 0.8, 2.6]);
  b.box([0, 13.2, front + 0.7], [11, 0.7, 1.6]);
  for (const x of [-4.3, 4.3]) {
    b.box([x, 20.5, front + 0.45], [0.7, 14, 0.9]);
    b.box([x, 27.5, front + 0.6], [1.3, 0.6, 1.2]);
    b.box([x, 30, front + 0.35], [1, 3, 1]);
  }
  const pediment = new THREE.Shape();
  pediment.moveTo(-5.8, 0);
  pediment.lineTo(0, 4);
  pediment.lineTo(5.8, 0);
  pediment.closePath();
  b.add(
    new THREE.ExtrudeGeometry(pediment, { depth: 0.8, bevelEnabled: false }),
    [0, 27.6, front],
  );
  b.beam([-5.8, 27.6, front + 0.9], [0, 31.6, front + 0.9], 0.35);
  b.beam([0, 31.6, front + 0.9], [5.8, 27.6, front + 0.9], 0.35);
  for (const x of bays) {
    const wall = frontAt(x);
    b.box([x, 6.8, wall + 0.3], [9, 13.6, 1.3]);
    b.box([x, 13.8, wall + 0.5], [9.8, 0.7, 1.7]);
    // Shallow stone relief above the columns, not a black arched window.
    b.add(new THREE.TorusGeometry(4.2, 0.55, 8, 24, Math.PI), [
      x,
      25.4,
      wall + 0.8,
    ]);
    b.box([x, 25.4, wall + 0.65], [9.5, 0.6, 1.3]);
    for (const dx of [-3.6, 3.6]) {
      b.cyl([x + dx, 19.7, wall + 0.9], 0.45, 0.55, 11);
      b.cyl([x + dx, 14.2, wall + 0.9], 0.75, 0.75, 0.45);
      b.box([x + dx, 25.1, wall + 0.9], [1.3, 0.7, 1.3]);
    }
  }
}
function museum(b: Builder, f: ReturnType<typeof frame>) {
  const inset = (scale: number): Point[] =>
    f.points.map(([x, z]) => [x * scale, z * scale]);
  const w = f.w / 2,
    d = f.d / 2;
  const height = (x: number, z: number) =>
    24 + 3 * Math.abs(z / d) - 5 * (1 - Math.abs(z / d)) * Math.abs(x / w);
  b.solid(inset(0.88), -0.1, 8, "glass");
  b.solid(f.points, 8, height);
  b.edge(f.points, height, 0.55, 0.5);
  // Folded triangular side planes and inset glazing at both overhanging ends.
  for (const side of [-1, 1]) {
    const z = side * d * 0.88;
    b.box([0, 15.2, z], [f.w * 0.53, 13, 0.32], "glass");
    for (let x = -f.w * 0.24; x < f.w * 0.26; x += 3)
      b.box([x, 15.2, z], [0.18, 13.3, 0.45]);
    for (let i = 0; i < 9; i++)
      b.box(
        [0, 0.6 + i * 0.55, side * (d - 6 - i * 0.9)],
        [f.w * 0.49, 0.56, 10 - i * 0.8],
      );
  }
  // Long sloping ramps at the two ends, forming the recognisable lifted wings.
  for (const side of [-1, 1]) {
    const ramp: Point[] = [
      [side * w * 0.78, -d * 0.76],
      [side * w * 0.99, -d * 0.77],
      [side * w * 0.73, d * 0.75],
      [side * w * 0.45, d * 0.72],
      [side * w * 0.78, -d * 0.76],
    ];
    b.solid(ramp, 0.7, (x, z) => 1 + 7 * (0.5 + z / (2 * d)));
  }
  // Panel joints read as seams in the folded stone shell, not another solid roof block.
  f.points.slice(1).forEach((p, i) => {
    const a = f.points[i],
      len = Math.hypot(p[0] - a[0], p[1] - a[1]);
    for (let t = 3; t < len; t += 4) {
      const x = a[0] + ((p[0] - a[0]) * t) / len,
        z = a[1] + ((p[1] - a[1]) * t) / len;
      b.beam([x, 8.2, z], [x, height(x, z) - 0.2, z], 0.035, "metal");
    }
  });
}
function mann(b: Builder, f: ReturnType<typeof frame>, reverse: boolean) {
  const lo = Math.min(...f.points.map((p) => p[1])),
    hi = Math.max(...f.points.map((p) => p[1]));
  const top = (x: number, z: number) =>
    11 + 27 * (reverse ? 1 - (z - lo) / (hi - lo) : (z - lo) / (hi - lo));
  b.solid(f.points, 0.7, top);
  b.edge(f.points, top, 0.55, 0.5);
  for (const y of [3.5, 7, 10]) b.edge(f.points, y, 0.2, 0.15, "glass");
  // Dense seams on the sloping roof and vertical glazing grid.
  const points = f.points;
  for (let z = lo + 2; z < hi; z += 2.5) {
    const xs: number[] = [];
    points.slice(1).forEach((p, i) => {
      const a = points[i];
      if (a[1] > z !== p[1] > z)
        xs.push(a[0] + ((p[0] - a[0]) * (z - a[1])) / (p[1] - a[1]));
    });
    xs.sort((a, c) => a - c);
    for (let i = 0; i + 1 < xs.length; i += 2)
      b.beam(
        [xs[i], top(xs[i], z) + 0.12, z],
        [xs[i + 1], top(xs[i + 1], z) + 0.12, z],
        0.09,
        "metal",
      );
  }
  points.slice(1).forEach((p, i) => {
    const a = points[i],
      len = Math.hypot(p[0] - a[0], p[1] - a[1]);
    for (let t = 3; t < len; t += 3.5) {
      const x = a[0] + ((p[0] - a[0]) * t) / len,
        z = a[1] + ((p[1] - a[1]) * t) / len;
      b.beam([x, 1, z], [x, top(x, z) - 0.25, z], 0.045, "glass");
    }
  });
}
function arena(b: Builder, f: ReturnType<typeof frame>) {
  b.solid(f.points, -0.1, 22);
  for (const y of [3, 9, 15, 21]) b.edge(f.points, y, 1, 0.55);
  const roof = f.points.map(([x, z]) => [x * 0.955, z * 0.955] as Point);
  const top = (x: number, z: number) =>
    24 +
    3 *
      Math.max(0, 1 - (x / (f.w * 0.5)) ** 2) *
      Math.max(0, 1 - (z / (f.d * 0.5)) ** 2);
  b.solid(roof, 22, top);
  b.edge(roof, top, 1, 0.7);
  // Roof-edge clerestories and cross ribs on both rounded halls.
  for (const side of [-1, 1])
    for (let i = -4; i <= 4; i++) {
      const x = side * f.w * 0.36,
        z = i * f.d * 0.062,
        y = top(x, z) + 0.1;
      b.box([x, y, z], [5, 0.25, f.d * 0.05], "glass");
      b.box([x, y + 0.25, z - f.d * 0.027], [6, 0.25, 0.3]);
    }
  f.points.slice(1).forEach((p, i) => {
    const a = f.points[i],
      len = Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (len > 5) {
      b.box(
        [(a[0] + p[0]) / 2, 11, (a[1] + p[1]) / 2],
        [len * 0.85, 4, 0.22],
        "glass",
        -Math.atan2(p[1] - a[1], p[0] - a[0]),
      );
    }
  });
}
export function buildWaterfrontLandmark(
  footprint: LandmarkFootprint,
): LandmarkPart[] {
  const b = new Builder();
  const id = footprint.id;
  const angle =
    id === "6524513"
      ? -1.102
      : id === "24611033"
        ? -1.04
        : ["84758669", "656966990", "656966991", "656966993"].includes(id)
          ? 0.37
          : 0;
  const f = frame(footprint, angle);
  if (id === "24611033") liver(b, f);
  else if (id === "6524513") port(b, f);
  else if (id === "84758669") museum(b, f);
  else if (["1426659206", "1426659207"].includes(id))
    mann(b, f, id === "1426659206");
  else if (["656966990", "656966991"].includes(id)) arena(b, f);
  else {
    b.solid(f.points, -0.1, id === "652006977" ? 7 : 20);
    b.edge(f.points, id === "652006977" ? 7.5 : 20.5, 0.7, 1);
  }
  return b.finish(f);
}

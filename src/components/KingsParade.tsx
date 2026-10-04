import { GRASS_COLOUR, PATH_COLOURS, GROUND_COLOURS } from "../lib/palette";
import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useMemo, useEffect } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/kings-parade.json" with { type: "json" };
export const KINGS_PLATFORM = {
  x: site.center[0],
  z: site.center[1],
  level: 0.55 + site.rise,
};
export const KINGS_BUILDINGS = [site.arena.id, site.wheel.id];
export const isKingsTree = ([x, z]: number[]) =>
  site.trees.some(([a, b]) => Math.hypot(x - a, z - b) < 1);
const origin = site.center;
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
  const [cx, cz] = site.center,
    ground = 0.55,
    top = ground + site.rise,
    stairAngle = -0.55;
  const radial = (r: number, a: number, y: number) => [
    cx + r * Math.cos(a),
    y,
    cz + r * Math.sin(a),
  ];
  const gap = (a: number) =>
    Math.abs(Math.atan2(Math.sin(a - stairAngle), Math.cos(a - stairAngle))) <
    0.115;
  // Photo-informed low platform, with a genuine recess rather than steps over a solid rim.
  cyl([cx, ground + site.rise / 2, cz], 5.55, 5.55, site.rise, "joint", 96);
  const ring = (
    inner: number,
    outer: number,
    iy: number,
    oy: number,
    m: string,
    notch = false,
  ) => {
    const vs: number[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i * Math.PI) / 64,
        b = ((i + 1) * Math.PI) / 64;
      if (notch && gap((a + b) / 2)) continue;
      vs.push(
        ...radial(inner, a, iy),
        ...radial(outer, a, oy),
        ...radial(outer, b, oy),
        ...radial(inner, a, iy),
        ...radial(outer, b, oy),
        ...radial(inner, b, iy),
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vs, 3));
    g.computeVertexNormals();
    add(g, [0, 0, 0], m);
  };
  ring(5.55, 6.2, top, top, "joint", true);
  ring(6.2, 6.85, top, ground, "joint", true);
  for (let r = 0.2; r < 6.7; r += 0.32) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.44));
    for (let i = 0; i < n; i++) {
      const a = ((i + (Math.round(r / 0.32) % 2) * 0.5) * Math.PI * 2) / n;
      if (r > 5.55 && r < 6.9 && gap(a)) continue;
      const y =
        r <= 6.2
          ? top
          : r < 6.85
            ? top - ((r - 6.2) / 0.65) * site.rise
            : ground;
      const g = new THREE.BoxGeometry(
        0.27,
        0.04,
        Math.min(0.38, ((2 * Math.PI * r) / n) * 0.88),
      );
      if (r > 6.2 && r < 6.85) g.rotateZ(-Math.atan2(site.rise, 0.65));
      add(
        g,
        radial(r, a, y + 0.025),
        (i + Math.round(r * 3)) % 5 ? "detail-cobble" : "detail-stone",
        -a,
      );
    }
  }
  for (let i = 0; i < 3; i++) {
    const r = 6.65 - i * 0.43,
      y = ground + (site.rise * (i + 1)) / 3;
    box(
      radial(r, stairAngle, (ground + y) / 2),
      [0.46, y - ground, 1.3],
      "stone",
      -stairAngle,
    );
  }
  for (const side of [-1, 1]) {
    const a = stairAngle + side * 0.125;
    beam(
      radial(6.85, a, ground + 0.1),
      radial(5.55, a, top + 0.07),
      0.12,
      "stone",
    );
  }
  box([cx - 0.9, top + 0.045, cz + 0.6], [0.65, 0.05, 0.65], "detail-iron");
  // Keep detailed paving within the circular platform; the map supplies the surrounding ground.
  const lamp = (x: number, z: number) => {
    cyl([x, 2.4, z], 0.07, 0.18, 3.8, "iron");
    cyl([x, 0.75, z], 0.19, 0.34, 0.5, "iron");
    add(new THREE.SphereGeometry(0.37, 10, 8), [x, 4.55, z], "lamp");
    const cap = new THREE.SphereGeometry(
      0.38,
      10,
      6,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    add(cap, [x, 4.55, z], "iron");
    cyl([x, 4.1, z], 0.23, 0.1, 0.2, "iron");
  };
  for (const a of [0.65, 2.55, 4.6]) {
    const p = radial(9.1, a, 0);
    lamp(p[0], p[2]);
  }
  const chain = site.chains.points;
  chain.slice(1).forEach((q, i) => {
    const p = chain[i],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]),
      n = Math.ceil(len / 2.4);
    const at = (t: number, y: number, offset = 0) => [
      p[0] + (q[0] - p[0]) * t - (offset * (q[1] - p[1])) / len,
      y,
      p[1] + (q[1] - p[1]) * t + (offset * (q[0] - p[0])) / len,
    ];
    beam(at(0, 1.75, -0.65), at(1, 1.75, -0.65), 0.055, "iron");
    beam(at(0, 0.65, -0.65), at(1, 0.65, -0.65), 0.04, "iron");
    for (let u = 0; u < len; u += 0.28)
      beam(
        at(u / len, 0.65, -0.65),
        at(u / len, 1.75, -0.65),
        0.025,
        "detail-iron",
      );
    for (let j = 0; j <= n; j++) {
      cyl(at(j / n, 1.15), 0.13, 0.19, 1.3, "iron", 8);
      cyl(at(j / n, 1.23, -0.65), 0.06, 0.06, 1.55, "iron", 8);
    }
    for (let j = 0; j < n; j++)
      for (const y of [1, 1.7])
        for (let k = 0; k < 6; k++)
          beam(
            at((j + k / 6) / n, y - Math.sin((k / 6) * Math.PI) * 0.3),
            at(
              (j + (k + 1) / 6) / n,
              y - Math.sin(((k + 1) / 6) * Math.PI) * 0.3,
            ),
            0.025,
            "detail-iron",
          );
  });
  const life = new THREE.TorusGeometry(0.38, 0.095, 6, 20);
  life.rotateY(1.18);
  add(life, [-91, 1.35, 618], "detail-orange");
  site.bollards.points.forEach(([x, z]) =>
    cyl([x, 1.05, z], 0.12, 0.19, 1.2, "iron", 8),
  );
  for (let i = 0; i < 4; i++) {
    const x = -71 + i * 2.2,
      z = 626 - i;
    cyl([x, 0.92, z], 0.22, 0.3, 0.75, "iron");
    add(new THREE.SphereGeometry(0.35, 10, 6), [x, 1.3, z], "iron");
  }
  // Neutral approach path with continuous joins along the mapped centreline.
  const ps = site.road.points;
  const offset = (w: number) =>
    ps.map((p, i) => {
      const a = ps[Math.max(0, i - 1)],
        b = ps[Math.min(ps.length - 1, i + 1)],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      return [p[0] - (dz / len) * w, p[1] + (dx / len) * w];
    });
  poly([...offset(3), ...offset(-3).reverse()], 0.51, 0.035, "road");
  box([-68, 4.6, 598], [0.85, 8, 0.3], "iron");
  box([-68, 4.7, 598.17], [0.55, 6.2, 0.04], "detail-sign");
  for (let i = 0; i < 10; i++)
    box([-68, 7.4 - i * 0.53, 598.2], [0.37, 0.08, 0.03], "detail-stone");
  // South-facing windows complement the existing warehouse model.
  buildingGeometry = true;
  const fa = [-88.3, 576.4],
    fb = [-65.7, 566.5],
    flen = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]),
    fx = (fb[0] - fa[0]) / flen,
    fz = (fb[1] - fa[1]) / flen;
  for (let u = 3; u < flen; u += 4.5)
    for (let y = 2.2; y < 19; y += 3.2) {
      const x = fa[0] + fx * u - 0.15 * fz,
        z = fa[1] + fz * u + 0.15 * fx;
      box([x, y, z], [1.7, 2.6, 0.12], "glass", -Math.atan2(fz, fx));
    }
  buildingGeometry = false;
  poly(site.grass.points, 0.38, 0.05, "grass");
  site.trees.forEach(([x, z], i) => {
    cyl([x, 3.2, z], 0.22, 0.4, 5.5, "bark", 7);
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(3 + (i % 2), 4.2, 3.3);
    add(g, [x, 6.8, z], i % 2 ? "leaf" : "leafLight");
  });
  return Object.fromEntries(
    Object.entries(parts).map(([m, gs]) => {
      const ns = gs.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute("uv");
        return n;
      });
      const merged = mergeGeometries(ns, false)!;
      new Set([...gs, ...ns]).forEach((g) => g.dispose());
      return [m, merged];
    }),
  );
}
export const KingsParade = memo(function KingsParade({
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
    joint: new THREE.Color(GROUND_COLOURS[night ? "night" : "day"])
      .multiplyScalar(0.88)
      .getStyle(),
    cobble: GROUND_COLOURS[night ? "night" : "day"],
    stone: GROUND_COLOURS[night ? "night" : "day"],
    flag: "#aaa18d",
    iron: "#2c3738",
    lamp: "#e4dabe",
    orange: "#ed8640",
    road: PATH_COLOURS[night ? "night" : "day"],
    yellow: "#d9b652",
    sign: "#475452",
    glass: "#668687",
    roof: "#666d6d",
    trim: "#81918c",
    wheel: "#e3ded1",
    grass: GRASS_COLOUR,
    bark: "#857968",
    leaf: "#687a57",
    leafLight: "#7e8e66",
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
        roughness={0.86}
        flatShading
        side={THREE.DoubleSide}
        emissive={m === "lamp" ? "#eedba7" : "#000000"}
        emissiveIntensity={night ? 0.5 : 0}
      />
    </mesh>
  );
  return (
    <group position={[origin[0], 0, origin[1]]}>
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => mesh(m, g))}
      <Detailed distances={[0, 300]} hysteresis={0.12}>
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

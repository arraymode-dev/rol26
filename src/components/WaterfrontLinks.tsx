import type { MapData } from "../types";
import { waterfrontRailings } from "../lib/waterfront-railings";
import { GRASS_COLOUR } from "../lib/palette";
import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/waterfront-links.json";

// Shared surroundings: deliberately independent of artwork numbering and placement.
export const WATERFRONT_BUILDINGS = [
  ...site.huts.map((h) => h.id),
  site.pilotage.id,
  site.warehouse.id,
  ...site.southBuildings.map((b) => b.id),
];
const origin = [-196, 239];
function build(data: MapData) {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const add = (g: THREE.BufferGeometry, p: number[], m: string, a = 0) => {
    g.rotateY(a);
    g.translate(p[0] - origin[0], p[1], p[2] - origin[1]);
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
    n = 8,
  ) => add(new THREE.CylinderGeometry(rt, rb, h, n), p, m);
  const beam = (a: number[], b: number[], r: number, m: string) => {
    const av = new THREE.Vector3(...(a as [number, number, number])),
      bv = new THREE.Vector3(...(b as [number, number, number]));
    const delta = bv.clone().sub(av);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), 6);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    add(g, av.add(bv).multiplyScalar(0.5).toArray(), m);
  };
  const poly = (ps: number[][], y: number, height: number, m: string) => {
    const shape = new THREE.Shape(ps.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    g.rotateX(-Math.PI / 2);
    add(g, [0, y, 0], m);
  };
  // OSM bridge centerline fixes the direction and span; width/elevation are estimates.
  const [a, b] = site.bridge.points,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  const along = (u: number, v: number, y: number) => [
    a[0] + (dx / len) * u - (dz / len) * v,
    y,
    a[1] + (dz / len) * u + (dx / len) * v,
  ];
  const angle = -Math.atan2(dz, dx);
  box(along(len / 2, 0, 1.02), [len, 0.28, 3.9], "deck", angle);
  for (const u of [0, len]) {
    box(along(u, 0, 0.58), [1.4, 0.82, 4.8], "stone", angle);
    box(along(u, 0, 1.17), [0.2, 0.025, 3.9], "detail-yellow", angle);
  }
  for (const v of [-1.95, 1.95]) {
    beam(along(0, v, 2.42), along(len, v, 2.42), 0.09, "iron");
    beam(along(0, v, 1.25), along(len, v, 1.25), 0.075, "iron");
    const n = Math.ceil(len / 2.1);
    for (let i = 0; i <= n; i++) {
      const u = (len * i) / n;
      beam(along(u, v, 1.15), along(u, v, 2.46), 0.07, "iron");
      if (i < n) {
        const next = (len * (i + 1)) / n;
        beam(along(u, v, 1.28), along(next, v, 2.35), 0.038, "detail-iron");
        beam(along(u, v, 2.35), along(next, v, 1.28), 0.038, "detail-iron");
      }
    }
  }
  // Two tall cross-braced portals and rust-coloured rods, as photographed.
  for (const u of [4, len - 4]) {
    for (const v of [-2.12, 2.12]) {
      box(along(u, v, 5.5), [0.2, 8.7, 0.24], "iron", angle);
      beam(
        along(u, v, 6.3),
        along(u === 4 ? 14 : len - 14, v, 1.25),
        0.05,
        "rod",
      );
    }
    for (const y of [6.35, 9.4])
      beam(along(u, -2.12, y), along(u, 2.12, y), 0.1, "iron");
    beam(along(u, -2.12, 6.35), along(u, 2.12, 9.4), 0.065, "iron");
    beam(along(u, 2.12, 6.35), along(u, -2.12, 9.4), 0.065, "iron");
  }
  const ring = new THREE.TorusGeometry(0.34, 0.09, 6, 16);
  ring.rotateY(angle + Math.PI / 2);
  add(ring, along(1.9, -2.04, 1.95), "detail-orange");

  buildingGeometry = true;
  // Retain the exact mapped octagonal footprints; roof types follow the photos.
  site.huts.forEach((hut, index) => {
    const ps = hut.points.slice(0, -1),
      cx = ps.reduce((s, p) => s + p[0], 0) / ps.length,
      cz = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    const expand = (factor: number) =>
      ps.map(([x, z]) => [cx + (x - cx) * factor, cz + (z - cz) * factor]);
    poly(expand(1.09), 0.44, 0.52, "stone");
    poly(ps, 0.96, 2.85, "stone");
    poly(expand(1.2), 3.81, 0.24, "trim");
    if (index === 0 || index === 2) {
      cyl([cx, 4.28, cz], 0.18, 0.35, 0.5, "trim");
      cyl([cx, 4.56, cz], 0.26, 0.21, 0.12, "trim");
      if (index === 2) {
        beam([cx, 4.6, cz], [cx, 5.7, cz], 0.025, "detail-iron");
        beam([cx - 0.5, 5.4, cz], [cx + 0.5, 5.4, cz], 0.025, "detail-iron");
        box([cx + 0.4, 5.47, cz], [0.22, 0.18, 0.035], "detail-iron");
        box([cx, 2.12, cz - 1.92], [1, 2.28, 0.06], "iron");
      }
    } else {
      cyl([cx, 4.45, cz], 0.45, 2.7, 0.8, "roof");
      cyl([cx, 4.98, cz], 0.24, 0.24, 0.5, "iron");
    }
    ps.forEach((p, i) => {
      const q = ps[(i + 1) % ps.length],
        ex = q[0] - p[0],
        ez = q[1] - p[1],
        length = Math.hypot(ex, ez);
      const mx = (p[0] + q[0]) / 2,
        mz = (p[1] + q[1]) / 2,
        rot = -Math.atan2(ez, ex);
      // Offset outward from each face so glass never disappears into its wall.
      const ox = (mx - cx) * 0.012,
        oz = (mz - cz) * 0.012,
        w = Math.min(1.25, length * 0.65);
      box([mx + ox, 2.35, mz + oz], [w, 1.55, 0.045], "glass", rot);
      for (const y of [1.55, 2.08, 2.64, 3.15])
        box(
          [mx + ox * 1.8, y, mz + oz * 1.8],
          [w + 0.1, 0.06, 0.065],
          "detail-iron",
          rot,
        );
      for (const t of [-0.5, 0, 0.5])
        box(
          [
            mx + ox * 1.8 + (ex / length) * w * t,
            2.35,
            mz + oz * 1.8 + (ez / length) * w * t,
          ],
          [0.06, 1.65, 0.065],
          "detail-iron",
          rot,
        );
      for (const y of [1.05, 1.45, 3.4, 3.72])
        box([mx + ox, y, mz + oz], [length, 0.015, 0.02], "detail-joint", rot);
    });
  });
  // Pilotage building: red brick backdrop with a simplified dark roof.
  poly(site.pilotage.points, 0.45, 10.2, "brick");
  poly(site.pilotage.points, 10.65, 0.35, "roof");
  const ps = site.pilotage.points;
  for (let i = 0; i < ps.length - 1; i++) {
    const p = ps[i],
      q = ps[i + 1],
      dx = q[0] - p[0],
      dz = q[1] - p[1],
      l = Math.hypot(dx, dz),
      a = -Math.atan2(dz, dx);
    if (l < 6) continue;
    for (let j = 2; j < l - 1; j += 3.5)
      for (const y of [2.7, 6.1, 8.7]) {
        box(
          [p[0] + (dx * j) / l, y, p[1] + (dz * j) / l],
          [1.2, 1.8, 0.11],
          "glass",
          a,
        );
        box(
          [p[0] + (dx * j) / l, y - 1, p[1] + (dz * j) / l],
          [1.45, 0.16, 0.18],
          "detail-trim",
          a,
        );
      }
  }
  buildingGeometry = false;
  // Waiting... is an existing civic sculpture, not a festival installation.
  const [hx, hz] = site.horse.point;
  box([hx, 0.61, hz], [4.5, 0.35, 2.8], "stone", 0.2);
  box([hx, 0.84, hz + 1.04], [4, 0.16, 0.72], "plaque", 0.2);
  const horse = (
    p: number[],
    scale: [number, number, number],
    m = "bronze",
    rot = 0,
  ) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(...scale);
    add(g, [hx + p[0], p[1], hz + p[2]], m, rot);
  };
  horse([0, 2.53, 0], [1.25, 0.66, 0.54]);
  horse([-0.86, 2.98, 0], [0.49, 0.87, 0.43], "bronze", 0);
  horse([-1.25, 3.66, 0], [0.47, 0.38, 0.32]);
  horse([-1.59, 3.4, 0], [0.28, 0.26, 0.3]);
  for (const z of [-0.24, 0.24]) {
    horse([-1.12, 4.08, z], [0.11, 0.3, 0.09]);
    for (const x of [-0.73, 0.85]) {
      beam(
        [hx + x, 2.38, hz + z],
        [hx + x + 0.08, 1.57, hz + z],
        0.14,
        "bronze",
      );
      beam(
        [hx + x + 0.08, 1.57, hz + z],
        [hx + x - 0.08, 0.99, hz + z],
        0.1,
        "bronze",
      );
      horse([x - 0.13, 0.98, z], [0.23, 0.17, 0.18]);
    }
  }
  beam([hx + 1.02, 2.85, hz], [hx + 1.53, 2.2, hz], 0.16, "bronze");
  beam([hx + 1.53, 2.2, hz], [hx + 1.45, 1.47, hz], 0.11, "bronze");
  for (const z of [-0.53, 0.53])
    beam(
      [hx - 0.85, 2.82, hz + z],
      [hx + 0.7, 2.82, hz + z],
      0.05,
      "detail-harness",
    );
  horse([-0.76, 2.63, 0], [0.2, 0.72, 0.6], "detail-harness");
  horse([0.37, 2.64, 0], [0.08, 0.67, 0.57], "detail-harness");

  // Follow the actual quay perimeter, with openings at the bridge landing.
  waterfrontRailings(data, site.bridge.points).forEach(([a, b]) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const y of [0.3, 1.2])
      beam([a[0], y, a[1]], [b[0], y, b[1]], 0.045, "iron");
    const n = Math.ceil(length / 0.45);
    for (let j = 0; j <= n; j++)
      beam(
        [a[0] + ((b[0] - a[0]) * j) / n, -0.04, a[1] + ((b[1] - a[1]) * j) / n],
        [a[0] + ((b[0] - a[0]) * j) / n, 1.25, a[1] + ((b[1] - a[1]) * j) / n],
        0.022,
        "detail-iron",
      );
  });
  const lamp = (x: number, z: number) => {
    cyl([x, 0.25, z], 0.2, 0.3, 0.5, "iron");
    cyl([x, 2.1, z], 0.065, 0.12, 3.4, "iron");
    cyl([x, 4.02, z], 0.3, 0.18, 0.66, "detail-lamp", 4);
    cyl([x, 4.43, z], 0, 0.43, 0.3, "iron", 4);
    cyl([x, 4.67, z], 0.055, 0.055, 0.25, "iron");
    for (const dx of [-0.16, 0.16])
      for (const dz of [-0.16, 0.16])
        beam(
          [x + dx, 3.68, z + dz],
          [x + dx * 1.65, 4.35, z + dz * 1.65],
          0.025,
          "detail-iron",
        );
  };
  [
    [-200, 217],
    [-205.6, 231],
    [-217.4, 245],
    [-204.3, 251],
    [-197, 271],
  ].forEach(([x, z]) => lamp(x, z));
  box([-198.8, 3.2, 220], [1.1, 5.5, 0.23], "iron", 0.3);
  // Abstract colour patches suggest stickers without reproducing logos or adding text.
  for (let i = 0; i < 28; i++)
    box(
      [-199.17 + (i % 4) * 0.21, 1.1 + Math.floor(i / 4) * 0.31, 220.13],
      [0.14, 0.16, 0.025],
      i % 3 === 0 ? "detail-orange" : "detail-trim",
      0.3,
    );
  // Small cobbled pad sits on land around the mapped horse, clear of the crossing.
  box([hx, 0.475, hz], [8, 0.035, 6], "cobble");
  for (let row = 0; row < 15; row++)
    for (let col = 0; col < 16; col++)
      box(
        [
          hx - 3.8 + col * 0.49 + (row % 2) * 0.12,
          0.502,
          hz - 2.8 + row * 0.39,
        ],
        [0.44, 0.02, 0.33],
        (row + col) % 3 === 0 ? "detail-stone" : "detail-cobble",
      );
  // Second shared batch: mapped lawn and civic monuments south of the bridge.
  poly(site.lawn.points, 0.5, 0.04, "grass");
  const [cx, cz] = site.emptyCircle.point;
  cyl([cx, 0.57, cz], 3.1, 3.1, 0.06, "cobble", 48);
  for (let r = 0.6; r < 3; r += 0.42) {
    const n = Math.ceil((2 * Math.PI * r) / 0.48);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      box(
        [cx + r * Math.cos(a), 0.61, cz + r * Math.sin(a)],
        [0.38, 0.018, 0.3],
        "detail-stone",
        -a,
      );
    }
  }
  // Faceted silhouettes convey the photographed poses; these are not portrait models.
  const ellipsoid = (
    p: number[],
    size: [number, number, number],
    m = "statue",
  ) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(...size);
    add(g, p, m);
  };
  const figure = (
    x: number,
    z: number,
    base: number,
    scale: number,
    reach: boolean,
  ) => {
    const p = (dx: number, y: number, dz: number) => [
      x + dx * scale,
      base + y * scale,
      z + dz * scale,
    ];
    const limb = (a: number[], b: number[], r: number) =>
      beam(
        p(...(a as [number, number, number])),
        p(...(b as [number, number, number])),
        r * scale,
        "statue",
      );
    ellipsoid(p(0, 1.52, 0), [0.3 * scale, 0.5 * scale, 0.19 * scale]);
    ellipsoid(p(0, 2.17, 0), [0.2 * scale, 0.27 * scale, 0.2 * scale]);
    ellipsoid(
      p(-0.025, 2.38, -0.015),
      [0.21 * scale, 0.12 * scale, 0.2 * scale],
      "detail-hair",
    );
    limb([-0.17, 1.16, 0], [-0.28, 0.59, 0.04], 0.14);
    limb([-0.28, 0.59, 0.04], [-0.2, 0.1, 0.13], 0.11);
    limb([0.17, 1.16, 0], [0.2, 0.59, 0], 0.15);
    limb([0.2, 0.59, 0], [0.28, 0.1, -0.13], 0.11);
    ellipsoid(p(-0.2, 0.08, 0.23), [0.14 * scale, 0.1 * scale, 0.27 * scale]);
    ellipsoid(p(0.28, 0.08, -0.03), [0.14 * scale, 0.1 * scale, 0.27 * scale]);
    if (reach) {
      limb([-0.27, 1.82, 0], [-0.57, 1.37, 0.07], 0.1);
      limb([-0.57, 1.37, 0.07], [-0.94, 1.24, 0.16], 0.085);
      limb([0.27, 1.83, 0], [0.48, 1.65, 0.3], 0.11);
      limb([0.48, 1.65, 0.3], [0.43, 2, 0.65], 0.085);
      ellipsoid(p(0.43, 2.03, 0.66), [0.09 * scale, 0.13 * scale, 0.1 * scale]);
    } else {
      limb([-0.28, 1.8, 0], [-0.37, 1.1, 0.08], 0.09);
      limb([0.28, 1.8, 0], [0.48, 1.22, 0.12], 0.09);
    }
  };
  const [fx, fz] = site.billyFury.point;
  cyl([fx, 0.88, fz], 1.05, 1.05, 0.68, "stone", 40);
  cyl([fx, 1.23, fz], 0.99, 0.99, 0.04, "plaque", 40);
  figure(fx, fz, 1.25, 1.05, true);
  box([fx - 0.42, 1.27, fz + 0.64], [0.5, 0.035, 0.28], "detail-plaque");
  const [lx, lz] = site.legacy.point;
  cyl([lx, 0.59, lz], 2, 2, 0.12, "cobble", 32);
  box([lx, 0.84, lz], [2.2, 0.43, 1.5], "stone");
  figure(lx - 0.5, lz, 1.07, 1, false);
  figure(lx + 0.4, lz + 0.1, 1.07, 0.87, false);
  figure(lx + 0.85, lz + 0.47, 1.07, 0.52, false);
  for (const [x, z] of [
    [-198, 304],
    [-199, 310],
    [-200, 316],
  ]) {
    box([x, 0.53, z], [0.65, 0.13, 1.9], "detail-timber");
    box([x + 0.28, 0.9, z], [0.12, 0.62, 1.9], "detail-timber");
    for (const dz of [-0.64, 0.64])
      box([x, 0.25, z + dz], [0.52, 0.5, 0.08], "detail-iron");
  }
  // Third shared batch: elevations follow the photos; footprints remain mapped.
  const facade = (
    a: number[],
    b: number[],
    levels: number[],
    cream = false,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    const angle = -Math.atan2(dz, dx);
    const count = Math.max(1, Math.floor(len / 3));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = a[0] + dx * t,
        z = a[1] + dz * t;
      for (const y of levels) {
        box([x, y, z], [1.4, 1.9, 0.18], cream ? "trim" : "iron", angle);
        box([x, y, z], [1.19, 1.68, 0.2], "glass", angle);
        for (const yy of [y - 0.84, y, y + 0.84])
          box(
            [x, yy, z],
            [1.4, 0.065, 0.23],
            cream ? "detail-trim" : "detail-iron",
            angle,
          );
        box(
          [x, y, z],
          [0.065, 1.9, 0.23],
          cream ? "detail-trim" : "detail-iron",
          angle,
        );
        box([x, y - 1.02, z], [1.6, 0.15, 0.28], "detail-stone", angle);
      }
    }
  };
  buildingGeometry = true;
  site.southBuildings.forEach((building, index) => {
    const height = index === 0 ? 9.2 : 6.8;
    poly(building.points, 0.45, height, "brick");
    poly(building.points, 0.45 + height, 0.18, "roof");
    const ps = building.points.slice(0, -1),
      x = ps.reduce((s, p) => s + p[0], 0) / ps.length,
      z = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    box([x, height + 1.4, z], [1.1, 2.2, 0.9], "brick", 0.37);
    for (const dx of [-0.27, 0.27])
      cyl([x + dx, height + 2.75, z], 0.14, 0.17, 0.55, "detail-terracotta");
    if (index === 0 || index === 3) {
      // A hipped roof built on the footprint, inset to a short central ridge.
      const positions: number[] = [];
      ps.forEach((p, i) => {
        const q = ps[(i + 1) % ps.length];
        positions.push(
          p[0],
          height + 0.65,
          p[1],
          q[0],
          height + 0.65,
          q[1],
          x,
          height + 2.15,
          z,
        );
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      g.computeVertexNormals();
      add(g, [0, 0, 0], "roof");
    }
    ps.forEach((p, i) => {
      const q = ps[(i + 1) % ps.length],
        dx = q[0] - p[0],
        dz = q[1] - p[1];
      const len = Math.hypot(dx, dz);
      for (let y = 0.9; y < height; y += 0.36)
        box(
          [(p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2],
          [len, 0.012, 0.025],
          "detail-mortar",
          -Math.atan2(dz, dx),
        );
      if (len > 6)
        facade(
          p,
          q,
          index === 0 ? [2, 5, 8] : [2, 5.2],
          index === 0 || index === 3,
        );
    });
  });
  // Mermaid House door and red nameboard on its courtyard-facing elevation.
  box([-187.3, 1.7, 328.7], [0.12, 2.5, 1.15], "iron", 0.37);
  box([-188.1, 3.9, 326.8], [0.16, 0.48, 4.1], "signRed", 0.37);
  // Stair rises along the courtyard wing, with open risers and slim handrails.
  const stairAngle = 0.37;
  const step = (u: number, v: number, y: number) => [
    -175 - Math.cos(stairAngle) * u + Math.sin(stairAngle) * v,
    y,
    319.9 + Math.sin(stairAngle) * u + Math.cos(stairAngle) * v,
  ];
  for (let i = 0; i < 16; i++) {
    box(
      step(i * 0.28, 0, 0.6 + i * 0.22),
      [0.3, 0.075, 1.15],
      "iron",
      stairAngle,
    );
    if (i % 3 === 0)
      for (const v of [-0.57, 0.57])
        beam(
          step(i * 0.28, v, 0.6 + i * 0.22),
          step(i * 0.28, v, 1.55 + i * 0.22),
          0.035,
          "detail-iron",
        );
  }
  for (const v of [-0.57, 0.57]) {
    beam(step(0, v, 0.48), step(4.3, v, 3.84), 0.095, "iron");
    beam(step(0, v, 1.55), step(4.3, v, 4.91), 0.04, "iron");
  }
  box(step(4.85, 0, 3.9), [1.2, 0.18, 1.3], "iron", stairAngle);
  for (const u of [4.3, 5.4])
    beam(step(u, 0.55, 0.5), step(u, 0.55, 3.9), 0.065, "iron");

  // Warehouse silhouette replaces the generic extrusion and retains its footprint.
  poly(site.warehouse.points, 0.45, site.warehouse.height, "brick");
  poly(site.warehouse.points, site.warehouse.height + 0.45, 0.24, "roof");
  facade([-184.5, 344.5], [-153, 332.3], [2.8, 6.1, 9.4, 12.7, 16, 18.8]);
  facade([-153, 332.3], [-140.5, 363.7], [2.8, 6.1, 9.4, 12.7, 16, 18.8]);
  buildingGeometry = false;
  // Simple dock crane and red corner column are recognisable close-view details.
  cyl([-153.25, 2.4, 332.3], 0.42, 0.5, 3.8, "signRed");
  beam([-164, 5, 336.4], [-165, 8.5, 333.4], 0.11, "detail-iron");
  beam([-165, 8.5, 333.4], [-161.5, 8.5, 332], 0.1, "detail-iron");
  beam([-161.5, 8.5, 332], [-161.5, 5.8, 332], 0.028, "detail-iron");

  // Existing Liverpool Mountain landmark: five touching irregular coloured rocks.
  const [mx, mz] = site.mountain.point;
  const rocks: [number, number, number, number, string][] = [
    [1.72, 1.45, 1.4, 1.25, "rockPink"],
    [4.04, 1.72, 1.2, 1.3, "rockRed"],
    [6.22, 1.38, 1.15, 1.22, "rockOrange"],
    [8.63, 1.43, 1.5, 1.1, "rockLime"],
    [10.47, 2.35, 0.75, 1.35, "rockBlue"],
  ];
  rocks.forEach(([y, sx, sy, sz, m], i) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.getAttribute("position");
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j),
        yy = p.getY(j),
        z = p.getZ(j);
      const f = 1 + 0.09 * Math.sin(x * 8 + yy * 5 + z * 7 + i * 2);
      p.setXYZ(j, x * sx * f, yy * sy * f, z * sz * f);
    }
    g.computeVertexNormals();
    add(g, [mx + (i % 2 ? 0.08 : -0.08), y, mz], m, i * 0.38);
  });

  const [ha, hb] = site.hartleyBridge.points;
  const hdx = hb[0] - ha[0],
    hdz = hb[1] - ha[1],
    hl = Math.hypot(hdx, hdz);
  const hp = (u: number, v: number, y: number) => [
    ha[0] + (hdx * u) / hl - (hdz * v) / hl,
    y,
    ha[1] + (hdz * u) / hl + (hdx * v) / hl,
  ];
  const hAngle = -Math.atan2(hdz, hdx);
  box(hp(hl / 2, 0, 0.78), [hl, 0.25, 5.2], "deck", hAngle);
  for (const v of [-1.35, 1.35])
    box(hp(hl / 2, v, 0.98), [hl, 0.16, 0.18], "white", hAngle);
  // Rails bow out at their foot and draw inward above, as in both bridge views.
  for (const side of [-1, 1]) {
    for (const [v, y] of [
      [2.6, 0.88],
      [2.52, 1.25],
      [2.38, 1.65],
      [2.23, 2.04],
    ])
      beam(hp(0, side * v, y), hp(hl, side * v, y), 0.045, "iron");
    for (let u = 0; u <= hl; u += 1.4) {
      beam(hp(u, side * 2.6, 0.88), hp(u, side * 2.52, 1.25), 0.065, "iron");
      beam(hp(u, side * 2.52, 1.25), hp(u, side * 2.23, 2.04), 0.065, "iron");
    }
  }
  for (const u of [-1, hl + 1])
    for (const v of [-2.8, 0, 2.8]) cyl(hp(u, v, 1.1), 0.14, 0.19, 1.2, "iron");
  // One multi-face dock totem, using abstract panels to avoid unreadable tiny text.
  box([-152, 0.69, 315], [1.3, 0.4, 0.5], "iron", hAngle);
  box([-152, 2.09, 315], [1.2, 2.4, 0.34], "iron", hAngle);
  box([-152, 3.5, 315], [1.34, 0.35, 0.43], "iron", hAngle);
  for (const side of [-1, 1]) {
    const off = (y: number, d: number) => [
      -152 + Math.sin(hAngle) * d * side,
      y,
      315 + Math.cos(hAngle) * d * side,
    ];
    box(off(1.8, 0.178), [0.91, 1.02, 0.018], "detail-trim", hAngle);
    box(off(1.85, 0.195), [0.68, 0.62, 0.015], "detail-mapBlue", hAngle);
    for (const y of [2.55, 2.75, 2.95])
      box(off(y, 0.19), [0.88, 0.025, 0.018], "detail-trim", hAngle);
  }

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
export const WaterfrontLinks = memo(function WaterfrontLinks({
  night,
  data,
}: {
  night: boolean;
  data: MapData;
}) {
  const parts = useMemo(() => build(data), [data]);
  useEffect(
    () => () => Object.values(parts).forEach((g) => g.dispose()),
    [parts],
  );
  const colors: Record<string, string> = {
    white: "#e1ded3",
    signRed: "#863f3d",
    mapBlue: "#55a6be",
    rockPink: "#e980ad",
    rockRed: "#fa633c",
    rockOrange: "#ffac20",
    rockLime: "#dfed9c",
    rockBlue: "#2878ad",
    stone: "#b6ad96",
    trim: "#d1c6ad",
    roof: "#766f60",
    iron: "#303a3a",
    rod: "#b37c48",
    deck: "#747875",
    yellow: "#d9b64a",
    orange: "#e5793c",
    glass: "#536566",
    brick: "#9c614b",
    bronze: "#6c8673",
    statue: "#626b61",
    hair: "#444e49",
    grass: GRASS_COLOUR,
    timber: "#82755f",
    terracotta: "#b29066",
    mortar: "#aa8871",
    harness: "#475e50",
    plaque: "#a89570",
    joint: "#847d6b",
    lamp: "#ecdfbf",
    cobble: "#aaa18b",
  };
  const mesh = (m: string, g: THREE.BufferGeometry) => (
    <mesh key={m} geometry={g} castShadow receiveShadow>
      <meshStandardMaterial
        color={colors[m.replace("detail-", "")]}
        roughness={0.87}
        flatShading
        side={THREE.DoubleSide}
        emissive={m === "detail-lamp" ? "#ffe1a3" : "#000000"}
        emissiveIntensity={night ? 0.7 : 0}
      />
    </mesh>
  );
  return (
    <group position={[origin[0], 0, origin[1]]}>
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => mesh(m, g))}
      <Detailed distances={[0, 260]} hysteresis={0.12}>
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

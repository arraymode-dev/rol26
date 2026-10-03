import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/cunard-forecourt.json";

export const CUNARD = {
  x: -179.45,
  z: -153.45,
  rotation: -Math.atan2(49.1, 28.7),
};
const c = Math.cos(CUNARD.rotation),
  s = Math.sin(CUNARD.rotation);
const local = ([x, z]: number[]) => {
  const dx = x - CUNARD.x,
    dz = z - CUNARD.z;
  return [c * dx - s * dz, s * dx + c * dz];
};
const treeKeys = new Set(site.trees.map((p) => p.join(",")));
export const isCunardTree = (p: number[]) => treeKeys.has(p.join(","));

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
  const orb = (p: number[], size: [number, number, number], m: string) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(...size);
    add(g, p, m);
  };
  const cylinder = (
    p: number[],
    top: number,
    bottom: number,
    h: number,
    m: string,
  ) => add(new THREE.CylinderGeometry(top, bottom, h, 10), p, m);
  const line = (
    a: number[],
    b: number[],
    w: number,
    h: number,
    y: number,
    m: string,
  ) => {
    box(
      [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
      [Math.hypot(b[0] - a[0], b[1] - a[1]), h, w],
      m,
      -Math.atan2(b[1] - a[1], b[0] - a[0]),
    );
  };
  buildingGeometry = true;
  const poly = new THREE.Shape(
    site.building.points.map((p) => {
      const [x, z] = local(p);
      return new THREE.Vector2(x, -z);
    }),
  );
  const court = [
    [-9, 32],
    [9, 32],
    [9, 61],
    [-9, 61],
    [-9, 32],
  ];
  const courtPoints = court.map(([x, z]) => new THREE.Vector2(x, -z));
  if (THREE.ShapeUtils.isClockWise(courtPoints)) courtPoints.reverse();
  poly.holes.push(new THREE.Path(courtPoints));
  const body = new THREE.ExtrudeGeometry(poly, {
    depth: 34,
    bevelEnabled: false,
  });
  body.rotateX(-Math.PI / 2);
  add(body, [0, 0.6, 0], "stone");
  box([0, 12, 46.5], [18, 1, 29], "stone");
  const outline = site.building.points.map(local);
  for (const ring of [outline, court])
    for (let i = 1; i < ring.length; i++) {
      line(ring[i - 1], ring[i], 0.8, 1.8, 35.1, "trim");
      line(ring[i - 1], ring[i], 1.2, 0.5, 34.1, "trim");
    }
  for (const x of [-16, 16]) {
    box([x, 36.3, 46.5], [9, 3.4, 43], "stone");
    box([x, 38.1, 46.5], [9.6, 0.4, 43.6], "trim");
    for (const z of [28, 40, 53, 66]) box([x, 39.1, z], [2.8, 2, 2.3], "stone");
  }
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i - 1],
      b = outline[i];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 10 || Math.max(a[1], b[1]) < 2) continue;
    for (const y of [12.1, 28.6]) line(a, b, 0.7, 0.6, y, "trim");
    const n = Math.floor(len / 4);
    for (let j = 0; j < n; j++)
      for (let row = 0; row < 6; row++) {
        const t = (j + 0.5) / n;
        box(
          [a[0] + dx * t, 6 + row * 4.4, a[1] + dz * t],
          [1.8, 2.6, 0.3],
          "glass",
          -Math.atan2(dz, dx),
        );
      }
  }
  // The map footprint is authoritative; the photographed east elevation is interpreted in local coordinates.
  for (const [y, h, depth] of [
    [2.4, 0.65, 0.5],
    [12.1, 0.75, 1],
    [14, 0.45, 0.7],
    [28.6, 0.8, 1],
    [33.9, 1.1, 1.5],
  ])
    box([0, y, -depth / 2], [57, h, depth], "trim");
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 15; col++) {
      const x = -26 + col * 3.72,
        y = 16.5 + row * 3.45;
      box([x, y, -0.14], [1.75, 2.45, 0.18], "glass");
      for (const dx of [-0.93, 0.93])
        box([x + dx, y, -0.3], [0.16, 2.7, 0.22], "trim");
      box([x, y - 1.32, -0.42], [2.2, 0.2, 0.5], "trim");
      box([x, y, -0.27], [0.055, 2.5, 0.13], "detail-frame");
      box([x, y, -0.27], [1.8, 0.06, 0.13], "detail-frame");
    }
  for (let y = 3; y < 12; y += 0.75)
    box([0, y, -0.08], [57, 0.065, 0.12], "detail-joint");
  for (let row = 0; row < 12; row++)
    for (let x = -28 + (row % 2) * 1.55; x < 28; x += 3.1)
      box([x, 3.2 + row * 0.75, -0.085], [0.045, 0.69, 0.13], "detail-joint");
  const arch = (
    x: number,
    w: number,
    h: number,
    y: number,
    m: string,
    z: number,
  ) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h - w / 2);
    shape.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
    shape.lineTo(-w / 2, 0);
    add(new THREE.ShapeGeometry(shape), [x, y, z], m);
  };
  for (const x of [-24, -18, -12, 12, 18, 24]) {
    arch(x, 3.45, 7.8, 3, "trim", -0.16);
    arch(x, 2.95, 7.25, 3.25, "glass", -0.19);
    box([x, 6.5, -0.25], [0.1, 6.5, 0.1], "detail-frame");
    box([x, 7.7, -0.25], [3, 0.12, 0.1], "detail-frame");
    box([x, 2.6, -0.25], [3.6, 0.35, 0.7], "trim");
  }
  arch(0, 7.7, 11, 2, "trim", -0.22);
  arch(0, 6.2, 9.7, 2.3, "door", -0.24);
  box([0, 6, -0.32], [0.12, 7.5, 0.2], "detail-frame");
  buildingGeometry = false;
  // Entrance steps and the globe lamps on rusticated stone pedestals.
  for (let i = 0; i < 8; i++)
    box(
      [0, 0.58 + i * 0.23, -3.7 + i * 0.38],
      [8, 0.25, 7.6 - i * 0.76],
      "detail-trim",
    );
  for (const x of [-5.4, 5.4]) {
    box([x, 1.4, -3], [1.65, 1.9, 1.65], "detail-stone");
    box([x, 2.45, -3], [2, 0.28, 2], "detail-trim");
    cylinder([x, 3.9, -3], 0.12, 0.2, 2.6, "detail-metal");
    orb([x, 5.35, -3], [0.43, 0.52, 0.43], "detail-lamp");
    cylinder([x, 5.9, -3], 0.08, 0.25, 0.25, "detail-metal");
  }
  // Patterned forecourt: alternating narrow light and dark stone strips.
  box([-12, 0.51, -11], [84, 0.06, 20], "paving");
  for (let x = -53; x < 30; x += 1.15)
    box([x, 0.555, -13.6], [0.47, 0.024, 14], "detail-stripe");
  for (const z of [-4, -9, -20.8])
    box([-12, 0.575, z], [84, 0.035, 0.26], "detail-trim");
  for (let x = -52; x < 30; x += 1.15)
    for (let z = -19; z < -8; z += 2.6)
      box(
        [x, 0.573, z + (Math.round(x / 1.15) % 2) * 0.45],
        [0.48, 0.008, 0.025],
        "detail-joint",
      );
  // Actual mapped bench runs; small metal inlays and anti-skate tabs are photo-informed.
  for (const run of site.benches)
    for (let i = 1; i < run.points.length; i++) {
      const a = local(run.points[i - 1]),
        b = local(run.points[i]),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.ceil(len / 1.7),
        ang = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        box([x, 0.91, z], [len / n - 0.025, 0.69, 1.1], "detail-bench", ang);
        box([x, 0.6, z], [(len / n) * 0.6, 0.15, 0.6], "detail-metal", ang);
        for (const dx of [-0.28, 0, 0.28])
          box(
            [x + dx * Math.cos(ang), 1.266, z - dx * Math.sin(ang)],
            [0.045, 0.018, 0.72],
            "detail-metal",
            ang,
          );
        box([x, 1.28, z + 0.49], [0.06, 0.07, 0.17], "detail-metal", ang);
      }
    }
  // Tiered municipal planters are street furniture, not the Coloured Peonies artwork.
  for (const [index, x] of [-43, -25, -6, 18].entries()) {
    const z = -8.7;
    box([x, 1.1, z], [1.55, 1.15, 1.55], "detail-metal");
    box([x, 1.35, z], [1.58, 0.045, 1.58], "detail-gold");
    for (let tier = 0; tier < 4; tier++) {
      const y = 1.7 + tier * 0.62,
        r = 0.82 - tier * 0.13;
      cylinder([x, y, z], r, r * 0.65, 0.5, "detail-metal");
      orb([x, y + 0.2, z], [r * 0.95, 0.28, r * 0.95], "detail-leaves");
      for (let j = 0; j < 10; j++) {
        const a = (j * Math.PI) / 5 + tier * 0.37 + index;
        orb(
          [x + Math.cos(a) * r, y + 0.12 - (j % 3) * 0.12, z + Math.sin(a) * r],
          [0.22, 0.27, 0.22],
          j % 3 ? "detail-red" : "detail-white",
        );
      }
    }
  }
  site.trees.forEach((p, i) => {
    const [x, z] = local(p),
      h = 8.7 + (i % 3) * 0.6;
    box([x, 0.57, z], [1.7, 0.09, 1.7], "detail-grate");
    cylinder([x, 2.35, z], 0.15, 0.22, 4, "bark");
    orb([x, h * 0.65, z], [2.2, h * 0.4, 2.1], i % 2 ? "leaves" : "leaf-light");
    orb([x + 0.3, h * 0.9, z], [1.2, h * 0.21, 1.25], "leaves");
    for (const dz of [-1.3, 1.3])
      box([x, 0.63, z + dz], [0.95, 0.035, 0.13], "detail-lamp");
  });
  // Basement railings, spaced posts and small rectangular panes.
  for (const [a, b] of [
    [-28, -6],
    [6, 28],
  ]) {
    box([(a + b) / 2, 1.12, -1.4], [b - a, 1.25, 0.15], "detail-stone");
    for (let x = a; x <= b; x += 2.2) {
      box([x, 1.9, -1.4], [0.13, 1.1, 0.14], "detail-metal");
      box([x + 1, 1.8, -1.4], [1.65, 0.06, 0.08], "detail-metal");
      box([x + 1, 1.5, -1.4], [1.65, 0.06, 0.08], "detail-metal");
    }
    for (const y of [1.35, 2.35])
      box([(a + b) / 2, y, -1.4], [b - a, 0.09, 0.12], "detail-metal");
  }
  // Wayfinding totem and a slatted timber seat at the outer edge of the forecourt.
  box([26, 2, -12], [1.25, 2.85, 0.32], "detail-metal");
  box([26, 2.2, -12.18], [1, 0.96, 0.035], "detail-map");
  box([26, 3.15, -12.19], [0.9, 0.08, 0.02], "detail-white");
  for (let i = 0; i < 7; i++)
    box(
      [-12, 0.85 + i * 0.035, -18.9 + i * 0.105],
      [2.4, 0.055, 0.09],
      "detail-wood",
    );
  for (let i = 0; i < 7; i++)
    box(
      [-12, 1.17 + i * 0.115, -18.15 + i * 0.025],
      [2.4, 0.095, 0.065],
      "detail-wood",
    );
  for (const x of [-12.9, -11.1])
    cylinder([x, 0.72, -18.55], 0.08, 0.09, 0.5, "detail-metal");
  box([-12, 1.12, -18.5], [0.07, 0.42, 0.65], "detail-metal");
  for (const x of [-43, -10, 23]) {
    cylinder([x, 4.65, -21], 0.075, 0.14, 8.2, "detail-metal");
    for (const dx of [-1.15, 1.15]) {
      orb([x + dx, 8.8, -21], [0.8, 0.08, 0.3], "detail-metal");
      orb([x + dx, 8.76, -21], [0.62, 0.05, 0.2], "detail-lamp");
    }
    box([x, 8.77, -21], [3, 0.08, 0.09], "detail-metal");
  }
  return Object.fromEntries(
    Object.entries(parts).map(([m, gs]) => {
      const ns = gs.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute("uv");
        return n;
      });
      const merged = mergeGeometries(ns)!;
      new Set([...gs, ...ns]).forEach((g) => g.dispose());
      return [m, merged];
    }),
  );
}
export const CunardForecourt = memo(function CunardForecourt({
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
    stone: "#c7c3b5",
    trim: "#e4dfce",
    glass: "#647b7c",
    door: "#454f4d",
    frame: "#b1b7ae",
    joint: "#aaa89b",
    paving: "#929c95",
    stripe: "#afb5ab",
    bench: "#d7dbd4",
    metal: "#303c3b",
    gold: "#bbad78",
    leaves: "#45643e",
    "leaf-light": "#627e4b",
    bark: "#796c54",
    red: "#d35155",
    white: "#eee7dc",
    lamp: "#ede2c9",
    wood: "#a9a28d",
    grate: "#5a6057",
    map: "#83a5ad",
  };
  const render = (m: string, g: THREE.BufferGeometry) => (
    <mesh key={m} geometry={g} castShadow receiveShadow>
      <meshStandardMaterial
        color={colors[m.replace("detail-", "")]}
        side={THREE.DoubleSide}
        roughness={0.9}
        flatShading
        emissive={m === "detail-lamp" ? "#ffe5b5" : "#000000"}
        emissiveIntensity={night ? 0.7 : 0}
      />
    </mesh>
  );
  return (
    <group
      position={[CUNARD.x, 0, CUNARD.z]}
      rotation={[0, CUNARD.rotation, 0]}
    >
      {Object.entries(parts)
        .filter(([m]) => !m.startsWith("detail-"))
        .map(([m, g]) => render(m, g))}
      <Detailed distances={[0, 190]} hysteresis={0.12}>
        <group>
          {Object.entries(parts)
            .filter(([m]) => m.startsWith("detail-"))
            .map(([m, g]) => render(m, g))}
        </group>
        <group />
      </Detailed>
    </group>
  );
});

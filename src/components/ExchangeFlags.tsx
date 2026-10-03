import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import footprint from "../data/exchange-flags.json";

// Monument anchored to saved OSM node 880178527. Other dimensions are photo studies.
export const EXCHANGE = { x: -1.59, z: -398.48, rotation: 0.486 };
function local([x, z]: number[]) {
  const dx = x - EXCHANGE.x,
    dz = z - EXCHANGE.z,
    c = Math.cos(EXCHANGE.rotation),
    s = Math.sin(EXCHANGE.rotation);
  return new THREE.Vector2(dx * c - dz * s, -(dx * s + dz * c));
}
function buildSquare() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const add = (
    g: THREE.BufferGeometry,
    p: number[],
    material: string,
    angle = 0,
  ) => {
    g.rotateY(angle);
    g.translate(...(p as [number, number, number]));
    markBuildingGeometry(g, buildingGeometry);
    (parts[material] ??= []).push(g);
  };
  const box = (
    p: number[],
    s: [number, number, number],
    m: string,
    angle = 0,
  ) => add(new THREE.BoxGeometry(...s), p, m, angle);
  const cyl = (p: number[], r: number, h: number, m: string) =>
    add(new THREE.CylinderGeometry(r, r, h, 20), p, m);
  const orb = (p: number[], s: [number, number, number], m: string) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(...s);
    add(g, p, m);
  };
  buildingGeometry = true;
  const shape = new THREE.Shape(footprint.outer.map(local));
  shape.holes.push(new THREE.Path(footprint.inner.map(local)));
  const building = new THREE.ExtrudeGeometry(shape, {
    depth: 34,
    bevelEnabled: false,
  });
  building.rotateX(-Math.PI / 2);
  add(building, [0, 0, 0], "stone");
  buildingGeometry = false;
  const paving = new THREE.ShapeGeometry(
    new THREE.Shape(footprint.plaza.map(local)),
  );
  paving.rotateX(-Math.PI / 2);
  add(paving, [0, 0.4, 0], "paving");
  buildingGeometry = true;
  // Courtyard-facing elevations follow the actual inner edges of the building.
  const walls = [
    { a: [-38.7, -416.3], b: [6.1, -439.6] },
    { a: [-31.3, -401], b: [-19.7, -382.6] },
    { a: [14.1, -424.3], b: [22.9, -403.5] },
  ];
  for (const { a, b } of walls) {
    const av = local(a),
      bv = local(b),
      dx = bv.x - av.x,
      dz = -bv.y + av.y,
      len = Math.hypot(dx, dz),
      angle = -Math.atan2(dz, dx);
    // Offset toward the open courtyard to prevent surface z-fighting.
    const nx = (-dz / len) * 0.14,
      nz = (dx / len) * 0.14;
    for (let t = 2; t < len - 1; t += 4) {
      const x = av.x + (dx * t) / len + nx,
        z = -av.y + (dz * t) / len + nz;
      for (let y = 4; y < 33; y += 4.7) {
        box([x, y, z], [2.7, 2.7, 0.16], "glass", angle);
        box([x, y, z], [0.09, 2.8, 0.21], "trim", angle);
        box([x, y - 0.5, z], [2.8, 0.09, 0.21], "trim", angle);
      }
      box(
        [x - 1.65 * Math.cos(angle), 17, z + 1.65 * Math.sin(angle)],
        [0.5, 19, 0.45],
        "trim",
        angle,
      );
    }
    for (const y of [8, 27, 34])
      box(
        [(av.x + bv.x) / 2, y, -(av.y + bv.y) / 2],
        [len, 0.55, 0.7],
        "trim",
        angle,
      );
  }
  buildingGeometry = false;
  // Monument silhouette: granite steps, circular plinth, bronze reliefs and flags.
  cyl([0, 0.6, 0], 4.5, 0.8, "granite");
  cyl([0, 1.2, 0], 4.2, 0.5, "granite");
  cyl([0, 2.3, 0], 3.9, 1.8, "granite");
  cyl([0, 3.3, 0], 4.1, 0.35, "trim");
  cyl([0, 4.8, 0], 2.7, 2.7, "stone");
  cyl([0, 6.3, 0], 3.05, 0.45, "bronze");
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    box(
      [Math.sin(a) * 3.92, 2.4, Math.cos(a) * 3.92],
      [2, 0.9, 0.12],
      "bronze",
      a,
    );
    orb([Math.sin(a) * 3, 4.7, Math.cos(a) * 3], [0.48, 0.55, 0.45], "bronze");
    orb(
      [Math.sin(a) * 3.15, 4.0, Math.cos(a) * 3.15],
      [0.6, 0.85, 0.55],
      "bronze",
    );
  }
  orb([0, 8.2, 0], [0.9, 1.8, 0.7], "bronze");
  orb([0, 10.3, 0], [0.48, 0.6, 0.46], "bronze");
  for (const side of [-1, 1]) {
    const flag = new THREE.ConeGeometry(1.1, 5, 3);
    flag.rotateZ(side * 0.22);
    add(flag, [side * 1.2, 8.6, -0.3], "bronze");
  }
  // Zoom-level furniture; merge by material to keep each group to a few draw calls.
  for (const [x, z] of [
    [-18, -20],
    [18, -20],
    [-20, 13],
    [20, 13],
  ]) {
    cyl([x, 0.65, z], 0.38, 0.5, "detail-metal");
    cyl([x, 3, z], 0.1, 5, "detail-metal");
    cyl([x, 5.6, z], 0.55, 0.12, "detail-metal");
    add(
      new THREE.CylinderGeometry(0.55, 0.25, 0.8, 4),
      [x, 6.05, z],
      "detail-lantern",
    );
    add(new THREE.ConeGeometry(0.7, 0.4, 4), [x, 6.65, z], "detail-metal");
    box([x, 4.5, z], [2.6, 0.07, 0.07], "detail-metal");
    for (const side of [-1, 1])
      box([x + side * 0.8, 3.5, z], [0.65, 1.6, 0.06], "detail-banner");
  }
  for (let i = 0; i < 4; i++) {
    const x = -15 + (i % 2) * 4,
      z = 4 + Math.floor(i / 2) * 4;
    box([x, 1.1, z], [2.8, 0.15, 0.8], "detail-wood");
    for (const s of [-1, 1]) {
      box([x, 0.7, z + s * 0.85], [2.8, 0.14, 0.3], "detail-wood");
      for (const dx of [-1, 1])
        box([x + dx, 0.5, z + s * 0.7], [0.08, 1, 0.08], "detail-metal");
    }
  }
  for (const z of [7, 12, 17]) {
    box([20, 0.9, z], [1.3, 1.6, 2.3], "detail-planter");
    for (let i = 0; i < 4; i++) {
      const px = 20 + (i % 2) * 0.45 - 0.25,
        pz = z + Math.floor(i / 2) * 0.7 - 0.35;
      cyl([px, 2.3, pz], 0.035, 2.2, "detail-wood");
      orb([px, 2.8, pz], [0.55, 1, 0.6], "detail-foliage");
    }
  }
  for (const x of [-9, 9])
    for (const z of [19, 23]) {
      cyl([x, 1.05, z], 0.14, 1.25, "detail-metal");
      cyl([x, 1.55, z], 0.19, 0.12, "detail-metal");
    }
  return Object.entries(parts).map(([material, gs]) => {
    const normalized = gs.map((g) => (g.index ? g.toNonIndexed() : g));
    const geometry = mergeGeometries(normalized, false)!;
    new Set([...gs, ...normalized]).forEach((g) => g.dispose());
    return { material, geometry };
  });
}
export const ExchangeFlags = memo(function ExchangeFlags({
  night,
}: {
  night: boolean;
}) {
  const parts = useMemo(buildSquare, []);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const colors: Record<string, string> = {
    stone: night ? "#89958e" : "#cec5ae",
    trim: "#e1d9c5",
    glass: "#557078",
    paving: night ? "#546465" : "#bcbcb0",
    granite: "#a8aca6",
    bronze: "#304b43",
    "detail-metal": "#263139",
    "detail-wood": "#b39663",
    "detail-banner": "#28373c",
    "detail-planter": "#405638",
    "detail-foliage": "#68845b",
    "detail-lantern": "#f4e3bb",
  };
  const meshes = (detail: boolean) =>
    parts
      .filter((p) => p.material.startsWith("detail-") === detail)
      .map(({ material, geometry }) => (
        <mesh key={material} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={colors[material]}
            roughness={0.9}
            emissive={
              material === "detail-lantern" && night ? "#d8bc82" : "#000000"
            }
            emissiveIntensity={0.6}
          />
        </mesh>
      ));
  return (
    <group
      position={[EXCHANGE.x, 0, EXCHANGE.z]}
      rotation={[0, EXCHANGE.rotation, 0]}
    >
      {meshes(false)}
      <Detailed distances={[0, 280]} hysteresis={0.12}>
        <group>{meshes(true)}</group>
        <group />
      </Detailed>
    </group>
  );
});

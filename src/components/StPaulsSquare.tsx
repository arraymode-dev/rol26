import { GRASS_COLOUR } from "../lib/palette";
import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/st-pauls-square.json";
export const ST_PAULS = { x: -154, z: -714, rotation: -0.56 };
export const ST_PAULS_BUILDINGS = site.buildings.map((b) => b.id);
function local([x, z]: number[]) {
  const dx = x - ST_PAULS.x,
    dz = z - ST_PAULS.z,
    c = Math.cos(ST_PAULS.rotation),
    s = Math.sin(ST_PAULS.rotation);
  return [dx * c - dz * s, dx * s + dz * c];
}
function buildSite() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const add = (g: THREE.BufferGeometry, p: number[], m: string, angle = 0) => {
    g.rotateY(angle);
    g.translate(...(p as [number, number, number]));
    markBuildingGeometry(g, buildingGeometry);
    (parts[m] ??= []).push(g);
  };
  const box = (p: number[], s: [number, number, number], m: string, a = 0) =>
    add(new THREE.BoxGeometry(...s), p, m, a);
  const pole = (p: number[], r: number, h: number, m: string) =>
    add(new THREE.CylinderGeometry(r * 0.8, r, h, 7), p, m);
  const beam = (a: number[], b: number[], r: number, m: string) => {
    const from = new THREE.Vector3(...(a as [number, number, number])),
      to = new THREE.Vector3(...(b as [number, number, number])),
      d = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(r * 0.7, r, d.length(), 6);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    add(g, from.add(to).multiplyScalar(0.5).toArray(), m);
  };
  const orb = (p: number[], s: [number, number, number], m: string) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(...s);
    add(g, p, m);
  };
  const polygon = (points: number[][], height: number) => {
    const shape = new THREE.Shape(
      points.map((p) => {
        const [x, z] = local(p);
        return new THREE.Vector2(x, -z);
      }),
    );
    const g = height
      ? new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      : new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    return g;
  };
  add(polygon(site.plaza, 0), [0, 0.42, 0], "paving");
  buildingGeometry = true;
  for (const b of site.buildings) {
    const front = b.id === "288362584",
      pink = b.id === "84823319";
    add(
      polygon(b.points, pink ? 33 : 28),
      [0, 0, 0],
      front ? "foreground" : pink ? "pink" : "context-glass",
    );
  }
  // A recognisable stone-and-glass northern façade, with its exposed diagonal braces.
  const [na, nb] = [local([-167.1, -736.8]), local([-135.2, -717.1])];
  const mid = [(na[0] + nb[0]) / 2, (na[1] + nb[1]) / 2],
    width = Math.hypot(nb[0] - na[0], nb[1] - na[1]);
  for (let x = -width / 2 + 2; x < width / 2 - 1; x += 4.8)
    for (let y = 5; y < 32; y += 4.6)
      box([mid[0] + x, y, mid[1] + 0.15], [3.7, 2.8, 0.2], "glass");
  box([mid[0], 17, mid[1] + 0.3], [6.5, 32, 0.25], "glass");
  for (let y = 1; y < 30; y += 7.5) {
    beam(
      [mid[0] - 3, y, mid[1] + 0.65],
      [mid[0] + 3, y + 7.5, mid[1] + 0.65],
      0.13,
      "steel",
    );
    beam(
      [mid[0] + 3, y, mid[1] + 0.65],
      [mid[0] - 3, y + 7.5, mid[1] + 0.65],
      0.13,
      "steel",
    );
  }
  // Mullions for the western glass elevation; OSM coordinates anchor the wall.
  const a = local([-181.7, -726.9]),
    b = local([-154.5, -694.1]),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    angle = -Math.atan2(dz, dx);
  for (let t = 0; t < len; t += 2.4)
    box(
      [a[0] + (dx * t) / len, 14, a[1] + (dz * t) / len],
      [0.09, 28, 0.15],
      "context-frame",
      angle,
    );
  for (let y = 4; y <= 28; y += 4)
    box(
      [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
      [len, 0.18, 0.2],
      "context-frame",
      angle,
    );
  buildingGeometry = false;
  const tree = (x: number, z: number, h: number) => {
    box([x, 0.5, z], [1.5, 0.1, 1.5], "soil");
    pole([x, h * 0.35, z], 0.19, h * 0.7, "bark");
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        r = 1.1 + (i % 3) * 0.35,
        tip = [
          x + Math.cos(a) * r,
          h * (0.65 + (i % 3) * 0.12),
          z + Math.sin(a) * r,
        ];
      beam([x, h * 0.35, z], tip, 0.06, "bark");
      orb(tip, [1.3, 1.1, 1.2], i % 2 ? "leaf" : "leaf-light");
    }
  };
  for (const [x, z, h] of [
    [-24, -6, 8],
    [-12, -7, 7],
    [2, -7, 8],
    [19, -6, 8],
    [3, 14, 7],
    [19, 15, 8],
  ])
    tree(x, z, h);
  // Low-poly ribbon leaves distinguish tall strap-leaf plants from broadleaf trees.
  const palm = (x: number, z: number, h: number) => {
    pole([x, h / 2, z], 0.12, h, "bark");
    for (let i = 0; i < 11; i++) {
      const angle = (i * Math.PI * 2) / 11,
        r = 1.2 + (i % 3) * 0.22;
      const verts = [
        0,
        h,
        0,
        Math.cos(angle - 0.1) * r,
        h + 0.2,
        Math.sin(angle - 0.1) * r,
        Math.cos(angle) * r * 1.65,
        h - 0.85,
        Math.sin(angle) * r * 1.65,
        Math.cos(angle + 0.1) * r,
        h + 0.2,
        Math.sin(angle + 0.1) * r,
      ];
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      add(g, [x, 0, z], "strap-leaf");
    }
  };
  const wall = (path: number[][]) => {
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1],
        [bx, bz] = path[i],
        len = Math.hypot(bx - ax, bz - az),
        n = Math.ceil(len / 0.8),
        angle = -Math.atan2(bz - az, bx - ax);
      for (let j = 0; j < n; j++)
        box(
          [
            ax + ((bx - ax) * (j + 0.5)) / n,
            0.82,
            az + ((bz - az) * (j + 0.5)) / n,
          ],
          [len / n - 0.035, 0.72, 0.75],
          "stone-seat",
          angle,
        );
    }
  };
  wall([
    [-23, 0],
    [-19, 1],
    [-18, 4],
    [-21, 5],
  ]);
  wall([
    [-4, 13],
    [-1, 12],
    [2, 15],
    [0, 17],
  ]);
  wall([
    [19, 0],
    [23, 1],
    [24, 4],
    [21, 6],
  ]);
  // Raised beds, deliberately approximate rather than inferred exact survey points.
  for (const [x, z] of [
    [-24, -5],
    [20, 12],
  ]) {
    box([x, 0.85, z], [5, 0.8, 3.7], "stone-seat");
    box([x, 1.28, z], [4.2, 0.06, 2.9], "soil");
    palm(x - 1, z, 4.6);
    palm(x + 1, z + 0.4, 3.3);
    for (let i = 0; i < 4; i++)
      orb([x - 1.5 + i, 1.55, z - 0.7], [0.6, 0.5, 0.7], "grass");
  }
  // Small furniture is only visible at close range.
  for (const [x, z] of [
    [-18, -6],
    [-4, -7],
    [10, -6],
    [21, 8],
  ]) {
    pole([x, 2.8, z], 0.09, 5, "detail-silver");
    add(new THREE.ConeGeometry(0.5, 0.7, 8), [x, 5.4, z], "detail-silver");
    add(
      new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12),
      [x, 5.85, z],
      "detail-lamp",
    );
    for (const s of [-1, 1])
      beam(
        [x + s * 0.18, 5.1, z],
        [x + s * 0.5, 5.8, z],
        0.035,
        "detail-silver",
      );
  }
  for (const [x, z] of [
    [-11, -5],
    [4, -5],
    [19, 9],
  ])
    for (let j = 0; j < 3; j++) {
      const px = x + j * 0.7;
      pole([px, 1, z], 0.04, 1, "detail-silver");
      pole([px, 1, z + 1.1], 0.04, 1, "detail-silver");
      const g = new THREE.TorusGeometry(0.55, 0.04, 5, 10, Math.PI);
      g.rotateY(Math.PI / 2);
      add(g, [px, 1.5, z + 0.55], "detail-silver");
    }
  for (const [x, z] of [
    [-27, -2],
    [-23, 3],
    [-16, 7],
  ]) {
    box([x, 1.25, z], [2.2, 0.12, 0.85], "detail-dark");
    for (const s of [-1, 1]) {
      box([x, 0.8, z + s * 0.75], [2.2, 0.12, 0.3], "detail-dark");
      for (const dx of [-0.8, 0.8])
        beam(
          [x + dx * 0.6, 1.2, z],
          [x + dx, 0.45, z + s * 0.85],
          0.06,
          "detail-dark",
        );
    }
  }
  pole([-27, 1.8, -3], 0.05, 3.2, "detail-silver");
  add(new THREE.ConeGeometry(2, 0.75, 4), [-27, 3.3, -3], "detail-dark");
  return Object.entries(parts).map(([material, gs]) => {
    const norm = gs.map((g) => (g.index ? g.toNonIndexed() : g));
    norm.forEach((g) => g.deleteAttribute("uv"));
    const geometry = mergeGeometries(norm, false)!;
    new Set([...gs, ...norm]).forEach((g) => g.dispose());
    return { material, geometry };
  });
}
export const StPaulsSquare = memo(function StPaulsSquare({
  night,
}: {
  night: boolean;
}) {
  const parts = useMemo(buildSite, []);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const colors: Record<string, string> = {
    paving: night ? "#526366" : "#d7d3c4",
    pink: night ? "#8c7272" : "#bb9290",
    glass: night ? "#416b73" : "#83adae",
    foreground: night ? "#416b73" : "#83adae",
    "context-glass": night ? "#416b73" : "#83adae",
    steel: "#35484c",
    "context-frame": "#35484c",
    soil: "#6a5e4b",
    bark: "#706450",
    leaf: "#71894e",
    "leaf-light": "#92a661",
    "strap-leaf": "#69815b",
    grass: GRASS_COLOUR,
    "stone-seat": night ? "#8d6b6b" : "#b88980",
    "detail-silver": "#a7b8ba",
    "detail-dark": "#344249",
    "detail-lamp": "#e5e8db",
  };
  const meshes = (detail: boolean) =>
    parts
      .filter((p) => p.material.startsWith("detail-") === detail)
      .map(({ material, geometry }) => (
        <mesh
          key={material}
          geometry={geometry}
          userData={{ buildingSurface: material.replace("detail-", "") }}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={colors[material]}
            roughness={0.85}
            side={
              material === "strap-leaf" ? THREE.DoubleSide : THREE.FrontSide
            }
            emissive={
              night && material === "detail-lamp" ? "#dae6c8" : "#000000"
            }
            emissiveIntensity={0.6}
          />
        </mesh>
      ));
  return (
    <group
      position={[ST_PAULS.x, 0, ST_PAULS.z]}
      rotation={[0, ST_PAULS.rotation, 0]}
    >
      {meshes(false)}
      <Detailed distances={[0, 230]} hysteresis={0.12}>
        <group>{meshes(true)}</group>
        <group />
      </Detailed>
    </group>
  );
});

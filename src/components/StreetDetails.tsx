import { memo, useEffect, useMemo } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Photo studies from batch 01, especially photos 5–9. Local metres; +z runs
// away from the Town Hall toward Castle Street. Layout is indicative, not surveyed.
function buildFurniture() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  const add = (
    g: THREE.BufferGeometry,
    p: number[],
    color: string,
    angle = 0,
  ) => {
    g.rotateY(angle);
    g.translate(p[0], p[1], p[2]);
    (parts[color] ??= []).push(g);
  };
  const box = (
    p: number[],
    s: [number, number, number],
    color: string,
    angle = 0,
  ) => add(new THREE.BoxGeometry(...s), p, color, angle);
  const pole = (p: number[], r: number, h: number, color: string) =>
    add(new THREE.CylinderGeometry(r, r, h, 8), p, color);
  const chair = (x: number, z: number, angle: number) => {
    const at = (dx: number, y: number, dz: number) => [
      x + dx * Math.cos(angle) + dz * Math.sin(angle),
      y,
      z - dx * Math.sin(angle) + dz * Math.cos(angle),
    ];
    box(at(0, 0.54, 0), [0.5, 0.1, 0.5], "seat", angle);
    for (const dx of [-0.21, 0.21])
      for (const dz of [-0.21, 0.21])
        pole(at(dx, 0.29, dz), 0.035, 0.5, "wood");
    // Curved bistro-chair back, with a simple woven-looking inset.
    const back = new THREE.TorusGeometry(0.24, 0.035, 4, 10, Math.PI);
    add(back, at(0, 0.96, -0.23), "wood", angle);
    for (const dx of [-0.24, 0.24])
      pole(at(dx, 0.74, -0.23), 0.035, 0.45, "wood");
    box(at(0, 0.9, -0.23), [0.35, 0.23, 0.04], "seat", angle);
  };
  for (const side of [-1, 1]) {
    // Distinctive green rectangular blocks at the kerb edge.
    for (let i = 0; i < 4; i++)
      box([side * 8.4, 0.65, i * 4.5 - 9], [1.3, 1.3, 2.4], "green");
    for (let i = 0; i < 3; i++) {
      const x = side * 11.3,
        z = i * 4.3 - 7;
      box([x, 0.88, z], [1.3, 0.13, 0.85], "metal");
      for (const dx of [-0.5, 0.5])
        for (const dz of [-0.3, 0.3])
          pole([x + dx, 0.44, z + dz], 0.045, 0.88, "metal");
      chair(x, z - 0.9, 0);
      chair(x, z + 0.9, Math.PI);
    }
    // Low café windbreaks; no copied business branding.
    box([side * 9.6, 0.7, 0], [0.06, 1.1, 9], "fabric");
    for (const z of [-4.5, 0, 4.5])
      pole([side * 9.6, 0.73, z], 0.035, 1.4, "metal");
  }
  // Black bollards with yellow reflective bands, seen in photo 8.
  for (const x of [-3.8, 3.8]) {
    box([x, 0.08, -12], [0.45, 0.12, 0.45], "metal");
    pole([x, 0.73, -12], 0.13, 1.4, "metal");
    pole([x, 1.13, -12], 0.136, 0.15, "yellow");
    pole([x, 1.36, -12], 0.136, 0.12, "yellow");
  }
  // One open parasol and two folded umbrellas retain the café silhouette.
  pole([-12.1, 1.45, 4.5], 0.045, 2.9, "wood");
  add(new THREE.ConeGeometry(1.8, 0.5, 8), [-12.1, 2.8, 4.5], "canvas");
  for (const [x, z] of [
    [11.4, -9],
    [-11.5, -7],
  ]) {
    pole([x, 1.45, z], 0.045, 2.9, "metal");
    add(new THREE.ConeGeometry(0.25, 1.7, 6), [x, 2.2, z], "canvas");
  }
  return Object.entries(parts).map(([material, geometries]) => {
    const normalized = geometries.map((g) => g.toNonIndexed());
    const geometry = mergeGeometries(normalized, false)!;
    [...geometries, ...normalized].forEach((g) => g.dispose());
    return { material, geometry };
  });
}
export const StreetDetails = memo(function StreetDetails({
  night,
}: {
  night: boolean;
}) {
  const parts = useMemo(buildFurniture, []);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const colors: Record<string, string> = {
    green: night ? "#28764d" : "#249348",
    metal: "#26323a",
    wood: "#a78c60",
    seat: "#ded6ba",
    fabric: "#984b48",
    yellow: "#ebbe55",
    canvas: "#d5c6a4",
  };
  return (
    <Detailed distances={[0, 230]} hysteresis={0.12} position={[0, 0.7, 57]}>
      <group>
        {parts.map(({ material, geometry }) => (
          <mesh key={material} geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial color={colors[material]} roughness={0.9} />
          </mesh>
        ))}
      </group>
      <group />
    </Detailed>
  );
});

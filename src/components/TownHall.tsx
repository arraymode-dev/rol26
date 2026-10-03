import { TOWN_HALL } from "../lib/site-positions";
import { AnookiFigure } from "./AnookiFigure";
import { useFrame } from "@react-three/fiber";
import { anookiPose } from "../lib/anooki-pose";
import { markBuildingGeometry } from "../lib/ghost-geometry";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// OSM footprint alignment; dimensions and sculptural poses are photo-informed estimates.
// Local +z faces Water Street. See references/anooki-batch-01.json for provenance.
export { TOWN_HALL, TOWN_HALL_FORECOURT } from "../lib/site-positions";
const columns = [-7.2, -2.4, 2.4, 7.2];
function buildHall() {
  const parts: Record<string, THREE.BufferGeometry[]> = {};
  let buildingGeometry = false;
  const add = (
    g: THREE.BufferGeometry,
    p: number[],
    material: string,
    rotation = 0,
  ) => {
    g.rotateY(rotation);
    g.translate(p[0], p[1], p[2]);
    markBuildingGeometry(g, buildingGeometry);
    (parts[material] ??= []).push(g);
  };
  const box = (p: number[], s: [number, number, number], material = "stone") =>
    add(new THREE.BoxGeometry(...s), p, material);
  const cylinder = (
    p: number[],
    top: number,
    bottom: number,
    h: number,
    material = "stone",
  ) => add(new THREE.CylinderGeometry(top, bottom, h, 12), p, material);
  const arch = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
  ) => {
    const r = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-r, 0);
    shape.lineTo(r, 0);
    shape.lineTo(r, height - r);
    shape.absarc(0, height - r, r, 0, Math.PI, false);
    shape.lineTo(-r, 0);
    add(new THREE.ShapeGeometry(shape), [x, y, z], "glass");
    box([x, y + height / 2, z + 0.03], [0.1, height, 0.09], "trim");
    box([x, y + height - r, z + 0.03], [width, 0.12, 0.09], "trim");
    box([x, y + height * 0.4, z + 0.03], [width, 0.1, 0.09], "trim");
    box([x, y - 0.18, z], [width + 0.6, 0.35, 0.5], "trim");
  };
  buildingGeometry = true;
  box([0, 13.5, 0], [35, 27, 46]);
  box([0, 0.8, 1], [36, 1.6, 47], "trim");
  box([0, 9, 0], [36, 0.7, 47], "trim");
  box([0, 25.8, 0], [36, 0.8, 47], "trim");
  box([0, 27.4, 0], [36.5, 0.65, 47.5], "trim");
  box([0, 27.8, 0], [33, 0.5, 43], "roof");
  // Ground-floor stone courses and the tall arched façade windows.
  for (let y = 1.7; y < 9; y += 1.1)
    box([0, y, 23.06], [35, 0.1, 0.12], "joint");
  for (const x of [-14, -10, -4.8, 0, 4.8, 10, 14]) {
    arch(x, 1.5, 23.12, 2.8, 5.9);
    arch(x, 11, 23.12, 2.8, 9.3);
  }
  for (const x of [-16.5, -8, 8, 16.5])
    box([x, 17, 23.25], [0.65, 14.2, 0.7], "trim");
  // Portico projects from the main façade: three entrance arches below four columns.
  box([0, 4.6, 25.2], [17.5, 9.2, 4.4]);
  for (let y = 1.5; y < 9; y += 1.1)
    box([0, y, 27.44], [17.5, 0.1, 0.12], "joint");
  for (const x of [-5, 0, 5]) arch(x, 0.8, 27.46, 3.1, 6.8);
  box([0, 9.7, 25.6], [19, 1, 6.3], "trim");
  for (const x of columns) {
    cylinder([x, 16.9, 27.3], 0.68, 0.9, 13.3);
    cylinder([x, 10.45, 27.3], 1, 1.05, 0.6, "trim");
    box([x, 23.7, 27.3], [1.9, 0.65, 1.9], "trim");
    cylinder([x, 23.15, 27.3], 1.05, 0.7, 0.8, "trim");
  }
  box([0, 24.7, 25.3], [19.5, 1.3, 7], "trim");
  const pediment = new THREE.Shape();
  pediment.moveTo(-10.4, 0);
  pediment.lineTo(10.4, 0);
  pediment.lineTo(0, 5);
  pediment.closePath();
  add(
    new THREE.ExtrudeGeometry(pediment, { depth: 5.8, bevelEnabled: false }),
    [0, 25.4, 22.5],
    "stone",
  );
  box([0, 25.4, 28.5], [21.5, 0.55, 0.7], "trim");
  // Parapets and balcony balustrades read clearly without texture maps.
  for (const side of [-1, 1]) {
    box([side * 13.5, 29.5, 23], [8, 0.5, 0.6], "trim");
    for (let i = 0; i < 8; i++)
      cylinder([side * (10 + i), 28.65, 23], 0.16, 0.22, 1.5, "trim");
  }
  box([0, 11.7, 27.7], [15, 0.3, 0.35], "trim");
  for (let x = -7; x <= 7; x++)
    cylinder([x, 10.9, 27.7], 0.13, 0.19, 1.3, "trim");
  // Central drum, columns, lead dome and a small abstract finial.
  cylinder([0, 32.3, 0], 7.5, 7.8, 9.2);
  cylinder([0, 31.8, 0], 7.58, 7.58, 5, "glass");
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    cylinder(
      [Math.sin(a) * 7.8, 32.2, Math.cos(a) * 7.8],
      0.4,
      0.5,
      7.7,
      "trim",
    );
  }
  cylinder([0, 36.8, 0], 8.7, 8.7, 1, "trim");
  add(
    new THREE.SphereGeometry(8.4, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    [0, 37.3, 0],
    "roof",
  );
  cylinder([0, 46, 0], 0.8, 1.3, 2, "trim");
  cylinder([0, 48.1, 0], 0.45, 1, 2.7);
  add(new THREE.IcosahedronGeometry(0.65, 1), [0, 50, 0], "stone");
  box([1.2, 49, 0], [0.14, 5, 0.14], "metal");
  // Clock face on the southern dome edge, including hands and hour marks.
  add(new THREE.CircleGeometry(2.25, 32), [0, 39.2, 8.2], "metal");
  add(new THREE.CircleGeometry(1.94, 32), [0, 39.2, 8.23], "clock");
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(
      [Math.sin(a) * 1.65, 39.2 + Math.cos(a) * 1.65, 8.26],
      [0.13, 0.23, 0.08],
      "metal",
    );
  }
  box([0, 39.8, 8.3], [0.14, 1.2, 0.1], "metal");
  box([0.5, 39.2, 8.3], [1, 0.14, 0.1], "metal");
  buildingGeometry = false;
  // Dark railings either side of the entrances, derived from the field views.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++)
      box([side * (10 + i * 0.65), 1.5, 24.4], [0.08, 3, 0.08], "metal");
    box([side * 13.6, 2.3, 24.4], [7.6, 0.1, 0.1], "metal");
  }
  return Object.entries(parts).map(([material, geometries]) => {
    const normalized = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
    const geometry = mergeGeometries(normalized, false)!;
    new Set([...geometries, ...normalized]).forEach((g) => g.dispose());
    return { material, geometry };
  });
}
export const TownHall = memo(function TownHall({ night }: { night: boolean }) {
  const parts = useMemo(buildHall, []);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const colors: Record<string, string> = {
    stone: night ? "#afa28d" : "#c5ae87",
    trim: night ? "#c5bda8" : "#ded0b3",
    glass: "#35454c",
    roof: "#6e7b7c",
    metal: "#26323a",
    joint: "#877862",
    clock: "#f5ead0",
  };
  return (
    <group
      position={[TOWN_HALL.x, 0, TOWN_HALL.z]}
      rotation={[0, TOWN_HALL.rotation, 0]}
    >
      {parts.map(({ material, geometry }) => (
        <mesh key={material} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial color={colors[material]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
});
export function AnookiOnColumns({
  night,
  reducedMotion,
  selected,
  selectionSequence,
}: {
  night: boolean;
  reducedMotion: boolean;
  selected: boolean;
  selectionSequence: number;
}) {
  const figures = useRef<(THREE.Group | null)[]>([]);
  const elapsed = useRef(0);
  const flight = useRef({
    previousDistance: 0,
    settled: 0,
    progress: 0,
    airborne: false,
  });
  useEffect(() => {
    if (selected || !night) {
      flight.current.airborne = false;
      flight.current.settled = 0;
      flight.current.progress = 0;
    }
  }, [selectionSequence, night]);
  const centre = useMemo(
    () => new THREE.Vector3(TOWN_HALL.x, 20, TOWN_HALL.z),
    [],
  );
  useFrame(({ camera, invalidate }, delta) => {
    if (!reducedMotion) elapsed.current += Math.min(delta, 0.1);
    const distance = camera.position.distanceTo(centre);
    const state = flight.current;
    const dt = Math.min(delta, 0.1);
    if (
      !night ||
      distance <= 220 ||
      Math.abs(distance - state.previousDistance) > 0.4
    )
      state.settled = 0;
    else state.settled += dt;
    state.previousDistance = distance;
    if (night && distance > 220 && state.settled >= 2) state.airborne = true;
    const target = night && state.airborne ? 1 : 0;
    state.progress = reducedMotion
      ? target
      : THREE.MathUtils.damp(state.progress, target, 3, dt);
    if (
      night &&
      distance > 220 &&
      (state.settled < 2 || Math.abs(state.progress - target) > 0.001)
    )
      invalidate();
    figures.current.forEach((figure, i) => {
      if (!figure) return;
      const pose = anookiPose(
        i === 0 ? -1 : 1,
        state.airborne ? Math.max(600, distance) : distance,
        night,
        elapsed.current,
        reducedMotion,
        state.progress,
      );
      figure.position.set(pose.x, pose.y, pose.z);
      figure.rotation.z = pose.tilt;
      figure.scale.setScalar(pose.scale);
      if (pose.floating && !reducedMotion && !document.hidden) invalidate();
    });
  });
  return (
    <group rotation={[0, TOWN_HALL.rotation, 0]}>
      {[-1, 1].map((side, i) => (
        <group
          ref={(node) => {
            figures.current[i] = node;
          }}
          key={side}
          position={[side * 7.2, side < 0 ? 16.5 : 14.6, 24.8]}
          rotation={[0, side * -0.12, side * 0.14]}
        >
          <AnookiFigure side={side} night={night} flight={flight} />
        </group>
      ))}
    </group>
  );
}

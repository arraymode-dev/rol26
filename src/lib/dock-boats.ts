import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { insideRing } from "./attraction-boundary.ts";
import type { MapData } from "../types.ts";
export type Boat = {
  x: number;
  z: number;
  angle: number;
  length: number;
  width: number;
  kind: "speedboat" | "barge" | "sailboat";
  dock: string;
  colour: number;
};
function edgeDistance(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1),
    ),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export function boatFootprint(boat: Boat) {
  const c = Math.cos(boat.angle),
    s = Math.sin(boat.angle);
  return [-1, 0, 1].flatMap((x) =>
    [-1, 0, 1].map(
      (z) =>
        [
          boat.x + (c * x * boat.width) / 2 + (s * z * boat.length) / 2,
          boat.z - (s * x * boat.width) / 2 + (c * z * boat.length) / 2,
        ] as [number, number],
    ),
  );
}
/** Illustrative moorings, entirely inside mapped docks with clear bridge lanes. */
export function dockBoatLayout(data: Pick<MapData, "water" | "roads">): Boat[] {
  const boats: Boat[] = [];
  const bridges = data.roads
    .filter((r) => r.bridge)
    .flatMap((r) => r.points.slice(1).map((b, i) => [r.points[i], b]));
  for (const dock of data.water.filter((w) =>
    /Salthouse|Albert|Wapping|Queen|Canning/.test(w.name),
  )) {
    let count = 0;
    const quota = /Salthouse/.test(dock.name)
      ? 18
      : /Albert|Queen/.test(dock.name)
        ? 12
        : 7;
    for (let e = 1; e < dock.points.length && count < quota; e++) {
      const a = dock.points[e - 1],
        b = dock.points[e];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 22) continue;
      for (let d = 15; d < len - 10 && count < quota; d += 25) {
        for (const side of [-1, 1]) {
          const x = a[0] + (dx * d) / len - (dz / len) * side * 12;
          const z = a[1] + (dz * d) / len + (dx / len) * side * 12;
          const kind = (["speedboat", "sailboat", "barge"] as const)[
            (boats.length + e) % 3
          ];
          const boat: Boat = {
            x,
            z,
            angle: Math.atan2(dx, dz),
            length: kind === "barge" ? 16 : kind === "sailboat" ? 10 : 7,
            width: kind === "barge" ? 3.4 : 3,
            kind,
            dock: dock.id,
            colour: boats.length % 4,
          };
          if (boats.some((p) => Math.hypot(x - p.x, z - p.z) < 23)) continue;
          if (
            !boatFootprint(boat).every(
              (p) =>
                insideRing(p, dock.points) &&
                !(dock.holes ?? []).some((h) => insideRing(p, h)) &&
                dock.points
                  .slice(1)
                  .every((b, i) => edgeDistance(p, dock.points[i], b) > 3) &&
                bridges.every(([a, b]) => edgeDistance(p, a, b) > 8),
            )
          )
            continue;
          boats.push(boat);
          count++;
          break;
        }
      }
    }
  }
  return boats;
}
const palette = {
  white: "#d8ddd8",
  deck: "#a39375",
  glass: "#243e4b",
  metal: "#7b8e93",
  dark: "#253740",
  red: "#944f4f",
  blue: "#487b8e",
  green: "#547766",
  rope: "#b8ada0",
};
type Colour = keyof typeof palette;
export function buildDockBoats(boats: Boat[]) {
  const batches = new Map<Colour, T.BufferGeometry[]>();
  for (const boat of boats) {
    const { length: l, width: w, kind } = boat;
    const add = (g: T.BufferGeometry, p: number[], colour: Colour, rz = 0) => {
      g.rotateZ(rz);
      g.translate(...(p as [number, number, number]));
      g.rotateY(boat.angle);
      g.translate(boat.x, -2.2, boat.z);
      if (!batches.has(colour)) batches.set(colour, []);
      batches.get(colour)!.push(g.index ? g.toNonIndexed() : g);
      if (g.index) g.dispose();
    };
    const box = (p: number[], size: [number, number, number], colour: Colour) =>
      add(new T.BoxGeometry(...size), p, colour);
    const hull = (height: number, scale: number, colour: Colour) => {
      const outline = [
        [-0.44, -0.5],
        [0.44, -0.5],
        [0.5, 0.19],
        [0.35, 0.4],
        [0, 0.5],
        [-0.35, 0.4],
        [-0.5, 0.19],
      ];
      const shape = new T.Shape(
        outline.map(([x, z]) => new T.Vector2(x * w * scale, -z * l * scale)),
      );
      const g = new T.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: true,
        bevelSize: 0.16,
        bevelThickness: 0.13,
        bevelSegments: 1,
        steps: 1,
      });
      g.rotateX(-Math.PI / 2);
      add(g, [0, -0.32, 0], colour);
    };
    hull(0.8, 1, (["white", "blue", "green", "red"] as Colour[])[boat.colour]);
    hull(0.06, 0.88, "deck");
    box([0, 0.51, 0], [w * 0.8, 0.15, l * 0.73], "white");
    if (kind === "barge") {
      box(
        [0, 1.05, -0.3],
        [w * 0.78, 1.1, l * 0.66],
        (["blue", "green", "red", "white"] as Colour[])[boat.colour],
      );
      box([0, 1.65, -0.3], [w * 0.84, 0.15, l * 0.7], "white");
      for (let z = -l * 0.23; z < l * 0.25; z += 2.1)
        for (const x of [-w * 0.398, w * 0.398])
          box([x, 1.17, z], [0.035, 0.46, 0.85], "glass");
      box([0, 1.92, -l * 0.19], [0.22, 0.48, 0.22], "dark");
    } else {
      box([0, 0.84, -0.65], [w * 0.66, 0.6, l * 0.33], "white");
      box([0, 1.13, -0.4], [w * 0.59, 0.38, l * 0.2], "glass");
      box([0, 1.37, -0.4], [w * 0.64, 0.08, l * 0.23], "white");
      box([0, 0.71, -l * 0.33], [w * 0.55, 0.24, l * 0.14], "deck");
      if (kind === "speedboat")
        box([0, 0.12, -l * 0.53], [0.55, 0.8, 0.4], "dark");
    }
    if (kind === "sailboat") {
      add(new T.CylinderGeometry(0.055, 0.08, 11, 6), [0, 5.9, 0.4], "metal");
      box([0, 1.8, -1.25], [0.1, 0.1, 3.2], "metal");
      box([0, 1.91, -1.25], [0.2, 0.17, 3.1], "white"); // Furled sail on the boom.
      for (const z of [-l * 0.43, l * 0.39]) {
        const start = new T.Vector3(0, 0.6, z),
          end = new T.Vector3(0, 10.7, 0.4),
          v = end.clone().sub(start);
        const g = new T.CylinderGeometry(0.018, 0.018, v.length(), 4);
        g.applyQuaternion(
          new T.Quaternion().setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            v.normalize(),
          ),
        );
        add(g, start.add(end).multiplyScalar(0.5).toArray(), "rope");
      }
    }
    // Rubber fenders and tiny deck cleats keep the silhouettes readable close up.
    for (const x of [-w * 0.51, w * 0.51])
      for (const z of [-l * 0.28, l * 0.2]) {
        add(new T.CylinderGeometry(0.15, 0.15, 0.6, 6), [x, 0.27, z], "dark");
        box([x * 0.77, 0.68, z], [0.26, 0.09, 0.12], "metal");
      }
  }
  // One stone-like tone, with detail supplied by geometry and lighting.
  const parts = [...batches.values()].flat();
  if (!parts.length) return [];
  const geometry = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  return [{ geometry, colour: "#c2cbd0" }];
}

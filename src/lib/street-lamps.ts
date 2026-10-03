import { nearFootprint, insideRing } from "./attraction-boundary.ts";
import type { MapData, MapFeature } from "../types.ts";

export interface StreetLamp {
  x: number;
  z: number;
  street: string;
}
export const LAMP_SPACING = 38;
export const LAMP_LIGHT_RADIUS = 16;
export const LAMP_ATTRACTION_BUFFER = 100 + LAMP_LIGHT_RADIUS;
const trafficKinds = new Set([
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
]);
export const streetHalfWidth = (r: MapFeature) =>
  ["primary", "secondary"].includes(r.kind) ? 4.5 : 2.5;
function segmentDistance(p: number[], a: number[], b: number[]) {
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

/** Deterministic pavement candidates, in map metres; these are illustrative, not surveyed assets. */
export function placeStreetLamps(
  data: MapData,
  attractions: number[][],
): StreetLamp[] {
  const streets = data.roads.filter(
    (r) =>
      trafficKinds.has(r.kind) &&
      r.public &&
      !r.indoor &&
      !r.bridge &&
      !r.area &&
      r.name,
  );
  const candidates: StreetLamp[][] = [];
  for (const road of streets) {
    // Do not invent pavement lighting along vehicle-only tunnel approaches.
    if (!road.walkable) continue;
    const group: StreetLamp[] = [];
    const lengths = road.points
      .slice(1)
      .map((p, i) =>
        Math.hypot(p[0] - road.points[i][0], p[1] - road.points[i][1]),
      );
    const total = lengths.reduce((sum, n) => sum + n, 0);
    let ordinal = 0;
    for (
      let distance = 18;
      distance < total - 14;
      distance += LAMP_SPACING, ordinal++
    ) {
      let remainder = distance,
        index = 0;
      while (index < lengths.length - 1 && remainder > lengths[index])
        remainder -= lengths[index++];
      const a = road.points[index],
        b = road.points[index + 1],
        length = lengths[index];
      if (!length) continue;
      const dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length;
      const centre = [a[0] + dx * remainder, a[1] + dz * remainder];
      if (
        centre[0] < 0 ||
        centre[0] > 720 ||
        centre[1] < -790 ||
        centre[1] > -80
      )
        continue;
      // Keep well back from crossing streets, even where the map is split into short ways.
      if (
        streets.some(
          (other) =>
            other.name !== road.name &&
            other.points
              .slice(1)
              .some(
                (p, i) =>
                  segmentDistance(centre, other.points[i], p) <
                  streetHalfWidth(other) + 10,
              ),
        )
      )
        continue;
      for (const side of [ordinal % 2 ? 1 : -1, ordinal % 2 ? -1 : 1]) {
        const offset = streetHalfWidth(road) + 1.1;
        const p: [number, number] = [
          centre[0] - dz * offset * side,
          centre[1] + dx * offset * side,
        ];
        if (
          attractions.some(
            (q) =>
              Math.hypot(p[0] - q[0], p[1] - q[1]) < LAMP_ATTRACTION_BUFFER,
          )
        )
          continue;
        if (data.buildings.some((f) => nearFootprint(p, f, 1.1))) continue;
        if (
          [...data.water, ...data.parks].some((f) => nearFootprint(p, f, 0.6))
        )
          continue;
        if (data.trees.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 2.5))
          continue;
        if (
          data.surfaces.roads.some(([points, ...holes]) =>
            nearFootprint(p, { points, holes }, 0.65),
          )
        )
          continue;
        if (
          !insideRing(p, [
            [data.coast[0][0], -8000],
            ...data.coast,
            [data.coast.at(-1)![0], 8000],
            [10000, 8000],
            [10000, -8000],
          ])
        )
          continue;
        group.push({ x: p[0], z: p[1], street: road.name });
        break;
      }
    }
    if (group.length) candidates.push(group);
  }
  const result: StreetLamp[] = [];
  // Round-robin streets so a long arterial cannot consume the whole pilot.
  for (let round = 0; candidates.some((group) => group[round]); round++) {
    for (const group of candidates) {
      const p = group[round];
      if (!p || result.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 28))
        continue;
      result.push(p);
      if (result.length === 60) return result;
    }
  }
  return result;
}

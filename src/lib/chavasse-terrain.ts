import terrain from "../data/chavasse-park.json" with { type: "json" };
import { insideRing } from "./attraction-boundary.ts";

/** Approximate park rise from the supplied aerial photo; metres above street level. */
export function chavasseHeight(x: number, z: number) {
  const u =
    (x - terrain.origin[0]) * terrain.uphill[0] +
    (z - terrain.origin[1]) * terrain.uphill[1];
  for (let i = 1; i < terrain.profile.length; i++) {
    const [a, ha] = terrain.profile[i - 1],
      [b, hb] = terrain.profile[i];
    if (u <= b)
      return ha + (hb - ha) * Math.max(0, Math.min(1, (u - a) / (b - a)));
  }
  return terrain.profile.at(-1)![1];
}
export function inChavassePark(x: number, z: number) {
  return insideRing([x, z], terrain.outline as [number, number][]);
}

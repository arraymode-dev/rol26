import site from "../data/wapping-gate.json" with { type: "json" };

// Keep the gate and its buttresses inside the paving, with a taller silhouette.
export const TOGETHER_HEIGHT_SCALE = 1.35;
export const TOGETHER_BASE = 0.55;
const along = -2.5,
  back = -4;
const c = Math.cos(site.angle),
  s = Math.sin(site.angle);
export const TOGETHER_OFFSET: [number, number] = [
  c * along + s * back,
  -s * along + c * back,
];
export const TOGETHER_POSITION: [number, number] = [
  site.center[0] + TOGETHER_OFFSET[0],
  site.center[1] + TOGETHER_OFFSET[1],
];

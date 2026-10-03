export type TrafficMetric = "opened" | "seen";
export type TrafficSnapshot = {
  version: 1;
  environmentId: "442235230";
  environment: "Production";
  capturedAt: string;
  period: { start: string; end: string; label: string; timezone: string };
  filter: "environment=production";
  totalVisitors: number;
  denominator: "Experience opened";
  source: string;
  artworks: { id: string; opened: number; seen: number }[];
};
export function parseSnapshot(
  value: unknown,
  knownIds: readonly string[],
): TrafficSnapshot {
  const s = value as TrafficSnapshot;
  if (
    !s ||
    s.version !== 1 ||
    s.environmentId !== "442235230" ||
    s.environment !== "Production" ||
    s.filter !== "environment=production" ||
    s.denominator !== "Experience opened"
  )
    throw new Error("This view needs a Production Heap snapshot.");
  if (
    !Number.isSafeInteger(s.totalVisitors) ||
    s.totalVisitors < 0 ||
    !Number.isFinite(Date.parse(s.capturedAt)) ||
    !s.period ||
    !Number.isFinite(Date.parse(s.period.start)) ||
    !Number.isFinite(Date.parse(s.period.end)) ||
    s.period.start > s.period.end
  )
    throw new Error("The snapshot has an invalid date or visitor total.");
  if (
    !Array.isArray(s.artworks) ||
    s.artworks.length !== knownIds.length ||
    new Set(s.artworks.map((r) => r.id)).size !== knownIds.length
  )
    throw new Error("The snapshot must include every artwork exactly once.");
  for (const row of s.artworks) {
    if (
      !knownIds.includes(row.id) ||
      [row.opened, row.seen].some(
        (n) => !Number.isSafeInteger(n) || n < 0 || n > s.totalVisitors,
      )
    )
      throw new Error("The snapshot contains inconsistent visitor counts.");
  }
  return s;
}
export function visitorShare(count: number, total: number) {
  return total > 0 ? count / total : 0;
}
// Web Mercator, matching OSM raster tiles exactly (not the 3D scene's local projection).
export function worldPixel(
  lon: number,
  lat: number,
  zoom: number,
): [number, number] {
  const sin = Math.sin(
    (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180,
  );
  const scale = 256 * 2 ** zoom;
  return [
    ((lon + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}
// Fixed, north-up extent. It never pans/zooms; the whole composition scales with the page.
export const MAP = {
  zoom: 16,
  width: 940,
  height: 1120,
  center: [-2.9909, 53.4051] as [number, number],
};
export function mapPoint(coordinates: [number, number]): [number, number] {
  const p = worldPixel(...coordinates, MAP.zoom),
    c = worldPixel(...MAP.center, MAP.zoom);
  return [p[0] - c[0] + MAP.width / 2, p[1] - c[1] + MAP.height / 2];
}
const MAGMA = [
  [0, 0, 4],
  [28, 16, 68],
  [79, 18, 123],
  [129, 37, 129],
  [181, 54, 122],
  [229, 80, 100],
  [251, 135, 97],
  [254, 194, 135],
  [252, 253, 191],
];
export function magma(value: number): [number, number, number] {
  const at = Math.max(0, Math.min(1, value)) * (MAGMA.length - 1),
    i = Math.min(MAGMA.length - 2, Math.floor(at)),
    f = at - i;
  return MAGMA[i].map((v, j) => Math.round(v + (MAGMA[i + 1][j] - v) * f)) as [
    number,
    number,
    number,
  ];
}
// Max kernel avoids adding overlapping shares as though they were distinct people.
// Fixed 70 m sigma: smoothing is illustrative; no inferred GPS journeys or union counts.
export function heatField(
  points: { x: number; y: number; weight: number }[],
  width: number,
  height: number,
  sigma: number,
) {
  const field = new Float32Array(width * height),
    radius = Math.ceil(sigma * 3);
  for (const p of points) {
    if (p.weight <= 0) continue;
    for (
      let y = Math.max(0, Math.floor(p.y - radius));
      y < Math.min(height, Math.ceil(p.y + radius));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(p.x - radius));
        x < Math.min(width, Math.ceil(p.x + radius));
        x++
      ) {
        const weight =
          p.weight *
          Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * sigma * sigma));
        const i = y * width + x;
        if (weight > field[i]) field[i] = weight;
      }
    }
  }
  return field;
}

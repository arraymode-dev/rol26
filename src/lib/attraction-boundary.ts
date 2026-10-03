// Map units are metres. Selection changes emphasis, never the boundary size.
export const ATTRACTION_RADIUS = 29;
export type Point = readonly [number, number];

export function insideRing(point: Point, ring: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

export function circleIntersectsFootprint(
  center: Point,
  ring: readonly Point[],
  radius = ATTRACTION_RADIUS,
) {
  if (!ring.length) return false;
  if (insideRing(center, ring)) return true;
  return ring.some((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length2 = dx * dx + dz * dz;
    const t = length2
      ? Math.max(
          0,
          Math.min(
            1,
            ((center[0] - a[0]) * dx + (center[1] - a[1]) * dz) / length2,
          ),
        )
      : 0;
    return (
      (center[0] - a[0] - t * dx) ** 2 + (center[1] - a[1] - t * dz) ** 2 <=
      radius ** 2
    );
  });
}

export interface Footprint {
  points: readonly Point[];
  holes?: readonly (readonly Point[])[];
}
export function nearFootprint(
  point: Point,
  footprint: Footprint,
  margin: number,
) {
  if (!circleIntersectsFootprint(point, footprint.points, margin)) return false;
  return !(footprint.holes ?? []).some(
    (hole) =>
      insideRing(point, hole) &&
      !hole.some((a, i) =>
        circleIntersectsFootprint(
          point,
          [a, hole[(i + 1) % hole.length]],
          margin,
        ),
      ),
  );
}

export const ORIGIN = { lat: 53.404, lon: -2.992 };
const METRES_LAT = 111320;
const METRES_LON = METRES_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);
export function project(lon: number, lat: number): [number, number] {
  return [(lon - ORIGIN.lon) * METRES_LON, -(lat - ORIGIN.lat) * METRES_LAT];
}
export function unproject(x: number, z: number): [number, number] {
  return [ORIGIN.lon + x / METRES_LON, ORIGIN.lat - z / METRES_LAT];
}
export function selectPreview(
  candidates: {
    id: string;
    distance: number;
    screenDistance: number;
    visible: boolean;
  }[],
  current: string | null,
): string | null {
  const eligible = candidates.filter(
    (c) =>
      c.visible &&
      c.distance < (c.id === current ? 300 : 240) &&
      c.screenDistance < (c.id === current ? 0.65 : 0.42),
  );
  const retained = eligible.find((c) => c.id === current);
  return (
    retained?.id ??
    eligible.sort((a, b) => a.screenDistance - b.screenDistance)[0]?.id ??
    null
  );
}

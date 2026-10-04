// Deliberately composed over the Mersey, not an astronomical ephemeris.
// Five degrees of elevation keeps it visible within the map's low orbit limit.
const elevation = (5 * Math.PI) / 180;
const azimuth = -1.89;
export const MOON_DIRECTION: [number, number, number] = [
  Math.sin(azimuth) * Math.cos(elevation),
  Math.sin(elevation),
  Math.cos(azimuth) * Math.cos(elevation),
];
export const MOON_ANGULAR_RADIUS = (1.15 * Math.PI) / 180;
export const MOON_DISTANCE = 12000;
export function moonPlacement(camera: readonly number[]) {
  return MOON_DIRECTION.map((v, i) => camera[i] + v * MOON_DISTANCE) as [
    number,
    number,
    number,
  ];
}

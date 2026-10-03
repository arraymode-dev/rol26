import { MathUtils } from "three";

export function anookiPose(
  side: number,
  distance: number,
  night: boolean,
  time: number,
  reducedMotion: boolean,
  flightProgress = 1,
) {
  const lift = night
    ? MathUtils.smoothstep(distance, 220, 600) * flightProgress
    : 0;
  const t = reducedMotion ? 0 : time;
  // A sinusoidal horizontal parameter traverses a parabola with no reset or
  // sudden reversal. Different periods keep the pair from marching in sync.
  const phase = t * (side < 0 ? 0.29 : 0.24) + side * 1.4;
  const arc = Math.sin(phase);
  return {
    x: MathUtils.lerp(side * 7.2, side * 15 + arc * 10, lift),
    y: MathUtils.lerp(side < 0 ? 16.5 : 14.6, 90 + 14 * (1 - arc * arc), lift),
    z: MathUtils.lerp(24.8, 7 + Math.cos(phase) * 7, lift),
    tilt: side * 0.14 + Math.cos(phase) * -0.18 * lift,
    scale: 1 + lift * 2.2,
    floating: lift > 0,
  };
}

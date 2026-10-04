import type { PointLight } from "three";

/** A fixed light layout avoids recompiling every lit material when a light fades.
 * Keep its shadow map allocated, but stop rendering it while its contribution is zero. */
export function updateStablePointLight(light: PointLight, intensity: number) {
  light.intensity = intensity;
  light.shadow.autoUpdate = false;
  light.shadow.needsUpdate = !light.shadow.map || intensity > 0;
}

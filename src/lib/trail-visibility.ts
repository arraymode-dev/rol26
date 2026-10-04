/** Only an overview may reveal the dimmed route behind geometry. */
export function hiddenTrailOpacity(cameraDistance: number) {
  const t = Math.max(0, Math.min(1, (cameraDistance - 280) / 220));
  return 0.2 * t * t * (3 - 2 * t);
}

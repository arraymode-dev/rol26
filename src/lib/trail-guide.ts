export interface WalkingLeg {
  from: string;
  to: string;
  metres: number;
}
/** Collection insertion order records the last confirmed visit, including reloads. */
export function lastSeenArtwork(seen: ReadonlySet<string>): string | null {
  return Array.from(seen).at(-1) ?? null;
}
export function nextTrailArtwork(ids: readonly string[], from: string | null) {
  const start = from ? ids.indexOf(from) : -1;
  return ids[start + 1] ?? null;
}
// Sum mapped walking legs, including backtracking when revisiting an earlier
// stop. Never substitute an aerial straight line across docks/buildings.
export function trailWalk(
  ids: readonly string[],
  legs: readonly WalkingLeg[],
  from: string | null,
  to: string | null,
) {
  if (!from || !to) return null;
  const a = ids.indexOf(from),
    b = ids.indexOf(to);
  if (a < 0 || b < 0 || a === b) return null;
  let metres = 0;
  for (let i = Math.min(a, b); i < Math.max(a, b); i++) {
    const leg = legs.find((l) => l.from === ids[i] && l.to === ids[i + 1]);
    if (!leg || !Number.isFinite(leg.metres) || leg.metres < 0) return null;
    metres += leg.metres;
  }
  return { metres, minutes: Math.max(1, Math.ceil(metres / 65)) };
}

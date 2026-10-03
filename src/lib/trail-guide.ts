export interface WalkingLeg {
  from: string;
  to: string;
  metres: number;
}
export function nextTrailArtwork(
  ids: readonly string[],
  seen: ReadonlySet<string>,
  from: string | null,
) {
  const start = from ? ids.indexOf(from) : -1;
  for (let offset = 1; offset <= ids.length; offset++) {
    const id = ids[(start + offset) % ids.length];
    if (!seen.has(id)) return id;
  }
  return null;
}
// Sum mapped walking legs, including backtracking when revisiting an earlier
// unseen stop. Never substitute an aerial straight line across docks/buildings.
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

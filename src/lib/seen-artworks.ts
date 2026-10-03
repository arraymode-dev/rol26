export const SEEN_STORAGE_KEY = "rol-seen-artworks";

export function parseSeenArtworks(
  raw: string | null,
  validIds: readonly string[],
): Set<string> {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return new Set(
      Array.isArray(value)
        ? value.filter(
            (id): id is string =>
              typeof id === "string" && validIds.includes(id),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

export function toggleSeenArtwork(
  current: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Confirming a trail stop advances the visit order without unchecking it. */
export function markArtworkSeen(
  current: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(current);
  next.delete(id);
  next.add(id);
  return next;
}

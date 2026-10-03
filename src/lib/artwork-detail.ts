export type ArtworkDetail = "overview" | "near";
// Hysteresis prevents rebuilding detail when hovering at the transition distance.
export function artworkDetail(
  distance: number,
  previous: ArtworkDetail,
): ArtworkDetail {
  return distance < (previous === "near" ? 420 : 350) ? "near" : "overview";
}

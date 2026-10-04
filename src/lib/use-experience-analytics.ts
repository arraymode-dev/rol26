import { useEffect, useRef } from "react";
import { setAnalyticsContext, track } from "./analytics";
type State = {
  selected: string | null;
  detailsOpen: boolean;
  trail: boolean;
  list: boolean;
  info: boolean;
  gpsDebug: boolean;
  certificate: boolean;
  trailGuide: boolean;
  minimised: boolean;
  lowQuality: boolean;
  ready: boolean;
  failed: boolean;
  reducedMotion: boolean;
  seen: ReadonlySet<string>;
  query: string;
  resultCount: number;
};
export function useExperienceAnalytics(state: State) {
  const previous = useRef<State | null>(null);
  useEffect(() => {
    const old = previous.current;
    previous.current = state;
    setAnalyticsContext({
      artwork_id: state.selected,
      trail_enabled: state.trail,
      render_mode: state.lowQuality ? "performance" : "full",
      seen_count: state.seen.size,
      reduced_motion: state.reducedMotion,
    });
    if (!old) {
      track("Experience opened");
      return;
    }
    if (
      old.selected !== state.selected ||
      old.detailsOpen !== state.detailsOpen
    ) {
      if (state.selected && state.detailsOpen)
        track("Artwork opened", { previous_artwork_id: old.selected });
      else if (old.selected && old.detailsOpen)
        track("Artwork closed", { artwork_id: old.selected });
    }
    for (const key of [
      "list",
      "info",
      "gpsDebug",
      "certificate",
      "trailGuide",
    ] as const)
      if (old[key] !== state[key])
        track("Panel toggled", { surface: key, open: state[key] });
    if (old.trail !== state.trail)
      track("Trail toggled", { enabled: state.trail });
    if (old.lowQuality !== state.lowQuality) track("Rendering quality changed");
    if (
      old.minimised !== state.minimised &&
      state.selected &&
      state.detailsOpen
    )
      track("Artwork panel resized", { open: !state.minimised });
    if (!old.ready && state.ready && !state.failed)
      track("Map ready", { load_ms: Math.round(performance.now()) });
    if (!old.failed && state.failed) track("Map unavailable");
    if (old.seen !== state.seen) {
      for (const id of state.seen)
        if (!old.seen.has(id)) track("Artwork marked seen", { artwork_id: id });
      for (const id of old.seen)
        if (!state.seen.has(id))
          track("Artwork marked unseen", { artwork_id: id });
      if (old.seen.size < 13 && state.seen.size === 13)
        track("Collection completed");
    }
  });
  useEffect(() => {
    if (!state.query) return;
    const timer = setTimeout(
      () =>
        track("Artwork search", {
          query_length: state.query.length,
          result_count: state.resultCount,
        }),
      600,
    );
    return () => clearTimeout(timer);
  }, [state.query, state.resultCount]);
}

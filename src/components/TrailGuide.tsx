import { track } from "../lib/analytics";
import { useEffect, useRef } from "react";
import { Check, Footprints, MapPin, Minus, Sparkles, X } from "lucide-react";
import { PanelSummary } from "./PanelSummary";
import type { Installation } from "../types";
import { nextTrailArtwork, trailWalk } from "../lib/trail-guide";
import legs from "../data/trail-distances.json";
export function TrailGuide({
  items,
  seen,
  from,
  open,
  onOpen,
  onClose,
  onDismiss,
  onView,
  onSeen,
  onCertificate,
  onReview,
}: {
  items: Installation[];
  seen: ReadonlySet<string>;
  from: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDismiss: () => void;
  onView: (id: string) => void;
  onSeen: (id: string) => void;
  onCertificate: () => void;
  onReview: () => void;
}) {
  const returnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    returnRef.current?.focus({ preventScroll: true });
  }, [open]);
  const ids = items.map((i) => i.id),
    nextId = nextTrailArtwork(ids, from),
    next = items.find((i) => i.id === nextId),
    origin = items.find((i) => i.id === from),
    walk = trailWalk(ids, legs, from, nextId);
  const lastStop = useRef<string | null>(null);
  useEffect(() => {
    if (lastStop.current === nextId) return;
    lastStop.current = nextId;
    track("Trail next artwork", {
      artwork_id: nextId,
      previous_artwork_id: from,
      seen_count: seen.size,
    });
  }, [nextId, from, seen.size]);
  const complete = seen.size === items.length;
  if (!open)
    return (
      <div className="trail-resume popup-shell">
        <PanelSummary
          buttonRef={returnRef}
          badge={<Footprints size={18} />}
          label="Expand suggested trail"
          onExpand={onOpen}
          title={
            next
              ? `Next: ${next.name}`
              : complete
                ? "Every light collected"
                : "End of the trail"
          }
          subtitle={`${walk ? `About ${walk.minutes} min · ` : ""}${seen.size} of ${items.length} seen`}
        />
        <button
          className="icon-button panel-dismiss"
          aria-label="End suggested trail"
          title="End suggested trail"
          onClick={onDismiss}
        >
          <X size={22} />
        </button>
      </div>
    );
  return (
    <section
      className="trail-guide popup-shell"
      data-analytics-surface="trail-guide"
      data-artwork-id={nextId ?? undefined}
      aria-labelledby="trail-title"
    >
      <button
        ref={returnRef}
        className="icon-button trail-minimise"
        aria-label="Minimise suggested trail"
        title="Back to map"
        onClick={onClose}
      >
        <Minus size={20} />
      </button>
      <button
        className="icon-button panel-dismiss"
        aria-label="End suggested trail"
        title="End suggested trail"
        onClick={onDismiss}
      >
        <X size={22} />
      </button>
      <div className="trail-heading">
        <div className="eyebrow">YOUR NIGHT OF LIGHT</div>
        <h2 id="trail-title">
          {next
            ? "Your next light."
            : complete
              ? "Every light, collected."
              : "You reached the last light."}
        </h2>
      </div>
      <div className="trail-progress" aria-live="polite">
        <span>
          {seen.size} of {items.length} seen
        </span>
        <span>{Math.round((seen.size / items.length) * 100)}%</span>
      </div>
      <progress
        max={items.length}
        value={seen.size}
        aria-label="Artwork collection progress"
      />
      {next ? (
        <>
          <div className="trail-stop">
            <img src={next.photos[0].src} alt="" width="88" height="88" />
            <div>
              <span className="eyebrow">
                {String(next.number).padStart(2, "0")} ·{" "}
                {origin ? "UP NEXT" : "START HERE"}
              </span>
              <h3>{next.name}</h3>
              <p>{next.location}</p>
            </div>
          </div>
          <p className="trail-walk">
            <Footprints size={19} />
            <span>
              {walk ? (
                <>
                  About {walk.minutes} min walk{" "}
                  <small>
                    {Math.round(walk.metres / 10) * 10} m along the trail · from{" "}
                    {origin?.name}
                  </small>
                </>
              ) : (
                <>
                  Begin at {next.name}
                  <small>
                    {origin
                      ? "Walking estimate unavailable for this connection."
                      : "Mark an artwork as seen to continue from there."}
                  </small>
                </>
              )}
            </span>
          </p>
          <div className="trail-buttons">
            <button className="primary-button" onClick={() => onView(next.id)}>
              <MapPin size={17} /> View on map
            </button>
            <button className="trail-seen" onClick={() => onSeen(next.id)}>
              <Check size={17} />{" "}
              {seen.has(next.id) ? "Continue" : "I’ve seen it"}
            </button>
          </div>
        </>
      ) : complete ? (
        <>
          <p className="trail-complete">
            You found all {items.length} artworks. Take your golden certificate
            home.
          </p>
          <button
            className="collection-certificate-button"
            onClick={onCertificate}
          >
            <Sparkles size={16} /> Your golden certificate
          </button>
        </>
      ) : (
        <>
          <p className="trail-complete">
            You reached stop 13. There are {items.length - seen.size} artworks
            left in your collection.
          </p>
          <button className="primary-button" onClick={onReview}>
            Review artworks
          </button>
        </>
      )}
    </section>
  );
}

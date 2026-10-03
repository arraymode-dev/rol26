import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Footprints,
  MapPin,
  Trophy,
} from "lucide-react";
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
  onView,
  onSeen,
  onCertificate,
  onReview,
  onGPSDebug,
}: {
  items: Installation[];
  seen: ReadonlySet<string>;
  from: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onView: (id: string) => void;
  onSeen: (id: string) => void;
  onCertificate: () => void;
  onReview: () => void;
  onGPSDebug: () => void;
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
  const complete = seen.size === items.length;
  if (!open)
    return (
      <button ref={returnRef} className="trail-resume" onClick={onOpen}>
        <Footprints size={17} />
        <span>
          {next
            ? `Next: ${next.name}`
            : complete
              ? "Every light collected"
              : "End of the trail"}
          <small>
            {walk ? `About ${walk.minutes} min · ` : ""}
            {seen.size} of {items.length} seen
          </small>
        </span>
        <ChevronRight size={18} />
      </button>
    );
  return (
    <section className="trail-guide popup-shell" aria-labelledby="trail-title">
      <button ref={returnRef} className="trail-back" onClick={onClose}>
        <ArrowLeft size={17} /> Back to map
      </button>
      <div className="eyebrow">YOUR NIGHT OF LIGHT</div>
      <h2 id="trail-title">
        {next
          ? "Your next light."
          : complete
            ? "Every light, collected."
            : "You reached the last light."}
      </h2>
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
              {seen.has(next.id) ? "Continue from here" : "I’ve seen it"}
            </button>
          </div>
          <a
            className="trail-directions"
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${next.coordinates[1]},${next.coordinates[0]}&travelmode=walking`}
          >
            Walking directions <ArrowUpRight size={16} />
          </a>
          <p className="trail-caveat">
            Suggested route · check crossings and access on site. Walking times
            exclude stops.
          </p>
        </>
      ) : complete ? (
        <>
          <p className="trail-complete">
            You found all {items.length} artworks. Take your golden certificate
            home.
          </p>
          <button className="primary-button" onClick={onCertificate}>
            <Trophy size={18} /> Your certificate
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
      <button className="gps-debug-link" onClick={onGPSDebug}>
        GPS debug · field log
      </button>
    </section>
  );
}

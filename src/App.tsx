import { EventCountdown } from "./components/EventCountdown";
import { Credits } from "./components/Credits";
import { track } from "./lib/analytics";
import { useExperienceAnalytics } from "./lib/use-experience-analytics";
import { lastSeenArtwork } from "./lib/trail-guide";
import { createTrailLocation } from "./lib/trail-location";
import { TrailLocationTracker } from "./components/TrailLocationTracker";
import { TrailGuide } from "./components/TrailGuide";
import { PanelSummary } from "./components/PanelSummary";
import { loadMap } from "./lib/map-loader";
import { PRIMARY } from "./lib/palette";
import { CollectionCertificate } from "./components/CollectionCertificate";
import {
  parseSeenArtworks,
  toggleSeenArtwork,
  markArtworkSeen,
  SEEN_STORAGE_KEY,
} from "./lib/seen-artworks";
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Gauge,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  Footprints,
  Info,
  List,
  MapPin,
  Minus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { installations } from "./data/installations";
import type { Installation } from "./types";
import type { Command } from "./components/Scene";
void loadMap();
const Scene = lazy(() => import("./components/Scene"));
const GPSDebug = lazy(() =>
  import("./components/GPSDebug").then((module) => ({
    default: module.GPSDebug,
  })),
);

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function App() {
  const [trailLocation] = useState(createTrailLocation);
  const [gpsDebug, setGPSDebug] = useState(
    () => new URLSearchParams(location.search).get("debug") === "gps",
  );
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      return parseSeenArtworks(
        localStorage.getItem(SEEN_STORAGE_KEY),
        installations.map((item) => item.id),
      );
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seen]));
    } catch {
      /* Check-offs still work when storage is unavailable. */
    }
  }, [seen]);
  const toggleSeen = (id: string) => {
    setSeen((current) => toggleSeenArtwork(current, id));
  };
  const complete = seen.size === installations.length;
  const previouslyComplete = useRef(complete);
  const [certificate, setCertificate] = useState(false);
  useEffect(() => {
    if (complete && !previouslyComplete.current) setCertificate(true);
    if (!complete) setCertificate(false);
    previouslyComplete.current = complete;
  }, [complete]);
  const [selected, setSelected] = useState<string | null>(null),
    [trail, setTrail] = useState(false),
    [list, setList] = useState(false),
    [query, setQuery] = useState(""),
    [info, setInfo] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [lowQuality, setLowQuality] = useState(() => {
    const phone =
      matchMedia("(pointer: coarse)").matches &&
      Math.min(screen.width, screen.height) <= 700;
    try {
      const preference = localStorage.getItem("rol-render-quality");
      if (preference === "performance" || preference === "full")
        return preference === "performance";
      // The old key was written on every load, even without a user choice.
      // Its automatic false value must not disable the new phone default.
      return phone || localStorage.getItem("rol-low-quality") === "true";
    } catch {
      return phone;
    }
  });
  const toggleQuality = () => {
    const next = !lowQuality;
    setLowQuality(next);
    try {
      localStorage.setItem("rol-render-quality", next ? "performance" : "full");
    } catch {
      /* Rendering still works when browser storage is unavailable. */
    }
  };
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!list || !viewport) {
      setKeyboardInset(0);
      return;
    }
    const update = () =>
      setKeyboardInset(
        document.activeElement === searchRef.current
          ? Math.max(
              0,
              window.innerHeight - viewport.height - viewport.offsetTop,
            )
          : 0,
      );
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [list]);
  const [trailGuide, setTrailGuide] = useState(false);
  const trailFrom = lastSeenArtwork(seen);
  const [minimised, setMinimised] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingStage, setLoadingStage] = useState(
    "Downloading Liverpool’s map…",
  );
  const [selectionSequence, setSelectionSequence] = useState(0);
  const [stepNavigation, setStepNavigation] = useState(false);
  const deselectFromZoom = useCallback(() => {
    setSelected(null);
  }, []);
  const [overviewCopy, setOverviewCopy] = useState(true);
  const dismissOverviewCopy = useCallback(() => setOverviewCopy(false), []);
  const [command, setCommand] = useState<Command>({
    kind: "overview",
    sequence: 0,
  });
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const searchRef = useRef<HTMLInputElement>(null),
    closeRef = useRef<HTMLButtonElement>(null),
    summaryRef = useRef<HTMLButtonElement>(null),
    listButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (list) {
      if (matchMedia("(max-width: 700px), (pointer: coarse)").matches)
        document.getElementById("artwork-list")?.focus({ preventScroll: true });
      else searchRef.current?.focus({ preventScroll: true });
    }
  }, [list]);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)"),
      f = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  const selectedIdRef = useRef(selected);
  selectedIdRef.current = selected;
  const choose = useCallback((id: string, step = false, showDetails = true) => {
    setOverviewCopy(false);
    setDetailsOpen(showDetails);
    setMinimised(false);
    setList(false);
    setTrailGuide(false);
    // A repeated hit on the selected artwork must not restart its camera flight.
    if (selectedIdRef.current === id) return;
    track("Artwork selection requested", {
      artwork_id: id,
      source: step ? "previous-next" : "map-list-or-trail",
    });
    selectedIdRef.current = id;
    searchRef.current?.blur();
    setSelected(id);
    setStepNavigation(step);
    setSelectionSequence((n) => n + 1);
    setQuery("");
    setList(false);
    setTrailGuide(false);
  }, []);
  const error = useCallback(() => {
    setFailed(true);
    setReady(true);
    setList(true);
  }, []);
  const loaded = useCallback(() => setReady(true), []);
  const issue = (kind: Command["kind"]) => {
    if (kind !== "overview") setOverviewCopy(false);
    track("Map command", { control: kind });
    setCommand((c) => ({ kind, sequence: c.sequence + 1 }));
  };
  const overview = () => {
    setSelected(null);
    setList(false);
    setTrail(false);
    setTrailGuide(false);
    setOverviewCopy(true);
    issue("overview");
  };
  const closeDetails = () => {
    setSelected(null);
    listButtonRef.current?.focus();
  };
  useEffect(() => {
    if (selected && detailsOpen)
      (minimised ? summaryRef : closeRef).current?.focus({
        preventScroll: true,
      });
  }, [selected, detailsOpen, minimised]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        track("Keyboard shortcut", { control: "Escape" });
        if (gpsDebug) {
          setGPSDebug(false);
          return;
        }
        if (certificate) {
          setCertificate(false);
          return;
        }
        if (info) {
          setInfo(false);
          return;
        }
        setTrailGuide(false);
        setSelected(null);
        setList(false);
        setInfo(false);
        setQuery("");
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        if (certificate) return;
        track("Keyboard shortcut", { control: "artwork-search" });
        e.preventDefault();
        setSelected(null);
        setList(true);
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selected, info, certificate, gpsDebug]);
  const active = detailsOpen
    ? installations.find((i) => i.id === selected)
    : undefined;
  const filtered = installations.filter((i) =>
    `${i.name} ${i.location} ${i.artist}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  useExperienceAnalytics({
    selected,
    detailsOpen: !!active,
    trail,
    list,
    info,
    gpsDebug,
    certificate,
    trailGuide,
    minimised,
    lowQuality,
    ready,
    failed,
    reducedMotion,
    seen,
    query,
    resultCount: filtered.length,
  });
  useModalFocus(info, ".about-modal");
  useModalFocus(certificate, ".certificate-modal");
  const next = (offset: number) => {
    if (active)
      choose(
        installations[
          (installations.indexOf(active) + offset + installations.length) %
            installations.length
        ].id,
        true,
      );
  };
  return (
    <main className={`app night${active ? " has-details" : ""}`}>
      <a
        className="skip-link"
        href="#artwork-list"
        onClick={() => setList(true)}
      >
        Skip to artwork list
      </a>
      <div className="scene" aria-busy={!ready}>
        {!failed && (
          <SceneBoundary onError={error}>
            <Suspense fallback={null}>
              <Scene
                lowQuality={lowQuality}
                night={true}
                selected={selected}
                detailsOpen={!!active}
                seen={seen}
                trail={trail}
                trailLocation={trailLocation}
                command={command}
                reducedMotion={reducedMotion}
                onExplore={dismissOverviewCopy}
                onSelect={choose}
                selectionSequence={selectionSequence}
                stepNavigation={stepNavigation}
                onDeselect={deselectFromZoom}
                onReady={loaded}
                onProgress={setLoadingStage}
                onError={error}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
      <div className="vignette" />
      <EventCountdown
        visible={
          ready &&
          !failed &&
          overviewCopy &&
          !selected &&
          !list &&
          !trail &&
          !info &&
          !certificate
        }
      />
      <header className="topbar">
        <button
          className="brand"
          onClick={overview}
          aria-label="River of Light, return to full map"
        >
          <img
            className="brand-mark"
            src="/logo-rol26.svg"
            width="48"
            height="48"
            alt=""
          />
          <span className="brand-name">
            RIVER OF LIGHT<small>LIVERPOOL · 2026</small>
          </span>
        </button>
        <button
          className="quality-toggle"
          aria-label="Low quality mode"
          aria-pressed={lowQuality}
          title="Reduce rendering cost: removes dynamic lights and shadows, stills water, and keeps artwork colour pools"
          onClick={toggleQuality}
        >
          <Gauge size={17} />
          <span>Low quality</span>
          {lowQuality && <Check size={14} />}
        </button>
        <button
          className="icon-button info-button"
          aria-label="About this experience"
          onClick={() => setInfo(!info)}
        >
          <Info size={20} />
        </button>
      </header>
      {trail && <TrailLocationTracker store={trailLocation} />}
      <div className="top-meta" hidden={trail}>
        <span>
          <span className="live-dot" /> Unofficial Guide
        </span>
      </div>
      {!ready && (
        <div className="loading" role="status">
          <span className="loading-orbit" />
          <p>
            A little light is on its way.
            <small>{loadingStage}</small>
          </p>
        </div>
      )}
      {active && (
        <section
          className={`detail-panel popup-shell${minimised ? " is-minimised" : ""}`}
          data-analytics-surface="artwork-details"
          data-artwork-id={active.id}
          aria-label={`${active.name} details`}
        >
          <button
            ref={closeRef}
            className="icon-button detail-close"
            aria-label="Close artwork details"
            onClick={closeDetails}
          >
            <X size={22} />
          </button>
          <button
            className="icon-button detail-minimise"
            aria-label={
              minimised ? "Expand artwork details" : "Minimise artwork details"
            }
            aria-expanded={!minimised}
            aria-controls="artwork-detail-content"
            onClick={() => setMinimised((value) => !value)}
          >
            <Minus size={20} />
          </button>
          <PanelSummary
            buttonRef={summaryRef}
            className="detail-summary"
            onExpand={() => setMinimised(false)}
            label={`Expand ${active.name} details`}
            badge={String(active.number).padStart(2, "0")}
            title={active.name}
          />
          <div
            className="detail-scroll"
            id="artwork-detail-content"
            key={active.id}
          >
            <Photo item={active} />
            <div className="detail-copy">
              <h2>{active.name}</h2>
              <p className="artist">{active.artist}</p>
              <p className="artwork-description">{active.description}</p>
              <div className="detail-tags">
                <span>{active.area}</span>
                <span>River of Light 2026</span>
              </div>
              <div className="detail-actions">
                <a
                  className="primary-button"
                  href={active.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official page <ArrowUpRight size={18} />
                </a>
              </div>
              <div className="location-card">
                <div className="eyebrow">
                  <MapPin size={14} /> FIND THIS ARTWORK
                </div>
                <p>{active.location}</p>
                <small>
                  {active.positionStatus === "surveyed"
                    ? "Position refined from site survey"
                    : active.photos.some((photo) => photo.kind === "site")
                      ? "Surroundings captured · artwork placement pending"
                      : "Placement approximate · awaiting site survey"}
                </small>
              </div>
            </div>
          </div>
          <div className="detail-pagination">
            <button onClick={() => next(-1)}>
              <ChevronLeft size={17} /> Back
            </button>
            <button
              className="seen-toggle"
              aria-pressed={seen.has(active.id)}
              aria-label={`Mark ${active.name} as seen`}
              onClick={() => toggleSeen(active.id)}
            >
              <Check size={16} />{" "}
              {seen.has(active.id) ? "Seen!" : "I've seen it!"}
            </button>
            <button onClick={() => next(1)}>
              Next <ChevronRight size={17} />
            </button>
          </div>
        </section>
      )}
      <div className="map-corner">
        <div className="attribution">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors · ODbL
          </a>
        </div>
      </div>
      <footer className="bottom-bar" data-analytics-surface="navigation">
        <nav className="bottom-actions">
          <button
            ref={listButtonRef}
            aria-expanded={list}
            aria-controls="artwork-list"
            className={list ? "active" : ""}
            onClick={() => {
              setList(!list);
              setSelected(null);
            }}
          >
            <List size={17} />
            <span>All artworks</span>
            <b>13</b>
          </button>
          <button
            className={trail ? "active" : ""}
            aria-pressed={trail}
            onClick={() => {
              if (!trail) {
                setSelected(null);
                setList(false);
              }
              setTrailGuide(!trail);
              setTrail(!trail);
              issue(trail ? "trail-off" : "trail-on");
            }}
          >
            <Footprints size={17} />
            <span>Suggested trail</span>
            {trail && <Check size={14} />}
          </button>
          <button
            aria-label="Reset map view"
            title="Reset map view"
            onClick={overview}
            className="overview-action"
          >
            <Expand size={16} />
          </button>
        </nav>
        {list && (
          <section
            className="list-panel popup-shell"
            style={
              { "--keyboard-inset": `${keyboardInset}px` } as CSSProperties
            }
            data-analytics-surface="artwork-list"
            id="artwork-list"
            tabIndex={-1}
          >
            <div className="list-heading">
              <div className="eyebrow">THE COMPLETE COLLECTION</div>
              <button
                className="icon-button detail-close"
                aria-label="Close artwork list"
                onClick={() => {
                  setList(false);
                  listButtonRef.current?.focus();
                }}
              >
                <X size={20} />
              </button>
              <h2>Find your light.</h2>
              <div className="collection-progress">
                <span role="status">
                  {seen.size} of {installations.length} seen
                  {seen.size === installations.length ? " — well done!" : ""}
                </span>
                <button
                  disabled={!seen.size}
                  onClick={() => {
                    track("Collection reset", { seen_count: seen.size });
                    setSeen(new Set());
                  }}
                >
                  Reset all
                </button>
              </div>
              {complete && (
                <button
                  className="collection-certificate-button"
                  onClick={() => setCertificate(true)}
                >
                  <Sparkles size={16} /> Your golden certificate
                </button>
              )}
            </div>
            <div className="search-wrap collection-search">
              <Search size={18} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query && filtered[0])
                    choose(filtered[0].id);
                }}
                placeholder="Find an artwork or a place"
                aria-label="Find an artwork or a place"
                aria-controls="collection-results"
              />
              <kbd>/</kbd>
            </div>
            {failed && (
              <p className="fallback-notice">
                The 3D view is unavailable on this device. Explore every artwork
                and its directions below.
              </p>
            )}
            <div className="artwork-list" id="collection-results">
              {!filtered.length && (
                <p className="no-results" role="status">
                  No artworks found. Try a place or artist.
                </p>
              )}
              {filtered.map((i) => (
                <div
                  className={`list-entry${seen.has(i.id) ? " is-seen" : ""}`}
                  key={i.id}
                  data-artwork-id={i.id}
                >
                  <button className="list-item" onClick={() => choose(i.id)}>
                    <span className="list-number">
                      {String(i.number).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{i.name}</strong>
                      <small>{i.location}</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="seen-toggle list-seen-toggle"
                    aria-pressed={seen.has(i.id)}
                    aria-label={`Mark ${i.name} as seen`}
                    onClick={() => toggleSeen(i.id)}
                  >
                    <Check size={20} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {trail && !list && !active && !info && !gpsDebug && (
          <TrailGuide
            items={installations}
            seen={seen}
            from={trailFrom}
            open={trailGuide}
            onOpen={() => setTrailGuide(true)}
            onClose={() => setTrailGuide(false)}
            onDismiss={() => {
              setTrailGuide(false);
              setTrail(false);
              issue("trail-off");
            }}
            onView={(id) => choose(id, false, false)}
            onSeen={(id) => setSeen((current) => markArtworkSeen(current, id))}
            onReview={() => {
              setList(true);
              setTrailGuide(false);
            }}
            onCertificate={() => setCertificate(true)}
          />
        )}
      </footer>
      {gpsDebug && (
        <Suspense
          fallback={
            <div className="loading" role="status">
              Opening GPS field log…
            </div>
          }
        >
          <GPSDebug
            store={trailLocation}
            trail={trail}
            selected={selected}
            onClose={() => setGPSDebug(false)}
            onStart={() => {
              setTrail(true);
              setTrailGuide(false);
              issue("trail-on");
            }}
          />
        </Suspense>
      )}
      {certificate && (
        <CollectionCertificate
          total={installations.length}
          onClose={() => setCertificate(false)}
        />
      )}
      {info && (
        <div className="modal-backdrop" onClick={() => setInfo(false)}>
          <section
            className="about-modal popup-shell"
            data-analytics-surface="about"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button detail-close"
              aria-label="Close information"
              onClick={() => setInfo(false)}
            >
              <X />
            </button>
            <div className="about-scroll">
              <div className="eyebrow">A DIFFERENT PERSPECTIVE</div>
              <h2 id="about-title">A city. A little wonder.</h2>
              <p>
                An unofficial exploration of River of Light 2026. Discover the
                full collection of thirteen artworks across Liverpool’s
                waterfront and city centre.
              </p>
              <p>
                This is a concept map, with stylised artwork models and
                approximate installation positions. Site photography will help
                refine the scene. Check the official event website for current
                access and visitor information.
              </p>
              <p className="creator-credit">
                Made by{" "}
                <a
                  href="https://www.instagram.com/obwez/"
                  target="_blank"
                  rel="noreferrer"
                >
                  @obwez
                </a>
              </p>
              <a
                className="primary-button"
                href="https://www.visitliverpool.com/river-of-light-2026/"
                target="_blank"
                rel="noreferrer"
              >
                Visit the official event website <ArrowUpRight size={18} />
              </a>
              <Credits />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
function Photo({ item }: { item: Installation }) {
  const [index, setIndex] = useState(0),
    [broken, setBroken] = useState(false),
    [full, setFull] = useState(false);
  useEffect(() => {
    setIndex(0);
    setBroken(false);
    setFull(false);
  }, [item.id]);
  const photo = item.photos[index];
  const photoEvent = useRef("");
  useEffect(() => {
    const key = `${item.id}:${index}:${full}:${broken}`;
    if (photoEvent.current === key) return;
    photoEvent.current = key;
    track(broken ? "Artwork photo unavailable" : "Artwork photo viewed", {
      artwork_id: item.id,
      photo_index: index + 1,
      photo_kind: photo?.kind ?? "none",
      open: full,
    });
  }, [item.id, index, full, broken, photo?.kind]);
  useModalFocus(full, ".image-lightbox");
  useEffect(() => {
    if (!full) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setFull(false);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [full]);
  return (
    <>
      <div
        className="art-photo"
        style={{ "--art-color": PRIMARY } as React.CSSProperties}
      >
        {photo && !broken ? (
          <img
            src={photo.src}
            alt={photo.alt}
            onError={() => setBroken(true)}
            onClick={() => setFull(true)}
          />
        ) : (
          <div className="photo-placeholder">
            <div className="abstract-ring" />
            <div className="abstract-ring second" />
            <Sparkles size={28} />
            <span>
              {broken ? "Image unavailable" : "Photo reference coming soon"}
            </span>
          </div>
        )}
        <span className="photo-category">
          {photo?.kind === "site" ? "LOCATION" : "LIGHT ART"}
        </span>
        {photo && !broken && (
          <button
            className="photo-expand icon-button"
            aria-label="Expand artwork image"
            onClick={() => setFull(true)}
          >
            <Expand size={17} />
          </button>
        )}
        <span className="photo-count" aria-live="polite">
          {index + 1} / {item.photos.length}
        </span>
        {item.photos.length > 1 && (
          <>
            <button
              className="photo-arrow photo-previous"
              aria-label="Previous photo"
              onClick={() => {
                setBroken(false);
                setIndex((index + item.photos.length - 1) % item.photos.length);
              }}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              className="photo-arrow photo-next"
              aria-label="Next photo"
              onClick={() => {
                setBroken(false);
                setIndex((index + 1) % item.photos.length);
              }}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
      {item.photos.length > 1 && (
        <div
          className="photo-thumbnails"
          role="group"
          aria-label="Artwork photographs"
        >
          {item.photos.map((image, photoIndex) => (
            <button
              key={image.src}
              aria-label={`Show photo ${photoIndex + 1}: ${image.kind === "artwork" ? "Official artwork" : "Location photograph"}`}
              aria-pressed={index === photoIndex}
              onClick={() => {
                setBroken(false);
                setIndex(photoIndex);
              }}
            >
              <img src={image.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <p className="photo-credit">
        {photo && !broken
          ? `${photo.kind === "site" ? "Location photograph · " : ""}${photo.credit}`
          : "Image unavailable"}
      </p>
      {full &&
        photo &&
        createPortal(
          <div
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`${item.name} photograph`}
            onClick={() => setFull(false)}
          >
            <button
              className="icon-button"
              aria-label="Close full-size photograph"
              autoFocus
              onClick={() => setFull(false)}
            >
              <X />
            </button>
            <img src={photo.src} alt={photo.alt} />
            <p>{photo.credit}</p>
          </div>,
          document.body,
        )}
    </>
  );
}

function useModalFocus(active: boolean, selector: string) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const container = document.querySelector<HTMLElement>(selector);
    if (!container) return;
    const focusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button,a[href],input,[tabindex="0"]',
        ),
      );
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !container.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !container.contains(document.activeElement))
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", trap, true);
    return () => {
      window.removeEventListener("keydown", trap, true);
      previous?.focus();
    };
  }, [active, selector]);
}

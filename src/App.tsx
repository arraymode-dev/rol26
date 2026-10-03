import { loadMap } from "./lib/map-loader";
import { PRIMARY } from "./lib/palette";
import {
  parseSeenArtworks,
  toggleSeenArtwork,
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
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { installations } from "./data/installations";
import type { Installation } from "./types";
import type { Command } from "./components/Scene";
void loadMap();
const Scene = lazy(() => import("./components/Scene"));

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
  const toggleSeen = (id: string) =>
    setSeen((current) => toggleSeenArtwork(current, id));
  const [selected, setSelected] = useState<string | null>(null),
    [trail, setTrail] = useState(false),
    [list, setList] = useState(false),
    [query, setQuery] = useState(""),
    [info, setInfo] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [lowQuality, setLowQuality] = useState(() => {
    try {
      return localStorage.getItem("rol-low-quality") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("rol-low-quality", String(lowQuality));
    } catch {
      /* Rendering still works when browser storage is unavailable. */
    }
  }, [lowQuality]);
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
  const [minimised, setMinimised] = useState(false);
  const [loadingStage, setLoadingStage] = useState(
    "Downloading Liverpool’s map…",
  );
  const [selectionSequence, setSelectionSequence] = useState(0);
  const deselectFromZoom = useCallback(() => {
    setSelected(null);
  }, []);
  const [command, setCommand] = useState<Command>({
    kind: "overview",
    sequence: 0,
  });
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const searchRef = useRef<HTMLInputElement>(null),
    closeRef = useRef<HTMLButtonElement>(null),
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
  const choose = useCallback((id: string) => {
    // A repeated hit on the selected artwork must not restart its camera flight.
    if (selectedIdRef.current === id) return;
    selectedIdRef.current = id;
    searchRef.current?.blur();
    setMinimised(false);
    setSelected(id);
    setSelectionSequence((n) => n + 1);
    setQuery("");
    setList(false);
  }, []);
  const error = useCallback(() => {
    setFailed(true);
    setReady(true);
    setList(true);
  }, []);
  const loaded = useCallback(() => setReady(true), []);
  const issue = (kind: Command["kind"]) =>
    setCommand((c) => ({ kind, sequence: c.sequence + 1 }));
  const overview = () => {
    setSelected(null);
    issue("overview");
  };
  const closeDetails = () => {
    setSelected(null);
    listButtonRef.current?.focus();
  };
  useEffect(() => {
    if (selected) closeRef.current?.focus();
  }, [selected]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (info) {
          setInfo(false);
          return;
        }
        setSelected(null);
        setList(false);
        setInfo(false);
        setQuery("");
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSelected(null);
        setList(true);
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selected, info]);
  const active = installations.find((i) => i.id === selected);
  const filtered = installations.filter((i) =>
    `${i.name} ${i.location} ${i.artist}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  useModalFocus(info, ".about-modal");
  const next = (offset: number) => {
    if (active)
      choose(
        installations[
          (installations.indexOf(active) + offset + installations.length) %
            installations.length
        ].id,
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
                seen={seen}
                trail={trail}
                command={command}
                reducedMotion={reducedMotion}
                onSelect={choose}
                selectionSequence={selectionSequence}
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
      <header className="topbar">
        <button
          className="brand"
          onClick={overview}
          aria-label="River of Light, return to full map"
        >
          <span className="brand-mark">
            R<span>∿</span>L
          </span>
          <span className="brand-name">
            RIVER OF LIGHT<small>LIVERPOOL · 2026</small>
          </span>
        </button>
        <button
          className="quality-toggle"
          aria-label="Low quality mode"
          aria-pressed={lowQuality}
          title="Reduce rendering cost: removes dynamic lights and shadows, stills water, and keeps artwork colour pools"
          onClick={() => setLowQuality((value) => !value)}
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
      <div className="top-meta">
        <span>
          <span className="live-dot" /> A CITY BROUGHT TOGETHER
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
            {minimised ? <Plus size={20} /> : <Minus size={20} />}
          </button>
          <button
            className="detail-summary"
            onClick={() => setMinimised(false)}
            aria-label={`Expand ${active.name} details`}
          >
            <span>{String(active.number).padStart(2, "0")}</span>
            {active.name}
          </button>
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
                <a
                  className="directions-link"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${active.coordinates[1]},${active.coordinates[0]}&travelmode=walking`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Footprints size={17} /> Walking directions
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
            <div className="detail-progress">
              <button
                className="seen-toggle"
                aria-pressed={seen.has(active.id)}
                aria-label={`Mark ${active.name} as seen`}
                onClick={() => toggleSeen(active.id)}
              >
                <Check size={16} />{" "}
                {seen.has(active.id) ? "Seen!" : "I've seen it!"}
              </button>
              <span>
                {active.number} of {installations.length}
              </span>
            </div>
            <button onClick={() => next(1)}>
              Next <ChevronRight size={17} />
            </button>
          </div>
        </section>
      )}
      {list && (
        <section
          className="list-panel popup-shell"
          style={{ "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}
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
            <h2>
              Find your light.<span>13 artworks across Liverpool</span>
            </h2>
            <div className="collection-progress">
              <span role="status">
                {seen.size} of {installations.length} seen
                {seen.size === installations.length ? " — well done!" : ""}
              </span>
              <button disabled={!seen.size} onClick={() => setSeen(new Set())}>
                Reset all
              </button>
            </div>
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
      <footer className="bottom-bar">
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
        {trail && (
          <div className="trail-note">
            <Footprints size={14} />
            Suggested connections · check crossings and access on site
          </div>
        )}
      </footer>
      {info && (
        <div className="modal-backdrop" onClick={() => setInfo(false)}>
          <section
            className="about-modal popup-shell"
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
              <a
                className="primary-button"
                href="https://www.visitliverpool.com/river-of-light-2026/"
                target="_blank"
                rel="noreferrer"
              >
                Visit the official event website <ArrowUpRight size={18} />
              </a>
              <div className="legal-disclaimer">
                <strong>Unofficial project disclaimer</strong>
                <p>
                  This project is not affiliated with, endorsed by, sponsored by
                  or authorised by Liverpool City Council, Culture Liverpool,
                  Arts Council England, the River of Light organisers or the
                  participating artists. Artwork images, names and trademarks
                  belong to their respective owners.
                </p>
              </div>
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

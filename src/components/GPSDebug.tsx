import { track } from "../lib/analytics";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { X, Copy, Download, MapPin } from "lucide-react";
import { installations } from "../data/installations";
import type { TrailLocationStore } from "../lib/trail-location";
import { locationMessages } from "../lib/location-messages";
import {
  captureGPS,
  exportGPSLog,
  GPS_CAPTURE_MAX_AGE,
  GPS_LOG_KEY,
  parseGPSLog,
} from "../lib/gps-field-log";

export function GPSDebug({
  store,
  trail,
  selected,
  onStart,
  onClose,
}: {
  store: TrailLocationStore;
  trail: boolean;
  selected: string | null;
  onStart: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const { status, fix } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const [artworkId, setArtworkId] = useState(selected ?? installations[0].id);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState(() => {
    try {
      return parseGPSLog(localStorage.getItem(GPS_LOG_KEY));
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const artwork = installations.find((item) => item.id === artworkId)!;
  const age = fix ? Math.max(0, now - fix.timestamp) : Infinity;
  const fresh = trail && !!fix && age <= GPS_CAPTURE_MAX_AGE;
  const save = () => {
    const record = captureGPS(store.getSnapshot().fix, artwork, note);
    if (!trail || !record) {
      setMessage("Wait for a fresh GPS reading, then capture again.");
      return;
    }
    const next = [...records, record].slice(-100);
    setRecords(next);
    try {
      localStorage.setItem(GPS_LOG_KEY, JSON.stringify(next));
      setMessage(
        `Saved ${artwork.name} · ±${Math.ceil(record.fix.accuracy)} m`,
      );
    } catch {
      setMessage(
        "Captured for this session. Device storage is unavailable; copy or download before closing.",
      );
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportGPSLog(records));
      setMessage("GPS log copied. Paste it into this chat.");
    } catch {
      setMessage("Copy unavailable in this browser. Use Download log instead.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportGPSLog(records)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `rol-gps-field-log-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("GPS log downloaded.");
  };
  return (
    <div
      onClickCapture={(event) => {
        if (!(event.target instanceof Element)) return;
        const control = event.target
          .closest("[data-analytics-action]")
          ?.getAttribute("data-analytics-action");
        if (control) track("GPS field log action", { control });
      }}
      className="modal-backdrop heap-ignore"
      data-heap-redact-text="true"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), select, textarea, a[href]",
            ),
          );
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className="about-modal popup-shell gps-debug"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gps-debug-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-button detail-close"
          aria-label="Close GPS debug"
          data-analytics-action="close"
          onClick={onClose}
        >
          <X size={22} />
        </button>
        <div className="about-scroll">
          <div className="eyebrow">FIELD TESTING</div>
          <h2 id="gps-debug-title">GPS field log.</h2>
          <p className="gps-help">
            Stand at the artwork’s intended position. Wait for a steady, low
            accuracy number, then capture. Phone GPS is approximate, even with
            many decimal places.
          </p>
          <p className="gps-status" role="status">
            {trail
              ? locationMessages[status]
              : "Turn on Suggested trail to use GPS."}
          </p>
          {!trail ? (
            <button
              className="primary-button"
              data-analytics-action="start-trail"
              onClick={onStart}
            >
              Start Suggested trail
            </button>
          ) : (
            <button
              className="gps-secondary"
              data-analytics-action="refresh-gps"
              onClick={() =>
                store.start(navigator.geolocation, window.isSecureContext, 0)
              }
            >
              Refresh GPS
            </button>
          )}
          <dl className="gps-readings">
            <div>
              <dt>Latitude</dt>
              <dd>{fix ? fix.latitude.toFixed(7) : "—"}</dd>
            </div>
            <div>
              <dt>Longitude</dt>
              <dd>{fix ? fix.longitude.toFixed(7) : "—"}</dd>
            </div>
            <div>
              <dt>Reported accuracy</dt>
              <dd>{fix ? `±${fix.accuracy.toFixed(1)} m` : "—"}</dd>
            </div>
            <div>
              <dt>Reading age</dt>
              <dd>{fix ? `${Math.floor(age / 1000)} s` : "—"}</dd>
            </div>
          </dl>
          {fix && fix.accuracy > 20 && (
            <p className="gps-help">
              Weak accuracy: try a clearer view of the sky before capturing.
            </p>
          )}
          <label className="gps-field">
            I’m at this artwork
            <select
              value={artworkId}
              onChange={(e) => {
                setArtworkId(e.target.value);
                setMessage("");
              }}
            >
              {installations.map((item) => (
                <option key={item.id} value={item.id}>
                  {String(item.number).padStart(2, "0")} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="gps-field">
            Notes (optional)
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. centre of sculpture, beside the quay"
            />
          </label>
          <button
            className="primary-button gps-capture"
            disabled={!fresh}
            data-analytics-action="save-reading"
            onClick={save}
          >
            <MapPin size={18} /> I’m here — save GPS
          </button>
          <p className="gps-help">
            Only captures you save are kept on this device. Nothing is uploaded
            and map positions are not changed automatically.
          </p>
          <div className="gps-export">
            <button
              className="gps-secondary"
              disabled={!records.length}
              data-analytics-action="copy-log"
              onClick={copy}
            >
              <Copy size={16} /> Copy log
            </button>
            <button
              className="gps-secondary"
              disabled={!records.length}
              data-analytics-action="download-log"
              onClick={download}
            >
              <Download size={16} /> Download log
            </button>
          </div>
          <p role="status" className="gps-feedback">
            {message}
          </p>
          <h3>Saved readings · {records.length}</h3>
          <ol className="gps-records">
            {records
              .slice()
              .reverse()
              .map((record) => (
                <li key={record.id}>
                  <strong>{record.artworkName}</strong>
                  <span>
                    {record.fix.latitude.toFixed(7)},{" "}
                    {record.fix.longitude.toFixed(7)}
                  </span>
                  <small>
                    ±{record.fix.accuracy.toFixed(1)} m ·{" "}
                    {Math.round(record.offsetMetres)} m from map position ·{" "}
                    {new Date(record.capturedAt).toLocaleTimeString()}
                  </small>
                  {record.note && <small>{record.note}</small>}
                </li>
              ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

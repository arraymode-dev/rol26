import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { installations } from "../data/installations";
import {
  heatField,
  magma,
  MAP,
  mapPoint,
  parseSnapshot,
  visitorShare,
  worldPixel,
  type TrafficMetric,
  type TrafficSnapshot,
} from "./model";
import "./traffic.css";

const ids = installations.map((a) => a.id);
const centre = worldPixel(...MAP.center, MAP.zoom);
const left = centre[0] - MAP.width / 2,
  top = centre[1] - MAP.height / 2;
const tiles: { key: string; x: number; y: number }[] = [];
for (
  let y = Math.floor(top / 256);
  y <= Math.floor((top + MAP.height) / 256);
  y++
) {
  for (
    let x = Math.floor(left / 256);
    x <= Math.floor((left + MAP.width) / 256);
    x++
  ) {
    tiles.push({ key: `${x}/${y}`, x: x * 256 - left, y: y * 256 - top });
  }
}
const percent = (n: number) => `${Math.round(n * 100)}%`;
const captured = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
    timeZoneName: "short",
  }).format(new Date(value));
function StaticMap({
  data,
  metric,
}: {
  data: TrafficSnapshot;
  metric: TrafficMetric;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const scale = 0.5,
      width = MAP.width * scale,
      height = MAP.height * scale;
    const points = installations.map((a) => {
      const [x, y] = mapPoint(a.coordinates);
      return {
        x: x * scale,
        y: y * scale,
        weight: visitorShare(
          data.artworks.find((r) => r.id === a.id)![metric],
          data.totalVisitors,
        ),
      };
    });
    const metresPerPixel =
      (156543.03392 * Math.cos((MAP.center[1] * Math.PI) / 180)) /
      2 ** MAP.zoom;
    const field = heatField(
      points,
      width,
      height,
      (70 / metresPerPixel) * scale,
    );
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < field.length; i++) {
      const v = field[i];
      if (v < 0.006) continue;
      const color = magma(v);
      image.data.set(
        [...color, Math.round(Math.min(0.84, v * 8) * 255)],
        i * 4,
      );
    }
    ctx.putImageData(image, 0, 0);
  }, [data, metric]);
  return (
    <div className="map-frame">
      <div className="map-heading">
        <span>LIVERPOOL WATERFRONT</span>
        <span>↑ N</span>
      </div>
      <div
        className="static-map"
        role="img"
        aria-label={`Static OpenStreetMap of Liverpool showing ${metric === "seen" ? "self-reported visits" : "artwork exploration"} as a magma heatmap. Exact counts are listed alongside.`}
      >
        <div className="map-tiles" aria-hidden="true">
          {tiles.map((t) => (
            <img
              key={t.key}
              alt=""
              draggable="false"
              onError={() => setTileError(true)}
              src={`https://tile.openstreetmap.org/${MAP.zoom}/${t.key}.png`}
              style={{
                left: `${(t.x / MAP.width) * 100}%`,
                top: `${(t.y / MAP.height) * 100}%`,
                width: `${(256 / MAP.width) * 100}%`,
                height: `${(256 / MAP.height) * 100}%`,
              }}
            />
          ))}
        </div>
        <canvas
          ref={canvas}
          width={MAP.width / 2}
          height={MAP.height / 2}
          aria-hidden="true"
        />
        <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} aria-hidden="true">
          {installations.map((a) => {
            const [x, y] = mapPoint(a.coordinates);
            const count = data.artworks.find((r) => r.id === a.id)![metric];
            return (
              <g
                key={a.id}
                transform={`translate(${x},${y})`}
                className={count ? "pin" : "pin pin-empty"}
              >
                <circle r="15" />
                <text textAnchor="middle" dy="5">
                  {String(a.number).padStart(2, "0")}
                </text>
              </g>
            );
          })}
        </svg>
        {tileError && (
          <p className="tile-error">
            Some basemap tiles could not load. Reload the page to retry.
          </p>
        )}
        <div
          className="map-scale"
          aria-hidden="true"
          style={{
            width: `${(100 / ((156543.03392 * Math.cos((MAP.center[1] * Math.PI) / 180)) / 2 ** MAP.zoom) / MAP.width) * 100}%`,
          }}
        >
          <i />
          100 m
        </div>
      </div>
      <div className="map-credit">
        <span>Fixed view · 70 m smoothing</span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </div>
    </div>
  );
}
function TrafficAtlas() {
  const [data, setData] = useState<TrafficSnapshot | null>(null);
  const [metric, setMetric] = useState<TrafficMetric>("seen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  async function refresh() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/data/heap-traffic.json", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error("The saved Heap snapshot is unavailable.");
      const next = parseSnapshot(await response.json(), ids);
      if (!controller.signal.aborted) setData(next);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not load the snapshot.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, []);
  const ranked = data
    ? installations
        .map((a) => ({
          ...a,
          count: data.artworks.find((r) => r.id === a.id)![metric],
        }))
        .sort((a, b) => b.count - a.count || a.number - b.number)
    : [];
  return (
    <main>
      <header className="atlas-header">
        <div className="brand">
          R<span>∿</span>L
        </div>
        <span>
          RIVER OF LIGHT <small>LIVERPOOL · 2026</small>
        </span>
        <div className="private-tag">
          <i />
          UNLISTED STUDY
        </div>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">AUDIENCE / GEOGRAPHY</p>
          <h1>
            Where the light
            <br />
            <em>draws people.</em>
          </h1>
          <p className="deck">
            A snapshot of how visitors explore the collection.
          </p>
        </div>
        <div className="source-block">
          <span className="source-tag">HEAP · PRODUCTION</span>
          <p>
            {data
              ? `${data.period.label} · ${data.period.timezone}`
              : "Loading snapshot…"}
          </p>
          <p className="timestamp">
            {data ? `Captured ${captured(data.capturedAt)}` : ""}
          </p>
          <button disabled={loading} onClick={() => void refresh()}>
            {loading ? "Loading…" : "↻ Reload snapshot"}
          </button>
        </div>
      </section>
      <div role="status" className={error ? "notice error" : "sr-only"}>
        {error
          ? `${error}${data ? " Showing the previously loaded snapshot." : ""}`
          : loading
            ? "Loading saved data"
            : "Snapshot loaded"}
      </div>
      {data && (
        <>
          <div className="view-bar">
            <div className="metric-switch" aria-label="Heatmap metric">
              <button
                aria-pressed={metric === "seen"}
                onClick={() => setMetric("seen")}
              >
                Marked seen
              </button>
              <button
                aria-pressed={metric === "opened"}
                onClick={() => setMetric("opened")}
              >
                Artwork explored
              </button>
            </div>
            <p>
              <strong>{data.totalVisitors}</strong> unique visitors{" "}
              <span>/</span>{" "}
              <strong>{ranked.filter((a) => a.count > 0).length}</strong> active
              locations
            </p>
          </div>
          <div className="atlas-grid">
            <StaticMap data={data} metric={metric} />
            <aside>
              <div className="aside-title">
                <p className="eyebrow">VISITOR REACH</p>
                <h2>
                  {metric === "seen" ? "Lights collected." : "Places explored."}
                </h2>
                <p>
                  {metric === "seen"
                    ? "People who marked each artwork seen, as a share of all visitors."
                    : "People who opened each artwork, as a share of all visitors."}
                </p>
              </div>
              <div className="legend">
                <div className="magma" />
                <div>
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>ARTWORK</th>
                    <th>PEOPLE</th>
                    <th>SHARE</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="row-number">
                          {String(a.number).padStart(2, "0")}
                        </span>
                        <span>{a.name}</span>
                      </td>
                      <td>{a.count}</td>
                      <td>
                        <span className="share-value">
                          {percent(visitorShare(a.count, data.totalVisitors))}
                        </span>
                        <i
                          style={{
                            width: percent(
                              visitorShare(a.count, data.totalVisitors),
                            ),
                            background: `rgb(${magma(visitorShare(a.count, data.totalVisitors)).join(",")})`,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.totalVisitors === 0 && (
                <p className="notice">
                  No visitors in this period. No heat is drawn.
                </p>
              )}
              <div className="reading-note">
                <span>HOW TO READ THIS</span>
                <p>
                  Brighter areas have a greater share of visitors. Repeated
                  actions count once per person, per artwork. People can appear
                  at several locations.
                </p>
              </div>
            </aside>
          </div>
          <footer>
            <div>
              <span className="eyebrow">THE MEASURE</span>
              <p>
                Artwork visitors ÷ {data.totalVisitors} unique experience
                visitors. Fixed 0–100% colour scale; nearby hotspots are not
                added together.
              </p>
            </div>
            <div>
              <span className="eyebrow">THE CONTEXT</span>
              <p>
                {metric === "seen"
                  ? "Checkmarks are self-reported; later unmarking does not erase past activity."
                  : "Artwork opens measure interest in the map."}{" "}
                This is not GPS footfall. This small sample includes setup
                testing.
              </p>
            </div>
            <div>
              <span className="eyebrow">THE SOURCE</span>
              <p>
                Saved Heap Production snapshot, filtered to deployed app events.
                Reload checks the published snapshot; it does not query Heap
                live.
              </p>
              <a href={data.source} target="_blank" rel="noreferrer">
                View source dashboard ↗
              </a>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<TrafficAtlas />);

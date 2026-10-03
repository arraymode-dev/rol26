/** Small, failure-isolated bridge to Heap. Never pass GPS fixes or user text here. */
export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null
>;
type Heap = {
  track: (name: string, properties?: AnalyticsProperties) => void;
  load: (id: string, options?: Record<string, unknown>) => void;
  [key: string]: unknown;
};
declare global {
  interface Window {
    heap?: Heap;
    heapReadyCb?: { name: string; fn: () => void }[];
  }
}
let context: AnalyticsProperties = {};
const allowed = new Set([
  "artwork_id",
  "previous_artwork_id",
  "source",
  "environment",
  "surface",
  "control",
  "tag",
  "destination_host",
  "destination_path",
  "render_mode",
  "trail_enabled",
  "seen_count",
  "open",
  "enabled",
  "status",
  "result",
  "photo_index",
  "photo_kind",
  "query_length",
  "result_count",
  "duration_ms",
  "input",
  "gestures",
  "max_pointers",
  "distance_px",
  "wheel_direction",
  "cancelled",
  "zoom_level",
  "progress_percent",
  "load_ms",
  "reduced_motion",
  "schema_version",
]);
export function cleanProperties(properties: AnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(
        ([key, value]) =>
          allowed.has(key) &&
          (typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value)) ||
            typeof value === "string"),
      )
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 160) : value,
      ]),
  );
}
export function setAnalyticsContext(value: AnalyticsProperties) {
  context = cleanProperties(value);
}
export function track(name: string, properties: AnalyticsProperties = {}) {
  try {
    if (typeof window === "undefined" || !window.heap?.track) return;
    window.heap.track(
      name,
      cleanProperties({
        schema_version: 1,
        environment: ["localhost", "127.0.0.1"].includes(
          window.location?.hostname,
        )
          ? "local-preview"
          : "production",
        ...context,
        ...properties,
      }),
    );
  } catch {
    /* Analytics must never interrupt an interaction. */
  }
}
export function installHeap(enabled: boolean) {
  if (!enabled || window.heap) return;
  // User-provided EU loader, preserving the queue used by Heap's config script.
  window.heapReadyCb = window.heapReadyCb || [];
  const heap = (window.heap = [] as unknown as Heap);
  heap.load = (id, options = {}) => {
    heap.envId = id;
    heap.clientConfig = { ...options, shouldFetchServerConfig: false };
    for (const name of [
      "init",
      "startTracking",
      "stopTracking",
      "track",
      "resetIdentity",
      "identify",
      "getSessionId",
      "getUserId",
      "getIdentity",
      "addUserProperties",
      "addEventProperties",
      "removeEventProperty",
      "clearEventProperties",
      "addAccountProperties",
      "addAdapter",
      "addTransformer",
      "addTransformerFn",
      "onReady",
      "addPageviewProperties",
      "removePageviewProperty",
      "clearPageviewProperties",
      "trackPageview",
    ]) {
      const queued = (...args: unknown[]) => {
        if (name === "init" && window.heapReadyCb!.length >= 200)
          window.heapReadyCb!.pop();
        if (window.heapReadyCb!.length < 200)
          window.heapReadyCb!.push({
            name,
            fn: () => {
              const method = window.heap?.[name];
              if (typeof method === "function" && method !== queued)
                method.apply(window.heap, args);
            },
          });
      };
      heap[name] = queued;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://cdn.eu.heap-api.com/config/${id}/heap_config.js`;
    document.head.append(script);
  };
  heap.load("442235230", { disableTextCapture: true });
}
/** One delegated listener covers existing and future buttons, links and controls. */
export function attachUIAnalytics(doc: Document) {
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const element = event.target.closest<HTMLElement>(
      'button,a,[role="button"],input,select,summary',
    );
    if (!element || element.closest(".heap-ignore,[data-analytics-ignore]"))
      return;
    const surface =
      element.closest<HTMLElement>("[data-analytics-surface]")?.dataset
        .analyticsSurface || "app";
    const control =
      element.dataset.analyticsAction ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent?.trim().replace(/\s+/g, " ").slice(0, 100) ||
      element.tagName.toLowerCase();
    const properties: AnalyticsProperties = {
      control,
      surface,
      tag: element.tagName.toLowerCase(),
      input: event.detail === 0 ? "keyboard" : "pointer",
    };
    const artwork =
      element.closest<HTMLElement>("[data-artwork-id]")?.dataset.artworkId;
    if (artwork) properties.artwork_id = artwork;
    if (element instanceof HTMLAnchorElement) {
      try {
        const url = new URL(element.href);
        if (url.protocol === "https:" || url.protocol === "http:") {
          properties.destination_host = url.hostname;
          properties.destination_path = url.pathname;
        }
      } catch {
        /* not a navigable link */
      }
    }
    track("UI control activated", properties);
  };
  const change = (event: Event) => {
    if (
      !(event.target instanceof Element) ||
      event.target.closest(".heap-ignore,[data-analytics-ignore]")
    )
      return;
    track("UI field changed", {
      control:
        event.target.getAttribute("aria-label") ||
        event.target.tagName.toLowerCase(),
    });
  };
  const progress = new WeakMap<Element, number>();
  const scroll = (event: Event) => {
    const el = event.target;
    if (
      !(el instanceof HTMLElement) ||
      el.closest(".heap-ignore") ||
      !el.matches(
        ".detail-scroll,.artwork-list,.about-scroll,.certificate-scroll",
      )
    )
      return;
    const range = el.scrollHeight - el.clientHeight;
    if (range <= 0) return;
    const bucket = Math.floor((el.scrollTop / range) * 4) * 25;
    if (bucket < 25 || bucket <= (progress.get(el) || 0)) return;
    progress.set(el, bucket);
    track("Panel scrolled", {
      surface:
        el.closest<HTMLElement>("[data-analytics-surface]")?.dataset
          .analyticsSurface || "panel",
      progress_percent: bucket,
    });
  };
  doc.addEventListener("click", click, true);
  doc.addEventListener("change", change, true);
  doc.addEventListener("scroll", scroll, true);
  return () => {
    doc.removeEventListener("click", click, true);
    doc.removeEventListener("change", change, true);
    doc.removeEventListener("scroll", scroll, true);
  };
}

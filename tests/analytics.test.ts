import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanProperties,
  installHeap,
  setAnalyticsContext,
  track,
} from "../src/lib/analytics.ts";
import { attachMapAnalytics } from "../src/lib/map-analytics.ts";

test("analytics drops precise coordinates, free text, non-finite values and nulls", () => {
  assert.deepEqual(
    cleanProperties({
      artwork_id: "loop",
      seen_count: 2,
      latitude: 53.4,
      longitude: -2.9,
      note: "private",
      query: "private",
      duration_ms: Infinity,
      status: null,
    }),
    { artwork_id: "loop", seen_count: 2 },
  );
});
test("Heap EU loader is gated, idempotent, bounded and replays into the ready SDK", () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
    oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const scripts: any[] = [];
  const win: any = { location: { hostname: "127.0.0.1" } };
  Object.defineProperty(globalThis, "window", {
    value: win,
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: {
      createElement: () => ({}),
      head: { append: (s: any) => scripts.push(s) },
    },
    configurable: true,
  });
  try {
    installHeap(false);
    assert.equal(scripts.length, 0);
    installHeap(true);
    installHeap(true);
    assert.equal(scripts.length, 1);
    assert.equal(
      scripts[0].src,
      "https://cdn.eu.heap-api.com/config/442235230/heap_config.js",
    );
    assert.equal(scripts[0].async, true);
    assert.equal(win.heap.clientConfig.disableTextCapture, true);
    setAnalyticsContext({ artwork_id: "loop", seen_count: 3, latitude: 53 });
    track("Artwork opened");
    const seen: any[] = [];
    const original = win.heap.track;
    win.heap.track = (...args: any[]) => seen.push(args);
    win.heapReadyCb[0].fn();
    assert.equal(seen[0][0], "Artwork opened");
    assert.equal(seen[0][1].environment, "local-preview");
    assert.equal(seen[0][1].latitude, undefined);
    win.heap.track = original;
    for (let i = 0; i < 1000; i++) track("Map gesture");
    assert.equal(win.heapReadyCb.length, 200);
    win.heap.init("442235230");
    assert.equal(win.heapReadyCb.at(-1).name, "init");
    win.heap.track = () => {
      throw new Error("blocked");
    };
    assert.doesNotThrow(() => track("UI control activated"));
  } finally {
    setAnalyticsContext({});
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else delete (globalThis as any).window;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete (globalThis as any).document;
  }
});
function harness() {
  const host = new EventTarget();
  const canvas = {} as HTMLElement;
  const events: any[] = [];
  const cleanup = attachMapAnalytics(
    canvas,
    host as Window,
    () => "close",
    (name, p) => events.push({ name, ...p }),
  );
  const fire = (type: string, props: Record<string, unknown> = {}) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperty(e, "target", { value: canvas });
    Object.assign(e, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 0,
      clientY: 0,
      ...props,
    });
    host.dispatchEvent(e);
    return e;
  };
  return { events, fire, cleanup };
}
test("map taps stay silent; many drag frames produce one completed gesture", () => {
  const h = harness();
  h.fire("pointerdown");
  h.fire("pointerup");
  assert.equal(h.events.length, 0);
  h.fire("pointerdown");
  for (let i = 1; i <= 120; i++)
    assert.equal(h.fire("pointermove", { clientX: i }).defaultPrevented, false);
  assert.equal(h.events.length, 0);
  h.fire("pointerup");
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].gestures, "pan");
  assert.equal(h.events[0].distance_px, 120);
  h.cleanup();
  h.fire("pointerdown");
  h.fire("pointermove", { clientX: 50 });
  h.fire("pointerup");
  assert.equal(h.events.length, 1);
});
test("multi-touch reports pinch and rotation once; cancellation and mouse rotate are recorded", () => {
  const h = harness();
  h.fire("pointerdown");
  h.fire("pointerdown", { pointerId: 2, clientX: 100 });
  h.fire("pointermove", { pointerId: 2, clientX: 150, clientY: 30 });
  h.fire("pointerup");
  assert.equal(h.events.length, 0);
  h.fire("pointercancel", { pointerId: 2 });
  assert.equal(h.events[0].max_pointers, 2);
  assert.equal(h.events[0].gestures, "rotate,tilt,zoom");
  assert.equal(h.events[0].cancelled, true);
  h.fire("pointerdown", { pointerType: "mouse", button: 2 });
  h.fire("pointermove", { clientX: 50 });
  h.fire("pointerup");
  assert.equal(h.events[1].gestures, "rotate");
  h.cleanup();
});
test("wheel and keyboard are debounced, and cleanup cancels delayed events", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness();
  for (let i = 0; i < 40; i++) h.fire("wheel", { deltaY: -2, ctrlKey: true });
  assert.equal(h.events.length, 0);
  t.mock.timers.tick(301);
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].input, "trackpad-pinch");
  assert.equal(h.events[0].wheel_direction, "in");
  h.fire("keydown", { key: "ArrowLeft" });
  h.fire("keydown", { key: "+" });
  t.mock.timers.tick(301);
  assert.equal(h.events[1].gestures, "pan,zoom");
  h.fire("wheel", { deltaY: 10 });
  h.cleanup();
  t.mock.timers.tick(500);
  assert.equal(h.events.length, 2);
});

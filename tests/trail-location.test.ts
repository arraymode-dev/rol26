import test from "node:test";
import assert from "node:assert/strict";
import {
  createTrailLocation,
  LOCATION_MAX_AGE,
} from "../src/lib/trail-location.ts";
import { project } from "../src/lib/geo.ts";

function gps() {
  const watches: {
    success: PositionCallback;
    error: PositionErrorCallback | null;
    options?: PositionOptions;
  }[] = [];
  const cleared: number[] = [];
  return {
    watches,
    cleared,
    watchPosition(
      success: PositionCallback,
      error: PositionErrorCallback | null = null,
      options?: PositionOptions,
    ) {
      watches.push({ success, error, options });
      return watches.length - 1;
    },
    clearWatch(id: number) {
      cleared.push(id);
    },
    fix(id = 0, timestamp = Date.now(), longitude = -2.992, latitude = 53.404) {
      watches[id].success({
        coords: { longitude, latitude, accuracy: 8 },
        timestamp,
      } as GeolocationPosition);
    },
    fail(code: number, id = 0) {
      watches[id].error?.({ code } as GeolocationPositionError);
    },
  };
}

test("GPS stays off until trail tracking starts, then projects a real fix onto the map", () => {
  const store = createTrailLocation(),
    provider = gps();
  assert.equal(store.getSnapshot().status, "off");
  assert.equal(provider.watches.length, 0);
  store.start(provider);
  assert.equal(store.getSnapshot().status, "locating");
  assert.deepEqual(provider.watches[0].options, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
  });
  provider.fix();
  const fix = store.getSnapshot().fix!;
  assert.equal(store.getSnapshot().status, "active");
  assert.equal(fix.accuracy, 8);
  const [x, z] = project(fix.longitude, fix.latitude);
  assert.equal(Math.abs(x) + Math.abs(z), 0);
  store.stop();
});

test("leaving trail mode clears watch ID zero, erases the fix and ignores late callbacks", () => {
  const store = createTrailLocation(),
    provider = gps();
  store.start(provider);
  provider.fix();
  store.stop();
  assert.deepEqual(provider.cleared, [0]);
  provider.fix();
  provider.fail(1);
  assert.deepEqual(store.getSnapshot(), { status: "off", fix: null });
});

test("background pause and retry retain only one watch and reject callbacks from older sessions", () => {
  const store = createTrailLocation(),
    provider = gps();
  store.start(provider);
  provider.fix();
  store.stop("paused");
  assert.deepEqual(store.getSnapshot(), { status: "paused", fix: null });
  store.start(provider);
  provider.fix(0);
  assert.equal(store.getSnapshot().status, "locating");
  provider.fix(1);
  assert.equal(store.getSnapshot().status, "active");
  store.start(provider);
  assert.deepEqual(provider.cleared, [0, 1]);
  store.stop();
});

test("permission denial stops GPS, while transient errors can recover on the same watch", () => {
  const store = createTrailLocation(),
    provider = gps();
  store.start(provider);
  provider.fail(1);
  assert.equal(store.getSnapshot().status, "denied");
  assert.deepEqual(provider.cleared, [0]);
  store.start(provider);
  provider.fail(3, 1);
  assert.equal(store.getSnapshot().status, "timeout");
  provider.fix(1);
  assert.equal(store.getSnapshot().status, "active");
  provider.fail(2, 1);
  assert.deepEqual(store.getSnapshot(), { status: "unavailable", fix: null });
  provider.fix(1);
  assert.equal(store.getSnapshot().status, "active");
  store.stop();
});

test("insecure and unsupported contexts never start a watch", () => {
  const store = createTrailLocation(),
    provider = gps();
  store.start(provider, false);
  assert.equal(store.getSnapshot().status, "insecure");
  assert.equal(provider.watches.length, 0);
  store.start(undefined);
  assert.equal(store.getSnapshot().status, "unsupported");
});

test("old or invalid fixes never render as a live location; fresh fixes expire", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 });
  const store = createTrailLocation(),
    provider = gps();
  store.start(provider);
  provider.fix(0, Date.now() - LOCATION_MAX_AGE);
  assert.deepEqual(store.getSnapshot(), { status: "stale", fix: null });
  provider.fix(0, Date.now(), NaN);
  assert.deepEqual(store.getSnapshot(), { status: "unavailable", fix: null });
  provider.fix();
  assert.equal(store.getSnapshot().status, "active");
  t.mock.timers.tick(LOCATION_MAX_AGE);
  assert.deepEqual(store.getSnapshot(), { status: "stale", fix: null });
  store.stop();
});

test("field refresh requests high accuracy without accepting cached positions", () => {
  const store = createTrailLocation(),
    provider = gps();
  store.start(provider, true, 0);
  assert.equal(provider.watches[0].options?.enableHighAccuracy, true);
  assert.equal(provider.watches[0].options?.maximumAge, 0);
  store.stop();
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_START,
  EVENT_END,
  eventCountdown,
  attachOverviewDismiss,
} from "../src/lib/event-countdown.ts";

test("countdown targets the official 5pm BST opening, rounding up partial minutes", () => {
  assert.equal(EVENT_START, Date.parse("2026-10-23T16:00:00Z"));
  assert.deepEqual(
    eventCountdown(EVENT_START - (2 * 1440 + 3 * 60 + 4) * 60000),
    { phase: "upcoming", days: 2, hours: 3, minutes: 4 },
  );
  assert.deepEqual(eventCountdown(EVENT_START - 1), {
    phase: "upcoming",
    days: 0,
    hours: 0,
    minutes: 1,
  });
});
test("festival remains visible after opening and counts to the GMT closing time", () => {
  assert.deepEqual(eventCountdown(EVENT_START), {
    phase: "during",
    days: 9,
    hours: 5,
    minutes: 0,
  });
  assert.equal(EVENT_END, Date.parse("2026-11-01T21:00:00Z"));
  // Repeated 1:30am across the clock change must differ by a real hour.
  const before = eventCountdown(Date.parse("2026-10-25T01:30:00+01:00"));
  const after = eventCountdown(Date.parse("2026-10-25T01:30:00+00:00"));
  assert.equal(before.hours - after.hours, 1);
  assert.equal(
    eventCountdown(Date.parse("2026-10-28T12:00:00Z")).phase,
    "during",
  );
});
test("closing and expired dates never show a negative countdown", () => {
  for (const now of [EVENT_END, EVENT_END + 86400000])
    assert.deepEqual(eventCountdown(now), {
      phase: "ended",
      days: 0,
      hours: 0,
      minutes: 0,
    });
});
const send = (canvas: EventTarget, type: string, props: object = {}) =>
  canvas.dispatchEvent(Object.assign(new Event(type), props));
test("mouse and touch movement dismiss once; taps and sub-threshold jitter do not", () => {
  for (const pointerType of ["mouse", "touch"]) {
    const canvas = new EventTarget();
    let calls = 0;
    const detach = attachOverviewDismiss(canvas, () => calls++);
    send(canvas, "pointerdown", {
      pointerId: 1,
      pointerType,
      clientX: 20,
      clientY: 20,
    });
    send(canvas, "pointermove", {
      pointerId: 1,
      pointerType,
      clientX: 22,
      clientY: 20,
    });
    assert.equal(calls, 0);
    send(canvas, "pointerup", { pointerId: 1 });
    send(canvas, "pointermove", { pointerId: 1, clientX: 40, clientY: 20 });
    assert.equal(calls, 0);
    send(canvas, "pointerdown", { pointerId: 2, clientX: 20, clientY: 20 });
    send(canvas, "pointermove", { pointerId: 2, clientX: 25, clientY: 20 });
    send(canvas, "pointermove", { pointerId: 2, clientX: 30, clientY: 20 });
    assert.equal(calls, 1);
    detach();
  }
});
test("wheel and keyboard navigation dismiss; reset re-arms listeners and cleanup removes them", () => {
  const canvas = new EventTarget();
  let calls = 0;
  let detach = attachOverviewDismiss(canvas, () => calls++);
  send(canvas, "keydown", { key: "Tab" });
  send(canvas, "wheel", { deltaX: 0, deltaY: 0 });
  assert.equal(calls, 0);
  send(canvas, "wheel", { deltaX: 0, deltaY: 10 });
  assert.equal(calls, 1);
  detach();
  detach = attachOverviewDismiss(canvas, () => calls++);
  send(canvas, "keydown", { key: "ArrowLeft" });
  assert.equal(calls, 2);
  detach();
  send(canvas, "wheel", { deltaX: 0, deltaY: 10 });
  assert.equal(calls, 2);
});

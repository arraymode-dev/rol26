import test from "node:test";
import assert from "node:assert/strict";
import { expandOnScroll } from "../src/lib/expand-on-scroll.ts";

const content = () =>
  Object.assign(new EventTarget(), { scrollTop: 0 }) as HTMLElement;
const send = (el: HTMLElement, name: string, properties: object = {}) => {
  const event = Object.assign(
    new Event(name, { cancelable: true }),
    properties,
  );
  el.dispatchEvent(event);
  assert.equal(
    event.defaultPrevented,
    false,
    "native content scrolling must remain available",
  );
};
const touch = (x: number, y: number) => ({
  touches: [{ clientX: x, clientY: y }],
});

test("upward swipe expands once; taps, downward and horizontal swipes do not", () => {
  const el = content();
  let calls = 0;
  const cleanup = expandOnScroll(el, () => calls++);
  send(el, "touchstart", touch(50, 100));
  send(el, "touchmove", touch(52, 96));
  send(el, "touchmove", touch(10, 85));
  send(el, "touchmove", touch(50, 125));
  assert.equal(calls, 0);
  send(el, "touchmove", touch(52, 70));
  send(el, "touchmove", touch(52, 30));
  assert.equal(calls, 1);
  cleanup();
});
test("wheel and keyboard/native scrolling expand without consuming scrolling; reopening re-arms", () => {
  const el = content();
  let calls = 0;
  let cleanup = expandOnScroll(el, () => calls++);
  send(el, "wheel", { deltaX: 40, deltaY: 4 });
  send(el, "wheel", { deltaX: 0, deltaY: -30 });
  assert.equal(calls, 0);
  send(el, "wheel", { deltaX: 0, deltaY: 30 });
  send(el, "wheel", { deltaX: 0, deltaY: 100 });
  assert.equal(calls, 1);
  cleanup();
  el.scrollTop = 100;
  send(el, "scroll");
  assert.equal(calls, 1);
  cleanup = expandOnScroll(el, () => calls++);
  send(el, "scroll");
  assert.equal(
    calls,
    1,
    "restoring a scrolled panel does not immediately re-expand",
  );
  el.scrollTop = 130;
  send(el, "scroll");
  assert.equal(calls, 2);
  cleanup();
});
test("pinch and cancelled touches never expand the panel", () => {
  const el = content();
  let calls = 0;
  const cleanup = expandOnScroll(el, () => calls++);
  send(el, "touchstart", touch(50, 100));
  send(el, "touchmove", {
    touches: [
      { clientX: 50, clientY: 20 },
      { clientX: 90, clientY: 20 },
    ],
  });
  assert.equal(calls, 0);
  send(el, "touchcancel");
  send(el, "touchmove", touch(50, 20));
  assert.equal(calls, 0);
  cleanup();
});

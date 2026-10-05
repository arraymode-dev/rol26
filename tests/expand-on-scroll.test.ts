import test from "node:test";
import assert from "node:assert/strict";
import { expandOnScroll } from "../src/lib/expand-on-scroll.ts";

const content = () =>
  Object.assign(new EventTarget(), {
    scrollTop: 0,
    style: { overflowY: "auto" },
    parentElement: new EventTarget(),
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({
          transitionDuration: "0.26s, 0.26s",
          transitionDelay: "0s",
        }),
      },
    },
  }) as unknown as HTMLElement;
const send = (el: HTMLElement, name: string, properties: object = {}) => {
  const event = Object.assign(
    new Event(name, { cancelable: true }),
    properties,
  );
  el.dispatchEvent(event);
  return event;
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
test("wheel and keyboard/native scrolling expand once; reopening re-arms", () => {
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

const finish = (el: HTMLElement, propertyName = "height") => {
  el.parentElement!.dispatchEvent(
    Object.assign(new Event("transitionend"), { propertyName }),
  );
};
test("expansion consumes wheel and touch scrolling, then restores native scrolling", () => {
  const el = content();
  const cleanup = expandOnScroll(el, () => {});
  assert.equal(
    send(el, "wheel", { deltaX: 0, deltaY: 30 }).defaultPrevented,
    true,
  );
  assert.equal(el.style.overflowY, "hidden");
  assert.equal(send(el, "touchmove", touch(50, 20)).defaultPrevented, true);
  el.scrollTop = 75;
  send(el, "scroll");
  assert.equal(el.scrollTop, 0);
  finish(el, "opacity");
  assert.equal(el.style.overflowY, "hidden");
  finish(el);
  assert.equal(el.style.overflowY, "auto");
  assert.equal(
    send(el, "wheel", { deltaX: 0, deltaY: 30 }).defaultPrevented,
    false,
  );
  el.scrollTop = 100;
  send(el, "scroll");
  assert.equal(el.scrollTop, 100);
  cleanup();
});
test("triggering swipe is cancelled and cleanup unlocks an interrupted expansion", () => {
  const el = content();
  const cleanup = expandOnScroll(el, () => {});
  send(el, "touchstart", touch(50, 100));
  assert.equal(send(el, "touchmove", touch(50, 60)).defaultPrevented, true);
  cleanup();
  assert.equal(el.style.overflowY, "auto");
  assert.equal(
    send(el, "wheel", { deltaX: 0, deltaY: 30 }).defaultPrevented,
    false,
  );
});
test("fallback unlocks when no transition event arrives, including reduced motion", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const el = content();
  let cleanup = expandOnScroll(el, () => {});
  send(el, "wheel", { deltaX: 0, deltaY: 30 });
  t.mock.timers.tick(260);
  assert.equal(el.style.overflowY, "hidden");
  t.mock.timers.tick(80);
  assert.equal(el.style.overflowY, "auto");
  cleanup();
  Object.assign(el.ownerDocument.defaultView!, {
    getComputedStyle: () => ({
      transitionDuration: "0s",
      transitionDelay: "0s",
    }),
  });
  cleanup = expandOnScroll(el, () => {});
  send(el, "wheel", { deltaX: 0, deltaY: 30 });
  t.mock.timers.tick(0);
  assert.equal(el.style.overflowY, "auto");
  cleanup();
});

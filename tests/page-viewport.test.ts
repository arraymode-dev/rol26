import test from "node:test";
import assert from "node:assert/strict";
import { attachPageViewportGuard } from "../src/lib/page-viewport.ts";

function dispatch(target: EventTarget, type: string, properties = {}) {
  const event = Object.assign(
    new Event(type, { cancelable: true }),
    properties,
  );
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test("page zoom is cancelled while map events and normal panel scrolling remain available", () => {
  const target = new EventTarget();
  const cleanup = attachPageViewportGuard(target);
  let mapWheelEvents = 0;
  target.addEventListener("wheel", () => mapWheelEvents++);
  assert.equal(dispatch(target, "gesturestart"), true);
  assert.equal(dispatch(target, "gesturechange"), true);
  assert.equal(dispatch(target, "wheel", { ctrlKey: true }), true);
  assert.equal(
    mapWheelEvents,
    1,
    "camera handler still receives pinch wheel events",
  );
  assert.equal(dispatch(target, "wheel", { ctrlKey: false }), false);
  assert.equal(dispatch(target, "touchmove", { touches: [{}, {}] }), true);
  assert.equal(dispatch(target, "touchmove", { touches: [{}] }), false);
  assert.equal(
    dispatch(target, "pointermove", { pointerType: "touch" }),
    false,
  );
  for (const key of ["+", "=", "-", "0"])
    assert.equal(dispatch(target, "keydown", { key, metaKey: true }), true);
  assert.equal(dispatch(target, "keydown", { key: "+" }), false);
  assert.equal(dispatch(target, "keydown", { key: "ArrowDown" }), false);
  cleanup();
  assert.equal(dispatch(target, "gesturestart"), false);
  assert.equal(dispatch(target, "wheel", { ctrlKey: true }), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import {
  panelViewOffset,
  touchPair,
  twistDelta,
} from "../src/lib/touch-camera.ts";

test("pinch spread scales distance down and a twist crosses the angle seam without a full spin", () => {
  const a = touchPair({ x: 100, y: 200 }, { x: 200, y: 200 });
  const b = touchPair({ x: 50, y: 200 }, { x: 250, y: 200 });
  assert.equal((100 * a.span) / b.span, 50);
  assert.equal(b.y - a.y, 0);
  assert.ok(
    Math.abs(twistDelta(Math.PI - 0.01, -Math.PI + 0.01) - 0.02) < 1e-8,
  );
  assert.equal(touchPair({ x: 0, y: 0 }, { x: 0, y: 0 }).span, 1);
});

test("selected focal point projects into the free map above expanded and minimised mobile panels", () => {
  const camera = new PerspectiveCamera(42, 390 / 844, 1, 16000);
  camera.position.set(68, 90, 145);
  const focus = new Vector3(0, 18, 0);
  camera.lookAt(focus);
  camera.updateMatrixWorld();
  for (const panelTop of [388, 712]) {
    const offset = panelViewOffset(844, 56, panelTop);
    camera.setViewOffset(390, 844, 0, offset, 390, 844);
    const projected = focus.clone().project(camera);
    const screenY = ((1 - projected.y) * 844) / 2;
    assert.ok(Math.abs(screenY - (68 + panelTop - 12) / 2) < 0.01);
    assert.ok(screenY > 68 && screenY < panelTop - 12);
    assert.ok(Math.abs(projected.x) < 1e-8);
  }
  camera.clearViewOffset();
  assert.ok(Math.abs(focus.clone().project(camera).y) < 1e-8);
});

import { attachTouchCamera } from "../src/lib/touch-controls.ts";
import type { OrbitControls } from "three-stdlib";
class TouchSurface extends EventTarget {
  clientHeight = 844;
  captured = new Set<number>();
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
  pointer(type: string, id: number, x: number, y: number) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      pointerId: id,
      pointerType: "touch",
      clientX: x,
      clientY: y,
    });
    this.dispatchEvent(event);
  }
}
test("touch controller preserves taps, pans faster, pinches and resumes panning after a finger lifts", () => {
  const surface = new TouchSurface(),
    lifecycle = new EventTarget();
  const camera = new PerspectiveCamera(42, 390 / 844, 1, 16000);
  camera.position.set(0, 100, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const c = {
    target: new Vector3(),
    enabled: true,
    minDistance: 70,
    maxDistance: 3600,
    minPolarAngle: 0.15,
    maxPolarAngle: Math.PI * 0.43,
    update() {
      camera.lookAt(this.target);
      camera.updateMatrixWorld();
    },
  };
  let clicks = 0;
  const cleanup = attachTouchCamera(
    surface as unknown as HTMLCanvasElement,
    camera,
    () => c as OrbitControls,
    () => {},
    () => {},
    lifecycle,
    { reducedMotion: true },
  );
  surface.addEventListener("click", () => clicks++);
  surface.pointer("pointerdown", 1, 100, 200);
  surface.pointer("pointerup", 1, 100, 200);
  surface.dispatchEvent(new Event("click"));
  assert.equal(clicks, 1, "a tap still selects the artwork");
  const distance = camera.position.distanceTo(c.target);
  surface.pointer("pointerdown", 1, 100, 200);
  surface.pointer("pointermove", 1, 150, 200);
  const defaultPan =
    ((2 * distance * Math.tan((42 * Math.PI) / 360)) / 844) * 50;
  assert.ok(Math.abs(c.target.x + defaultPan * 1.65) < 1e-8);
  surface.pointer("pointerdown", 2, 250, 200);
  surface.pointer("pointermove", 2, 350, 200);
  assert.ok(
    Math.abs(camera.position.distanceTo(c.target) - distance / 2) < 1e-8,
  );
  const target = c.target.clone();
  surface.pointer("pointerup", 2, 350, 200);
  surface.pointer("pointermove", 1, 160, 200);
  assert.ok(c.target.distanceTo(target) > 0);
  assert.ok(
    Math.abs(camera.position.distanceTo(c.target) - distance / 2) < 1e-8,
  );
  surface.pointer("pointerup", 1, 160, 200);
  surface.dispatchEvent(new Event("click"));
  assert.equal(
    clicks,
    1,
    "a drag must not select an artwork or restart its camera",
  );
  surface.pointer("pointerdown", 3, 100, 100);
  lifecycle.dispatchEvent(new Event("blur"));
  assert.equal(surface.captured.size, 0);
  const stopped = camera.position.clone();
  surface.pointer("pointermove", 3, 300, 300);
  assert.deepEqual(camera.position.toArray(), stopped.toArray());
  cleanup();
});

function gestureHarness(reducedMotion = false) {
  const surface = new TouchSurface(),
    lifecycle = new EventTarget();
  const camera = new PerspectiveCamera(42, 390 / 844, 1, 16000);
  camera.position.set(0, 100, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const controls = {
    target: new Vector3(),
    enabled: true,
    minDistance: 70,
    maxDistance: 3600,
    minPolarAngle: 0.15,
    maxPolarAngle: Math.PI * 0.43,
    update() {
      camera.lookAt(this.target);
      camera.updateMatrixWorld();
    },
  };
  let time = 0,
    id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const cleanup = attachTouchCamera(
    surface as unknown as HTMLCanvasElement,
    camera,
    () => controls as OrbitControls,
    () => {},
    () => {},
    lifecycle,
    {
      reducedMotion,
      now: () => time,
      requestFrame: (callback) => {
        frames.set(++id, callback);
        return id;
      },
      cancelFrame: (id) => {
        frames.delete(id);
      },
    },
  );
  const tick = (ms: number) => {
    time += ms;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((f) => f(time));
  };
  const swipe = () => {
    surface.pointer("pointerdown", 1, 100, 200);
    tick(16);
    surface.pointer("pointermove", 1, 120, 200);
    tick(16);
    surface.pointer("pointermove", 1, 140, 200);
  };
  return { surface, lifecycle, camera, controls, frames, cleanup, tick, swipe };
}

test("one-finger throw coasts in the swipe direction, eases to rest and preserves zoom", () => {
  const h = gestureHarness();
  h.swipe();
  const before = h.controls.target.clone();
  const distance = h.camera.position.distanceTo(h.controls.target);
  h.surface.pointer("pointerup", 1, 140, 200);
  h.tick(16);
  const first = before.distanceTo(h.controls.target);
  assert.ok(first > 0);
  assert.ok(h.controls.target.x < before.x);
  const next = h.controls.target.clone();
  h.tick(16);
  assert.ok(next.distanceTo(h.controls.target) < first, "coasting slows down");
  for (let i = 0; i < 100; i++) h.tick(16);
  assert.equal(h.frames.size, 0, "animation stops requesting frames");
  assert.ok(
    Math.abs(h.camera.position.distanceTo(h.controls.target) - distance) < 1e-8,
  );
  h.cleanup();
});

test("throw stops on new input, cancellation, a paused release, reduced motion or cleanup", () => {
  for (const action of [
    "new-touch",
    "wheel",
    "pointerdown",
    "keydown",
    "blur",
    "cleanup",
    "stall",
  ]) {
    const h = gestureHarness();
    h.swipe();
    h.surface.pointer("pointerup", 1, 140, 200);
    h.tick(16);
    if (action === "new-touch") h.surface.pointer("pointerdown", 2, 100, 200);
    else if (action === "cleanup") h.cleanup();
    else if (action === "stall") h.tick(200);
    else h.lifecycle.dispatchEvent(new Event(action));
    const stopped = h.camera.position.clone();
    h.tick(16);
    assert.deepEqual(h.camera.position.toArray(), stopped.toArray(), action);
    assert.equal(h.frames.size, 0);
    h.cleanup();
  }
  for (const mode of ["paused", "cancelled", "reduced-motion"]) {
    const h = gestureHarness(mode === "reduced-motion");
    h.swipe();
    if (mode === "paused") h.tick(120);
    h.surface.pointer(
      mode === "cancelled" ? "pointercancel" : "pointerup",
      1,
      140,
      200,
    );
    assert.equal(h.frames.size, 0, mode);
    h.cleanup();
  }
});

test("clockwise finger twist rotates camera clockwise without changing pinch scale", () => {
  const h = gestureHarness();
  const distance = h.camera.position.distanceTo(h.controls.target);
  h.surface.pointer("pointerdown", 1, 100, 200);
  h.surface.pointer("pointerdown", 2, 200, 200);
  h.surface.pointer("pointermove", 2, 100, 300);
  const offset = h.camera.position.clone().sub(h.controls.target);
  assert.ok(Math.abs(Math.atan2(offset.x, offset.z) - Math.PI / 2) < 1e-8);
  assert.ok(Math.abs(offset.length() - distance) < 1e-8);
  h.surface.pointer("pointerup", 2, 100, 300);
  h.surface.pointer("pointerup", 1, 100, 200);
  assert.equal(h.frames.size, 0, "twisting does not cause a pan throw");
  h.cleanup();
});

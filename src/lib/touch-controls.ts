import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from "three";
import type { OrbitControls } from "three-stdlib";
import { touchPair, twistDelta, type TouchPoint } from "./touch-camera.ts";

interface TouchMotionOptions {
  reducedMotion?: boolean;
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

export function attachTouchCamera(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  getControls: () => OrbitControls | null,
  interrupt: () => void,
  invalidate: () => void,
  lifecycle: EventTarget = window,
  options: TouchMotionOptions = {},
) {
  const now = options.now ?? (() => performance.now());
  const requestFrame =
    options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
  const cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
  let frame: number | null = null;
  let sampleTime = 0,
    lastMove = 0,
    previousFrame = 0,
    panScale = 0;
  const velocity = new Vector3();
  const stopMomentum = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    velocity.set(0, 0, 0);
  };
  const coast = () => {
    frame = null;
    const c = getControls();
    const time = now(),
      dt = (time - previousFrame) / 1000;
    previousFrame = time;
    // A suspended tab must not jump forward when it wakes.
    if (!c?.enabled || dt > 0.1 || points.size) {
      stopMomentum();
      return;
    }
    const decay = Math.exp(-7 * dt);
    shift.copy(velocity).multiplyScalar((1 - decay) / 7);
    c.target.add(shift);
    camera.position.add(shift);
    velocity.multiplyScalar(decay);
    c.update();
    invalidate();
    if (velocity.length() > panScale * 8) frame = requestFrame(coast);
    else stopMomentum();
  };
  const points = new Map<number, TouchPoint>();
  let start: TouchPoint | null = null;
  let suppressClick = false;
  const offset = new Vector3(),
    right = new Vector3(),
    forward = new Vector3();
  const shift = new Vector3(),
    spherical = new Spherical();
  const down = (event: PointerEvent) => {
    stopMomentum();
    sampleTime = now();
    if (event.pointerType !== "touch") {
      suppressClick = false;
      return;
    }
    if (!points.size) {
      start = { x: event.clientX, y: event.clientY };
      suppressClick = false;
    }
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size > 1) suppressClick = true;
    interrupt();
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const old = points.get(event.pointerId),
      c = getControls();
    if (!old || !c || !c.enabled) return;
    event.preventDefault();
    const before = [...points.values()];
    const next = { x: event.clientX, y: event.clientY };
    points.set(event.pointerId, next);
    if (start && Math.hypot(next.x - start.x, next.y - start.y) > 5)
      suppressClick = true;
    offset.copy(camera.position).sub(c.target);
    if (points.size === 1) {
      // Ground-plane pan follows the camera heading, with more travel per swipe.
      const scale =
        ((2 *
          offset.length() *
          Math.tan(MathUtils.degToRad((camera as PerspectiveCamera).fov / 2))) /
          canvas.clientHeight) *
        1.65;
      right.setFromMatrixColumn(camera.matrix, 0).setY(0).normalize();
      forward.crossVectors(camera.up, right).normalize();
      shift
        .copy(right)
        .multiplyScalar(-(next.x - old.x) * scale)
        .addScaledVector(forward, (next.y - old.y) * scale);
      const time = now();
      const elapsed = Math.max(8, time - sampleTime);
      // Estimate release speed from recent movement, rather than total drag length.
      if (elapsed > 100) velocity.set(0, 0, 0);
      velocity.lerp(shift.clone().multiplyScalar(1000 / elapsed), 0.45);
      velocity.clampLength(0, scale * 1800);
      panScale = scale;
      sampleTime = lastMove = time;
      c.target.add(shift);
      camera.position.add(shift);
    } else if (points.size === 2) {
      const after = [...points.values()];
      const a = touchPair(before[0], before[1]),
        b = touchPair(after[0], after[1]);
      spherical.setFromVector3(offset);
      spherical.radius = MathUtils.clamp(
        (spherical.radius * a.span) / b.span,
        c.minDistance,
        c.maxDistance,
      );
      velocity.set(0, 0, 0);
      sampleTime = now();
      spherical.theta += twistDelta(a.angle, b.angle);
      spherical.phi = MathUtils.clamp(
        spherical.phi - ((b.y - a.y) * Math.PI) / canvas.clientHeight,
        c.minPolarAngle,
        c.maxPolarAngle,
      );
      camera.position.copy(c.target).add(offset.setFromSpherical(spherical));
    }
    c.update();
    invalidate();
  };
  const up = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    const release =
      points.size === 1 &&
      event.type === "pointerup" &&
      suppressClick &&
      !options.reducedMotion &&
      now() - lastMove < 90 &&
      velocity.length() > panScale * 60;
    points.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    // Remaining finger starts a fresh pan, without inheriting a pinch delta.
    start = points.size === 1 ? [...points.values()][0] : null;
    sampleTime = now();
    if (release) {
      previousFrame = now();
      frame = requestFrame(coast);
    } else stopMomentum();
  };
  const cancel = () => {
    stopMomentum();
    for (const id of [...points.keys()]) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    points.clear();
    start = null;
  };
  const click = (event: MouseEvent) => {
    if (suppressClick) {
      event.stopImmediatePropagation();
      suppressClick = false;
    }
  };
  canvas.addEventListener("pointerdown", down, true);
  canvas.addEventListener("pointermove", move, {
    capture: true,
    passive: false,
  });
  canvas.addEventListener("pointerup", up, true);
  canvas.addEventListener("pointercancel", up, true);
  canvas.addEventListener("lostpointercapture", up, true);
  canvas.addEventListener("click", click, true);
  lifecycle.addEventListener("blur", cancel);
  lifecycle.addEventListener("pagehide", cancel);
  lifecycle.addEventListener("pointerdown", stopMomentum, true);
  lifecycle.addEventListener("wheel", stopMomentum, true);
  lifecycle.addEventListener("keydown", stopMomentum, true);
  return () => {
    cancel();
    canvas.removeEventListener("pointerdown", down, true);
    canvas.removeEventListener("pointermove", move, true);
    canvas.removeEventListener("pointerup", up, true);
    canvas.removeEventListener("pointercancel", up, true);
    canvas.removeEventListener("lostpointercapture", up, true);
    canvas.removeEventListener("click", click, true);
    lifecycle.removeEventListener("blur", cancel);
    lifecycle.removeEventListener("pagehide", cancel);
    lifecycle.removeEventListener("pointerdown", stopMomentum, true);
    lifecycle.removeEventListener("wheel", stopMomentum, true);
    lifecycle.removeEventListener("keydown", stopMomentum, true);
  };
}

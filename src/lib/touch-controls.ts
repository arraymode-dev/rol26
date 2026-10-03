import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from "three";
import type { OrbitControls } from "three-stdlib";
import { touchPair, twistDelta, type TouchPoint } from "./touch-camera.ts";

export function attachTouchCamera(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  getControls: () => OrbitControls | null,
  interrupt: () => void,
  invalidate: () => void,
  lifecycle: EventTarget = window,
) {
  const points = new Map<number, TouchPoint>();
  let start: TouchPoint | null = null;
  let suppressClick = false;
  const offset = new Vector3(),
    right = new Vector3(),
    forward = new Vector3();
  const shift = new Vector3(),
    spherical = new Spherical();
  const down = (event: PointerEvent) => {
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
      spherical.theta -= twistDelta(a.angle, b.angle);
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
    points.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    // Remaining finger starts a fresh pan, without inheriting a pinch delta.
    start = points.size === 1 ? [...points.values()][0] : null;
  };
  const cancel = () => {
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
  return () => {
    canvas.removeEventListener("pointerdown", down, true);
    canvas.removeEventListener("pointermove", move, true);
    canvas.removeEventListener("pointerup", up, true);
    canvas.removeEventListener("pointercancel", up, true);
    canvas.removeEventListener("lostpointercapture", up, true);
    canvas.removeEventListener("click", click, true);
    lifecycle.removeEventListener("blur", cancel);
  };
}

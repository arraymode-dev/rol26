import { PerspectiveCamera, Vector3 } from "three";

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/** Allow a little breathing room beyond the fitted route, not an empty city view. */
export function trailZoomLimit(pose: CameraPose): number {
  return (
    new Vector3(...pose.position).distanceTo(new Vector3(...pose.target)) * 1.08
  );
}

/** Fit the whole route with space around its markers, including portrait screens. */
export function trailCameraPose(
  points: [number, number][],
  aspect: number,
  fov = 42,
): CameraPose {
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2;
  const z = (Math.min(...zs) + Math.max(...zs)) / 2;
  const target = new Vector3(x, 0, z);
  // Fixed bearing follows the Pier Head quay (about 0.4 m east per metre south).
  // Its edge is horizontal on wide screens, vertical on phones, regardless of
  // the angle the visitor was using before opening the trail.
  const horizontal =
    aspect >= 1 ? new Vector3(-1, 0, 0.4) : new Vector3(0.4, 0, 1);
  const direction = horizontal
    .normalize()
    .multiplyScalar(0.16)
    .add(new Vector3(0, 1, 0))
    .normalize();
  const probe = new PerspectiveCamera(fov, aspect, 1, 16000);
  let distance = 1000;
  // Projection accounts for the slight tilt, rather than estimating a flat rectangle.
  for (let step = 0; step < 40; step++) {
    probe.position.copy(target).addScaledVector(direction, distance);
    probe.lookAt(target);
    probe.updateMatrixWorld();
    if (
      points.every(([px, pz]) => {
        const p = new Vector3(px, 30, pz).project(probe);
        return Math.abs(p.x) <= 0.78 && Math.abs(p.y) <= 0.72 && p.z < 1;
      })
    )
      break;
    distance *= 1.08;
  }
  return {
    position: target.clone().addScaledVector(direction, distance).toArray(),
    target: target.toArray(),
  };
}

export function sameCameraPose(a: CameraPose, b: CameraPose): boolean {
  return (
    new Vector3(...a.position).distanceTo(new Vector3(...b.position)) < 0.5 &&
    new Vector3(...a.target).distanceTo(new Vector3(...b.target)) < 0.5
  );
}

/** During the automatic flight, compare its destination; otherwise compare the live view. */
export function shouldRestoreTrailView(
  current: CameraPose,
  birdseye: CameraPose,
  destination?: CameraPose,
): boolean {
  return sameCameraPose(destination ?? current, birdseye);
}

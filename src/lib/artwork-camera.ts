import { MathUtils, Vector3 } from "three";

/** Approach along the visitor's existing line to the artwork, avoiding a forced orbit. */
export function approachArtwork(
  currentPosition: Vector3,
  currentTarget: Vector3,
  focus: Vector3,
  preferredDistance: number,
): Vector3 {
  const offset = currentPosition.clone().sub(focus);
  let horizontal = Math.hypot(offset.x, offset.z);
  // A directly overhead view has no meaningful bearing: retain the viewing heading.
  if (horizontal < 1) {
    const previous = currentPosition.clone().sub(currentTarget);
    offset.x = previous.x;
    offset.z = previous.z;
    horizontal = Math.hypot(offset.x, offset.z);
  }
  if (horizontal < 0.001) {
    offset.z = 1;
    horizontal = 1;
  }
  const elevation = MathUtils.clamp(
    Math.atan2(offset.y, horizontal),
    Math.PI / 10,
    Math.PI * 0.36,
  );
  const distance = MathUtils.clamp(
    Math.min(preferredDistance, currentPosition.distanceTo(focus)),
    75,
    360,
  );
  const groundDistance = Math.cos(elevation) * distance;
  return focus
    .clone()
    .add(
      new Vector3(
        (offset.x / horizontal) * groundDistance,
        Math.sin(elevation) * distance,
        (offset.z / horizontal) * groundDistance,
      ),
    );
}

/** Keep a two-sided artwork readable, choosing whichever face is nearest the approach. */
export function faceArtworkSurface(
  position: Vector3,
  focus: Vector3,
  normalBearing: number,
): Vector3 {
  const offset = position.clone().sub(focus);
  const bearing = Math.atan2(offset.x, offset.z);
  const face =
    Math.cos(bearing - normalBearing) >= 0
      ? normalBearing
      : normalBearing + Math.PI;
  const difference =
    MathUtils.euclideanModulo(bearing - face + Math.PI, Math.PI * 2) - Math.PI;
  const heading = face + MathUtils.clamp(difference, -Math.PI / 6, Math.PI / 6);
  const radius = Math.hypot(offset.x, offset.z);
  return focus
    .clone()
    .add(
      new Vector3(
        Math.sin(heading) * radius,
        offset.y,
        Math.cos(heading) * radius,
      ),
    );
}

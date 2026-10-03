export type TouchPoint = { x: number; y: number };
export function touchPair(a: TouchPoint, b: TouchPoint) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    span: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}
export function twistDelta(previous: number, next: number) {
  return Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
}
/** Shift the optical centre into the unobscured map, without changing its bearing. */
export function panelViewOffset(
  height: number,
  headerBottom: number,
  panelTop: number,
) {
  const top = Math.min(headerBottom + 12, height * 0.25);
  const bottom = Math.max(top + 60, panelTop - 12);
  return height / 2 - (top + bottom) / 2;
}

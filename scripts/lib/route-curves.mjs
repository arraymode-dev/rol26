const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function deviation(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1),
    ),
  );
  return distance(p, mix(a, b, t));
}
/** Keep the surveyed route corridor, removing small mapping zigzags only when
 * the replacement is clear. Round retained turns with densely sampled Beziers. */
export function smoothRoute(input, clear = () => true, tolerance = 2.5) {
  const points = input.filter((p, i) => !i || distance(p, input[i - 1]) > 0.01);
  if (points.length < 3) return points;
  function simplify(ps) {
    if (ps.length < 3) return ps;
    let max = -1,
      split = 1;
    for (let i = 1; i < ps.length - 1; i++) {
      const d = deviation(ps[i], ps[0], ps.at(-1));
      if (d > max) {
        max = d;
        split = i;
      }
    }
    if (max <= tolerance && clear(ps[0], ps.at(-1))) return [ps[0], ps.at(-1)];
    return [
      ...simplify(ps.slice(0, split + 1)).slice(0, -1),
      ...simplify(ps.slice(split)),
    ];
  }
  const anchors = simplify(points),
    result = [anchors[0]];
  for (let i = 1; i < anchors.length - 1; i++) {
    const a = anchors[i - 1],
      b = anchors[i],
      c = anchors[i + 1];
    const la = distance(a, b),
      lc = distance(b, c);
    let trim = Math.min(8, la * 0.4, lc * 0.4),
      curve = [];
    while (trim > 0.15) {
      const start = mix(b, a, trim / la),
        end = mix(b, c, trim / lc);
      const steps = Math.max(12, Math.ceil((trim * 2) / 0.4));
      curve = Array.from({ length: steps + 1 }, (_, k) => {
        const t = k / steps;
        return start.map(
          (v, j) => (1 - t) ** 2 * v + 2 * (1 - t) * t * b[j] + t * t * end[j],
        );
      });
      if (curve.slice(1).every((p, j) => clear(curve[j], p))) break;
      trim *= 0.5;
      curve = [];
    }
    result.push(...(curve.length ? curve : [b]));
  }
  result.push(anchors.at(-1));
  return result.filter((p, i) => !i || distance(p, result[i - 1]) > 0.001);
}

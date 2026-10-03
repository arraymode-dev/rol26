import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type RideKind = "wheel" | "carousel";
export function rideActive(
  kind: RideKind,
  distance: number,
  active: boolean,
  reducedMotion: boolean,
  visible: boolean,
) {
  const limit = kind === "wheel" ? (active ? 260 : 220) : active ? 190 : 160;
  return !reducedMotion && visible && distance < limit;
}
export function rideAngle(angle: number, delta: number, kind: RideKind) {
  // Resuming a demand-rendered scene must never jump after an idle interval.
  return (
    (angle +
      Math.min(Math.max(delta, 0), 0.05) * (kind === "wheel" ? 0.055 : 0.13)) %
    (Math.PI * 2)
  );
}
export function cabinPosition(
  index: number,
  angle: number,
): [number, number, number] {
  const a = (index * Math.PI) / 18 + angle;
  return [29 * Math.cos(a), 29 * Math.sin(a), 0];
}
const C = {
  ivory: "#dadbd5",
  dark: "#263541",
  glass: "#53758a",
  gold: "#c7994b",
  red: "#af3948",
  cream: "#ead8a5",
  bulb: "#ffe7b0",
  white: "#e2f1ff",
};
export function buildRide(kind: RideKind) {
  const parts = new Map<string, T.BufferGeometry[]>();
  const add = (
    g: T.BufferGeometry,
    p: number[],
    colour: string,
    layer = "rotor",
    glow = false,
    rotation?: T.Euler,
  ) => {
    if (rotation) g.applyQuaternion(new T.Quaternion().setFromEuler(rotation));
    g.translate(p[0], p[1], p[2]);
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    n.deleteAttribute("uv");
    const c = new T.Color(colour),
      v = new Float32Array(n.getAttribute("position").count * 3);
    for (let i = 0; i < v.length; i += 3) {
      v[i] = c.r;
      v[i + 1] = c.g;
      v[i + 2] = c.b;
    }
    n.setAttribute("color", new T.BufferAttribute(v, 3));
    n.setAttribute(
      "cameraProtected",
      new T.BufferAttribute(
        new Float32Array(n.getAttribute("position").count).fill(1),
        1,
      ),
    );
    const key = layer + (glow ? ":glow" : ":paint");
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key)!.push(n);
  };
  const box = (
    p: number[],
    size: [number, number, number],
    c: string,
    layer = "rotor",
  ) => add(new T.BoxGeometry(...size), p, c, layer);
  const beam = (
    a: number[],
    b: number[],
    r: number,
    c: string,
    layer = "rotor",
  ) => {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      d = bv.clone().sub(av);
    const g = new T.CylinderGeometry(r, r, d.length(), 6, 1, true);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    add(g, av.add(bv).multiplyScalar(0.5).toArray(), c, layer);
  };
  const bulb = (p: number[], r: number, c: string, layer = "rotor") =>
    add(new T.IcosahedronGeometry(r, 0), p, c, layer, true);
  const cyl = (
    p: number[],
    r: number,
    h: number,
    c: string,
    layer = "rotor",
    n = 32,
  ) => add(new T.CylinderGeometry(r, r, h, n), p, c, layer);
  if (kind === "wheel") {
    // Wheel-local origin is the axle: frame stays put while rim/spokes rotate.
    for (const depth of [-1, 1]) {
      add(new T.TorusGeometry(29, 0.19, 6, 96), [0, 0, depth], C.ivory);
      add(new T.TorusGeometry(27.9, 0.08, 5, 96), [0, 0, depth], C.ivory);
      for (let i = 0; i < 72; i++) {
        const a = (i * Math.PI) / 36;
        bulb([29 * Math.cos(a), 29 * Math.sin(a), depth], 0.14, C.white);
      }
    }
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI) / 18,
        x = 29 * Math.cos(a),
        y = 29 * Math.sin(a);
      for (const z of [-1, 1]) beam([0, 0, z], [x, y, z], 0.045, C.ivory);
      beam([x, y, -1], [x, y, 1], 0.07, C.ivory);
      if (i % 3 === 0)
        for (let j = 1; j < 6; j++)
          bulb([(x * j) / 6, (y * j) / 6, 1.04], 0.1, C.white);
    }
    for (const side of [-1, 1])
      for (const depth of [-6, 6]) {
        beam(
          [side * 10, -30.45, depth],
          [0, 0, side * 1.8],
          0.34,
          C.ivory,
          "static",
        );
        box([side * 10, -30.35, depth], [2.2, 0.35, 2], C.dark, "static");
      }
    add(
      new T.CylinderGeometry(1.4, 1.4, 5, 20),
      [0, 0, 0],
      C.ivory,
      "static",
      false,
      new T.Euler(Math.PI / 2, 0, 0),
    );
    for (const z of [-2.55, 2.55]) bulb([0, 0, z], 0.6, C.white, "static");
    box([0, -30.2, 0], [13, 0.6, 7], C.dark, "static");
    // One upright capsule geometry instanced around the moving rim.
    box([0, -0.75, 0], [1.5, 1.45, 2.45], C.glass, "cabin");
    box([0, 0.04, 0], [1.72, 0.2, 2.65], C.ivory, "cabin");
    box([0, -1.55, 0], [1.65, 0.3, 2.6], C.ivory, "cabin");
    for (const x of [-0.76, 0.76])
      for (const z of [-1.23, 0, 1.23])
        box([x, -0.7, z], [0.075, 1.6, 0.075], C.ivory, "cabin");
    for (const z of [-1.24, 1.24])
      box([0, -0.75, z], [1.55, 0.08, 0.065], C.ivory, "cabin");
    for (const z of [-1.33, 1.33])
      for (const x of [-0.62, 0.62]) bulb([x, -1.38, z], 0.1, C.bulb, "cabin");
  } else {
    cyl([0, 0.68, 0], 5.65, 0.32, C.gold, "static");
    cyl([0, 0.95, 0], 5.5, 0.35, C.red);
    cyl([0, 1.17, 0], 5.3, 0.09, C.cream);
    cyl([0, 2.95, 0], 0.65, 3.5, C.gold, "static");
    cyl([0, 4.8, 0], 5.5, 0.55, C.cream);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        b = ((i + 1) * Math.PI) / 12;
      const g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.Float32BufferAttribute(
          [
            0,
            6.2,
            0,
            5.5 * Math.cos(b),
            5.08,
            5.5 * Math.sin(b),
            5.5 * Math.cos(a),
            5.08,
            5.5 * Math.sin(a),
          ],
          3,
        ),
      );
      g.computeVertexNormals();
      add(g, [0, 0, 0], i % 2 ? C.red : C.gold);
      const x = 5.45 * Math.cos(a),
        z = 5.45 * Math.sin(a);
      bulb([x, 4.72, z], 0.095, C.bulb);
      bulb([x, 1.03, z], 0.08, C.bulb);
      if (i % 2 === 0) {
        beam([0, 6.23, 0], [x, 5.12, z], 0.035, C.gold);
        for (let j = 1; j < 5; j++)
          bulb([(x * j) / 5, 6.23 - (1.11 * j) / 5, (z * j) / 5], 0.07, C.bulb);
      }
    }
    bulb([0, 6.4, 0], 0.18, C.bulb);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        r = i % 2 ? 3.4 : 4.35;
      const local = (x: number, y: number, z: number) => [
        r * Math.cos(a) + x * Math.cos(a) - z * Math.sin(a),
        y,
        r * Math.sin(a) + x * Math.sin(a) + z * Math.cos(a),
      ];
      beam(local(0, 1.2, 0), local(0, 4.5, 0), 0.045, C.gold);
      const horse = (
        p: number[],
        s: [number, number, number],
        colour: string,
      ) => {
        const g = new T.IcosahedronGeometry(1, 1);
        g.scale(...s);
        g.rotateY(-a);
        add(g, local(p[0], p[1], p[2]), colour);
      };
      // Rounded body, raised neck, muzzle, ears, bent legs, tail and saddle.
      horse([0, 2.2, 0], [0.3, 0.32, 0.68], C.cream);
      horse([0, 2.56, 0.47], [0.19, 0.48, 0.2], C.cream);
      horse([0, 2.88, 0.68], [0.2, 0.2, 0.35], C.cream);
      horse([0, 2.49, -0.08], [0.31, 0.09, 0.3], i % 2 ? C.red : C.glass);
      for (const side of [-1, 1]) {
        beam(
          local(side * 0.19, 2.05, 0.36),
          local(side * 0.22, 1.73, 0.5),
          0.065,
          C.cream,
        );
        beam(
          local(side * 0.22, 1.73, 0.5),
          local(side * 0.22, 1.42, 0.25),
          0.06,
          C.cream,
        );
        beam(
          local(side * 0.19, 2.07, -0.43),
          local(side * 0.24, 1.45, -0.65),
          0.065,
          C.cream,
        );
        beam(
          local(side * 0.1, 3.01, 0.54),
          local(side * 0.13, 3.24, 0.48),
          0.065,
          C.cream,
        );
      }
      beam(local(0, 2.28, -0.62), local(0, 1.8, -0.92), 0.12, C.gold);
    }
  }
  return [...parts].map(([key, geometries]) => {
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach((g) => g.dispose());
    const [layer, material] = key.split(":");
    return { geometry, layer, glow: material === "glow" };
  });
}

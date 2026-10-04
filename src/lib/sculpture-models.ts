import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
type V = [number, number, number];
export const BATCHED_SCULPTURES = [
  "flower-power",
  "loop",
  "today-i-love-you",
  "invisible-cities",
  "coloured-peonies",
  "unity",
  "colour-rush",
  "the-stars-come-out-at-night",
  "dream-herd",
  "pop",
];
// Photo-informed silhouettes, in metres. Two vertex-coloured batches per artwork;
// no per-petal materials, lights, shadow maps, or animation loops.
export function buildSculpture(id: string, detailed = true) {
  const parts: T.BufferGeometry[][] = [[], []];
  const sides = detailed ? 10 : 5;
  function add(
    g: T.BufferGeometry,
    p: V,
    s: V,
    color: string,
    glow = false,
    rot: V = [0, 0, 0],
  ) {
    g.scale(...s);
    g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rot)));
    g.translate(...p);
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute("uv");
    const c = new T.Color(color),
      colors = new Float32Array(n.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = c.r;
      colors[i + 1] = c.g;
      colors[i + 2] = c.b;
    }
    n.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts[+glow].push(n);
    if (n !== g) g.dispose();
  }
  const box = (p: V, s: V, c: string, glow = false, rot: V = [0, 0, 0]) =>
    add(new T.BoxGeometry(1, 1, 1), p, s, c, glow, rot);
  const ball = (p: V, s: V, c: string, glow = false) =>
    add(new T.IcosahedronGeometry(1, detailed ? 1 : 0), p, s, c, glow);
  const rod = (a: V, b: V, r: number, c: string, glow = false) => {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      v = bv.clone().sub(av);
    const g = new T.CylinderGeometry(r, r, v.length(), sides);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        v.normalize(),
      ),
    );
    add(g, av.add(bv).multiplyScalar(0.5).toArray() as V, [1, 1, 1], c, glow);
  };
  const hoop = (
    p: V,
    r: number,
    tube: number,
    c: string,
    s: V = [1, 1, 1],
    rotation: V = [0, 0, 0],
    glow = true,
  ) =>
    add(
      new T.TorusGeometry(r, tube, detailed ? 5 : 3, detailed ? 32 : 14),
      p,
      s,
      c,
      glow,
      rotation,
    );
  const rainbow = [
    "#ff335c",
    "#ffb727",
    "#edfb48",
    "#41efa5",
    "#30ccff",
    "#8e65ff",
    "#f66cf3",
  ];
  if (id === "flower-power") {
    [
      [-14, -12],
      [0, -20],
      [14, -12],
      [-15, 0],
      [15, 0],
      [-11, 14],
      [11, 14],
    ].forEach(([x, z], i) => {
      const y = 9 + (i % 3) * 1.4;
      add(
        new T.CylinderGeometry(0.95, 0.65, 1.6, 8),
        [x, 0.8, z],
        [1, 1, 1],
        "#bc253c",
      );
      rod([x, 1, z], [x, y, z], 0.085, "#759086");
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5;
        hoop(
          [x + Math.sin(a) * 1.75, y + Math.cos(a) * 1.75, z],
          1,
          0.07,
          i % 2 ? "#ffd3f3" : "#c7fcff",
          [0.9, 1.65, 1],
          [0, 0, -a],
        );
      }
      hoop([x, y, z + 0.08], 0.55, 0.13, "#66e9ff");
      if (detailed)
        for (let j = 0; j < 5; j++)
          rod(
            [x - 0.35 + j * 0.175, y - 0.4, z + 0.09],
            [x - 0.35 + j * 0.175, y + 0.4, z + 0.09],
            0.045,
            "#9affc9",
            true,
          );
    });
  }
  if (id === "loop")
    for (let i = 0; i < 6; i++) {
      const x = ((i % 3) - 1) * 11,
        z = Math.floor(i / 3) * 11 - 5,
        y = 3.2;
      box([x, 0.25, z], [5.6, 0.5, 2.5], "#283c46");
      hoop([x, y, z], 2.9, 0.24, "#b5c8cb", [1, 1, 1], [0, 0, 0], false);
      hoop([x, y, z - 0.85], 2.9, 0.22, "#71848e", [1, 1, 1], [0, 0, 0], false);
      hoop([x, y, z + 0.16], 2.72, 0.095, "#eefff9");
      hoop([x, y, z - 0.98], 2.72, 0.075, "#ffc4f0");
      // Open drum: curved dark inner panels and a bench leave the wheel readable.
      add(
        new T.CylinderGeometry(
          2.78,
          2.78,
          0.8,
          detailed ? 32 : 14,
          1,
          true,
          0,
          Math.PI * 1.15,
        ),
        [x, y, z - 0.4],
        [1, 1, 1],
        "#24333c",
        false,
        [Math.PI / 2, 0, 0],
      );
      box([x, 1.4, z], [3.2, 0.28, 1.2], "#c3c8be");
      if (detailed)
        for (let j = 0; j < 14; j++) {
          const a = (j * Math.PI * 2) / 14;
          box(
            [x + Math.sin(a) * 2.62, y + Math.cos(a) * 2.62, z - 0.05],
            [0.12, 0.34, 0.06],
            "#ddfcff",
            true,
            [0, 0, -a],
          );
        }
    }
  if (id === "today-i-love-you")
    for (let i = -3; i <= 3; i++)
      rod([i * 3, 0, 0], [i * 3, 3.8, 0], 0.045, "#596b6e");
  if (id === "invisible-cities")
    for (let i = 0; i < 15; i++) {
      const x = ((i % 5) - 2) * 4,
        z = (Math.floor(i / 5) - 1) * 5,
        levels = 3 + (i % 3);
      for (let j = 0; j < levels; j++) {
        const y = 1.3 + j * 2.5,
          c = rainbow[(i + j * 2) % rainbow.length];
        box([x - 1.1, y, z], [0.3, 2.1, 1.1], c, true);
        box([x + 1.1, y, z], [0.3, 2.1, 1.1], c, true);
        box([x, y - 1.05, z], [2.5, 0.3, 1.1], rainbow[(i + j + 2) % 7], true);
        box([x, y + 1.05, z], [2.5, 0.3, 1.1], c, true);
        if (detailed) {
          box([x, y + 1.22, z + 0.55], [2.5, 0.06, 0.06], "#d8fcff", true);
          box([x - 1.22, y, z + 0.56], [0.05, 2.5, 0.06], "#e6ffed", true);
        }
      }
    }
  if (id === "coloured-peonies")
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        r = i ? 5 + (i % 3) * 2 : 0,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        h = 7 + (i % 4) * 2;
      rod([x, 0, z], [x, h, z], 0.055, "#68ac91");
      add(
        new T.CylinderGeometry(1.15, 1.15, 0.5, 10),
        [x, 0.25, z],
        [1, 1, 1],
        "#263f42",
      );
      const layers = detailed ? 3 : 2;
      for (let layer = 0; layer < layers; layer++)
        for (let j = 0; j < (detailed ? 9 : 6); j++) {
          const t = (j * Math.PI * 2) / (detailed ? 9 : 6) + layer * 0.5,
            rr = 1.3 - layer * 0.4;
          const g = new T.SphereGeometry(
            1,
            detailed ? 7 : 4,
            4,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.8,
          );
          add(
            g,
            [x + Math.cos(t) * rr, h + layer * 0.35, z + Math.sin(t) * rr],
            [1.15 - layer * 0.18, 0.5, 0.9 - layer * 0.1],
            rainbow[(i + layer) % 7],
            true,
            [0.3 * Math.cos(t), t, 0.35 * Math.sin(t)],
          );
        }
      ball([x, h + 0.9, z], [0.4, 0.3, 0.4], "#fff0a6", true);
    }
  if (id === "unity")
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5,
        x = Math.sin(a) * 3.4,
        z = Math.cos(a) * 3.4;
      ball([x, 5.2, z], [1.2, 2.1, 1.2], "#e4edff", true);
      ball([x, 7.25, z], [1.35, 1.35, 1.35], "#f2f5ff", true);
      for (const side of [-1, 1]) {
        const tangent: V = [Math.cos(a) * side, 0, -Math.sin(a) * side];
        rod(
          [x + tangent[0] * 0.55, 3.8, z + tangent[2] * 0.55],
          [x + tangent[0] * 0.7, 0.35, z + tangent[2] * 0.7],
          0.48,
          "#e1eaff",
          true,
        );
        const next = ((i + side) * Math.PI * 2) / 5;
        rod(
          [x, 5.65, z],
          [(x + Math.sin(next) * 3.4) / 2, 5.7, (z + Math.cos(next) * 3.4) / 2],
          0.48,
          "#eeebff",
          true,
        );
        ball(
          [
            x - Math.sin(a) * 1.13 + tangent[0] * 0.34,
            7.35,
            z - Math.cos(a) * 1.13 + tangent[2] * 0.34,
          ],
          [0.15, 0.2, 0.15],
          "#172736",
        );
      }
      // Diamond panels under the linked arms recall the reference's patterned canopy.
      box(
        [x * 0.55, 5.7, z * 0.55],
        [2.3, 0.12, 2.3],
        i % 2 ? "#ed387b" : "#6a64ec",
        true,
        [0, a + Math.PI / 4, 0],
      );
    }
  if (id === "colour-rush") {
    add(
      new T.CylinderGeometry(2.6, 2.6, 0.65, 8),
      [0, 0.325, 0],
      [1, 1, 1],
      "#99b7c0",
    );
    const count = detailed ? 8 : 4;
    for (let face = 0; face < 8; face++)
      for (let strip = 0; strip < count; strip++)
        for (let band = 0; band < 7; band++) {
          const a = (face * Math.PI) / 4,
            u = ((strip - (count - 1) / 2) * 2.03) / count;
          box(
            [
              Math.sin(a) * 2.45 + Math.cos(a) * u,
              0.7 + band * 1.5 + 0.75,
              Math.cos(a) * 2.45 - Math.sin(a) * u,
            ],
            [(2.03 / count) * 0.88, 1.47, 0.06],
            rainbow[(strip + face * 3 + band * 2) % 7],
            true,
            [0, a, 0],
          );
        }
  }
  if (id === "the-stars-come-out-at-night") {
    add(
      new T.CylinderGeometry(2.9, 2.9, 5.8, 32),
      [0, 3.3, 0],
      [1, 1, 1],
      "#121b24",
    );
    add(
      new T.CylinderGeometry(3.25, 3.25, 0.4, 32),
      [0, 0.4, 0],
      [1, 1, 1],
      "#263137",
    );
    const star = new T.Shape();
    for (let j = 0; j < 10; j++) {
      const a = (j * Math.PI) / 5,
        r = j % 2 ? 0.42 : 1;
      const x = Math.sin(a) * r,
        y = Math.cos(a) * r;
      j ? star.lineTo(x, y) : star.moveTo(x, y);
    }
    star.closePath();
    for (let i = 0; i < (detailed ? 150 : 45); i++) {
      const a = i * 2.39996,
        y = 0.9 + (i % 17) * 0.29,
        r = 0.07 + (i % 4) * 0.035;
      add(
        new T.ShapeGeometry(star),
        [Math.sin(a) * 2.915, y, Math.cos(a) * 2.915],
        [r, r, 1],
        "#ffe69b",
        true,
        [0, a, 0],
      );
    }
    if (detailed)
      for (let i = 0; i < 64; i++) {
        const a = i * 2.39996,
          r = 3.8 + (i % 6) * 0.22;
        add(
          new T.ShapeGeometry(star),
          [Math.sin(a) * r, 0.06, Math.cos(a) * r],
          [0.16 + (i % 3) * 0.09, 0.3, 1],
          "#b69d59",
          true,
          [-Math.PI / 2, 0, a],
        );
      }
  }
  if (id === "dream-herd")
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4,
        r = i ? 3 + (i % 4) * 1.8 : 0,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        h = 8 + (i % 3) * 1.2;
      rod([x, 0, z], [x, h, z], 0.045, "#566c70");
      ball([x, h, z], [2.4, 1.65, 1.55], "#effaff", true);
      if (detailed)
        for (let j = 0; j < 7; j++) {
          const a = j * 2.4;
          ball(
            [x + Math.cos(a) * 1.65, h + Math.sin(a) * 0.9, z + 0.55],
            [0.85, 0.8, 0.9],
            "#e7f5fc",
            true,
          );
        }
      ball([x + 1.8, h - 0.35, z + 1], [0.8, 0.9, 0.7], "#e8f8ff", true);
      ball([x + 1.94, h - 0.3, z + 1.55], [0.43, 0.36, 0.27], "#1b3038");
      for (const dx of [-0.5, 0.5])
        ball([x + 1.8 + dx, h + 0.25, z + 1.2], [0.32, 0.18, 0.24], "#263943");
      for (const dx of [-1, 1])
        rod([x + dx, h - 1.2, z], [x + dx, h - 2, z], 0.13, "#edfaff", true);
    }
  if (id === "pop")
    ["#f4474b", "#ed3faa", "#6ac553", "#ffa63c", "#8262e9"].forEach((c, i) => {
      const x = (i - 2) * 4.3,
        z = Math.sin(i * 2) * 3,
        h = 5.8 + (i % 2) * 1.2;
      box([x, 0.18, z], [3.5, 0.36, 3.5], "#172832");
      box([x, h / 2 + 0.36, z], [2.6, h, 2.6], c, true);
      for (const side of [-1, 1])
        box(
          [x + side * 0.9, h / 2 + 0.2, z + 1.32],
          [0.14, h * 0.73, 0.03],
          "#fffad9",
          true,
        );
      box([x, h + 0.7, z - 0.9], [2.6, 0.13, 2.6], c, true, [-0.65, 0, 0]);
      ball([x, h + 1.7, z], [1.05, 1.9, 1.05], c, true);
      for (const dx of [-0.36, 0.36])
        ball([x + dx, h + 2, z + 0.94], [0.17, 0.22, 0.13], "#12232b");
    });
  return parts.map((p) => {
    if (!p.length) return new T.BufferGeometry();
    const g = mergeGeometries(p)!;
    p.forEach((x) => x.dispose());
    g.computeBoundingSphere();
    return g;
  });
}

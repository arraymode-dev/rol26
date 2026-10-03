import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import site from "../data/anchor-courtyard.json" with { type: "json" };
import { markBuildingGeometry } from "./ghost-geometry.ts";

export const ANCHOR_BUILDINGS = site.buildings.map((b) => b.id);
export const ANCHOR_ORIGIN = site.origin;
export const isAnchorTree = ([x, z]: number[]) =>
  Math.hypot(x - site.origin[0], z - site.origin[1]) < 21;
const colours: Record<string, string> = {
  brick: "#85513f",
  stone: "#b9aa91",
  roof: "#354047",
  glass: "#15262d",
  iron: "#222d30",
  paving: "#8e8775",
  leaf: "#4d6540",
  bark: "#81715a",
  timber: "#614639",
  joint: "#706958",
};

// Fixed geometry batches: no textures, per-window meshes or animation updates.
export function buildAnchorCourtyard() {
  const parts = new Map<string, T.BufferGeometry[]>();
  let architectural = true;
  const add = (
    g: T.BufferGeometry,
    p: number[],
    material: string,
    angle = 0,
    detail = false,
  ) => {
    g.rotateY(angle);
    g.translate(p[0] - site.origin[0], p[1], p[2] - site.origin[1]);
    markBuildingGeometry(g, architectural);
    const key = `${detail ? "detail" : "base"}:${material}`;
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key)!.push(g);
  };
  const box = (
    p: number[],
    size: [number, number, number],
    m: string,
    a = 0,
    detail = false,
  ) => add(new T.BoxGeometry(...size), p, m, a, detail);
  const cylinder = (
    p: number[],
    rt: number,
    rb: number,
    h: number,
    m: string,
    detail = false,
  ) => add(new T.CylinderGeometry(rt, rb, h, 12), p, m, 0, detail);
  const poly = (points: number[][], y: number, height: number, m: string) => {
    const shape = new T.Shape(points.map(([x, z]) => new T.Vector2(x, -z)));
    const g = new T.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    g.rotateX(-Math.PI / 2);
    add(g, [0, y, 0], m);
  };
  const roof = (
    p: number[],
    width: number,
    length: number,
    rise: number,
    angle: number,
  ) => {
    const shape = new T.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: false,
    });
    g.translate(0, 0, -length / 2);
    add(g, p, "roof", angle);
  };
  for (const building of site.buildings) {
    poly(building.points, -0.1, building.height + 0.1, "brick");
    poly(building.points, building.height, 0.3, "roof");
    const signed = building.points
      .slice(1)
      .reduce(
        (n, b, i) =>
          n + building.points[i][0] * b[1] - b[0] * building.points[i][1],
        0,
      );
    for (let e = 1; e < building.points.length; e++) {
      const a = building.points[e - 1],
        b = building.points[e];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 7) continue;
      const nx = (dz / length) * (signed > 0 ? 1 : -1),
        nz = (-dx / length) * (signed > 0 ? 1 : -1);
      const angle = Math.atan2(nx, nz);
      const position = (t: number, y: number, out = 0.12) => [
        a[0] + dx * t + nx * out,
        y,
        a[1] + dz * t + nz * out,
      ];
      box(position(0.5, 0.75), [length, 1.1, 0.3], "stone", angle);
      box(
        position(0.5, building.height - 0.45),
        [length, 0.32, 0.4],
        "stone",
        angle,
      );
      const count = Math.floor(length / 4.8);
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count,
          p = position(t, 0);
        // Detailed brick warehouse windows appear only around the courtyard.
        if (Math.hypot(p[0] - 89, p[2] - 488) > 70) continue;
        for (let row = 0; row < (building.height > 10 ? 5 : 1); row++) {
          const y = 2.6 + row * 4.35;
          const w = j % 3 === 1 ? 2.1 : 1.4;
          box(position(t, y), [w, 2.65, 0.16], "glass", angle, true);
          box(
            position(t, y - 1.42, 0.25),
            [w + 0.3, 0.18, 0.38],
            "stone",
            angle,
            true,
          );
          box(position(t, y, 0.23), [0.065, 2.65, 0.08], "iron", angle, true);
          for (const offset of [-0.7, 0, 0.7])
            box(
              position(t, y + offset, 0.23),
              [w, 0.055, 0.08],
              "iron",
              angle,
              true,
            );
        }
        if (j % 3 === 1) {
          const arch = new T.Shape();
          arch.moveTo(-1.2, 0);
          arch.lineTo(1.2, 0);
          arch.lineTo(1.2, 2.5);
          arch.absarc(0, 2.5, 1.2, 0, Math.PI, false);
          arch.lineTo(-1.2, 0);
          add(
            new T.ShapeGeometry(arch),
            position(t, 0.4, 0.27),
            "glass",
            angle,
            true,
          );
        }
      }
    }
  }
  roof([66, 23.3, 443], 17, 70, 2.5, 0.42);
  roof([-3, 23.3, 521], 21, 116, 2.8, -1.087);
  roof([75.5, 6.5, 501.5], 10, 12, 2, 0.49);
  roof([62, 6.5, 480], 10, 12, 2, 0.44);

  // Low entrance walls and the paired round sandstone piers from the photos.
  const wall = (a: number[], b: number[]) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    box(
      [(a[0] + b[0]) / 2, 1.9, (a[1] + b[1]) / 2],
      [length, 3.5, 0.65],
      "brick",
      angle,
    );
    box(
      [(a[0] + b[0]) / 2, 3.7, (a[1] + b[1]) / 2],
      [length, 0.25, 0.85],
      "stone",
      angle,
    );
  };
  wall([97, 476.2], [102.4, 488.3]);
  wall([105.6, 495.7], [84.9, 504]);
  for (const [x, z] of [
    [102.4, 488.3],
    [105.6, 495.7],
  ]) {
    cylinder([x, 2.25, z], 0.72, 0.84, 4.5, "stone");
    cylinder([x, 4.55, z], 0.93, 0.93, 0.32, "stone");
    cylinder([x, 4.8, z], 0.48, 0.82, 0.22, "stone");
    for (const y of [1.1, 2.2, 3.3])
      cylinder([x, y, z], 0.86, 0.86, 0.18, "stone", true);
  }
  architectural = false;
  poly(site.paving, 0.5, 0.1, "paving");
  // Clip a sparse flagstone joint grid to the courtyard outline. Flat strips
  // share one close-range batch, so paving needs no texture or individual tiles.
  for (const axis of [0, 1]) {
    const other = 1 - axis;
    const values = site.paving.map((p) => p[axis]);
    for (
      let line = Math.ceil(Math.min(...values));
      line < Math.max(...values);
      line += 1.8
    ) {
      const crossings: number[] = [];
      for (let i = 0; i < site.paving.length; i++) {
        const a = site.paving[i],
          b = site.paving[(i + 1) % site.paving.length];
        if (
          (a[axis] <= line && b[axis] > line) ||
          (b[axis] <= line && a[axis] > line)
        ) {
          crossings.push(
            a[other] +
              ((b[other] - a[other]) * (line - a[axis])) / (b[axis] - a[axis]),
          );
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 1; i < crossings.length; i += 2) {
        const length = crossings[i] - crossings[i - 1];
        const p =
          axis === 0
            ? [line, 0.61, (crossings[i] + crossings[i - 1]) / 2]
            : [(crossings[i] + crossings[i - 1]) / 2, 0.61, line];
        const strip = new T.PlaneGeometry(
          axis === 0 ? 0.025 : length,
          axis === 0 ? length : 0.025,
        );
        strip.rotateX(-Math.PI / 2);
        add(strip, p, "joint", 0, true);
      }
    }
  }
  const ring = new T.RingGeometry(3.2, 3.45, 40);
  ring.rotateX(-Math.PI / 2);
  add(ring, [89, 0.62, 488], "stone", 0, true);
  for (const [x, z] of site.palms) {
    cylinder([x, 0.4, z], 1.1, 1.25, 0.45, "stone");
    cylinder([x, 2.6, z], 0.13, 0.26, 4.7, "bark");
    // Twelve folded leaves per palm; silhouette survives without alpha textures.
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.Float32BufferAttribute(
          [
            0, 0, 0, -0.28, 0.5, 1.2, 0, -0.8, 2.8, 0, 0, 0, 0, -0.8, 2.8, 0.28,
            0.5, 1.2,
          ],
          3,
        ),
      );
      g.computeVertexNormals();
      add(g, [x, 5.2, z], "leaf", a);
    }
  }
  // A pair of benches and shallow steps; leave the gate and centre unobstructed.
  for (const [x, z] of [
    [80, 491],
    [92, 498],
  ]) {
    box([x, 0.7, z], [2.3, 0.18, 0.6], "timber", 0.4, true);
    box([x, 1.1, z + 0.3], [2.3, 0.7, 0.12], "timber", 0.4, true);
  }
  for (let i = 0; i < 3; i++)
    box(
      [79.5, 0.2 + i * 0.16, 494 + i * 0.3],
      [3.5, 0.2, 0.5],
      "stone",
      0.49,
      true,
    );

  return [...parts].map(([key, gs]) => {
    const normalized = gs.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute("uv");
      return n;
    });
    const geometry = mergeGeometries(normalized, false)!;
    new Set([...gs, ...normalized]).forEach((g) => g.dispose());
    const [level, material] = key.split(":");
    return {
      geometry,
      detail: level === "detail",
      colour: colours[material],
      material,
    };
  });
}

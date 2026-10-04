import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import terrain from "../data/chavasse-park.json";
import { chavasseHeight } from "../lib/chavasse-terrain";
import { GRASS_COLOUR, GROUND_COLOURS } from "../lib/palette";

export function buildChavassePark() {
  const surface = (polygons: number[][][][], offset: number) => {
    const pieces = polygons.map(([outer, ...holes]) => {
      const shape = new THREE.Shape(
        outer.map(([x, z]) => new THREE.Vector2(x, -z)),
      );
      shape.holes = holes.map(
        (r) => new THREE.Path(r.map(([x, z]) => new THREE.Vector2(x, -z))),
      );
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++)
        p.setY(i, chavasseHeight(p.getX(i), p.getZ(i)) + offset);
      g.computeVertexNormals();
      return g;
    });
    const merged = mergeGeometries(pieces)!;
    pieces.forEach((g) => g.dispose());
    return merged;
  };
  const wallVertices: number[] = [];
  for (let i = 1; i < terrain.outline.length; i++) {
    const a = terrain.outline[i - 1],
      b = terrain.outline[i];
    // Split exactly at the same slope changes as the lawn, avoiding cracks.
    const u = (p: number[]) =>
      (p[0] - terrain.origin[0]) * terrain.uphill[0] +
      (p[1] - terrain.origin[1]) * terrain.uphill[1];
    const ua = u(a),
      ub = u(b);
    const ts = [
      0,
      ...terrain.profile
        .map(([v]) => (v - ua) / (ub - ua))
        .filter((t) => t > 0 && t < 1),
      1,
    ].sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const at = (t: number) => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
      ];
      const p = at(ts[j - 1]),
        q = at(ts[j]);
      const hp = chavasseHeight(...(p as [number, number])) + 0.38,
        hq = chavasseHeight(...(q as [number, number])) + 0.38;
      wallVertices.push(
        p[0],
        0,
        p[1],
        q[0],
        0,
        q[1],
        q[0],
        hq,
        q[1],
        p[0],
        0,
        p[1],
        q[0],
        hq,
        q[1],
        p[0],
        hp,
        p[1],
      );
    }
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(wallVertices, 3),
  );
  walls.computeVertexNormals();
  return {
    grass: surface(terrain.grass, 0.38),
    paving: surface(terrain.paving, 0.52),
    walls,
  };
}
export const ChavassePark = memo(function ChavassePark({
  night,
}: {
  night: boolean;
}) {
  const geometry = useMemo(buildChavassePark, []);
  useEffect(
    () => () => Object.values(geometry).forEach((g) => g.dispose()),
    [geometry],
  );
  return (
    <group name="Chavasse Park hillside">
      <mesh geometry={geometry.grass} receiveShadow>
        <meshStandardMaterial color={GRASS_COLOUR} roughness={1} />
      </mesh>
      <mesh geometry={geometry.paving} receiveShadow>
        <meshStandardMaterial
          color={night ? "#526870" : "#e1ddce"}
          roughness={0.95}
        />
      </mesh>
      <mesh geometry={geometry.walls} receiveShadow>
        <meshStandardMaterial
          color={GROUND_COLOURS[night ? "night" : "day"]}
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});

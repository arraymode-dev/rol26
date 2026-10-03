import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { circleIntersectsFootprint } from "../src/lib/attraction-boundary.ts";
import {
  splitGhostGeometry,
  markBuildingGeometry,
} from "../src/lib/ghost-geometry.ts";

test("boundary detects long building edges, containment and tangency rather than centroid distance", () => {
  const building = [
    [28, -100],
    [60, -100],
    [60, 100],
    [28, 100],
  ] as [number, number][];
  assert.equal(circleIntersectsFootprint([0, 0], building), true);
  assert.equal(circleIntersectsFootprint([-2, 0], building), false);
  assert.equal(circleIntersectsFootprint([-1, 0], building), true);
  assert.equal(circleIntersectsFootprint([40, 0], building), true);
  assert.equal(circleIntersectsFootprint([0, 0], []), false);
});

test("custom geometry ghosts walls and windows while retaining paving and remote buildings", () => {
  const wall = new THREE.BoxGeometry(10, 20, 10).translate(0, 10, 0);
  const window = new THREE.BoxGeometry(2, 3, 0.1).translate(0, 8, 5.1);
  const remote = new THREE.BoxGeometry(10, 20, 10).translate(80, 10, 0);
  const paving = new THREE.BoxGeometry(100, 0.2, 100).translate(0, 0.4, 0);
  const furniture = new THREE.BoxGeometry(2, 12, 2).translate(0, 6, 0);
  [wall, window, remote].forEach((g) => markBuildingGeometry(g, true));
  [paving, furniture].forEach((g) => markBuildingGeometry(g, false));
  const combined = mergeGeometries([wall, window, remote, paving, furniture]);
  const originalCount = combined.index!.count;
  const matrix = new THREE.Matrix4().makeTranslation(100, 0, 50);
  const footprints = [
    {
      points: [
        [95, 45],
        [105, 45],
        [105, 55],
        [95, 55],
      ] as [number, number][],
    },
  ];
  const split = splitGhostGeometry(combined, matrix, footprints)!;
  assert.ok(split);
  assert.equal(
    split.ghost.getAttribute("position").count +
      split.solid.getAttribute("position").count,
    originalCount,
  );
  const gp = split.ghost.getAttribute("position");
  for (let i = 0; i < gp.count; i++) assert.ok(gp.getX(i) < 10);
  assert.ok(
    split.solid.getAttribute("position").count >=
      remote.index!.count + paving.index!.count + furniture.index!.count,
  );
  assert.equal(splitGhostGeometry(combined, matrix, []), null);
  assert.equal(combined.index!.count, originalCount);
  [wall, window, remote, paving, combined, split.solid, split.ghost].forEach(
    (g) => g.dispose(),
  );
});

test("a landmark's attached tower fades with its body even outside the footprint", () => {
  const tower = new THREE.BoxGeometry(14, 19, 14).translate(0, 57, 24);
  const footprints = [
    {
      points: [
        [-5, -5],
        [5, -5],
        [5, 5],
        [-5, 5],
      ] as [number, number][],
    },
  ];
  const matrix = new THREE.Matrix4();
  assert.equal(splitGhostGeometry(tower, matrix, footprints, true), null);
  const split = splitGhostGeometry(tower, matrix, footprints, true, true)!;
  assert.equal(split.solid.drawRange.count, 0);
  assert.equal(split.ghost.index!.count, tower.index!.count);
  assert.equal(
    tower.drawRange.count,
    Infinity,
    "original stays intact for selection changes",
  );
  assert.equal(splitGhostGeometry(tower, matrix, [], true, true), null);
  assert.equal(
    splitGhostGeometry(tower, matrix, footprints, false, true),
    null,
    "furniture remains solid",
  );
  [tower, split.solid, split.ghost].forEach((g) => g.dispose());
});

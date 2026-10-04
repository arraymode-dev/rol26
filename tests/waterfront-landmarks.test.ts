import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  buildWaterfrontLandmark,
  WATERFRONT_LANDMARK_IDS,
} from "../src/lib/waterfront-landmarks.ts";

const map = JSON.parse(
  readFileSync(new URL("../public/data/map.json", import.meta.url), "utf8"),
);
test("waterfront models remain finite and anchored to their mapped footprints", () => {
  for (const id of WATERFRONT_LANDMARK_IDS) {
    const footprint = map.buildings.find((b: { id: string }) => b.id === id);
    assert.ok(footprint, `Missing footprint ${id}`);
    const parts = buildWaterfrontLandmark(footprint);
    const xs = footprint.points.map((p: number[]) => p[0]);
    const zs = footprint.points.map((p: number[]) => p[1]);
    for (const { geometry } of parts) {
      const position = geometry.getAttribute("position");
      assert.ok(
        [...position.array].every(Number.isFinite),
        `Non-finite model ${id}`,
      );
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      assert.ok(
        box.min.x >= Math.min(...xs) - 8 && box.max.x <= Math.max(...xs) + 8,
        `X drift ${id}`,
      );
      assert.ok(
        box.min.z >= Math.min(...zs) - 8 && box.max.z <= Math.max(...zs) + 8,
        `Z drift ${id}`,
      );
      geometry.dispose();
    }
  }
});
test("Liver courtyard blocks sightlines through all four inner walls and its floor", () => {
  const footprint = map.buildings.find(
    (b: { id: string }) => b.id === "24611033",
  );
  const parts = buildWaterfrontLandmark(footprint);
  const a = -1.04,
    c = Math.cos(a),
    s = Math.sin(a);
  const points = footprint.points.map(([x, z]: number[]) => [
    c * x - s * z,
    s * x + c * z,
  ]);
  const cx =
    (Math.min(...points.map((p: number[]) => p[0])) +
      Math.max(...points.map((p: number[]) => p[0]))) /
    2;
  const cz =
    (Math.min(...points.map((p: number[]) => p[1])) +
      Math.max(...points.map((p: number[]) => p[1]))) /
    2;
  const origin = new THREE.Vector3(c * cx + s * cz, 30, -s * cx + c * cz);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(
    parts.find((p) => p.material === "stone")!.geometry,
    material,
  );
  for (const [direction, distance] of [
    [new THREE.Vector3(c, 0, -s), 9],
    [new THREE.Vector3(-c, 0, s), 9],
    [new THREE.Vector3(s, 0, c), 14],
    [new THREE.Vector3(-s, 0, -c), 14],
    [new THREE.Vector3(0, -1, 0), 18],
  ] as const) {
    const hits = new THREE.Raycaster(origin, direction).intersectObject(mesh);
    assert.ok(hits.length, "Courtyard wall or floor is culled from inside");
    assert.ok(Math.abs(hits[0].distance - distance) < 0.05);
  }
  parts.forEach((p) => p.geometry.dispose());
  material.dispose();
});

test("Liver's narrow facade bays retain window geometry instead of blank walls", () => {
  const footprint = map.buildings.find(
    (b: { id: string }) => b.id === "24611033",
  );
  const parts = buildWaterfrontLandmark(footprint);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const glass = new THREE.Mesh(
    parts.find((p) => p.material === "glass")!.geometry,
    material,
  );
  let checked = 0;
  footprint.points.slice(1).forEach((b: number[], i: number) => {
    const a = footprint.points[i];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 4 || length >= 8) return;
    const centre = new THREE.Vector3((a[0] + b[0]) / 2, 7, (a[1] + b[1]) / 2);
    const normal = new THREE.Vector3(-dz / length, 0, dx / length);
    const hits = new THREE.Raycaster(
      centre.clone().addScaledVector(normal, 1),
      normal.clone().negate(),
      0,
      2,
    ).intersectObject(glass);
    assert.ok(hits.length, "a narrow facade bay has a real window");
    checked++;
  });
  assert.ok(checked > 10);
  parts.forEach((p) => p.geometry.dispose());
  material.dispose();
});

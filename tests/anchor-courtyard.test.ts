import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  buildAnchorCourtyard,
  ANCHOR_ORIGIN,
} from "../src/lib/anchor-courtyard.ts";

function model() {
  const batches = buildAnchorCourtyard();
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const meshes = batches.map(({ geometry }) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(ANCHOR_ORIGIN[0], 0, ANCHOR_ORIGIN[1]);
    mesh.updateMatrixWorld();
    return mesh;
  });
  return {
    batches,
    meshes,
    dispose: () => {
      batches.forEach((b) => b.geometry.dispose());
      material.dispose();
    },
  };
}

test("courtyard geometry remains finite and within the mobile geometry budget", () => {
  const m = model();
  try {
    assert.ok(
      m.batches.length <= 12,
      "at most twelve material batches up close",
    );
    assert.ok(
      m.batches.filter((b) => !b.detail).length <= 7,
      "base building and ground stay within seven material batches",
    );
    let vertices = 0;
    for (const { geometry } of m.batches) {
      const p = geometry.getAttribute("position");
      vertices += p.count;
      assert.equal(geometry.getAttribute("normal").count, p.count);
      assert.equal(geometry.getAttribute("building").count, p.count);
      assert.ok([...p.array].every(Number.isFinite));
    }
    assert.ok(vertices / 3 < 25000, "courtyard stays below 25k triangles");
  } finally {
    m.dispose();
  }
});

test("artwork has open sky and its walking approach passes through the gate", () => {
  const m = model();
  try {
    const ray = new T.Raycaster(
      new T.Vector3(89, 1, 488),
      new T.Vector3(0, 1, 0),
    );
    assert.equal(
      ray.intersectObjects(m.meshes, false).length,
      0,
      "no warehouse roof over artwork",
    );
    const path = [
      [107.6, 490.3],
      [102.4, 492.4],
      [89.4, 488.2],
    ];
    for (let i = 1; i < path.length; i++) {
      const start = new T.Vector3(path[i - 1][0], 1.5, path[i - 1][1]);
      const end = new T.Vector3(path[i][0], 1.5, path[i][1]);
      ray.set(start, end.clone().sub(start).normalize());
      ray.far = start.distanceTo(end);
      assert.equal(
        ray.intersectObjects(m.meshes, false).length,
        0,
        "gate route is unobstructed",
      );
    }
  } finally {
    m.dispose();
  }
});

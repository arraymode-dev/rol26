import { test } from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { installations } from "../src/data/installations.ts";
import { project } from "../src/lib/geo.ts";
import {
  trailCameraPose,
  shouldRestoreTrailView,
  type CameraPose,
} from "../src/lib/trail-camera.ts";

test("trail view fits all artwork markers in landscape and portrait with a near overhead angle", () => {
  const points = installations.map((i) => project(...i.coordinates));
  for (const aspect of [16 / 9, 390 / 844]) {
    const pose = trailCameraPose(points, aspect);
    const camera = new PerspectiveCamera(42, aspect, 1, 16000);
    camera.position.set(...pose.position);
    camera.lookAt(new Vector3(...pose.target));
    camera.updateMatrixWorld();
    for (const [x, z] of points) {
      const p = new Vector3(x, 30, z).project(camera);
      assert.ok(Math.abs(p.x) <= 0.78 && Math.abs(p.y) <= 0.72);
    }
    const offset = camera.position.clone().sub(new Vector3(...pose.target));
    assert.ok(offset.angleTo(new Vector3(0, 1, 0)) < 0.25);
    assert.ok(offset.length() < 10000);
  }
});

test("trail exit restores an unchanged view or automatic flight, and preserves manually moved views", () => {
  const birdseye: CameraPose = { position: [0, 2000, 440], target: [0, 0, 0] };
  const close: CameraPose = { position: [30, 150, 100], target: [20, 0, 30] };
  assert.equal(shouldRestoreTrailView(birdseye, birdseye), true);
  assert.equal(shouldRestoreTrailView(close, birdseye, birdseye), true);
  assert.equal(
    shouldRestoreTrailView({ ...birdseye, position: [0, 1800, 396] }, birdseye),
    false,
  );
  assert.equal(
    shouldRestoreTrailView(
      { position: [50, 2000, 440], target: [50, 0, 0] },
      birdseye,
    ),
    false,
  );
  assert.equal(shouldRestoreTrailView(birdseye, birdseye, close), false);
});

test("trail entry uses a fixed bearing with the waterfront level on landscape screens", () => {
  const points = installations.map((i) => project(...i.coordinates));
  const pose = trailCameraPose(points, 16 / 9);
  const camera = new PerspectiveCamera(42, 16 / 9, 1, 16000);
  camera.position.set(...pose.position);
  camera.lookAt(new Vector3(...pose.target));
  camera.updateMatrixWorld();
  const a = new Vector3(-400, 0, -150).project(camera);
  const b = new Vector3(-160, 0, 450).project(camera);
  assert.ok(Math.abs(a.y - b.y) < 1e-8);
  assert.ok(b.x > a.x);
});

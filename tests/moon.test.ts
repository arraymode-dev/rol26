import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import {
  MOON_DIRECTION,
  MOON_DISTANCE,
  moonPlacement,
} from "../src/lib/moon.ts";
test("moon stays at one sky direction and distance as the camera translates and zooms", () => {
  for (const p of [
    [0, 20, 0],
    [-260, 24, 265],
    [900, 1000, -1800],
  ]) {
    const relative = new Vector3(...moonPlacement(p)).sub(new Vector3(...p));
    assert.ok(Math.abs(relative.length() - MOON_DISTANCE) < 1e-7);
    assert.ok(
      relative.normalize().distanceTo(new Vector3(...MOON_DIRECTION)) < 1e-9,
    );
  }
});
test("moon is in the low waterfront view but outside inland and birds-eye views", () => {
  const camera = new PerspectiveCamera(42, 16 / 9, 1, 16000);
  camera.position.set(-160, 45, 300);
  const projected = (target: Vector3) => {
    camera.lookAt(target);
    camera.updateMatrixWorld();
    return new Vector3(...moonPlacement(camera.position.toArray())).project(
      camera,
    );
  };
  const low = projected(
    camera.position
      .clone()
      .add(
        new Vector3(MOON_DIRECTION[0] * 100, -22.4, MOON_DIRECTION[2] * 100),
      ),
  );
  assert.ok(Math.abs(low.x) < 1 && Math.abs(low.y) < 1 && low.z < 1);
  const inland = projected(
    camera.position.clone().add(new Vector3(100, -22.4, 30)),
  );
  assert.ok(inland.z > 1 || Math.abs(inland.x) > 1 || Math.abs(inland.y) > 1);
  const overhead = projected(
    camera.position.clone().add(new Vector3(0, -100, 0)),
  );
  assert.ok(
    overhead.z > 1 || Math.abs(overhead.x) > 1 || Math.abs(overhead.y) > 1,
  );
});

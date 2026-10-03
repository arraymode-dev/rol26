import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { approachArtwork } from "../src/lib/artwork-camera.ts";

test("artwork approaches keep the current side and bearing instead of circling to a preset", () => {
  const focus = new Vector3(-78, 1, 615);
  for (const offset of [
    new Vector3(-700, 450, 900),
    new Vector3(800, 250, -600),
  ]) {
    const position = focus.clone().add(offset);
    const result = approachArtwork(position, new Vector3(), focus, 105).sub(
      focus,
    );
    assert.ok(
      Math.abs(
        Math.atan2(result.x, result.z) - Math.atan2(offset.x, offset.z),
      ) < 1e-10,
    );
    assert.ok(Math.abs(result.length() - 105) < 1e-10);
  }
});

test("close approaches avoid needless zooming out and overhead approaches remain finite", () => {
  const focus = new Vector3(20, 3, 30);
  const nearby = focus.clone().add(new Vector3(0, 48, 64));
  assert.ok(
    Math.abs(
      approachArtwork(nearby, focus, focus, 200).distanceTo(focus) - 80,
    ) < 1e-10,
  );
  const overhead = approachArtwork(
    focus.clone().add(new Vector3(0, 1500, 0)),
    focus,
    focus,
    140,
  );
  assert.ok(overhead.toArray().every(Number.isFinite));
  assert.ok(overhead.y > focus.y);
});

test("Together chooses the nearer face and avoids an edge-on approach", async () => {
  const { faceArtworkSurface } = await import("../src/lib/artwork-camera.ts");
  const focus = new Vector3(246.1, 4, 450.8),
    normal = 0.397;
  for (const bearing of [
    normal,
    normal + 1.4,
    normal + Math.PI,
    normal + Math.PI + 1.4,
  ]) {
    const before = focus
      .clone()
      .add(new Vector3(Math.sin(bearing) * 70, 25, Math.cos(bearing) * 70));
    const result = faceArtworkSurface(before, focus, normal).sub(focus);
    const facing = Math.cos(Math.atan2(result.x, result.z) - normal);
    assert.ok(Math.abs(facing) >= Math.cos(Math.PI / 6) - 1e-10);
    assert.equal(Math.sign(facing), Math.sign(Math.cos(bearing - normal)));
    assert.ok(Math.abs(result.length() - before.distanceTo(focus)) < 1e-10);
  }
});

test("mobile approaches retain the arriving side while bringing a steep overview down to artwork height", () => {
  const focus = new Vector3(0, 4, 0);
  const position = approachArtwork(
    new Vector3(0, 2100, 200),
    new Vector3(),
    focus,
    90,
    Math.PI / 4,
  );
  const offset = position.clone().sub(focus);
  assert.ok(Math.abs(offset.length() - 90) < 1e-8);
  assert.ok(
    Math.abs(
      Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) - Math.PI / 4,
    ) < 1e-8,
  );
  assert.equal(offset.x, 0);
  assert.ok(offset.z > 0);
});

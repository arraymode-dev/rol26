import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRide,
  rideActive,
  rideAngle,
  cabinPosition,
  type RideKind,
} from "../src/lib/ride-models.ts";

test("rides animate only nearby, with hysteresis and reduced-motion/background stops", () => {
  for (const kind of ["wheel", "carousel"] as RideKind[]) {
    assert.equal(rideActive(kind, 90, false, false, true), true);
    assert.equal(rideActive(kind, 600, true, false, true), false);
    assert.equal(rideActive(kind, 90, true, true, true), false);
    assert.equal(rideActive(kind, 90, true, false, false), false);
    const band = kind === "wheel" ? 240 : 175;
    assert.equal(rideActive(kind, band, false, false, true), false);
    assert.equal(rideActive(kind, band, true, false, true), true);
    assert.equal(rideAngle(1, 0, kind), 1);
    assert.equal(
      rideAngle(1, 60, kind),
      rideAngle(1, 0.05, kind),
      "no resume jump after idle",
    );
  }
});
test("wheel capsule pivots stay on the rim throughout a full rotation", () => {
  for (let phase = 0; phase < Math.PI * 2; phase += 0.15)
    for (let i = 0; i < 36; i++) {
      const [x, y, z] = cabinPosition(i, phase);
      assert.ok(Math.abs(Math.hypot(x, y) - 29) < 1e-9);
      assert.equal(z, 0);
      const next = cabinPosition((i + 1) % 36, phase);
      assert.ok(
        Math.hypot(next[0] - x, next[1] - y) > 5,
        "cabins do not overlap",
      );
    }
});
test("detailed illuminated rides use bounded merged batches and finite geometry", () => {
  for (const kind of ["wheel", "carousel"] as RideKind[]) {
    const batches = buildRide(kind);
    try {
      assert.ok(batches.length <= (kind === "wheel" ? 6 : 3));
      assert.ok(batches.some((b) => b.glow));
      let triangles = 0;
      for (const b of batches) {
        const p = b.geometry.getAttribute("position");
        assert.equal(b.geometry.getAttribute("color").count, p.count);
        assert.ok([...p.array].every(Number.isFinite));
        triangles += (p.count / 3) * (b.layer === "cabin" ? 36 : 1);
      }
      assert.ok(triangles < (kind === "wheel" ? 18000 : 8500));
    } finally {
      batches.forEach((b) => b.geometry.dispose());
    }
  }
});

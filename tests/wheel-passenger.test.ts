import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  passengerVisible,
  passengerFade,
  passengerMaterial,
  PASSENGER_WINDOW,
  PASSENGER_CABIN,
} from "../src/lib/wheel-passenger.ts";
import kings from "../src/data/kings-parade.json" with { type: "json" };

test("wheel surprise appears only nearby in high quality, with a smooth distance fade", () => {
  assert.equal(passengerVisible(20, true, true), true);
  assert.equal(passengerVisible(20, false, true), false);
  assert.equal(passengerVisible(20, true, false), false);
  assert.equal(passengerVisible(55, true, true), false);
  assert.equal(passengerFade(35), 1);
  assert.equal(passengerFade(55), 0);
  assert.equal(passengerFade(45), 0.5);
});
test("portrait window faces the waterfront and sits outside the solid glass", () => {
  const normal = new T.Vector3(0, 0, 1).applyAxisAngle(
    new T.Vector3(0, 1, 0),
    PASSENGER_WINDOW.rotation + kings.wheel.angle,
  );
  assert.ok(normal.x < -0.9, "looks west over the Mersey");
  assert.ok(
    PASSENGER_WINDOW.position[0] < -0.75,
    "not buried in the opaque glass",
  );
  assert.ok(
    Number.isInteger(PASSENGER_CABIN) &&
      PASSENGER_CABIN >= 0 &&
      PASSENGER_CABIN < 36,
  );
});
test("single window pass uses normal alpha blending and preserves scene depth", () => {
  const texture = new T.Texture();
  const material = passengerMaterial(texture, true);
  assert.equal(material.blending, T.NormalBlending);
  assert.equal(material.premultipliedAlpha, false);
  assert.equal(material.depthWrite, false);
  assert.equal(material.depthTest, true);
  assert.equal(material.side, T.FrontSide);
  // The main city uses logarithmic depth; both stages must participate or
  // the cabin glass hides the portrait despite it sitting in front of it.
  assert.match(material.vertexShader, /#include <logdepthbuf_pars_vertex>/);
  assert.match(material.vertexShader, /#include <logdepthbuf_vertex>/);
  assert.match(material.fragmentShader, /#include <logdepthbuf_pars_fragment>/);
  assert.match(material.fragmentShader, /#include <logdepthbuf_fragment>/);
  material.dispose();
  texture.dispose();
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  captureGPS,
  exportGPSLog,
  parseGPSLog,
  GPS_CAPTURE_MAX_AGE,
} from "../src/lib/gps-field-log.ts";
const now = 1791000000000;
const artwork = {
  id: "unity",
  name: "Unity",
  coordinates: [-2.992, 53.404] as [number, number],
};
const fix = {
  longitude: -2.992,
  latitude: 53.404,
  accuracy: 4.2,
  timestamp: now,
};

test("a field capture preserves GPS precision, accuracy, artwork and survey projection", () => {
  const record = captureGPS(fix, artwork, "  at centre  ", now)!;
  assert.deepEqual(record.fix, fix);
  assert.equal(record.artworkId, "unity");
  assert.equal(record.offsetMetres, 0);
  assert.equal(Math.abs(record.scene.x) + Math.abs(record.scene.z), 0);
  assert.equal(record.note, "at centre");
  assert.equal(record.capturedAt, new Date(now).toISOString());
  assert.deepEqual(artwork.coordinates, [-2.992, 53.404]);
});
test("capture rejects missing, stale and invalid GPS rather than saving a false location", () => {
  assert.equal(captureGPS(null, artwork, "", now), null);
  assert.equal(
    captureGPS(fix, artwork, "", now + GPS_CAPTURE_MAX_AGE + 1),
    null,
  );
  for (const invalid of [
    { latitude: NaN },
    { latitude: 91 },
    { longitude: 181 },
    { accuracy: -1 },
    { timestamp: now + 10000 },
  ]) {
    assert.equal(captureGPS({ ...fix, ...invalid }, artwork, "", now), null);
  }
});
test("field offsets are measured in metres without rounding stored coordinates", () => {
  const moved = { ...fix, latitude: fix.latitude + 0.0001 };
  const record = captureGPS(moved, artwork, "", now)!;
  assert.ok(Math.abs(record.offsetMetres - 11.132) < 0.001);
  assert.equal(record.fix.latitude, moved.latitude);
});
test("saved field logs survive reload and export with coordinate metadata", () => {
  const record = captureGPS(fix, artwork, "", now)!;
  assert.deepEqual(parseGPSLog(JSON.stringify([record])), [record]);
  const output = JSON.parse(exportGPSLog([record]));
  assert.equal(output.coordinateSystem, "WGS84");
  assert.equal(output.version, 1);
  assert.deepEqual(output.records, [record]);
  assert.equal(
    parseGPSLog(JSON.stringify(Array(105).fill(record))).length,
    100,
  );
  for (const raw of [null, "invalid", "{}", "[null,{},1]"])
    assert.deepEqual(parseGPSLog(raw), []);
});

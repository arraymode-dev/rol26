import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  EVENT_POOLS,
  eventFacadeFrames,
  loopFacadeEdges,
  applyEventSurfaceLighting,
} from "../src/lib/event-lighting.ts";
import { installations } from "../src/data/installations.ts";
import { project } from "../src/lib/geo.ts";
import { TOWN_HALL_FORECOURT } from "../src/lib/site-positions.ts";
import type { MapData } from "../src/types.ts";
const data: MapData = JSON.parse(
  readFileSync(new URL("../public/data/map.json", import.meta.url), "utf8"),
);

test("event lighting is restricted to all thirteen artworks and mapped landmark footprints", () => {
  assert.deepEqual(
    EVENT_POOLS.map((p) => p.id),
    installations.map((i) => i.id),
  );
  assert.ok(
    EVENT_POOLS.every((p) => Number.isFinite(p.x + p.z) && p.radius <= 40),
  );
  for (const pool of EVENT_POOLS) {
    const item = installations.find((i) => i.id === pool.id)!;
    const point =
      item.id === "the-anooki"
        ? [TOWN_HALL_FORECOURT.x, TOWN_HALL_FORECOURT.z]
        : project(...item.coordinates);
    assert.deepEqual([pool.x, pool.z], point);
    assert.equal(pool.y, item.id === "today-i-love-you" ? 3.8 : 0);
  }
  const frames = eventFacadeFrames(data.buildings);
  assert.equal(frames.length, 6);
  for (const frame of frames) {
    const footprint = data.buildings.find((b) => b.id === frame.id)!;
    for (const [x, z] of footprint.points) {
      const dx = x - frame.x,
        dz = z - frame.z,
        c = Math.cos(frame.angle),
        s = Math.sin(frame.angle);
      assert.ok(Math.abs(c * dx - s * dz) <= frame.halfX + 1e-6);
      assert.ok(Math.abs(s * dx + c * dz) <= frame.halfZ + 1e-6);
    }
  }
});

test("LOOP uplights use real courtyard-facing wall edges and remain local to the square", () => {
  const edges = loopFacadeEdges(data.buildings);
  assert.equal(edges.length, 4);
  const site = EVENT_POOLS.find((p) => p.id === "loop")!;
  for (const edge of edges) {
    const building = data.buildings.find((b) => b.id === edge.id)!;
    assert.ok(
      building.points.some(
        (p, i) => p === edge.a && building.points[i + 1] === edge.b,
      ),
    );
    assert.ok(edge.distance < 45);
    assert.ok(Math.abs(Math.hypot(edge.dx, edge.dz) - 1) < 1e-6);
    // The nearby wall receives the shader even above the pool's 12m cutoff.
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial(),
    );
    wall.position.set(
      (edge.a[0] + edge.b[0]) / 2,
      16,
      (edge.a[1] + edge.b[1]) / 2,
    );
    const original = wall.material;
    const restore = applyEventSurfaceLighting(wall, data.buildings);
    assert.notEqual(wall.material, original);
    assert.ok(
      Math.hypot(wall.position.x - site.x, wall.position.z - site.z) < 80,
    );
    restore();
    assert.equal(wall.material, original);
    wall.geometry.dispose();
    original.dispose();
  }
});

test("surface lighting leaves water, ghost buildings and remote geometry intact and restores material ownership", () => {
  const group = new THREE.Group();
  const meshes = [
    [EVENT_POOLS[0].x, 0.4, EVENT_POOLS[0].z],
    [3000, 0, 3000],
    [EVENT_POOLS[0].x, -2, EVENT_POOLS[0].z],
    [EVENT_POOLS[0].x, 1, EVENT_POOLS[0].z],
  ].map((p, i) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({ transparent: i === 3 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(...(p as [number, number, number]));
    group.add(mesh);
    return mesh;
  });
  const originals = meshes.map((m) => m.material),
    geometries = meshes.map((m) => m.geometry);
  const restore = applyEventSurfaceLighting(group, data.buildings);
  assert.notEqual(meshes[0].material, originals[0]);
  for (let i = 1; i < meshes.length; i++)
    assert.equal(meshes[i].material, originals[i]);
  assert.equal(group.children.length, 4, "No extra meshes or drawing passes");
  meshes.forEach((m, i) => assert.equal(m.geometry, geometries[i]));
  restore();
  meshes.forEach((m, i) => {
    assert.equal(m.material, originals[i]);
    m.geometry.dispose();
    m.material.dispose();
  });
});

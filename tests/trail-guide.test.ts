import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  lastSeenArtwork,
  nextTrailArtwork,
  trailWalk,
} from "../src/lib/trail-guide.ts";
import { installations } from "../src/data/installations.ts";
import legs from "../src/data/trail-distances.json" with { type: "json" };
import {
  markArtworkSeen,
  parseSeenArtworks,
  toggleSeenArtwork,
} from "../src/lib/seen-artworks.ts";
const ids = installations.map((i) => i.id);
test("trail follows the last seen artwork in strict order, including already seen stops", () => {
  assert.equal(nextTrailArtwork(ids, null), ids[0]);
  let seen = new Set([ids[8], ids[0], ids[1]]);
  assert.equal(nextTrailArtwork(ids, lastSeenArtwork(seen)), ids[2]);
  seen = markArtworkSeen(seen, ids[6]);
  assert.equal(nextTrailArtwork(ids, lastSeenArtwork(seen)), ids[7]);
  seen = markArtworkSeen(seen, ids[7]);
  assert.equal(nextTrailArtwork(ids, lastSeenArtwork(seen)), ids[8]);
  const count = seen.size;
  seen = markArtworkSeen(seen, ids[8]);
  assert.equal(seen.size, count, "continuing from 09 never unchecks it");
  assert.equal(nextTrailArtwork(ids, lastSeenArtwork(seen)), ids[9]);
});
test("last confirmed visit survives reload and removing it falls back to the previous visit", () => {
  const seen = new Set([ids[8], ids[0], ids[1]]);
  const restored = parseSeenArtworks(JSON.stringify([...seen]), ids);
  assert.equal(lastSeenArtwork(restored), ids[1]);
  assert.equal(lastSeenArtwork(toggleSeenArtwork(restored, ids[1])), ids[0]);
  assert.equal(lastSeenArtwork(new Set()), null);
});
test("stop 13 ends the trail without jumping back to a random uncollected stop", () => {
  assert.equal(nextTrailArtwork(ids, ids[12]), null);
  assert.equal(nextTrailArtwork([], null), null);
  assert.equal(nextTrailArtwork(ids, "unknown"), ids[0]);
});
test("walking estimates follow mapped legs, including reverse travel, with no distance guessed across gaps", () => {
  assert.equal(legs.length, 12);
  const expected = legs[0].metres + legs[1].metres;
  assert.deepEqual(trailWalk(ids, legs, ids[0], ids[2]), {
    metres: expected,
    minutes: Math.ceil(expected / 65),
  });
  assert.deepEqual(
    trailWalk(ids, legs, ids[2], ids[0]),
    trailWalk(ids, legs, ids[0], ids[2]),
  );
  assert.equal(trailWalk(ids, legs.slice(1), ids[0], ids[2]), null);
  assert.equal(trailWalk(ids, legs, null, ids[0]), null);
  assert.equal(trailWalk(ids, legs, ids[0], ids[0]), null);
});

test("generated walking distances remain in sync with the displayed trail", () => {
  const route = JSON.parse(
    readFileSync(new URL("../public/data/trail.json", import.meta.url), "utf8"),
  );
  assert.equal(route.gaps.length, 0);
  assert.equal(route.segments.length, legs.length);
  route.segments.forEach((points: number[][], index: number) => {
    const metres = Math.round(
      points
        .slice(1)
        .reduce(
          (sum, p, j) =>
            sum + Math.hypot(p[0] - points[j][0], p[1] - points[j][1]),
          0,
        ),
    );
    assert.equal(legs[index].metres, metres);
    assert.equal(legs[index].from, ids[index]);
    assert.equal(legs[index].to, ids[index + 1]);
  });
});

test("03 to 04 follows Old Hall Street then Chapel Street instead of the back-street detour", () => {
  const { segments } = JSON.parse(
    readFileSync(new URL("../public/data/trail.json", import.meta.url), "utf8"),
  );
  const route = segments[2].map((p: number[]) => p.join(","));
  const waypoints = [
    [-222.5, -699.3],
    [-149.3, -594],
    [-120.3, -563.2],
    [-92.7, -529.2],
    [-32.9, -457.7],
    [-44.6, -448.2],
    [-170.7, -379.4],
  ];
  let previous = -1;
  for (const point of waypoints) {
    const index = route.indexOf(point.join(","));
    assert.ok(
      index > previous,
      `missing or reversed pavement waypoint ${point}`,
    );
    previous = index;
  }
  assert.ok(!route.includes("-174.4,-486"), "no Fazakerley Street detour");
  assert.equal(new Set(route).size, route.length, "no doubled-back route");
});

test("04 to 05 uses mapped crossings and the west-side Pier Head footpath", () => {
  const { segments, links } = JSON.parse(
    readFileSync(new URL("../public/data/trail.json", import.meta.url), "utf8"),
  );
  const route = segments[3].map((p: number[]) => p.join(","));
  const waypoints = [
    [-218.9, -321.6],
    [-229, -317],
    [-247.4, -309.6],
    [-254.2, -306.7],
    [-281.1, -332.8],
    [-304.8, -296.6],
    [-332.8, -274.9],
    [-393.1, -250.4],
    [-381.2, -228.4],
  ];
  let previous = -1;
  for (const point of waypoints) {
    const index = route.indexOf(point.join(","));
    assert.ok(
      index > previous,
      `missing or reversed crossing waypoint ${point}`,
    );
    previous = index;
  }
  assert.equal(
    new Set(route).size,
    route.length,
    "no doubling back from the west pavement",
  );
  assert.ok(
    !links.some((link: { id: string }) => link.id === "church-to-pier-head"),
  );
});

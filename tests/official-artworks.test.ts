import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { installations } from "../src/data/installations.ts";
const official = JSON.parse(
  readFileSync(
    new URL("../src/data/official-artworks.json", import.meta.url),
    "utf8",
  ),
);
test("all thirteen popups lead with the matching official image, excerpt and page", () => {
  assert.equal(Object.keys(official).length, 13);
  for (const item of installations) {
    const entry = official[item.id];
    assert.equal(item.photos[0].src, entry.image);
    assert.equal(item.description, entry.description);
    assert.equal(item.location, entry.location);
    assert.equal(item.source, entry.source);
    assert.ok(entry.source.endsWith(`/light-artworks/${item.id}/`));
    assert.ok(
      entry.originalImage.startsWith("https://assets.simpleviewinc.com/"),
    );
    assert.ok(existsSync(new URL(`../public${entry.image}`, import.meta.url)));
    assert.ok(!item.photos.some((p) => p.src.includes("/instagram/")));
    assert.ok(item.photos.slice(1).every((p) => p.kind === "site"));
  }
});

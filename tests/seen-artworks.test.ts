import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSeenArtworks,
  toggleSeenArtwork,
} from "../src/lib/seen-artworks.ts";

test("seen progress restores valid unique artwork IDs and tolerates invalid browser storage", () => {
  const ids = ["together", "loop"];
  assert.deepEqual(
    [...parseSeenArtworks('["together","together","unknown",null,42]', ids)],
    ["together"],
  );
  for (const raw of [null, "bad json", "null", "{}", "42"]) {
    assert.equal(parseSeenArtworks(raw, ids).size, 0);
  }
});

test("seen check-offs toggle off without mutating earlier state and survive a storage round trip", () => {
  const initial = new Set<string>();
  const marked = toggleSeenArtwork(initial, "together");
  assert.equal(initial.size, 0);
  const restored = parseSeenArtworks(JSON.stringify([...marked]), ["together"]);
  assert.ok(restored.has("together"));
  assert.equal(toggleSeenArtwork(restored, "together").size, 0);
  assert.equal(marked.size, 1);
});

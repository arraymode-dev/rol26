import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

test("photo import preserves originals, updates the manifest, and refuses overwrites", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "rol26-photo-test-"));
  try {
    mkdirSync(join(temporary, "src/data"), { recursive: true });
    writeFileSync(
      join(temporary, "src/data/survey.json"),
      JSON.stringify({
        photos: [],
        installationOverrides: [],
        buildingOverrides: [],
        additionalTrees: [],
      }),
    );
    const input = join(temporary, "survey-example.png");
    const original = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: "#738868" },
    })
      .png()
      .toBuffer();
    writeFileSync(input, original);
    const args = [
      resolve("scripts/import-photo.mjs"),
      "--file",
      input,
      "--installation",
      "loop",
      "--kind",
      "site",
      "--direction",
      "north",
    ];
    const result = spawnSync(process.execPath, args, {
      cwd: temporary,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(input), original);
    const manifest = JSON.parse(
      readFileSync(join(temporary, "src/data/survey.json"), "utf8"),
    );
    assert.equal(manifest.photos.length, 1);
    assert.equal(manifest.photos[0].direction, "north");
    assert.equal(manifest.photos[0].kind, "site");
    const meta = await sharp(
      join(temporary, "public/photos/loop-survey-example.webp"),
    ).metadata();
    assert.equal(meta.width, 1600);
    assert.equal(meta.height, 800);
    assert.equal(meta.exif, undefined);
    const repeated = spawnSync(process.execPath, args, {
      cwd: temporary,
      encoding: "utf8",
    });
    assert.notEqual(repeated.status, 0);
    assert.equal(
      JSON.parse(readFileSync(join(temporary, "src/data/survey.json"), "utf8"))
        .photos.length,
      1,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

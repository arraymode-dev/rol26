import test from "node:test";
import assert from "node:assert/strict";
import {
  certificateSvg,
  shareCertificate,
  canShareCertificate,
} from "../src/lib/collection-certificate.ts";

const file = new File(["certificate"], "certificate.png", {
  type: "image/png",
});
test("certificate is a portrait image with one gold light per collected artwork", () => {
  const svg = certificateSvg(13);
  assert.match(svg, /width="1080" height="1350"/);
  assert.equal((svg.match(/r="7"/g) ?? []).length, 13);
  assert.match(svg, /OF 13 LIGHTS/);
  assert.match(svg, /Unofficial explorer certificate/);
});
test("certificate file sharing checks support and hands over the PNG", async () => {
  let shared: ShareData | undefined;
  const support = {
    canShare: (data?: ShareData) => data?.files?.[0] === file,
    share: async (data?: ShareData) => {
      shared = data;
    },
  };
  assert.equal(canShareCertificate(file, support), true);
  assert.equal(await shareCertificate(file, support), "shared");
  assert.deepEqual(shared?.files, [file]);
  assert.equal(
    await shareCertificate(file, { ...support, canShare: () => false }),
    "unavailable",
  );
  assert.equal(
    canShareCertificate(file, {
      ...support,
      canShare: () => {
        throw new Error("blocked");
      },
    }),
    false,
  );
});
test("cancelled share is quiet and failed share can offer image download", async () => {
  const support = {
    canShare: () => true,
    share: async () => {
      throw new DOMException("cancel", "AbortError");
    },
  };
  assert.equal(await shareCertificate(file, support), "cancelled");
  assert.equal(
    await shareCertificate(file, {
      ...support,
      share: async () => {
        throw new Error("unavailable");
      },
    }),
    "failed",
  );
});

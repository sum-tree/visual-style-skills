import assert from "node:assert/strict";
import test from "node:test";
import { chooseOpenAiImageSize } from "./image-size";

test("chooses supported sizes while preserving common source ratios", () => {
  assert.equal(chooseOpenAiImageSize(1000, 1000), "1024x1024");
  assert.equal(chooseOpenAiImageSize(1200, 800), "1536x1024");
  assert.equal(chooseOpenAiImageSize(800, 1200), "1024x1536");

  const portrait = chooseOpenAiImageSize(901, 1200);
  const [width, height] = portrait.split("x").map(Number);
  const error = Math.abs(width / height - 901 / 1200) / (901 / 1200);
  assert.ok(error <= 0.005);
  assert.equal(width % 16, 0);
  assert.equal(height % 16, 0);
});

test("rejects unsupported panorama ratios", () => {
  assert.throws(() => chooseOpenAiImageSize(4000, 1000), /3:1/);
  assert.throws(() => chooseOpenAiImageSize(0, 1000), /Invalid/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { chooseOpenAiImageSize } from "./image-size";

test("chooses supported sizes while preserving common source ratios", () => {
  assert.equal(chooseOpenAiImageSize(1000, 1000), "1024x1024");
  assert.equal(chooseOpenAiImageSize(1200, 800), "1536x1024");
  assert.equal(chooseOpenAiImageSize(800, 1200), "1024x1536");
  assert.equal(chooseOpenAiImageSize(1000, 1000, "2k"), "2048x2048");
  assert.equal(chooseOpenAiImageSize(1920, 1080, "4k"), "3840x2160");
  assert.equal(chooseOpenAiImageSize(1000, 1000, "4k"), "2880x2880");

  const portrait = chooseOpenAiImageSize(901, 1200);
  const [width, height] = portrait.split("x").map(Number);
  const error = Math.abs(width / height - 901 / 1200) / (901 / 1200);
  assert.ok(error <= 0.005);
  assert.equal(width % 16, 0);
  assert.equal(height % 16, 0);
});

test("keeps every resolution tier inside GPT-Image-2 constraints", () => {
  for (const resolution of ["1k", "2k", "4k"] as const) {
    const size = chooseOpenAiImageSize(901, 1200, resolution);
    const [width, height] = size.split("x").map(Number);
    assert.ok(Math.max(width, height) <= 3840);
    assert.ok(width * height >= 655_360);
    assert.ok(width * height <= 8_294_400);
    assert.equal(width % 16, 0);
    assert.equal(height % 16, 0);
    assert.ok(Math.abs(width / height - 901 / 1200) / (901 / 1200) <= 0.005);
  }
});

test("rejects unsupported panorama ratios", () => {
  assert.throws(() => chooseOpenAiImageSize(4000, 1000), /3:1/);
  assert.throws(() => chooseOpenAiImageSize(0, 1000), /Invalid/);
});

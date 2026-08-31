import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  calculateAspectError,
  composeComparison,
  MAX_ASPECT_RATIO_ERROR,
} from "./index";

async function fixture(width: number, height: number, color: string) {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

test("uses left-right layout for portrait sources", async () => {
  const result = await composeComparison({
    original: await fixture(300, 400, "#ff0000"),
    effect: await fixture(600, 800, "#0000ff"),
  });
  assert.equal(result.metadata.layout, "horizontal");
  assert.deepEqual(result.metadata.canvasSize, [640, 426]);
  assert.equal(result.metadata.aspectError, 0);
});

test("uses top-bottom layout for landscape sources", async () => {
  const result = await composeComparison({
    original: await fixture(400, 300, "#ff0000"),
    effect: await fixture(800, 600, "#0000ff"),
  });
  assert.equal(result.metadata.layout, "vertical");
  assert.deepEqual(result.metadata.canvasSize, [426, 640]);
});

test("rejects effect images outside the 0.5 percent ratio tolerance", async () => {
  await assert.rejects(
    composeComparison({
      original: await fixture(300, 400, "#ff0000"),
      effect: await fixture(300, 390, "#0000ff"),
    }),
    /maximum is 0\.5%/,
  );
  assert.ok(
    calculateAspectError(
      { width: 300, height: 400 },
      { width: 300, height: 390 },
    ) > MAX_ASPECT_RATIO_ERROR,
  );
});

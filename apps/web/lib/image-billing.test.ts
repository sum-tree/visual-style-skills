import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateGptImage2Cost,
  normalizeImageUsage,
} from "./image-billing";

test("normalizes GPT Image usage and calculates each standard-rate cost", () => {
  const estimate = estimateGptImage2Cost({
    total_tokens: 12_600,
    input_tokens: 2_600,
    output_tokens: 10_000,
    input_tokens_details: {
      text_tokens: 100,
      image_tokens: 2_500,
      cached_tokens: 500,
    },
  });

  assert.deepEqual(estimate.usage, {
    totalTokens: 12_600,
    inputTokens: 2_600,
    outputTokens: 10_000,
    textInputTokens: 100,
    imageInputTokens: 2_500,
    cachedImageInputTokens: 500,
  });
  assert.ok(estimate.cost);
  assert.equal(estimate.cost.textInputUsd, 0.0005);
  assert.equal(estimate.cost.imageInputUsd, 0.016);
  assert.equal(estimate.cost.cachedImageInputUsd, 0.001);
  assert.equal(estimate.cost.imageOutputUsd, 0.3);
  assert.equal(estimate.cost.totalUsd, 0.3175);
});

test("returns token totals without inventing a cost when modality detail is missing", () => {
  const estimate = estimateGptImage2Cost({
    total_tokens: 12_600,
    input_tokens: 2_600,
    output_tokens: 10_000,
  });

  assert.equal(estimate.usage?.totalTokens, 12_600);
  assert.equal(estimate.cost, null);
});

test("accepts compatible cached-token field names and rejects empty usage", () => {
  assert.deepEqual(
    normalizeImageUsage({
      output_tokens: 800,
      input_tokens_details: {
        text_tokens: 20,
        image_tokens: 200,
        cached_image_tokens: 40,
      },
    }),
    {
      totalTokens: 1_020,
      inputTokens: 220,
      outputTokens: 800,
      textInputTokens: 20,
      imageInputTokens: 200,
      cachedImageInputTokens: 40,
    },
  );
  assert.equal(normalizeImageUsage({}), null);
});

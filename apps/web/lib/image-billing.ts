export const GPT_IMAGE_2_STANDARD_PRICING = {
  model: "gpt-image-2",
  currency: "USD",
  unitTokens: 1_000_000,
  effectiveDate: "2026-09-01",
  sourceUrl: "https://developers.openai.com/api/docs/pricing",
  usdPerMillionTokens: {
    textInput: 5,
    imageInput: 8,
    cachedImageInput: 2,
    imageOutput: 30,
  },
} as const;

export type NormalizedImageUsage = {
  totalTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  textInputTokens: number | null;
  imageInputTokens: number | null;
  cachedImageInputTokens: number;
};

export type ImageCostBreakdown = {
  textInputUsd: number;
  imageInputUsd: number;
  cachedImageInputUsd: number;
  imageOutputUsd: number;
  totalUsd: number;
};

export type ImageBillingEstimate = {
  model: typeof GPT_IMAGE_2_STANDARD_PRICING.model;
  currency: typeof GPT_IMAGE_2_STANDARD_PRICING.currency;
  effectiveDate: string;
  sourceUrl: string;
  pricing: typeof GPT_IMAGE_2_STANDARD_PRICING.usdPerMillionTokens;
  usage: NormalizedImageUsage | null;
  cost: ImageCostBreakdown | null;
};

function asTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function firstTokenCount(...values: unknown[]): number | null {
  for (const value of values) {
    const count = asTokenCount(value);
    if (count !== null) return count;
  }
  return null;
}

export function normalizeImageUsage(value: unknown): NormalizedImageUsage | null {
  const usage = asRecord(value);
  if (!usage) return null;

  const details = asRecord(usage.input_tokens_details);
  const textInputTokens = firstTokenCount(
    details?.text_tokens,
    usage.text_input_tokens,
  );
  const imageInputTokens = firstTokenCount(
    details?.image_tokens,
    usage.image_input_tokens,
  );
  const reportedCachedTokens = firstTokenCount(
    details?.cached_tokens,
    details?.cached_image_tokens,
    usage.cached_input_tokens,
    usage.cached_image_input_tokens,
  );
  const cachedImageInputTokens = Math.min(
    reportedCachedTokens ?? 0,
    imageInputTokens ?? 0,
  );
  const reportedInputTokens = asTokenCount(usage.input_tokens);
  const reportedOutputTokens = asTokenCount(usage.output_tokens);
  const reportedTotalTokens = asTokenCount(usage.total_tokens);
  const derivedInputTokens =
    textInputTokens !== null && imageInputTokens !== null
      ? textInputTokens + imageInputTokens
      : null;
  const inputTokens = reportedInputTokens ?? derivedInputTokens;
  const totalTokens =
    reportedTotalTokens ??
    (inputTokens !== null && reportedOutputTokens !== null
      ? inputTokens + reportedOutputTokens
      : null);

  if (
    totalTokens === null &&
    inputTokens === null &&
    reportedOutputTokens === null &&
    textInputTokens === null &&
    imageInputTokens === null
  ) {
    return null;
  }

  return {
    totalTokens,
    inputTokens,
    outputTokens: reportedOutputTokens,
    textInputTokens,
    imageInputTokens,
    cachedImageInputTokens,
  };
}

export function estimateGptImage2Cost(value: unknown): ImageBillingEstimate {
  const usage = normalizeImageUsage(value);
  let cost: ImageCostBreakdown | null = null;

  if (
    usage !== null &&
    usage.textInputTokens !== null &&
    usage.imageInputTokens !== null &&
    usage.outputTokens !== null
  ) {
    const rates = GPT_IMAGE_2_STANDARD_PRICING.usdPerMillionTokens;
    const unit = GPT_IMAGE_2_STANDARD_PRICING.unitTokens;
    const billableImageInputTokens = Math.max(
      0,
      usage.imageInputTokens - usage.cachedImageInputTokens,
    );
    const textInputUsd = (usage.textInputTokens * rates.textInput) / unit;
    const imageInputUsd = (billableImageInputTokens * rates.imageInput) / unit;
    const cachedImageInputUsd =
      (usage.cachedImageInputTokens * rates.cachedImageInput) / unit;
    const imageOutputUsd = (usage.outputTokens * rates.imageOutput) / unit;
    cost = {
      textInputUsd,
      imageInputUsd,
      cachedImageInputUsd,
      imageOutputUsd,
      totalUsd:
        textInputUsd + imageInputUsd + cachedImageInputUsd + imageOutputUsd,
    };
  }

  return {
    model: GPT_IMAGE_2_STANDARD_PRICING.model,
    currency: GPT_IMAGE_2_STANDARD_PRICING.currency,
    effectiveDate: GPT_IMAGE_2_STANDARD_PRICING.effectiveDate,
    sourceUrl: GPT_IMAGE_2_STANDARD_PRICING.sourceUrl,
    pricing: GPT_IMAGE_2_STANDARD_PRICING.usdPerMillionTokens,
    usage,
    cost,
  };
}

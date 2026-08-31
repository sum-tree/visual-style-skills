import sharp from "sharp";

export const MAX_ASPECT_RATIO_ERROR = 0.005;
export const COMPARISON_BACKGROUND = "#F7F4EE";
export const COMPARISON_BORDER = "#E5E0D7";

export type ComparisonLayout = "horizontal" | "vertical";

export type ComparisonMetadata = {
  layout: ComparisonLayout;
  sourceSize: [number, number];
  effectInputSize: [number, number];
  canvasSize: [number, number];
  marginPx: number;
  gapPx: number;
  borderPx: number;
  aspectError: number;
};

export type ComparisonResult = {
  buffer: Buffer;
  metadata: ComparisonMetadata;
};

type Dimensions = { width: number; height: number };

async function normalizePng(input: Buffer): Promise<{
  buffer: Buffer;
  dimensions: Dimensions;
}> {
  const buffer = await sharp(input, { failOn: "error" }).rotate().png().toBuffer();
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions.");
  }
  return {
    buffer,
    dimensions: { width: metadata.width, height: metadata.height },
  };
}

export function calculateAspectError(
  source: Dimensions,
  effect: Dimensions,
): number {
  const sourceRatio = source.width / source.height;
  const effectRatio = effect.width / effect.height;
  return Math.abs(effectRatio - sourceRatio) / sourceRatio;
}

async function addBorder(
  input: Buffer,
  width: number,
  height: number,
  borderPx: number,
): Promise<Buffer> {
  return sharp(input)
    .resize(width, height, { fit: "fill" })
    .extend({
      top: borderPx,
      bottom: borderPx,
      left: borderPx,
      right: borderPx,
      background: COMPARISON_BORDER,
    })
    .png()
    .toBuffer();
}

export async function composeComparison(options: {
  original: Buffer;
  effect: Buffer;
}): Promise<ComparisonResult> {
  const original = await normalizePng(options.original);
  const effect = await normalizePng(options.effect);
  const aspectError = calculateAspectError(
    original.dimensions,
    effect.dimensions,
  );

  if (aspectError > MAX_ASPECT_RATIO_ERROR) {
    throw new Error(
      `Effect aspect ratio differs from the source by ${(aspectError * 100).toFixed(3)}%; maximum is 0.5%.`,
    );
  }

  const { width, height } = original.dimensions;
  const shortSide = Math.min(width, height);
  const marginPx = Math.max(1, Math.round(shortSide * 0.04));
  const gapPx = marginPx;
  const borderPx = Math.max(1, Math.round(shortSide * 0.00125));
  const layout: ComparisonLayout = height >= width ? "horizontal" : "vertical";

  const originalFrame = await addBorder(
    original.buffer,
    width,
    height,
    borderPx,
  );
  const effectFrame = await addBorder(
    effect.buffer,
    width,
    height,
    borderPx,
  );
  const frameWidth = width + borderPx * 2;
  const frameHeight = height + borderPx * 2;
  const canvasWidth =
    layout === "horizontal"
      ? marginPx * 2 + frameWidth * 2 + gapPx
      : marginPx * 2 + frameWidth;
  const canvasHeight =
    layout === "vertical"
      ? marginPx * 2 + frameHeight * 2 + gapPx
      : marginPx * 2 + frameHeight;

  const secondLeft =
    layout === "horizontal" ? marginPx + frameWidth + gapPx : marginPx;
  const secondTop =
    layout === "vertical" ? marginPx + frameHeight + gapPx : marginPx;

  const buffer = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: COMPARISON_BACKGROUND,
    },
  })
    .composite([
      { input: originalFrame, left: marginPx, top: marginPx },
      { input: effectFrame, left: secondLeft, top: secondTop },
    ])
    .png()
    .toBuffer();

  return {
    buffer,
    metadata: {
      layout,
      sourceSize: [width, height],
      effectInputSize: [effect.dimensions.width, effect.dimensions.height],
      canvasSize: [canvasWidth, canvasHeight],
      marginPx,
      gapPx,
      borderPx,
      aspectError,
    },
  };
}

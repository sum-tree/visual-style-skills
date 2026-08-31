const MAX_EDGE = 1536;
const MIN_EDGE = 512;
const STEP = 16;
const MAX_RATIO = 3;
const MAX_ASPECT_ERROR = 0.005;

export type OpenAiImageSize = `${number}x${number}`;

export function chooseOpenAiImageSize(
  sourceWidth: number,
  sourceHeight: number,
): OpenAiImageSize {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error("Invalid source dimensions.");
  }

  const ratio = sourceWidth / sourceHeight;
  if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) {
    throw new Error("Source aspect ratio must not exceed 3:1.");
  }

  if (Math.abs(ratio - 1) < 0.01) {
    return "1024x1024";
  }

  for (let longEdge = MAX_EDGE; longEdge >= 1024; longEdge -= STEP) {
    const rawShort = longEdge / Math.max(ratio, 1 / ratio);
    const shortEdge = Math.max(
      MIN_EDGE,
      Math.min(MAX_EDGE, Math.round(rawShort / STEP) * STEP),
    );
    const width = ratio >= 1 ? longEdge : shortEdge;
    const height = ratio >= 1 ? shortEdge : longEdge;
    const candidateRatio = width / height;
    const aspectError = Math.abs(candidateRatio - ratio) / ratio;
    const pixels = width * height;

    if (
      aspectError <= MAX_ASPECT_ERROR &&
      pixels >= 655_360 &&
      pixels <= 8_294_400
    ) {
      return `${width}x${height}`;
    }
  }

  throw new Error("Could not derive a supported output size for this image.");
}

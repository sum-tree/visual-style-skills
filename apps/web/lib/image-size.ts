const MAX_EDGE = 3840;
const MIN_EDGE = 512;
const STEP = 16;
const MAX_RATIO = 3;
const MAX_ASPECT_ERROR = 0.005;
const MIN_PIXELS = 655_360;
const MAX_PIXELS = 8_294_400;

const RESOLUTION_LONG_EDGE = {
  "1k": 1536,
  "2k": 2048,
  "4k": 3840,
} as const;

const SQUARE_EDGE = {
  "1k": 1024,
  "2k": 2048,
  "4k": 2880,
} as const;

export type OpenAiImageSize = `${number}x${number}`;
export type OutputResolution = keyof typeof RESOLUTION_LONG_EDGE;

export function chooseOpenAiImageSize(
  sourceWidth: number,
  sourceHeight: number,
  resolution: OutputResolution = "1k",
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
    const edge = SQUARE_EDGE[resolution];
    return `${edge}x${edge}`;
  }

  const targetLongEdge = Math.min(RESOLUTION_LONG_EDGE[resolution], MAX_EDGE);
  for (let longEdge = targetLongEdge; longEdge >= MIN_EDGE; longEdge -= STEP) {
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
      pixels >= MIN_PIXELS &&
      pixels <= MAX_PIXELS
    ) {
      return `${width}x${height}`;
    }
  }

  throw new Error("Could not derive a supported output size for this image.");
}

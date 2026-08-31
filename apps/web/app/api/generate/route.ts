import { composeComparison } from "@visual-style/comparison-composer";
import {
  compileStylePrompt,
  type ImageQuality,
} from "@visual-style/style-registry";
import sharp from "sharp";
import { chooseOpenAiImageSize } from "@/lib/image-size";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const QUALITY_VALUES = new Set<ImageQuality>(["low", "medium", "high"]);

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string; output_format?: string }>;
  error?: {
    code?: string;
    message?: string;
    moderation_details?: unknown;
  };
};

function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bufferToDataUrl(buffer: Buffer, mime = "image/png") {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function apiError(message: string, status: number) {
  return Response.json({ error: { message } }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return apiError("服务端尚未配置 OPENAI_API_KEY。", 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("无法读取上传内容。", 400);
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return apiError("请上传一张图片。", 400);
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return apiError("仅支持 JPEG、PNG 和 WebP。", 415);
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return apiError("单张图片必须小于 12 MB。", 413);
  }

  const styleId = getTextField(formData, "styleId");
  const variantId = getTextField(formData, "variantId") || undefined;
  const customInstruction = getTextField(formData, "customInstruction");
  const qualityValue = getTextField(formData, "quality") as ImageQuality;
  const quality: ImageQuality = QUALITY_VALUES.has(qualityValue)
    ? qualityValue
    : "medium";

  let compiled: ReturnType<typeof compileStylePrompt>;
  try {
    compiled = compileStylePrompt({ styleId, variantId, customInstruction });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "无效的风格配置。",
      400,
    );
  }

  let normalizedOriginal: Buffer;
  let width: number;
  let height: number;
  try {
    const sourceBuffer = Buffer.from(await file.arrayBuffer());
    normalizedOriginal = await sharp(sourceBuffer, { failOn: "error" })
      .rotate()
      .png()
      .toBuffer();
    const metadata = await sharp(normalizedOriginal).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("missing dimensions");
    }
    width = metadata.width;
    height = metadata.height;
  } catch {
    return apiError("图片文件损坏或无法解码。", 400);
  }

  let size: ReturnType<typeof chooseOpenAiImageSize>;
  try {
    size = chooseOpenAiImageSize(width, height);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "不支持该图片比例。",
      400,
    );
  }

  const endpointBase =
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (process.env.OPENAI_ORG_ID?.trim()) {
    headers["OpenAI-Organization"] = process.env.OPENAI_ORG_ID.trim();
  }
  if (process.env.OPENAI_PROJECT_ID?.trim()) {
    headers["OpenAI-Project"] = process.env.OPENAI_PROJECT_ID.trim();
  }

  let openAiResponse: Response;
  try {
    openAiResponse = await fetch(
      `${endpointBase.replace(/\/$/, "")}/images/edits`,
      {
        method: "POST",
        headers,
        signal: request.signal,
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt: compiled.prompt,
          images: [{ image_url: bufferToDataUrl(normalizedOriginal) }],
          size,
          quality,
          output_format: "png",
          moderation: "auto",
          n: 1,
        }),
      },
    );
  } catch (error) {
    if (request.signal.aborted) {
      return apiError("请求已取消。", 499);
    }
    console.error("OpenAI image request failed before response", error);
    return apiError("暂时无法连接图像生成服务。", 502);
  }

  const requestId = openAiResponse.headers.get("x-request-id");
  let payload: OpenAiImageResponse;
  try {
    payload = (await openAiResponse.json()) as OpenAiImageResponse;
  } catch {
    return apiError("图像服务返回了无法解析的响应。", 502);
  }

  if (!openAiResponse.ok) {
    console.error("OpenAI image request rejected", {
      status: openAiResponse.status,
      requestId,
      code: payload.error?.code,
      moderationDetails: payload.error?.moderation_details,
    });
    const message =
      payload.error?.code === "moderation_blocked"
        ? "该请求未通过图像安全检查，请调整附加要求或更换图片。"
        : payload.error?.message ||
          `图像生成失败（HTTP ${openAiResponse.status}）。`;
    return apiError(message, openAiResponse.status);
  }

  const encodedEffect = payload.data?.[0]?.b64_json;
  if (!encodedEffect) {
    return apiError("图像服务没有返回效果图。", 502);
  }

  const effect = Buffer.from(encodedEffect, "base64");
  let comparison: Awaited<ReturnType<typeof composeComparison>>;
  try {
    comparison = await composeComparison({
      original: normalizedOriginal,
      effect,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "对照图拼版失败。",
      422,
    );
  }

  return Response.json({
    style: {
      id: compiled.style.id,
      name: compiled.style.name,
      outputSuffix: compiled.style.outputSuffix,
    },
    variant: { id: compiled.variant.id, label: compiled.variant.label },
    quality,
    size,
    requestId,
    effectDataUrl: bufferToDataUrl(effect),
    comparisonDataUrl: bufferToDataUrl(comparison.buffer),
    comparisonMetadata: comparison.metadata,
  });
}

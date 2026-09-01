import { composeComparison } from "@visual-style/comparison-composer";
import {
  compileStylePrompt,
  type ImageQuality,
} from "@visual-style/style-registry";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { chooseOpenAiImageSize } from "@/lib/image-size";
import { estimateGptImage2Cost } from "@/lib/image-billing";
import {
  API_KEY_SESSION_COOKIE,
  isTrustedSameOrigin,
  resolveApiKey,
} from "@/lib/api-key-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const QUALITY_VALUES = new Set<ImageQuality>(["low", "medium", "high"]);

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string; output_format?: string }>;
  usage?: unknown;
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

function apiError(message: string, status: number, code?: string) {
  return Response.json(
    { error: { message, code } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "zh";
  const message = (zh: string, en: string) => (locale === "en" ? en : zh);
  if (!isTrustedSameOrigin(request)) {
    return apiError(
      message("请求来源校验失败。", "Request origin validation failed."),
      403,
      "origin_rejected",
    );
  }
  const sessionId = request.cookies.get(API_KEY_SESSION_COOKIE)?.value;
  const apiKey = resolveApiKey(sessionId).apiKey;
  if (!apiKey) {
    return apiError(
      message("请先在页面中安全填写 OpenAI API Key。", "Add an OpenAI API key in Settings first."),
      503,
      "api_key_missing",
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(message("无法读取上传内容。", "Unable to read the upload."), 400);
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return apiError(message("请上传一张图片。", "Upload one image."), 400);
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return apiError(message("仅支持 JPEG、PNG 和 WebP。", "Only JPEG, PNG, and WebP are supported."), 415);
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return apiError(message("单张图片必须小于 12 MB。", "Each image must be smaller than 12 MB."), 413);
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
      error instanceof Error ? error.message : message("无效的风格配置。", "Invalid style configuration."),
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
    return apiError(message("图片文件损坏或无法解码。", "The image is damaged or cannot be decoded."), 400);
  }

  let size: ReturnType<typeof chooseOpenAiImageSize>;
  try {
    size = chooseOpenAiImageSize(width, height);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : message("不支持该图片比例。", "This image aspect ratio is not supported."),
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
      return apiError(message("请求已取消。", "The request was cancelled."), 499);
    }
    console.error("OpenAI image request failed before response", error);
    return apiError(message("暂时无法连接图像生成服务。", "Unable to reach the image service right now."), 502);
  }

  const requestId = openAiResponse.headers.get("x-request-id");
  let payload: OpenAiImageResponse;
  try {
    payload = (await openAiResponse.json()) as OpenAiImageResponse;
  } catch {
    return apiError(message("图像服务返回了无法解析的响应。", "The image service returned an unreadable response."), 502);
  }

  if (!openAiResponse.ok) {
    console.error("OpenAI image request rejected", {
      status: openAiResponse.status,
      requestId,
      code: payload.error?.code,
      moderationDetails: payload.error?.moderation_details,
    });
    const errorMessage =
      payload.error?.code === "moderation_blocked"
        ? message("该请求未通过图像安全检查，请调整附加要求或更换图片。", "The request did not pass image safety checks. Adjust the instruction or use another image.")
        : payload.error?.message ||
          `图像生成失败（HTTP ${openAiResponse.status}）。`;
    return apiError(errorMessage, openAiResponse.status);
  }

  const encodedEffect = payload.data?.[0]?.b64_json;
  if (!encodedEffect) {
    return apiError(message("图像服务没有返回效果图。", "The image service did not return an effect image."), 502);
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
      error instanceof Error ? error.message : message("对照图拼版失败。", "Failed to compose the comparison image."),
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
    billing: estimateGptImage2Cost(payload.usage),
  }, { headers: { "Cache-Control": "no-store" } });
}

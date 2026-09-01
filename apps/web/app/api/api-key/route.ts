import { NextRequest, NextResponse } from "next/server";
import {
  API_KEY_SESSION_COOKIE,
  API_KEY_SESSION_TTL_SECONDS,
  deleteSessionApiKey,
  isTrustedSameOrigin,
  normalizeApiKey,
  resolveApiKey,
  saveSessionApiKey,
  shouldUseSecureSessionCookie,
} from "@/lib/api-key-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048;

function noStoreJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

async function readSmallJson(request: Request): Promise<unknown> {
  if (!request.body) return null;
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("body_too_large");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(merged));
}

function rejectCrossOrigin() {
  return noStoreJson(
    { error: { code: "origin_rejected", message: "Request origin rejected." } },
    403,
  );
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(API_KEY_SESSION_COOKIE)?.value;
  const resolved = resolveApiKey(sessionId);
  return noStoreJson({
    configured: Boolean(resolved.apiKey),
    source: resolved.source,
  });
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOrigin(request)) return rejectCrossOrigin();
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return noStoreJson(
      { error: { code: "invalid_content_type", message: "JSON required." } },
      415,
    );
  }

  let body: unknown;
  try {
    body = await readSmallJson(request);
  } catch {
    return noStoreJson(
      { error: { code: "invalid_body", message: "Invalid request body." } },
      400,
    );
  }

  const apiKey = normalizeApiKey(
    typeof body === "object" && body ? (body as { apiKey?: unknown }).apiKey : null,
  );
  if (!apiKey) {
    return noStoreJson(
      { error: { code: "invalid_api_key", message: "Invalid API key format." } },
      400,
    );
  }

  const existingSessionId = request.cookies.get(API_KEY_SESSION_COOKIE)?.value;
  const sessionId = saveSessionApiKey(apiKey, existingSessionId);
  const response = noStoreJson({ configured: true, source: "session" });
  response.cookies.set({
    name: API_KEY_SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "strict",
    maxAge: API_KEY_SESSION_TTL_SECONDS,
    path: "/",
    priority: "high",
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedSameOrigin(request)) return rejectCrossOrigin();
  const sessionId = request.cookies.get(API_KEY_SESSION_COOKIE)?.value;
  deleteSessionApiKey(sessionId);
  const resolved = resolveApiKey();
  const response = noStoreJson({
    configured: Boolean(resolved.apiKey),
    source: resolved.source,
  });
  response.cookies.set({
    name: API_KEY_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}

import { randomUUID } from "node:crypto";

export const API_KEY_SESSION_COOKIE = "vss_api_session";
export const API_KEY_SESSION_TTL_SECONDS = 8 * 60 * 60;

const MAX_SESSIONS = 128;
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const API_KEY_PATTERN = /^[\x21-\x7e]+$/;

type SessionEntry = {
  apiKey: string;
  expiresAt: number;
  updatedAt: number;
};

const globalSessionStore = globalThis as typeof globalThis & {
  __visualStyleApiKeySessions?: Map<string, SessionEntry>;
};

const sessions =
  globalSessionStore.__visualStyleApiKeySessions ??
  (globalSessionStore.__visualStyleApiKeySessions = new Map());

function pruneSessions(now = Date.now()) {
  for (const [id, entry] of sessions) {
    if (entry.expiresAt <= now) sessions.delete(id);
  }

  while (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort(
      (left, right) => left[1].updatedAt - right[1].updatedAt,
    )[0];
    if (!oldest) break;
    sessions.delete(oldest[0]);
  }
}

export function normalizeApiKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const apiKey = input.trim();
  if (
    apiKey.length < 20 ||
    apiKey.length > 512 ||
    !API_KEY_PATTERN.test(apiKey)
  ) {
    return null;
  }
  return apiKey;
}

export function saveSessionApiKey(
  apiKey: string,
  existingSessionId?: string,
): string {
  const now = Date.now();
  pruneSessions(now);
  const canReuse =
    existingSessionId &&
    SESSION_ID_PATTERN.test(existingSessionId) &&
    sessions.has(existingSessionId);
  const sessionId = canReuse ? existingSessionId : randomUUID();
  sessions.set(sessionId, {
    apiKey,
    expiresAt: now + API_KEY_SESSION_TTL_SECONDS * 1000,
    updatedAt: now,
  });
  return sessionId;
}

export function deleteSessionApiKey(sessionId?: string) {
  if (sessionId && SESSION_ID_PATTERN.test(sessionId)) {
    sessions.delete(sessionId);
  }
}

export function resolveApiKey(sessionId?: string): {
  apiKey?: string;
  source: "environment" | "session" | null;
} {
  const environmentKey = normalizeApiKey(process.env.OPENAI_API_KEY);
  if (environmentKey) {
    return { apiKey: environmentKey, source: "environment" };
  }

  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    return { source: null };
  }

  const entry = sessions.get(sessionId);
  if (!entry) return { source: null };
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return { source: null };
  }

  return { apiKey: entry.apiKey, source: "session" };
}

export function isTrustedSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const requestedWith = request.headers.get("x-requested-with");
  if (!origin || requestedWith !== "XMLHttpRequest") return false;

  try {
    const configuredOrigin = process.env.APP_ORIGIN?.trim();
    const expectedOrigin = configuredOrigin
      ? new URL(configuredOrigin).origin
      : new URL(request.url).origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function shouldUseSecureSessionCookie(): boolean {
  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV === "production";
}

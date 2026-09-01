import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteSessionApiKey,
  isTrustedSameOrigin,
  normalizeApiKey,
  resolveApiKey,
  saveSessionApiKey,
} from "./api-key-session";

test("validates API key input without persisting invalid values", () => {
  assert.equal(normalizeApiKey("short"), null);
  assert.equal(normalizeApiKey("sk-example\nsecret-value-123456"), null);
  assert.equal(
    normalizeApiKey("  test-key_example-value-123456  "),
    "test-key_example-value-123456",
  );
});

test("stores API keys behind opaque server-side sessions", () => {
  const environmentKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const sessionId = saveSessionApiKey("test-key_example-value-123456");
    assert.match(sessionId, /^[0-9a-f-]{36}$/i);
    assert.equal(resolveApiKey(sessionId).source, "session");
    assert.equal(
      resolveApiKey(sessionId).apiKey,
      "test-key_example-value-123456",
    );
    deleteSessionApiKey(sessionId);
    assert.equal(resolveApiKey(sessionId).source, null);
  } finally {
    if (environmentKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = environmentKey;
  }
});

test("requires an exact same-origin XMLHttpRequest marker", () => {
  const configuredOrigin = process.env.APP_ORIGIN;
  delete process.env.APP_ORIGIN;
  const trusted = new Request("http://localhost:7777/api/api-key", {
    method: "POST",
    headers: {
      origin: "http://localhost:7777",
      "x-requested-with": "XMLHttpRequest",
    },
  });
  const crossOrigin = new Request("http://localhost:7777/api/api-key", {
    method: "POST",
    headers: {
      origin: "https://example.com",
      "x-requested-with": "XMLHttpRequest",
    },
  });
  try {
    assert.equal(isTrustedSameOrigin(trusted), true);
    assert.equal(isTrustedSameOrigin(crossOrigin), false);
  } finally {
    if (configuredOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = configuredOrigin;
  }
});

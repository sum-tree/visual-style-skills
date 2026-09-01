import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenAiImageEditForm } from "./image-request";

test("builds the image edit request as multipart file data", async () => {
  const form = buildOpenAiImageEditForm({
    image: new Uint8Array([137, 80, 78, 71]),
    prompt: "Transform only the image medium.",
    size: "2048x1152",
    quality: "medium",
  });

  assert.equal(form.get("model"), "gpt-image-2");
  assert.equal(form.get("prompt"), "Transform only the image medium.");
  assert.equal(form.get("size"), "2048x1152");
  assert.equal(form.get("quality"), "medium");
  const image = form.get("image[]");
  assert.ok(image instanceof File);
  assert.equal(image.name, "source.png");
  assert.equal(image.type, "image/png");
  assert.deepEqual(
    new Uint8Array(await image.arrayBuffer()),
    new Uint8Array([137, 80, 78, 71]),
  );
});

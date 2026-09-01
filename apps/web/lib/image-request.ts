import type { ImageQuality } from "@visual-style/style-registry";
import type { OpenAiImageSize } from "./image-size";

type ImageEditFormOptions = {
  image: Uint8Array;
  prompt: string;
  size: OpenAiImageSize;
  quality: ImageQuality;
};

export function buildOpenAiImageEditForm({
  image,
  prompt,
  size,
  quality,
}: ImageEditFormOptions): FormData {
  const form = new FormData();
  const imageBytes = Uint8Array.from(image);
  form.set("model", "gpt-image-2");
  form.append(
    "image[]",
    new Blob([imageBytes], { type: "image/png" }),
    "source.png",
  );
  form.set("prompt", prompt);
  form.set("size", size);
  form.set("quality", quality);
  form.set("output_format", "png");
  form.set("moderation", "auto");
  form.set("n", "1");
  return form;
}

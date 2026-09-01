import assert from "node:assert/strict";
import test from "node:test";
import { compileStylePrompt, listPublicStyles } from "./index";

test("loads all seven style presets with valid defaults", () => {
  const styles = listPublicStyles();
  assert.equal(styles.length, 7);
  assert.equal(new Set(styles.map((style) => style.id)).size, 7);
  for (const style of styles) {
    assert.ok(style.nameEn);
    assert.ok(style.descriptionEn);
    assert.ok(style.variants.some((item) => item.id === style.defaultVariant));
    assert.ok(style.variants.every((item) => item.labelEn));
  }
});

test("keeps prompt text server-side and compiles source constraints", () => {
  const publicStyle = listPublicStyles()[0];
  assert.equal("prompt" in publicStyle.variants[0], false);

  const compiled = compileStylePrompt({
    styleId: "chinese-shanshui-comparison",
    variantId: "colored",
    customInstruction: "保留道路的主要弯曲方向",
  });
  assert.match(compiled.prompt, /sole content source/);
  assert.match(compiled.prompt, /保留道路的主要弯曲方向/);
  assert.equal(compiled.variant.id, "colored");
});

test("rejects unknown style and variant ids", () => {
  assert.throws(() => compileStylePrompt({ styleId: "missing" }));
  assert.throws(() =>
    compileStylePrompt({
      styleId: "monet-comparison",
      variantId: "missing",
    }),
  );
});

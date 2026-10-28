import assert from "node:assert/strict";
import test from "node:test";
import { compileStylePrompt, listPublicStyles } from "./index";

test("loads all sixteen style presets with valid defaults", () => {
  const styles = listPublicStyles();
  assert.equal(styles.length, 16);
  assert.equal(new Set(styles.map((style) => style.id)).size, 16);
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
  assert.match(compiled.prompt, /selected style preset/);
  assert.equal(compiled.variant.id, "colored");
});

test("registers the eight added style presets", () => {
  const ids = new Set(listPublicStyles().map((style) => style.id));
  assert.ok(ids.has("porcelain-shard-comparison"));
  assert.ok(ids.has("ink-line-character-comparison"));
  assert.ok(ids.has("paper-cut-collage-comparison"));
  assert.ok(ids.has("travel-poster-comparison"));
  assert.ok(ids.has("vector-illustration-comparison"));
  assert.ok(ids.has("layered-papercraft-comparison"));
  assert.ok(ids.has("art-postcard-comparison"));
  assert.ok(ids.has("washi-tape-collage-comparison"));
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

test("allows source reduction for both negative-space variants without strict reconstruction", () => {
  for (const variantId of ["quiet-fragments", "poetic-title"]) {
    const { prompt } = compileStylePrompt({
      styleId: "minimal-negative-space-comparison",
      variantId,
    });
    assert.match(prompt, /Omit, merge, interrupt, or flatten/);
    assert.doesNotMatch(prompt, /preserve its identity or type, count/);
    assert.match(prompt, /Preserve the original aspect ratio/);
    assert.match(prompt, /Do not add unrelated motifs/);
  }
});

test("keeps subject preservation for every other preset", () => {
  for (const style of listPublicStyles()) {
    if (style.id === "minimal-negative-space-comparison") continue;
    for (const variant of style.variants) {
      const { prompt } = compileStylePrompt({
        styleId: style.id,
        variantId: variant.id,
      });
      assert.match(prompt, /preserve its identity or type, count/);
      assert.doesNotMatch(prompt, /Omit, merge, interrupt, or flatten/);
    }
  }
});

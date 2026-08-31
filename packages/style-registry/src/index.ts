import chineseShanshui from "../../../skills/chinese-shanshui-comparison/app-style.json";
import modernGongbi from "../../../skills/modern-gongbi-sketch-comparison/app-style.json";
import modernMinimal from "../../../skills/modern-minimal-illustration-comparison/app-style.json";
import monet from "../../../skills/monet-comparison/app-style.json";
import picasso from "../../../skills/picasso-geometric-comparison/app-style.json";
import traditionalWatercolor from "../../../skills/traditional-expressive-watercolor-comparison/app-style.json";
import wuGuanzhong from "../../../skills/wu-guanzhong-expressive-ink-comparison/app-style.json";

export type ImageQuality = "low" | "medium" | "high";

export type StyleVariant = {
  id: string;
  label: string;
  prompt: string;
};

export type AppStyleManifest = {
  schemaVersion: 1;
  id: string;
  skillName: string;
  name: string;
  description: string;
  accent: [string, string];
  defaultVariant: string;
  defaultQuality: ImageQuality;
  outputSuffix: string;
  variants: StyleVariant[];
};

export type PublicStyle = Omit<AppStyleManifest, "variants"> & {
  variants: Array<Omit<StyleVariant, "prompt">>;
};

const manifests: Array<{ source: string; value: unknown }> = [
  { source: "monet-comparison", value: monet },
  { source: "picasso-geometric-comparison", value: picasso },
  { source: "chinese-shanshui-comparison", value: chineseShanshui },
  { source: "modern-gongbi-sketch-comparison", value: modernGongbi },
  {
    source: "traditional-expressive-watercolor-comparison",
    value: traditionalWatercolor,
  },
  { source: "modern-minimal-illustration-comparison", value: modernMinimal },
  { source: "wu-guanzhong-expressive-ink-comparison", value: wuGuanzhong },
];

function parseManifest(input: unknown, source: string): AppStyleManifest {
  const value = input as Partial<AppStyleManifest>;

  if (
    value.schemaVersion !== 1 ||
    typeof value.id !== "string" ||
    typeof value.skillName !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    !Array.isArray(value.accent) ||
    value.accent.length !== 2 ||
    typeof value.defaultVariant !== "string" ||
    !["low", "medium", "high"].includes(value.defaultQuality ?? "") ||
    typeof value.outputSuffix !== "string" ||
    !Array.isArray(value.variants) ||
    value.variants.length === 0
  ) {
    throw new Error(`Invalid app style manifest: ${source}`);
  }

  for (const variant of value.variants) {
    if (
      typeof variant?.id !== "string" ||
      typeof variant?.label !== "string" ||
      typeof variant?.prompt !== "string" ||
      !variant.prompt.trim()
    ) {
      throw new Error(`Invalid style variant in: ${source}`);
    }
  }

  if (!value.variants.some((variant) => variant.id === value.defaultVariant)) {
    throw new Error(`Missing default variant in: ${source}`);
  }

  return value as AppStyleManifest;
}

const styles = manifests.map(({ source, value }) =>
  parseManifest(value, source),
);
const stylesById = new Map(styles.map((style) => [style.id, style]));

if (stylesById.size !== styles.length) {
  throw new Error("Style manifest ids must be unique.");
}

export function listPublicStyles(): PublicStyle[] {
  return styles.map((style) => ({
    ...style,
    variants: style.variants.map(({ id, label }) => ({ id, label })),
  }));
}

export function getStyle(styleId: string): AppStyleManifest | undefined {
  return stylesById.get(styleId);
}

export function compileStylePrompt(options: {
  styleId: string;
  variantId?: string;
  customInstruction?: string;
}): { style: AppStyleManifest; variant: StyleVariant; prompt: string } {
  const style = getStyle(options.styleId);
  if (!style) {
    throw new Error("Unknown style preset.");
  }

  const variantId = options.variantId || style.defaultVariant;
  const variant = style.variants.find((item) => item.id === variantId);
  if (!variant) {
    throw new Error("Unknown style variant.");
  }

  const customInstruction = options.customInstruction?.trim().slice(0, 1000);
  const prompt = [
    "The attached image is the sole content source and edit target.",
    variant.prompt,
    customInstruction
      ? `Additional user instruction, apply only when consistent with this preset: ${customInstruction}`
      : "",
    "Preserve the original aspect ratio and crop direction. Keep every major subject tied to the source: preserve its identity or type, count, pose or direction, general position, occlusion order, and the main spatial relationships required by this preset. Do not add unrelated objects or merge content from other images.",
    "Generate only one standalone stylized effect image that fills the complete source frame. Do not create a comparison layout, border, title, caption, numbering, signature, watermark, logo, seal, frame, or any text not already required by the source scene.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { style, variant, prompt };
}

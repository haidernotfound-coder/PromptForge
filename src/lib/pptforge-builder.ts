import PptxGenJS from "pptxgenjs";
import type { PptForgeStyle } from "@/lib/pptforge";
import type { PptForgeDeckPlan, PptForgeSlidePlan, PptForgeColumn } from "@/lib/pptforge-schema";
import { applyTransitionsAndAnimations } from "@/lib/pptforge-effects";

/**
 * PPTForge pptx builder
 * ---------------------
 * Turns a validated `PptForgeDeckPlan` into a real 16:9 .pptx Buffer with
 * PptxGenJS. All design decisions (colors, fonts, spacing, which shapes to
 * draw) live here — the model only ever supplies content, never markup —
 * so output quality doesn't depend on the model "knowing" design.
 *
 * Design is intentionally randomized per generation: each `style` maps to
 * a handful of palette variants and decorative "skins" (accent placement
 * on title/section/heading slides). One variant + one skin is rolled per
 * `buildPptx()` call, so re-running the same topic/style twice produces a
 * visually different deck. Slide transitions and click-to-reveal entrance
 * animations are then stitched into the raw OOXML afterward, since
 * PptxGenJS itself has no transition/animation API (see
 * `pptforge-effects.ts`).
 */

interface Theme {
  bg: string;
  panel: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accent2: string;
  darkBg: string;
  darkInk: string;
  headingFont: string;
  bodyFont: string;
  chartColors: string[];
}

/** Decorative treatment applied to title/section/closing/heading slides.
 *  Purely a layout skin — same theme colors, different accent shapes. */
type Skin = "bar" | "stripe" | "frame" | "corner";
const SKINS: Skin[] = ["bar", "stripe", "frame", "corner"];

// 3 palette variants per style so "Modern" (etc) doesn't render identically
// every time — same family/personality, different accent pairing & font.
const THEME_VARIANTS: Record<PptForgeStyle, Theme[]> = {
  professional: [
    {
      bg: "FFFFFF", panel: "F1F5F9", ink: "0F172A", inkMuted: "475569",
      accent: "1D4ED8", accent2: "0EA5E9", darkBg: "0F172A", darkInk: "F8FAFC",
      headingFont: "Georgia", bodyFont: "Calibri",
      chartColors: ["1D4ED8", "0EA5E9", "0F766E", "64748B", "7C3AED"],
    },
    {
      bg: "FFFFFF", panel: "EFF3EE", ink: "132A13", inkMuted: "4B5945",
      accent: "0B6E4F", accent2: "3A86FF", darkBg: "0D2818", darkInk: "F4F9F4",
      headingFont: "Cambria", bodyFont: "Calibri",
      chartColors: ["0B6E4F", "3A86FF", "8338EC", "2D6A4F", "023047"],
    },
    {
      bg: "FFFFFF", panel: "F3F0EA", ink: "24211B", inkMuted: "5C5647",
      accent: "8A5A2B", accent2: "1F6F78", darkBg: "22201A", darkInk: "FAF7F0",
      headingFont: "Georgia", bodyFont: "Cambria",
      chartColors: ["8A5A2B", "1F6F78", "B08968", "355070", "6D597A"],
    },
  ],
  modern: [
    {
      bg: "FFFFFF", panel: "FFF1E6", ink: "1A1A2E", inkMuted: "52527A",
      accent: "FF5A36", accent2: "FFB020", darkBg: "1A1A2E", darkInk: "FFFFFF",
      headingFont: "Calibri", bodyFont: "Calibri",
      chartColors: ["FF5A36", "FFB020", "16C79A", "6C5CE7", "00B4D8"],
    },
    {
      bg: "FFFFFF", panel: "EAF4FF", ink: "121629", inkMuted: "444B6E",
      accent: "5B5FEF", accent2: "00D2C6", darkBg: "121629", darkInk: "F4F6FF",
      headingFont: "Trebuchet MS", bodyFont: "Calibri",
      chartColors: ["5B5FEF", "00D2C6", "FF6392", "FFC857", "3A86FF"],
    },
    {
      bg: "FFFFFF", panel: "FFEAF3", ink: "230B21", inkMuted: "5C3A57",
      accent: "D6336C", accent2: "F76707", darkBg: "230B21", darkInk: "FFF5FA",
      headingFont: "Century Gothic", bodyFont: "Calibri",
      chartColors: ["D6336C", "F76707", "FFB020", "6C5CE7", "16C79A"],
    },
  ],
  minimal: [
    {
      bg: "FFFFFF", panel: "FAFAFA", ink: "18181B", inkMuted: "71717A",
      accent: "18181B", accent2: "A1A1AA", darkBg: "18181B", darkInk: "FAFAFA",
      headingFont: "Calibri Light", bodyFont: "Calibri",
      chartColors: ["18181B", "52525B", "A1A1AA", "D4D4D8", "71717A"],
    },
    {
      bg: "FFFFFF", panel: "F5F6F4", ink: "1E2622", inkMuted: "5B6B63",
      accent: "2F6D5A", accent2: "9FB8AE", darkBg: "1E2622", darkInk: "F5F6F4",
      headingFont: "Cambria", bodyFont: "Calibri",
      chartColors: ["2F6D5A", "9FB8AE", "56715F", "233229", "7A9187"],
    },
    {
      bg: "FFFFFF", panel: "F6F3F5", ink: "241B24", inkMuted: "6B5C6B",
      accent: "6E4B6E", accent2: "C6B2C6", darkBg: "241B24", darkInk: "F6F3F5",
      headingFont: "Calibri Light", bodyFont: "Calibri",
      chartColors: ["6E4B6E", "C6B2C6", "8E6F8E", "4A344A", "AE94AE"],
    },
  ],
  bold: [
    {
      bg: "FFFFFF", panel: "111111", ink: "111111", inkMuted: "3F3F46",
      accent: "E11D48", accent2: "FACC15", darkBg: "111111", darkInk: "FFFFFF",
      headingFont: "Impact", bodyFont: "Calibri",
      chartColors: ["E11D48", "FACC15", "111111", "9333EA", "059669"],
    },
    {
      bg: "FFFFFF", panel: "0B132B", ink: "0B132B", inkMuted: "3A4463",
      accent: "1C77C3", accent2: "FF9F1C", darkBg: "0B132B", darkInk: "FFFFFF",
      headingFont: "Arial Black", bodyFont: "Calibri",
      chartColors: ["1C77C3", "FF9F1C", "39A0ED", "D7263D", "02182B"],
    },
    {
      bg: "FFFFFF", panel: "141B12", ink: "141B12", inkMuted: "3F4A3B",
      accent: "2D8A3E", accent2: "F2B807", darkBg: "141B12", darkInk: "FFFFFF",
      headingFont: "Impact", bodyFont: "Calibri",
      chartColors: ["2D8A3E", "F2B807", "8C1C13", "1B4332", "BC6C25"],
    },
  ],
  academic: [
    {
      bg: "FFFDF7", panel: "F0EFE1", ink: "1F2A1E", inkMuted: "4B5945",
      accent: "1F5E3C", accent2: "B08D57", darkBg: "1F3B2C", darkInk: "FBF7EC",
      headingFont: "Georgia", bodyFont: "Cambria",
      chartColors: ["1F5E3C", "B08D57", "6B8F71", "8C6D46", "3D6B4F"],
    },
    {
      bg: "FBF9F6", panel: "EFE6DD", ink: "2B211A", inkMuted: "5C4E42",
      accent: "7A3B2E", accent2: "3E6E8E", darkBg: "2B211A", darkInk: "FBF3E9",
      headingFont: "Georgia", bodyFont: "Cambria",
      chartColors: ["7A3B2E", "3E6E8E", "B08D57", "556B2F", "8B5E3C"],
    },
    {
      bg: "FCFAF6", panel: "E9EBE4", ink: "1D2733", inkMuted: "48566A",
      accent: "2C4A6E", accent2: "9C7A3C", darkBg: "1D2733", darkInk: "F7F8F4",
      headingFont: "Cambria", bodyFont: "Georgia",
      chartColors: ["2C4A6E", "9C7A3C", "4C7C8C", "6B7F5E", "8A6642"],
    },
  ],
};

function pickTheme(style: PptForgeStyle): Theme {
  const variants = THEME_VARIANTS[style] ?? THEME_VARIANTS.professional;
  return variants[Math.floor(Math.random() * variants.length)];
}

function pickSkin(): Skin {
  return SKINS[Math.floor(Math.random() * SKINS.length)];
}

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.6;

function capBullets(bullets: string[] | undefined, max = 5): string[] {
  if (!bullets) return [];
  return bullets
    .filter((b) => typeof b === "string" && b.trim())
    .slice(0, max)
    .map((b) => b.trim().replace(/\s+/g, " "));
}

function footer(slide: PptxGenJS.Slide, theme: Theme, pageNum: number, total: number, deckTitle: string) {
  slide.addText(deckTitle, {
    x: MARGIN,
    y: SLIDE_H - 0.35,
    w: SLIDE_W - MARGIN * 2 - 0.8,
    h: 0.3,
    fontSize: 9,
    color: theme.inkMuted,
    fontFace: theme.bodyFont,
    align: "left",
  });
  slide.addText(`${pageNum} / ${total}`, {
    x: SLIDE_W - MARGIN - 0.8,
    y: SLIDE_H - 0.35,
    w: 0.8,
    h: 0.3,
    fontSize: 9,
    color: theme.inkMuted,
    fontFace: theme.bodyFont,
    align: "right",
  });
}

function titleDecoration(slide: PptxGenJS.Slide, theme: Theme, skin: Skin) {
  switch (skin) {
    case "stripe":
      slide.addShape("rect", { x: 0, y: 0, w: 0.22, h: SLIDE_H, fill: { color: theme.accent } });
      slide.addShape("rect", { x: 0.22, y: 0, w: 0.06, h: SLIDE_H, fill: { color: theme.accent2 } });
      break;
    case "frame":
      slide.addShape("rect", { x: 0, y: 0, w: SLIDE_W, h: 0.12, fill: { color: theme.accent } });
      slide.addShape("rect", { x: 0, y: SLIDE_H - 0.12, w: SLIDE_W, h: 0.12, fill: { color: theme.accent } });
      slide.addShape("rect", { x: 0, y: 0, w: 0.12, h: SLIDE_H, fill: { color: theme.accent2 } });
      slide.addShape("rect", { x: SLIDE_W - 0.12, y: 0, w: 0.12, h: SLIDE_H, fill: { color: theme.accent2 } });
      break;
    case "corner":
      slide.addShape("ellipse", { x: SLIDE_W - 3.2, y: -2.2, w: 4.4, h: 4.4, fill: { color: theme.accent, transparency: 25 } });
      slide.addShape("ellipse", { x: SLIDE_W - 1.6, y: SLIDE_H - 1.6, w: 2.4, h: 2.4, fill: { color: theme.accent2, transparency: 15 } });
      break;
    case "bar":
    default:
      slide.addShape("rect", { x: 0, y: SLIDE_H - 0.18, w: SLIDE_W, h: 0.18, fill: { color: theme.accent } });
      break;
  }
}

function titleSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan, deckTitle: string) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.darkBg };
  titleDecoration(slide, theme, skin);
  slide.addText(plan.title || deckTitle, {
    x: MARGIN,
    y: SLIDE_H / 2 - 1.1,
    w: SLIDE_W - MARGIN * 2,
    h: 1.6,
    fontSize: 40,
    bold: true,
    color: theme.darkInk,
    fontFace: theme.headingFont,
    align: "left",
    valign: "bottom",
  });
  if (plan.subtitle) {
    slide.addText(plan.subtitle, {
      x: MARGIN,
      y: SLIDE_H / 2 + 0.55,
      w: SLIDE_W - MARGIN * 2,
      h: 0.7,
      fontSize: 18,
      color: theme.accent2,
      fontFace: theme.bodyFont,
      align: "left",
    });
  }
}

function closingSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.darkBg };
  titleDecoration(slide, theme, skin);
  slide.addText(plan.title || "Thank you", {
    x: MARGIN,
    y: SLIDE_H / 2 - 0.9,
    w: SLIDE_W - MARGIN * 2,
    h: 1.3,
    fontSize: 36,
    bold: true,
    color: theme.darkInk,
    fontFace: theme.headingFont,
    align: "center",
    valign: "middle",
  });
  if (plan.subtitle) {
    slide.addText(plan.subtitle, {
      x: MARGIN,
      y: SLIDE_H / 2 + 0.5,
      w: SLIDE_W - MARGIN * 2,
      h: 0.6,
      fontSize: 16,
      color: theme.accent2,
      fontFace: theme.bodyFont,
      align: "center",
    });
  }
}

function sectionSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.accent };
  if (skin === "frame") {
    slide.addShape("rect", { x: 0, y: 0, w: SLIDE_W, h: 0.14, fill: { color: theme.darkBg } });
    slide.addShape("rect", { x: 0, y: SLIDE_H - 0.14, w: SLIDE_W, h: 0.14, fill: { color: theme.darkBg } });
  } else if (skin === "corner") {
    slide.addShape("ellipse", { x: -1.6, y: SLIDE_H - 2.2, w: 3.6, h: 3.6, fill: { color: theme.darkBg, transparency: 30 } });
    slide.addShape("rect", { x: 0, y: 0, w: 0.18, h: SLIDE_H, fill: { color: theme.darkBg } });
  } else if (skin === "bar") {
    slide.addShape("rect", { x: 0, y: SLIDE_H - 0.18, w: SLIDE_W, h: 0.18, fill: { color: theme.darkBg } });
  } else {
    slide.addShape("rect", { x: 0, y: 0, w: 0.18, h: SLIDE_H, fill: { color: theme.darkBg } });
  }
  slide.addText(plan.title || "", {
    x: MARGIN + 0.4,
    y: SLIDE_H / 2 - 0.8,
    w: SLIDE_W - MARGIN * 2 - 0.4,
    h: 1.2,
    fontSize: 32,
    bold: true,
    color: "FFFFFF",
    fontFace: theme.headingFont,
    align: "left",
  });
  if (plan.subtitle) {
    slide.addText(plan.subtitle, {
      x: MARGIN + 0.4,
      y: SLIDE_H / 2 + 0.35,
      w: SLIDE_W - MARGIN * 2 - 0.4,
      h: 0.6,
      fontSize: 16,
      color: "F1F5F9",
      fontFace: theme.bodyFont,
      align: "left",
    });
  }
  return slide;
}

function slideHeading(slide: PptxGenJS.Slide, theme: Theme, title: string, skin: Skin = "bar") {
  slide.addText(title, {
    x: MARGIN,
    y: 0.45,
    w: SLIDE_W - MARGIN * 2,
    h: 0.8,
    fontSize: 28,
    bold: true,
    color: theme.ink,
    fontFace: theme.headingFont,
    align: "left",
  });
  if (skin === "stripe") {
    slide.addShape("rect", { x: MARGIN, y: 1.25, w: 0.35, h: 0.05, fill: { color: theme.accent } });
    slide.addShape("rect", { x: MARGIN + 0.42, y: 1.25, w: 0.35, h: 0.05, fill: { color: theme.accent2 } });
  } else if (skin === "corner") {
    slide.addShape("ellipse", { x: SLIDE_W - 0.55, y: 0.4, w: 0.28, h: 0.28, fill: { color: theme.accent } });
    slide.addShape("rect", { x: MARGIN, y: 1.25, w: 1.1, h: 0.05, fill: { color: theme.accent } });
  } else if (skin === "frame") {
    slide.addShape("rect", { x: 0, y: 0, w: SLIDE_W, h: 0.08, fill: { color: theme.accent } });
    slide.addShape("rect", { x: MARGIN, y: 1.25, w: 1.1, h: 0.05, fill: { color: theme.accent2 } });
  } else {
    slide.addShape("rect", { x: MARGIN, y: 1.25, w: 1.1, h: 0.05, fill: { color: theme.accent } });
  }
}

/** Renders a bullet list so it actually fills its box rather than pinning a
 *  short list to the top and leaving the rest of the slide visibly blank.
 *  Scales font size, paragraph spacing, and vertical alignment based on how
 *  many bullets there are — few bullets get bigger type, more breathing
 *  room, and are centered in the box; a full list behaves as before. */
function bulletList(
  slide: PptxGenJS.Slide,
  theme: Theme,
  bullets: string[],
  opts: { x: number; y: number; w: number; h: number },
  maxExpected = 5
) {
  if (bullets.length === 0) return;

  const fullness = Math.min(1, bullets.length / maxExpected);
  const fontSize = Math.round(16 + (1 - fullness) * 6); // 16 -> up to 22pt when sparse
  const paraSpaceAfter = Math.round(14 + (1 - fullness) * 18); // 14 -> up to 32pt gaps
  const valign: "top" | "middle" = bullets.length <= Math.ceil(maxExpected / 2) ? "middle" : "top";

  slide.addText(
    bullets.map((b) => ({
      text: b,
      options: { bullet: { code: "2022", indent: 18 }, breakLine: true, paraSpaceAfter },
    })),
    {
      x: opts.x,
      y: opts.y,
      w: opts.w,
      h: opts.h,
      fontSize,
      color: theme.inkMuted,
      fontFace: theme.bodyFont,
      valign,
      align: "left",
      lineSpacingMultiple: 1.25,
    }
  );
}

function bulletsSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);
  bulletList(slide, theme, capBullets(plan.bullets), {
    x: MARGIN,
    y: 1.7,
    w: SLIDE_W - MARGIN * 2,
    h: SLIDE_H - 2.4,
  });
  return slide;
}

function columnBlock(
  slide: PptxGenJS.Slide,
  theme: Theme,
  col: PptForgeColumn | undefined,
  x: number,
  w: number
) {
  if (!col) return;
  slide.addShape("rect", { x, y: 1.7, w, h: SLIDE_H - 2.3, fill: { color: theme.panel }, line: { color: theme.panel } });
  slide.addText(col.heading || "", {
    x: x + 0.3,
    y: 1.9,
    w: w - 0.6,
    h: 0.5,
    fontSize: 17,
    bold: true,
    color: theme.accent,
    fontFace: theme.headingFont,
  });
  bulletList(slide, theme, capBullets(col.bullets, 4), { x: x + 0.3, y: 2.45, w: w - 0.6, h: SLIDE_H - 3.1 }, 4);
}

function twoColumnSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);
  const gap = 0.4;
  const colW = (SLIDE_W - MARGIN * 2 - gap) / 2;
  columnBlock(slide, theme, plan.left, MARGIN, colW);
  columnBlock(slide, theme, plan.right, MARGIN + colW + gap, colW);
  return slide;
}

function comparisonSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);
  const gap = 0.5;
  const colW = (SLIDE_W - MARGIN * 2 - gap) / 2;

  slide.addShape("rect", {
    x: MARGIN,
    y: 1.7,
    w: colW,
    h: SLIDE_H - 2.3,
    fill: { color: theme.bg },
    line: { color: theme.accent, width: 1.5 },
  });
  slide.addShape("rect", {
    x: MARGIN + colW + gap,
    y: 1.7,
    w: colW,
    h: SLIDE_H - 2.3,
    fill: { color: theme.bg },
    line: { color: theme.accent2, width: 1.5 },
  });

  slide.addText(plan.left?.heading || "Option A", {
    x: MARGIN + 0.25,
    y: 1.85,
    w: colW - 0.5,
    h: 0.45,
    fontSize: 16,
    bold: true,
    color: theme.accent,
    fontFace: theme.headingFont,
  });
  slide.addText(plan.right?.heading || "Option B", {
    x: MARGIN + colW + gap + 0.25,
    y: 1.85,
    w: colW - 0.5,
    h: 0.45,
    fontSize: 16,
    bold: true,
    color: theme.accent2,
    fontFace: theme.headingFont,
  });

  bulletList(
    slide,
    theme,
    capBullets(plan.left?.bullets, 4),
    { x: MARGIN + 0.25, y: 2.4, w: colW - 0.5, h: SLIDE_H - 3 },
    4
  );
  bulletList(
    slide,
    theme,
    capBullets(plan.right?.bullets, 4),
    { x: MARGIN + colW + gap + 0.25, y: 2.4, w: colW - 0.5, h: SLIDE_H - 3 },
    4
  );
  return slide;
}

function imageSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const imgW = 4.6;
  const imgX = SLIDE_W - MARGIN - imgW;
  // Real placeholder graphic (not a fake gray box with no info) — a
  // gradient-toned panel with an icon glyph and the image's intended
  // caption, so the deck is still useful/presentable without an external
  // image API. Swapping in a real photo later is a single addImage() call.
  slide.addShape("roundRect", {
    x: imgX,
    y: 1.7,
    w: imgW,
    h: SLIDE_H - 2.4,
    rectRadius: 0.12,
    fill: { color: theme.panel },
    line: { color: theme.accent, width: 1 },
  });
  slide.addShape("ellipse", {
    x: imgX + imgW / 2 - 0.5,
    y: 1.7 + (SLIDE_H - 2.4) / 2 - 0.85,
    w: 1,
    h: 1,
    fill: { color: theme.accent },
  });
  slide.addText("🖼", {
    x: imgX + imgW / 2 - 0.5,
    y: 1.7 + (SLIDE_H - 2.4) / 2 - 0.85,
    w: 1,
    h: 1,
    fontSize: 28,
    align: "center",
    valign: "middle",
    color: "FFFFFF",
  });
  slide.addText(plan.imageCaption || "Image placeholder", {
    x: imgX + 0.3,
    y: 1.7 + (SLIDE_H - 2.4) / 2 + 0.25,
    w: imgW - 0.6,
    h: 0.8,
    fontSize: 12,
    italic: true,
    color: theme.inkMuted,
    fontFace: theme.bodyFont,
    align: "center",
  });

  bulletList(slide, theme, capBullets(plan.bullets, 5), {
    x: MARGIN,
    y: 1.9,
    w: imgX - MARGIN - 0.4,
    h: SLIDE_H - 2.6,
  }, 5);
  return slide;
}

function chartSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const categories = Array.isArray(plan.categories) && plan.categories.length > 0 ? plan.categories : ["A", "B", "C"];
  const seriesIn =
    Array.isArray(plan.series) && plan.series.length > 0
      ? plan.series
      : [{ name: "Series 1", values: categories.map(() => 1) }];

  const data = seriesIn.map((s) => ({
    name: s.name || "Series",
    labels: categories,
    values:
      Array.isArray(s.values) && s.values.length === categories.length
        ? s.values
        : categories.map(() => 0),
  }));

  const chartTypeMap = {
    bar: pptx.ChartType.bar,
    line: pptx.ChartType.line,
    pie: pptx.ChartType.pie,
  } as const;
  const chartType = chartTypeMap[plan.chartType ?? "bar"] ?? pptx.ChartType.bar;

  slide.addChart(chartType, data, {
    x: MARGIN,
    y: 1.7,
    w: SLIDE_W - MARGIN * 2,
    h: SLIDE_H - 2.4,
    chartColors: theme.chartColors,
    showLegend: data.length > 1 || plan.chartType === "pie",
    legendPos: "b",
    showTitle: false,
    catAxisLabelColor: theme.inkMuted,
    valAxisLabelColor: theme.inkMuted,
    dataLabelColor: theme.inkMuted,
    showValue: plan.chartType === "pie",
  });
  return slide;
}

function tableSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const headers = Array.isArray(plan.headers) && plan.headers.length > 0 ? plan.headers : ["Column A", "Column B"];
  const rows = (Array.isArray(plan.rows) ? plan.rows : []).slice(0, 8);

  // A table with only 2-3 rows rendered at its minimum height leaves the
  // bottom half of the slide blank. Instead of sizing to content, always
  // fill the full available box and scale font size / row padding up when
  // there are fewer rows, same idea as bulletList() above.
  const availableH = SLIDE_H - 2.4;
  const fullness = Math.min(1, rows.length / 6);
  const headerFontSize = Math.round(13 + (1 - fullness) * 5);
  const cellFontSize = Math.round(12 + (1 - fullness) * 6);

  const headerRow: PptxGenJS.TableRow = headers.map((h) => ({
    text: h,
    options: {
      bold: true,
      color: "FFFFFF",
      fill: { color: theme.accent },
      fontFace: theme.bodyFont,
      fontSize: headerFontSize,
      valign: "middle",
    },
  }));
  const bodyRows: PptxGenJS.TableRow[] = rows.map((row, i) =>
    headers.map((_, ci) => ({
      text: row[ci] ?? "",
      options: {
        color: theme.ink,
        fill: { color: i % 2 === 0 ? theme.bg : theme.panel },
        fontFace: theme.bodyFont,
        fontSize: cellFontSize,
        valign: "middle",
      },
    }))
  );

  slide.addTable([headerRow, ...bodyRows], {
    x: MARGIN,
    y: 1.7,
    w: SLIDE_W - MARGIN * 2,
    h: availableH,
    border: { type: "solid", color: theme.panel, pt: 1 },
    autoPage: false,
  });
  return slide;
}

function quoteSlide(pptx: PptxGenJS, theme: Theme, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.darkBg };
  slide.addText("\u201C", {
    x: MARGIN,
    y: 0.9,
    w: 2,
    h: 1.5,
    fontSize: 90,
    color: theme.accent,
    fontFace: theme.headingFont,
    bold: true,
  });
  slide.addText(plan.quote || "", {
    x: MARGIN + 0.4,
    y: 2.2,
    w: SLIDE_W - MARGIN * 2 - 0.8,
    h: 2.4,
    fontSize: 26,
    italic: true,
    color: theme.darkInk,
    fontFace: theme.headingFont,
    align: "left",
    valign: "top",
  });
  if (plan.attribution) {
    slide.addText(`— ${plan.attribution}`, {
      x: MARGIN + 0.4,
      y: 4.9,
      w: SLIDE_W - MARGIN * 2 - 0.8,
      h: 0.5,
      fontSize: 16,
      color: theme.accent2,
      fontFace: theme.bodyFont,
    });
  }
  return slide;
}

/** Renders a validated slide plan to a .pptx file buffer, ready to send
 *  straight back as the HTTP response body. */
export async function buildPptx(plan: PptForgeDeckPlan, style: PptForgeStyle): Promise<Buffer> {
  const theme = pickTheme(style);
  const skin = pickSkin();
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PPTFORGE_16x9", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "PPTFORGE_16x9";
  pptx.title = plan.title;
  pptx.author = "PPTForge";

  const total = plan.slides.length;
  plan.slides.forEach((slidePlan, i) => {
    let slide: PptxGenJS.Slide;
    switch (slidePlan.layout) {
      case "title":
        titleSlide(pptx, theme, skin, slidePlan, plan.title);
        return; // no footer on the title slide
      case "closing":
        closingSlide(pptx, theme, skin, slidePlan);
        return; // no footer on the closing slide
      case "section":
        slide = sectionSlide(pptx, theme, skin, slidePlan);
        break;
      case "two_column":
        slide = twoColumnSlide(pptx, theme, skin, slidePlan);
        break;
      case "comparison":
        slide = comparisonSlide(pptx, theme, skin, slidePlan);
        break;
      case "image":
        slide = imageSlide(pptx, theme, skin, slidePlan);
        break;
      case "chart":
        slide = chartSlide(pptx, theme, skin, slidePlan);
        break;
      case "table":
        slide = tableSlide(pptx, theme, skin, slidePlan);
        break;
      case "quote":
        slide = quoteSlide(pptx, theme, slidePlan);
        break;
      case "bullets":
      default:
        slide = bulletsSlide(pptx, theme, skin, slidePlan);
        break;
    }
    if (slidePlan.notes) slide.addNotes(slidePlan.notes);
    footer(slide, theme, i + 1, total, plan.title);
  });

  const rawBuf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  // Post-process the raw OOXML to add per-slide transitions and
  // click-to-reveal entrance animations — PptxGenJS has no API for either,
  // see pptforge-effects.ts for why this happens at the zip/XML level.
  return applyTransitionsAndAnimations(rawBuf);
}

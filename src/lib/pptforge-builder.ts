import PptxGenJS from "pptxgenjs";
import type { PptForgeStyle } from "@/lib/pptforge";
import type { PptForgeDeckPlan, PptForgeSlidePlan, PptForgeColumn } from "@/lib/pptforge-schema";
import { applyTransitionsAndAnimations } from "@/lib/pptforge-effects";
import { pickBulletVariant, parseStatBullet, splitLead, iconKindFor } from "@/lib/pptforge-content";
import { drawIconBadge, drawGlyph } from "@/lib/pptforge-icons";
import { fetchStockImageDataUri } from "@/lib/pptforge-images";

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

  // Small kicker label above the title — the thing that makes a title
  // slide read as "designed" instead of "text dropped on a dark rect".
  slide.addShape("rect", { x: MARGIN, y: SLIDE_H / 2 - 1.65, w: 0.4, h: 0.06, fill: { color: theme.accent } });
  slide.addText("PRESENTATION", {
    x: MARGIN + 0.55,
    y: SLIDE_H / 2 - 1.85,
    w: 4,
    h: 0.4,
    fontSize: 11,
    bold: true,
    color: theme.accent2,
    fontFace: theme.bodyFont,
    charSpacing: 2,
    align: "left",
  });

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
    slide.addShape("rect", { x: MARGIN, y: SLIDE_H / 2 + 0.42, w: 0.9, h: 0.03, fill: { color: theme.accent2 } });
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

function sectionSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan, sectionIndex: number): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.accent };
  // Oversized, low-opacity index numeral — a common "designed deck" trick
  // that gives an otherwise flat color slide real visual weight.
  slide.addText(String(sectionIndex).padStart(2, "0"), {
    x: SLIDE_W - 4.2,
    y: -0.6,
    w: 4,
    h: SLIDE_H + 1,
    fontSize: 220,
    bold: true,
    color: "FFFFFF",
    fontFace: theme.headingFont,
    align: "right",
    valign: "middle",
    transparency: 80,
  });
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
    y: 0.4,
    w: SLIDE_W - MARGIN * 2,
    h: 0.9,
    fontSize: 32,
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
/** A vertical stack of icon-chip rows — used in place of a plain dot list
 *  wherever the bullet count is low (image/two-column side panels) so 2-3
 *  short items don't read as sparse leftover space, since each row carries
 *  a vector icon and generous padding instead of just a tiny dot + text. */
function iconChipList(slide: PptxGenJS.Slide, theme: Theme, bullets: string[], opts: { x: number; y: number; w: number; h: number }) {
  if (bullets.length === 0) return;
  const rowH = 1.05;
  const rowGap = 0.3;
  const blockH = bullets.length * rowH + (bullets.length - 1) * rowGap;
  const startY = opts.y + Math.max(0, (opts.h - blockH) / 2);
  const chip = 0.62;
  const accents = [theme.accent, theme.accent2];

  bullets.forEach((text, i) => {
    const y = startY + i * (rowH + rowGap);
    const accent = accents[i % accents.length];
    slide.addShape("roundRect", { x: opts.x, y, w: opts.w, h: rowH, rectRadius: 0.08, fill: { color: theme.panel }, line: { type: "none" } });
    drawIconBadge(slide, iconKindFor(text), opts.x + 0.2, y + (rowH - chip) / 2, chip, accent);
    slide.addText(text, {
      x: opts.x + chip + 0.42, y, w: opts.w - chip - 0.62, h: rowH,
      fontSize: 16, color: theme.ink, fontFace: theme.bodyFont,
      align: "left", valign: "middle", lineSpacingMultiple: 1.2,
    });
  });
}

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

/** A single dominant number — used when a "bullets" slide boils down to
 *  one clear takeaway metric. Deliberately asymmetric: the stat owns the
 *  left ~60% of the slide at a huge size, the right side carries a
 *  full-bleed color panel with a large supporting vector icon, instead of
 *  centering everything the way a template would. */
function bigStatSlide(pptx: PptxGenJS, theme: Theme, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  const stat = parseStatBullet(capBullets(plan.bullets, 1)[0] || "") ?? { value: "", label: "" };
  const panelX = SLIDE_W * 0.62;

  slide.addShape("rect", { x: panelX, y: 0, w: SLIDE_W - panelX, h: SLIDE_H, fill: { color: theme.darkBg } });
  const kind = iconKindFor(`${plan.title || ""} ${stat.label}`);
  drawGlyph(slide, kind, { x: panelX + (SLIDE_W - panelX) * 0.18, y: SLIDE_H * 0.28, w: (SLIDE_W - panelX) * 0.64, h: SLIDE_H * 0.44 }, theme.accent2);

  slide.addText((plan.title || "").toUpperCase(), {
    x: MARGIN, y: 0.7, w: panelX - MARGIN - 0.4, h: 0.6,
    fontSize: 14, bold: true, color: theme.inkMuted, fontFace: theme.bodyFont, charSpacing: 2,
  });
  slide.addShape("rect", { x: MARGIN, y: 1.35, w: 0.55, h: 0.06, fill: { color: theme.accent } });
  slide.addText(stat.value, {
    x: MARGIN, y: 1.6, w: panelX - MARGIN - 0.3, h: 3.4,
    fontSize: 150, bold: true, color: theme.accent, fontFace: theme.headingFont,
    align: "left", valign: "middle", fit: "shrink", wrap: false,
  });
  slide.addText(stat.label, {
    x: MARGIN, y: 5.1, w: panelX - MARGIN - 0.4, h: 1.4,
    fontSize: 22, color: theme.ink, fontFace: theme.bodyFont, valign: "top", lineSpacingMultiple: 1.25,
  });
  return slide;
}

/** Sequential steps/phases laid out as a connected horizontal timeline —
 *  alternating nodes, a through-line, and each step's text set above or
 *  below its node so labels don't collide on a crowded row. */
function timelineSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const steps = capBullets(plan.bullets, 5);
  const lineY = SLIDE_H / 2 + 0.35;
  const startX = MARGIN + 0.55;
  const endX = SLIDE_W - MARGIN - 0.55;
  const span = endX - startX;
  const node = 0.56;
  const badge = 0.62;
  const accents = [theme.accent, theme.accent2];

  slide.addShape("rect", { x: startX, y: lineY - 0.02, w: span, h: 0.04, fill: { color: theme.panel } });

  steps.forEach((step, i) => {
    const cx = steps.length === 1 ? startX + span / 2 : startX + (span * i) / (steps.length - 1);
    const above = i % 2 === 0;
    const accent = accents[i % accents.length];
    const { lead, rest } = splitLead(step.replace(SEQUENCE_STRIP_RE, ""));
    const kind = iconKindFor(step);

    slide.addShape("ellipse", { x: cx - node / 2, y: lineY - node / 2, w: node, h: node, fill: { color: accent }, line: { color: theme.bg, width: 3 } });
    slide.addText(String(i + 1), { x: cx - node / 2, y: lineY - node / 2, w: node, h: node, fontSize: 18, bold: true, color: "FFFFFF", align: "center", valign: "middle" });

    const textW = Math.min(2.7, span / steps.length + 0.5);
    const textX = Math.max(MARGIN, Math.min(SLIDE_W - MARGIN - textW, cx - textW / 2));

    if (above) {
      drawIconBadge(slide, kind, cx - badge / 2, lineY - 2.35, badge, theme.panel, accent);
      slide.addText(
        [
          { text: lead, options: { bold: true, breakLine: true, fontSize: 15, color: theme.ink } },
          ...(rest ? [{ text: rest, options: { fontSize: 11, color: theme.inkMuted } }] : []),
        ],
        { x: textX, y: lineY - 1.55, w: textW, h: 1.15, fontFace: theme.bodyFont, align: "center", valign: "bottom", lineSpacingMultiple: 1.2 }
      );
    } else {
      slide.addText(
        [
          { text: lead, options: { bold: true, breakLine: true, fontSize: 15, color: theme.ink } },
          ...(rest ? [{ text: rest, options: { fontSize: 11, color: theme.inkMuted } }] : []),
        ],
        { x: textX, y: lineY + 0.45, w: textW, h: 1.15, fontFace: theme.bodyFont, align: "center", valign: "top", lineSpacingMultiple: 1.2 }
      );
      drawIconBadge(slide, kind, cx - badge / 2, lineY + 1.75, badge, theme.panel, accent);
    }
  });
  return slide;
}
const SEQUENCE_STRIP_RE = /^(step|phase|stage|week|month|quarter|day)\s*\d+\s*[-:–—]?\s*/i;

/** One or two long, sentence-shaped bullets rendered as an editorial
 *  headline treatment (big bold lead phrase + smaller supporting text,
 *  blockquote-style accent rule) instead of a wall of paragraph text. */
function headlineSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const items = capBullets(plan.bullets, 2);
  const top = 2.0;
  const rowH = (SLIDE_H - top - 0.5) / items.length;

  items.forEach((text, i) => {
    const { lead, rest } = splitLead(text);
    const y = top + i * rowH;
    slide.addShape("rect", { x: MARGIN, y: y + 0.1, w: 0.06, h: rowH - 0.3, fill: { color: i % 2 === 0 ? theme.accent : theme.accent2 } });
    slide.addText(
      [
        { text: lead, options: { bold: true, breakLine: true, fontSize: 26, color: theme.ink } },
        ...(rest ? [{ text: rest, options: { fontSize: 16, color: theme.inkMuted } }] : []),
      ],
      { x: MARGIN + 0.35, y, w: SLIDE_W - MARGIN * 2 - 0.35, h: rowH, fontFace: theme.headingFont, align: "left", valign: "middle", lineSpacingMultiple: 1.25, paraSpaceAfter: 6 }
    );
  });
  return slide;
}

/** Big-number "highlights" layout for bullets shaped like "42% — faster
 *  onboarding". Laid out as a row of stat cards (2-4 depending on count)
 *  so a handful of key metrics reads like a real stats slide, not a
 *  bulleted list of numbers. */
function statsSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const stats = capBullets(plan.bullets, 4)
    .map((b) => parseStatBullet(b) ?? { value: b, label: "" })
    .slice(0, 4);

  const gap = 0.35;
  const top = 2.0;
  const cardH = SLIDE_H - top - 0.6;
  const cardW = (SLIDE_W - MARGIN * 2 - gap * (stats.length - 1)) / stats.length;
  const accents = [theme.accent, theme.accent2, theme.accent, theme.accent2];

  stats.forEach((stat, i) => {
    const x = MARGIN + i * (cardW + gap);
    const accent = accents[i % accents.length];
    slide.addShape("roundRect", {
      x, y: top, w: cardW, h: cardH, rectRadius: 0.1,
      fill: { color: theme.panel }, line: { type: "none" },
    });
    // Oversized faint index numeral anchored to the card's bottom edge —
    // fills what would otherwise be dead space below a short label and
    // echoes the same "designed number" trick used on section dividers.
    slide.addText(String(i + 1).padStart(2, "0"), {
      x, y: top + cardH - 1.5, w: cardW, h: 1.7,
      fontSize: 90, bold: true, color: accent, fontFace: theme.headingFont,
      align: "right", valign: "bottom", transparency: 88,
      margin: [0, 12, 0, 0],
    });
    slide.addShape("rect", { x, y: top, w: cardW, h: 0.07, fill: { color: accent } });
    const kind = iconKindFor(`${plan.title || ""} ${stat.label}`);
    drawIconBadge(slide, kind, x + 0.28, top + 0.3, 0.58, accent);
    slide.addText(stat.value, {
      x: x + 0.28, y: top + 1.05, w: cardW - 0.56, h: 0.85,
      fontSize: Math.min(44, Math.floor(((cardW - 0.56) * 72) / (0.62 * Math.max(2, stat.value.length)))),
      bold: true,
      color: theme.ink,
      fontFace: theme.headingFont,
      align: "left",
      valign: "top",
      fit: "shrink",
      wrap: false,
    });
    slide.addShape("rect", { x: x + 0.28, y: top + 2.0, w: 0.4, h: 0.035, fill: { color: accent } });
    slide.addText(stat.label, {
      x: x + 0.28, y: top + 2.15, w: cardW - 0.56, h: cardH - 3.7,
      fontSize: 15,
      color: theme.inkMuted,
      fontFace: theme.bodyFont,
      align: "left",
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  });
  return slide;
}

/** Short, punchy bullets (<= ~9 words each) rendered as icon cards in a
 *  grid instead of a plain dot list — a vector icon in a colored roundel,
 *  the bullet text beside it. Reads far closer to a professionally
 *  designed feature/benefits slide than a dot-point list. */
function iconBulletsSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const bullets = capBullets(plan.bullets, 6);
  const cols = bullets.length > 4 ? 2 : 1;
  const rows = Math.ceil(bullets.length / cols);
  const top = 1.85;
  const areaH = SLIDE_H - top - 0.5;
  const areaW = SLIDE_W - MARGIN * 2;
  const gapX = 0.4;
  const gapY = 0.3;
  const cellW = (areaW - gapX * (cols - 1)) / cols;
  const cellH = (areaH - gapY * (rows - 1)) / rows;
  const accents = [theme.accent, theme.accent2];

  bullets.forEach((text, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cellW + gapX);
    const y = top + row * (cellH + gapY);
    const accent = accents[i % accents.length];

    slide.addShape("roundRect", {
      x, y, w: cellW, h: cellH, rectRadius: 0.09,
      fill: { color: theme.panel }, line: { type: "none" },
    });
    const iconSize = Math.min(0.7, cellH - 0.35);
    drawIconBadge(slide, iconKindFor(text), x + 0.24, y + (cellH - iconSize) / 2, iconSize, accent);
    slide.addText(text, {
      x: x + 0.24 + iconSize + 0.22, y, w: cellW - iconSize - 0.7, h: cellH,
      fontSize: cols === 1 ? 17 : 15,
      color: theme.ink,
      fontFace: theme.bodyFont,
      align: "left",
      valign: "middle",
      lineSpacingMultiple: 1.2,
    });
  });
  return slide;
}

/** Plain list, kept as a fallback for longer/denser bullet content where
 *  stat cards or icon cards would overcrowd — but with a numbered chip
 *  and a bold lead phrase instead of a flat sentence, since both alone
 *  make it read as designed rather than dumped text. */
function numberedListSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const bullets = capBullets(plan.bullets, 6);
  const top = 1.85;
  const areaH = SLIDE_H - top - 0.5;
  const rowH = areaH / Math.max(bullets.length, 1);
  const chip = Math.min(0.42, rowH - 0.15);

  bullets.forEach((text, i) => {
    const { lead, rest } = splitLead(text);
    const y = top + i * rowH + (rowH - chip) / 2;
    slide.addShape("ellipse", {
      x: MARGIN, y, w: chip, h: chip,
      fill: { color: i % 2 === 0 ? theme.accent : theme.accent2 },
    });
    slide.addText(String(i + 1), {
      x: MARGIN, y, w: chip, h: chip,
      fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle",
    });
    slide.addText(
      rest
        ? [
            { text: lead + " ", options: { bold: true, color: theme.ink } },
            { text: rest, options: { color: theme.inkMuted } },
          ]
        : [{ text: lead, options: { color: theme.ink } }],
      {
        x: MARGIN + chip + 0.25, y: top + i * rowH, w: SLIDE_W - MARGIN * 2 - chip - 0.25, h: rowH,
        fontSize: bullets.length <= 4 ? 17 : bullets.length <= 6 ? 15 : 13,
        fontFace: theme.bodyFont,
        align: "left",
        valign: "middle",
        lineSpacingMultiple: 1.25,
      }
    );
  });
  return slide;
}

/** Auto-picks the best rendering for a "bullets" plan based on what the
 *  bullets actually look like (see `pickBulletVariant`) instead of always
 *  drawing the same dot list — this is the single biggest lever for a deck
 *  not looking AI-generated. */
function bulletsSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const bullets = capBullets(plan.bullets, 7);
  const variant = pickBulletVariant(bullets, plan.title || "");
  if (variant === "singleStat") return bigStatSlide(pptx, theme, plan);
  if (variant === "timeline") return timelineSlide(pptx, theme, skin, plan);
  if (variant === "stats") return statsSlide(pptx, theme, skin, plan);
  if (variant === "headline") return headlineSlide(pptx, theme, skin, plan);
  if (variant === "icons") return iconBulletsSlide(pptx, theme, skin, plan);
  return numberedListSlide(pptx, theme, skin, plan);
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

/** Icon+gradient placeholder used whenever a real photo isn't available
 *  (no image API configured, no match found, or the fetch failed) — a
 *  designed panel with a keyword-matched icon and the intended caption,
 *  not a bare gray box, so the deck still looks complete. */
function imagePlaceholder(slide: PptxGenJS.Slide, theme: Theme, imgX: number, imgY: number, imgW: number, imgH: number, caption: string) {
  slide.addShape("roundRect", {
    x: imgX, y: imgY, w: imgW, h: imgH, rectRadius: 0.12,
    fill: { color: theme.panel }, line: { type: "none" },
  });
  slide.addShape("rect", { x: imgX, y: imgY, w: imgW, h: 0.08, fill: { color: theme.accent } });
  const iconSize = 1.1;
  drawIconBadge(slide, iconKindFor(caption), imgX + imgW / 2 - iconSize / 2, imgY + imgH / 2 - iconSize / 2 - 0.3, iconSize, theme.accent);
  slide.addText(caption || "", {
    x: imgX + 0.3, y: imgY + imgH / 2 + 0.45, w: imgW - 0.6, h: 0.8,
    fontSize: 13, italic: true, color: theme.inkMuted, fontFace: theme.bodyFont, align: "center",
  });
}

async function imageSlide(pptx: PptxGenJS, theme: Theme, skin: Skin, plan: PptForgeSlidePlan): Promise<PptxGenJS.Slide> {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slideHeading(slide, theme, plan.title || "", skin);

  const imgW = 4.6;
  const imgX = SLIDE_W - MARGIN - imgW;
  const imgY = 1.7;
  const imgH = SLIDE_H - 2.4;
  const caption = plan.imageCaption || plan.title || "";

  // Best-effort real photo (see pptforge-images.ts) — falls back to the
  // designed placeholder if no image API key is configured, nothing
  // matches, or the request fails/times out. Never blocks or breaks the
  // slide either way.
  const photo = await fetchStockImageDataUri(caption);
  if (photo) {
    slide.addShape("roundRect", {
      x: imgX - 0.04, y: imgY - 0.04, w: imgW + 0.08, h: imgH + 0.08, rectRadius: 0.12,
      fill: { color: theme.accent }, line: { type: "none" },
    });
    slide.addImage({ data: photo, x: imgX, y: imgY, w: imgW, h: imgH, rounding: true });
    slide.addShape("roundRect", {
      x: imgX, y: imgY + imgH - 0.55, w: imgW, h: 0.55, rectRadius: 0,
      fill: { color: "000000", transparency: 40 }, line: { type: "none" },
    });
    slide.addText(caption, {
      x: imgX + 0.2, y: imgY + imgH - 0.55, w: imgW - 0.4, h: 0.55,
      fontSize: 11, italic: true, color: "FFFFFF", fontFace: theme.bodyFont, valign: "middle",
    });
  } else {
    imagePlaceholder(slide, theme, imgX, imgY, imgW, imgH, caption);
  }

  const sideBullets = capBullets(plan.bullets, 5);
  const sideOpts = { x: MARGIN, y: 1.9, w: imgX - MARGIN - 0.4, h: SLIDE_H - 2.6 };
  if (sideBullets.length > 0 && sideBullets.length <= 4) {
    iconChipList(slide, theme, sideBullets, sideOpts);
  } else {
    bulletList(slide, theme, sideBullets, sideOpts, 5);
  }
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

  // An optional short takeaway (reuses `subtitle`, which every slide plan
  // already carries) turns "here is a chart" into "here is the chart AND
  // the point it's making" — a hallmark of a real analyst deck.
  const hasInsight = Boolean(plan.subtitle);
  const chartTop = hasInsight ? 2.15 : 1.7;
  const chartH = SLIDE_H - chartTop - 0.7;

  if (hasInsight) {
    slide.addShape("roundRect", {
      x: MARGIN, y: 1.6, w: SLIDE_W - MARGIN * 2, h: 0.5, rectRadius: 0.06,
      fill: { color: theme.panel }, line: { type: "none" },
    });
    slide.addShape("rect", { x: MARGIN, y: 1.6, w: 0.05, h: 0.5, fill: { color: theme.accent } });
    slide.addText(plan.subtitle || "", {
      x: MARGIN + 0.25, y: 1.6, w: SLIDE_W - MARGIN * 2 - 0.4, h: 0.5,
      fontSize: 12, italic: true, color: theme.inkMuted, fontFace: theme.bodyFont,
      valign: "middle",
    });
  }

  // Rounded backing card behind the chart itself, rather than dropping the
  // chart straight onto the bare slide background.
  slide.addShape("roundRect", {
    x: MARGIN, y: chartTop, w: SLIDE_W - MARGIN * 2, h: chartH, rectRadius: 0.08,
    fill: { color: theme.panel }, line: { type: "none" },
  });

  const pad = 0.25;
  slide.addChart(chartType, data, {
    x: MARGIN + pad,
    y: chartTop + pad,
    w: SLIDE_W - MARGIN * 2 - pad * 2,
    h: chartH - pad * 2,
    chartColors: theme.chartColors,
    showLegend: data.length > 1 || plan.chartType === "pie",
    legendPos: "b",
    legendColor: theme.inkMuted,
    legendFontSize: 11,
    showTitle: false,
    catAxisLabelColor: theme.inkMuted,
    catAxisLabelFontSize: 11,
    valAxisLabelColor: theme.inkMuted,
    valAxisLabelFontSize: 11,
    dataLabelColor: theme.inkMuted,
    dataLabelFontSize: 11,
    showValue: plan.chartType !== "line",
    valGridLine: plan.chartType === "pie" ? { style: "none" } : { color: theme.bg, size: 1 },
    catGridLine: { style: "none" },
    chartColorsOpacity: 90,
    barGapWidthPct: plan.chartType === "bar" ? 35 : undefined,
    lineSmooth: plan.chartType === "line" ? false : undefined,
    lineSize: plan.chartType === "line" ? 3 : undefined,
    lineDataSymbol: plan.chartType === "line" ? "circle" : undefined,
    lineDataSymbolSize: plan.chartType === "line" ? 6 : undefined,
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

  // A slightly-larger backing card gives the table a printed-edge margin
  // instead of its border sitting flush against the slide background.
  slide.addShape("roundRect", {
    x: MARGIN - 0.06, y: 1.7 - 0.06, w: SLIDE_W - MARGIN * 2 + 0.12, h: availableH + 0.12,
    rectRadius: 0.06, fill: { color: theme.panel }, line: { type: "none" },
  });

  const headerRow: PptxGenJS.TableRow = headers.map((h, ci) => ({
    text: h,
    options: {
      bold: true,
      color: "FFFFFF",
      fill: { color: theme.accent },
      fontFace: theme.bodyFont,
      fontSize: headerFontSize,
      valign: "middle",
      align: ci === 0 ? "left" : "center",
      border: [
        { type: "solid", color: theme.accent, pt: 0.5 },
        { type: "solid", color: theme.accent, pt: 0.5 },
        { type: "solid", color: theme.accent, pt: 0.5 },
        { type: "solid", color: theme.accent, pt: 0.5 },
      ],
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
        align: ci === 0 ? "left" : "center",
        border: [
          { type: "solid", color: theme.panel, pt: 0.5 },
          { type: "solid", color: theme.panel, pt: 0.5 },
          { type: "solid", color: theme.panel, pt: 0.5 },
          { type: "solid", color: theme.panel, pt: 0.5 },
        ],
      },
    }))
  );

  slide.addTable([headerRow, ...bodyRows], {
    x: MARGIN,
    y: 1.7,
    w: SLIDE_W - MARGIN * 2,
    h: availableH,
    autoPage: false,
  });
  return slide;
}

function quoteSlide(pptx: PptxGenJS, theme: Theme, plan: PptForgeSlidePlan): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.background = { color: theme.darkBg };
  slide.addShape("ellipse", { x: SLIDE_W - 2.6, y: -1.6, w: 3.6, h: 3.6, fill: { color: theme.accent, transparency: 82 } });
  slide.addShape("rect", { x: 0, y: SLIDE_H - 0.14, w: SLIDE_W, h: 0.14, fill: { color: theme.accent } });
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
    slide.addShape("rect", { x: MARGIN + 0.4, y: 4.75, w: 0.6, h: 0.035, fill: { color: theme.accent } });
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
  let sectionCount = 0;
  for (let i = 0; i < plan.slides.length; i++) {
    const slidePlan = plan.slides[i];
    let slide: PptxGenJS.Slide;
    switch (slidePlan.layout) {
      case "title":
        titleSlide(pptx, theme, skin, slidePlan, plan.title);
        continue; // no footer on the title slide
      case "closing":
        closingSlide(pptx, theme, skin, slidePlan);
        continue; // no footer on the closing slide
      case "section":
        sectionCount += 1;
        slide = sectionSlide(pptx, theme, skin, slidePlan, sectionCount);
        break;
      case "two_column":
        slide = twoColumnSlide(pptx, theme, skin, slidePlan);
        break;
      case "comparison":
        slide = comparisonSlide(pptx, theme, skin, slidePlan);
        break;
      case "image":
        slide = await imageSlide(pptx, theme, skin, slidePlan);
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
  }

  const rawBuf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  // Post-process the raw OOXML to add per-slide transitions and
  // click-to-reveal entrance animations — PptxGenJS has no API for either,
  // see pptforge-effects.ts for why this happens at the zip/XML level.
  return applyTransitionsAndAnimations(rawBuf, style);
}

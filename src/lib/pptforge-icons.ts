import type PptxGenJS from "pptxgenjs";
import type { IconKind } from "@/lib/pptforge-content";

/**
 * PPTForge vector icons
 * ---------------------
 * Emoji glyphs render inconsistently across PowerPoint/Keynote/LibreOffice
 * font stacks and read as an AI-deck tell. This draws small compositions of
 * PptxGenJS's built-in preset vector shapes (arrows, gears, hearts, cubes,
 * stars, flowchart shapes, …) instead — real vector art, theme-colored,
 * that looks identical everywhere.
 */

interface IconBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draws just the icon glyph (no background) inside `box`, in `color`. */
function drawGlyph(slide: PptxGenJS.Slide, kind: IconKind, box: IconBox, color: string) {
  const { x, y, w, h } = box;
  const line = { type: "none" as const };

  switch (kind) {
    case "growth":
      slide.addShape("upArrow", { x: x + w * 0.28, y: y + h * 0.05, w: w * 0.44, h: h * 0.9, fill: { color }, line });
      break;
    case "decline":
      slide.addShape("downArrow", { x: x + w * 0.28, y: y + h * 0.05, w: w * 0.44, h: h * 0.9, fill: { color }, line });
      break;
    case "money":
      slide.addShape("can", { x: x + w * 0.22, y: y + h * 0.12, w: w * 0.56, h: h * 0.76, fill: { color }, line });
      break;
    case "users":
      slide.addShape("ellipse", { x: x + w * 0.14, y: y + h * 0.22, w: w * 0.44, h: h * 0.56, fill: { color, transparency: 15 }, line });
      slide.addShape("ellipse", { x: x + w * 0.42, y: y + h * 0.22, w: w * 0.44, h: h * 0.56, fill: { color }, line });
      break;
    case "time":
      slide.addShape("ellipse", { x: x + w * 0.1, y: y + h * 0.1, w: w * 0.8, h: h * 0.8, fill: { type: "none" }, line: { color, width: 2.5 } });
      slide.addShape("rect", { x: x + w * 0.48, y: y + h * 0.22, w: w * 0.05, h: h * 0.3, fill: { color }, line });
      slide.addShape("rect", { x: x + w * 0.5, y: y + h * 0.48, w: w * 0.28, h: w * 0.05, fill: { color }, line });
      break;
    case "security":
      slide.addShape("pentagon", { x: x + w * 0.2, y: y + h * 0.08, w: w * 0.6, h: h * 0.84, fill: { color }, line, rotate: 180 });
      break;
    case "idea":
      slide.addShape("lightningBolt", { x: x + w * 0.26, y: y + h * 0.05, w: w * 0.48, h: h * 0.9, fill: { color }, line });
      break;
    case "target":
      slide.addShape("donut", { x: x + w * 0.1, y: y + h * 0.1, w: w * 0.8, h: h * 0.8, fill: { color }, line });
      slide.addShape("ellipse", { x: x + w * 0.38, y: y + h * 0.38, w: w * 0.24, h: h * 0.24, fill: { color }, line });
      break;
    case "global":
      slide.addShape("cloud", { x: x + w * 0.08, y: y + h * 0.18, w: w * 0.84, h: h * 0.64, fill: { color }, line });
      break;
    case "data":
      slide.addShape("rect", { x: x + w * 0.16, y: y + h * 0.5, w: w * 0.18, h: h * 0.38, fill: { color }, line });
      slide.addShape("rect", { x: x + w * 0.41, y: y + h * 0.3, w: w * 0.18, h: h * 0.58, fill: { color }, line });
      slide.addShape("rect", { x: x + w * 0.66, y: y + h * 0.15, w: w * 0.18, h: h * 0.73, fill: { color }, line });
      break;
    case "quality":
      slide.addShape("star5", { x: x + w * 0.12, y: y + h * 0.1, w: w * 0.76, h: h * 0.76, fill: { color }, line });
      break;
    case "product":
      slide.addShape("cube", { x: x + w * 0.18, y: y + h * 0.16, w: w * 0.64, h: h * 0.64, fill: { color }, line });
      break;
    case "tech":
      slide.addShape("gear9", { x: x + w * 0.12, y: y + h * 0.12, w: w * 0.76, h: h * 0.76, fill: { color }, line });
      break;
    case "communication":
      slide.addShape("wedgeRoundRectCallout", { x: x + w * 0.1, y: y + h * 0.14, w: w * 0.8, h: h * 0.68, fill: { color }, line });
      break;
    case "success":
      slide.addShape("ribbon2", { x: x + w * 0.08, y: y + h * 0.2, w: w * 0.84, h: h * 0.56, fill: { color }, line });
      break;
    case "partnership":
      slide.addShape("leftRightArrow", { x: x + w * 0.08, y: y + h * 0.32, w: w * 0.84, h: h * 0.32, fill: { color }, line });
      break;
    case "education":
      slide.addShape("flowChartDocument", { x: x + w * 0.18, y: y + h * 0.12, w: w * 0.64, h: h * 0.72, fill: { color }, line });
      break;
    case "health":
      slide.addShape("heart", { x: x + w * 0.12, y: y + h * 0.14, w: w * 0.76, h: h * 0.7, fill: { color }, line });
      break;
    case "environment":
      slide.addShape("teardrop", { x: x + w * 0.22, y: y + h * 0.1, w: w * 0.56, h: h * 0.76, fill: { color }, line, rotate: 135 });
      break;
    case "strategy":
      slide.addShape("sun", { x: x + w * 0.12, y: y + h * 0.12, w: w * 0.76, h: h * 0.76, fill: { color }, line });
      break;
    case "default":
    default:
      slide.addShape("diamond", { x: x + w * 0.24, y: y + h * 0.24, w: w * 0.52, h: h * 0.52, fill: { color }, line });
      break;
  }
}

/** Draws a colored circular badge with a vector icon centered inside it —
 *  the standard "icon in a roundel" unit used across icon-card and
 *  placeholder layouts. */
export function drawIconBadge(
  slide: PptxGenJS.Slide,
  kind: IconKind,
  x: number,
  y: number,
  diameter: number,
  bgColor: string,
  glyphColor = "FFFFFF"
) {
  slide.addShape("ellipse", { x, y, w: diameter, h: diameter, fill: { color: bgColor }, line: { type: "none" } });
  const inset = diameter * 0.22;
  drawGlyph(slide, kind, { x: x + inset, y: y + inset, w: diameter - inset * 2, h: diameter - inset * 2 }, glyphColor);
}

export { drawGlyph };

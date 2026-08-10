import JSZip from "jszip";
import type { PptForgeStyle } from "@/lib/pptforge";

/**
 * PPTForge effects — transitions & entrance animations
 * -----------------------------------------------------
 * PptxGenJS (the library `pptforge-builder.ts` uses to draw slides) has no
 * API for slide transitions or shape animations — those live in parts of
 * the OOXML schema (`<p:transition>`, `<p:timing>`) it never writes. This
 * module opens the .pptx PptxGenJS already produced (a zip of XML parts),
 * and for every slide:
 *
 *  - inserts a `<p:transition>` — the SAME one for every slide in a given
 *    deck, chosen from a small style-appropriate pool, so moving between
 *    slides feels like one consistent, subtle deliberate choice instead of
 *    a different flashy effect every slide
 *  - builds a `<p:timing>` tree that fades each shape in one at a time —
 *    the first click reveals the slide, each following shape follows
 *    automatically ("after previous"), so a slide with a title and five
 *    bullets still only costs one click to fully reveal
 *
 * This only ever adds two well-formed, schema-valid XML fragments per
 * slide; it never rewrites content PptxGenJS already produced.
 */

// Curated, deliberately restrained per-style transition pools — no
// checkerboards/wheels/blinds here, just the handful of ECMA-376
// transitions (§19.3.2 CT_SlideTransition) that read as "subtle" and are
// consistently supported in PowerPoint, Keynote, and Google Slides.
const STYLE_TRANSITIONS: Record<PptForgeStyle, string[]> = {
  professional: [
    '<p:transition spd="med"><p:fade/></p:transition>',
    '<p:transition spd="med"><p:push dir="l"/></p:transition>',
    '<p:transition spd="med"><p:cover dir="l"/></p:transition>',
  ],
  modern: [
    '<p:transition spd="med"><p:fade/></p:transition>',
    '<p:transition spd="med"><p:wipe dir="l"/></p:transition>',
    '<p:transition spd="med"><p:zoom dir="in"/></p:transition>',
  ],
  minimal: [
    '<p:transition spd="med"><p:fade/></p:transition>',
    '<p:transition spd="slow"><p:dissolve/></p:transition>',
  ],
  bold: [
    '<p:transition spd="fast"><p:cut/></p:transition>',
    '<p:transition spd="med"><p:push dir="l"/></p:transition>',
    '<p:transition spd="med"><p:wipe dir="l"/></p:transition>',
  ],
  academic: [
    '<p:transition spd="med"><p:fade/></p:transition>',
    '<p:transition spd="med"><p:wipe dir="r"/></p:transition>',
    '<p:transition spd="med"><p:cover dir="u"/></p:transition>',
  ],
};

function pickDeckTransition(style: PptForgeStyle): string {
  const pool = STYLE_TRANSITIONS[style] ?? STYLE_TRANSITIONS.professional;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Pulls the ids of top-level content shapes (text boxes, autoshapes,
 *  pictures, charts, tables) out of a slide's spTree — in document order,
 *  skipping the group-root `cNvPr` that always opens the tree — so we know
 *  what to animate. Caps the count so a busy slide (e.g. an 8-row table
 *  plus its heading) doesn't turn into a 20-click build. */
function extractShapeIds(slideXml: string, max = 7): string[] {
  const ids: string[] = [];
  const re = /<p:(?:sp|pic|cxnSp|graphicFrame)>[\s\S]*?<p:cNvPr id="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slideXml)) !== null && ids.length < max) {
    ids.push(m[1]);
  }
  return ids;
}

let idCounter = 0;
function nextId(): number {
  idCounter += 1;
  return 1000 + idCounter;
}

/** One shape's "fade in" build step. `trigger` is "click" for the first
 *  shape on the slide (needs a click to start the build) or "after" for
 *  every shape after it (starts automatically once the previous one
 *  finishes, so the whole slide still only costs one click). */
function fadeEffectPar(shapeId: string, trigger: "click" | "after"): string {
  const nodeType = trigger === "click" ? "clickEffect" : "afterEffect";
  const delay = trigger === "click" ? "0" : "300";
  const containerId = nextId();
  const effectId = nextId();
  const setId = nextId();
  const animId = nextId();
  return `<p:par><p:cTn id="${containerId}" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${effectId}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${setId}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${animId}" dur="500"/><p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
}

function buildTiming(shapeIds: string[]): string {
  if (shapeIds.length === 0) return "";
  const pars = shapeIds.map((id, i) => fadeEffectPar(id, i === 0 ? "click" : "after")).join("");
  const rootId = nextId();
  const seqId = nextId();
  return `<p:timing><p:tnLst><p:par><p:cTn id="${rootId}" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="${seqId}" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${pars}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

function injectIntoSlide(slideXml: string, transition: string): string {
  let xml = slideXml;

  // <p:transition> is a sibling of <p:cSld>/<p:clrMapOvr>, must come right
  // before </p:sld> (or before <p:timing> if present). Insert after
  // clrMapOvr when present, otherwise right after cSld closes.
  if (xml.includes("</p:clrMapOvr>")) {
    xml = xml.replace("</p:clrMapOvr>", `</p:clrMapOvr>${transition}`);
  } else if (xml.includes("</p:cSld>")) {
    xml = xml.replace("</p:cSld>", `</p:cSld>${transition}`);
  } else {
    return xml; // unrecognized shape — don't risk corrupting it
  }

  const shapeIds = extractShapeIds(xml);
  const timing = buildTiming(shapeIds);
  if (timing) {
    xml = xml.replace("</p:sld>", `${timing}</p:sld>`);
  }

  return xml;
}

/** Takes the raw .pptx buffer PptxGenJS produced and returns a new buffer
 *  with per-slide transitions and click-to-reveal entrance animations
 *  woven into the underlying OOXML. Falls back to the original buffer if
 *  anything about the zip looks unexpected, so a bug here can never turn a
 *  working download into a broken one. */
export async function applyTransitionsAndAnimations(buf: Buffer, style: PptForgeStyle): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
        const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
        return na - nb;
      });

    if (slideFiles.length === 0) return buf;

    const transition = pickDeckTransition(style);
    for (const name of slideFiles) {
      const original = await zip.file(name)?.async("string");
      if (!original) continue;
      const updated = injectIntoSlide(original, transition);
      zip.file(name, updated);
    }

    const out = await zip.generateAsync({ type: "nodebuffer" });
    return out;
  } catch {
    return buf;
  }
}

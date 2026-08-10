/**
 * PPTForge stock image lookup
 * ---------------------------
 * Optional, best-effort: if `UNSPLASH_ACCESS_KEY` is configured, image
 * slides try to embed a real photo matching the slide's `imageCaption`
 * instead of a placeholder panel. Uses Unsplash's official Search Photos
 * API (not the deprecated "Source" redirect endpoint), so it keeps working
 * as long as the key is valid.
 *
 * Fully optional by design: with no key set, or on any network/API
 * failure, `fetchStockImageDataUri` resolves to `null` and the builder
 * falls back to the designed placeholder graphic — a missing or slow image
 * API should never break a generation or leave a slide half-built.
 */

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";
const FETCH_TIMEOUT_MS = 4000;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

/** Returns a `data:image/...;base64,...` URI for a photo matching `query`,
 *  or `null` if unavailable for any reason (no key, no results, network
 *  error, timeout). Never throws. */
export async function fetchStockImageDataUri(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !query.trim()) return null;

  try {
    const search = withTimeout(FETCH_TIMEOUT_MS);
    const searchRes = await fetch(
      `${UNSPLASH_SEARCH_URL}?per_page=1&orientation=landscape&content_filter=high&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Client-ID ${accessKey}` }, signal: search.signal }
    );
    search.cancel();
    if (!searchRes.ok) return null;

    const json = (await searchRes.json()) as {
      results?: { urls?: { regular?: string } }[];
    };
    const imageUrl = json.results?.[0]?.urls?.regular;
    if (!imageUrl) return null;

    const fetchImg = withTimeout(FETCH_TIMEOUT_MS);
    const imgRes = await fetch(imageUrl, { signal: fetchImg.signal });
    fetchImg.cancel();
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const arrayBuf = await imgRes.arrayBuffer();
    // Guard against pulling down something absurdly large into memory.
    if (arrayBuf.byteLength > 8 * 1024 * 1024) return null;

    const base64 = Buffer.from(arrayBuf).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Turns supplier image references into absolute, fetchable URLs.
 *
 * WHY THIS LIVES SERVER-SIDE
 * --------------------------
 * The supplier is known here and nowhere else. The frontend used to infer the
 * CDN from the file extension — any relative path ending in .jpg was rewritten
 * to `photos.hotelbeds.com/giata/`. That is correct for RateGain (Hotelbeds
 * imagery) and wrong for TripJack, whose paths were sent to a CDN that never
 * hosted them. Every one 404'd, while the gallery still counted them: a hotel
 * advertised "19 Photos" and rendered nineteen broken tiles.
 *
 * The rule here is that a reference we cannot resolve is DROPPED, never
 * guessed. An empty gallery is a true statement; a gallery of dead URLs is not.
 */

/** Hotelbeds/Giata CDN, the image source behind RateGain content. */
const HOTELBEDS_CDN = "https://photos.hotelbeds.com/giata/";

/**
 * TripJack serves absolute URLs in its static-detail payloads, so there is
 * normally nothing to qualify. Set TRIPJACK_IMAGE_BASE only if a TJ feed is
 * found to emit relative paths; until then an unresolvable TJ path is dropped
 * rather than pointed at someone else's CDN.
 */
const TRIPJACK_IMAGE_BASE = process.env.TRIPJACK_IMAGE_BASE || "";

export type ImageSource = "TJ" | "RG";

const IMAGE_EXTENSION = /\.(jpg|jpeg|png|webp|gif|bmp)$/i;

/**
 * Pulls a string out of the several shapes suppliers use for an image entry.
 * TripJack static-detail nests them under `links` keyed by size; RateGain uses
 * flat strings or `{ imageUrl }`-style objects.
 */
function extractPath(raw: any): string {
  if (!raw) return "";

  if (typeof raw === "string") return raw.trim();

  if (typeof raw === "object") {
    const links = raw.links || {};
    const firstLink = Object.values(links)[0] as any;
    const picked =
      raw.href ||
      raw.url ||
      raw.imageUrl ||
      raw.imageUrlPath ||
      raw.imageURL ||
      raw.src ||
      raw.link ||
      links["1000px"]?.href ||
      links["XXL"]?.href ||
      links["XL"]?.href ||
      links["L"]?.href ||
      links["original"]?.href ||
      links["default"]?.href ||
      firstLink?.href ||
      "";
    return String(picked).trim();
  }

  return "";
}

/**
 * Resolves one image reference to an absolute URL, or "" when it cannot be
 * resolved. Callers must filter out "" — see qualifyImageUrls.
 */
export function qualifyImageUrl(raw: any, source: ImageSource): string {
  const path = extractPath(raw);
  if (!path) return "";

  // Already absolute — the common case for both suppliers.
  if (/^https?:\/\//i.test(path)) return path;

  // Protocol-relative (`//host/path`): keep the host, force https.
  if (path.startsWith("//")) return `https:${path}`;

  // A supplier hotel id is not an image. These leak into image arrays when an
  // upstream mapper falls back to the wrong field.
  if (/^(TJ|RG):/.test(path) || /^\d+$/.test(path)) return "";

  // `_hb_` positively identifies a Hotelbeds asset whoever supplied it.
  if (path.includes("_hb_")) {
    return HOTELBEDS_CDN + path.replace(/^\/+/, "");
  }

  if (source === "RG" && IMAGE_EXTENSION.test(path)) {
    return HOTELBEDS_CDN + path.replace(/^\/+/, "");
  }

  if (source === "TJ" && TRIPJACK_IMAGE_BASE && IMAGE_EXTENSION.test(path)) {
    return (
      TRIPJACK_IMAGE_BASE.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "")
    );
  }

  // Unresolvable: no host, and no basis for inventing one.
  return "";
}

/** Maps a supplier image array to absolute URLs, dropping what won't resolve. */
export function qualifyImageUrls(raw: any, source: ImageSource): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of arr) {
    const url = qualifyImageUrl(entry, source);
    // Suppliers repeat the same asset across size variants; a duplicate would
    // inflate the photo count exactly the way dead URLs did.
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }

  return out;
}

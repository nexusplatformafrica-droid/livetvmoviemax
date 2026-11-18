const FEED = "https://magic1xtra.com/api-proxy.php?path=";
const SUPERSPORT_CATEGORY_ID = 193;
const UPSTREAM_ORIGIN = "http://197.220.88.26:2200";
/**
 * The hosted server runtime refuses to fetch bare IP addresses, so requests go out through a
 * wildcard-DNS name that resolves to the same fixed IP. Validation still uses UPSTREAM_ORIGIN.
 */
const UPSTREAM_FETCH_ORIGIN = "http://197.220.88.26.sslip.io:2200";
/** Super Sport links in the feed rarely change; a long cache keeps the feed lookup off the play path. */
const SOURCE_CACHE_MS = 10 * 60_000;

interface FeedRow {
  id?: unknown;
  title?: unknown;
  tv_category_id?: unknown;
  category?: { id?: unknown; name?: unknown } | null;
  other_url?: unknown;
  video?: unknown;
  stream_url?: unknown;
}

interface FeedBody {
  status?: unknown;
  message?: unknown;
  data?: unknown;
}

interface SourceCache {
  expiresAt: number;
  sources: Map<string, URL>;
}

let sourceCache: SourceCache | null = null;
let sourceRefresh: Promise<Map<string, URL>> | null = null;

export class SuperSportSourceNotFoundError extends Error {
  constructor() {
    super("Super Sport stream is not available in the feed.");
    this.name = "SuperSportSourceNotFoundError";
  }
}

export function isAllowedSuperSportSource(
  rawUrl: unknown,
  title: unknown,
  categoryId: unknown,
): boolean {
  if (
    Number(categoryId) !== SUPERSPORT_CATEGORY_ID ||
    !/^super\s?sport\b/i.test(String(title ?? "").trim())
  ) {
    return false;
  }
  if (typeof rawUrl !== "string") return false;

  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return (
      url.origin === UPSTREAM_ORIGIN &&
      parts[0] === "AFR-EX" &&
      /^SuperSport_/i.test(parts[1] ?? "") &&
      parts.length >= 3 &&
      /\.m3u8$/i.test(parts.at(-1) ?? "")
    );
  } catch {
    return false;
  }
}

/** Turn an approved upstream URL into the URL the server actually fetches. */
export function toUpstreamFetchUrl(target: URL): URL {
  if (target.origin !== UPSTREAM_ORIGIN) throw new Error("Stream resource is outside the approved source.");
  return new URL(`${target.pathname}${target.search}`, UPSTREAM_FETCH_ORIGIN);
}

/** Map a URL on the fetch host (e.g. a redirect location) back to the approved upstream origin. */
export function fromUpstreamFetchUrl(url: URL): URL {
  if (url.origin !== UPSTREAM_FETCH_ORIGIN) return url;
  return new URL(`${url.pathname}${url.search}`, UPSTREAM_ORIGIN);
}

function feedUrl(path: string) {
  return FEED + encodeURIComponent(path);
}

async function loadSources(): Promise<Map<string, URL>> {
  const path = `/categories/${SUPERSPORT_CATEGORY_ID}/tvs?per_page=100&page=1`;
  const response = await fetch(feedUrl(path), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Channel feed answered ${response.status}`);

  const body = (await response.json()) as FeedBody;
  if (body.status && body.status !== "success") {
    throw new Error(String(body.message ?? "Channel feed error"));
  }

  const rows = Array.isArray(body.data) ? (body.data as FeedRow[]) : [];
  const sources = new Map<string, URL>();
  for (const row of rows) {
    const categoryId = Number(row.tv_category_id ?? row.category?.id);
    const title = String(row.title ?? "").trim();
    const id = String(row.id ?? "").trim();
    if (!/^\d{1,12}$/.test(id)) continue;

    const candidates = [row.other_url, row.video, row.stream_url];
    const candidate = candidates.find(
      (value) => typeof value === "string" && /\.m3u8(?:[?#]|$)/i.test(value),
    );
    if (!isAllowedSuperSportSource(candidate, title, categoryId)) continue;

    sources.set(id, new URL(candidate as string));
  }
  return sources;
}

async function getSources(): Promise<Map<string, URL>> {
  if (sourceCache && sourceCache.expiresAt > Date.now()) return sourceCache.sources;
  const stale = sourceCache?.sources;
  if (!sourceRefresh) {
    sourceRefresh = loadSources()
      .then((sources) => {
        sourceCache = { sources, expiresAt: Date.now() + SOURCE_CACHE_MS };
        return sources;
      })
      .finally(() => {
        sourceRefresh = null;
      });
  }
  // Serve the last known links straight away while the refresh runs in the background.
  if (stale) {
    sourceRefresh.catch(() => undefined);
    return stale;
  }
  return sourceRefresh;
}

export async function getSuperSportSource(channelId: string): Promise<URL> {
  if (!/^\d{1,12}$/.test(channelId)) throw new SuperSportSourceNotFoundError();
  const source = (await getSources()).get(channelId);
  if (!source) throw new SuperSportSourceNotFoundError();
  return new URL(source.href);
}

function sourceDirectory(source: URL) {
  const match = source.pathname.match(/^\/AFR-EX\/SuperSport_[^/]+\//i);
  if (!match) throw new Error("Invalid Super Sport source path.");
  return match[0];
}

export function resolveSuperSportTarget(source: URL, resourcePath: string | null): URL {
  if (resourcePath && resourcePath.length > 4096) throw new Error("Invalid stream resource.");

  const target = resourcePath ? new URL(resourcePath, source) : new URL(source.href);
  const directory = sourceDirectory(source);
  if (
    target.origin !== source.origin ||
    target.username ||
    target.password ||
    !target.pathname.startsWith(directory) ||
    /%2f|%5c/i.test(target.pathname)
  ) {
    throw new Error("Stream resource is outside the approved channel.");
  }
  return target;
}

export function rewriteSuperSportManifest(
  manifest: string,
  rootSource: URL,
  currentSource: URL,
  channelId: string,
): string {
  const proxyPath = (reference: string) => {
    const resolved = new URL(reference, currentSource);
    if (resolved.origin !== rootSource.origin) {
      throw new Error("Playlist resource is outside the approved source.");
    }
    const approved = resolveSuperSportTarget(rootSource, `${resolved.pathname}${resolved.search}`);
    const query = new URLSearchParams({
      channel: channelId,
      path: `${approved.pathname}${approved.search}`,
    });
    return `/api/sports-stream?${query.toString()}`;
  };

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(
          /\bURI=(["'])(.*?)\1/g,
          (_match, quote: string, uri: string) => `URI=${quote}${proxyPath(uri)}${quote}`,
        );
      }
      return proxyPath(trimmed);
    })
    .join("\n");
}

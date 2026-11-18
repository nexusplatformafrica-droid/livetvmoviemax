/**
 * Live TV channels come from the Magic 1Xtra TV feed (see tv.functions.ts).
 * This module holds the shared types and the pure mapping rules so both the
 * server function and the browser use the same logic.
 */
import movieMaxLogo from "@/assets/moviemax-logo.png.asset.json";
import beinXtraLogo from "@/assets/channels/beinxtra-logo.png.asset.json";
import mutvLogo from "@/assets/channels/mutv-logo.png.asset.json";
import natGeoLogo from "@/assets/channels/natgeo-logo.png.asset.json";
import nollyAfricaLogo from "@/assets/channels/nollyafrica-logo.png.asset.json";
import skyNewsLogo from "@/assets/channels/skynews-logo.png.asset.json";
import starPlusLogo from "@/assets/channels/starplus-logo.png.asset.json";
import telemundoLogo from "@/assets/channels/telemundo-logo.png.asset.json";
import traceHitsLogo from "@/assets/channels/tracehits-logo.png.asset.json";
import traceSportStarsLogo from "@/assets/channels/tracesportstars-logo.png.asset.json";
import traceUrbanLogo from "@/assets/channels/traceurban-logo.png.asset.json";
import zeeOneLogo from "@/assets/channels/zeeone-logo.png.asset.json";
import kixLogo from "@/assets/channels/kix-logo.png.asset.json";

export interface Channel {
  id: string;
  name: string;
  short: string;
  categoryId: number | null;
  /** Category name as published by the feed, e.g. "News" */
  category: string;
  /** HTTPS HLS link or an app-local playback relay, or "" when unavailable */
  stream: string;
  /** False when the feed only has a plain http link: listed, but browsers block it on https pages */
  playable: boolean;
  /** Absolute logo URL, or null to fall back to initials */
  logo: string | null;
  /** Tailwind background class for the channel badge (design-system token) */
  badge: string;
  description: string;
  views: number;
}

export interface TvCategory {
  id: number;
  name: string;
}

/** Feed asset host for relative image paths such as "assets/uploads/tv/images/x.jpg". */
export const TV_ASSET_ROOT = "https://tvapp.hostherb.com/";

const BADGES = [
  "bg-ch-news",
  "bg-ch-sport",
  "bg-ch-science",
  "bg-ch-film",
  "bg-ch-kids",
  "bg-ch-music",
  "bg-ch-biz",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const words = name
    .replace(/\(.*?\)/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return "TV";
  if (words.length === 1) return (words[0] as string).slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function stripHtml(s: string) {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absUrl(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (/^https:\/\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return null; // plain http images are blocked on https pages
  return TV_ASSET_ROOT + s.replace(/^\/+/, "");
}

interface RawTv {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  tv_category_id?: unknown;
  description?: unknown;
  thumbnail_image?: unknown;
  logo_url?: unknown;
  total_views?: unknown;
  playback_mode?: unknown;
  external_source?: unknown;
  stream_status?: unknown;
  other_url?: unknown;
  video?: unknown;
  stream_url?: unknown;
}

function isSuperSportRelayUrl(rawUrl: string, name: string, category: string) {
  if (category.toLowerCase() !== "super sport" || !/^super\s?sport\b/i.test(name)) return false;
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return (
      url.origin === "http://197.220.88.26:2200" &&
      parts[0] === "AFR-EX" &&
      /^SuperSport_/i.test(parts[1] ?? "") &&
      parts.length >= 3 &&
      /\.m3u8$/i.test(parts.at(-1) ?? "")
    );
  } catch {
    return false;
  }
}

/**
 * Turns one feed row into a playable channel, or null when the web player cannot play it:
 * MTN secure channels, offline rows, and non-HLS streams are excluded. Plain HTTP HLS is
 * only routed through the server relay for the allowlisted Super Sport feed category/source.
 */
export function toChannel(raw: RawTv): Channel | null {
  const mode = String(raw.playback_mode ?? "").toLowerCase();
  const source = String(raw.external_source ?? "").toLowerCase();
  if (mode.includes("mtn") || source.includes("mtn")) return null;
  if (String(raw.stream_status ?? "").toLowerCase() === "offline") return null;

  const name = (String(raw.title ?? "").trim() || "Untitled channel").toUpperCase();
  const id = String(raw.id ?? name);
  const cat = (raw.category ?? {}) as { id?: unknown; name?: unknown };
  const category = typeof cat.name === "string" && cat.name.trim() ? cat.name.trim() : "Live TV";
  const catId = Number(raw.tv_category_id ?? cat.id);

  const links = [raw.other_url, raw.video, raw.stream_url]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((u) => u.toLowerCase().includes(".m3u8") && !u.includes("mtntv.co.ug"));
  const secure = links.find((u) => /^https:\/\//i.test(u));
  const insecure = links.find((u) => /^http:\/\//i.test(u));
  const relayAllowed = Boolean(insecure && isSuperSportRelayUrl(insecure, name, category));
  if (!secure && !insecure) return null;
  const stream =
    secure ?? (relayAllowed ? `/api/sports-stream?channel=${encodeURIComponent(id)}` : "");

  let description = stripHtml(String(raw.description ?? ""));
  if (
    !description ||
    description.toLowerCase() === name.toLowerCase() ||
    /^imported from/i.test(description)
  ) {
    description = `Live ${category.toLowerCase()} channel.`;
  }

  return {
    id,
    name,
    short: initials(name),
    categoryId: Number.isFinite(catId) && catId > 0 ? catId : null,
    category,
    stream,
    playable: Boolean(secure || relayAllowed),
    logo: absUrl(raw.thumbnail_image) ?? absUrl(raw.logo_url),
    badge: BADGES[hash(id) % BADGES.length] as string,
    description,
    views: Number(raw.total_views) || 0,
  };
}

export function toChannels(rows: unknown): Channel[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: Channel[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const c = toChannel(r as RawTv);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

/** Placeholder shown in the player area until the first channel arrives. */
export const NO_CHANNEL: Channel = {
  id: "none",
  name: "Loading channels…",
  short: "TV",
  categoryId: null,
  category: "Live TV",
  stream: "",
  playable: false,
  logo: null,
  badge: "bg-ch-film",
  description: "Pick a channel from the list.",
  views: 0,
};

export type ShelfTab = "trending" | "music" | "movies";

export const SHELF_TABS: { id: ShelfTab; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "music", label: "Music" },
  { id: "movies", label: "Movies" },
];

/** Feed category each bottom-bar tab draws from. */
export const SHELF_CATEGORY: Record<ShelfTab, string> = {
  trending: "1Xtra On Demand",
  music: "Music",
  movies: "Movies",
};

/** Trending = most watched first. Music/Movies keep the feed's own order. */
export function shelfChannels(channels: Channel[], tab: ShelfTab): Channel[] {
  if (tab === "trending") return [...channels].sort((a, b) => b.views - a.views).slice(0, 20);
  return channels.slice(0, 20);
}

/**
 * "Popular" is the app's own category, shown before every feed category and opened by default.
 * Its id is negative so it can never clash with a feed category id.
 */
export const POPULAR_ID = -1;
export const POPULAR_NAME = "Popular";

/** Movie Max's own channel: first in Popular and the channel that plays on first visit. */
export const MOVIE_MAX: Channel = {
  id: "moviemax",
  name: "MOVIE MAX TV",
  short: "MM",
  categoryId: POPULAR_ID,
  category: POPULAR_NAME,
  stream: "https://watch.hostherb.com/tv-257/index.m3u8",
  playable: true,
  logo: movieMaxLogo.url,
  badge: "bg-ch-film",
  description: "Movie Max live — movies, series and entertainment around the clock.",
  views: 0,
};

/**
 * Feed channels in Popular. Each is looked up live (inside its feed category) and only shown
 * while the feed still lists it as online and playable.
 * Left out on purpose: matches whose stream refuses web players (no CORS), e.g. BBS TV, Classica.
 */
export interface PopularPick {
  /** Feed channel id */
  id: string;
  /** Feed title, used to search the category */
  title: string;
  /** Feed category the channel lives in */
  categoryId: number;
  /** Name shown in Popular when it should differ from the feed title */
  name?: string;
}

/** Feed categories small enough to load whole (one request) instead of a search per channel. */
export const POPULAR_WHOLE_CATEGORIES = [7, 193];

export const POPULAR_PICKS: PopularPick[] = [
  { id: "13709", title: "Super Sport Premier", categoryId: 193, name: "SUPERSPORT PREMIER LEAGUE" },
  { id: "13708", title: "Super Sport Action", categoryId: 193, name: "SUPERSPORT ACTION" },
  { id: "13710", title: "SuperSport LaLiga", categoryId: 193 },
  { id: "13712", title: "SuperSport WWE", categoryId: 193 },
  { id: "13579", title: "NTV Uganda", categoryId: 7 },
  { id: "8", title: "Bukedde TV", categoryId: 7, name: "BUKEDDE TV 1" },
  { id: "9", title: "Bukedde TV2", categoryId: 7, name: "BUKEDDE TV 2" },
  { id: "5", title: "Galaxy TV", categoryId: 7 },
  { id: "13697", title: "Tayari West TV", categoryId: 7 },
  { id: "10", title: "TV West", categoryId: 7 },
  { id: "7", title: "BBC News", categoryId: 10 },
  { id: "11", title: "Wan Luo TV", categoryId: 7 },
  { id: "13580", title: "Spark TV", categoryId: 7 },
  { id: "5321", title: "K24", categoryId: 12 },
  { id: "11468", title: "TV10", categoryId: 12 },
  { id: "12779", title: "WWE Superstar Central", categoryId: 12 },
  { id: "4177", title: "Fuel TV", categoryId: 6 },
  { id: "6", title: "CNN", categoryId: 10 },
  { id: "567", title: "Al Jazeera", categoryId: 10 },
  { id: "471", title: "Africanews English", categoryId: 10 },
  { id: "4134", title: "France 24 FAST English", categoryId: 12 },
  { id: "7092", title: "News Central", categoryId: 10 },
  { id: "13686", title: "Bloomberg", categoryId: 7 },
  { id: "7124", title: "NHK World-Japan", categoryId: 20 },
  { id: "4677", title: "HIPTV", categoryId: 12 },
  { id: "2406", title: "CGTN Documentary", categoryId: 43 },
  { id: "12681", title: "WildEarth", categoryId: 43 },
  { id: "3873", title: "Faith TV", categoryId: 11 },
  { id: "3064", title: "Daystar TV", categoryId: 11 },
  { id: "9553", title: "SBN TV", categoryId: 11 },
  { id: "3829", title: "EWTN Africa-Asia", categoryId: 11 },
  { id: "10320", title: "Sunna TV", categoryId: 12 },
];

const direct = (
  id: string,
  name: string,
  genre: string,
  stream: string,
  logo: string,
  badge = "bg-ch-film",
): Channel => ({
  id,
  name,
  short: initials(name),
  categoryId: POPULAR_ID,
  category: POPULAR_NAME,
  stream,
  playable: true,
  logo,
  badge,
  description: `${name} live — ${genre}.`,
  views: 0,
});

/**
 * Channels the user gave as direct links (not in the feed). Each link was checked to answer
 * with CORS headers so the web player can load it. DRM-protected links (beIN Sports 1-3 DASH,
 * Nat Geo Wild, Jim Jam) are left out because they cannot play. KIX uses a tokenised link that
 * may expire; ask the user for a fresh link when it stops playing.
 */
export const DIRECT_CHANNELS: Channel[] = [
  direct("starplus", "STAR PLUS", "Indian drama and entertainment", "https://d1taaads3ztvmu.cloudfront.net/120723/smil:lifeokuk.smil/chunklist_b2628000.m3u8", starPlusLogo.url),
  direct("nollyafrica", "NOLLY AFRICA", "African movies around the clock", "https://amg02784-africanmoviecha-nollyafricahd-mansa-ax7vr.amagi.tv/ts-us-w2-n1/playlist/amg02784-africanmoviecha-nollyafricahd-mansa/cb573e1f796c6d8684cb3e67cef84282847b3dcb0e6c886470af4a9765d97800dbe8ae84ae5b910c4c9e1fc061017d360439cd1dd56c49c1da63b820743c4b21fdcde00080dd0d0cb1df11292ca36265299a7369cc350f7bd2ec5a2f803ebe764c53cb017c593f88f258a8714cc59e0a957f39e8fc8b307b24455a9c5a43e6a64cb7ade50941de6da2b8011d942e40fa83439fd501b288d10e83418427f917cb9bf7de804687e4ee59896f18b264224048bec21fa6ce5cb8de9b1b48f61309606e9f623ef184281d80554a5ff985abf505ad57a6db54e10057db60f8dfdb49ea0bca69c7816e80e7d5fe445330a7c5144a26adf5a186fa0ffedc0cf48fe6c77a7095f75b2d09992d9015223694f2dc07c4ed21d6e773cbe4325d0fc99f13cfc6f29bb9e4c40abd35dacbf1af3840656a104dd30ef5d43e8d69955380fa3e0d100d48a4915084a1dc5d3b6d06c6a356c61c16bc94dad688406b8430550aa853d85d047ec57b392fb263aacc4e19e34c3d8c3b39f44f26c013acca4bdb939bb45675e5a484289948e0ba0ddef378d94e344b0dbef76c12057b74deea691a233ba461e1c0c1f578190a8fa694ab2032ccaebea034893f596e0c7f6da2329e8fe90ffbd674/195/1920x1080_4894400/index.m3u8", nollyAfricaLogo.url),
  direct("zeeone", "ZEE ONE", "Indian drama and entertainment", "https://amg17931-zee-amg17931c6-samsung-au-8872.playouts.now.amagi.tv/ts-eu-w1-n2/playlist/amg17931-asiatvusaltdfast-zeeworld-samsungau/cb573e1f796c6d8684cb3e67cef84282847b3dcb0e6c886470af4a9765d97800dbe8ae84ae5b910c4c9e1fc061017d360439cd1dd56c49c1da63b820743c4b21fdcde00080dd0d0cb1df11292ca36265299a7369cc350f7bd2ec5a2f803ebe764c53cb017c593f88f258a8714cc59e0a957f39e8fc8b307b24455a9c5a43e6a64cb7ffe30f44d86df2b6011d942e43fa83439fd501e9d4d45c83468427f9459fc6a2ddd6148ae4ee59896f18b264224048bec21fa6ce5cb8de9b1b48f61309606e9f623ef184281d80554a5ff985abf505ad57a6db54e10057db60f8dfdb49ea0bca69c7816e80e7d5fe445330a7c5144a26adf5a186fa0ffedc0cf48fe6c77a7095f75b2d09992d9015223694f2dc07c4ed21d6e773cbe4325d0fc99f13cfc6f29bb9e4c40abd35dacbf1af3840656a104dd30ef5d43e8d69955380fa3e0d100d48a4915084a1dc5d3b6d06c6a356c61c16bc94dad688406b8430550aa853d85d047ec57b392fb263aacc4e19e34c3d8c3b39f44f26c013acca4bdb939bb45675e5a484289948e0ba0ddef378d94e344b0dbef76c12057b74deea691a233ba461e1c0c1f578190a8ea0991ea1a492808e716d27a5cfda75acd3030091196c9c05ec/74/1920x1080_4362312/index.m3u8", zeeOneLogo.url),
  direct("traceurban", "TRACE URBAN", "urban music videos", "https://amg01076-lightningintern-traceurban-samsungnz-5x2cu.amagi.tv/ts-eu-w1-n2/playlist/amg01076-lightningintern-traceurban-samsungnz/cb573e1f796c6d8684cb3e67cef84282847b3dcb0e6c886470af4a9765d97800dbe8ae84ae5b910c4c9e1fc061017d360439cd1dd56c49c1da63b820743c4b21fdcde00080dd0d0cb1df11292ca36265299a7369cc350f7bd2ec5a2f803ebe764c53cb017c593f88f258a8714cc59e0a957f39e8fc8b307b24455a9c5a43e6a64cb7fbe55c10dc65a9e3011d942e43fa83439fd501b286825383418422f542ce92a6828213d4e4ee59896f18b264224048bec21fa6ce5cb8de9b1b48f61309606e9f623ef184281d80554a5ff985abf505ad57a6db54e10057db60f8dfdb49ea0bca69c7816e80e7d5fe445330a7c5144a26adf5a186fa0ffedc0cf48fe6c77a7095f75b2d09992d9015223694f2dc07c4ed21d6e773cbe4325d0fc99f13cfc6f29bb9e4c40abd35dacbf1af3840656a104dd30ef5d43e8d69955380fa3e0d100d48a4915084a1dc5d3b6d06c6a356c61c16bc94dad688406b8430550aa853d85d047ec57b392fb263aacc4e19e34c3d8c3b39f44f26c013acca4bdb939bb45675e5a484289948e0ba0ddef378d94e344b0dbef76c12057b74deea691a233ba461e1c0c1f578190a8eae9c1ea1b693808e716131ded48087fe6b6e8af7fbfccd2a9d/91/1920x1080_5288800/index.m3u8", traceUrbanLogo.url, "bg-ch-music"),
  direct("traceukhits", "TRACE UK HITS", "chart hits and music videos", "https://d2l4tng0wskzvn.cloudfront.net/v1/manifest/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-i4w0aagbo260c/bda62cc9-46e4-40fe-b181-176bdc49d9f1/3.m3u8", traceHitsLogo.url, "bg-ch-music"),
  direct("beinxtra", "BEIN SPORTS XTRA", "sport news, shows and live games", "https://amg01334-beinsportsllc-beinxtra-localnow-kcy6r.amagi.tv/playlistR1080p.m3u8", beinXtraLogo.url, "bg-ch-sport"),
  direct("natgeo", "NAT GEO", "wildlife and nature", "https://amg00426-littledotstudio-realwildnz-samsungnz-wz0bm.amagi.tv/ts-ap-s1-n1/playlist/amg00426-littledotstudio-realwildnz-samsungnz/y1Q9HnlsZ46Z1D1m2e9GpvlZH94daYhpPrVRiXXRBz7c4qWcqgj_FjiPHt5_CmZBOj6VH9p3EY_YfrFBRTxXKM__5ymiwFYWt9sINCm1agYqhmporDlDftDiH0iiOLZyClqoKmZEPYC4RqxzVduAFIthKZvOjDdoPwNAml5a-6NYseuzVRONOKexSVXBfUHkn0PIgh2miYVbnF6AJ6UQn5Wlj9cU0I7zWZNnkFRzOGgdy-BDXqg3ufeVczCQfSkJSxu249vJRzKCSFRPuNH__zSvXZ7SZbZpOe1Uww-cZt4i6ii38UKlmr7daUgt65EINmnzs-DC0B0HkEq34uXUeHnZ0RF7TMYkmAEjKp_wzlvVlkLY5m3V-jldC8GXRImU_da858MZyle_rZ6vNExKbBMRxgzy6Ar1HZ0p-IBDWx8nIoqVWsOK3CRAQUeUj1PRU1b57IKN2wEs2SJ8fu1z0k8KfMZWPSgFTFQ7nNvv8sR-b2oabtnV35KCPwoBQA/14/640x360_1057680/index.m3u8", natGeoLogo.url, "bg-ch-science"),
  direct("telemundo", "TELEMUNDO", "Spanish-language entertainment", "https://streamer1.nexgen.bz/TELEMUNDO/tracks-v1a1/mono.ts.m3u8", telemundoLogo.url),
  direct("skynews", "SKY NEWS", "breaking news from the UK and the world", "https://d3f4oii5n0oeqi.cloudfront.net/manifest/3fec3e5cac39a52b2132f9c66c83dae043dc17d4/prod_default_tcl-ams-aws/c441d4f7-9f8c-491f-9f77-611a54c397b0/4.m3u8", skyNewsLogo.url, "bg-ch-news"),
  direct("mutv", "MUTV", "Manchester United's own channel", "https://fastly.live.brightcove.com/6374054671112/eu-west-1/6058004203001/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJob3N0IjoiYXplMnp5LmVncmVzcy55ODN1ZWIiLCJhY2NvdW50X2lkIjoiNjA1ODAwNDIwMzAwMSIsImVobiI6ImZhc3RseS5saXZlLmJyaWdodGNvdmUuY29tIiwiaXNzIjoiYmxpdmUtcGxheWJhY2stc291cmNlLWFwaSIsInN1YiI6InBhdGhtYXB0b2tlbiIsImF1ZCI6WyI2MDU4MDA0MjAzMDAxIl0sImp0aSI6IjYzNzQwNTQ2NzExMTIifQ.3FmuTna3DAmY7xlhK5fk6LMrosrtrR5VsU2QOgYO5y4/chunklist__3.m3u8", mutvLogo.url, "bg-ch-sport"),
  direct("tracesportstars", "TRACE SPORT STARS", "sport stars and their stories", "https://tracesportstars-klowdtv.amagi.tv/playlist1080P.m3u8", traceSportStarsLogo.url, "bg-ch-sport"),
  direct("kix", "KIX", "martial arts and action movies", "https://ec05-pop1-hlc.tv360.vn/bpk-token/7bovi6fedjgxqinuumppsxkupd4f2vdy/bpk-tv/166/output/166-audio_214835_und=214800-video=5254000.m3u8", kixLogo.url),
];

/**
 * Display order of Popular: Movie Max, then feed pick ids and direct channel ids as the user
 * listed them, then the earlier popular picks.
 */
export const POPULAR_ORDER: string[] = [
  MOVIE_MAX.id,
  "13709", "13708", "13710", "13712", "13579", "8", "9", "5", "13697", "10", "7", "11",
  "starplus", "nollyafrica", "zeeone", "traceurban", "traceukhits", "beinxtra", "natgeo",
  "telemundo", "skynews", "mutv", "tracesportstars", "kix",
  ...POPULAR_PICKS.map((p) => p.id),
];

/**
 * Channels in Popular, in display order: every app-owned channel, plus every feed pick found
 * live in the feed (`found`) that the web player can play. Picks missing from `found` are left out.
 */
export function popularChannels(found: Channel[] = []): Channel[] {
  const own = new Map([MOVIE_MAX, ...DIRECT_CHANNELS].map((c) => [c.id, c]));
  const feed = new Map(found.map((c) => [c.id, c]));
  const picks = new Map(POPULAR_PICKS.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: Channel[] = [];
  for (const id of POPULAR_ORDER) {
    if (seen.has(id)) continue;
    seen.add(id);
    const mine = own.get(id);
    if (mine) {
      out.push(mine);
      continue;
    }
    const c = feed.get(id);
    if (!c?.playable) continue;
    const rename = picks.get(id)?.name;
    out.push(rename ? { ...c, name: rename, short: initials(rename) } : c);
  }
  return out;
}

export function findCategoryId(categories: TvCategory[], name: string): number | null {
  const n = name.toLowerCase();
  return categories.find((c) => c.name.toLowerCase() === n)?.id ?? null;
}

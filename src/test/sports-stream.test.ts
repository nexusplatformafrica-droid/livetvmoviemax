import { describe, expect, it } from "vitest";
import {
  isAllowedSuperSportSource,
  resolveSuperSportTarget,
  rewriteSuperSportManifest,
} from "@/lib/sports-stream.server";

const source = new URL(
  "http://197.220.88.26:2200/AFR-EX/SuperSport_Premier_League_FHD-dstv/index.m3u8?token=",
);
const nestedSource = new URL(
  "http://197.220.88.26:2200/AFR-EX/SuperSport_Premier_League_FHD-dstv/tracks-v1a1/mono.m3u8?token=",
);

describe("Super Sport stream relay restrictions", () => {
  it("accepts only the current Super Sport feed source shape", () => {
    expect(isAllowedSuperSportSource(source.href, "Super Sport Premier", 193)).toBe(true);
    expect(isAllowedSuperSportSource(nestedSource.href, "Super Sport Premier", 193)).toBe(true);
    expect(
      isAllowedSuperSportSource("https://example.com/live.m3u8", "Super Sport Premier", 193),
    ).toBe(false);
    expect(
      isAllowedSuperSportSource(
        "http://197.220.88.26:2200/AFR-EX/SuperSport_Premier/index.m3u8",
        "News Channel",
        193,
      ),
    ).toBe(false);
    expect(
      isAllowedSuperSportSource(
        "http://197.220.88.26:2200/AFR-EX/SuperSport_Premier/index.m3u8",
        "Super Sport Premier",
        7,
      ),
    ).toBe(false);
  });

  it("resolves media only inside the selected channel folder", () => {
    expect(resolveSuperSportTarget(source, "2026/11/09/segment.ts?token=").pathname).toContain(
      "/SuperSport_Premier_League_FHD-dstv/2026/11/09/segment.ts",
    );
    expect(() => resolveSuperSportTarget(source, "../../Other_Channel/segment.ts")).toThrow();
    expect(() => resolveSuperSportTarget(source, "https://example.com/segment.ts")).toThrow();

    const nestedPlaylist = new URL(
      "http://197.220.88.26:2200/AFR-EX/SuperSport_Premier_League_FHD-dstv/tracks-v1a1/mono.m3u8?token=",
    );
    expect(resolveSuperSportTarget(nestedPlaylist, "2026/11/09/segment.ts?token=").pathname).toBe(
      "/AFR-EX/SuperSport_Premier_League_FHD-dstv/tracks-v1a1/2026/11/09/segment.ts",
    );
  });

  it("rewrites playlist and key URLs to the same-origin relay", () => {
    const manifest = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="keys/key.bin?token="',
      "2026/11/09/segment.ts?token=",
      "",
    ].join("\n");
    const rewritten = rewriteSuperSportManifest(manifest, source, source, "13709");
    const lines = rewritten.split("\n");

    expect(lines[1]).toContain('URI="/api/sports-stream?channel=13709&path=');
    expect(lines[2]).toMatch(/^\/api\/sports-stream\?channel=13709&path=/);
    expect(lines[2]).toContain("segment.ts");
    expect(() =>
      rewriteSuperSportManifest("#EXTM3U\nhttps://example.com/segment.ts", source, source, "13709"),
    ).toThrow();
  });
});

describe("Super Sport relay fetch address", () => {
  it("fetches the fixed upstream through its named address, not the bare IP", async () => {
    const { toUpstreamFetchUrl, fromUpstreamFetchUrl } = await import("@/lib/sports-stream.server");
    const fetchUrl = toUpstreamFetchUrl(source);
    expect(fetchUrl.href).toBe(
      "http://197.220.88.26.sslip.io:2200/AFR-EX/SuperSport_Premier_League_FHD-dstv/index.m3u8?token=",
    );
    expect(fromUpstreamFetchUrl(fetchUrl).href).toBe(source.href);
    expect(() => toUpstreamFetchUrl(new URL("https://example.com/live.m3u8"))).toThrow();
  });
});

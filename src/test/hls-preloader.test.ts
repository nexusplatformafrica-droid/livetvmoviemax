import { describe, expect, it } from "vitest";
import { isRelay, nextWarmTarget, resolveStreamSource } from "@/lib/hls-preloader";

describe("HLS stream preloading", () => {
  it("resolves the same-origin Super Sport relay and rejects non-web URLs", () => {
    const baseUrl = new URL("https://app.example/");

    expect(resolveStreamSource("/api/sports-stream?channel=13709", baseUrl)).toBe(
      "https://app.example/api/sports-stream?channel=13709",
    );
    expect(resolveStreamSource("data:video/mp2t,abc", baseUrl)).toBeNull();
  });

  it("selects the lowest-bandwidth variant playlist", () => {
    const manifest = [
      "#EXTM3U",
      "#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720",
      "high/index.m3u8",
      "#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240",
      "low/index.m3u8",
    ].join("\n");

    expect(nextWarmTarget(manifest, new URL("https://video.example/live/master.m3u8"))).toEqual({
      kind: "playlist",
      url: "https://video.example/live/low/index.m3u8",
    });
  });

  it("selects the most recent low-latency part when available", () => {
    const manifest = [
      "#EXTM3U",
      '#EXT-X-PART:DURATION=0.333,URI="part-1.m4s"',
      '#EXT-X-PART:DURATION=0.333,URI="part-2.m4s"',
      "segment-1.ts",
    ].join("\n");

    expect(nextWarmTarget(manifest, new URL("https://video.example/live/index.m3u8"))).toEqual({
      kind: "media",
      url: "https://video.example/live/part-2.m4s",
    });
  });

  it("selects the newest media segment and rejects invalid URLs", () => {
    const manifest = ["#EXTM3U", "old.ts", "new.ts"].join("\n");

    expect(nextWarmTarget(manifest, new URL("https://video.example/live/index.m3u8"))).toEqual({
      kind: "media",
      url: "https://video.example/live/new.ts",
    });
    expect(nextWarmTarget("#EXTM3U", new URL("https://video.example/live/index.m3u8"))).toBeNull();
  });

  it("treats only the Super Sport relay as a relay stream", () => {
    expect(isRelay("https://app.example/api/sports-stream?channel=13709")).toBe(true);
    expect(isRelay("https://video.example/live/index.m3u8")).toBe(false);
  });
});

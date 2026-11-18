import { describe, expect, it } from "vitest";
import { shelfChannels, toChannel, toChannels, type Channel } from "@/lib/channels";

const row = (over: Record<string, unknown> = {}) => ({
  id: 13707,
  title: "Aspire TV",
  tv_category_id: 7,
  category: { id: 7, name: "1Xtra On Demand" },
  playback_mode: "native",
  stream_status: "online",
  other_url: "https://panel.ionflixtvs.com:3636/hybrid/play.m3u8",
  thumbnail_image: "assets/uploads/tv/images/aspire.jpg",
  total_views: 12,
  ...over,
});

describe("feed channels the web player can play", () => {
  it("keeps an https .m3u8 channel and builds its logo from the feed asset host", () => {
    const c = toChannel(row());
    expect(c?.stream).toBe("https://panel.ionflixtvs.com:3636/hybrid/play.m3u8");
    expect(c?.logo).toBe("https://tvapp.hostherb.com/assets/uploads/tv/images/aspire.jpg");
    expect(c?.category).toBe("1Xtra On Demand");
  });

  it("drops MTN secure channels (they need the MTN app login)", () => {
    expect(
      toChannel(
        row({ playback_mode: "mtn-secure", other_url: "https://mtntv.co.ug/tv/player/70" }),
      ),
    ).toBeNull();
  });

  it("drops offline channels and non-HLS or plain http links", () => {
    expect(toChannel(row({ stream_status: "offline" }))).toBeNull();
    expect(toChannel(row({ other_url: "https://example.com/watch.html" }))).toBeNull();
  });

  it("keeps plain http HLS channels in the list but marks them not playable, without the link", () => {
    const c = toChannel(
      row({ other_url: "http://197.220.88.26:2200/SuperSport/index.m3u8?token=" }),
    );
    expect(c).not.toBeNull();
    expect(c?.playable).toBe(false);
    expect(c?.stream).toBe("");
    expect(toChannel(row())?.playable).toBe(true);
  });

  it("routes only Super Sport feed HLS through the restricted secure relay", () => {
    const c = toChannel(
      row({
        id: 13709,
        title: "Super Sport Premier",
        tv_category_id: 193,
        category: { id: 193, name: "Super Sport" },
        other_url:
          "http://197.220.88.26:2200/AFR-EX/SuperSport_Premier_League_FHD-dstv/tracks-v1a1/mono.m3u8?token=",
      }),
    );
    expect(c?.playable).toBe(true);
    expect(c?.stream).toBe("/api/sports-stream?channel=13709");

    const otherHost = toChannel(
      row({
        id: 13709,
        title: "Super Sport Premier",
        tv_category_id: 193,
        category: { id: 193, name: "Super Sport" },
        other_url: "http://example.com/AFR-EX/SuperSport_Premier/index.m3u8",
      }),
    );
    expect(otherHost?.playable).toBe(false);
    expect(otherHost?.stream).toBe("");
  });

  it("removes duplicate rows", () => {
    expect(toChannels([row(), row()])).toHaveLength(1);
  });
});

describe("bottom bar tabs", () => {
  const ch = (id: string, views: number) => ({ ...(toChannel(row({ id })) as Channel), views });
  it("Trending puts the most watched channel first", () => {
    const list = [ch("a", 1), ch("b", 50), ch("c", 10)];
    expect(shelfChannels(list, "trending").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
  it("Music and Movies keep the feed order", () => {
    const list = [ch("a", 1), ch("b", 50)];
    expect(shelfChannels(list, "music").map((c) => c.id)).toEqual(["a", "b"]);
  });
});

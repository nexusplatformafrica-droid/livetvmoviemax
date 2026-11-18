import { describe, expect, it } from "vitest";
import { DIRECT_CHANNELS, MOVIE_MAX, NO_CHANNEL, popularChannels, toChannel, type Channel } from "@/lib/channels";

const feedChannel = (id: string, playable = true): Channel => ({ ...NO_CHANNEL, id, name: id, playable, stream: playable ? "https://x/y.m3u8" : "" });

describe("Popular category", () => {
  it("puts Movie Max TV first, playing the Movie Max stream", () => {
    const first = popularChannels()[0];
    expect(first?.name).toBe("MOVIE MAX TV");
    expect(first?.stream).toBe("https://watch.hostherb.com/tv-257/index.m3u8");
    expect(first?.playable).toBe(true);
  });

  it("follows the user's order: SuperSport Premier League, Action, LaLiga, WWE, NTV, Bukedde 1, 2 …", () => {
    const ids = ["13712", "8", "13579", "13710", "13709", "9", "13708", "5", "13697", "10", "7", "11"];
    const names = popularChannels(ids.map((id) => feedChannel(id))).slice(0, 13).map((c) => c.name);
    expect(names).toEqual([
      "MOVIE MAX TV",
      "SUPERSPORT PREMIER LEAGUE",
      "SUPERSPORT ACTION",
      "13710",
      "13712",
      "13579",
      "BUKEDDE TV 1",
      "BUKEDDE TV 2",
      "5",
      "13697",
      "10",
      "7",
      "11",
    ]);
  });

  it("puts the direct-link channels after Wan Luo TV, Star Plus first and KIX last", () => {
    const list = popularChannels([feedChannel("11")]).map((c) => c.id);
    expect(list.slice(list.indexOf("11") + 1, list.indexOf("11") + 13)).toEqual([
      "starplus", "nollyafrica", "zeeone", "traceurban", "traceukhits", "beinxtra", "natgeo",
      "telemundo", "skynews", "mutv", "tracesportstars", "kix",
    ]);
  });

  it("leaves out feed channels the feed no longer lists or cannot play", () => {
    const ids = popularChannels([feedChannel("13709", false)]).map((c) => c.id);
    expect(ids).not.toContain("13709");
    expect(ids).not.toContain("8");
  });

  it("every direct channel has a logo and an uppercase name", () => {
    for (const c of DIRECT_CHANNELS) {
      expect(c.logo).toBeTruthy();
      expect(c.name).toBe(c.name.toUpperCase());
    }
    expect(MOVIE_MAX.logo).toBeTruthy();
  });

  it("shows feed channel names in capitals", () => {
    const c = toChannel({ id: 1, title: "Galaxy TV", other_url: "https://a/b.m3u8", category: { name: "News" } });
    expect(c?.name).toBe("GALAXY TV");
  });
});

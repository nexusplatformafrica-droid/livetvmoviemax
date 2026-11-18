import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import poster from "@/assets/live-stadium-poster.jpg";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { NO_CHANNEL, POPULAR_ID, findCategoryId, type Channel } from "@/lib/channels";
import { tvCategoriesQuery, tvChannelsQuery } from "@/lib/tv-queries";
import type { TvListPage, TvPageParam } from "@/lib/tv-queries";
import { HlsPlayer, type PlayerStats, type PlayerStatus, type QualityLevel } from "@/components/tv/HlsPlayer";
import { TopBar, type TopTab } from "@/components/tv/TopBar";
import { NowWatching } from "@/components/tv/NowWatching";
import { ChannelTable } from "@/components/tv/ChannelTable";
import { StreamStats, ChannelStrip, MovieShelf } from "@/components/tv/StreamPanels";
import { MobileNav } from "@/components/tv/MobileNav";
import { ScheduleBar } from "@/components/tv/ScheduleBar";
import { LiveDot } from "@/components/tv/ChannelBadge";
import { cn } from "@/lib/utils";
import { cancelPreloads, preloadStreams } from "@/lib/hls-preloader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Movie Max Live TV — Watch live channels free" },
      {
        name: "description",
        content: "Watch thousands of live TV channels free on Movie Max: Ugandan TV, news, sport, music, movies and kids.",
      },
      { property: "og:title", content: "Movie Max Live TV — Watch live channels free" },
      {
        property: "og:description",
        content: "Ugandan and world TV, news, sport, music, movies and kids channels live in one place on Movie Max.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    const { categories } = await context.queryClient.ensureQueryData(tvCategoriesQuery());
    const defaultId: number | null = POPULAR_ID;
    const allIds = categories.map((c) => c.id);
    const first = await context.queryClient.ensureInfiniteQueryData(tvChannelsQuery(defaultId, "", allIds));
    // Returned (not only cached) so the browser starts with the same channels the server drew.
    return { categories, defaultId, firstPage: first.pages[0] as TvListPage };
  },
  component: LiveTv,
});

type MobilePanel = "channels" | "watching" | "stream";
const MOBILE_TABS: { id: MobilePanel; label: string }[] = [
  { id: "channels", label: "Channels" },
  { id: "watching", label: "Now watching" },
  { id: "stream", label: "Stream" },
];

const FAV_KEY = "moviemax-live-favourites-v2";
const EMPTY_STATS: PlayerStats = { height: null, bitrateKbps: null, bufferSec: 0 };

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setNow(fmt());
    const t = setInterval(() => setNow(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{now || "--:--:--"}</span>;
}

function LiveTv() {
  const queryClient = useQueryClient();
  const { categories, defaultId, firstPage: seedPage } = Route.useLoaderData();
  const allIds = categories.map((c) => c.id);
  const seed = { pages: [seedPage], pageParams: [{ idx: 0, page: 1 } as TvPageParam] };

  const [channel, setChannel] = useState<Channel | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("connecting");
  const [stats, setStats] = useState<PlayerStats>(EMPTY_STATS);
  const [history, setHistory] = useState<number[]>([]);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [quality, setQuality] = useState(-1);
  const [favourites, setFavourites] = useState<Channel[]>([]);
  const [topTab, setTopTab] = useState<TopTab>("live");
  const [category, setCategory] = useState<number | null>(defaultId);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("channels");

  // Wait for a pause in typing before asking the feed, so each key press is not a request.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // A search looks through every channel in the feed, not just the picked category.
  const listCategory = search ? null : category;
  const listQuery = useInfiniteQuery({
    ...tvChannelsQuery(listCategory, search, allIds),
    ...(listCategory === defaultId && !search ? { initialData: seed } : {}),
  });
  const listChannels = listQuery.data?.pages.flatMap((p) => p.channels) ?? [];
  const preloadKey = listChannels.filter((c) => c.playable).map((c) => c.stream).join("\n");
  const firstPage = listQuery.data?.pages[0];

  const defaultQuery = useInfiniteQuery({ ...tvChannelsQuery(defaultId, "", allIds), initialData: seed });
  const defaultChannels = defaultQuery.data?.pages.flatMap((p) => p.channels) ?? [];
  const current = channel ?? defaultChannels.find((c) => c.playable) ?? defaultChannels[0] ?? NO_CHANNEL;

  // Warm loaded channels after the current stream has had a chance to start.
  useEffect(() => {
    if (!preloadKey) return;
    const timer = setTimeout(() => {
      preloadStreams(preloadKey.split("\n").filter((src) => src && src !== current.stream));
    }, 1500);
    return () => {
      clearTimeout(timer);
      cancelPreloads();
    };
  }, [preloadKey, current.stream]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAV_KEY) || "null");
      if (Array.isArray(saved))
        setFavourites(
          saved
            .filter((c) => c && typeof c.id === "string" && typeof c.stream === "string")
            .map((c) => ({ ...c, playable: typeof c.playable === "boolean" ? c.playable : Boolean(c.stream) })),
        );
    } catch {
      /* ignore broken saved list */
    }
  }, []);

  const toggleFav = (c: Channel) =>
    setFavourites((prev) => {
      const next = prev.some((f) => f.id === c.id) ? prev.filter((f) => f.id !== c.id) : [...prev, c];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });

  const select = (c: Channel) => {
    if (c.id === current.id) return;
    setChannel(c);
    if (!c.playable) setStatus("error");
    setStats(EMPTY_STATS);
    setHistory([]);
    setQuality(-1);
  };

  const onTopTab = (t: TopTab) => {
    setTopTab(t);
    if (t === "news") setCategory(findCategoryId(categories, "News"));
    else if (t === "sport") setCategory(findCategoryId(categories, "Sports"));
    else setCategory(defaultId);
    setMobilePanel("channels");
  };

  const countFor = (id: number | null) =>
    id === null ? null : (queryClient.getQueryData(tvChannelsQuery(id, "", allIds).queryKey)?.pages[0]?.count ?? null);

  const onStats = useCallback((s: PlayerStats) => {
    setStats(s);
    if (s.bitrateKbps) setHistory((h) => [...h.slice(-29), s.bitrateKbps as number]);
  }, []);

  const playableList = listChannels.filter((c) => c.playable);
  const stripChannels = (playableList.length ? playableList : defaultChannels.filter((c) => c.playable)).slice(0, 40);

  const list = {
    channels: listChannels,
    // "All" walks category by category, so its full size isn't known up front.
    count: listCategory === null && !search ? null : (firstPage?.count ?? null),
    hidden: search || listCategory !== null ? (firstPage?.hidden ?? 0) : 0,
    loading: listQuery.isPending,
    error: firstPage?.error ?? (listQuery.isError ? "Channels could not load. Try again." : null),
    hasMore: Boolean(listQuery.hasNextPage),
    loadingMore: listQuery.isFetchingNextPage,
    onLoadMore: () => void listQuery.fetchNextPage(),
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background p-0 sm:p-3 lg:p-4">
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden rounded-none bg-frame shadow-frame sm:rounded-lg">
        <TopBar tab={topTab} onTab={onTopTab} query={query} onQuery={setQuery} />

        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 short:grid short:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] short:grid-rows-[auto_minmax(0,1fr)] lg:grid lg:grid-cols-[230px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_320px]">
          {/* Player column */}
          <div className="order-1 flex min-w-0 shrink-0 flex-col gap-2 short:row-span-2 short:min-h-0 lg:order-none lg:col-start-2 lg:row-start-1 lg:min-h-0">
            <div className="-mx-2 flex min-h-0 flex-col overflow-hidden rounded-none bg-panel-raised sm:-mx-5 sm:rounded-lg lg:mx-0 short:flex-1 lg:flex-1">
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 font-semibold">
                <span className="truncate">{current.name}</span>
                <Settings2 className="h-3 w-3 shrink-0 text-muted-foreground" />
              </span>
              <span className="flex shrink-0 items-center gap-2 font-bold">
                <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] uppercase text-primary-foreground">
                  <LiveDot className="bg-primary-foreground" /> Live
                </span>
                <span className="hidden sm:inline">
                  <Clock />
                </span>
              </span>
            </div>

            <div className="relative aspect-video max-h-[40dvh] w-full bg-frame short:aspect-auto short:max-h-none short:min-h-0 short:flex-1 lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1">
              {current.playable || current === NO_CHANNEL ? (
              <div className="absolute inset-0">
                <HlsPlayer
                  src={current.stream}
                  poster={poster}
                  quality={quality}
                  onQuality={setQuality}
                  onStatus={setStatus}
                  onStats={onStats}
                  onLevels={setLevels}
                />
              </div>
              ) : (
                <div className="absolute inset-0 bg-frame" />
              )}
              {current.playable && status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-frame/85 text-center">
                  <p className="text-sm font-bold">{current.name} is offline right now</p>
                  <p className="text-xs text-muted-foreground">Pick another channel from the list.</p>
                </div>
              )}
            </div>
            </div>

            <div className="hidden shrink-0 gap-2 lg:grid lg:grid-cols-2">
              <StreamStats stats={stats} history={history} />
              <div className="flex flex-col gap-2">
                <ChannelStrip channels={stripChannels} current={current} onSelect={select} />
                <MovieShelf />
              </div>
            </div>
          </div>

          {/* Phone / tablet panel switcher */}
          <div className="order-2 flex shrink-0 gap-1 rounded-lg bg-panel-raised p-1 short:col-start-2 lg:hidden">
            {MOBILE_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setMobilePanel(t.id)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-colors",
                  mobilePanel === t.id
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Left: now watching */}
          <div
            className={cn(
              "order-3 min-h-0 flex-1 short:col-start-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:flex",
              mobilePanel === "watching" ? "flex" : "hidden",
            )}
          >
            <NowWatching
              channel={current}
              status={status}
              stats={stats}
              favourites={favourites}
              onSelect={select}
              onToggleFavourite={toggleFav}
            />
          </div>

          {/* Phone / tablet: stream panel */}
          <div
            className={cn(
              "scrollbar-thin order-3 min-h-0 flex-1 flex-col gap-2 overflow-y-auto short:col-start-2 lg:hidden",
              mobilePanel === "stream" ? "flex" : "hidden",
            )}
          >
            <StreamStats stats={stats} history={history} />
            <ChannelStrip channels={stripChannels} current={current} onSelect={select} />
            <MovieShelf />
          </div>

          {/* Right: channel list */}
          <div
            className={cn(
              "order-3 min-h-0 flex-1 short:col-start-2 lg:order-none lg:col-start-3 lg:row-start-1 lg:flex",
              mobilePanel === "channels" ? "flex" : "hidden",
            )}
          >
            <ChannelTable
              categories={categories}
              current={current}
              category={category}
              onCategory={setCategory}
              query={query}
              onQuery={setQuery}
              countFor={countFor}
              list={list}
              favouriteIds={favourites.map((f) => f.id)}
              onSelect={select}
              onToggleFavourite={toggleFav}
            />
          </div>
        </div>

        <ScheduleBar categories={categories} current={current} onSelect={select} className="mx-2 mb-2 hidden lg:tall:block" />
        <MobileNav tab={topTab} onTab={onTopTab} />
      </div>
    </main>
  );
}

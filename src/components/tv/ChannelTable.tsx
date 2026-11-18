import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { ChevronLeft, ChevronRight, Flame, Loader2, Music2, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { POPULAR_ID, POPULAR_NAME, type Channel, type TvCategory } from "@/lib/channels";
import { ChannelBadge } from "./ChannelBadge";
import { FilmIcon, KidsIcon, MenuIcon, NewsIcon, ScienceIcon, SportIcon, TvIcon } from "./CategoryIcons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const TINTS = [
  "bg-ch-news/35",
  "bg-gold/30",
  "bg-ch-science/25",
  "bg-ch-film/30",
  "bg-ch-kids/30",
  "bg-ch-music/30",
  "bg-ch-biz/30",
];

function iconFor(name: string): Icon {
  const n = name.toLowerCase();
  if (/news|weather|legislative|business|public/.test(n)) return NewsIcon;
  if (/sport|outdoor|auto/.test(n)) return SportIcon;
  if (/science|documentary|education|travel/.test(n)) return ScienceIcon;
  if (/movie|series|classic|comedy|film|demand/.test(n)) return FilmIcon;
  if (/kid|animation|family/.test(n)) return KidsIcon;
  if (/music|relax/.test(n)) return Music2 as Icon;
  return TvIcon;
}

export interface ChannelListState {
  channels: Channel[];
  count: number | null;
  /** Search matches that exist in the feed but can't play on the website */
  hidden?: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function ChannelTable({
  categories,
  current,
  category,
  onCategory,
  query,
  onQuery,
  countFor,
  list,
  favouriteIds,
  onSelect,
  onToggleFavourite,
}: {
  categories: TvCategory[];
  current: Channel;
  category: number | null;
  onCategory: (id: number | null) => void;
  query: string;
  onQuery: (q: string) => void;
  /** Known channel count for a category chip, or null when not loaded yet */
  countFor: (id: number | null) => number | null;
  list: ChannelListState;
  favouriteIds: string[];
  onSelect: (c: Channel) => void;
  onToggleFavourite: (c: Channel) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: true });

  const chips: { id: number | null; label: string; icon: Icon; tint: string }[] = [
    { id: POPULAR_ID, label: POPULAR_NAME, icon: Flame as Icon, tint: "bg-primary/25" },
    { id: null, label: "All", icon: MenuIcon, tint: "bg-ch-sport/25" },
    ...categories.map((c, i) => ({
      id: c.id,
      label: c.name,
      icon: iconFor(c.name),
      tint: TINTS[i % TINTS.length] as string,
    })),
  ];

  // Each arrow only appears when that side still has room to scroll.
  const measure = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdge((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    measure();
    const el = rowRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, categories.length]);

  const nudgeChip = (btn: HTMLButtonElement) => {
    const el = rowRef.current;
    if (!el) return;
    const r = btn.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (r.left < box.left) el.scrollBy({ left: r.left - box.left - 8, behavior: "smooth" });
    else if (r.right > box.right) el.scrollBy({ left: r.right - box.right + 8, behavior: "smooth" });
  };

  const searching = query.trim() !== "";

  return (
    <aside className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <section className="rounded-lg bg-panel-raised p-2">
        <label className="flex items-center gap-2 rounded-full bg-panel px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search all channels"
            className="w-full bg-transparent text-[11px] placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
      </section>

      <section className="relative">
        {edge.left && (
          <button
            aria-label="Previous categories"
            onClick={() => rowRef.current?.scrollBy({ left: -120, behavior: "smooth" })}
            className="absolute left-0.5 top-1/2 z-10 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground/80 hover:text-foreground"
          >
            <ChevronLeft className="h-2.5 w-2.5" />
          </button>
        )}
        <div
          ref={rowRef}
          onScroll={measure}
          className="flex min-w-0 snap-x scroll-px-1 gap-1.5 overflow-x-hidden scroll-smooth p-1"
        >
          {chips.map((c) => {
            const count = countFor(c.id);
            const on = category === c.id;
            return (
              <button
                key={c.id ?? "all"}
                onClick={(e) => {
                  onCategory(c.id);
                  nudgeChip(e.currentTarget);
                }}
                className={cn(
                  "flex h-11 w-[6.5rem] shrink-0 snap-start items-center justify-between gap-1 overflow-hidden rounded-[4px] px-2.5 text-left text-[11px] font-bold transition-all",
                  c.tint,
                  on
                    ? "text-foreground ring-1 ring-primary/50 brightness-110"
                    : "text-foreground/80 opacity-80 hover:opacity-100",
                )}
              >
                <span className="min-w-0 leading-tight">
                  <span className="block truncate">{c.label}</span>
                  <span className="block text-[9px] font-semibold text-foreground/60">
                    {count == null ? "Live TV" : `${count.toLocaleString()} ch`}
                  </span>
                </span>
                <c.icon className={cn("h-4 w-4 shrink-0", on ? "text-primary/90" : "opacity-60")} />
              </button>
            );
          })}
        </div>
        {edge.right && (
          <button
            aria-label="Next categories"
            onClick={() => rowRef.current?.scrollBy({ left: 120, behavior: "smooth" })}
            className="absolute right-0.5 top-1/2 z-10 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground/80 hover:text-foreground"
          >
            <ChevronRight className="h-2.5 w-2.5" />
          </button>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-panel-raised">
        <h3 className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2 text-[11px] font-bold">
          {searching ? `Results for “${query.trim()}”` : "Channels"}
          <span className="rounded-full border border-muted-foreground/40 px-1.5 text-[9px] leading-4 text-muted-foreground">
            {list.loading ? "…" : (list.count ?? list.channels.length).toLocaleString()}
          </span>
        </h3>
        <div className="scrollbar-thin min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
          {list.loading && (
            <p className="flex items-center justify-center gap-2 p-6 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading channels…
            </p>
          )}
          {!list.loading && list.error && list.channels.length === 0 && (
            <p className="p-6 text-center text-[11px] text-muted-foreground">{list.error}</p>
          )}
          {!list.loading && !list.error && list.channels.length === 0 && (
            <p className="p-6 text-center text-[11px] text-muted-foreground">
              {list.hidden
                ? `${list.hidden} channel${list.hidden === 1 ? "" : "s"} found here, but ${list.hidden === 1 ? "it can't" : "they can't"} play on the website — the stream links aren't secure (https).`
                : "No channels match."}
            </p>
          )}
          {list.channels.map((c) => {
            const fav = favouriteIds.includes(c.id);
            const active = c.id === current.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 transition-colors",
                  active ? "bg-primary/10" : "hover:bg-panel",
                )}
              >
                <button onClick={() => onSelect(c)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <ChannelBadge channel={c} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold">{c.name}</span>
                    {(searching || category === null) && (
                      <span className="block truncate text-[9px] text-muted-foreground">{c.category}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-md border px-1 text-[9px] font-bold uppercase leading-4",
                      active ? "border-primary/50 text-primary" : "border-muted-foreground/50 text-muted-foreground",
                    )}
                  >
                    <TvIcon className="h-2.5 w-2.5" />
                    {active ? "On" : "Live"}
                  </span>
                </button>
                <button
                  onClick={() => onToggleFavourite(c)}
                  aria-label={fav ? `Remove ${c.name} from my channels` : `Add ${c.name} to my channels`}
                >
                  <Star className={cn("h-3.5 w-3.5", fav ? "fill-gold text-gold" : "text-muted-foreground")} />
                </button>
              </div>
            );
          })}
          {list.hasMore && !list.loading && (
            <div className="flex justify-center p-2.5">
              <button
                onClick={list.onLoadMore}
                disabled={list.loadingMore}
                className="flex items-center gap-1.5 rounded-full bg-panel px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-foreground/85 shadow-soft transition-colors hover:text-foreground disabled:opacity-60"
              >
                {list.loadingMore && <Loader2 className="h-3 w-3 animate-spin" />}
                {list.loadingMore ? "Loading…" : "Load more channels"}
              </button>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}

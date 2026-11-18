import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHELF_CATEGORY, SHELF_TABS, findCategoryId, shelfChannels, type Channel, type ShelfTab, type TvCategory } from "@/lib/channels";
import { tvChannelsQuery } from "@/lib/tv-queries";
import { ChannelBadge, LiveDot } from "./ChannelBadge";
import { TvIcon } from "./CategoryIcons";

function useShelf(categories: TvCategory[], name: string, tab: ShelfTab) {
  const id = findCategoryId(categories, name);
  const q = useInfiniteQuery({ ...tvChannelsQuery(id, "", []), enabled: id !== null });
  const all = q.data?.pages.flatMap((p) => p.channels) ?? [];
  return { list: shelfChannels(all, tab), loading: id !== null && q.isPending };
}

export function ScheduleBar({
  categories,
  current,
  onSelect,
  className,
}: {
  categories: TvCategory[];
  current: Channel;
  onSelect: (c: Channel) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<ShelfTab>("trending");
  const shelves = {
    trending: useShelf(categories, SHELF_CATEGORY.trending, "trending"),
    music: useShelf(categories, SHELF_CATEGORY.music, "music"),
    movies: useShelf(categories, SHELF_CATEGORY.movies, "movies"),
  };
  const { list, loading } = shelves[tab];
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  // Each arrow only appears when that side still has room to scroll.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  useEffect(() => {
    ref.current?.scrollTo({ left: 0 });
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, tab, list.length]);

  const arrow =
    "absolute top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground/80 hover:text-foreground";

  return (
    <section className={cn("shrink-0 overflow-hidden rounded-lg bg-panel-raised", className)}>
      <div className="flex border-b border-border/60">
        {SHELF_TABS.map((t) => {
          const s = shelves[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-6 py-1 text-[10px] font-extrabold uppercase tracking-wide transition-colors",
                tab === t.id ? "border-b-2 border-gold text-gold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="rounded-full border border-current/40 px-1.5 text-[9px] leading-4 opacity-70">
                {s.loading ? "…" : s.list.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative px-3 py-1">
        {edge.left && (
          <button aria-label="Previous" onClick={() => ref.current?.scrollBy({ left: -240, behavior: "smooth" })} className={cn(arrow, "left-1.5")}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        <div ref={ref} onScroll={measure} className="flex min-w-0 gap-2.5 overflow-x-hidden scroll-smooth p-0.5">
          {loading && (
            <p className="flex h-12 items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading channels…
            </p>
          )}
          {!loading && list.length === 0 && (
            <p className="flex h-12 items-center text-[11px] text-muted-foreground">No channels here yet.</p>
          )}
          {list.map((c) => {
            const on = c.id === current.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={cn(
                  "group relative h-12 w-44 shrink-0 overflow-hidden rounded-md bg-frame text-left transition-all hover:brightness-110",
                  on && "ring-1 ring-primary/50",
                )}
              >
                <span className={cn("absolute inset-0 opacity-40", c.badge)} />
                <span className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <span className="absolute -right-3 -top-4 text-[2.75rem] font-black leading-none text-foreground/10">
                  {c.short}
                </span>
                <span className="absolute inset-x-2.5 bottom-1.5 flex items-end justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-extrabold uppercase leading-tight tracking-tight">
                      {c.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
                      <TvIcon className="h-2.5 w-2.5 text-gold" />
                      <span className="truncate">{c.category}</span>
                    </span>
                  </span>
                  <ChannelBadge channel={c} size="sm" />
                </span>
                <span
                  className={cn(
                    "absolute left-2 top-1.5 flex items-center gap-1 rounded-full px-1.5 text-[8px] font-extrabold uppercase leading-4",
                    on ? "bg-primary text-primary-foreground" : "bg-background/70 text-primary",
                  )}
                >
                  <LiveDot className={on ? "bg-primary-foreground" : ""} /> {on ? "Watching" : "Live"}
                </span>
              </button>
            );
          })}
        </div>
        {edge.right && (
          <button aria-label="Next" onClick={() => ref.current?.scrollBy({ left: 240, behavior: "smooth" })} className={cn(arrow, "right-1.5")}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </section>
  );
}

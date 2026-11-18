import { useCallback, useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/channels";
import type { PlayerStats } from "./HlsPlayer";
import { ChannelBadge } from "./ChannelBadge";
import { FilmIcon, KidsIcon, TvIcon } from "./CategoryIcons";

export function StreamStats({ stats, history, className }: { stats: PlayerStats; history: number[]; className?: string }) {
  const max = Math.max(1, ...history);
  const items = [
    { label: "Resolution", value: stats.height ? `${stats.height}p` : "—" },
    { label: "Bitrate kbps", value: stats.bitrateKbps ? stats.bitrateKbps.toLocaleString() : "—" },
    { label: "Buffer sec", value: stats.bufferSec ? stats.bufferSec.toFixed(1) : "0.0" },
  ];
  return (
    <section className={cn("flex flex-col rounded-lg bg-panel-raised p-2", className)}>
      <h3 className="text-[11px] font-bold text-foreground">Stream stats</h3>
      <div className="mt-1 grid grid-cols-3 divide-x divide-border rounded-md bg-panel py-1 text-center">
        {items.map((i) => (
          <div key={i.label}>
            <div className="text-base font-light leading-tight tabular-nums">{i.value}</div>
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">▲ {i.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex min-h-4 flex-1 items-end gap-0.5 rounded-md bg-panel px-2 pb-1 pt-1">
        {history.length === 0 && (
          <span className="m-auto text-[10px] text-muted-foreground">Waiting for stream…</span>
        )}
        {history.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-sm bg-gradient-hot"
            style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    </section>
  );
}

export function ChannelStrip({
  channels,
  current,
  onSelect,
}: {
  channels: Channel[];
  current: Channel;
  onSelect: (c: Channel) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 200, behavior: "smooth" });
  return (
    <section className="rounded-lg bg-panel-raised p-2">
      <h3 className="text-[11px] font-bold text-foreground">Quick switch</h3>
      <div className="mt-1 flex items-center gap-1">
        <button onClick={() => scroll(-1)} aria-label="Scroll left" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={ref} className="scrollbar-none flex flex-1 gap-1.5 overflow-x-auto p-1">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={cn(
                "flex h-11 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[4px] p-0.5 transition-all",
                c.id === current.id
                  ? "bg-primary/15 ring-1 ring-primary/50"
                  : "bg-panel opacity-85 hover:opacity-100",
              )}
            >
              <ChannelBadge channel={c} size="sm" />
              <span className="w-full truncate text-center text-[8px] leading-none text-muted-foreground">{c.short}</span>
            </button>
          ))}
        </div>
        <button onClick={() => scroll(1)} aria-label="Scroll right" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
const SHELF: { label: string; sub: string; cls: string; icon: Icon; href: string }[] = [
  { label: "Luo Movies", sub: "Movies", cls: "bg-primary/25", icon: FilmIcon, href: "https://luofilm.site/luo" },
  {
    label: "Luganda",
    sub: "Translated",
    cls: "bg-ch-sport/25",
    icon: FilmIcon,
    href: "https://luofilm.site/luganda",
  },
  {
    label: "VJ Junior",
    sub: "Translated",
    cls: "bg-ch-news/35",
    icon: FilmIcon,
    href: "https://luofilm.site/luganda?vj=VJ+Junior",
  },
  { label: "Teso", sub: "Translated", cls: "bg-ch-biz/30", icon: FilmIcon, href: "https://luofilm.site/teso" },
  {
    label: "Series",
    sub: "Episodes",
    cls: "bg-ch-film/30",
    icon: TvIcon,
    href: "https://luofilm.site/category/tv",
  },
  {
    label: "Kids",
    sub: "Cartoons",
    cls: "bg-ch-kids/30",
    icon: KidsIcon,
    href: "https://luofilm.site/category/animation",
  },
];

export function MovieShelf() {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: true });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const arrow = "absolute top-1/2 z-10 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground/80 hover:text-foreground";
  return (
    <section className="rounded-lg bg-panel-raised p-2">
      <h3 className="text-[11px] font-bold text-foreground">More on Movie Max</h3>
      <div className="relative mt-0.5">
        {edge.left && (
          <button aria-label="Previous" onClick={() => ref.current?.scrollBy({ left: -120, behavior: "smooth" })} className={cn(arrow, "left-0.5")}>
            <ChevronLeft className="h-2.5 w-2.5" />
          </button>
        )}
        <div ref={ref} onScroll={measure} className="flex min-w-0 gap-1.5 overflow-x-hidden scroll-smooth p-1">
          {SHELF.map((s) => (
            <a
              key={s.label}
              href={s.href}
              className={cn(
                "flex h-9 w-[6.5rem] shrink-0 items-center justify-between gap-1 overflow-hidden rounded-[4px] px-2.5 text-left text-[11px] font-bold text-foreground/85 transition-all hover:text-foreground hover:brightness-110",
                s.cls,
              )}
            >
              <span className="min-w-0 leading-tight">
                <span className="block truncate">{s.label}</span>
                <span className="block text-[9px] font-semibold text-foreground/60">{s.sub}</span>
              </span>
              <s.icon className="h-4 w-4 shrink-0 opacity-60" />
            </a>
          ))}
        </div>
        {edge.right && (
          <button aria-label="Next" onClick={() => ref.current?.scrollBy({ left: 120, behavior: "smooth" })} className={cn(arrow, "right-0.5")}>
            <ChevronRight className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </section>
  );
}

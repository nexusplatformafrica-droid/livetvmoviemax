import { Star, Plus, Check, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Channel } from "@/lib/channels";
import type { PlayerStats, PlayerStatus } from "./HlsPlayer";
import { ChannelBadge, LiveDot } from "./ChannelBadge";

export function NowWatching({
  channel,
  status,
  stats,
  favourites,
  onSelect,
  onToggleFavourite,
}: {
  channel: Channel;
  status: PlayerStatus;
  stats: PlayerStats;
  favourites: Channel[];
  onSelect: (c: Channel) => void;
  onToggleFavourite: (c: Channel) => void;
}) {
  const isFav = favourites.some((f) => f.id === channel.id);
  const statusLabel = { connecting: "Connecting…", live: "Live", error: "Offline" }[status];
  const rows: [string, string][] = [
    ["Category", channel.category],
    ["Views", channel.views.toLocaleString()],
    ["Quality", stats.height ? `${stats.height}p` : "—"],
    ["Status", statusLabel],
  ];

  return (
    <aside className="scrollbar-thin flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto">
      <section className="shrink-0 rounded-lg bg-panel-raised">
        <h2 className="border-b border-border/60 px-3 py-2 text-[11px] font-bold">Now Watching</h2>
        <div className="flex flex-col items-center gap-1 px-3 py-3">
          <div className="channel-logo-ring">
            <ChannelBadge channel={channel} size="lg" className="ring-0" />
          </div>
          <span className="mt-1 text-[12px] font-bold">{channel.name}</span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            {status === "live" && <LiveDot />}
            {statusLabel}
          </span>
          <span className="text-center text-[11px] text-foreground/75">{channel.description}</span>
        </div>
      </section>

      <Button
        asChild
        variant="soft"
        size="sm"
        className="shrink-0 w-full text-[10px] uppercase tracking-wide"
      >
        <a href="https://moviemaxtv.luofilm.site/" target="_blank" rel="noopener noreferrer">
          <Mail className="h-3.5 w-3.5" />
          Contact
        </a>
      </Button>

      <dl className="shrink-0 divide-y divide-border/60 overflow-hidden rounded-lg bg-panel-raised text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-3 py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg bg-panel-raised">
        <h3 className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-[11px] font-bold">
          My channels
          <span className="rounded-full border border-muted-foreground/40 px-1.5 text-[9px] leading-4 text-muted-foreground">
            {favourites.length}
          </span>
        </h3>
        <ul className="flex-1 divide-y divide-border/60">
          {favourites.length === 0 && (
            <li className="px-4 py-3 text-center text-[11px] text-muted-foreground">
              Tap the star on any channel to keep it here.
            </li>
          )}
          {favourites.map((f, i) => (
            <li key={f.id}>
              <button
                onClick={() => onSelect(f)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-panel",
                  f.id === channel.id && "bg-primary/10",
                )}
              >
                <ChannelBadge channel={f} />
                <span className="flex-1 leading-tight">
                  <span className="flex items-center gap-1 text-[11px] font-semibold">
                    <Star className="h-3 w-3 fill-gold text-gold" /> {f.name}
                  </span>
                  <span className="text-[10px] font-bold text-primary">#{i + 1}</span>
                </span>
                <span className="max-w-[5rem] truncate text-[10px] text-muted-foreground">{f.category} ›</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-center p-2.5">
          <Button
            variant={isFav ? "softGhost" : "soft"}
            size="sm"
            className="text-[10px] uppercase tracking-wide"
            disabled={!channel.stream}
            onClick={() => onToggleFavourite(channel)}
          >
            {isFav ? <Check /> : <Plus />}
            {isFav ? "In my channels" : "Add to my channels"}
          </Button>
        </div>
      </section>
    </aside>
  );
}

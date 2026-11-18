import { Tv, Newspaper, Trophy, CalendarDays, LogIn } from "lucide-react";
import movieMaxLogo from "@/assets/moviemax-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";
import type { TopTab } from "@/components/tv/TopBar";

const TABS: { id: TopTab; label: string; Icon: typeof Tv }[] = [
  { id: "live", label: "Live", Icon: Tv },
  { id: "news", label: "News", Icon: Newspaper },
  { id: "sport", label: "Sport", Icon: Trophy },
  { id: "guide", label: "Guide", Icon: CalendarDays },
];

export function MobileNav({ tab, onTab }: { tab: TopTab; onTab: (t: TopTab) => void }) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="shrink-0 bg-gradient-to-t from-background via-background/95 to-transparent px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
    >
      <div className="relative rounded-2xl border border-border bg-glass shadow-frame backdrop-blur-xl">
        {/* top gradient hairline */}
        <span
          aria-hidden
          className="absolute inset-x-6 top-0 h-px bg-gradient-hot opacity-70"
        />
        <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))_auto] items-center gap-0.5 px-1.5 py-1">
          <button
            type="button"
            onClick={comingSoon}
            aria-label="Movie Max"
            className="flex min-w-0 flex-col items-center gap-0.5 px-1"
          >
            <span className="rim-hot grid h-7 w-7 place-items-center rounded-full">
              <img src={movieMaxLogo.url} alt="Movie Max" className="h-5 w-5 object-contain" />
            </span>
            <span className="text-[7px] font-extrabold leading-none tracking-widest text-cyan">
              MOVIE MAX
            </span>
          </button>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => onTab(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-0.5 text-[8px] font-extrabold uppercase tracking-wider transition-all duration-200",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-10 place-items-center rounded-full transition-all duration-200",
                    active
                      ? "bg-gradient-hot text-primary-foreground shadow-glow"
                      : "bg-transparent",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", active && "drop-shadow")} />
                </span>
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={comingSoon}
            className="flex flex-col items-center gap-0.5 px-1 text-[8px] font-extrabold uppercase tracking-wider text-foreground"
          >
            <span className="rim grid h-6 w-8 place-items-center rounded-full">
              <LogIn className="h-3.5 w-3.5" />
            </span>
            Login
          </button>
        </div>
      </div>
    </nav>
  );
}

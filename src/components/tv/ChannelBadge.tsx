import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/channels";

export function ChannelBadge({
  channel,
  size = "md",
  className,
}: {
  channel: Channel;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const sizes = {
    sm: "h-6 w-6 text-[8px]",
    md: "h-8 w-8 text-[9px]",
    lg: "h-20 w-20 text-lg",
  };
  const showLogo = channel.logo && broken !== channel.logo;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold tracking-tight text-background ring-2 ring-background/60",
        showLogo ? "bg-foreground" : channel.badge,
        sizes[size],
        className,
      )}
    >
      {showLogo ? (
        <img
          src={channel.logo as string}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(channel.logo)}
          className="h-full w-full object-contain p-[12%]"
        />
      ) : (
        channel.short
      )}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full bg-primary animate-live", className)} />;
}

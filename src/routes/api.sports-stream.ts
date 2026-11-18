import { createFileRoute } from "@tanstack/react-router";
import {
  fromUpstreamFetchUrl,
  getSuperSportSource,
  resolveSuperSportTarget,
  rewriteSuperSportManifest,
  SuperSportSourceNotFoundError,
  toUpstreamFetchUrl,
} from "@/lib/sports-stream.server";

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/sports-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const channelId = requestUrl.searchParams.get("channel") ?? "";

        let source: URL;
        try {
          source = await getSuperSportSource(channelId);
        } catch (error) {
          if (error instanceof SuperSportSourceNotFoundError) {
            return textResponse("Stream not found.", 404);
          }
          return textResponse("Channel source is temporarily unavailable.", 503);
        }

        let target: URL;
        try {
          target = resolveSuperSportTarget(source, requestUrl.searchParams.get("path"));
        } catch {
          return textResponse("Invalid stream resource.", 400);
        }

        const upstreamHeaders = new Headers({ accept: "*/*" });
        for (const name of ["range", "if-range"]) {
          const value = request.headers.get(name);
          if (value) upstreamHeaders.set(name, value);
        }

        let upstreamResponse: Response;
        try {
          upstreamResponse = await fetch(toUpstreamFetchUrl(target), {
            headers: upstreamHeaders,
            redirect: "manual",
            signal: AbortSignal.timeout(15_000),
          });

          if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
            const location = upstreamResponse.headers.get("location");
            if (!location) return textResponse("The stream source redirected unexpectedly.", 502);
            const redirected = fromUpstreamFetchUrl(new URL(location, toUpstreamFetchUrl(target)));
            if (redirected.origin !== source.origin) {
              return textResponse("The stream source redirected unexpectedly.", 502);
            }
            const safeRedirect = resolveSuperSportTarget(
              source,
              `${redirected.pathname}${redirected.search}`,
            );
            upstreamResponse = await fetch(toUpstreamFetchUrl(safeRedirect), {
              headers: upstreamHeaders,
              redirect: "manual",
              signal: AbortSignal.timeout(15_000),
            });
          }
        } catch {
          return textResponse("The stream source could not be reached.", 502);
        }

        if (!upstreamResponse.ok) {
          console.error("sports-stream upstream error", upstreamResponse.status, target.pathname);
          return textResponse("The stream source returned an error.", 502);
        }

        const isPlaylist =
          target.pathname.toLowerCase().endsWith(".m3u8") ||
          (upstreamResponse.headers.get("content-type") ?? "").toLowerCase().includes("mpegurl");

        const responseHeaders = new Headers({ "x-content-type-options": "nosniff" });
        const contentType = upstreamResponse.headers.get("content-type");
        if (contentType) responseHeaders.set("content-type", contentType);
        if (!isPlaylist) {
          for (const name of ["accept-ranges", "content-range", "content-length"]) {
            const value = upstreamResponse.headers.get(name);
            if (value) responseHeaders.set(name, value);
          }
        }

        if (isPlaylist) {
          try {
            const manifest = await upstreamResponse.text();
            const rewritten = rewriteSuperSportManifest(manifest, source, target, channelId);
            responseHeaders.set("cache-control", "private, max-age=2");
            responseHeaders.set("content-type", "application/vnd.apple.mpegurl; charset=utf-8");
            return new Response(rewritten, { headers: responseHeaders });
          } catch {
            return textResponse("The stream playlist contains an unsupported resource.", 502);
          }
        }

        if (!responseHeaders.has("content-type")) {
          responseHeaders.set("content-type", "application/octet-stream");
        }
        responseHeaders.set("cache-control", "private, max-age=30");
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      },
    },
  },
});

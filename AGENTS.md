<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Live TV channels come from the Magic 1Xtra TV feed (magic1xtra.com api-proxy) fetched only in server functions because the feed sends no CORS headers. `toChannel` drops MTN secure/DRM, offline and non-HLS rows. Plain-http HLS remains unplayable except Super Sport feed rows that are relayed by `src/routes/api.sports-stream.ts`; that endpoint must validate the feed channel and fixed upstream host/path and must never become an arbitrary URL proxy. Channels are played through `src/components/tv/HlsPlayer.tsx`, which dynamically imports hls.js inside an effect — hls.js is browser-only and must never be imported at module scope (SSR runs on workerd).
- The app is dark-only; colour tokens live in `:root` of `src/styles.css` with no `.dark` block, so add new tokens there.
- "Popular" is an app-owned category (`POPULAR_ID`, negative id), not a feed category, so it must stay out of the feed `allIds` walk. Its display order is `POPULAR_ORDER` in `src/lib/channels.ts`, mixing app-owned channels (Movie Max + `DIRECT_CHANNELS`, fixed links) and feed `POPULAR_PICKS` (feed id + title + category, optional display `name`) verified live by `getPopularTvs` (cached in memory) so offline/unplayable picks drop out; the feed has no per-id endpoint that returns stream links. Only add channels whose stream sends CORS headers and is not DRM-encrypted (the player is HLS-only).
- Channel names are shown in capitals: `toChannel` uppercases feed titles and app-owned channels are written in capitals.
- The Super Sport relay fetches its fixed upstream IP through the `<ip>.sslip.io` name (`toUpstreamFetchUrl`) because the hosted server runtime refuses bare-IP fetches; validation still checks the original IP origin.
- Preserve static copies of the app-owned logos in `public/__l5e/assets-v1/` at their pointer paths so exported builds can serve the existing image URLs without Lovable's asset service.

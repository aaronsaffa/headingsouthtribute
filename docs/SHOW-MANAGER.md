# Show manager setup

Adapted from the existing Staples manager. Heading South has its own storage and credentials. No Staples configuration, data, or credentials are reused.

## Client workflow

Visit `/admin/`, sign in with this site's private manager key, then add/edit shows and select **Save schedule**. New shows start as drafts. Only **Confirmed** shows appear publicly; past shows remain in the manager. Dates use Pacific time. Venue name, map, ticket link, and show details are optional; city and date are required. Leave the Long Beach debut's venue blank until confirmed.

Use **Manage venues** to maintain reusable locations. Removing a saved venue does not remove existing shows. Updating a venue's map link updates matching shows in the editor; select Save schedule to persist it. Sign out when finished. The key is held only in tab memory.

## Cloudflare preview activation

1. In the Heading South Cloudflare account, create a D1 database named `heading-south-events-preview`.
2. Run `db/schema.sql` in that database's console. This creates the empty `schedule` table; it does not copy another band's shows.
3. In **Workers & Pages > headingsouthtribute > Settings > Bindings**, select the **Preview** environment and add a D1 binding named `EVENTS_DB` pointing to that new database.
4. In **Settings > Variables and Secrets**, select **Preview** and add an encrypted secret named `ADMIN_TOKEN`. Generate a unique random key with at least 32 characters using a password manager. Store it privately and give it only to the authorized manager. Never paste it into Git, issues, or chat.
5. Redeploy the feature branch after adding the binding and secret. The build command remains `exit 0`, output `public`; the root `functions/` directory is deployed by Cloudflare Pages.
6. Open the feature preview's `/admin/`, sign in, check the starting Long Beach show, and select Save schedule to initialize D1. Reopen Events and confirm it is visible. Test a draft and verify it stays private.

Preview activation does not require DNS or a custom domain. The preview URL is publicly readable; manager reads/writes require its key. `noindex` is not access control.

## Production activation - only after approval

Create a different D1 database (`heading-south-events-production`) and a different encrypted `ADMIN_TOKEN` in the **Production** environment. Bind it as `EVENTS_DB` and initialize with the same schema. Merge/redeploy only after preview acceptance and explicit production approval. Preview records do not transfer automatically. Sign in and save the approved starting schedule separately. Do not attach either environment to a Staples database.

## Local development and checks

- `node --test tests/events.test.js` verifies the API against an in-memory SQLite adapter, including authorization, filtering, input validation, revisions, venue persistence, and the venue-less debut.
- `node scripts/serve.mjs` serves static assets only; API saves require Cloudflare Pages Functions and a D1 binding.
- For full local Cloudflare development, install Wrangler, use `wrangler pages dev public --d1 EVENTS_DB`, initialize its local D1 database from `db/schema.sql`, and set a throwaway local `ADMIN_TOKEN` in ignored `.dev.vars`. Never reuse the live key locally.

Public Events and the homepage refresh on load, when returning to the tab, and hourly. Until the first database save, they use `public/data/events.json` containing only the approved Long Beach announcement. An explicitly saved empty schedule stays empty. If the API is unavailable, the Events page explains that the last available announcement is being shown.

No credentials or Cloudflare account identifiers are tracked. Configuration reference: https://developers.cloudflare.com/pages/functions/bindings/

## Show history and private notes

The same schedule database retains dated shows after they pass. In the signed-in manager, use **Download past shows (CSV)** to export the saved records before today's Pacific date. The file includes private booking notes, so store it privately. The export does not include unsaved changes. Removing a show removes it from future exports.

Use **Private booking notes (manager only)** for booking contacts and other internal details. Use **Public show details** for visitor-facing information. The public endpoint uses an explicit field allowlist and never includes private notes. Existing records default to blank private notes; no D1 migration is needed. Reload open manager tabs after deploying.

The manager currently edits shows and venues. About, Music, and Gallery are site content and would need a separate editor with approved content and media requirements.

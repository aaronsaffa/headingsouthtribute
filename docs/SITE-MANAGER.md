# Site manager development preview

The expanded manager lives at `/admin/` on `codex/site-manager`. No R2 bucket is required to review the interface. The existing Shows workflow and schedule table are unchanged.

## Try it locally

Run `npm start`, then open http://127.0.0.1:4173/admin/ and select **Explore preview**. No manager key is required. This mode never calls a write API and does not load private shows. Gallery, Music, and Site Details drafts save in this browser using IndexedDB. Preview mode hides Publish and Restore controls. The modal previews use the same content renderer as the public text/music pages.

Photos can be selected in batches (JPG, PNG, WebP, maximum 12 MB each, up to 30 photos). The browser produces WebP previews up to 1920 pixels on the longest edge. Add descriptions for visible images, optional captions, reorder, and toggle visibility. Save browser draft to retain these previews on this device. Keep original images separately; browser drafts are not backups and do not sync across devices. Preview drafts and signed-in gallery drafts use separate storage keys.

SoundCloud entries need public track or playlist URLs and a title. Private share links and URLs with query parameters are rejected. Players load only on an explicit click, with autoplay disabled. Visitor playback depends on SoundCloud and the uploader's embedding permissions.

## Enable text and music saves on the Cloudflare review branch

1. Keep using the Heading South Preview environment's own `EVENTS_DB` and `ADMIN_TOKEN` bindings described in SHOW-MANAGER.md.
2. Run **db/content-schema.sql** in the **preview** D1 database. It adds a separate `site_content` table without modifying the schedule. Do not run it against another project's database.
3. Deploy this development branch to a Cloudflare Pages review deployment. Framework None, build `exit 0`, output `public`.
4. Sign in with the existing Heading South preview manager key. Music, About, Contact, and Follow each have independent draft/publication revisions. Save draft retains edits privately; Publish updates that page on the review deployment. Restore previous swaps to the previous published version and replaces the draft. It can restore the original unconfigured page after a first publication.
5. Verify that drafts and hidden tracks never appear at `/api/content`, then review the public pages at desktop/mobile sizes. The public pages retain their existing approved HTML when the endpoint is unavailable or content has never been published. Published changes appear on the next page load.

If the content table is missing, the manager explains the setup requirement and disables server saves. The show manager still works. Content previews and local gallery drafts remain available. No fictional content is seeded.

## R2 integration deferred

Gallery publishing is deliberately disabled. There is no upload request, R2 binding, hosted media URL, or public gallery change in this phase. Browser image previews are never sent to D1. Connecting R2 later requires authenticated upload/serving endpoints, server-side file validation and limits, durable media IDs and gallery metadata, and a publish workflow that uploads all selected files successfully before exposing them publicly. Removing a photo from a draft should remain separate from deleting a stored original. Do not connect a bucket from another project.

Use separate preview and production media/storage configurations. Production deployment, DNS, and the custom domain remain subject to explicit launch approval. The branch review URL is publicly readable unless Cloudflare access protection is configured; manager writes and private draft reads require the manager key. Explore preview is intentionally public and only edits browser-local data.

## Verification

Use Node 22.13 or newer and run `npm test` for API isolation, authorization, revision conflicts, restore behavior, validation, and the existing schedule regressions. The November 22 implementation passed all 10 tests using Node 24.22.3. `npm start` is a static preview server; authenticated API writes require Cloudflare Pages Functions/D1 and the schema above. You can pass a different port with `npm start -- 4174`.

Browser checks covered Gallery file selection/resizing, descriptions, browser-draft saving and persistence after reload; SoundCloud entry editing, draft persistence and modal rendering; About text preview; and cleanup of all temporary test content. Reviewed the interface at 390 × 844 and 1280 × 900, with no horizontal overflow at the mobile breakpoint. Live SoundCloud playback, actual phone behavior, and Cloudflare database bindings still need verification in the review environment.

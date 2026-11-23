# Site manager development preview

The expanded manager lives at `/admin/` on `codex/site-manager`. No R2 bucket is required to review the interface in browser preview mode. Signed-in photo publishing uses R2 and a separate D1 gallery table. The existing Shows workflow and schedule table are unchanged.

## Try it locally

Run `npm start`, then open http://127.0.0.1:4173/admin/ and select **Explore preview**. No manager key is required. This mode never calls a write API and does not load private shows. Gallery, Music, and Site Details drafts save in this browser using IndexedDB. Preview mode hides Publish and Restore controls. The modal previews use the same content renderer as the public text/music pages.

Photos can be selected in batches (JPG, PNG, WebP, maximum 12 MB each, up to 100 photos). The browser produces WebP previews up to 1920 pixels on the longest edge. Optimized uploads are limited to 2 MB per photo, 10 new photos per publication, and 12 MB per batch. Add descriptions for visible images, optional captions, reorder, and toggle visibility. Save browser draft to retain these previews on this device. Keep original images separately; browser drafts are not backups and do not sync across devices. Preview drafts and signed-in gallery drafts use separate storage keys.

SoundCloud entries need public track or playlist URLs and a title. Private share links and URLs with query parameters are rejected. Players load only on an explicit click, with autoplay disabled. Visitor playback depends on SoundCloud and the uploader's embedding permissions.

## Enable text and music saves on the Cloudflare review branch

1. Keep using the Heading South Preview environment's own `EVENTS_DB` and `ADMIN_TOKEN` bindings described in SHOW-MANAGER.md.
2. Authenticated manager access initializes the separate `site_content` table without modifying the schedule. `db/content-schema.sql` is retained as a manual setup reference. Do not run it against another project's database.
3. Deploy this development branch to a Cloudflare Pages review deployment. Framework None, build `exit 0`, output `public`.
4. Sign in with the existing Heading South preview manager key. Music, About, Contact, and Follow each have independent draft/publication revisions. Save draft retains edits privately; Publish updates that page on the review deployment. Restore previous swaps to the previous published version and replaces the draft. It can restore the original unconfigured page after a first publication.
5. Verify that drafts and hidden tracks never appear at `/api/content`, then review the public pages at desktop/mobile sizes. The public pages retain their existing approved HTML when the endpoint is unavailable or content has never been published. Published changes appear on the next page load.

If content storage is unavailable, the manager explains the setup requirement and disables server saves. The show manager still works independently. Content previews and local gallery drafts remain available. No fictional content is seeded.

## R2 gallery publishing

Gallery publishing requires a private R2 bucket binding named `GALLERY_BUCKET`, separate for each environment. Photo batches are validated and uploaded before a conditional D1 metadata save makes the new gallery public. Failed uploads leave the previous gallery live. Photos are served through `/media/gallery/<content-hash>.webp`; gallery listings come from `/api/gallery`. Removing a photo does not permanently delete the stored file. See [GALLERY-STORAGE.md](GALLERY-STORAGE.md) for setup, workflow, and storage details. No GitHub upload token or site rebuild is needed.

Use separate preview and production media/storage configurations. The user approved production deployment in the chat; complete storage configuration and verification before rollout. DNS and custom-domain changes remain separate if not already configured. The branch review URL is publicly readable unless Cloudflare access protection is configured; manager writes and private reads require the manager key. Explore preview is intentionally public and only edits browser-local data.

## Verification

Use Node 22.13 or newer and run `npm test` for API isolation, authorization, revision conflicts, restore behavior, validation, and the existing schedule regressions. The November 22 implementation passed all 10 tests using Node 24.22.3. `npm start` is a static preview server; authenticated API writes require Cloudflare Pages Functions/D1 and the schema above. You can pass a different port with `npm start -- 4174`.

Browser checks covered Gallery file selection/resizing, descriptions, browser-draft saving and persistence after reload; SoundCloud entry editing, draft persistence and modal rendering; About text preview; and cleanup of all temporary test content. Reviewed the interface at 390 × 844 and 1280 × 900, with no horizontal overflow at the mobile breakpoint. Live SoundCloud playback, actual phone behavior, and Cloudflare database bindings still need verification in the review environment.

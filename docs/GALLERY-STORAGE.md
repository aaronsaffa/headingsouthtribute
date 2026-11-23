# Heading South gallery storage

Gallery photos are stored in Cloudflare R2. Gallery metadata, captions, order, and visibility are stored in a separate `gallery_state` table in the existing environment-specific Heading South D1 database. Authenticated manager access initializes this table without changing schedule data. `db/gallery-schema.sql` is a manual reference.

## Cloudflare setup

Use only the Heading South account/project and dedicated storage. Create two **private** R2 buckets:

| Pages environment | Bucket | Binding name |
| --- | --- | --- |
| Preview | `heading-south-gallery-preview` | `GALLERY_BUCKET` |
| Production | `heading-south-gallery-production` | `GALLERY_BUCKET` |

In **Workers & Pages > headingsouthtribute > Settings > Bindings**, select each environment and add an **R2 bucket** binding named `GALLERY_BUCKET` pointing to its bucket. Keep the existing `EVENTS_DB` and encrypted `ADMIN_TOKEN` for that environment. Preview and production must have separate databases, manager keys, and media buckets. If R2 has not been enabled, the account owner may need to complete its billing setup.

Redeploy after adding bindings. Pages settings remain framework None, build `exit 0`, output `public`. No public bucket URL, S3 API key, GitHub token, or DNS change is required. If settings from the abandoned GitHub prototype were added, `GALLERY_GITHUB_TOKEN` and `GALLERY_BRANCH` are unused and can be removed.

## Client workflow

Sign in at `/admin/`, choose Gallery, select photos, and enter image descriptions for visible images. Captions are optional. Reorder and hide photos as needed. Save browser draft retains edits on this device; Preview shows the draft without publishing. Publish gallery saves the photo batch and updates the gallery for visitors on their next page load, without rebuilding the site. The manager checks the public response before showing that the gallery is live.

Source files may be JPG, PNG, or WebP up to 12 MB. The browser converts them to WebP at most 1920 pixels wide/tall. Upload limits are 2 MB per optimized photo, 10 new photos and 12 MB total per batch, and 100 photos per gallery. Keep originals separately. Original filenames and embedded image metadata are not stored.

## Integrity and recovery

The server validates the whole batch before writing photos, including the still-WebP container and dimensions. Photos have content-hash IDs and use immutable R2 object paths. After successful uploads, one conditional D1 write publishes metadata; a competing edit is rejected rather than overwritten. Failed/conflicting batches can leave unused R2 objects, but do not replace the current gallery. Reload saved gallery before retrying if a response cannot be confirmed.

The manager never permanently deletes objects. Removing/hiding photos takes them out of the public gallery listing; previously shared direct image URLs can remain accessible. Hidden photos are not private storage. Browser drafts are separate from the published gallery and can be lost when browser data is cleared.

## Final environment verification

Test an approved photo upload in the preview environment, reload, reorder, hide, and remove it; check the public Gallery page and image response. Verify missing bindings disable publishing clearly. Do not seed invented band imagery. Production deployment is authorized in the chat, but live upload verification still needs correctly configured Cloudflare bindings. No changes to another project or DNS are part of this integration.

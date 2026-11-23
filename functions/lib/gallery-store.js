import { emptyGallery, validateGallery, photoSource } from '../../public/assets/gallery-core.js';
import { GalleryError } from './gallery-error.js';
import { validateWebp } from './image-validation.js';
export { GalleryError } from './gallery-error.js';
export const galleryConfigured = env => Boolean(env.GALLERY_BUCKET && env.EVENTS_DB);
export const GALLERY_SCHEMA = 'CREATE TABLE IF NOT EXISTS gallery_state (id INTEGER PRIMARY KEY CHECK (id = 1), gallery TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)';
export async function readGallery(db) {
  const row = await db.prepare('SELECT gallery, revision FROM gallery_state WHERE id = 1').first();
  return row ? { revision: row.revision, gallery: validateGallery(JSON.parse(row.gallery)) } : { revision: 0, gallery: emptyGallery() };
}
export async function publishGallery({ db, bucket, revision, metadata, files }) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new GalleryError('Reload the saved gallery before publishing.');
  const current = await readGallery(db);
  if (revision !== current.revision) throw new GalleryError('The gallery changed in another tab. Reload the saved gallery before publishing.', 409);
  let input;
  try { input = validateGallery(metadata, { allowFiles: true }); } catch (error) { throw new GalleryError(error.message); }
  const known = new Set(current.gallery.photos.map(photo => photo.id));
  const assets = new Map(), usedFiles = new Set();
  let total = 0;
  const photos = [];
  for (const photo of input.photos) {
    let id = photo.id;
    if (photo.file !== null) {
      const file = files.get(photo.file);
      if (!file || typeof file.arrayBuffer !== 'function' || usedFiles.has(photo.file) || usedFiles.size >= 10) throw new GalleryError('Publish up to 10 new photos at a time. Choose each new photo once.');
      usedFiles.add(photo.file);
      if (file.size > 2 * 1024 * 1024) throw new GalleryError('Each optimized photo must be under 2 MB.');
      total += file.size;
      if (total > 12 * 1024 * 1024) throw new GalleryError('Publish a smaller batch, up to 12 MB of optimized photos.');
      const bytes = new Uint8Array(await file.arrayBuffer()); validateWebp(bytes);
      id = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      assets.set(id, bytes);
    } else if (!known.has(id)) throw new GalleryError('A saved photo is missing. Reload the gallery before publishing.');
    photos.push({ id, src: photoSource(id), caption: photo.caption, alt: photo.alt, visible: photo.visible });
  }
  if (files.size !== usedFiles.size) throw new GalleryError('The upload contains unexpected files. Choose the photos again.');
  let gallery;
  try { gallery = validateGallery({ version: 1, publication: crypto.randomUUID(), photos }); } catch (error) { throw new GalleryError(error.message); }
  // Upload the validated batch first. A failed upload never changes the live manifest.
  // Content-addressed objects are immutable; failed/conflicting batches may leave unused objects.
  for (const [id, bytes] of assets) {
    const stored = await bucket.put(`gallery/${id}.webp`, bytes, { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
    if (!stored) throw new GalleryError('A photo could not be stored. Your previous gallery is still live.', 503);
  }
  // Check saved images too, before committing metadata that would advertise missing files.
  for (const id of new Set(photos.map(photo => photo.id))) {
    if (!assets.has(id) && !await bucket.head(`gallery/${id}.webp`)) throw new GalleryError('A saved photo is missing from storage. Reload the gallery and choose that photo again.', 409);
  }
  const payload = JSON.stringify(gallery);
  const result = revision === 0
    ? await db.prepare('INSERT OR IGNORE INTO gallery_state (id, gallery, revision) VALUES (1, ?, 1)').bind(payload).run()
    : await db.prepare('UPDATE gallery_state SET gallery = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(payload, revision).run();
  if (!result.meta.changes) throw new GalleryError('The gallery changed while photos were uploading. Reload the saved gallery before publishing again.', 409);
  return { revision: revision + 1, gallery };
}

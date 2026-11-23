import { authorized } from '../lib/auth.js';
import { galleryConfigured, GALLERY_SCHEMA, readGallery, publishGallery, GalleryError } from '../lib/gallery-store.js';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const LIMIT = 13 * 1024 * 1024;
async function limitedBody(request) {
  if (Number(request.headers.get('Content-Length')) > LIMIT) throw new GalleryError('Publish a smaller batch of photos.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GalleryError('Choose photos before publishing.');
  let length = 0; const chunks = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > LIMIT) { await reader.cancel(); throw new GalleryError('Publish a smaller batch of photos.', 413); }
    chunks.push(value);
  }
  return new Blob(chunks);
}
export async function onRequest({ request, env }) {
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  const admin = request.method === 'POST' || new URL(request.url).searchParams.get('admin') === '1';
  if (admin && !await authorized(request, env.ADMIN_TOKEN)) return json({ error: 'Sign in with the manager key.' }, 401);
  if (!galleryConfigured(env)) return request.method === 'GET'
    ? admin ? json({ configured: false, message: 'Connect this environment’s GALLERY_BUCKET R2 binding to enable gallery publishing. Browser drafts and previews are available.' }) : json({ error: 'Gallery storage is not connected.' }, 503)
    : json({ error: 'Gallery publishing is not connected to R2 yet.' }, 503);
  try {
    if (admin) await env.EVENTS_DB.prepare(GALLERY_SCHEMA).run();
    if (request.method === 'GET') {
      const { revision, gallery } = await readGallery(env.EVENTS_DB);
      return json(admin ? { configured: true, revision, gallery } : { gallery: { ...gallery, photos: gallery.photos.filter(photo => photo.visible) } });
    }
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed.' }, 403);
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return json({ error: 'Send a photo batch.' }, 415);
    const body = await limitedBody(request);
    const form = await new Response(body, { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData();
    let metadata;
    try { metadata = JSON.parse(form.get('metadata')); } catch { throw new GalleryError('The gallery details are not valid.'); }
    const files = new Map();
    for (const [name, value] of form) {
      if (['metadata', 'revision'].includes(name)) { if (form.getAll(name).length !== 1 || typeof value !== 'string') throw new GalleryError('Send one set of gallery details.'); continue; }
      if (!/^photo-\d{1,3}$/.test(name) || files.has(name) || typeof value === 'string') throw new GalleryError('The upload contains unexpected files.');
      files.set(name, value);
    }
    const rawRevision = form.get('revision');
    if (typeof rawRevision !== 'string' || !/^\d+$/.test(rawRevision)) throw new GalleryError('Reload the saved gallery before publishing.');
    const result = await publishGallery({ db: env.EVENTS_DB, bucket: env.GALLERY_BUCKET, revision: Number(rawRevision), metadata, files });
    return json(result);
  } catch (error) {
    if (error instanceof GalleryError) return json({ error: error.message }, error.status);
    return json({ error: 'Gallery storage is unavailable. Your last published gallery is unchanged unless the save completed; reload saved content before trying again.' }, 503);
  }
}

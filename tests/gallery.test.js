import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/gallery.js';
import { onRequest as mediaRequest } from '../functions/media/gallery/[id].js';
import { GALLERY_SCHEMA, publishGallery, readGallery } from '../functions/lib/gallery-store.js';
import { validateWebp } from '../functions/lib/image-validation.js';
import { photoSource, emptyGallery } from '../public/assets/gallery-core.js';

// Container fixture for testing upload boundaries; never written to a real bucket.
function webp(width = 1, height = 1) {
  const bytes = Buffer.alloc(30); bytes.write('RIFF'); bytes.writeUInt32LE(22, 4); bytes.write('WEBP', 8); bytes.write('VP8 ', 12); bytes.writeUInt32LE(10, 16);
  bytes.set([0, 0, 0, 0x9d, 1, 0x2a], 20); bytes.writeUInt16LE(width, 26); bytes.writeUInt16LE(height, 28); return bytes;
}
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const objects = new Map();
  const db = { prepare(sql) {
    let args = []; return {
      bind(...values) { args = values; return this; },
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; }
    };
  } };
  const bucket = {
    async put(key, bytes, options) { objects.set(key, { bytes: new Uint8Array(bytes), options }); return { key }; },
    async head(key) { const obj = objects.get(key); return obj ? { httpEtag: '"fixture"', size: obj.bytes.length } : null; },
    async get(key) { const obj = objects.get(key); return obj ? { httpEtag: '"fixture"', body: new Blob([obj.bytes]).stream() } : null; }
  };
  const env = { EVENTS_DB: db, GALLERY_BUCKET: bucket, ADMIN_TOKEN: 'gallery-fixture-only-'.repeat(3) };
  const request = async ({ method = 'GET', admin = false, token = env.ADMIN_TOKEN, body, origin, headers = {} } = {}) => {
    if (token) headers.Authorization = `Bearer ${token}`; if (origin) headers.Origin = origin;
    const response = await onRequest({ env, request: new Request(`https://test.local/api/gallery${admin ? '?admin=1' : ''}`, { method, headers, body }) });
    return { status: response.status, data: await response.json() };
  };
  return { sqlite, db, bucket, objects, env, request };
}
function batch(revision = 0, { visible = true, bytes = webp(), alt = 'Fixture image', id = '', file = 'photo-0' } = {}) {
  const form = new FormData(); form.set('revision', String(revision));
  form.set('metadata', JSON.stringify({ version: 1, publication: '', photos: [{ id, file, visible, alt, caption: 'Fixture caption' }] }));
  if (file) form.set(file, new Blob([bytes], { type: 'image/webp' }), 'fixture.webp');
  return form;
}

test('gallery requires auth for private reads and writes; authenticated login initializes its own table', async () => {
  const f = fixture();
  try {
    assert.equal((await f.request({ admin: true, token: '' })).status, 401);
    assert.equal((await f.request({ method: 'POST', token: '', body: batch() })).status, 401);
    assert.equal((await f.request({ method: 'DELETE' })).status, 405);
    const loaded = await f.request({ admin: true });
    assert.equal(loaded.status, 200); assert.equal(loaded.data.revision, 0); assert.equal(loaded.data.configured, true);
    assert.deepEqual(loaded.data.gallery, emptyGallery());
    const publicResult = await f.request({ token: '' });
    assert.equal(publicResult.status, 200); assert.ok(!('revision' in publicResult.data));
    assert.equal((await f.request({ method: 'POST', body: batch(), origin: 'https://evil.test' })).status, 403);
    assert.equal(f.objects.size, 0);
  } finally { f.sqlite.close(); }
});

test('R2 publication is live after a single metadata commit; hidden metadata stays out of public responses', async () => {
  const f = fixture();
  try {
    const saved = await f.request({ method: 'POST', body: batch() });
    assert.equal(saved.status, 200); assert.equal(saved.data.revision, 1); assert.equal(saved.data.gallery.photos.length, 1);
    const photo = saved.data.gallery.photos[0]; assert.match(photo.id, /^[a-f0-9]{64}$/); assert.equal(photo.src, photoSource(photo.id));
    assert.equal(f.objects.size, 1); assert.equal([...f.objects.values()][0].options.httpMetadata.contentType, 'image/webp');
    const live = (await f.request({ token: '' })).data.gallery;
    assert.equal(live.publication, saved.data.gallery.publication);
    const hidden = await f.request({ method: 'POST', body: batch(1, { id: photo.id, file: null, visible: false }) });
    assert.equal(hidden.status, 200); assert.equal((await f.request({ token: '' })).data.gallery.photos.length, 0);
    assert.equal((await f.request({ admin: true })).data.gallery.photos.length, 1);
    assert.equal((await f.request({ method: 'POST', body: batch(1) })).status, 409);
    assert.equal(f.objects.size, 1);
    const empty = new FormData(); empty.set('revision', '2'); empty.set('metadata', JSON.stringify(emptyGallery()));
    assert.equal((await f.request({ method: 'POST', body: empty })).status, 200);
    assert.equal((await f.request()).data.gallery.photos.length, 0);
    assert.equal(f.objects.size, 1, 'Removing a photo does not permanently delete its stored object');
  } finally { f.sqlite.close(); }
});

test('invalid batches are rejected before storage writes', async () => {
  const f = fixture();
  try {
    for (const options of [{ bytes: Buffer.from('<svg onload="alert(1)">') }, { bytes: webp(3000, 1) }, { alt: '' }, { bytes: Buffer.alloc(2 * 1024 * 1024 + 1) }]) {
      assert.equal((await f.request({ method: 'POST', body: batch(0, options) })).status, 400);
      assert.equal(f.objects.size, 0);
    }
    const extra = batch(); extra.set('bad-path', new Blob(['unexpected']), 'extra.webp');
    assert.equal((await f.request({ method: 'POST', body: extra })).status, 400);
    const tooLarge = await f.request({ method: 'POST', body: batch(), headers: { 'Content-Length': String(14 * 1024 * 1024) } });
    assert.equal(tooLarge.status, 413);
    const malformed = batch(); malformed.set('revision', 'not-a-revision');
    assert.equal((await f.request({ method: 'POST', body: malformed })).status, 400);
    assert.equal(f.objects.size, 0);
  } finally { f.sqlite.close(); }
});

test('storage failures and racing saves preserve the live gallery', async () => {
  const f = fixture();
  try {
    await f.db.prepare(GALLERY_SCHEMA).run();
    const metadata = { ...emptyGallery(), photos: [{ id: '', file: 'photo-0', visible: true, alt: 'Fixture', caption: '' }] };
    const files = new Map([['photo-0', new Blob([webp()])]]);
    await assert.rejects(publishGallery({ db: f.db, bucket: { async put() { throw new Error('fixture failure'); } }, revision: 0, metadata, files }));
    assert.equal((await readGallery(f.db)).revision, 0);
    const competing = { ...emptyGallery(), publication: 'competing-publication' };
    const racingBucket = { ...f.bucket, async put(...args) {
      f.sqlite.prepare('INSERT INTO gallery_state (id, gallery, revision) VALUES (1, ?, 1)').run(JSON.stringify(competing));
      return f.bucket.put(...args);
    } };
    await assert.rejects(publishGallery({ db: f.db, bucket: racingBucket, revision: 0, metadata, files }), error => error.status === 409);
    assert.equal((await readGallery(f.db)).gallery.publication, 'competing-publication');
  } finally { f.sqlite.close(); }
});

test('media route restricts object paths and returns WebP headers, ETags, and HEAD responses', async () => {
  const f = fixture();
  const id = 'a'.repeat(64) + '.webp';
  const get = (name, options) => mediaRequest({ env: f.env, params: { id: name }, request: new Request(`https://test.local/media/gallery/${id}`, options) });
  try {
    await f.bucket.put(`gallery/${id}`, webp());
    const result = await get(id); assert.equal(result.status, 200); assert.equal(result.headers.get('Content-Type'), 'image/webp');
    assert.equal(result.headers.get('X-Content-Type-Options'), 'nosniff'); assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array(webp()));
    assert.equal((await get(id, { headers: { 'If-None-Match': '"fixture"' } })).status, 304);
    assert.equal(await (await get(id, { method: 'HEAD' })).text(), '');
    assert.equal((await get('../private')).status, 404); assert.equal((await get('b'.repeat(64) + '.webp')).status, 404);
    assert.equal((await get(id, { method: 'POST' })).status, 405);
    assert.throws(() => validateWebp(Buffer.from('not a photo')));
  } finally { f.sqlite.close(); }
});

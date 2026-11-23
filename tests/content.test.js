import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/content.js';
import { defaults, validateContent } from '../public/assets/content-core.js';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../db/content-schema.sql', import.meta.url), 'utf8'));
  const env = { ADMIN_TOKEN: 'test-only-manager-key-'.repeat(3), EVENTS_DB: { prepare(sql) {
    let parameters = [];
    return { bind(...values) { parameters = values; return this; },
      async first() { return db.prepare(sql).get(...parameters) || null; },
      async run() { return { meta: { changes: Number(db.prepare(sql).run(...parameters).changes) } }; }
    };
  } } };
  return { db, async request({ method = 'GET', body, admin = false, token = env.ADMIN_TOKEN, origin, type = 'application/json' } = {}) {
    const headers = { 'Content-Type': type }; if (token) headers.Authorization = `Bearer ${token}`; if (origin) headers.Origin = origin;
    const response = await onRequest({ env, request: new Request(`https://test.local/api/content${admin ? '?admin=1' : ''}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }) });
    return { status: response.status, data: await response.json() };
  } };
}

test('content validation restricts embeds, public links, and contact fields', () => {
  const track = { title: 'Fixture track', url: 'https://soundcloud.com/test/fixture-track', visible: true };
  assert.equal(validateContent('music', { tracks: [track] }).tracks.length, 1);
  for (const url of ['javascript:alert(1)', 'https://soundcloud.com.evil.test/user/track', 'https://user:pass@soundcloud.com/user/track', 'https://soundcloud.com/user/track?secret_token=abc', 'https://soundcloud.com/user/track/s-secret', 'https://soundcloud.com/user', 'http://soundcloud.com/user/track']) assert.throws(() => validateContent('music', { tracks: [{ ...track, url }] }));
  assert.throws(() => validateContent('contact', { intro: '', email: 'bad\nemail@test.local', phone: '' }));
  assert.throws(() => validateContent('follow', { ...defaults().follow, instagram: 'https://evil.test/' }));
  assert.equal(validateContent('about', { text: '<script>literal text only</script>' }).text, '<script>literal text only</script>');
});

test('drafts stay private, publications filter hidden music, sections save independently, and stale edits fail', async () => {
  const { db, request } = fixture();
  const music = { tracks: [{ title: 'Fixture public track', url: 'https://soundcloud.com/test/one', visible: true }, { title: 'Fixture hidden track', url: 'https://soundcloud.com/test/two', visible: false }] };
  try {
    assert.equal((await request()).data.sections.music, null);
    assert.equal((await request({ admin: true, token: '' })).status, 401);
    assert.equal((await request({ method: 'PUT', token: '', body: {} })).status, 401);
    assert.equal((await request({ method: 'PUT', body: {}, origin: 'https://evil.test' })).status, 403);
    assert.equal((await request({ method: 'PUT', body: {}, type: 'text/plain' })).status, 415);
    assert.equal((await request({ method: 'POST' })).status, 405);
    const save = (section, content, revision, action = 'save') => request({ method: 'PUT', body: { section, content, revision, action } });
    assert.equal((await save('music', music, 0)).status, 200);
    assert.equal((await request()).data.sections.music, null);
    assert.equal((await request({ admin: true })).data.sections.music.draft.tracks.length, 2);
    assert.equal((await save('music', music, 0, 'publish')).status, 409);
    assert.equal((await save('about', { text: 'Fixture biography' }, 0, 'publish')).status, 200);
    assert.equal((await save('music', music, 1, 'publish')).data.revision, 2);
    const published = (await request()).data;
    assert.equal(published.sections.music.tracks.length, 1);
    assert.ok(!JSON.stringify(published).includes('Fixture hidden track'));
    assert.ok(!JSON.stringify(published).includes('canRestore'));
    assert.equal(published.sections.about.text, 'Fixture biography');
    assert.equal((await save('music', { tracks: [] }, 2, 'save')).status, 200);
    assert.equal((await request()).data.sections.music.tracks.length, 1);
    assert.equal((await save('music', { tracks: [] }, 3, 'publish')).status, 200);
    assert.equal((await request()).data.sections.music.tracks.length, 0);
    assert.equal((await save('music', undefined, 4, 'restore')).status, 200);
    assert.equal((await request()).data.sections.music.tracks.length, 1);
    assert.equal((await save('about', undefined, 1, 'restore')).status, 200);
    assert.equal((await request()).data.sections.about, null, 'Restore the original unconfigured page');
    assert.equal((await save('about', undefined, 2, 'restore')).status, 200);
    assert.equal((await request()).data.sections.about.text, 'Fixture biography');
    assert.equal((await save('gallery', { photos: [] }, 0)).status, 400, 'Gallery cannot publish local files');
    assert.equal((await save('contact', { intro: '', email: 'bad', phone: '' }, 0)).status, 400);
    assert.equal((await save('contact', undefined, 0, 'restore')).status, 400);
  } finally { db.close(); }
});

test('missing content schema fails safely without changing schedule storage', async () => {
  const response = await onRequest({ request: new Request('https://test.local/api/content'), env: { EVENTS_DB: { prepare() { throw new Error('no such table'); } } } });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /content-schema.sql/);
});

test('authenticated manager initializes its content table without modifying the schedule', async () => {
  const { db, request } = fixture();
  try {
    db.exec("DROP TABLE site_content; CREATE TABLE schedule (id INTEGER PRIMARY KEY, events TEXT); INSERT INTO schedule VALUES (1, 'fixture-existing-schedule');");
    const result = await request({ admin: true });
    assert.equal(result.status, 200);
    assert.equal(result.data.sections.about.revision, 0);
    assert.equal(db.prepare('SELECT events FROM schedule WHERE id = 1').get().events, 'fixture-existing-schedule');
    assert.equal((await request({ token: '' })).status, 200);
  } finally { db.close(); }
});

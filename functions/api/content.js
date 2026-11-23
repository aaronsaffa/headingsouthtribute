import { SECTIONS, validateContent, publicContent } from '../../public/assets/content-core.js';
import { authorized } from '../lib/auth.js';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function onRequest({ request, env }) {
  const admin = new URL(request.url).searchParams.get('admin') === '1';
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  if ((admin || request.method === 'PUT') && !await authorized(request, env.ADMIN_TOKEN)) return json({ error: 'Sign in with the manager key.' }, 401);
  if (!env.EVENTS_DB) return json({ error: 'Content storage is not connected. See docs/SITE-MANAGER.md.' }, 503);
  try {
    if (admin || request.method === 'PUT') await env.EVENTS_DB.prepare("CREATE TABLE IF NOT EXISTS site_content (section TEXT PRIMARY KEY CHECK (section IN ('music', 'about', 'contact', 'follow')), draft TEXT NOT NULL, published TEXT, previous TEXT, revision INTEGER NOT NULL DEFAULT 1)").run();
    if (request.method === 'GET') {
      const sections = {};
      for (const section of SECTIONS) {
        const row = await env.EVENTS_DB.prepare('SELECT draft, published, previous, revision FROM site_content WHERE section = ?').bind(section).first();
        sections[section] = admin ? row ? {
          draft: JSON.parse(row.draft), published: row.published ? JSON.parse(row.published) : null,
          canRestore: row.previous !== null, revision: row.revision
        } : { draft: null, published: null, canRestore: false, revision: 0 }
          : row?.published && JSON.parse(row.published) !== null ? publicContent(section, validateContent(section, JSON.parse(row.published))) : null;
      }
      return json({ sections });
    }
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed.' }, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
    if (Number(request.headers.get('Content-Length')) > 100000) return json({ error: 'Content is too large.' }, 413);
    const raw = await request.text();
    if (raw.length > 100000) return json({ error: 'Content is too large.' }, 413);
    let body, content;
    try {
      body = JSON.parse(raw);
      if (!SECTIONS.includes(body.section) || !['save', 'publish', 'restore'].includes(body.action) || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error('Reload this section before saving.');
      if (body.action !== 'restore') content = validateContent(body.section, body.content);
    } catch (error) { return json({ error: error.message }, 400); }
    const { section, revision, action } = body;
    const current = await env.EVENTS_DB.prepare('SELECT draft, published, previous, revision FROM site_content WHERE section = ?').bind(section).first();
    if ((current?.revision || 0) !== revision) return json({ error: 'This section changed in another tab. Reload saved content before saving again.' }, 409);
    if (action === 'restore' && (!current || current.previous === null)) return json({ error: 'No previous publication to restore.' }, 400);
    const draft = action === 'restore' ? current.previous : JSON.stringify(content);
    const published = action === 'save' ? current?.published ?? null : draft;
    // Keep the prior live version, including the original blank page, for one-step recovery.
    const previous = action === 'save' ? current?.previous ?? null : current?.published ?? JSON.stringify(null);
    const result = revision === 0
      ? await env.EVENTS_DB.prepare('INSERT OR IGNORE INTO site_content (section, draft, published, previous, revision) VALUES (?, ?, ?, ?, 1)').bind(section, draft, published, previous).run()
      : await env.EVENTS_DB.prepare('UPDATE site_content SET draft = ?, published = ?, previous = ?, revision = revision + 1 WHERE section = ? AND revision = ?').bind(draft, published, previous, section, revision).run();
    if (!result.meta.changes) return json({ error: 'This section changed. Reload before saving again.' }, 409);
    return json({ revision: revision + 1 });
  } catch {
    return json({ error: 'Content storage is unavailable. Apply db/content-schema.sql to this environment; the show manager is unaffected.' }, 503);
  }
}

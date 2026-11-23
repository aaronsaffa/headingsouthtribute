export async function onRequest({ request, env, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed.', { status: 405 });
  if (typeof params.id !== 'string' || !/^[a-f0-9]{64}\.webp$/.test(params.id)) return new Response('Not found.', { status: 404 });
  if (!env.GALLERY_BUCKET) return new Response('Photo storage is unavailable.', { status: 503 });
  try {
    const key = `gallery/${params.id}`;
    const object = request.method === 'HEAD' ? await env.GALLERY_BUCKET.head(key) : await env.GALLERY_BUCKET.get(key);
    if (!object) return new Response('Not found.', { status: 404 });
    const headers = { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: object.httpEtag };
    if (request.headers.get('If-None-Match') === object.httpEtag) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  } catch { return new Response('Photo storage is unavailable.', { status: 503 }); }
}

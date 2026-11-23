import { validateGallery } from './gallery-core.js';
import { renderContent } from './content-render.js';
const target = document.querySelector('main .content');
try {
  const response = await fetch('/api/gallery', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (response.ok) {
    const gallery = validateGallery((await response.json()).gallery);
    if (gallery.publication) {
      const heading = document.createElement('h1'); heading.textContent = 'Gallery';
      const body = document.createElement('div'); body.className = 'managed-content';
      renderContent(body, 'gallery', gallery); target.replaceChildren(heading, body);
    }
  }
} catch { /* Keep the existing page if its gallery manifest cannot be loaded. */ }

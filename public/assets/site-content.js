import { validateContent } from './content-core.js';
import { renderContent } from './content-render.js';

const section = location.pathname.split('/').pop().replace('.html', '');
const target = document.querySelector('main .content');
if (target && ['music', 'about', 'contact', 'follow'].includes(section)) {
  try {
    const response = await fetch('/api/content', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const result = await response.json();
      if (result.sections[section] !== null && result.sections[section] !== undefined) {
        const content = validateContent(section, result.sections[section]);
        const heading = document.createElement('h1'); heading.textContent = section === 'follow' ? 'Stay in touch' : section[0].toUpperCase() + section.slice(1);
        const body = document.createElement('div'); body.className = 'managed-content';
        renderContent(body, section, content); target.replaceChildren(heading, body);
      }
    }
  } catch { /* Keep the original approved page when storage is unavailable. */ }
}

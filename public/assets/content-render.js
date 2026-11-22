export function renderContent(target, section, content) {
  const el = (tag, value) => { const node = document.createElement(tag); if (value) node.textContent = value; return node; };
  const link = (title, url) => { const a = el('a', title); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  target.replaceChildren();
  if (section === 'music') {
    for (const track of content.tracks.filter(item => item.visible)) {
      const article = el('article'); article.append(el('h3', track.title));
      const load = el('button', 'Load SoundCloud player'); load.type = 'button';
      load.addEventListener('click', () => {
        const iframe = el('iframe'); iframe.title = `${track.title} — SoundCloud player`;
        iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&auto_play=false`;
        iframe.className = 'music-player'; iframe.allow = 'encrypted-media'; iframe.loading = 'lazy';
        load.replaceWith(iframe);
      }, { once: true });
      article.append(load, el('p')); article.lastChild.append(link('Listen on SoundCloud', track.url)); target.append(article);
    }
    if (!target.childElementCount) target.append(el('p', 'Music coming soon.'));
  } else if (section === 'about') {
    for (const paragraph of content.text.split(/\n\s*\n/).filter(Boolean)) target.append(el('p', paragraph));
    if (!target.childElementCount) target.append(el('p', 'Biography coming soon.'));
  } else if (section === 'contact') {
    for (const paragraph of content.intro.split(/\n\s*\n/).filter(Boolean)) target.append(el('p', paragraph));
    if (content.email) { const p = el('p'); const a = el('a', content.email); a.href = `mailto:${content.email}`; p.append(a); target.append(p); }
    if (content.phone) { const p = el('p'); const a = el('a', content.phone); a.href = `tel:${content.phone.replace(/[^+\d]/g, '')}`; p.append(a); target.append(p); }
    if (!target.childElementCount) target.append(el('p', 'Contact details coming soon.'));
  } else if (section === 'follow') {
    for (const [network, url] of Object.entries(content)) if (url) {
      const p = el('p'); p.append(link(network[0].toUpperCase() + network.slice(1), url)); target.append(p);
    }
    if (!target.childElementCount) target.append(el('p', 'Social links coming soon.'));
  } else if (section === 'gallery') {
    target.classList.add('photo-preview-grid');
    for (const photo of content.photos.filter(item => item.visible)) {
      const figure = el('figure'); const img = el('img'); img.src = photo.src; img.alt = photo.alt;
      figure.append(img); if (photo.caption) figure.append(el('figcaption', photo.caption)); target.append(figure);
    }
    if (!target.childElementCount) target.append(el('p', 'No visible photos in this draft.'));
  }
}

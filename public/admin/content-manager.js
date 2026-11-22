import { defaults, validateContent } from '../assets/content-core.js';
import { renderContent } from '../assets/content-render.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const item = document.createElement(tag); if (text) item.textContent = text; if (className) item.className = className; return item; };
const sections = ['music', 'about', 'contact', 'follow'];
const names = { music: 'Music', about: 'About', contact: 'Contact', follow: 'Follow', gallery: 'Gallery' };

// Files and browser-only drafts live outside localStorage. No manager credentials are persisted.
function browserDraft(key, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('heading-south-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onerror = () => reject(new Error('Browser draft storage is unavailable. Keep this tab open or enable site storage.'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('drafts', value === undefined ? 'readonly' : 'readwrite');
      const op = value === undefined ? tx.objectStore('drafts').get(key) : tx.objectStore('drafts').put(value, key);
      tx.oncomplete = () => { db.close(); resolve(op.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Could not save the browser draft. Storage may be full or disabled.')); };
    };
  });
}

export function initContentManager({ getKey }) {
  let preview = false, active = false, generation = 0, data = defaults(), photos = [], states = {}, dirty = new Set(), working = false;
  let galleryBusy = false;
  const say = text => { $('message').textContent = text; };
  const mark = section => { dirty.add(section); status(section, 'Unsaved changes'); };
  function status(section, text) { const out = document.querySelector(`[data-state="${section}"]`); if (out) out.textContent = text; }
  function releasePhotos() { for (const photo of photos) if (photo.src) URL.revokeObjectURL(photo.src); }
  function setButtons() {
    for (const button of document.querySelectorAll('[data-content-action]')) {
      const section = button.dataset.section, action = button.dataset.contentAction;
      button.disabled = working || (action !== 'preview' && !preview && states[section]?.revision === undefined) || (action === 'restore' && (preview || !states[section]?.canRestore));
    }
    for (const panel of ['gallery', 'music', 'details']) $(`${panel}-panel`).inert = working;
    document.querySelector('#gallery-panel button[title]').disabled = true;
  }
  async function api(method = 'GET', body) {
    const response = await fetch('/api/content?admin=1', { method, cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${getKey()}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => ({ error: 'Content storage is not available here. Use Explore preview to try the editors locally.' }));
    if (!response.ok) throw new Error(result.error || 'Could not connect to content storage.');
    return result;
  }
  function field(label, value, change, { type = 'text', max = 500, placeholder = '' } = {}) {
    const wrap = node('label', label); const input = node('input'); input.type = type; input.value = value;
    input.maxLength = max; input.placeholder = placeholder;
    input.addEventListener('input', () => change(input.value)); wrap.append(input); return wrap;
  }
  function button(label, action, disabled = false) { const b = node('button', label, 'secondary'); b.type = 'button'; b.disabled = disabled; b.addEventListener('click', action); return b; }
  function orderActions(items, index, section, render) {
    const actions = node('div', null, 'card-actions');
    const move = offset => { [items[index], items[index + offset]] = [items[index + offset], items[index]]; mark(section); render(); const cards = section === 'gallery' ? $('gallery-list') : $('music-list'); cards.children[index + offset]?.querySelector('button')?.focus(); };
    actions.append(button('Move up', () => move(-1), index === 0), button('Move down', () => move(1), index === items.length - 1), button('Remove', () => {
      if (!confirm(`Remove this ${section === 'gallery' ? 'photo from the draft' : 'music entry'}?`)) return;
      if (section === 'gallery') URL.revokeObjectURL(items[index].src);
      items.splice(index, 1); mark(section); render();
    })); return actions;
  }
  function visibleField(item, section) {
    const label = node('label', section === 'gallery' ? 'Show in gallery' : 'Show on music page', 'check');
    const input = node('input'); input.type = 'checkbox'; input.checked = item.visible;
    input.addEventListener('change', () => { item.visible = input.checked; mark(section); }); label.prepend(input); return label;
  }
  function renderMusic() {
    $('music-list').replaceChildren(); $('music-empty').hidden = data.music.tracks.length > 0;
    data.music.tracks.forEach((track, index) => {
      const card = node('article'); card.append(node('h3', `Music entry ${index + 1}`));
      const grid = node('div', null, 'grid');
      grid.append(field('Title', track.title, value => { track.title = value; mark('music'); }, { max: 160, placeholder: 'Track or playlist title' }), field('SoundCloud link', track.url, value => { track.url = value; mark('music'); }, { type: 'url', max: 1000, placeholder: 'https://soundcloud.com/…' }));
      card.append(grid, visibleField(track, 'music'), orderActions(data.music.tracks, index, 'music', renderMusic)); $('music-list').append(card);
    });
  }
  function renderGallery() {
    $('gallery-list').replaceChildren(); $('gallery-empty').hidden = photos.length > 0;
    $('gallery-count').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
    photos.forEach((photo, index) => {
      const card = node('article'); const image = node('img'); image.src = photo.src; image.alt = photo.alt || 'Selected photo preview';
      card.append(image, field('Caption (optional)', photo.caption, value => { photo.caption = value; mark('gallery'); }), field('Image description', photo.alt, value => { photo.alt = value; mark('gallery'); }, { placeholder: 'Describe the photo for someone who cannot see it' }), visibleField(photo, 'gallery'), orderActions(photos, index, 'gallery', renderGallery)); $('gallery-list').append(card);
    });
  }
  function fillDetails() {
    for (const [id, section, key] of [['about-text', 'about', 'text'], ['contact-intro', 'contact', 'intro'], ['contact-email', 'contact', 'email'], ['contact-phone', 'contact', 'phone']]) $(id).value = data[section][key];
    for (const name of Object.keys(data.follow)) $(`follow-${name}`).value = data.follow[name];
  }
  function showPanel(name) {
    for (const panel of ['schedule', 'gallery', 'music', 'details']) $(`${panel}-panel`).hidden = name !== panel;
    for (const b of document.querySelectorAll('[data-panel]')) { if (b.dataset.panel === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  }
  function showPreview(section) {
    try {
      const content = section === 'gallery' ? { photos } : validateContent(section, data[section]);
      $('preview-title').textContent = `${names[section]} preview`;
      $('preview-body').className = '';
      renderContent($('preview-body'), section, content); $('content-preview').showModal();
    } catch (error) { say(error.message); }
  }
  async function action(section, actionName) {
    if (working || !active) return;
    if (actionName === 'preview') { showPreview(section); return; }
    if (actionName === 'reload' && dirty.has(section) && !confirm(`Discard unsaved ${names[section]} edits and reload the saved draft?`)) return;
    if (actionName === 'restore' && !confirm('Restore the previous published version? This immediately changes this page on the website and replaces its current draft.')) return;
    if (actionName === 'publish' && !confirm(`Publish ${names[section]}? Visitors will see this version when they load the page. Blank fields and hidden entries will not appear.`)) return;
    working = true; setButtons(); const session = generation;
    try {
      if (preview) {
        if (actionName === 'reload') data[section] = await browserDraft(`preview-${section}`) || defaults()[section];
        else {
          data[section] = validateContent(section, data[section]);
          await browserDraft(`preview-${section}`, data[section]);
        }
        if (generation !== session) return;
        status(section, actionName === 'reload' ? 'Browser draft reloaded' : 'Saved in this browser only · website unchanged');
      } else {
        if (actionName !== 'reload') await api('PUT', { section, action: actionName, content: actionName === 'restore' ? undefined : validateContent(section, data[section]), revision: states[section].revision });
        const result = await api(); if (generation !== session) return;
        states[section] = result.sections[section];
        data[section] = states[section].draft || defaults()[section];
        status(section, actionName === 'save' ? 'Draft saved · not published' : actionName === 'publish' ? 'Published on the website' : actionName === 'restore' ? 'Previous version restored on the website' : 'Saved draft reloaded');
      }
      dirty.delete(section); renderMusic(); fillDetails();
    } catch (error) { if (generation === session) say(error.message); }
    finally { working = false; setButtons(); }
  }
  for (const section of sections) {
    const area = document.querySelector(`[data-content-actions="${section}"]`);
    const state = node('p', 'Sign in or explore preview to begin.', 'content-state'); state.dataset.state = section; state.setAttribute('role', 'status');
    const actions = node('div', null, 'actions');
    for (const [actionName, label] of [['save', 'Save draft'], ['preview', 'Preview'], ['publish', 'Publish'], ['reload', 'Reload saved'], ['restore', 'Restore previous']]) {
      const b = button(label, () => action(section, actionName));
      b.dataset.section = section; b.dataset.contentAction = actionName;
      if (['save', 'publish'].includes(actionName)) b.className = ''; actions.append(b);
    }
    area.append(actions, state);
  }
  for (const [id, section, key] of [['about-text', 'about', 'text'], ['contact-intro', 'contact', 'intro'], ['contact-email', 'contact', 'email'], ['contact-phone', 'contact', 'phone']]) $(id).addEventListener('input', () => { data[section][key] = $(id).value; mark(section); });
  for (const name of Object.keys(data.follow)) {
    const label = field(name[0].toUpperCase() + name.slice(1), '', value => { data.follow[name] = value; mark('follow'); }, { type: 'url', max: 1000 });
    label.querySelector('input').id = `follow-${name}`; $('social-fields').append(label);
  }
  document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  $('preview-close').addEventListener('click', () => $('content-preview').close());
  $('gallery-preview').addEventListener('click', () => showPreview('gallery'));
  $('music-add').addEventListener('click', () => {
    if (data.music.tracks.length >= 30) { say('Add up to 30 music entries.'); return; }
    data.music.tracks.push({ title: '', url: '', visible: true }); mark('music'); renderMusic(); $('music-list').lastElementChild.querySelector('input').focus();
  });
  $('gallery-files').addEventListener('change', async () => {
    const files = [...$('gallery-files').files]; $('gallery-files').value = '';
    if (galleryBusy) return;
    galleryBusy = true; $('gallery-files').disabled = true; $('gallery-save').disabled = true;
    const session = generation, errors = [];
    say('Preparing photo previews…');
    try {
      for (const file of files) {
        if (photos.length >= 30) { errors.push('The gallery supports up to 30 photos.'); break; }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) { errors.push(`${file.name}: use JPG, PNG, or WebP up to 12 MB.`); continue; }
        try {
          const bitmap = await createImageBitmap(file);
          const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .85));
          if (!blob) throw new Error('Image conversion failed.');
          if (generation !== session) return;
          photos.push({ blob, caption: '', alt: '', visible: true, src: URL.createObjectURL(blob) }); mark('gallery');
        } catch { errors.push(`${file.name}: this image could not be opened.`); }
      }
      if (generation === session) { renderGallery(); say(errors.length ? errors.join(' ') : 'Photos added to the draft. Add descriptions, then save the browser draft.'); }
    } finally { galleryBusy = false; $('gallery-files').disabled = false; $('gallery-save').disabled = false; }
  });
  $('gallery-save').addEventListener('click', async () => {
    if (galleryBusy || working || !active) return;
    if (photos.some(photo => photo.visible && !photo.alt.trim())) { say('Add an image description for each visible photo before saving.'); return; }
    const session = generation;
    working = true; setButtons();
    try {
      await browserDraft(preview ? 'preview-gallery' : 'manager-gallery', photos.map(({ src, ...photo }) => photo));
      if (generation !== session) return;
      dirty.delete('gallery'); say('Gallery draft saved in this browser only. Photo storage must be connected before publishing.');
    } catch (error) { say(error.message); }
    finally { working = false; setButtons(); }
  });
  window.addEventListener('beforeunload', event => { if (dirty.size || working || galleryBusy) { event.preventDefault(); event.returnValue = ''; } });
  async function open(isPreview) {
    const session = ++generation; active = true; preview = isPreview; data = defaults(); states = {}; dirty.clear(); releasePhotos(); photos = [];
    $('workspace-mode').textContent = preview ? 'BROWSER PREVIEW · WEBSITE UNCHANGED' : 'MANAGER';
    $('logout').textContent = preview ? 'Exit preview' : 'Sign out';
    $('schedule-preview-note').hidden = !preview; $('schedule-editor').hidden = preview;
    document.querySelectorAll('[data-content-action="publish"]').forEach(b => { b.hidden = preview; });
    document.querySelectorAll('[data-content-action="restore"]').forEach(b => { b.hidden = preview; });
    document.querySelectorAll('[data-content-action="save"]').forEach(b => { b.textContent = preview ? 'Save browser draft' : 'Save draft'; });
    working = true;
    showPanel(preview ? 'gallery' : 'schedule'); renderMusic(); fillDetails(); renderGallery(); setButtons();
    try {
      if (preview) {
        const loaded = await Promise.all(sections.map(section => browserDraft(`preview-${section}`)));
        if (generation !== session) return;
        sections.forEach((section, index) => { if (loaded[index]) data[section] = loaded[index]; status(section, loaded[index] ? 'Browser draft loaded · website unchanged' : 'Browser preview · nothing published'); });
      } else {
        const result = await api(); if (generation !== session) return;
        states = result.sections;
        for (const section of sections) { data[section] = states[section].draft || defaults()[section]; status(section, states[section].revision ? 'Saved draft loaded' : 'No saved content yet'); }
      }
    } catch (error) { if (generation === session) { say(error.message); for (const section of sections) status(section, 'Storage unavailable · preview edits only'); } }
    try {
      const saved = await browserDraft(preview ? 'preview-gallery' : 'manager-gallery'); if (generation !== session) return;
      photos = (saved || []).map(photo => ({ ...photo, src: URL.createObjectURL(photo.blob) }));
    } catch (error) { if (generation === session) say(error.message); }
    if (generation !== session) return;
    working = false; fillDetails(); renderMusic(); renderGallery(); setButtons();
  }
  $('explore').addEventListener('click', async () => {
    $('login-panel').hidden = true; $('manager').hidden = false;
    say('Browser preview. Nothing you do here changes the website.'); await open(true);
  });
  return {
    open,
    refresh: setButtons,
    canLeave() { if (working || galleryBusy) { say('Wait for the current operation to finish.'); return false; } return !dirty.size || confirm('Discard unsaved content edits and leave the manager? Saved browser drafts will remain on this device.'); },
    close() { ++generation; active = false; dirty.clear(); states = {}; data = defaults(); releasePhotos(); photos = []; $('content-preview').close(); renderMusic(); renderGallery(); fillDetails(); }
  };
}

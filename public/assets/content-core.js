export const SECTIONS = ['music', 'about', 'contact', 'follow'];
export const defaults = () => ({
  music: { tracks: [] }, about: { text: '' }, contact: { intro: '', email: '', phone: '' },
  follow: { instagram: 'https://www.instagram.com/headingsouthtribute/', facebook: '', youtube: '', tiktok: '', soundcloud: '' }
});
const text = (value, max = 2000) => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Use text of no more than ${max} characters.`);
  return value.trim();
};
export function httpsUrl(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!hosts || hosts.some(host => url.hostname === host || url.hostname === `www.${host}`));
  } catch { return false; }
}
export function validateContent(section, value) {
  if (!SECTIONS.includes(section) || !value || typeof value !== 'object') throw new Error('Choose a valid content section.');
  if (section === 'music') {
    if (!Array.isArray(value.tracks) || value.tracks.length > 30) throw new Error('Add up to 30 music entries.');
    return { tracks: value.tracks.map(track => {
      const title = text(track.title, 160), url = text(track.url, 1000);
      if (!title || !httpsUrl(url, ['soundcloud.com']) || new URL(url).pathname.split('/').filter(Boolean).length < 2 || new URL(url).search || new URL(url).hash || /\/s-[^/]+/.test(new URL(url).pathname)) throw new Error('Each entry needs a title and a public SoundCloud track or playlist link, without query parameters.');
      if (typeof track.visible !== 'boolean') throw new Error('Choose whether the music entry is visible.');
      return { title, url, visible: track.visible };
    }) };
  }
  if (section === 'about') return { text: text(value.text, 12000) };
  if (section === 'contact') {
    const email = text(value.email, 254), phone = text(value.phone, 50);
    if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Enter a valid public contact email.');
    if (phone && !/^[+\d\s().-]+$/.test(phone)) throw new Error('Use a phone number with digits and optional punctuation.');
    return { intro: text(value.intro, 3000), email, phone };
  }
  const hosts = { instagram: ['instagram.com'], facebook: ['facebook.com'], youtube: ['youtube.com', 'youtu.be'], tiktok: ['tiktok.com'], soundcloud: ['soundcloud.com'] };
  return Object.fromEntries(Object.entries(hosts).map(([name, allowed]) => {
    const url = text(value[name], 1000);
    if (url && !httpsUrl(url, allowed)) throw new Error(`Enter an HTTPS ${name} profile link, or leave it blank.`);
    return [name, url];
  }));
}
export function publicContent(section, content) {
  return section === 'music' ? { tracks: content.tracks.filter(track => track.visible) } : content;
}

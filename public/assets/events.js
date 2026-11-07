import { upcomingEvents, formatDate, validateEvents } from './events-core.js';

function text(tag, value, className) {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}
function link(label, url, primary = false) {
  const element = text('a', label, `show-action${primary ? ' show-action-primary' : ''}`);
  element.href = url; element.target = '_blank'; element.rel = 'noopener noreferrer';
  element.setAttribute('aria-label', `${label} (opens in a new tab)`);
  const arrow = text('span', '↗'); arrow.setAttribute('aria-hidden', 'true');
  element.append(arrow);
  return element;
}
function showActions(event) {
  const links = document.createElement('div'); links.className = 'show-links';
  if (event.map_url) links.append(link('Get directions', event.map_url));
  if (event.tickets_url) links.append(link('Tickets / details', event.tickets_url, true));
  return links;
}
function render(events) {
  const upcoming = upcomingEvents(events);
  const list = document.getElementById('show-list');
  if (list) {
    list.replaceChildren();
    if (!upcoming.length) list.append(text('p', 'More shows coming soon. Follow the journey for updates.'));
    for (const event of upcoming) {
      const card = document.createElement('article'); card.className = 'show-card';
      const title = document.createElement('h2');
      const date = text('time', formatDate(event.date)); date.dateTime = event.date;
      title.append(date); card.append(title);
      if (event.venue) card.append(text('p', event.venue, 'show-venue'));
      card.append(text('p', event.city));
      if (event.notes) card.append(text('p', event.notes, 'show-notes'));
      card.append(showActions(event)); list.append(card);
    }
  }
  const debut = document.querySelector('.debut');
  if (debut) {
    debut.replaceChildren(text('h2', upcoming[0]?.date === '2027-02-20' && upcoming[0]?.city.toLowerCase().startsWith('long beach') ? 'Debut show!' : upcoming.length ? 'Next show' : 'On the horizon'));
    debut.firstChild.id = 'debut-title';
    if (upcoming.length) {
      const event = upcoming[0], paragraph = document.createElement('p');
      const date = text('time', formatDate(event.date)); date.dateTime = event.date;
      paragraph.append(date); debut.append(paragraph, text('p', [event.venue, event.city].filter(Boolean).join(' · ')));
      debut.append(showActions(event));
      debut.append(Object.assign(text('a', 'All shows →'), { href: 'events.html' }));
    } else debut.append(text('p', 'More shows coming soon.'));
  }
}
let inFlight = false;
async function refresh() {
  if (inFlight) return;
  inFlight = true;
  const status = document.getElementById('schedule-status');
  try {
    const response = await fetch('/api/events', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Schedule unavailable');
    let { events } = await response.json();
    if (events === null) {
      const initial = await fetch('/data/events.json', { cache: 'no-store' });
      if (!initial.ok) throw new Error('Starting schedule unavailable');
      events = await initial.json();
    }
    render(validateEvents(events));
    if (status) status.textContent = '';
  } catch {
    if (status) status.textContent = 'Live updates are temporarily unavailable. Displaying the last available announcement.';
  } finally { inFlight = false; }
}
refresh();
setInterval(refresh, 60 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

const header = document.querySelector('header');
const toggle = header.querySelector('.menu-toggle');
const panel = header.querySelector('.nav-panel');
const mobile = matchMedia('(max-width: 700px)');
header.classList.add('nav-ready');
toggle.hidden = false;
function setOpen(open, restoreFocus = false) {
  header.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  panel.inert = mobile.matches && !open;
  if (restoreFocus) toggle.focus();
}
toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
header.addEventListener('keydown', event => {
  if (event.key === 'Escape' && header.classList.contains('menu-open')) setOpen(false, true);
});
panel.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
document.addEventListener('click', event => { if (!header.contains(event.target)) setOpen(false); });
header.addEventListener('focusout', event => {
  if (event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
});
mobile.addEventListener('change', () => setOpen(false));
setOpen(false);

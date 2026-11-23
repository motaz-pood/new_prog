/* ==========================================================================
   WebOS 11 — core helpers: DOM utils, settings, dialogs, context menus,
   notifications and weather.
   ========================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmtTime(d, use24) {
  return d.toLocaleTimeString('en-US', use24
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: 'numeric', minute: '2-digit' });
}
function fmtDate(d) { return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }); }
function fmtLong(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
function fmtStamp(t) {
  return new Date(t).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtRel(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' hr ago';
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : d + ' days ago';
}
function fmtSize(b) {
  if (b == null) return '';
  if (b === 0) return '0 KB';
  if (b < 1024) return '1 KB';
  if (b < 1048576) return Math.ceil(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

/* ---------- Settings (persisted in localStorage) ---------- */
const WALLPAPERS = {
  bloom: 'radial-gradient(circle at 18% 28%, #8fe3ff 0, transparent 42%), radial-gradient(circle at 78% 22%, #c99bff 0, transparent 38%), radial-gradient(circle at 62% 88%, #3d6dff 0, transparent 48%), radial-gradient(circle at 22% 92%, #ff9fd8 0, transparent 38%), linear-gradient(135deg, #1b2f80, #4b2aa0 55%, #0b6e8f)',
  sunrise: 'radial-gradient(circle at 30% 110%, #ffd166 0, transparent 45%), linear-gradient(170deg, #1d1b4b 0%, #7b2d8e 45%, #ff6b6b 80%, #ffb36b 100%)',
  flow: 'radial-gradient(ellipse at 0% 100%, #00c6ff 0, transparent 55%), radial-gradient(ellipse at 100% 0%, #0072ff 0, transparent 55%), linear-gradient(120deg, #0f2027, #203a43 50%, #2c5364)',
  mint: 'radial-gradient(circle at 80% 20%, #b8ffd9 0, transparent 40%), linear-gradient(160deg, #0b3d3a, #15736b 50%, #7fd8b6)',
  midnight: 'radial-gradient(circle at 50% 120%, #2b2d6e 0, transparent 60%), linear-gradient(180deg, #05060f, #111833)',
  plain: 'linear-gradient(#1f1f1f, #1f1f1f)'
};
const WALL_NAMES = { bloom: 'Bloom', sunrise: 'Sunrise', flow: 'Flow', mint: 'Mint', midnight: 'Midnight', plain: 'Solid' };
const ACCENTS = ['#0067c0', '#8764b8', '#e3008c', '#ca5010', '#498205', '#038387', '#d13438', '#107c10', '#5c2d91', '#b146c2'];

const Settings = (() => {
  const KEY = 'webos11.settings.v1';
  const defaults = {
    theme: 'light', accent: '#0067c0', wallpaper: 'bloom',
    displayName: 'User', password: '', deviceName: 'DESKTOP-WEBOS11', clock24: false,
    wifi: true, bluetooth: true, airplane: false, nightLight: false, focus: false,
    brightness: 100, volume: 60, installed: {}, network: 'WebOS-Home'
  };
  let s = Object.assign({}, defaults);
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore corrupt data */ }
  const subs = [];
  function set(patch) {
    Object.assign(s, patch);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage full */ }
    subs.forEach(f => f(s));
  }
  return { get: () => s, set, on: f => subs.push(f), defaults };
})();

/* ---------- Notifications & toasts ---------- */
const Notify = {
  items: [],
  subs: [],
  push(title, body, app) {
    this.items.unshift({ title, body, app: app || null, t: Date.now() });
    if (this.items.length > 40) this.items.pop();
    this.subs.forEach(f => f());
  },
  clear() { this.items = []; this.subs.forEach(f => f()); },
  on(f) { this.subs.push(f); }
};

function toast(title, body = '', app = null) {
  const host = $('#toasts');
  if (Settings.get().focus) { Notify.push(title, body, app); return; }
  const appDef = app && APPS[app];
  const t = el(`<div class="toast" role="status">
      <div class="toast-ic">${appDef ? tile(appDef, 'sm') : icon('bell')}</div>
      <div class="toast-txt"><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}</div>
      <button class="toast-x" title="Close">${icon('close')}</button>
    </div>`);
  if (host) host.append(t);
  Notify.push(title, body, app);
  const kill = () => t.remove();
  t.querySelector('.toast-x').onclick = kill;
  setTimeout(kill, 5000);
}

/* ---------- Dialogs (content dialogs) ---------- */
const Dialog = {
  open({ title, body = '', buttons = [{ label: 'OK', value: true, primary: true }], input = null }) {
    return new Promise(resolve => {
      const ov = el(`<div class="overlay">
          <div class="dialog" role="dialog" aria-modal="true">
            <h3>${esc(title)}</h3>
            <div class="dlg-body">${body}</div>
            ${input ? `<input class="input dlg-input" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}">` : ''}
            <div class="dlg-btns"></div>
          </div></div>`);
      const inp = ov.querySelector('.dlg-input');
      const btns = ov.querySelector('.dlg-btns');
      const primary = buttons.find(b => b.primary);
      const done = v => {
        ov.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve({ v, input: inp ? inp.value : null });
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done({ v: null }); }
        else if (e.key === 'Enter' && primary) { e.preventDefault(); e.stopPropagation(); done(primary.value); }
      };
      buttons.forEach(b => {
        const btn = el(`<button class="btn${b.primary ? ' primary' : ''}${b.danger ? ' danger' : ''}">${esc(b.label)}</button>`);
        btn.onclick = () => done(b.value);
        btns.append(btn);
      });
      document.body.append(ov);
      document.addEventListener('keydown', onKey, true);
      (inp || (primary && btns.querySelector('.primary')))?.focus();
      if (inp) inp.select();
    });
  }
};
const confirmBox = (title, msg, { ok = 'OK', danger = false } = {}) =>
  Dialog.open({
    title, body: `<p>${esc(msg)}</p>`,
    buttons: [{ label: ok, value: true, primary: true, danger }, { label: 'Cancel', value: false }]
  }).then(r => r.v === true);
const promptBox = (title, msg, value = '') =>
  Dialog.open({
    title, body: msg ? `<p>${esc(msg)}</p>` : '', input: { value },
    buttons: [{ label: 'OK', value: true, primary: true }, { label: 'Cancel', value: null }]
  }).then(r => (r.v ? r.input.trim() : null));
const alertBox = (title, msg) =>
  Dialog.open({ title, body: `<p>${esc(msg)}</p>`, buttons: [{ label: 'OK', value: true, primary: true }] });

/* ---------- Context menus (with submenus) ---------- */
const Ctx = (() => {
  let menus = [];
  function closeAll() { menus.forEach(m => m.remove()); menus = []; }
  function closeFrom(depth) {
    menus = menus.filter(m => {
      if (+m.dataset.depth >= depth) { m.remove(); return false; }
      return true;
    });
  }
  function build(items, x, y, depth, altX) {
    closeFrom(depth);
    const m = el('<div class="ctx" role="menu"></div>');
    m.dataset.depth = depth;
    items.forEach(it => {
      if (it.sep) { m.append(el('<div class="ctx-sep"></div>')); return; }
      const b = el(`<button class="ctx-item" role="menuitem"${it.disabled ? ' disabled' : ''}>
          <span class="ctx-ic">${it.icon ? icon(it.icon) : ''}</span>
          <span class="ctx-lbl">${esc(it.label)}</span>
          <span class="ctx-sc">${esc(it.sc || '')}</span>
          ${it.sub ? `<span class="ctx-arr">${icon('chevron')}</span>` : ''}
        </button>`);
      if (it.sub) {
        b.addEventListener('pointerenter', () => {
          const r = b.getBoundingClientRect();
          build(it.sub, r.right - 2, r.top - 5, depth + 1, r.left);
        });
      } else {
        b.addEventListener('pointerenter', () => closeFrom(depth + 1));
        b.addEventListener('click', e => { e.stopPropagation(); closeAll(); if (it.action) it.action(); });
      }
      m.append(b);
    });
    document.body.append(m);
    menus.push(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = x, top = y;
    if (left + w > window.innerWidth - 4) left = Math.max(4, altX - w + 2);
    if (top + h > window.innerHeight - 4) top = Math.max(4, window.innerHeight - h - 4);
    m.style.left = left + 'px';
    m.style.top = top + 'px';
    return m;
  }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.ctx')) closeAll(); }, true);
  window.addEventListener('blur', closeAll);
  window.addEventListener('resize', closeAll);
  return {
    open(x, y, items) { closeAll(); return build(items, x, y, 0, x); },
    closeAll,
    isOpen: () => menus.length > 0
  };
})();

/* ---------- Weather (Open-Meteo, location: Sanaa, Yemen) ---------- */
const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail'
};
const Weather = {
  cache: null,
  async get() {
    if (this.cache && Date.now() - this.cache.t < 600000) return this.cache;
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=15.3694&longitude=44.191'
        + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m'
        + '&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FAden&forecast_days=5';
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      this.cache = { t: Date.now(), cur: j.current, daily: j.daily };
      return this.cache;
    } catch (e) {
      return null;
    }
  },
  label: code => WMO[code] || 'Unknown',
  glyph: code => (code === 0 || code === 1 ? 'sun' : 'cloud')
};

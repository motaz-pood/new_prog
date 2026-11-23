/* ==========================================================================
   WebOS 11 — icon set (24x24 glyphs drawn with currentColor)
   ========================================================================== */
const ICONS = {
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" fill="currentColor"/>',
  folderNew: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 10.5v5M9.5 13h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  file: '<path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor"/><path d="M14 3v4h4" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>',
  text: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  globe: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="1.6"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 9l3 3-3 3M12 16h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  gear: '<circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" stroke-width="3.6" stroke-dasharray="2.6 2.25"/><circle cx="12" cy="12" r="6" fill="currentColor"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/>',
  calc: '<rect x="4.5" y="3" width="15" height="18" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="7.5" y="6.5" width="9" height="3.5" rx=".6" fill="currentColor"/><g fill="currentColor"><circle cx="8.5" cy="13.5" r="1.1"/><circle cx="12" cy="13.5" r="1.1"/><circle cx="15.5" cy="13.5" r="1.1"/><circle cx="8.5" cy="17" r="1.1"/><circle cx="12" cy="17" r="1.1"/><circle cx="15.5" cy="17" r="1.1"/></g>',
  paint: '<path d="M14.5 3.5l6 6-8.5 8.5-6-6z" fill="currentColor"/><path d="M6 14c-2 0-3 1.5-3 3.5 0 1.2-.5 2.3-1.5 3 2.2.6 5.5.2 6.5-1.8" fill="currentColor"/>',
  trash: '<path d="M5 7h14M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h5.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  bag: '<path d="M5 8h14l-1 12H6z" fill="currentColor"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  chart: '<path d="M4 20h16" stroke="currentColor" stroke-width="1.8"/><rect x="5.5" y="11" width="3" height="7" fill="currentColor"/><rect x="10.5" y="6" width="3" height="12" fill="currentColor"/><rect x="15.5" y="9" width="3" height="9" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><g fill="currentColor"><rect x="7" y="12.5" width="2.2" height="2.2"/><rect x="11" y="12.5" width="2.2" height="2.2"/><rect x="15" y="12.5" width="2.2" height="2.2"/><rect x="7" y="16" width="2.2" height="2.2"/></g>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  pc: '<rect x="3" y="4" width="18" height="12.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 20h6M12 16.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  search: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="19.3" r="1.5" fill="currentColor"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="5" y="9.5" width="10.5" height="5" rx="1" fill="currentColor"/><path d="M21 10.5v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  power: '<path d="M12 3v8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M7.2 6.3a7.5 7.5 0 1 0 9.6 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  user: '<circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M4 21c.6-4.2 3.8-6.5 8-6.5s7.4 2.3 8 6.5z" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  min: '<path d="M5 12h14" stroke="currentColor" stroke-width="1.2"/>',
  max: '<rect x="5.5" y="5.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  restore: '<rect x="8" y="5" width="11" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 9v9.5h10" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  back: '<path d="M19 12H6M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  forward: '<path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8.5A1.5 1.5 0 0 0 6 16h2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  cut: '<circle cx="6.5" cy="6.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 8.5L20 18M8.5 15.5L20 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  paste: '<rect x="5" y="4.5" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="9" y="2.8" width="6" height="3.4" rx="1" fill="currentColor"/>',
  rename: '<path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="1.7"/>',
  sun: '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.7A3.3 3.3 0 0 0 7 18.5z" fill="currentColor"/>',
  chevron: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronDown: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11l8-6.5 8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="currentColor"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  music: '<path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>',
  video: '<rect x="3" y="6.5" width="13" height="11" rx="2" fill="currentColor"/><path d="M16 10.5l5-3v9l-5-3z" fill="currentColor"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  picture: '<rect x="3" y="4.5" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="8.5" cy="9.5" r="1.7" fill="currentColor"/><path d="M4 17.5l5-5 4 4 2.5-2.5 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  bluetooth: '<path d="M7 7.5l10 9-5 4V3.5l5 4.5-10 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>',
  plane: '<path d="M21 14l-9-2.5V5a2 2 0 0 0-4 0v6.5L3 14v2l5-1 1 4-2 1.5V22l3-.8 3 .8v-1.5L12 19l1-4 5 1z" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5.5M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1" fill="currentColor"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" fill="currentColor"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" fill="currentColor"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" fill="currentColor"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  accessibility: '<circle cx="12" cy="5" r="2" fill="currentColor"/><path d="M5 9h14M12 9v5l-3 6M12 14l3 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  focus: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 4v8l5 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  file2: '<path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  shutdown: '<path d="M12 3v8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M7.2 6.3a7.5 7.5 0 1 0 9.6 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  eraser: '<path d="M4 16.5l8.5-8.5a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 20H8.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 11.5l5 5" stroke="currentColor" stroke-width="1.7"/>',
  line: '<path d="M4 20L20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" stroke-width="2"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  save: '<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 4v5h7V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="currentColor"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  ellipsis: '<circle cx="5.5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18.5" cy="12" r="1.8" fill="currentColor"/>',
  newtab: '<rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 9.5v5M9.5 12h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="9.5" y="9.5" width="5" height="5" fill="currentColor"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="currentColor" stroke-width="1.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" fill="currentColor"/><path d="M9 12l2 2 4-4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z" fill="currentColor"/>',
  logout: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
};

/** Returns an inline SVG for a named glyph. */
function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/** Returns a colored app tile (Fluent-style) for an app definition. */
function tile(app, size = '') {
  const c = (app && app.c) || ['#8a8f98', '#4b5260'];
  const g = (app && app.glyph) || 'file';
  return `<span class="tile ${size}" style="--c1:${c[0]};--c2:${c[1]}">${icon(g)}</span>`;
}

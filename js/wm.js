/* ==========================================================================
   WebOS 11 — window manager: windows, focus, drag, resize, snap,
   maximize/minimize, and grouped taskbar buttons.
   ========================================================================== */
const WM = (() => {
  const TB_H = 48;
  const MIN_W = 360, MIN_H = 240;
  const wins = new Map();          // id -> win
  const tbBtns = new Map();        // appId -> taskbar button
  const pinnedIds = [];
  let seq = 0, z = 100, activeId = null;

  const layer = () => $('#windows');
  const tbHost = () => $('#tb-apps');
  const areaW = () => window.innerWidth;
  const areaH = () => window.innerHeight - TB_H;
  const zOf = w => +w.el.style.zIndex || 0;
  const rectOf = w => ({ x: w.el.offsetLeft, y: w.el.offsetTop, w: w.el.offsetWidth, h: w.el.offsetHeight });
  const setRect = (w, r) => Object.assign(w.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  const topVisible = () => [...wins.values()].filter(w => !w.minimized).sort((a, b) => zOf(b) - zOf(a))[0] || null;

  function updateMaxBtn(w) {
    const b = w.el.querySelector('.wc-max');
    b.innerHTML = icon(w.maximized ? 'restore' : 'max');
    b.title = w.maximized ? 'Restore Down' : 'Maximize';
  }

  function maximize(id, keepPrev = false) {
    const w = wins.get(id);
    if (!w || w.maximized) return;
    if (!keepPrev) w.prev = rectOf(w);
    w.maximized = true; w.snapped = false;
    w.el.classList.add('max');
    setRect(w, { x: 0, y: 0, w: areaW(), h: areaH() });
    updateMaxBtn(w);
  }

  function unmaximize(w) {
    w.maximized = false;
    w.el.classList.remove('max');
    if (w.prev) setRect(w, w.prev);
    updateMaxBtn(w);
  }

  function toggleMax(id) {
    const w = wins.get(id);
    if (!w) return;
    if (w.maximized) unmaximize(w); else maximize(id);
  }

  function snap(id, side, keepPrev = false) {
    const w = wins.get(id);
    if (!w) return;
    if (!keepPrev) w.prev = rectOf(w);
    w.maximized = false;
    w.el.classList.remove('max');
    w.snapped = true;
    const half = Math.floor(areaW() / 2);
    setRect(w, side === 'left' ? { x: 0, y: 0, w: half, h: areaH() } : { x: half, y: 0, w: areaW() - half, h: areaH() });
    updateMaxBtn(w);
    focusWin(id);
  }

  function minimizeWin(id) {
    const w = wins.get(id);
    if (!w) return;
    w.minimized = true;
    w.el.classList.add('min');
    if (activeId === id) {
      activeId = null;
      const n = topVisible();
      if (n) focusWin(n.id);
    }
    renderTaskbar();
  }

  function focusWin(id) {
    const w = wins.get(id);
    if (!w) return;
    if (w.minimized) { w.minimized = false; w.el.classList.remove('min'); }
    w.el.style.zIndex = ++z;
    activeId = id;
    wins.forEach(o => o.el.classList.toggle('inactive', o.id !== id));
    renderTaskbar();
  }

  function open(appId, opts = {}) {
    const app = APPS[appId];
    if (!app) return null;
    const id = 'w' + (++seq);
    const w = Math.min(opts.width || app.width || 860, areaW() - 16);
    const h = Math.min(opts.height || app.height || 560, areaH() - 16);
    const k = (wins.size % 6) * 26;
    const x = opts.x ?? Math.max(8, Math.round((areaW() - w) / 2) + k - 78);
    const y = opts.y ?? Math.max(8, Math.round((areaH() - h) / 2) + k - 60);

    const node = el(`<div class="win opening">
        <div class="win-bar">
          <span class="win-ic">${tile(app, 'xs')}</span>
          <span class="win-title"></span>
          <div class="win-ctl">
            <button class="wc wc-min" title="Minimize">${icon('min')}</button>
            <button class="wc wc-max" title="Maximize">${icon('max')}</button>
            <button class="wc wc-close" title="Close">${icon('close')}</button>
          </div>
        </div>
        <div class="win-body"></div>
        ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<div class="rz rz-${d}" data-d="${d}"></div>`).join('')}
      </div>`);
    node.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++z}`;
    const body = node.querySelector('.win-body');
    const titleEl = node.querySelector('.win-title');

    const win = {
      id, appId, app, el: node, body,
      data: opts.data || {},
      title: opts.title || app.name,
      minimized: false, maximized: false, snapped: false, prev: null,
      closeHooks: [], guard: null,
      setTitle(t) { win.title = t; titleEl.textContent = t; renderTaskbar(); },
      focus() { focusWin(id); },
      close() { closeWin(id); },
      minimize() { minimizeWin(id); },
      toggleMax() { toggleMax(id); },
      onClose(fn) { win.closeHooks.push(fn); }
    };
    titleEl.textContent = win.title;
    wins.set(id, win);

    node.addEventListener('pointerdown', () => focusWin(id), true);
    node.addEventListener('animationend', () => node.classList.remove('opening'), { once: true });
    node.querySelector('.wc-min').onclick = () => minimizeWin(id);
    node.querySelector('.wc-max').onclick = () => toggleMax(id);
    node.querySelector('.wc-close').onclick = () => closeWin(id);
    updateMaxBtn(win);

    /* Drag by title bar; drop at top = maximize, at edges = snap */
    const bar = node.querySelector('.win-bar');
    bar.addEventListener('dblclick', e => { if (!e.target.closest('.win-ctl')) toggleMax(id); });
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.win-ctl')) return;
      focusWin(id);
      const start = rectOf(win);
      const pre = (win.maximized || win.snapped) && win.prev ? win.prev : start;
      const sx = e.clientX, sy = e.clientY;
      let ox = e.clientX - start.x, oy = e.clientY - start.y;
      let dragging = false;
      const move = ev => {
        if (!dragging) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          dragging = true;
          if (win.maximized || win.snapped) {
            const p = win.prev || { x: 120, y: 80, w: 860, h: 560 };
            const ratio = Math.min(0.9, Math.max(0.1, (sx - start.x) / Math.max(1, start.w)));
            unmaximize(win);
            win.snapped = false;
            setRect(win, { x: 0, y: 0, w: p.w, h: p.h });
            ox = Math.min(p.w - 60, Math.max(60, ratio * p.w));
            oy = 14;
          }
        }
        win.el.style.left = (ev.clientX - ox) + 'px';
        win.el.style.top = Math.max(0, ev.clientY - oy) + 'px';
      };
      const up = ev => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!dragging) return;
        if (ev.clientY <= 2) {
          win.prev = pre;
          maximize(id, true);
        } else if (ev.clientX <= 2 || ev.clientX >= areaW() - 2) {
          win.prev = pre;
          snap(id, ev.clientX <= 2 ? 'left' : 'right', true);
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    /* Resize from edges and corners */
    node.querySelectorAll('.rz').forEach(hd => hd.addEventListener('pointerdown', e => {
      if (e.button !== 0 || win.maximized) return;
      e.preventDefault();
      e.stopPropagation();
      focusWin(id);
      const d = hd.dataset.d;
      const r = rectOf(win);
      const sx = e.clientX, sy = e.clientY;
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        let x = r.x, y = r.y, ww = r.w, hh = r.h;
        if (d.includes('e')) ww = Math.max(MIN_W, r.w + dx);
        if (d.includes('s')) hh = Math.max(MIN_H, r.h + dy);
        if (d.includes('w')) { ww = Math.max(MIN_W, r.w - dx); x = r.x + r.w - ww; }
        if (d.includes('n')) { hh = Math.max(MIN_H, r.h - dy); y = r.y + r.h - hh; }
        setRect(win, { x, y, w: ww, h: hh });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        win.snapped = false;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }));

    layer().append(node);
    try {
      app.open(body, win);
    } catch (err) {
      console.error(err);
      body.innerHTML = `<div class="crash">${icon('info')}<p>${esc(app.name)} stopped working.</p><small>${esc(err.message)}</small></div>`;
    }
    focusWin(id);
    return win;
  }

  async function closeWin(id) {
    const w = wins.get(id);
    if (!w) return;
    if (w.guard) {
      const ok = await w.guard();
      if (!ok) return;
    }
    w.closeHooks.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    w.el.remove();
    wins.delete(id);
    if (activeId === id) {
      activeId = null;
      const n = topVisible();
      if (n) focusWin(n.id);
    }
    renderTaskbar();
  }

  /* ---------- Taskbar grouping ---------- */
  function renderTaskbar() {
    const host = tbHost();
    if (!host) return;
    const byApp = new Map();
    wins.forEach(w => {
      if (!byApp.has(w.appId)) byApp.set(w.appId, []);
      byApp.get(w.appId).push(w);
    });
    const want = [...new Set([...pinnedIds, ...byApp.keys()])];
    tbBtns.forEach((btn, appId) => {
      if (!want.includes(appId)) { btn.remove(); tbBtns.delete(appId); }
    });
    want.forEach(appId => {
      const app = APPS[appId];
      if (!app) return;
      let btn = tbBtns.get(appId);
      if (!btn) {
        btn = el('<button class="tb-btn tb-app"></button>');
        btn.innerHTML = tile(app, 'sm');
        btn.onclick = () => groupClick(appId);
        btn.oncontextmenu = e => { e.preventDefault(); groupMenu(appId, e.clientX, e.clientY); };
        tbBtns.set(appId, btn);
        host.append(btn);
      }
      const list = byApp.get(appId) || [];
      btn.classList.toggle('open', list.length > 0);
      btn.classList.toggle('active', list.some(w => w.id === activeId && !w.minimized));
      btn.title = app.name;
    });
  }

  function groupClick(appId) {
    const list = [...wins.values()].filter(w => w.appId === appId);
    if (!list.length) { open(appId); return; }
    const top = list.sort((a, b) => zOf(b) - zOf(a))[0];
    if (top.id === activeId && !top.minimized) {
      list.forEach(w => { if (!w.minimized) minimizeWin(w.id); });
    } else {
      focusWin(top.id);
    }
  }

  function groupMenu(appId, x, y) {
    const app = APPS[appId];
    const list = [...wins.values()].filter(w => w.appId === appId);
    const items = [];
    list.forEach(w => items.push({ label: w.title, icon: 'file2', action: () => focusWin(w.id) }));
    if (list.length) items.push({ sep: true });
    if (list.length) items.push({ label: list.length > 1 ? 'Close all windows' : 'Close window', icon: 'close', action: () => list.forEach(w => closeWin(w.id)) });
    items.push({ label: pinnedIds.includes(appId) ? 'Unpin from taskbar' : 'Pin to taskbar', icon: 'star', action: () => (pinnedIds.includes(appId) ? unpin(appId) : pin(appId)) });
    if (app) items.push({ label: 'Open ' + app.name, icon: 'newtab', action: () => open(appId) });
    Ctx.open(x, y, items);
  }

  function pin(appId) { if (!pinnedIds.includes(appId)) pinnedIds.push(appId); renderTaskbar(); }
  function unpin(appId) {
    const i = pinnedIds.indexOf(appId);
    if (i >= 0) pinnedIds.splice(i, 1);
    const btn = tbBtns.get(appId);
    const open = [...wins.values()].some(w => w.appId === appId);
    if (btn && !open) { btn.remove(); tbBtns.delete(appId); }
    renderTaskbar();
  }

  function closeAll() { [...wins.keys()].forEach(id => closeWin(id)); }

  let hiddenByDesktop = [];
  function showDesktop() {
    const visible = [...wins.values()].filter(w => !w.minimized);
    if (visible.length) {
      hiddenByDesktop = visible.map(w => w.id);
      visible.forEach(w => minimizeWin(w.id));
    } else {
      hiddenByDesktop.forEach(id => { const w = wins.get(id); if (w) focusWin(id); });
      hiddenByDesktop = [];
    }
  }

  function cycle() {
    const arr = [...wins.values()].filter(w => !w.minimized).sort((a, b) => zOf(b) - zOf(a));
    if (arr.length > 1) focusWin(arr[1].id);
    else if (arr.length === 1) focusWin(arr[0].id);
  }

  window.addEventListener('resize', () => {
    wins.forEach(w => {
      if (w.maximized) setRect(w, { x: 0, y: 0, w: areaW(), h: areaH() });
    });
  });

  return {
    open,
    focus: focusWin,
    close: closeWin,
    closeAll,
    minimize: minimizeWin,
    restore: id => { const w = wins.get(id); if (w) focusWin(id); },
    maximize: toggleMax,
    snap,
    get: id => wins.get(id),
    list: () => [...wins.values()],
    active: () => wins.get(activeId) || null,
    closeActive: () => { const w = wins.get(activeId); if (w) closeWin(w.id); },
    cycle,
    showDesktop,
    pin, unpin,
    isPinned: id => pinnedIds.includes(id),
    renderTaskbar
  };
})();

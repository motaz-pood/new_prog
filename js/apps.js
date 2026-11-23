/* ==========================================================================
   WebOS 11 — built-in applications
   Each app: { name, glyph, c:[color1,color2], width, height, pinned, system, store, open(body, win) }
   ========================================================================== */
const APPS = {};
function defApp(id, cfg) {
  APPS[id] = Object.assign({
    id, name: id, glyph: 'file', c: ['#8a8f98', '#4b5260'], width: 860, height: 560,
    pinned: false, system: false, store: false, desc: ''
  }, cfg);
  return APPS[id];
}
const isInstalled = app => !app.store || !!Settings.get().installed[app.id];
const Clip = { mode: null, paths: [] };
const DOCS = 'C:/Users/User/Documents';
const PICS = 'C:/Users/User/Pictures';

/** Open a file or folder in the right app (shared by Explorer, Desktop, Start). */
function openPath(path) {
  const n = FS.get(path);
  if (!n) return;
  if (n.type === 'dir') { WM.open('explorer', { data: { path } }); return; }
  if (n.app && APPS[n.app]) { WM.open(n.app); return; }
  if (FS.isImage(n)) { WM.open('photos', { data: { path } }); return; }
  if (FS.isText(n)) { WM.open('notepad', { data: { path } }); return; }
  alertBox('Open with', `Windows can't open this file: "${n.name}". There is no app installed that can open it.`);
}

/** Converts "C:\Users\User" (typed in the address bar) into an internal path. */
function toInternalPath(v) {
  v = String(v || '').replace(/\\/g, '/').trim();
  if (/^this pc$/i.test(v)) return '::pc';
  const m = /^([a-z]):?\/?(.*)$/i.exec(v);
  if (!m || m[1].toUpperCase() !== 'C') return null;
  const rest = m[2].replace(/\/+$/, '');
  return rest ? 'C:/' + rest : 'C:';
}
const winPath = p => (p === '::pc' ? 'This PC' : p === 'C:' ? 'C:\\' : FS.norm(p).replace(/\//g, '\\'));

/* ---------- Calendar helper (used by Calendar app, flyout and widgets) ---------- */
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function renderCalendar(host, view, opts = {}) {
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const today = new Date();
  const sel = opts.selected || null;
  const days = [];
  for (let i = 0; i < 42; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const wd = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  host.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav" data-n="-1" title="Previous month">${icon('back')}</button>
      <b>${view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
      <button class="cal-nav" data-n="1" title="Next month">${icon('forward')}</button>
    </div>
    <div class="cal-grid">
      ${wd.map(w => `<span class="cal-wd">${w}</span>`).join('')}
      ${days.map(d => `<button class="cal-d${d.getMonth() !== m ? ' other' : ''}${sameDay(d, today) ? ' today' : ''}${sel && sameDay(d, sel) ? ' sel' : ''}" data-t="${d.getTime()}">${d.getDate()}</button>`).join('')}
    </div>`;
  host.querySelectorAll('.cal-nav').forEach(b => {
    b.onclick = () => renderCalendar(host, new Date(y, m + +b.dataset.n, 1), opts);
  });
  host.querySelectorAll('.cal-d').forEach(b => {
    b.onclick = () => {
      const d = new Date(+b.dataset.t);
      if (opts.onPick) opts.onPick(d);
    };
  });
}

/* ---------- Expression evaluator for the Calculator (no eval) ---------- */
function evalExpr(src) {
  const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  let i = 0, pct = false;
  const peek = () => s[i];
  function num() {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (!m) throw new Error('Invalid input');
    i += m[0].length;
    let v = parseFloat(m[0]);
    if (peek() === '%') { i++; v = v / 100; pct = true; } else pct = false;
    return v;
  }
  function factor() {
    if (peek() === '-') { i++; return -factor(); }
    if (peek() === '+') { i++; return factor(); }
    if (peek() === '(') {
      i++;
      const v = parseSum();
      if (peek() !== ')') throw new Error('Invalid input');
      i++;
      pct = false;
      return v;
    }
    return num();
  }
  function term() {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const r = factor();
      pct = false;
      if (op === '/' && r === 0) throw new Error('Cannot divide by zero');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function parseSum() {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const r = term();
      const add = pct ? v * r : r;
      v = op === '+' ? v + add : v - add;
    }
    return v;
  }
  const v = parseSum();
  if (i !== s.length) throw new Error('Invalid input');
  if (!isFinite(v)) throw new Error('Result is too large');
  return v;
}
const fmtNum = v => {
  if (!isFinite(v)) throw new Error('Result is too large');
  return String(Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(15)));
};

/* =================================================================
   FILE EXPLORER (also used for This PC and Recycle Bin)
   ================================================================= */
defApp('explorer', {
  name: 'File Explorer', glyph: 'folder', c: ['#ffd35c', '#e09a00'], width: 980, height: 620, pinned: true,
  open(body, win) {
    const st = { path: win.data.path || 'C:/Users/User', back: [], fwd: [], sel: new Set(), filter: '' };
    const isTrash = p => p === FS.TRASH || FS.inTrash(p);
    const selList = () => [...st.sel];

    body.innerHTML = `
      <div class="ex-cmd">
        <button class="ex-btn" data-a="new">${icon('plus')}<span>New</span>${icon('chevronDown', 'ex-dd')}</button>
        <span class="ex-sep"></span>
        <button class="ex-btn ex-icon" data-a="cut" title="Cut (Ctrl+X)">${icon('cut')}</button>
        <button class="ex-btn ex-icon" data-a="copy" title="Copy (Ctrl+C)">${icon('copy')}</button>
        <button class="ex-btn ex-icon" data-a="paste" title="Paste (Ctrl+V)">${icon('paste')}</button>
        <button class="ex-btn ex-icon" data-a="rename" title="Rename (F2)">${icon('rename')}</button>
        <button class="ex-btn ex-icon" data-a="delete" title="Delete (Del)">${icon('trash')}</button>
        <span class="ex-sep"></span>
        <button class="ex-btn" data-a="restore" hidden>${icon('reset')}<span>Restore</span></button>
        <button class="ex-btn" data-a="empty" hidden>${icon('trash')}<span>Empty Recycle Bin</span></button>
        <button class="ex-btn ex-right" data-a="props">${icon('info')}<span>Properties</span></button>
      </div>
      <div class="ex-nav">
        <button class="ex-nb" data-a="back" title="Back (Alt+Left)">${icon('back')}</button>
        <button class="ex-nb" data-a="fwd" title="Forward (Alt+Right)">${icon('forward')}</button>
        <button class="ex-nb" data-a="up" title="Up (Backspace)">${icon('up')}</button>
        <button class="ex-nb" data-a="refresh" title="Refresh (F5)">${icon('refresh')}</button>
        <div class="ex-addr" title="Click to type a path"><div class="ex-crumbs"></div></div>
        <label class="ex-search">${icon('search')}<input type="search" placeholder="Search"></label>
      </div>
      <div class="ex-main">
        <aside class="ex-side"></aside>
        <section class="ex-content">
          <div class="ex-head"><span>Name</span><span>Date modified</span><span>Type</span><span>Size</span></div>
          <div class="ex-list" tabindex="0"></div>
        </section>
      </div>
      <div class="ex-status"><span class="ex-count"></span></div>`;

    const $list = body.querySelector('.ex-list');
    const $crumbs = body.querySelector('.ex-crumbs');
    const $addr = body.querySelector('.ex-addr');
    const $side = body.querySelector('.ex-side');
    const $count = body.querySelector('.ex-count');
    const $search = body.querySelector('.ex-search input');

    const SIDE = [
      { h: 'Quick access' },
      { p: 'C:/Users/User', n: 'Home', g: 'home' },
      { p: FS.DESKTOP, n: 'Desktop', g: 'folder' },
      { p: 'C:/Users/User/Downloads', n: 'Downloads', g: 'download' },
      { p: DOCS, n: 'Documents', g: 'file' },
      { p: PICS, n: 'Pictures', g: 'picture' },
      { p: 'C:/Users/User/Music', n: 'Music', g: 'music' },
      { p: 'C:/Users/User/Videos', n: 'Videos', g: 'video' },
      { h: 'This PC' },
      { p: '::pc', n: 'This PC', g: 'pc' },
      { p: 'C:', n: 'Local Disk (C:)', g: 'cpu' },
      { h: 'Recycle' },
      { p: FS.TRASH, n: 'Recycle Bin', g: 'trash' }
    ];
    $side.innerHTML = SIDE.map(s => (s.h
      ? `<div class="ex-sh">${esc(s.h)}</div>`
      : `<button class="ex-si" data-p="${esc(s.p)}">${icon(s.g)}<span>${esc(s.n)}</span></button>`)).join('');
    $side.addEventListener('click', e => {
      const b = e.target.closest('.ex-si');
      if (b) go(b.dataset.p);
    });

    function crumbSegs(p) {
      if (p === '::pc') return [{ l: 'This PC', p: '::pc' }];
      const labels = { '$Recycle.Bin': 'Recycle Bin' };
      const out = [{ l: 'This PC', p: '::pc' }, { l: 'Local Disk (C:)', p: 'C:' }];
      let acc = 'C:';
      FS.norm(p).split('/').slice(1).forEach(seg => {
        acc += '/' + seg;
        out.push({ l: labels[seg] || seg, p: acc });
      });
      return out;
    }

    function rowIcon(n) {
      if (n.drive) return icon('cpu', 'ic-drive');
      if (n.type === 'dir') return icon('folder', 'ic-folder');
      if (n.app && APPS[n.app]) return tile(APPS[n.app], 'xs');
      if (FS.isImage(n)) return icon('picture', 'ic-img');
      if (FS.isText(n)) return icon('text', 'ic-text');
      return icon('file2', 'ic-file');
    }

    function items() {
      let arr;
      if (st.path === '::pc') {
        arr = [{ name: 'Local Disk (C:)', path: 'C:', type: 'dir', drive: true, mtime: 0 }];
      } else {
        arr = FS.list(st.path).sort((a, b) => (a.type === b.type ? (a.origName || a.name).localeCompare(b.origName || b.name) : a.type === 'dir' ? -1 : 1));
      }
      const f = st.filter.toLowerCase();
      return f ? arr.filter(n => (n.origName || n.name).toLowerCase().includes(f)) : arr;
    }

    function paint() {
      $list.querySelectorAll('.ex-row').forEach(r => r.classList.toggle('sel', st.sel.has(r.dataset.p)));
      const n = $list.querySelectorAll('.ex-row').length;
      $count.textContent = `${n} item${n === 1 ? '' : 's'}${st.sel.size ? `  |  ${st.sel.size} selected` : ''}`;
      body.querySelector('[data-a="restore"]').hidden = !(st.path === FS.TRASH || isTrash(st.path));
      body.querySelector('[data-a="empty"]').hidden = st.path !== FS.TRASH;
      body.querySelector('[data-a="back"]').disabled = !st.back.length;
      body.querySelector('[data-a="fwd"]').disabled = !st.fwd.length;
      body.querySelector('[data-a="up"]').disabled = st.path === '::pc' || st.path === 'C:';
      $side.querySelectorAll('.ex-si').forEach(b => b.classList.toggle('on', b.dataset.p === st.path));
    }

    function render() {
      if (!body.isConnected) return;
      if (st.path !== '::pc' && !FS.get(st.path)) st.path = FS.parentOf(st.path) || 'C:';
      const list = items();
      st.sel = new Set([...st.sel].filter(p => list.some(n => n.path === p)));
      $list.innerHTML = list.map(n => {
        const shown = n.origName || n.name;
        const trashed = isTrash(n.path);
        const date = n.drive ? '' : fmtStamp(trashed && n.deletedAt ? n.deletedAt : n.mtime);
        const type = n.drive ? 'Local Disk' : FS.typeOf(n);
        const size = n.drive ? '238 GB free of 476 GB' : (n.type === 'file' ? fmtSize(FS.size(n)) : '');
        return `<div class="ex-row${st.sel.has(n.path) ? ' sel' : ''}" data-p="${esc(n.path)}">
            <span class="ex-nm">${rowIcon(n)}<span>${esc(shown)}</span></span>
            <span>${esc(date)}</span><span>${esc(type)}</span><span>${esc(size)}</span></div>`;
      }).join('') || `<div class="ex-empty">${st.filter ? 'No items match your search.' : (st.path === FS.TRASH ? 'The Recycle Bin is empty.' : 'This folder is empty.')}</div>`;
      $crumbs.innerHTML = crumbSegs(st.path).map((s, i) =>
        `${i ? `<span class="ex-chev">${icon('chevron')}</span>` : ''}<button class="ex-crumb" data-p="${esc(s.p)}">${esc(s.l)}</button>`).join('');
      paint();
    }

    function go(p, push = true) {
      if (p === st.path) { render(); return; }
      if (p !== '::pc' && !FS.get(p)) { alertBox('File Explorer', `Windows can't find '${winPath(p)}'. Check the spelling and try again.`); return; }
      if (push) { st.back.push(st.path); st.fwd = []; }
      st.path = p;
      st.sel.clear();
      st.filter = '';
      $search.value = '';
      render();
    }
    const back = () => { if (st.back.length) { st.fwd.push(st.path); st.path = st.back.pop(); st.sel.clear(); render(); } };
    const fwd = () => { if (st.fwd.length) { st.back.push(st.path); st.path = st.fwd.pop(); st.sel.clear(); render(); } };
    const up = () => { if (st.path !== '::pc' && st.path !== 'C:') go(FS.parentOf(st.path) || 'C:'); };

    function editAddr() {
      const inp = el(`<input class="ex-addr-input" spellcheck="false" value="${esc(winPath(st.path))}">`);
      $addr.innerHTML = '';
      $addr.append(inp);
      inp.focus();
      inp.select();
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const p = toInternalPath(inp.value);
          if (p && (p === '::pc' || FS.get(p))) { go(p); }
          else { render(); alertBox('File Explorer', `Windows can't find '${inp.value}'. Check the spelling and try again.`); }
        } else if (e.key === 'Escape') render();
      });
      inp.addEventListener('blur', () => setTimeout(() => { if ($addr.contains(inp)) render(); }, 0));
    }
    $addr.addEventListener('click', e => {
      if (e.target.closest('.ex-crumb') || e.target.closest('.ex-addr-input')) return;
      editAddr();
    });
    $crumbs.addEventListener('click', e => {
      const b = e.target.closest('.ex-crumb');
      if (b) go(b.dataset.p);
    });

    function copySel(mode) {
      const ps = selList();
      if (!ps.length) return;
      Clip.mode = mode;
      Clip.paths = ps;
      paint();
    }
    function pasteHere() {
      if (!Clip.paths.length || st.path === '::pc' || isTrash(st.path)) return;
      try {
        Clip.paths.forEach(p => {
          if (!FS.get(p)) return;
          if (Clip.mode === 'cut') FS.move(p, st.path); else FS.copy(p, st.path);
        });
      } catch (e) {
        alertBox('Paste', e.message);
      }
      if (Clip.mode === 'cut') { Clip.mode = null; Clip.paths = []; }
      render();
    }
    async function deleteSel() {
      const ps = selList().filter(p => FS.get(p));
      if (!ps.length) return;
      const perm = ps.every(p => FS.inTrash(p));
      if (perm) {
        const what = ps.length === 1 ? `'${FS.baseOf(ps[0])}'` : `these ${ps.length} items`;
        const ok = await confirmBox('Delete File', `Are you sure you want to permanently delete ${what}?`, { ok: 'Delete', danger: true });
        if (!ok) return;
      }
      ps.forEach(p => FS.remove(p));
      st.sel.clear();
      if (!perm) toast('Moved to Recycle Bin', ps.length === 1 ? FS.baseOf(ps[0]) : `${ps.length} items`, 'explorer');
      render();
    }
    async function renameSel() {
      const ps = selList();
      if (ps.length !== 1 || isTrash(ps[0])) return;
      const nn = await promptBox('Rename', 'Enter a new name:', FS.baseOf(ps[0]));
      if (!nn) return;
      try { FS.rename(ps[0], nn); st.sel.clear(); }
      catch (e) { alertBox('Rename', e.message); }
      render();
    }
    function newFolder() {
      if (st.path === '::pc' || isTrash(st.path)) return;
      try { const np = FS.mkdir(st.path, 'New folder'); st.sel = new Set([np]); }
      catch (e) { alertBox('New folder', e.message); }
      render();
    }
    function newText() {
      if (st.path === '::pc' || isTrash(st.path)) return;
      try { const np = FS.createFile(st.path, 'New Text Document.txt', ''); st.sel = new Set([np]); }
      catch (e) { alertBox('New text document', e.message); }
      render();
    }
    function restoreSel() {
      selList().forEach(p => { if (FS.inTrash(p)) FS.restore(p); });
      st.sel.clear();
      render();
    }
    async function emptyBin() {
      const ok = await confirmBox('Empty Recycle Bin', 'Are you sure you want to permanently delete all items in the Recycle Bin?', { ok: 'Empty', danger: true });
      if (ok) FS.emptyTrash();
    }
    function props() {
      const ps = selList();
      if (st.path === '::pc' && !ps.length) {
        Dialog.open({ title: 'This PC', body: '<table class="prop"><tr><th>Local Disk (C:)</th><td>476 GB total, 238 GB free</td></tr></table>', buttons: [{ label: 'OK', value: true, primary: true }] });
        return;
      }
      const p = ps.length === 1 ? ps[0] : (ps.length === 0 ? st.path : null);
      if (!p) { alertBox('Properties', `${ps.length} items selected.`); return; }
      const n = FS.get(p);
      if (!n) return;
      const rows = [
        ['Name', n.origName || n.name],
        ['Type', FS.typeOf(n)],
        ['Location', winPath(n.origin || FS.parentOf(p))],
        ['Size', n.type === 'dir' ? `${FS.countItems(n)} items` : fmtSize(FS.size(n))],
        ['Date modified', new Date(n.mtime).toLocaleString('en-US')]
      ];
      Dialog.open({
        title: `${n.origName || n.name} Properties`,
        body: `<table class="prop">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>`,
        buttons: [{ label: 'OK', value: true, primary: true }]
      });
    }

    function openItem(p) {
      const n = FS.get(p);
      if (!n) return;
      if (FS.inTrash(p)) { alertBox('Recycle Bin', 'Restore this item first to open it.'); return; }
      if (n.type === 'dir' || p === 'C:') { go(p); return; }
      openPath(p);
    }

    function newMenu(x, y) {
      Ctx.open(x, y, [
        { label: 'Folder', icon: 'folderNew', action: newFolder },
        { label: 'Text Document', icon: 'text', action: newText }
      ]);
    }
    function bgMenu(x, y) {
      Ctx.open(x, y, [
        { label: 'New', icon: 'plus', sub: [
          { label: 'Folder', icon: 'folderNew', action: newFolder },
          { label: 'Text Document', icon: 'text', action: newText }
        ] },
        { label: 'Paste', icon: 'paste', sc: 'Ctrl+V', disabled: !Clip.paths.length, action: pasteHere },
        { sep: true },
        { label: 'Refresh', icon: 'refresh', sc: 'F5', action: render },
        { label: 'Properties', icon: 'info', action: props }
      ]);
    }
    function itemMenu(x, y) {
      const ps = selList();
      const p = ps[0];
      const trash = isTrash(p);
      const items = [{ label: 'Open', icon: 'newtab', sc: 'Enter', action: () => openItem(p) }];
      if (trash) items.push({ label: 'Restore', icon: 'reset', action: restoreSel });
      items.push({ sep: true },
        { label: 'Cut', icon: 'cut', sc: 'Ctrl+X', disabled: trash, action: () => copySel('cut') },
        { label: 'Copy', icon: 'copy', sc: 'Ctrl+C', action: () => copySel('copy') },
        { label: 'Paste', icon: 'paste', sc: 'Ctrl+V', disabled: !Clip.paths.length || trash, action: pasteHere },
        { sep: true },
        { label: 'Rename', icon: 'rename', sc: 'F2', disabled: ps.length !== 1 || trash, action: renameSel },
        { label: 'Delete', icon: 'trash', sc: 'Del', action: deleteSel },
        { sep: true },
        { label: 'Properties', icon: 'info', action: props });
      Ctx.open(x, y, items);
    }

    body.querySelector('.ex-cmd').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const r = b.getBoundingClientRect();
      switch (b.dataset.a) {
        case 'new': newMenu(r.left, r.bottom + 4); break;
        case 'cut': copySel('cut'); break;
        case 'copy': copySel('copy'); break;
        case 'paste': pasteHere(); break;
        case 'rename': renameSel(); break;
        case 'delete': deleteSel(); break;
        case 'restore': restoreSel(); break;
        case 'empty': emptyBin(); break;
        case 'props': props(); break;
      }
    });
    body.querySelector('.ex-nav').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      ({ back, fwd, up, refresh: render })[b.dataset.a]?.();
    });
    $search.addEventListener('input', () => { st.filter = $search.value; render(); });

    $list.addEventListener('click', e => {
      const row = e.target.closest('.ex-row');
      if (!row) { st.sel.clear(); paint(); return; }
      const p = row.dataset.p;
      if (e.ctrlKey) { if (st.sel.has(p)) st.sel.delete(p); else st.sel.add(p); }
      else { st.sel.clear(); st.sel.add(p); }
      paint();
    });
    $list.addEventListener('dblclick', e => {
      const row = e.target.closest('.ex-row');
      if (row) openItem(row.dataset.p);
    });
    $list.addEventListener('contextmenu', e => {
      e.preventDefault();
      const row = e.target.closest('.ex-row');
      if (row) {
        if (!st.sel.has(row.dataset.p)) { st.sel.clear(); st.sel.add(row.dataset.p); paint(); }
        itemMenu(e.clientX, e.clientY);
      } else {
        st.sel.clear();
        paint();
        bgMenu(e.clientX, e.clientY);
      }
    });

    body.addEventListener('keydown', e => {
      if (e.target.matches('input')) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Backspace') { e.preventDefault(); up(); }
      else if (e.key === 'Enter') { const p = selList()[0]; if (p) { e.preventDefault(); openItem(p); } }
      else if (e.key === 'Delete') { e.preventDefault(); deleteSel(); }
      else if (e.key === 'F2') { e.preventDefault(); renameSel(); }
      else if (e.key === 'F5') { render(); }
      else if (e.altKey && e.key === 'ArrowLeft') back();
      else if (e.altKey && e.key === 'ArrowRight') fwd();
      else if (e.ctrlKey && k === 'c') copySel('copy');
      else if (e.ctrlKey && k === 'x') copySel('cut');
      else if (e.ctrlKey && k === 'v') pasteHere();
      else if (e.ctrlKey && k === 'a') { e.preventDefault(); st.sel = new Set(items().map(n => n.path)); paint(); }
    });

    const unsub = FS.on(render);
    win.onClose(unsub);
    render();
    $list.focus({ preventScroll: true });
  }
});

/* =================================================================
   EDGE (web browser with tabs; sites that block embedding open in a real tab)
   ================================================================= */
const FAVS = [
  { name: 'Bing', url: 'https://www.bing.com', letter: 'b', bg: '#0f7b7b' },
  { name: 'GitHub', url: 'https://github.com', letter: 'G', bg: '#24292f' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org', letter: 'W', bg: '#6b7280' },
  { name: 'Open-Meteo', url: 'https://open-meteo.com', letter: 'O', bg: '#2563eb' },
  { name: 'Microsoft', url: 'https://www.microsoft.com', letter: 'M', bg: '#d83b01' },
  { name: 'YouTube', url: 'https://www.youtube.com', letter: 'Y', bg: '#cc0000' }
];
defApp('edge', {
  name: 'Edge', glyph: 'globe', c: ['#43c4ff', '#0b5fd6'], width: 1040, height: 680, pinned: true,
  open(body, win) {
    const NEW = 'edge://newtab';
    const tabs = [];
    let cur = null;
    const mkTab = url => { const t = { url, hist: [url], i: 0 }; tabs.push(t); return t; };
    const titleOf = t => {
      if (t.url === NEW) return 'New tab';
      try { return new URL(t.url).hostname.replace(/^www\./, ''); } catch (e) { return t.url; }
    };
    const normalize = v => {
      v = v.trim();
      if (!v) return NEW;
      if (/^(https?:|edge:|about:)/i.test(v)) return v;
      if (/^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return 'https://' + v;
      return 'https://www.bing.com/search?q=' + encodeURIComponent(v);
    };

    body.innerHTML = `
      <div class="ed-tabs"><div class="ed-tablist"></div><button class="ed-plus" title="New tab (Ctrl+T)">${icon('plus')}</button></div>
      <div class="ed-nav">
        <button class="ed-nb" data-a="back" title="Back">${icon('back')}</button>
        <button class="ed-nb" data-a="fwd" title="Forward">${icon('forward')}</button>
        <button class="ed-nb" data-a="reload" title="Refresh">${icon('refresh')}</button>
        <button class="ed-nb" data-a="home" title="Home">${icon('home')}</button>
        <form class="ed-addr"><span class="ed-lock">${icon('lock')}</span><input class="ed-url" spellcheck="false" placeholder="Search or enter web address"></form>
        <button class="ed-nb" data-a="fav" title="Add to favorites">${icon('star')}</button>
        <button class="ed-nb" data-a="menu" title="Settings and more">${icon('ellipsis')}</button>
      </div>
      <div class="ed-favbar">${FAVS.map(f => `<button class="ed-fav" data-u="${f.url}"><span class="ed-fav-ic" style="background:${f.bg}">${f.letter}</span>${esc(f.name)}</button>`).join('')}</div>
      <div class="ed-view"></div>`;

    const $tabs = body.querySelector('.ed-tablist');
    const $url = body.querySelector('.ed-url');
    const $view = body.querySelector('.ed-view');
    const $back = body.querySelector('[data-a="back"]');
    const $fwd = body.querySelector('[data-a="fwd"]');

    function renderTabs() {
      $tabs.innerHTML = tabs.map((t, i) => `
        <div class="ed-tab${t === cur ? ' on' : ''}" data-i="${i}">
          <span class="ed-tfav">${t.url === NEW ? icon('globe') : icon('globe')}</span>
          <span class="ed-ttl">${esc(titleOf(t))}</span>
          <button class="ed-tx" data-x="${i}" title="Close tab">${icon('close')}</button>
        </div>`).join('');
      win.setTitle(cur ? `${titleOf(cur)} - Edge` : 'Edge');
    }
    function renderChrome() {
      renderTabs();
      $url.value = cur.url === NEW ? '' : cur.url;
      $back.disabled = cur.i <= 0;
      $fwd.disabled = cur.i >= cur.hist.length - 1;
    }
    function renderView() {
      if (cur.url === NEW) {
        const n = new Date();
        $view.innerHTML = `
          <div class="ed-newtab">
            <div class="ed-greet"><div class="ed-time">${fmtTime(n, Settings.get().clock24)}</div><div class="ed-date">${fmtLong(n)}</div></div>
            <form class="ed-search">${icon('search')}<input placeholder="Search the web" autocomplete="off"></form>
            <div class="ed-tiles">${FAVS.map(f => `<button class="ed-tile" data-u="${f.url}"><span class="ed-tile-ic" style="background:${f.bg}">${f.letter}</span><span>${esc(f.name)}</span></button>`).join('')}</div>
          </div>`;
        const form = $view.querySelector('.ed-search');
        form.addEventListener('submit', e => { e.preventDefault(); navigate(normalize(form.querySelector('input').value)); });
      } else {
        $view.innerHTML = `
          <div class="ed-note">${icon('info')}<span>If this page stays blank, the website doesn't allow being shown inside another app.</span>
            <button class="ed-link" data-ext="${esc(cur.url)}">${icon('external')} Open in a new browser tab</button></div>
          <iframe class="ed-frame" src="${esc(cur.url)}" referrerpolicy="no-referrer" title="Web page"></iframe>`;
      }
    }
    function render() { renderChrome(); renderView(); }

    function navigate(url, push = true) {
      if (!cur) return;
      if (push) { cur.hist = cur.hist.slice(0, cur.i + 1); cur.hist.push(url); cur.i = cur.hist.length - 1; }
      cur.url = url;
      render();
    }
    function switchTo(t) { cur = t; render(); }
    function closeTab(i) {
      tabs.splice(i, 1);
      if (!tabs.length) mkTab(NEW);
      if (!tabs.includes(cur)) cur = tabs[Math.max(0, i - 1)];
      render();
    }

    body.querySelector('.ed-plus').onclick = () => { const t = mkTab(NEW); switchTo(t); };
    $tabs.addEventListener('click', e => {
      const x = e.target.closest('.ed-tx');
      if (x) { closeTab(+x.dataset.x); return; }
      const tab = e.target.closest('.ed-tab');
      if (tab) switchTo(tabs[+tab.dataset.i]);
    });
    body.querySelector('.ed-addr').addEventListener('submit', e => { e.preventDefault(); navigate(normalize($url.value)); });
    body.querySelector('.ed-favbar').addEventListener('click', e => {
      const b = e.target.closest('[data-u]');
      if (b) navigate(b.dataset.u);
    });
    $view.addEventListener('click', e => {
      const t = e.target.closest('[data-u]');
      if (t) { navigate(t.dataset.u); return; }
      const x = e.target.closest('[data-ext]');
      if (x) window.open(x.dataset.ext, '_blank', 'noopener');
    });
    body.querySelector('.ed-nav').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b || b.disabled) return;
      switch (b.dataset.a) {
        case 'back': if (cur.i > 0) { cur.i--; navigate(cur.hist[cur.i], false); } break;
        case 'fwd': if (cur.i < cur.hist.length - 1) { cur.i++; navigate(cur.hist[cur.i], false); } break;
        case 'reload': navigate(cur.url, false); break;
        case 'home': navigate(NEW); break;
        case 'fav': toast('Added to favorites', titleOf(cur), 'edge'); break;
        case 'menu': {
          const r = b.getBoundingClientRect();
          Ctx.open(r.right - 220, r.bottom + 4, [
            { label: 'New tab', icon: 'newtab', sc: 'Ctrl+T', action: () => { const t = mkTab(NEW); switchTo(t); } },
            { label: 'New window', icon: 'globe', action: () => WM.open('edge') },
            { sep: true },
            { label: 'Open current page in a new browser tab', icon: 'external', disabled: cur.url === NEW, action: () => window.open(cur.url, '_blank', 'noopener') },
            { label: 'Add to favorites', icon: 'star', sc: 'Ctrl+D', action: () => toast('Added to favorites', titleOf(cur), 'edge') },
            { sep: true },
            { label: 'Settings', icon: 'gear', action: () => WM.open('settings') }
          ]);
          break;
        }
      }
    });
    body.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key.toLowerCase() === 't') { e.preventDefault(); const t = mkTab(NEW); switchTo(t); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'w') { e.preventDefault(); closeTab(tabs.indexOf(cur)); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); $url.focus(); $url.select(); }
    });

    cur = mkTab(win.data.url || NEW);
    render();
  }
});

/* =================================================================
   NOTEPAD
   ================================================================= */
defApp('notepad', {
  name: 'Notepad', glyph: 'text', c: ['#6cb8ff', '#1f6fd1'], width: 760, height: 500, pinned: true,
  open(body, win) {
    let path = win.data.path || null;
    let saved = '';
    let zoom = 14, wrap = true;
    body.innerHTML = `
      <div class="np-cmd">
        <button class="np-b" data-a="new">${icon('newtab')}<span>New window</span></button>
        <button class="np-b" data-a="open">${icon('folder')}<span>Open</span></button>
        <button class="np-b" data-a="save">${icon('save')}<span>Save</span></button>
        <button class="np-b" data-a="saveas"><span>Save as</span></button>
        <span class="np-sep"></span>
        <button class="np-b" data-a="wrap">${icon('text')}<span>Word wrap</span></button>
        <button class="np-b" data-a="zout" title="Zoom out">A−</button>
        <button class="np-b" data-a="zin" title="Zoom in">A+</button>
        <span class="np-sep"></span>
        <button class="np-b" data-a="time">${icon('clock')}<span>Time/Date</span></button>
        <button class="np-b" data-a="selall"><span>Select all</span></button>
      </div>
      <textarea class="np-text" spellcheck="false" dir="auto" placeholder="Type here..."></textarea>
      <div class="np-status"><span class="np-pos">Ln 1, Col 1</span><span class="np-words">0 words</span><span class="np-zoom">${zoom}px</span><span>Windows (CRLF)</span><span>UTF-8</span></div>`;

    const ta = body.querySelector('.np-text');
    const name = () => (path ? FS.baseOf(path) : 'Untitled');
    const dirty = () => ta.value !== saved;
    const setTitle = () => win.setTitle(`${name()}${dirty() ? '*' : ''} - Notepad`);
    function status() {
      const before = ta.value.slice(0, ta.selectionStart);
      const ln = before.split('\n').length;
      const col = before.length - before.lastIndexOf('\n');
      const t = ta.value.trim();
      body.querySelector('.np-pos').textContent = `Ln ${ln}, Col ${col}`;
      body.querySelector('.np-words').textContent = `${t ? t.split(/\s+/).length : 0} words`;
    }
    function applyStyle() {
      ta.style.fontSize = zoom + 'px';
      ta.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
      body.querySelector('.np-zoom').textContent = zoom + 'px';
      body.querySelector('[data-a="wrap"]').classList.toggle('on', wrap);
    }
    function load(p) {
      const n = FS.get(p);
      path = p;
      ta.value = n ? (n.content || '') : '';
      saved = ta.value;
      setTitle(); status();
    }
    function save() {
      if (!path) return saveAs();
      try { FS.write(path, ta.value); saved = ta.value; setTitle(); return true; }
      catch (e) { alertBox('Notepad', e.message); return false; }
    }
    async function saveAs() {
      const nm = await promptBox('Save as', 'File name (saved in Documents):', path ? FS.baseOf(path) : 'Untitled.txt');
      if (!nm) return false;
      try {
        const target = FS.join(DOCS, FS.validName(nm));
        if (FS.get(target)) {
          const ok = await confirmBox('Save as', `"${nm}" already exists. Do you want to replace it?`, { ok: 'Replace', danger: true });
          if (!ok) return false;
          FS.write(target, ta.value);
          path = target;
        } else {
          path = FS.createFile(DOCS, nm, ta.value);
        }
        saved = ta.value;
        setTitle();
        return true;
      } catch (e) { alertBox('Notepad', e.message); return false; }
    }
    win.guard = async () => {
      if (!dirty()) return true;
      const r = await Dialog.open({
        title: 'Notepad',
        body: `<p>Do you want to save changes to ${esc(name())}?</p>`,
        buttons: [
          { label: 'Save', value: 'save', primary: true },
          { label: "Don't save", value: 'no' },
          { label: 'Cancel', value: 'cancel' }
        ]
      });
      if (r.v === 'save') return await save();
      return r.v === 'no';
    };

    body.querySelector('.np-cmd').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      switch (b.dataset.a) {
        case 'new': WM.open('notepad'); break;
        case 'open': WM.open('explorer', { data: { path: DOCS } }); break;
        case 'save': save(); break;
        case 'saveas': saveAs(); break;
        case 'wrap': wrap = !wrap; applyStyle(); break;
        case 'zin': zoom = Math.min(48, zoom + 2); applyStyle(); break;
        case 'zout': zoom = Math.max(8, zoom - 2); applyStyle(); break;
        case 'time': {
          const now = new Date();
          const str = `${fmtTime(now, false)} ${fmtDate(now)}`;
          ta.setRangeText(str, ta.selectionStart, ta.selectionEnd, 'end');
          ta.dispatchEvent(new Event('input'));
          break;
        }
        case 'selall': ta.select(); break;
      }
      ta.focus();
    });
    ta.addEventListener('input', () => { setTitle(); status(); });
    ['keyup', 'click'].forEach(ev => ta.addEventListener(ev, status));
    ta.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); WM.open('notepad'); }
    });

    applyStyle();
    if (path) load(path); else setTitle();
    status();
    ta.focus();
  }
});

/* =================================================================
   CALCULATOR
   ================================================================= */
defApp('calc', {
  name: 'Calculator', glyph: 'calc', c: ['#66707f', '#2f3745'], width: 340, height: 560, pinned: true,
  open(body, win) {
    let expr = '';
    let shown = '0';
    let afterEq = false;
    const OPS = '+−×÷';
    const KEYS = [
      ['%', 'pct', 'fn'], ['CE', 'ce', 'fn'], ['C', 'c', 'fn'], ['⌫', 'bk', 'fn'],
      ['1/x', 'inv', 'fn'], ['x²', 'sq', 'fn'], ['²√x', 'sqrt', 'fn'], ['÷', '÷', 'op'],
      ['7', '7'], ['8', '8'], ['9', '9'], ['×', '×', 'op'],
      ['4', '4'], ['5', '5'], ['6', '6'], ['−', '−', 'op'],
      ['1', '1'], ['2', '2'], ['3', '3'], ['+', '+', 'op'],
      ['±', 'neg', 'fn'], ['0', '0'], ['.', '.'], ['=', 'eq', 'eq']
    ];
    body.tabIndex = -1;
    body.innerHTML = `
      <div class="calc">
        <div class="calc-hist"></div>
        <div class="calc-res">0</div>
        <div class="calc-pad">
          ${KEYS.map(([label, v, kind]) => `<button class="calc-k ${kind || 'num'}" data-k="${esc(v)}">${esc(label)}</button>`).join('')}
        </div>
      </div>`;
    const $hist = body.querySelector('.calc-hist');
    const $res = body.querySelector('.calc-res');

    function refresh() {
      $hist.textContent = expr;
      if (!expr) shown = '0';
      else if (!afterEq) { try { shown = fmtNum(evalExpr(expr)); } catch (e) { /* incomplete input */ } }
      $res.textContent = shown;
      $res.classList.toggle('small', shown.length > 11);
    }
    function applyToCurrent(fn) {
      const m = /(\d*\.?\d+)$/.exec(expr);
      try {
        const base = m ? parseFloat(m[1]) : parseFloat(shown);
        const v = fn(base);
        if (!isFinite(v)) throw new Error('bad');
        expr = m ? expr.slice(0, m.index) + fmtNum(v) : fmtNum(v);
        afterEq = true;
        shown = fmtNum(v);
      } catch (e) {
        expr = ''; shown = 'Cannot divide by zero';
      }
    }
    function press(k) {
      if (shown === 'Cannot divide by zero' || shown === 'Error') { if (k !== 'c' && k !== 'ce') { expr = ''; shown = '0'; } }
      switch (k) {
        case 'c': expr = ''; shown = '0'; afterEq = false; break;
        case 'ce': expr = expr.replace(/[\d.]+$/, ''); afterEq = false; break;
        case 'bk': if (afterEq) { expr = ''; afterEq = false; } else expr = expr.slice(0, -1); break;
        case 'pct': if (expr && /[\d)]$/.test(expr)) { expr += '%'; afterEq = false; } break;
        case 'neg': applyToCurrent(v => -v); break;
        case 'inv': applyToCurrent(v => (v === 0 ? NaN : 1 / v)); break;
        case 'sq': applyToCurrent(v => v * v); break;
        case 'sqrt': applyToCurrent(v => (v < 0 ? NaN : Math.sqrt(v))); break;
        case 'eq': {
          if (!expr) break;
          try {
            const v = evalExpr(expr);
            shown = fmtNum(v);
            expr = shown;
            afterEq = true;
          } catch (e) {
            shown = e.message === 'Cannot divide by zero' ? e.message : 'Invalid input';
            expr = '';
          }
          break;
        }
        default: {
          // digits, dot, operators
          if (k === '.') {
            if (afterEq) { expr = '0.'; afterEq = false; break; }
            const m = /[\d.]*$/.exec(expr);
            if (m && m[0].includes('.')) break;
            expr += /\d$/.test(expr) ? '.' : (expr ? '0.' : '0.');
            break;
          }
          if (OPS.includes(k)) {
            if (!expr) { expr = shown === '0' ? '0' : shown; }
            afterEq = false;
            if (/[+\-−×÷]$/.test(expr)) expr = expr.slice(0, -1) + k;
            else expr += k;
            break;
          }
          if (afterEq) { expr = ''; afterEq = false; }
          if (expr === '0') expr = k;
          else expr += k;
        }
      }
      refresh();
    }

    body.querySelector('.calc-pad').addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (b) press(b.dataset.k);
    });
    body.addEventListener('keydown', e => {
      const map = { '+': '+', '-': '−', '*': '×', 'x': '×', '/': '÷', '.': '.', ',': '.', 'Enter': 'eq', '=': 'eq', 'Backspace': 'bk', 'Escape': 'c', 'Delete': 'ce', '%': 'pct' };
      let k = map[e.key];
      if (!k && /^[0-9]$/.test(e.key)) k = e.key;
      if (k) { e.preventDefault(); press(k); }
    });
    refresh();
    body.focus({ preventScroll: true });
  }
});

/* =================================================================
   PAINT
   ================================================================= */
defApp('paint', {
  name: 'Paint', glyph: 'paint', c: ['#ff9f5a', '#e5482f'], width: 960, height: 640, pinned: true,
  open(body, win) {
    const COLORS = ['#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#b5e61d'];
    const TOOLS = [['brush', 'paint', 'Brush'], ['eraser', 'eraser', 'Eraser'], ['line', 'line', 'Line'], ['rect', 'rect', 'Rectangle'], ['ellipse', 'ellipse', 'Ellipse']];
    body.innerHTML = `
      <div class="pt-tb">
        ${TOOLS.map(([t, g, l]) => `<button class="pt-tool" data-t="${t}" title="${l}">${icon(g)}</button>`).join('')}
        <span class="pt-sep"></span>
        <label class="pt-size">Size <input type="range" min="1" max="40" value="4"><b>4</b></label>
        <span class="pt-sep"></span>
        <div class="pt-colors">${COLORS.map(c => `<button class="pt-col" style="background:${c}" data-c="${c}" title="${c}"></button>`).join('')}</div>
        <input type="color" class="pt-custom" value="#000000" title="Custom color">
        <span class="pt-sep"></span>
        <button class="pt-tool" data-a="undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
        <button class="pt-tool" data-a="clear" title="Clear canvas">${icon('trash')}</button>
        <button class="pt-tool" data-a="save" title="Save to Pictures">${icon('save')}</button>
        <button class="pt-tool" data-a="download" title="Download PNG">${icon('download')}</button>
      </div>
      <div class="pt-wrap"><canvas width="1000" height="620"></canvas></div>
      <div class="pt-status"><span>1000 × 620 px</span><span class="pt-pos">0, 0</span></div>`;

    const cv = body.querySelector('canvas');
    const ctx = cv.getContext('2d');
    if (!ctx) { body.innerHTML = '<div class="crash">Canvas is not supported in this browser.</div>'; return; }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);

    const undos = [];
    const pushUndo = () => { undos.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (undos.length > 40) undos.shift(); return undos[undos.length - 1]; };
    let tool = 'brush', color = '#000000', size = 4, drawing = false, sx = 0, sy = 0, base = null;

    const setTool = t => { tool = t; body.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
    setTool('brush');
    const pos = e => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
    };
    function shape(t, x1, y1, x2, y2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (t === 'line') { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
      else if (t === 'rect') ctx.rect(x1, y1, x2 - x1, y2 - y1);
      else ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 0.5, Math.abs(y2 - y1) / 2 || 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    cv.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      cv.setPointerCapture(e.pointerId);
      drawing = true;
      const p = pos(e);
      sx = p.x; sy = p.y;
      base = pushUndo();
      if (tool === 'brush' || tool === 'eraser') {
        ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (tool === 'eraser' ? size * 2 : size) / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = pos(e);
      body.querySelector('.pt-pos').textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
      if (!drawing) return;
      if (tool === 'brush' || tool === 'eraser') {
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
        ctx.lineWidth = tool === 'eraser' ? size * 2 : size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        sx = p.x; sy = p.y;
      } else {
        ctx.putImageData(base, 0, 0);
        shape(tool, sx, sy, p.x, p.y);
      }
    });
    const endDraw = () => { drawing = false; base = null; };
    cv.addEventListener('pointerup', endDraw);
    cv.addEventListener('pointercancel', endDraw);

    function undo() { if (undos.length) ctx.putImageData(undos.pop(), 0, 0); }
    function clearAll() { pushUndo(); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); }

    body.querySelector('.pt-tb').addEventListener('click', e => {
      const t = e.target.closest('[data-t]');
      const a = e.target.closest('[data-a]');
      const c = e.target.closest('[data-c]');
      if (t) setTool(t.dataset.t);
      if (c) { color = c.dataset.c; body.querySelector('.pt-custom').value = color; }
      if (a) {
        if (a.dataset.a === 'undo') undo();
        if (a.dataset.a === 'clear') clearAll();
        if (a.dataset.a === 'save') {
          try {
            const url = cv.toDataURL('image/png');
            const p = FS.createFile(PICS, 'Untitled.png', url);
            toast('Saved to Pictures', FS.baseOf(p), 'photos');
          } catch (err) { alertBox('Paint', err.message); }
        }
        if (a.dataset.a === 'download') {
          const link = document.createElement('a');
          link.href = cv.toDataURL('image/png');
          link.download = 'painting.png';
          link.click();
        }
      }
    });
    body.querySelector('.pt-custom').addEventListener('input', e => { color = e.target.value; });
    const sizeInput = body.querySelector('.pt-size input');
    sizeInput.addEventListener('input', () => { size = +sizeInput.value; body.querySelector('.pt-size b').textContent = size; });
    body.addEventListener('keydown', e => { if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } });
  }
});

/* =================================================================
   TERMINAL (Command Prompt-style shell)
   ================================================================= */
defApp('terminal', {
  name: 'Terminal', glyph: 'terminal', c: ['#4b4b4b', '#101010'], width: 760, height: 470,
  open(body, win) {
    let cwd = 'C:/Users/User';
    const history = [];
    let hIdx = -1;
    body.innerHTML = `<div class="term"><div class="term-out"></div><div class="term-row"><span class="term-prompt"></span><input class="term-in" spellcheck="false" autocomplete="off"></div></div>`;
    const $out = body.querySelector('.term-out');
    const $in = body.querySelector('.term-in');
    const $prompt = body.querySelector('.term-prompt');
    const $term = body.querySelector('.term');

    const print = t => {
      String(t).split('\n').forEach(line => {
        const d = document.createElement('div');
        d.textContent = line;
        $out.append(d);
      });
      $term.scrollTop = $term.scrollHeight;
    };
    const updatePrompt = () => { $prompt.textContent = winPath(cwd) + '>'; };
    const resolvePath = a => {
      a = String(a).replace(/\\/g, '/');
      if (/^c:/i.test(a)) return FS.norm('C:' + a.slice(2));
      if (/^[a-z]:/i.test(a)) return null;
      let p = cwd;
      a.split('/').filter(Boolean).forEach(seg => {
        if (seg === '.') return;
        if (seg === '..') p = FS.parentOf(p) || 'C:';
        else p = FS.join(p, seg);
      });
      return FS.norm(p);
    };
    const fmtDirDate = d => `${d.toLocaleDateString('en-US')}  ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    const APP_CMDS = { notepad: 'notepad', mspaint: 'paint', paint: 'paint', calc: 'calc', taskmgr: 'taskmgr', explorer: 'explorer', msedge: 'edge', edge: 'edge', settings: 'settings', store: 'store', control: 'settings', clock: 'clock', calendar: 'calendar', weather: 'weather', photos: 'photos', cmd: 'terminal', terminal: 'terminal' };

    const CMD = {
      help() {
        print('For more information on a specific command, type HELP command-name\n' +
          'cd        Changes the current directory\n' +
          'cls       Clears the screen\n' +
          'copy      Copies a file to another folder (copy src dest)\n' +
          'date      Displays the date\n' +
          'del       Deletes a file (sends it to the Recycle Bin)\n' +
          'dir       Lists the files and folders\n' +
          'echo      Displays a message\n' +
          'exit      Closes the terminal\n' +
          'hostname  Displays the computer name\n' +
          'ipconfig  Displays network configuration\n' +
          'md        Creates a folder (md name)\n' +
          'start     Starts an app (start notepad)\n' +
          'systeminfo  Displays system information\n' +
          'time      Displays the time\n' +
          'type      Displays the contents of a text file\n' +
          'ver       Displays the WebOS version\n' +
          'whoami    Displays the current user');
      },
      cls() { $out.innerHTML = ''; },
      cd(a) {
        if (!a) { print(winPath(cwd)); return; }
        const p = resolvePath(a);
        const n = p && FS.get(p);
        if (!n || n.type !== 'dir') { print('The system cannot find the path specified.'); return; }
        cwd = p;
        updatePrompt();
      },
      dir(a) {
        const p = a ? resolvePath(a) : cwd;
        const n = p && FS.get(p);
        if (!n || n.type !== 'dir') { print('File Not Found'); return; }
        const rows = FS.list(p).sort((x, y) => (x.type === y.type ? x.name.localeCompare(y.name) : x.type === 'dir' ? -1 : 1));
        const lines = [` Directory of ${winPath(p)}`, ''];
        let files = 0, dirs = 0, bytes = 0;
        rows.forEach(r => {
          const d = new Date(r.mtime);
          if (r.type === 'dir') { dirs++; lines.push(`${fmtDirDate(d)}    <DIR>          ${r.name}`); }
          else { files++; const s = FS.size(r); bytes += s; lines.push(`${fmtDirDate(d)}  ${String(s).padStart(14)} ${r.name}`); }
        });
        lines.push(`${String(files).padStart(16)} File(s)  ${bytes.toLocaleString('en-US')} bytes`, `${String(dirs).padStart(16)} Dir(s)`);
        print(lines.join('\n'));
      },
      md(a) {
        if (!a) { print('The syntax of the command is incorrect.'); return; }
        try { FS.mkdir(cwd, a); } catch (e) { print(e.message); }
      },
      echo(...args) { print(args.join(' ')); },
      type(a) {
        const p = a && resolvePath(a);
        const n = p && FS.get(p);
        if (!n || n.type !== 'file') { print('The system cannot find the file specified.'); return; }
        print(n.content || '');
      },
      del(a) {
        const p = a && resolvePath(a);
        if (!p || !FS.get(p)) { print('Could Not Find ' + (a || '')); return; }
        FS.remove(p);
        print('Moved to Recycle Bin.');
      },
      copy(a, b) {
        const src = a && resolvePath(a);
        const dest = b && resolvePath(b);
        if (!src || !FS.get(src)) { print('The system cannot find the file specified.'); return; }
        try { FS.copy(src, dest && FS.get(dest) && FS.get(dest).type === 'dir' ? dest : cwd); print('        1 file(s) copied.'); }
        catch (e) { print(e.message); }
      },
      date() { print(`The current date is: ${fmtLong(new Date())}`); },
      time() { print(`The current time is: ${fmtTime(new Date(), true)}`); },
      ver() { print('WebOS 11 [Version 10.0.22631.2861]'); },
      hostname() { print(Settings.get().deviceName || 'DESKTOP-WEBOS11'); },
      whoami() { print(`${(Settings.get().deviceName || 'DESKTOP-WEBOS11').toLowerCase()}\\${Settings.get().displayName.toLowerCase()}`); },
      ipconfig() {
        print('Windows IP Configuration\n\nWireless LAN adapter Wi-Fi:\n\n' +
          `   Connection-specific DNS Suffix  . : ${Settings.get().network || 'WebOS-Home'}\n` +
          '   IPv4 Address. . . . . . . . . . . : 192.168.1.23\n' +
          '   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n' +
          '   Default Gateway . . . . . . . . . : 192.168.1.1');
      },
      systeminfo() {
        const s = Settings.get();
        print(`Host Name:            ${s.deviceName || 'DESKTOP-WEBOS11'}\nOS Name:              WebOS 11 Pro\nOS Version:           10.0.22631 Build 22631\n` +
          `Registered Owner:      ${s.displayName}\nProcessors:           ${navigator.hardwareConcurrency || 4} logical processors\n` +
          `Total Physical Memory: ${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '8 GB'}`);
      },
      start(a) {
        if (!a) return;
        const id = APP_CMDS[a.toLowerCase().replace(/\.exe$/, '')];
        if (id) WM.open(id); else print('The system cannot find the file specified.');
      },
      exit() { win.close(); }
    };

    function run(line) {
      const raw = line.trim();
      print(`${winPath(cwd)}>${raw}`);
      if (!raw) return;
      history.unshift(raw);
      hIdx = -1;
      const [cmdRaw, ...args] = raw.split(/\s+/);
      const cmd = cmdRaw.toLowerCase();
      if (cmd === 'cls') { CMD.cls(); return; }
      if (Object.prototype.hasOwnProperty.call(CMD, cmd)) { try { CMD[cmd](...args); } catch (e) { print(e.message); } return; }
      if (APP_CMDS[cmd.replace(/\.exe$/, '')]) { WM.open(APP_CMDS[cmd.replace(/\.exe$/, '')]); return; }
      print(`'${cmdRaw}' is not recognized as an internal or external command,\noperable program or batch file.`);
    }

    $in.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const v = $in.value; $in.value = ''; run(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx < history.length - 1) hIdx++; $in.value = history[hIdx] || ''; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hIdx > 0) hIdx--; else hIdx = -1; $in.value = hIdx >= 0 ? history[hIdx] : ''; }
    });
    $term.addEventListener('click', () => $in.focus());
    print('WebOS 11 [Version 10.0.22631.2861]\n(c) WebOS Corporation. All rights reserved.\n\nType "help" to see the list of commands.\n');
    updatePrompt();
    $in.focus();
  }
});

/* =================================================================
   TASK MANAGER
   ================================================================= */
defApp('taskmgr', {
  name: 'Task Manager', glyph: 'chart', c: ['#3fd49a', '#0c7d52'], width: 860, height: 560, pinned: false,
  open(body, win) {
    const BG = [
      ['System', 'System', 0.4, 18], ['Registry', 'Registry', 0.1, 14], ['dwm.exe', 'Desktop Window Manager', 0.8, 60],
      ['explorer.exe', 'Windows Explorer', 0.6, 120], ['svchost.exe', 'Service Host: Network', 0.3, 45],
      ['SearchHost.exe', 'Search', 0.2, 180], ['RuntimeBroker.exe', 'Runtime Broker', 0.1, 32],
      ['WidgetService.exe', 'Widgets', 0.3, 96], ['audiodg.exe', 'Windows Audio Device Graph', 0.1, 24]
    ];
    const state = new Map();
    const hist = [];
    let selKey = null;
    let cpu = 14;
    let tab = 'proc';
    body.innerHTML = `
      <div class="tm">
        <div class="tm-tabs">
          <button class="tm-tab on" data-tab="proc">Processes</button>
          <button class="tm-tab" data-tab="perf">Performance</button>
          <span class="tm-spacer"></span>
          <button class="btn" data-a="end" disabled>End task</button>
        </div>
        <div class="tm-pane" data-pane="proc">
          <table class="tm-table"><thead><tr><th>Name</th><th>Status</th><th class="r">CPU</th><th class="r">Memory</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="tm-pane" data-pane="perf" hidden>
          <div class="tm-perf">
            <div class="tm-card"><b>CPU</b><span class="tm-big" data-v="cpu">0%</span><svg viewBox="0 0 300 90" preserveAspectRatio="none"><polyline fill="none" stroke="#0067c0" stroke-width="2" points=""/></svg></div>
            <div class="tm-card"><b>Memory</b><span class="tm-big" data-v="mem">0 GB</span><div class="tm-bar"><i data-bar="mem"></i></div></div>
            <div class="tm-card"><b>Disk 0 (C:)</b><span class="tm-big" data-v="disk">0%</span><div class="tm-bar"><i data-bar="disk"></i></div></div>
            <div class="tm-card"><b>Wi-Fi</b><span class="tm-big" data-v="net">0 Kbps</span><div class="tm-bar"><i data-bar="net"></i></div></div>
          </div>
        </div>
      </div>`;
    const $tb = body.querySelector('tbody');
    const $end = body.querySelector('[data-a="end"]');
    const rnd = (a, b) => a + Math.random() * (b - a);

    function rowsData() {
      const rows = [];
      WM.list().forEach(w => {
        const k = 'w:' + w.id;
        if (!state.has(k)) state.set(k, { mem: rnd(60, 260), cpu: rnd(0, 2) });
        const s = state.get(k);
        rows.push({ key: k, name: w.title, status: w.minimized ? 'Suspended' : 'Running', cpu: s.cpu, mem: s.mem, win: w.id });
      });
      BG.forEach(([n, d, c, m]) => {
        if (!state.has(n)) state.set(n, { mem: m * rnd(0.9, 1.1), cpu: c });
        const s = state.get(n);
        rows.push({ key: n, name: `${n}`, status: 'Running', cpu: s.cpu, mem: s.mem, desc: d });
      });
      return rows;
    }

    function tick() {
      if (!body.isConnected) return;
      state.forEach((s, k) => {
        s.cpu = Math.max(0, Math.min(35, s.cpu + rnd(-0.6, 0.6)));
        s.mem = Math.max(4, s.mem + rnd(-2, 2));
      });
      const total = [...state.values()].reduce((a, s) => a + s.cpu, 0);
      cpu = Math.max(3, Math.min(96, 0.6 * cpu + 0.4 * (total + rnd(4, 14))));
      hist.push(cpu); if (hist.length > 60) hist.shift();
      const memMB = [...state.values()].reduce((a, s) => a + s.mem, 0) + 2600;
      const memGB = Math.min(16, memMB / 1024);
      const totalGB = navigator.deviceMemory || 16;
      renderProcs();
      if (tab === 'perf') renderPerf(memGB, totalGB);
    }

    function renderProcs() {
      const rows = rowsData();
      if (selKey && !rows.some(r => r.key === selKey)) selKey = null;
      $tb.innerHTML = rows.map(r => `
        <tr data-k="${esc(r.key)}" class="${selKey === r.key ? 'sel' : ''}">
          <td>${r.win ? tile(APPS[WM.get(r.win).appId] || APPS.explorer, 'xs') : icon('cpu', 'tm-ic')}<span>${esc(r.name)}</span>${r.desc ? `<small>${esc(r.desc)}</small>` : ''}</td>
          <td>${r.status}</td>
          <td class="r">${r.cpu.toFixed(1)}%</td>
          <td class="r">${r.mem.toFixed(1)} MB</td>
        </tr>`).join('');
      $end.disabled = !selKey;
    }

    function renderPerf(memGB, totalGB) {
      body.querySelector('[data-v="cpu"]').textContent = Math.round(cpu) + '%';
      body.querySelector('polyline').setAttribute('points', hist.map((v, i) => `${(i / 59) * 300},${90 - (v / 100) * 88}`).join(' '));
      body.querySelector('[data-v="mem"]').textContent = `${memGB.toFixed(1)} / ${totalGB} GB`;
      body.querySelector('[data-bar="mem"]').style.width = (memGB / totalGB * 100).toFixed(0) + '%';
      const disk = rnd(0, 6);
      body.querySelector('[data-v="disk"]').textContent = disk.toFixed(0) + '%';
      body.querySelector('[data-bar="disk"]').style.width = disk + '%';
      const net = rnd(0, 900);
      body.querySelector('[data-v="net"]').textContent = Math.round(net) + ' Kbps';
      body.querySelector('[data-bar="net"]').style.width = (net / 9) + '%';
    }

    body.querySelector('.tm-tabs').addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      tab = t.dataset.tab;
      body.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === t));
      body.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
      tick();
    });
    $tb.addEventListener('click', e => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      selKey = tr.dataset.k;
      renderProcs();
    });
    $end.addEventListener('click', () => {
      if (!selKey) return;
      if (selKey.startsWith('w:')) WM.close(selKey.slice(2));
      else toast('Task Manager', `Access is denied: ${selKey}`, 'taskmgr');
      selKey = null;
      setTimeout(tick, 50);
    });
    const timer = setInterval(tick, 1500);
    win.onClose(() => clearInterval(timer));
    tick();
  }
});

/* =================================================================
   SETTINGS
   ================================================================= */
defApp('settings', {
  name: 'Settings', glyph: 'gear', c: ['#b4bcc9', '#4f5a6b'], width: 960, height: 640, pinned: true,
  open(body, win) {
    const NAV = [
      ['system', 'System', 'pc'], ['network', 'Network & internet', 'wifi'], ['personalization', 'Personalization', 'paint'],
      ['apps', 'Apps', 'bag'], ['accounts', 'Accounts', 'user'], ['time', 'Time & language', 'clock'],
      ['update', 'Windows Update', 'refresh'], ['about', 'About', 'info']
    ];
    body.innerHTML = `
      <div class="set-root">
        <aside class="set-nav">
          <div class="set-user"><span class="avatar sm" data-avatar></span><div><b data-uname></b><small>Local account</small></div></div>
          <div class="set-navlist">${NAV.map(([k, l, g]) => `<button class="set-nb" data-p="${k}">${icon(g)}<span>${l}</span></button>`).join('')}</div>
        </aside>
        <section class="set-main"><h1 class="set-h"></h1><div class="set-body"></div></section>
      </div>`;
    const $body = body.querySelector('.set-body');
    const $h = body.querySelector('.set-h');
    let page = win.data.page || 'system';

    const row = (title, desc, ctrl, glyph) => `
      <div class="set-row">
        ${glyph ? `<span class="set-ico">${icon(glyph)}</span>` : ''}
        <div class="set-txt"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</div>
        <div class="set-ctl">${ctrl}</div>
      </div>`;
    const sw = (key, on) => `<button class="sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-sw="${key}" aria-label="${key}"><span></span></button>`;

    const PAGES = {
      system() {
        const s = Settings.get();
        return `
          <div class="set-card">
            ${row('Brightness', 'Adjust the brightness of the screen', `<input type="range" class="slider" min="30" max="100" value="${s.brightness}" data-rng="brightness">`, 'sun')}
            ${row('Night light', 'Warmer colors to reduce eye strain', sw('nightLight', s.nightLight), 'moon')}
          </div>
          <div class="set-card">
            ${row('Sound', 'Master volume', `<input type="range" class="slider" min="0" max="100" value="${s.volume}" data-rng="volume">`, 'volume')}
            ${row('Focus', 'Hide pop-up notifications', sw('focus', s.focus), 'focus')}
            ${row('Notifications', `${Notify.items.length} notification(s) in the notification center`, '<button class="btn" data-act="clearnotif">Clear all</button>', 'bell')}
          </div>`;
      },
      network() {
        const s = Settings.get();
        const nets = [['WebOS-Home', 'Secured'], ['Office-5G', 'Secured'], ['Guest-Network', 'Open'], ['Neighbor-WiFi', 'Secured']];
        return `
          <div class="set-card">
            ${row('Wi-Fi', s.wifi ? 'On' : 'Off', sw('wifi', s.wifi), 'wifi')}
            ${row('Bluetooth', s.bluetooth ? 'On' : 'Off', sw('bluetooth', s.bluetooth), 'bluetooth')}
            ${row('Airplane mode', 'Turn off all wireless connections', sw('airplane', s.airplane), 'plane')}
          </div>
          <h3 class="set-sub">Available networks</h3>
          <div class="set-card">
            ${nets.map(([n, d]) => `
              <button class="set-net${s.network === n ? ' on' : ''}" data-net="${n}">
                ${icon('wifi')}<span><b>${n}</b><small>${s.network === n ? 'Connected, ' : ''}${d}</small></span>${s.network === n ? icon('check') : ''}
              </button>`).join('')}
          </div>`;
      },
      personalization() {
        const s = Settings.get();
        return `
          <div class="set-card">
            ${row('Mode', 'Choose your default app mode', `<div class="seg">
                <button data-theme="light" class="${s.theme === 'light' ? 'on' : ''}">${icon('sun')}Light</button>
                <button data-theme="dark" class="${s.theme === 'dark' ? 'on' : ''}">${icon('moon')}Dark</button></div>`, 'paint')}
            ${row('Accent color', 'Used for highlights, buttons and taskbar indicators',
              `<div class="swatches">${ACCENTS.map(c => `<button class="swatch${s.accent === c ? ' on' : ''}" style="background:${c}" data-accent="${c}" title="${c}"></button>`).join('')}</div>`, 'paint')}
          </div>
          <h3 class="set-sub">Background</h3>
          <div class="wall-grid">
            ${Object.keys(WALLPAPERS).map(k => `<button class="wall${s.wallpaper === k ? ' on' : ''}" data-wall="${k}" style="background:${WALLPAPERS[k]}"><span>${WALL_NAMES[k]}</span></button>`).join('')}
          </div>`;
      },
      apps() {
        const s = Settings.get();
        return `<div class="set-card">${Object.values(APPS).filter(a => !a.system).map(a => `
            <div class="set-row">${tile(a, 'sm')}
              <div class="set-txt"><b>${esc(a.name)}</b><small>${a.store ? (isInstalled(a) ? 'Installed from Store' : 'Not installed') : 'Built-in'}</small></div>
              <div class="set-ctl">${a.store && isInstalled(a) ? `<button class="btn" data-uninstall="${a.id}">Uninstall</button>` : ''}</div>
            </div>`).join('')}</div>`;
      },
      accounts() {
        const s = Settings.get();
        return `
          <div class="set-card">
            ${row('Display name', 'Shown on the sign-in screen and Start menu',
              `<div class="set-inline"><input class="input" id="set-name" value="${esc(s.displayName)}"><button class="btn primary" data-act="savename">Save</button></div>`, 'user')}
            ${row('Password', 'Leave empty to sign in without a password',
              `<div class="set-inline"><input class="input" type="password" id="set-pw" value="${esc(s.password)}" placeholder="No password"><button class="btn primary" data-act="savepw">Save</button></div>`, 'lock')}
          </div>`;
      },
      time() {
        const s = Settings.get();
        const d = new Date();
        const off = -d.getTimezoneOffset();
        const sign = off >= 0 ? '+' : '-';
        const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
        const mm = String(Math.abs(off) % 60).padStart(2, '0');
        return `
          <div class="set-card">
            ${row('Current time', `${fmtLong(d)}`, `<span class="set-big">${fmtTime(d, s.clock24)}</span>`, 'clock')}
            ${row('Time zone', `(UTC${sign}${hh}:${mm}) Kuwait, Riyadh (Sanaa, Yemen)`, '', 'pc')}
            ${row('Use 24-hour clock', 'Show times as 14:30 instead of 2:30 PM', sw('clock24', s.clock24), 'clock')}
            ${row('Sync time', 'Synchronize with the time server', '<button class="btn" data-act="sync">Sync now</button>', 'refresh')}
          </div>`;
      },
      update() {
        return `
          <div class="set-card">
            <div class="set-row big">
              <span class="set-ico lg">${icon('shield')}</span>
              <div class="set-txt"><b>You're up to date</b><small>WebOS 11 · Last checked: ${new Date().toLocaleString('en-US')}</small></div>
              <div class="set-ctl"><button class="btn" data-act="update">Check for updates</button></div>
            </div>
          </div>`;
      },
      about() {
        const s = Settings.get();
        const ua = navigator.userAgent;
        return `
          <div class="set-card about">
            <div class="about-hero">${tile({ c: ['#43c4ff', '#0b5fd6'], glyph: 'pc' }, 'lg')}<div><b>${esc(s.deviceName || 'DESKTOP-WEBOS11')}</b><small>Device name</small></div></div>
            <div class="set-kv">
              <span>Processor</span><b>${navigator.hardwareConcurrency || 4}-core logical processor</b>
              <span>Installed RAM</span><b>${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Not reported'}</b>
              <span>Device ID</span><b>WEBOS-${(s.displayName || 'USER').toUpperCase()}-11</b>
              <span>Edition</span><b>WebOS 11 Pro</b>
              <span>Version</span><b>24H2</b>
              <span>OS build</span><b>22631.2861</b>
              <span>Browser</span><b class="ua">${esc(ua)}</b>
            </div>
            <div class="about-btns"><button class="btn" data-act="rename">Rename this PC</button><button class="btn" data-act="copyspec">Copy specs</button></div>
          </div>`;
      }
    };

    function render() {
      const s = Settings.get();
      body.querySelectorAll('.set-nb').forEach(b => b.classList.toggle('on', b.dataset.p === page));
      body.querySelector('[data-uname]').textContent = s.displayName;
      body.querySelector('[data-avatar]').textContent = (s.displayName || 'U').charAt(0).toUpperCase();
      $h.textContent = NAV.find(n => n[0] === page)[1];
      $body.innerHTML = PAGES[page]();
    }

    body.querySelector('.set-navlist').addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (b) { page = b.dataset.p; render(); }
    });
    $body.addEventListener('click', e => {
      const t = e.target.closest('[data-sw],[data-theme],[data-accent],[data-wall],[data-net],[data-act],[data-uninstall]');
      if (!t) return;
      const s = Settings.get();
      if (t.dataset.sw) { const k = t.dataset.sw; Settings.set({ [k]: !s[k] }); }
      else if (t.dataset.theme) Settings.set({ theme: t.dataset.theme });
      else if (t.dataset.accent) Settings.set({ accent: t.dataset.accent });
      else if (t.dataset.wall) Settings.set({ wallpaper: t.dataset.wall });
      else if (t.dataset.net) { Settings.set({ network: t.dataset.net, wifi: true }); toast('Connected', t.dataset.net); }
      else if (t.dataset.uninstall) {
        const id = t.dataset.uninstall;
        Settings.set({ installed: Object.assign({}, s.installed, { [id]: false }) });
        toast('App uninstalled', APPS[id].name);
      }
      else if (t.dataset.act) {
        const act = t.dataset.act;
        if (act === 'clearnotif') Notify.clear();
        if (act === 'savename') {
          const v = $body.querySelector('#set-name').value.trim();
          if (v) { Settings.set({ displayName: v }); toast('Account updated', v); }
        }
        if (act === 'savepw') { Settings.set({ password: $body.querySelector('#set-pw').value }); toast('Password saved'); }
        if (act === 'sync') toast('Time synchronized', fmtTime(new Date(), Settings.get().clock24));
        if (act === 'update') {
          t.disabled = true; t.textContent = 'Checking…';
          setTimeout(() => { toast('Up to date', 'WebOS 11 is current.'); render(); }, 1400);
          return;
        }
        if (act === 'rename') {
          promptBox('Rename this PC', 'Device name:', s.deviceName || 'DESKTOP-WEBOS11').then(v => {
            if (v) { Settings.set({ deviceName: v.replace(/\s+/g, '-').toUpperCase() }); render(); }
          });
          return;
        }
        if (act === 'copyspec') {
          const txt = `Device: ${s.deviceName || 'DESKTOP-WEBOS11'}\nEdition: WebOS 11 Pro\nBuild: 22631.2861`;
          if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
          toast('Specs copied to clipboard');
          return;
        }
      }
      render();
    });
    $body.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.rng) { quiet = true; Settings.set({ [t.dataset.rng]: +t.value }); quiet = false; }
    });
    let quiet = false;
    const unsub = Settings.on(() => { if (body.isConnected && !quiet) render(); });
    win.onClose(unsub);
    render();
  }
});

/* =================================================================
   MICROSOFT STORE (install / uninstall optional apps)
   ================================================================= */
defApp('store', {
  name: 'Microsoft Store', glyph: 'bag', c: ['#8ab4ff', '#2f5fd0'], width: 980, height: 620, pinned: true,
  open(body, win) {
    body.innerHTML = `
      <div class="sto">
        <header class="sto-hero"><div><small>Featured</small><h2>Get apps for WebOS 11</h2><p>Install extra apps like Clock and Calendar to add them to your Start menu.</p></div></header>
        <h3 class="sto-h">Apps</h3>
        <div class="sto-grid"></div>
      </div>`;
    const $grid = body.querySelector('.sto-grid');
    function render() {
      const list = Object.values(APPS).filter(a => !a.system);
      $grid.innerHTML = list.map(a => {
        const inst = isInstalled(a);
        const btn = !a.store
          ? '<button class="btn" disabled>Installed</button>'
          : inst
            ? '<button class="btn" data-uninstall="' + a.id + '">Uninstall</button>'
            : '<button class="btn primary" data-get="' + a.id + '">Get</button>';
        return `<div class="sto-card">
            ${tile(a, 'lg')}
            <div class="sto-info"><b>${esc(a.name)}</b><small>${esc(a.desc || 'Built-in app')}</small></div>
            <div class="sto-act">${btn}</div>
          </div>`;
      }).join('');
    }
    $grid.addEventListener('click', e => {
      const g = e.target.closest('[data-get]');
      const u = e.target.closest('[data-uninstall]');
      if (g) {
        const id = g.dataset.get;
        g.disabled = true; g.textContent = 'Installing…';
        setTimeout(() => {
          Settings.set({ installed: Object.assign({}, Settings.get().installed, { [id]: true }) });
          toast('Installed', APPS[id].name, id);
          render();
        }, 1400);
      }
      if (u) {
        const id = u.dataset.uninstall;
        Settings.set({ installed: Object.assign({}, Settings.get().installed, { [id]: false }) });
        toast('Uninstalled', APPS[id].name);
        render();
      }
    });
    render();
  }
});

/* =================================================================
   CALENDAR (with simple per-day events)
   ================================================================= */
defApp('calendar', {
  name: 'Calendar', glyph: 'calendar', c: ['#ff9ec0', '#d63a6e'], width: 780, height: 560, store: true, desc: 'Month view and events.',
  open(body, win) {
    let sel = new Date();
    const KEY = 'webos11.events.v1';
    const getEv = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
    const keyOf = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    body.innerHTML = `
      <div class="cal-app">
        <div class="cal-left"><div class="cal-month"></div></div>
        <div class="cal-right">
          <button class="btn" data-a="today">Go to today</button>
          <h2 class="cal-sel"></h2>
          <div class="cal-ev-list"></div>
          <form class="cal-add"><input class="input" placeholder="Add an event…" maxlength="80"><button class="btn primary">Add</button></form>
        </div>
      </div>`;
    const $month = body.querySelector('.cal-month');
    const $sel = body.querySelector('.cal-sel');
    const $list = body.querySelector('.cal-ev-list');
    function renderSide() {
      $sel.textContent = fmtLong(sel);
      const evs = getEv()[keyOf(sel)] || [];
      $list.innerHTML = evs.length
        ? evs.map((t, i) => `<div class="cal-ev"><span>${esc(t)}</span><button class="ex-icon-btn" data-del="${i}" title="Delete">${icon('close')}</button></div>`).join('')
        : '<p class="muted">No events for this day.</p>';
    }
    function renderAll() {
      renderCalendar($month, sel, { selected: sel, onPick: d => { sel = d; renderAll(); } });
      renderSide();
    }
    body.querySelector('[data-a="today"]').onclick = () => { sel = new Date(); renderAll(); };
    body.querySelector('.cal-add').addEventListener('submit', e => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const v = input.value.trim();
      if (!v) return;
      const all = getEv();
      const k = keyOf(sel);
      all[k] = (all[k] || []).concat(v);
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (err) { /* ignore */ }
      input.value = '';
      renderSide();
    });
    $list.addEventListener('click', e => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      const all = getEv();
      const k = keyOf(sel);
      (all[k] || []).splice(+b.dataset.del, 1);
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (err) { /* ignore */ }
      renderSide();
    });
    renderAll();
  }
});

/* =================================================================
   CLOCK (clock + stopwatch)
   ================================================================= */
defApp('clock', {
  name: 'Clock', glyph: 'clock', c: ['#7dd3fc', '#0369a1'], width: 420, height: 560, store: true, desc: 'Clock and stopwatch.',
  open(body, win) {
    body.innerHTML = `
      <div class="clk">
        <div class="clk-tabs"><button class="tm-tab on" data-m="clock">Clock</button><button class="tm-tab" data-m="sw">Stopwatch</button></div>
        <div class="clk-pane" data-pane="clock">
          <div class="clk-big"></div><div class="clk-date"></div>
        </div>
        <div class="clk-pane" data-pane="sw" hidden>
          <div class="clk-big sw-t">00:00.00</div>
          <div class="clk-btns"><button class="btn primary" data-a="go">Start</button><button class="btn" data-a="lap">Lap</button><button class="btn" data-a="reset">Reset</button></div>
          <ol class="clk-laps"></ol>
        </div>
      </div>`;
    const $big = body.querySelector('.clk-big');
    const $date = body.querySelector('.clk-date');
    const $sw = body.querySelector('.sw-t');
    const $go = body.querySelector('[data-a="go"]');
    const $laps = body.querySelector('.clk-laps');
    let running = false, startT = 0, elapsed = 0, laps = [], tm = null;
    const fmtSw = ms => {
      const c = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
    };
    function tickClock() {
      if (!body.isConnected) return;
      const d = new Date();
      $big.textContent = fmtTime(d, Settings.get().clock24);
      $date.textContent = fmtLong(d);
    }
    body.querySelector('.clk-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      body.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b));
      body.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.m; });
    });
    body.querySelector('.clk-btns').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'go') {
        if (running) { elapsed += Date.now() - startT; running = false; clearInterval(tm); $go.textContent = 'Start'; }
        else { startT = Date.now(); running = true; tm = setInterval(() => { $sw.textContent = fmtSw(elapsed + Date.now() - startT); }, 30); $go.textContent = 'Stop'; }
      } else if (b.dataset.a === 'lap') {
        if (running) { const t = elapsed + Date.now() - startT; laps.unshift(t); $laps.innerHTML = laps.map((l, i) => `<li><span>Lap ${laps.length - i}</span><b>${fmtSw(l)}</b></li>`).join(''); }
      } else if (b.dataset.a === 'reset') {
        clearInterval(tm); running = false; elapsed = 0; laps = []; $laps.innerHTML = ''; $sw.textContent = '00:00.00'; $go.textContent = 'Start';
      }
    });
    tickClock();
    const t1 = setInterval(tickClock, 1000);
    win.onClose(() => { clearInterval(t1); clearInterval(tm); });
  }
});

/* =================================================================
   WEATHER (Sanaa, Yemen)
   ================================================================= */
defApp('weather', {
  name: 'Weather', glyph: 'cloud', c: ['#7dd3fc', '#2563eb'], width: 440, height: 580, pinned: true, desc: 'Weather for Sanaa, Yemen.',
  open(body, win) {
    body.innerHTML = `<div class="wx"><div class="wx-loading">Loading weather…</div></div>`;
    const $wx = body.querySelector('.wx');
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    Weather.get().then(d => {
      if (!body.isConnected) return;
      if (!d) { $wx.innerHTML = `<div class="wx-err">${icon('info')}<p>Couldn't load weather data. Check your internet connection.</p></div>`; return; }
      const c = d.cur;
      $wx.innerHTML = `
        <div class="wx-top">
          <small>Sanaa, Yemen</small>
          <div class="wx-now">${icon(Weather.glyph(c.weather_code), 'wx-ic')}<span class="wx-t">${Math.round(c.temperature_2m)}°</span></div>
          <b>${Weather.label(c.weather_code)}</b>
        </div>
        <div class="wx-stats"><div><small>Humidity</small><b>${c.relative_humidity_2m}%</b></div><div><small>Wind</small><b>${Math.round(c.wind_speed_10m)} km/h</b></div></div>
        <h3 class="sto-h">5-day forecast</h3>
        <div class="wx-days">${d.daily.time.map((t, i) => `
          <div class="wx-day"><span>${i === 0 ? 'Today' : DAY[new Date(t + 'T12:00:00').getDay()]}</span>${icon(Weather.glyph(d.daily.weather_code[i]), 'wx-sm')}<span>${Weather.label(d.daily.weather_code[i])}</span><b>${Math.round(d.daily.temperature_2m_max[i])}° / ${Math.round(d.daily.temperature_2m_min[i])}°</b></div>`).join('')}
        </div>`;
    });
  }
});

/* =================================================================
   PHOTOS (image viewer for Pictures, Desktop, Downloads, Documents)
   ================================================================= */
defApp('photos', {
  name: 'Photos', glyph: 'picture', c: ['#c4b5fd', '#6d28d9'], width: 900, height: 600, pinned: true, desc: 'View your pictures.',
  open(body, win) {
    const FOLDERS = [PICS, FS.DESKTOP, 'C:/Users/User/Downloads', DOCS];
    const src = n => (/^data:/.test(n.content) ? n.content : 'data:image/svg+xml;utf8,' + encodeURIComponent(n.content || ''));
    const images = () => FOLDERS.flatMap(f => FS.list(f).filter(n => FS.isImage(n)));
    let view = win.data.path || null;

    function grid() {
      view = null;
      win.setTitle('Photos');
      const imgs = images();
      body.innerHTML = `
        <div class="ph">
          <div class="ph-bar"><b>Pictures</b><span class="muted">${imgs.length} item(s)</span></div>
          <div class="ph-grid">${imgs.length ? imgs.map(n => `
              <button class="ph-th" data-p="${esc(n.path)}"><img alt="" src="${src(n)}"><span>${esc(n.name)}</span></button>`).join('')
            : `<div class="ex-empty">No pictures yet. Create one with Paint and save it to Pictures.</div>`}</div>
        </div>`;
      body.querySelector('.ph-grid').onclick = e => { const b = e.target.closest('[data-p]'); if (b) show(b.dataset.p); };
    }
    function show(p) {
      const n = FS.get(p);
      if (!n) { grid(); return; }
      view = p;
      win.setTitle(n.name + ' - Photos');
      const list = images();
      const i = list.findIndex(x => x.path === p);
      body.innerHTML = `
        <div class="ph">
          <div class="ph-bar">
            <button class="btn" data-a="grid">${icon('back')}<span>All pictures</span></button>
            <span class="ph-name">${esc(n.name)}</span>
            <span class="ph-sp"></span>
            <button class="ex-icon-btn" data-a="prev" ${i <= 0 ? 'disabled' : ''} title="Previous">${icon('back')}</button>
            <button class="ex-icon-btn" data-a="next" ${i >= list.length - 1 ? 'disabled' : ''} title="Next">${icon('forward')}</button>
            <button class="ex-icon-btn" data-a="del" title="Delete">${icon('trash')}</button>
          </div>
          <div class="ph-view"><img alt="${esc(n.name)}" src="${src(n)}"></div>
        </div>`;
      body.querySelector('.ph').onclick = e => {
        const a = e.target.closest('[data-a]');
        if (!a || a.disabled) return;
        if (a.dataset.a === 'grid') grid();
        if (a.dataset.a === 'prev') show(list[i - 1].path);
        if (a.dataset.a === 'next') show(list[i + 1].path);
        if (a.dataset.a === 'del') { FS.remove(p); grid(); }
      };
    }
    const unsub = FS.on(() => { if (body.isConnected && !view) grid(); });
    win.onClose(unsub);
    if (view && FS.get(view)) show(view); else grid();
  }
});

/* =================================================================
   SYSTEM SHORTCUTS: This PC, Recycle Bin
   ================================================================= */
defApp('thispc', {
  name: 'This PC', glyph: 'pc', c: ['#60a5fa', '#1d4ed8'], width: 900, height: 580, system: true,
  open(body, win) { win.data.path = '::pc'; APPS.explorer.open(body, win); }
});
defApp('recycle', {
  name: 'Recycle Bin', glyph: 'trash', c: ['#9ad0ff', '#2a6fb0'], width: 900, height: 580, system: true,
  open(body, win) { win.data.path = FS.TRASH; APPS.explorer.open(body, win); }
});

/* ==========================================================================
   WebOS 11 — shell: boot, lock/sign-in, desktop icons, taskbar, Start menu,
   flyouts (Quick Settings, Notification Center, Widgets, Task View),
   keyboard shortcuts, Run dialog and power options.
   ========================================================================== */
const Shell = (() => {
  const RUN_MAP = {
    notepad: 'notepad', calc: 'calc', calculator: 'calc', mspaint: 'paint', paint: 'paint', cmd: 'terminal',
    terminal: 'terminal', powershell: 'terminal', explorer: 'explorer', msedge: 'edge', edge: 'edge',
    taskmgr: 'taskmgr', control: 'settings', settings: 'settings', 'ms-settings:': 'settings', store: 'store',
    'ms-windows-store:': 'store', clock: 'clock', calendar: 'calendar', weather: 'weather', photos: 'photos'
  };
  const SCREENS = ['boot', 'lock', 'login', 'shutdown'];
  const FLYOUTS = ['start', 'qs', 'nc', 'widgets'];
  const selected = new Set();
  let screen = null;          // null = desktop is visible
  let metaHeld = false, metaUsed = false;
  let sortBy = 'name';
  let battery = null;

  const $ = (s, r = document) => r.querySelector(s);
  const user = () => Settings.get().displayName || 'User';
  const initial = () => (user().charAt(0) || 'U').toUpperCase();
  const isOpen = id => !$('#' + id).classList.contains('hidden');

  /* ---------- Appearance ---------- */
  function applySettings() {
    const s = Settings.get();
    document.body.classList.toggle('dark', s.theme === 'dark');
    const st = document.documentElement.style;
    st.setProperty('--accent', s.accent);
    st.setProperty('--wall', WALLPAPERS[s.wallpaper] || WALLPAPERS.bloom);
    $('#dim').style.opacity = ((100 - s.brightness) / 100 * 0.75).toFixed(2);
    $('#night').classList.toggle('on', !!s.nightLight);
    $('#st-un').textContent = user();
    $('#st-av').textContent = initial();
    $('#lg-name').textContent = user();
    $('#lg-av').textContent = initial();
    $('#lk-name').textContent = user();
    updateTray();
    tickClock();
  }

  function updateTray() {
    const s = Settings.get();
    $('#tray-ic').innerHTML =
      `<span class="${s.wifi || s.airplane ? '' : 'dim'}">${icon(s.airplane ? 'plane' : 'wifi')}</span>` +
      `<span>${icon('volume')}</span><span>${icon('battery')}</span>`;
  }

  function tickClock() {
    const d = new Date();
    const s = Settings.get();
    $('#tb-time').textContent = fmtTime(d, s.clock24);
    $('#tb-date').textContent = fmtDate(d);
    $('#lk-time').textContent = fmtTime(d, s.clock24);
    $('#lk-date').textContent = fmtLong(d);
  }

  /* ---------- Desktop icons ---------- */
  function fileGlyph(n) {
    if (n.type === 'dir') return `<span class="fileic">${icon('folder')}</span>`;
    if (n.app && APPS[n.app]) return tile(APPS[n.app], 'lg');
    if (FS.isImage(n)) return `<span class="fileic img">${icon('picture')}</span>`;
    if (FS.isText(n)) return `<span class="fileic">${icon('text')}</span>`;
    return `<span class="fileic">${icon('file2')}</span>`;
  }

  function desktopItems() {
    const sys = [
      { key: 'sys:recycle', label: 'Recycle Bin', icon: tile(APPS.recycle, 'lg'), open: () => WM.open('recycle') },
      { key: 'sys:thispc', label: 'This PC', icon: tile(APPS.thispc, 'lg'), open: () => WM.open('thispc') },
      { key: 'sys:edge', label: 'Microsoft Edge', icon: tile(APPS.edge, 'lg'), open: () => WM.open('edge') }
    ];
    let files = FS.list(FS.DESKTOP);
    files.sort((a, b) => (sortBy === 'type'
      ? FS.typeOf(a).localeCompare(FS.typeOf(b)) || a.name.localeCompare(b.name)
      : (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)));
    return sys.concat(files.map(n => ({ key: n.path, label: n.name, icon: fileGlyph(n), path: n.path, node: n })));
  }

  function renderDesktop() {
    const host = $('#icons');
    const items = desktopItems();
    selected.forEach(k => { if (!items.some(i => i.key === k)) selected.delete(k); });
    host.innerHTML = items.map(it => `
      <div class="dicon${selected.has(it.key) ? ' sel' : ''}" data-k="${esc(it.key)}" title="${esc(it.label)}">
        <div class="di-ico">${it.icon}</div>
        <span class="di-lbl">${esc(it.label)}</span>
      </div>`).join('');
  }

  function deselectAll() {
    selected.clear();
    $$('.dicon.sel').forEach(d => d.classList.remove('sel'));
  }

  function openDesktopItem(key) {
    if (key.startsWith('sys:')) {
      const it = desktopItems().find(i => i.key === key);
      if (it) it.open();
      return;
    }
    openPath(key);
  }

  function iconMenu(x, y, key) {
    if (!selected.has(key)) { selected.clear(); selected.add(key); renderDesktop(); }
    if (key.startsWith('sys:')) {
      Ctx.open(x, y, [
        { label: 'Open', icon: 'newtab', action: () => openDesktopItem(key) },
        { sep: true },
        { label: 'Properties', icon: 'info', action: () => alertBox('Properties', 'System item') }
      ]);
      return;
    }
    const n = FS.get(key);
    Ctx.open(x, y, [
      { label: 'Open', icon: 'newtab', sc: 'Enter', action: () => openDesktopItem(key) },
      { sep: true },
      { label: 'Cut', icon: 'cut', sc: 'Ctrl+X', action: () => { Clip.mode = 'cut'; Clip.paths = [key]; toast('Cut', n.name); } },
      { label: 'Copy', icon: 'copy', sc: 'Ctrl+C', action: () => { Clip.mode = 'copy'; Clip.paths = [key]; toast('Copied', n.name); } },
      { label: 'Rename', icon: 'rename', sc: 'F2', action: async () => {
        const nn = await promptBox('Rename', 'Enter a new name:', n.name);
        if (!nn) return;
        try { FS.rename(key, nn); } catch (e) { alertBox('Rename', e.message); }
      } },
      { label: 'Delete', icon: 'trash', sc: 'Del', action: () => { FS.remove(key); selected.delete(key); toast('Moved to Recycle Bin', n.name, 'recycle'); } },
      { sep: true },
      { label: 'Properties', icon: 'info', action: () => alertBox('Properties', `${n.name}\n${FS.typeOf(n)}`) }
    ]);
  }

  function desktopMenu(x, y) {
    Ctx.open(x, y, [
      { label: 'View', icon: 'grid', sub: [
        { label: 'Large icons', icon: 'grid', action: () => toast('View', 'Icon size is fixed in this version.') },
        { label: 'Medium icons', icon: 'grid', action: () => toast('View', 'Icon size is fixed in this version.') }
      ] },
      { label: 'Sort by', icon: 'chevronDown', sub: [
        { label: 'Name', icon: sortBy === 'name' ? 'check' : undefined, action: () => { sortBy = 'name'; renderDesktop(); } },
        { label: 'Type', icon: sortBy === 'type' ? 'check' : undefined, action: () => { sortBy = 'type'; renderDesktop(); } }
      ] },
      { label: 'Refresh', icon: 'refresh', sc: 'F5', action: renderDesktop },
      { sep: true },
      { label: 'New', icon: 'plus', sub: [
        { label: 'Folder', icon: 'folderNew', action: () => { FS.mkdir(FS.DESKTOP, 'New folder'); } },
        { label: 'Text Document', icon: 'text', action: () => { FS.createFile(FS.DESKTOP, 'New Text Document.txt', ''); } }
      ] },
      { sep: true },
      { label: 'Display settings', icon: 'sun', action: () => WM.open('settings', { data: { page: 'system' } }) },
      { label: 'Personalize', icon: 'paint', action: () => WM.open('settings', { data: { page: 'personalization' } }) },
      { label: 'Open in Terminal', icon: 'terminal', action: () => WM.open('terminal') }
    ]);
  }

  /* ---------- Start menu ---------- */
  const installedApps = () => Object.values(APPS).filter(a => !a.system && isInstalled(a));
  function allFiles(dirPath, out = []) {
    FS.list(dirPath).forEach(n => {
      if (n.type === 'dir') allFiles(n.path, out);
      else out.push(n);
    });
    return out;
  }
  function recentFiles(limit) {
    const out = [];
    [FS.DESKTOP, 'C:/Users/User/Documents', 'C:/Users/User/Downloads', 'C:/Users/User/Pictures'].forEach(f =>
      FS.list(f).forEach(n => { if (n.type === 'file') out.push(n); }));
    return out.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
  }
  const recItem = n => `
    <button class="st-rec" data-path="${esc(n.path)}">
      <span class="st-rec-ic">${fileGlyphSmall(n)}</span>
      <span class="st-rec-t"><b>${esc(n.name)}</b><small>${fmtRel(n.mtime)}</small></span>
    </button>`;
  function fileGlyphSmall(n) {
    if (n.type === 'dir') return icon('folder', 'ic-folder');
    if (n.app && APPS[n.app]) return tile(APPS[n.app], 'xs');
    if (FS.isImage(n)) return icon('picture', 'ic-img');
    if (FS.isText(n)) return icon('text', 'ic-text');
    return icon('file2', 'ic-file');
  }

  function renderStart(q = '') {
    const Q = q.trim().toLowerCase();
    const apps = installedApps();
    $('#st-pinsWrap').hidden = !!Q;
    $('#st-recWrap').hidden = !!Q;
    $('#st-resWrap').hidden = !Q;
    if (Q) {
      const aRes = apps.filter(a => a.name.toLowerCase().includes(Q));
      const fRes = allFiles('C:/Users/User').filter(n => n.name.toLowerCase().includes(Q)).slice(0, 12);
      $('#st-res').innerHTML = (aRes.length || fRes.length)
        ? aRes.map(a => `<button class="st-rec" data-app="${a.id}"><span class="st-rec-ic">${tile(a, 'xs')}</span><span class="st-rec-t"><b>${esc(a.name)}</b><small>App</small></span></button>`).join('')
          + fRes.map(recItem).join('')
        : '<p class="st-empty">No results found. Try a different search.</p>';
      return;
    }
    $('#st-pins').innerHTML = apps.filter(a => a.pinned).map(a =>
      `<button class="st-pin" data-app="${a.id}">${tile(a, 'lg')}<span>${esc(a.name)}</span></button>`).join('');
    const recs = recentFiles(6);
    $('#st-recs').innerHTML = recs.length ? recs.map(recItem).join('') : '<p class="st-empty">Files you open will show up here.</p>';
  }

  function renderAllApps() {
    $('#st-list').innerHTML = installedApps().sort((a, b) => a.name.localeCompare(b.name))
      .map(a => `<button class="st-li" data-app="${a.id}">${tile(a, 'sm')}<span>${esc(a.name)}</span></button>`).join('');
  }

  function showStartView(which) {
    $('#st-main').hidden = which !== 'main';
    $('#st-allv').hidden = which !== 'all';
    if (which === 'all') renderAllApps();
  }

  function openStart() {
    closeFlyouts();
    Ctx.closeAll();
    $('#start').classList.remove('hidden');
    $('#tb-start').classList.add('on');
    showStartView('main');
    $('#st-q').value = '';
    renderStart('');
    setTimeout(() => $('#st-q').focus(), 30);
  }
  function closeStart() {
    $('#start').classList.add('hidden');
    $('#tb-start').classList.remove('on');
  }
  const toggleStart = () => (isOpen('start') ? closeStart() : openStart());

  /* ---------- Flyouts ---------- */
  function closeFlyouts() {
    FLYOUTS.forEach(id => $('#' + id).classList.add('hidden'));
    $('#tb-start').classList.remove('on');
    $('#tb-tray').classList.remove('on');
    $('#tb-clock').classList.remove('on');
    $('#tb-widgets').classList.remove('on');
    closeTV();
  }
  function showFlyout(id) {
    closeFlyouts();
    $('#' + id).classList.remove('hidden');
  }

  function renderQS() {
    const s = Settings.get();
    const tiles = [
      ['wifi', 'wifi', 'Wi-Fi', s.wifi ? s.network : 'Off', s.wifi],
      ['bluetooth', 'bluetooth', 'Bluetooth', s.bluetooth ? 'On' : 'Off', s.bluetooth],
      ['airplane', 'plane', 'Airplane mode', s.airplane ? 'On' : 'Off', s.airplane],
      ['nightLight', 'moon', 'Night light', s.nightLight ? 'On' : 'Off', s.nightLight],
      ['focus', 'focus', 'Focus', s.focus ? 'On' : 'Off', s.focus],
      ['settings', 'gear', 'All settings', '', false]
    ];
    const bat = battery ? `${Math.round(battery.level * 100)}%` : '100%';
    $('#qs').innerHTML = `
      <div class="qs-grid">
        ${tiles.map(([k, g, t, sub, on]) => `
          <button class="qs-tile${on ? ' on' : ''}" data-k="${k}">
            <span class="qs-ic">${icon(g)}</span>
            <span class="qs-t"><b>${t}</b><small>${sub}</small></span>
          </button>`).join('')}
      </div>
      <div class="qs-sl">${icon('sun')}<input type="range" min="30" max="100" value="${s.brightness}" data-set="brightness" aria-label="Brightness"></div>
      <div class="qs-sl">${icon('volume')}<input type="range" min="0" max="100" value="${s.volume}" data-set="volume" aria-label="Volume"></div>
      <div class="qs-foot">
        <button class="qs-user" data-act="account"><span class="avatar sm">${initial()}</span><span>${esc(user())}</span></button>
        <span class="qs-batt">${icon('battery')}<span>${bat}</span></span>
        <button class="qs-ibtn" data-act="lock" title="Lock">${icon('lock')}</button>
        <button class="qs-ibtn" data-act="power" title="Power">${icon('power')}</button>
      </div>`;
  }

  function toggleSetting(k) {
    const s = Settings.get();
    if (k === 'airplane') {
      const on = !s.airplane;
      Settings.set({ airplane: on, wifi: !on, bluetooth: !on });
      return;
    }
    if (k === 'settings') { closeFlyouts(); WM.open('settings'); return; }
    Settings.set({ [k]: !s[k] });
  }

  function renderNCList() {
    const list = $('#nc-list');
    list.innerHTML = Notify.items.length
      ? Notify.items.map(n => `
        <div class="nc-item">
          <span class="nc-ic">${n.app && APPS[n.app] ? tile(APPS[n.app], 'sm') : icon('bell')}</span>
          <div class="nc-t"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<small>${fmtRel(n.t)}</small></div>
        </div>`).join('')
      : '<div class="nc-empty">No new notifications</div>';
  }
  function openNC() {
    showFlyout('nc');
    $('#tb-clock').classList.add('on');
    renderNCList();
    renderCalendar($('#nc-cal'), new Date(), {});
  }

  async function loadWeather() {
    const d = await Weather.get();
    const c = d && d.cur;
    $('#tb-wx').innerHTML = c
      ? `<span class="tb-wx-ic">${icon(Weather.glyph(c.weather_code))}</span><span class="tb-wx-t"><b>${Math.round(c.temperature_2m)}°C</b><small>${esc(Weather.label(c.weather_code))}</small></span>`
      : `<span class="tb-wx-ic">${icon('cloud')}</span><span class="tb-wx-t"><b>--°C</b><small>Sanaa</small></span>`;
    renderWidgetWeather(d);
  }

  function renderWidgetWeather(d) {
    const box = $('#wd-wx');
    if (!box) return;
    if (!d) { box.innerHTML = '<div class="wd-h">Weather · Sanaa</div><p class="muted">Weather is unavailable right now.</p>'; return; }
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    box.innerHTML = `
      <div class="wd-h">Sanaa, Yemen</div>
      <div class="wd-now">${icon(Weather.glyph(d.cur.weather_code), 'wx-ic')}<b>${Math.round(d.cur.temperature_2m)}°</b><span>${esc(Weather.label(d.cur.weather_code))}</span></div>
      <div class="wd-days">${d.daily.time.slice(0, 5).map((t, i) => `
        <div><span>${i === 0 ? 'Today' : DAY[new Date(t + 'T12:00:00').getDay()]}</span>${icon(Weather.glyph(d.daily.weather_code[i]))}<b>${Math.round(d.daily.temperature_2m_max[i])}°</b></div>`).join('')}</div>`;
  }

  function renderWidgets() {
    renderCalendar($('#wd-cal'), new Date(), {});
    $('#wd-recs').innerHTML = recentFiles(4).map(recItem).join('') || '<p class="muted">No recent files.</p>';
    const d = new Date();
    $('#wd-clock').innerHTML = `<b>${fmtTime(d, Settings.get().clock24)}</b><span>${fmtLong(d)}</span>`;
    loadWeather();
  }
  function toggleWidgets() {
    if (isOpen('widgets')) closeFlyouts();
    else { showFlyout('widgets'); $('#tb-widgets').classList.add('on'); renderWidgets(); }
  }

  function openQS() {
    showFlyout('qs');
    $('#tb-tray').classList.add('on');
    renderQS();
  }

  /* ---------- Task View ---------- */
  function renderTV() {
    const list = WM.list();
    $('#tv-grid').innerHTML = list.length
      ? list.map(w => `
        <div class="tv-card" data-id="${w.id}">
          <div class="tv-top">${tile(w.app, 'xs')}<span>${esc(w.title)}</span><button class="tv-x" data-x="${w.id}" title="Close">${icon('close')}</button></div>
          <div class="tv-thumb">${tile(w.app, 'lg')}<small>${w.minimized ? 'Minimized' : ''}</small></div>
        </div>`).join('')
      : '<p class="tv-empty">No open windows. Open an app to see it here.</p>';
  }
  function openTV() {
    closeFlyouts();
    $('#taskview').classList.remove('hidden');
    $('#tb-taskview').classList.add('on');
    renderTV();
  }
  function closeTV() {
    const tv = $('#taskview');
    if (!tv || tv.classList.contains('hidden')) return;
    tv.classList.add('hidden');
    $('#tb-taskview').classList.remove('on');
  }
  const toggleTV = () => (isOpen('taskview') ? closeTV() : openTV());

  /* ---------- Screens: boot, lock, sign-in, shutdown ---------- */
  function showScreen(name) {
    screen = name;
    SCREENS.forEach(s => $('#' + s).classList.toggle('hidden', s !== name));
    document.body.classList.toggle('is-locked', !!name && name !== 'shutdown');
    closeFlyouts();
    Ctx.closeAll();
    if (name === 'login') {
      $('#lg-pass').value = '';
      $('#lg-err').textContent = '';
      $('#lg-hint').textContent = Settings.get().password ? 'Enter your password' : 'Press Enter to sign in';
      setTimeout(() => $('#lg-pass').focus(), 60);
    }
    if (name === 'lock' || name === 'login') tickClock();
  }
  function boot() {
    $('#shutdown').dataset.state = '';
    showScreen('boot');
    setTimeout(() => { if (screen === 'boot') showScreen('lock'); }, 2600);
  }
  function signIn() {
    const pw = $('#lg-pass').value;
    if (pw === (Settings.get().password || '')) {
      showScreen(null);
      toast('Welcome back', user());
      return;
    }
    $('#lg-err').textContent = 'The password is incorrect. Try again.';
    const box = $('#login .lg-form');
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
    $('#lg-pass').select();
  }
  function lock() { showScreen('lock'); }
  function signOut() { WM.closeAll(); showScreen('login'); }
  function sleep() { showScreen('lock'); }
  function shutdown() {
    WM.closeAll();
    showScreen('shutdown');
    $('#shutdown').dataset.state = 'stopping';
    setTimeout(() => { if (screen === 'shutdown') $('#shutdown').dataset.state = 'off'; }, 2400);
  }
  function restart() {
    WM.closeAll();
    $('#shutdown').dataset.state = '';
    boot();
  }

  function powerMenu(x, y) {
    Ctx.open(x, y - 150, [
      { label: 'Sleep', icon: 'moon', action: sleep },
      { label: 'Shut down', icon: 'shutdown', action: shutdown },
      { label: 'Restart', icon: 'refresh', action: restart }
    ]);
  }
  function userMenu(x, y) {
    Ctx.open(x, y - 150, [
      { label: 'Lock', icon: 'lock', sc: 'Win+L', action: lock },
      { label: 'Sign out', icon: 'logout', action: signOut },
      { sep: true },
      { label: 'Account settings', icon: 'user', action: () => WM.open('settings', { data: { page: 'accounts' } }) }
    ]);
  }
  function quickLinks(x, y) {
    Ctx.open(x, y - 300, [
      { label: 'Settings', icon: 'gear', sc: 'Win+I', action: () => WM.open('settings') },
      { label: 'Terminal', icon: 'terminal', action: () => WM.open('terminal') },
      { label: 'Task Manager', icon: 'chart', sc: 'Ctrl+Shift+Esc', action: () => WM.open('taskmgr') },
      { label: 'File Explorer', icon: 'folder', sc: 'Win+E', action: () => WM.open('explorer') },
      { sep: true },
      { label: 'Desktop', icon: 'pc', sc: 'Win+D', action: () => WM.showDesktop() },
      { label: 'Shut down or sign out', icon: 'power', sub: [
        { label: 'Sign out', icon: 'logout', action: signOut },
        { label: 'Sleep', icon: 'moon', action: sleep },
        { label: 'Shut down', icon: 'shutdown', action: shutdown },
        { label: 'Restart', icon: 'refresh', action: restart }
      ] }
    ]);
  }

  /* ---------- Run dialog (Win+R) ---------- */
  async function runDialog() {
    const r = await Dialog.open({
      title: 'Run',
      body: '<p>Type the name of a program, and WebOS will open it for you.</p>',
      input: { value: '', placeholder: 'Open:' },
      buttons: [{ label: 'OK', value: true, primary: true }, { label: 'Cancel', value: null }]
    });
    if (!r.v) return;
    const cmd = (r.input || '').trim().toLowerCase().replace(/\.exe$/, '');
    if (!cmd) return;
    if (cmd === 'shutdown' || cmd === 'shutdown /s') { shutdown(); return; }
    if (cmd === 'shutdown /r') { restart(); return; }
    if (cmd === 'shell:desktop') { WM.showDesktop(); return; }
    if (RUN_MAP[cmd]) { WM.open(RUN_MAP[cmd]); return; }
    alertBox('Run', `Windows cannot find '${r.input.trim()}'. Make sure you typed the name correctly, and then try again.`);
  }

  /* ---------- Keyboard ---------- */
  function onKeyDown(e) {
    if (screen === 'shutdown') {
      if ($('#shutdown').dataset.state === 'off') boot();
      return;
    }
    if (screen === 'boot') return;
    if (screen === 'lock' && e.key !== 'Meta') { showScreen('login'); return; }
    if (screen === 'login') {
      if (e.key === 'Escape') $('#lg-pass').value = '';
      return;
    }
    if (e.key === 'Meta') { metaHeld = true; metaUsed = false; return; }
    if (metaHeld) metaUsed = true;
    if (e.key === 'Escape') { closeFlyouts(); Ctx.closeAll(); return; }
    if (e.altKey && e.key === 'F4') { e.preventDefault(); WM.closeActive(); return; }
    if (e.altKey && e.key === 'Tab') { e.preventDefault(); WM.cycle(); return; }
    if (e.ctrlKey && e.key === 'Escape') { e.preventDefault(); toggleStart(); return; }
    if (e.ctrlKey && e.shiftKey && e.key === 'Escape') { e.preventDefault(); WM.open('taskmgr'); return; }
    if (e.key === 'Delete' && selected.size && !e.target.matches('input,textarea')) {
      const k = [...selected][0];
      if (!k.startsWith('sys:')) { FS.remove(k); selected.clear(); }
      return;
    }
    if (metaHeld && e.key !== 'Meta') {
      e.preventDefault();
      const k = e.key.toLowerCase();
      const active = WM.active();
      if (k === 'e') WM.open('explorer');
      else if (k === 'd') WM.showDesktop();
      else if (k === 'l') lock();
      else if (k === 'i') WM.open('settings');
      else if (k === 'r') runDialog();
      else if (k === 'w') toggleWidgets();
      else if (k === 's') { openStart(); }
      else if (k === 'x') { const b = $('#tb-start').getBoundingClientRect(); quickLinks(b.left, b.top); }
      else if (k === 'tab') toggleTV();
      else if (k === 'arrowup' && active) WM.maximize(active.id);
      else if (k === 'arrowdown' && active) { if (active.maximized) WM.maximize(active.id); else WM.minimize(active.id); }
      else if (k === 'arrowleft' && active) WM.snap(active.id, 'left');
      else if (k === 'arrowright' && active) WM.snap(active.id, 'right');
      else e.preventDefault(), (metaUsed = true);
    }
  }
  function onKeyUp(e) {
    if (e.key === 'Meta') {
      if (metaHeld && !metaUsed && screen === null) toggleStart();
      metaHeld = false;
    }
  }

  /* ---------- Init ---------- */
  function bind() {
    // Taskbar
    $('#tb-start').addEventListener('click', toggleStart);
    $('#tb-start').addEventListener('contextmenu', e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); quickLinks(r.left, r.top); });
    $('#tb-search').addEventListener('click', openStart);
    $('#tb-taskview').addEventListener('click', toggleTV);
    $('#tb-widgets').addEventListener('click', toggleWidgets);
    $('#tb-wx').addEventListener('click', toggleWidgets);
    $('#tb-tray').addEventListener('click', () => (isOpen('qs') ? closeFlyouts() : openQS()));
    $('#tb-clock').addEventListener('click', () => (isOpen('nc') ? closeFlyouts() : openNC()));
    $('#tb-desk').addEventListener('click', () => WM.showDesktop());
    $('#taskbar').addEventListener('contextmenu', e => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      Ctx.open(e.clientX, e.clientY - 120, [
        { label: 'Taskbar settings', icon: 'gear', action: () => WM.open('settings', { data: { page: 'personalization' } }) },
        { label: 'Task Manager', icon: 'chart', action: () => WM.open('taskmgr') }
      ]);
    });

    // Start menu
    const start = $('#start');
    start.addEventListener('click', e => {
      const app = e.target.closest('[data-app]');
      const p = e.target.closest('[data-path]');
      if (app) { closeStart(); WM.open(app.dataset.app); return; }
      if (p) { closeStart(); openPath(p.dataset.path); return; }
      if (e.target.closest('#st-all')) { showStartView('all'); return; }
      if (e.target.closest('#st-back')) { showStartView('main'); return; }
    });
    $('#st-q').addEventListener('input', e => renderStart(e.target.value));
    $('#st-q').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = start.querySelector('#st-res [data-app], #st-res [data-path]');
        if (first) first.click();
      } else if (e.key === 'Escape') {
        e.target.value = '';
        renderStart('');
        closeStart();
      }
    });
    $('#st-user').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); userMenu(r.left, r.top); });
    $('#st-power').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); powerMenu(r.left, r.top); });

    // Quick settings
    $('#qs').addEventListener('click', e => {
      const t = e.target.closest('[data-k]');
      const a = e.target.closest('[data-act]');
      if (t) { toggleSetting(t.dataset.k); renderQS(); }
      if (a) {
        if (a.dataset.act === 'lock') lock();
        if (a.dataset.act === 'power') { const r = a.getBoundingClientRect(); powerMenu(r.left, r.top); }
        if (a.dataset.act === 'account') { closeFlyouts(); WM.open('settings', { data: { page: 'accounts' } }); }
      }
    });
    $('#qs').addEventListener('input', e => {
      const k = e.target.dataset.set;
      if (k) Settings.set({ [k]: +e.target.value });
    });
    Settings.on(() => { if (isOpen('qs')) renderQS(); });

    // Notification center
    $('#nc-clear').addEventListener('click', () => Notify.clear());
    Notify.on(() => { if (isOpen('nc')) renderNCList(); });

    // Widgets
    $('#widgets').addEventListener('click', e => {
      const r = e.target.closest('[data-app]');
      if (r) { closeFlyouts(); WM.open(r.dataset.app); }
    });

    // Task View
    $('#taskview').addEventListener('click', e => {
      if (e.target.id === 'taskview') { closeTV(); return; }
      const x = e.target.closest('[data-x]');
      if (x) { WM.close(x.dataset.x); setTimeout(renderTV, 60); return; }
      const card = e.target.closest('.tv-card');
      if (card) { closeTV(); WM.focus(card.dataset.id); }
    });

    // Desktop
    const desk = $('#desktop');
    desk.addEventListener('pointerdown', e => {
      if (e.target.closest('.win') || e.target.closest('#taskbar')) return;
      if (!e.target.closest('.dicon')) deselectAll();
    }, true);
    desk.addEventListener('click', e => {
      const d = e.target.closest('.dicon');
      if (d && !e.target.closest('.win')) {
        if (!e.ctrlKey) selected.clear();
        selected.add(d.dataset.k);
        renderDesktop();
      }
    });
    desk.addEventListener('dblclick', e => {
      const d = e.target.closest('.dicon');
      if (d) openDesktopItem(d.dataset.k);
    });
    desk.addEventListener('contextmenu', e => {
      if (e.target.closest('.win')) return;
      e.preventDefault();
      const d = e.target.closest('.dicon');
      if (d) iconMenu(e.clientX, e.clientY, d.dataset.k);
      else { deselectAll(); desktopMenu(e.clientX, e.clientY); }
    });

    // Lock, sign-in, shutdown
    $('#lock').addEventListener('click', () => { if (screen === 'lock') showScreen('login'); });
    $('#lg-go').addEventListener('click', signIn);
    $('#lg-pass').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
    $('#lg-power').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); powerMenu(r.left, r.top); });
    $('#lk-power').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); powerMenu(r.left, r.top); });
    $('#shutdown').addEventListener('click', () => { if ($('#shutdown').dataset.state === 'off') boot(); });

    // Outside clicks close flyouts (taskbar toggles are excluded)
    document.addEventListener('pointerdown', e => {
      if (e.target.closest('.flyout, .tb-toggle, .ctx, .overlay, #taskview, #login, #lock, #shutdown')) return;
      closeFlyouts();
    }, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(node => {
      if (!node.innerHTML.trim()) node.innerHTML = icon(node.dataset.icon);
    });
  }

  function init() {
    hydrateIcons();
    ['edge', 'explorer', 'store', 'settings'].forEach(id => WM.pin(id));
    applySettings();
    Settings.on(applySettings);
    Settings.on(() => { if (isOpen('start')) renderStart($('#st-q').value); });
    renderDesktop();
    FS.on(renderDesktop);
    bind();
    if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; }).catch(() => {});
    loadWeather();
    setInterval(loadWeather, 600000);
    setInterval(tickClock, 1000);
    tickClock();
    boot();
  }

  return { init, showScreen, lock, boot };
})();

document.addEventListener('DOMContentLoaded', () => Shell.init());

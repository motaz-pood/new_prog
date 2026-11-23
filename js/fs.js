/* ==========================================================================
   WebOS 11 — virtual file system (persisted in localStorage)
   Paths look like Windows paths internally using "/" separators:
   "C:/Users/User/Documents/Notes.txt"
   ========================================================================== */
const FS = (() => {
  const KEY = 'webos11.fs.v1';
  const TRASH = 'C:/$Recycle.Bin';
  const DESKTOP = 'C:/Users/User/Desktop';
  const listeners = [];
  let root = null;

  const dir = name => ({ type: 'dir', name, mtime: Date.now(), children: {} });
  const file = (name, content = '', extra = {}) => Object.assign({ type: 'file', name, mtime: Date.now(), content }, extra);

  const norm = p => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '') || 'C:';
  const parts = p => norm(p).split('/');
  const parentOf = p => parts(p).slice(0, -1).join('/');
  const baseOf = p => parts(p).slice(-1)[0];
  const join = (a, b) => norm(a) + '/' + b;

  function get(p) {
    const ps = parts(p);
    if (ps[0] !== 'C:') return null;
    let cur = root;
    for (const s of ps.slice(1)) {
      if (!cur || cur.type !== 'dir') return null;
      cur = cur.children[s];
    }
    return cur || null;
  }

  function ensureDir(p) {
    let cur = root;
    for (const s of parts(p).slice(1)) {
      if (!cur.children[s]) cur.children[s] = dir(s);
      cur = cur.children[s];
    }
    return cur;
  }

  function seed() {
    root = dir('C:');
    root.children = {};
    const put = (p, n) => { ensureDir(parentOf(p)).children[n.name] = n; };
    [TRASH, 'C:/Windows/System32', 'C:/Windows/Fonts', 'C:/Program Files', 'C:/Program Files (x86)',
      DESKTOP, 'C:/Users/User/Documents', 'C:/Users/User/Downloads', 'C:/Users/User/Pictures',
      'C:/Users/User/Music', 'C:/Users/User/Videos', 'C:/Users/Public'].forEach(ensureDir);
    put(DESKTOP + '/Welcome.txt', file('Welcome.txt',
      'Welcome to WebOS 11!\n\n' +
      'This is a web-based recreation of the Windows 11 desktop.\n' +
      '- Click Start (or press the Windows key) to open the Start menu.\n' +
      '- Right-click the desktop for the context menu.\n' +
      '- Open File Explorer, Edge, Notepad, Paint, Terminal and Settings from the taskbar.\n' +
      '- Press Win+R to open Run, Win+L to lock, Win+D to show the desktop.\n\n' +
      'مرحبا بك في WebOS 11\nيمكنك كتابة النصوص العربية في المفكرة.\n'));
    put('C:/Users/User/Documents/Notes.txt', file('Notes.txt', 'Meeting notes\n\n- Review the WebOS 11 build\n- Publish on GitHub Pages\n'));
    put('C:/Users/User/Documents/Arabic.txt', file('Arabic.txt', 'نص عربي تجريبي\nسطر ثان بالعربية.\n'));
    put('C:/Users/User/Downloads/readme.md', file('readme.md', '# Downloads\nFiles you download appear here.\n'));
    put('C:/Windows/System32/notepad.exe', file('notepad.exe', '', { app: 'notepad' }));
    put('C:/Windows/System32/mspaint.exe', file('mspaint.exe', '', { app: 'paint' }));
    put('C:/Windows/System32/calc.exe', file('calc.exe', '', { app: 'calc' }));
    put('C:/Windows/System32/taskmgr.exe', file('taskmgr.exe', '', { app: 'taskmgr' }));
    put('C:/Windows/System32/cmd.exe', file('cmd.exe', '', { app: 'terminal' }));
    put('C:/Windows/System32/msedge.exe', file('msedge.exe', '', { app: 'edge' }));
    put('C:/Windows/System32/control.exe', file('control.exe', '', { app: 'settings' }));
    put('C:/Windows/System32/drivers.txt', file('drivers.txt', 'Device drivers are managed by WebOS 11.\n'));
    return root;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.type === 'dir') { root = data; ensureDir(TRASH); return root; }
      }
    } catch (e) { /* fall through to seed */ }
    return seed();
  }

  function emit() {
    try { localStorage.setItem(KEY, JSON.stringify(root)); }
    catch (e) { toast && toast('Storage is full', 'Changes are kept for this session only.'); }
    listeners.slice().forEach(fn => fn());
  }

  function unique(parent, name) {
    if (!parent.children[name]) return name;
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let i = 2; ; i++) {
      const cand = `${stem} (${i})${ext}`;
      if (!parent.children[cand]) return cand;
    }
  }

  function validName(n) {
    n = String(n || '').trim();
    if (!n || /[\\\/:*?"<>|]/.test(n) || n === '.' || n === '..') {
      throw new Error(`The name "${n}" is not valid. Names can't contain \\ / : * ? " < > |`);
    }
    return n;
  }

  function list(p) {
    const n = get(p);
    if (!n || n.type !== 'dir') return [];
    const base = norm(p);
    return Object.values(n.children).map(c => Object.assign({}, c, { path: base + '/' + c.name }));
  }

  function mkdir(parentPath, name) {
    const par = get(parentPath);
    if (!par || par.type !== 'dir') throw new Error('The folder does not exist.');
    const nm = unique(par, validName(name));
    par.children[nm] = dir(nm);
    par.mtime = Date.now();
    emit();
    return join(parentPath, nm);
  }

  function createFile(parentPath, name, content = '', extra) {
    const par = get(parentPath);
    if (!par || par.type !== 'dir') throw new Error('The folder does not exist.');
    const nm = unique(par, validName(name));
    par.children[nm] = file(nm, content, extra || {});
    par.mtime = Date.now();
    emit();
    return join(parentPath, nm);
  }

  function write(p, content) {
    const n = get(p);
    if (!n || n.type !== 'file') throw new Error('The file does not exist.');
    n.content = content;
    n.mtime = Date.now();
    emit();
  }

  function rename(p, newName) {
    const par = get(parentOf(p));
    const n = par && par.children[baseOf(p)];
    if (!n) throw new Error('The item does not exist.');
    const nn = validName(newName);
    if (nn === n.name) return p;
    if (par.children[nn]) throw new Error(`Cannot create "${nn}": an item with that name already exists.`);
    delete par.children[n.name];
    n.name = nn;
    n.mtime = Date.now();
    par.children[nn] = n;
    emit();
    return join(parentOf(p), nn);
  }

  function inTrash(p) { return norm(p).startsWith(TRASH + '/'); }

  function permanentDelete(p) {
    const par = get(parentOf(p));
    if (par) delete par.children[baseOf(p)];
    emit();
  }

  function remove(p) {
    if (norm(p) === TRASH || inTrash(p)) return permanentDelete(p);
    const par = get(parentOf(p));
    const n = par && par.children[baseOf(p)];
    if (!n) return;
    const trash = get(TRASH);
    const key = unique(trash, n.name);
    delete par.children[n.name];
    n.origin = parentOf(p);
    n.origName = n.name;
    n.deletedAt = Date.now();
    n.name = key;
    trash.children[key] = n;
    emit();
  }

  function restore(p) {
    const n = get(p);
    if (!n || !n.origin) return null;
    let destPath = n.origin;
    const d0 = get(destPath);
    if (!d0 || d0.type !== 'dir') destPath = DESKTOP;
    const dest = get(destPath);
    const nm = unique(dest, n.origName);
    delete get(TRASH).children[n.name];
    n.name = nm;
    delete n.origin; delete n.origName; delete n.deletedAt;
    dest.children[nm] = n;
    emit();
    return join(destPath, nm);
  }

  function emptyTrash() {
    get(TRASH).children = {};
    emit();
  }

  function cloneNode(n) { return JSON.parse(JSON.stringify(n)); }

  function guardInto(src, destDir) {
    const s = norm(src), d = norm(destDir);
    if (d === s || d.startsWith(s + '/')) throw new Error('You can\'t move or copy a folder into itself.');
  }

  function copy(src, destDir) {
    const n = get(src), dest = get(destDir);
    if (!n || !dest || dest.type !== 'dir') throw new Error('The item or destination does not exist.');
    guardInto(src, destDir);
    const c = cloneNode(n);
    c.name = unique(dest, n.name);
    c.mtime = Date.now();
    delete c.origin; delete c.origName; delete c.deletedAt;
    dest.children[c.name] = c;
    emit();
    return join(destDir, c.name);
  }

  function move(src, destDir) {
    const n = get(src), dest = get(destDir);
    if (!n || !dest || dest.type !== 'dir') throw new Error('The item or destination does not exist.');
    if (norm(parentOf(src)) === norm(destDir)) return src;
    guardInto(src, destDir);
    const par = get(parentOf(src));
    delete par.children[n.name];
    const nm = unique(dest, n.name);
    n.name = nm;
    dest.children[nm] = n;
    emit();
    return join(destDir, nm);
  }

  const TYPES = {
    txt: 'Text Document', md: 'Markdown File', log: 'Log File', html: 'HTML Document', htm: 'HTML Document',
    js: 'JavaScript File', css: 'Cascading Style Sheet', json: 'JSON File', csv: 'CSV File',
    png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image', gif: 'GIF Image', bmp: 'Bitmap Image',
    webp: 'WEBP Image', svg: 'SVG Image', exe: 'Application', bat: 'Batch File', ini: 'Configuration Settings'
  };
  function typeOf(n) {
    if (n.type === 'dir') return 'File folder';
    if (n.app) return 'Application';
    const m = /\.([^.]+)$/.exec(n.name);
    const ext = m ? m[1].toLowerCase() : '';
    return TYPES[ext] || (ext ? ext.toUpperCase() + ' File' : 'File');
  }
  const isImage = n => n.type === 'file' && /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(n.name);
  const isText = n => n.type === 'file' && (/\.(txt|md|log|json|js|css|html?|csv|ini|cfg)$/i.test(n.name) || !/\./.test(n.name));
  const size = n => (n.type === 'file' ? new Blob([n.content || '']).size : 0);
  function countItems(n) { return n.type === 'dir' ? Object.keys(n.children).length : 0; }

  root = load();

  return {
    TRASH, DESKTOP, get, list, mkdir, createFile, write, rename, remove, restore, emptyTrash,
    copy, move, typeOf, isImage, isText, size, countItems, inTrash,
    norm, join, parentOf, baseOf, validName,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    reset() { seed(); emit(); }
  };
})();

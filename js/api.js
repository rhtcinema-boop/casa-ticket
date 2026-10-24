// casa チケット — データ層(ローカル優先 + 自動同期)
// 入力はすべて端末内に即反映し、未送信キューに積む。保存のたびに自動で Apps Script に送り(op:'batch')、
// 返ってきた最新状態を取り込む。GAS_URL が空ならテストモード(端末内で確定するだけ)。
(function (g) {
  const CFG = g.TICKET_CONFIG || {};
  const HAS_GAS = !!CFG.GAS_URL;
  const LS_KEY = 'tk.v1';
  const TABLES = ['stores', 'staff', 'kinds', 'purchases', 'sats', 'sales', 'budgets', 'labels'];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = o => JSON.parse(JSON.stringify(o));
  const empty = () => { const s = {}; TABLES.forEach(t => { s[t] = []; }); return s; };

  let db;
  function load() {
    try { db = JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (e) { db = null; }
    if (!db || !db.server) db = { server: empty(), pending: [], syncedAt: 0 };
    TABLES.forEach(t => { if (!db.server[t]) db.server[t] = []; });
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) { } }
  load();

  // ---------- 操作の適用(純粋関数) ----------
  function applyOp(st, op) {
    const list = st[op.table]; if (!list) return st;
    const id = String(op.id || (op.row && op.row.id) || '');
    const i = list.findIndex(r => String(r.id) === id);
    if (op.op === 'del') { if (i >= 0) list.splice(i, 1); }
    else if (op.op === 'put') { const row = Object.assign({}, op.row, { id }); if (i >= 0) list[i] = row; else list.push(row); }
    return st;
  }
  function view() {
    const st = db.pending.reduce(applyOp, clone(db.server));
    st.pendingCount = db.pending.length;
    st.syncedAt = db.syncedAt;
    st.mode = HAS_GAS ? 'gas' : 'local';
    return st;
  }

  // ---------- 同期 ----------
  let syncing = null, timer = null, lastError = '';
  const listeners = new Set();
  const notify = () => listeners.forEach(f => { try { f(); } catch (e) { } });
  const TIMEOUT_MS = CFG.SYNC_TIMEOUT_MS || 30000;
  async function fetchT(url, init) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let t;
    const timeout = new Promise((_, rej) => { t = setTimeout(() => { if (ctl) ctl.abort(); rej(new Error('通信がタイムアウトしました')); }, TIMEOUT_MS); });
    try { return await Promise.race([fetch(url, Object.assign({}, init, ctl ? { signal: ctl.signal } : {})), timeout]); }
    finally { clearTimeout(t); }
  }
  async function call(body) {
    const r = body
      ? await fetchT(CFG.GAS_URL, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
      : await fetchT(`${CFG.GAS_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  }
  function takeServer(s) {
    TABLES.forEach(t => { db.server[t] = s[t] || []; });
    db.syncedAt = Date.now();
  }
  function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const ops = db.pending.slice();
        if (!HAS_GAS) {
          db.server = ops.reduce(applyOp, db.server); db.pending = db.pending.filter(o => !ops.includes(o)); db.syncedAt = Date.now(); save();
          lastError = ''; return view();
        }
        const s = ops.length ? await call({ op: 'batch', ops }) : await call(null);
        const sent = new Set(ops.map(o => o.opId));
        db.pending = db.pending.filter(o => !sent.has(o.opId));
        takeServer(s); save(); lastError = '';
        return view();
      } catch (e) { lastError = e.message || String(e); throw e; }
      finally { syncing = null; notify(); }
    })();
    notify();
    return syncing;
  }
  // 保存のたびに少し待ってから自動同期(連続入力は1回にまとめる)
  function scheduleSync() {
    clearTimeout(timer);
    timer = setTimeout(() => { sync().catch(() => { }); }, 600);
  }
  function push(op) {
    op.opId = uid();
    // 同じ行への未送信 put は最後のものだけ残す
    const id = String(op.id || (op.row && op.row.id));
    db.pending = db.pending.filter(o => !(o.table === op.table && String(o.id || (o.row && o.row.id)) === id && !o.inFlight));
    db.pending.push(op); save(); scheduleSync(); notify();
    return view();
  }

  g.TicketAPI = {
    mode: HAS_GAS ? 'gas' : 'local',
    uid,
    view,
    put: (table, row) => push({ op: 'put', table, row: Object.assign({}, row, { id: String(row.id || uid()) }) }),
    del: (table, id) => push({ op: 'del', table, id: String(id) }),
    sync,
    isSyncing: () => !!syncing,
    lastError: () => lastError,
    onChange: f => { listeners.add(f); return () => listeners.delete(f); },
    _applyOp: applyOp,
  };
})(typeof window !== 'undefined' ? window : globalThis);

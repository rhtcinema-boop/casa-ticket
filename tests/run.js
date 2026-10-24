// casa チケット — 自動テスト(node tests/run.js)
// 本物の gas/Code.gs を、Google スプレッドシートを真似たモックの上で動かし、js/model.js と js/api.js と組み合わせて確認する。
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');

function makeSheets() {
  const sheets = [];
  const isDateText = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  function Sheet(name) {
    const sh = { name, rows: [], fmt: {} };
    const conv = (r, c, v) => (isDateText(v) && sh.fmt[r + ':' + c] !== '@') ? new Date(v + 'T00:00:00+09:00') : v;
    const ensure = (r, c) => { while (sh.rows.length < r) sh.rows.push([]); const row = sh.rows[r - 1]; while (row.length < c) row.push(''); };
    const range = (r, c, nr = 1, nc = 1) => ({
      setValue(v) { ensure(r, c); sh.rows[r - 1][c - 1] = conv(r, c, v); return this; },
      setValues(vs) { vs.forEach((row, i) => row.forEach((v, j) => { ensure(r + i, c + j); sh.rows[r + i - 1][c + j - 1] = conv(r + i, c + j, v); })); return this; },
      setNumberFormat(f) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.fmt[(r + i) + ':' + (c + j)] = f; return this; },
      setFontWeight() { return this; },
    });
    Object.assign(sh, {
      appendRow(vals) { const r = sh.rows.length + 1; sh.rows.push([]); vals.forEach((v, j) => { ensure(r, j + 1); sh.rows[r - 1][j] = conv(r, j + 1, v); }); },
      getDataRange() { const w = Math.max(1, ...sh.rows.map(x => x.length)); return { getValues: () => sh.rows.length ? sh.rows.map(x => { const y = x.slice(); while (y.length < w) y.push(''); return y; }) : [['']] }; },
      getRange: (a, b, c, d) => range(a, b, c, d),
      getLastRow: () => sh.rows.length,
      deleteRow(r) { sh.rows.splice(r - 1, 1); },
      setFrozenRows() {},
    });
    return sh;
  }
  const ss = { getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet(n) { const s = Sheet(n); sheets.push(s); return s; } };
  return { ss, sheets };
}
function loadGas() {
  const mock = makeSheets();
  const ctx = {
    SpreadsheetApp: { getActive: () => mock.ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: d => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, s }) },
    Date, JSON, Math, Number, String, Object, isNaN,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas/Code.gs'), 'utf8'), ctx);
  return { ctx, mock, get: () => JSON.parse(ctx.doGet().s), post: body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s) };
}
function loadClient(gas, opts = {}) {
  const store = {};
  const win = { TICKET_CONFIG: { GAS_URL: opts.local ? '' : 'https://gas.example/exec', SYNC_TIMEOUT_MS: 200 }, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  let fail = false;
  win.fetch = async (url, init) => { if (fail) throw new Error('offline'); const body = init && init.method === 'POST' ? gas.post(JSON.parse(init.body)) : gas.get(); return { ok: true, json: async () => body }; };
  const ctx = vm.createContext({ window: win, localStorage: win.localStorage, fetch: (...a) => win.fetch(...a), URL, Date, JSON, Math, Object, Number, String, Set, Promise, setTimeout, clearTimeout, AbortController, console });
  ctx.globalThis = ctx;
  for (const f of ['js/labels.js', 'js/model.js', 'js/api.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
  return { M: win.TicketModel, API: win.TicketAPI, L: win.Labels, setFail: v => { fail = v; } };
}

const tests = []; const test = (n, f) => tests.push({ n, f });
const TODAY = '2026-10-25';
function sample(M) {
  return {
    stores: [{ id: 's1', name: '新宿店' }], staff: [], labels: [],
    kinds: [{ id: 'kJ', store: 's1', name: 'JOPT', unit: 30000, eventDate: '2026-12-20' }, { id: 'kK', store: 's1', name: 'KK', unit: 5000, eventDate: '2026-11-05' }, { id: 'kO', store: 's1', name: 'OLD', unit: 1000, eventDate: '2026-10-01' }],
    purchases: [
      { id: 'p1', store: 's1', kind: 'kJ', payDate: '2026-10-05', unit: 30000, qty: 30, total: 900000, paid: 1, arriveDate: '2026-10-07' },
      { id: 'p2', store: 's1', kind: 'kK', payDate: '2026-10-20', unit: 5000, qty: 50, total: 250000, paid: 0, arriveDate: '2026-11-01' },
      { id: 'p3', store: 's1', kind: 'kO', payDate: '2026-09-01', unit: 1000, qty: 10, total: 10000, paid: 1, arriveDate: '2026-09-02' },
    ],
    sats: [
      { id: 'a1', store: 's1', date: '2026-10-01', time: '19:00', kind: 'kJ', plan: 2, actual: 2 },
      { id: 'a2', store: 's1', date: '2026-10-06', time: '19:00', kind: 'kJ', plan: 2, actual: 1 },
      { id: 'a3', store: 's1', date: '2026-10-03', time: '15:00', kind: 'kJ', plan: 3, actual: 2 },
      { id: 'a4', store: 's1', date: '2026-10-08', time: '19:00', kind: 'kJ', plan: 2, actual: '' },
      { id: 'a5', store: 's1', date: '2026-10-29', time: '19:00', kind: 'kJ', plan: 2, actual: '' },
      { id: 'a6', store: 's2', date: '2026-10-29', time: '19:00', kind: 'kJ', plan: 9, actual: 9 },
    ],
    sales: [{ id: 'h1', store: 's1', date: '2026-10-10', kind: 'kJ', qty: 1, price: 28000 }],
    budgets: [{ id: 'b1', store: 's1', ym: '2026-10', kind: 'kJ', qty: 20 }, { id: 'b2', store: 's1', ym: '2026-10', kind: 'kK', qty: 40 }],
  };
}

test('月次集計: 予定・実・未付与・手売り・購入・経費・繰越', () => {
  const { M } = loadClient(loadGas(), { local: true });
  const m = M.month(sample(M), 's1', '2026-10', { today: TODAY });
  assert.strictEqual(m.plan, 11); assert.strictEqual(m.actual, 5); assert.strictEqual(m.unspent, 2);
  assert.strictEqual(m.sold, 1); assert.strictEqual(m.saleAmount, 28000); assert.strictEqual(m.used, 6);
  assert.strictEqual(m.bought, 80); assert.strictEqual(m.boughtAmount, 1150000);
  assert.strictEqual(m.cost, 900000, '支払済の請求書だけ経費');
  assert.strictEqual(m.unpaid.length, 1);
  assert.strictEqual(m.budgetQty, 60); assert.strictEqual(m.budgetAmount, 800000);
  assert.strictEqual(m.pendingSats.length, 1, '過去で未入力は1件(未来は含めない)');
  assert.strictEqual(m.carry, 24, 'JOPT 30-5-1。入荷待ちと失効は含めない');
  assert.strictEqual(m.expiredLeft, 10);
});
test('在庫: 到着前は入荷待ち、期限切れは失効、期限が近いと警告', () => {
  const { M } = loadClient(loadGas(), { local: true });
  const s = M.stock(sample(M), 's1', TODAY, 14);
  const k = id => s.find(x => x.kind.id === id);
  assert.deepStrictEqual([k('kJ').left, k('kJ').waiting, k('kJ').warn], [24, 0, false]);
  assert.deepStrictEqual([k('kK').left, k('kK').waiting, k('kK').warn, k('kK').daysLeft], [0, 50, false, 11]);
  assert.deepStrictEqual([k('kO').left, k('kO').expired], [10, true]);
  const s2 = M.stock(sample(M), 's1', '2026-11-02', 14);
  assert.deepStrictEqual([k('kK').waiting, s2.find(x => x.kind.id === 'kK').left, s2.find(x => x.kind.id === 'kK').warn], [50, 50, true]);
});
test('前月を見ると月末時点の在庫で繰越を出す', () => {
  const { M } = loadClient(loadGas(), { local: true });
  const m = M.month(sample(M), 's1', '2026-09', { today: TODAY });
  assert.strictEqual(m.asOf, '2026-09-30');
  assert.strictEqual(m.carry, 10, '9月末時点では OLD はまだ期限内 → 繰越 10枚');
});
test('週次一括: 曜日で生成し、登録済みは飛ばす', () => {
  const { M } = loadClient(loadGas(), { local: true });
  const rows = M.bulkSats(sample(M), 's1', '2026-10', [2, 4], '19:00', 'kJ', 2, 'x');
  assert.strictEqual(rows.length, 5, '火木9回のうち 10/1, 10/6, 10/8, 10/29 は登録済み → 5');
});
test('レポート文に主要な数字が入る', () => {
  const c = loadClient(loadGas(), { local: true });
  const m = c.M.month(sample(c.M), 's1', '2026-10', { today: TODAY });
  const t = c.M.report(m, '新宿店', c.L.get);
  assert.ok(t.includes('【新宿店】2026年10月')); assert.ok(t.includes('未付与 2枚')); assert.ok(t.includes('翌月繰越 24枚')); assert.ok(t.includes('失効 10枚'));
});
test('文言: 上書きと戻し', () => {
  const { L } = loadClient(loadGas(), { local: true });
  L.setOverride({ 'home.unspent': '吐き残し' }); assert.strictEqual(L.get('home.unspent'), '吐き残し');
  L.setOverride({ 'home.unspent': '' }); assert.strictEqual(L.get('home.unspent'), '未付与');
});
test('同期: put/del がシートに反映され、削除は deleted=1 で残る', async () => {
  const gas = loadGas(); const c = loadClient(gas);
  c.API.put('stores', { id: 'st1', name: '新宿店', order: 1 });
  c.API.put('kinds', { id: 'k1', store: 'st1', name: 'JOPT', unit: 30000, eventDate: '2026-12-20', order: 1 });
  c.API.put('sats', { id: 'a1', store: 'st1', date: '2026-10-01', time: '19:00', kind: 'k1', plan: 2, actual: '' });
  assert.strictEqual(c.API.view().sats.length, 1, '送る前から画面には出る');
  await c.API.sync();
  let s = gas.get();
  assert.strictEqual(s.kinds[0].eventDate, '2026-12-20', '日付が文字列のまま');
  assert.strictEqual(s.sats[0].date, '2026-10-01');
  assert.strictEqual(s.sats[0].actual, '', '未入力は空のまま');
  c.API.put('sats', Object.assign({}, c.API.view().sats[0], { actual: 2 }));
  c.API.del('stores', 'st1');
  await c.API.sync();
  s = gas.get();
  assert.strictEqual(s.sats[0].actual, 2); assert.strictEqual(s.stores.length, 0);
  const rows = gas.mock.ss.getSheetByName('店舗').rows;
  assert.strictEqual(rows.length, 2); assert.strictEqual(rows[1][3], 1, '行は残り deleted=1');
  assert.strictEqual(c.API.view().pendingCount, 0);
});
test('同期: 通信失敗でも入力は残り、復帰後に送られる', async () => {
  const gas = loadGas(); const c = loadClient(gas);
  c.API.put('staff', { id: 'f1', name: '神崎', order: 1 });
  c.setFail(true);
  await assert.rejects(c.API.sync());
  assert.strictEqual(c.API.view().pendingCount, 1); assert.ok(c.API.lastError());
  c.setFail(false);
  await c.API.sync();
  assert.strictEqual(gas.get().staff[0].name, '神崎'); assert.strictEqual(c.API.lastError(), '');
});
test('同期: 同じ行への連続 put は最後だけ送る', async () => {
  const gas = loadGas(); const c = loadClient(gas);
  let posts = 0; const orig = gas.post; gas.post = b => { posts++; assert.strictEqual(b.ops.length, 1); return orig(b); };
  c.API.put('labels', { id: 'home.plan', value: 'A' }); c.API.put('labels', { id: 'home.plan', value: 'B' });
  await c.API.sync();
  assert.strictEqual(gas.get().labels[0].value, 'B'); assert.strictEqual(posts, 1);
});

(async () => {
  let ng = 0;
  for (const t of tests) { try { await t.f(); console.log('ok   ' + t.n); } catch (e) { ng++; console.log('NG   ' + t.n + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n     ')); } }
  console.log(ng ? `\n${ng} failed` : `\nall ${tests.length} passed`);
  process.exit(ng ? 1 : 0);
})();

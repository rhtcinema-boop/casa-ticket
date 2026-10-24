// casa チケット — 集計(純粋関数。ブラウザとテストで共用)
(function (g) {
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const pad = v => String(v).padStart(2, '0');
  const todayJST = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); };
  const ymOf = d => (d || '').slice(0, 7);
  const daysIn = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const addMonth = (ym, k) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const endOf = ym => `${ym}-${pad(daysIn(ym))}`;
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400e3);

  const byStore = (list, store) => list.filter(r => String(r.store) === String(store));

  // 券種ごとの在庫(asOf 時点まで)。到着日が asOf より後なら入荷待ち。
  function stock(st, store, asOf, warnDays) {
    asOf = asOf || todayJST(); warnDays = warnDays == null ? 14 : warnDays;
    const kinds = byStore(st.kinds, store);
    return kinds.map(k => {
      const kid = String(k.id);
      const ps = byStore(st.purchases, store).filter(p => String(p.kind) === kid);
      const arrived = ps.filter(p => !p.arriveDate || p.arriveDate <= asOf).reduce((s, p) => s + n(p.qty), 0);
      const waiting = ps.filter(p => p.arriveDate && p.arriveDate > asOf).reduce((s, p) => s + n(p.qty), 0);
      const paid = byStore(st.sats, store).filter(s => String(s.kind) === kid && s.date <= asOf).reduce((s, x) => s + n(x.actual), 0);
      const sold = byStore(st.sales, store).filter(s => String(s.kind) === kid && s.date <= asOf).reduce((s, x) => s + n(x.qty), 0);
      const left = arrived - paid - sold;
      const expired = !!(k.eventDate && k.eventDate < asOf);
      const daysLeft = k.eventDate ? daysBetween(asOf, k.eventDate) : null;
      return { kind: k, arrived, waiting, paid, sold, left, expired, daysLeft, warn: !expired && daysLeft != null && daysLeft <= warnDays && left > 0 };
    });
  }

  // 月次サマリー(店舗 × 月)
  function month(st, store, ym, opts) {
    opts = opts || {};
    const today = opts.today || todayJST();
    const asOf = endOf(ym) < today ? endOf(ym) : today;
    const kinds = byStore(st.kinds, store);
    const kname = id => { const k = kinds.find(k => String(k.id) === String(id)); return k ? k.name : '?'; };
    const unitOf = id => { const k = kinds.find(k => String(k.id) === String(id)); return k ? n(k.unit) : 0; };

    const sats = byStore(st.sats, store).filter(s => ymOf(s.date) === ym).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const entered = sats.filter(s => s.actual !== '' && s.actual != null);
    const pendingSats = sats.filter(s => (s.actual === '' || s.actual == null) && s.date < today);
    const plan = sats.reduce((s, x) => s + n(x.plan), 0);
    const actual = entered.reduce((s, x) => s + n(x.actual), 0);
    const unspent = entered.reduce((s, x) => s + Math.max(0, n(x.plan) - n(x.actual)), 0);

    const sales = byStore(st.sales, store).filter(s => ymOf(s.date) === ym);
    const sold = sales.reduce((s, x) => s + n(x.qty), 0);
    const saleAmount = sales.reduce((s, x) => s + n(x.price), 0);

    const purchases = byStore(st.purchases, store).filter(p => ymOf(p.payDate) === ym);
    const bought = purchases.reduce((s, p) => s + n(p.qty), 0);
    const boughtAmount = purchases.reduce((s, p) => s + n(p.total), 0);
    const cost = purchases.filter(p => n(p.paid)).reduce((s, p) => s + n(p.total), 0); // 支払った月に全額
    const unpaid = byStore(st.purchases, store).filter(p => !n(p.paid));

    const budgets = byStore(st.budgets, store).filter(b => b.ym === ym);
    const budgetQty = budgets.reduce((s, b) => s + n(b.qty), 0);
    const budgetAmount = budgets.reduce((s, b) => s + n(b.qty) * unitOf(b.kind), 0);

    // 券種ごとの内訳
    const perKind = kinds.map(k => {
      const kid = String(k.id);
      const ks = sats.filter(s => String(s.kind) === kid), ke = entered.filter(s => String(s.kind) === kid);
      const b = budgets.find(b => String(b.kind) === kid);
      return {
        kind: k, budget: b ? n(b.qty) : 0,
        plan: ks.reduce((s, x) => s + n(x.plan), 0), actual: ke.reduce((s, x) => s + n(x.actual), 0),
        sold: sales.filter(s => String(s.kind) === kid).reduce((s, x) => s + n(x.qty), 0),
        bought: purchases.filter(p => String(p.kind) === kid).reduce((s, p) => s + n(p.qty), 0),
      };
    }).filter(x => x.budget || x.plan || x.actual || x.sold || x.bought);

    const stk = stock(st, store, asOf, opts.warnDays);
    const carry = stk.filter(x => !x.expired).reduce((s, x) => s + Math.max(0, x.left), 0); // 月末時点の残り = 翌月繰越
    const expiredLeft = stk.filter(x => x.expired && x.left > 0).reduce((s, x) => s + x.left, 0);

    return {
      store, ym, asOf, sats, entered, pendingSats, plan, actual, unspent, used: actual + sold, rate: plan ? actual / plan : 0,
      sales, sold, saleAmount, purchases, bought, boughtAmount, cost, unpaid, budgets, budgetQty, budgetAmount, perKind, stock: stk, carry, expiredLeft, kname,
    };
  }

  // レポート文(LINE 貼り付け用)
  function report(m, storeName, L) {
    L = L || (k => k);
    const yen = v => '¥' + n(v).toLocaleString('ja-JP');
    const num = v => n(v).toLocaleString('ja-JP');
    const lines = [`【${storeName}】${m.ym.replace('-', '年')}月 チケット収支`];
    lines.push(`${L('home.budget')} ${num(m.budgetQty)}枚（${yen(m.budgetAmount)}）`);
    lines.push(`${L('home.plan')} ${num(m.plan)}枚 / ${L('home.actual')} ${num(m.actual)}枚（${L('home.rate')} ${(m.rate * 100).toFixed(0)}%）`);
    lines.push(`${L('home.unspent')} ${num(m.unspent)}枚`);
    lines.push(`${L('home.sale')} ${num(m.sold)}枚（${yen(m.saleAmount)}）`);
    lines.push(`${L('home.used')} ${num(m.used)}枚`);
    lines.push(`${L('home.bought')} ${num(m.bought)}枚 / ${yen(m.boughtAmount)}`);
    lines.push(`${L('home.cost')} ${yen(m.cost)}`);
    if (m.unpaid.length) lines.push(`${L('home.unpaid')} ${m.unpaid.length}件 ${yen(m.unpaid.reduce((s, p) => s + n(p.total), 0))}`);
    if (m.perKind.length) {
      lines.push('―― 券種別 ――');
      m.perKind.forEach(x => lines.push(`${x.kind.name}: ${L('home.plan')}${num(x.plan)} / ${L('home.actual')}${num(x.actual)} / ${L('home.sale')}${num(x.sold)}`));
    }
    lines.push('―― 在庫 ――');
    m.stock.filter(x => x.left || x.waiting).forEach(x => lines.push(`${x.kind.name}: ${num(x.left)}枚${x.waiting ? `（${L('home.stockWait')} ${num(x.waiting)}）` : ''}${x.expired ? `（${L('home.stockExpired')}）` : ''}`));
    lines.push(`${L('home.carry')} ${num(m.carry)}枚`);
    if (m.expiredLeft) lines.push(`${L('home.stockExpired')} ${num(m.expiredLeft)}枚`);
    return lines.join('\n');
  }

  // 週次スケジュールから月のサテを作る(すでにある 日付+時間+券種 は飛ばす)
  function bulkSats(st, store, ym, weekdays, time, kind, plan, by) {
    const exists = new Set(byStore(st.sats, store).map(s => `${s.date}|${s.time}|${s.kind}`));
    const out = [];
    for (let d = 1; d <= daysIn(ym); d++) {
      const date = `${ym}-${pad(d)}`;
      const w = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, d).getDay();
      if (!weekdays.includes(w)) continue;
      if (exists.has(`${date}|${time}|${kind}`)) continue;
      out.push({ store, date, time, kind, plan: n(plan), actual: '', by, ts: Date.now() });
    }
    return out;
  }

  g.TicketModel = { n, pad, todayJST, ymOf, daysIn, addMonth, endOf, daysBetween, stock, month, report, bulkSats };
})(typeof window !== 'undefined' ? window : globalThis);

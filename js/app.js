// casa チケット — 画面
(() => {
  const API = window.TicketAPI, M = window.TicketModel, CFG = window.TICKET_CONFIG || {};
  const $ = id => document.getElementById(id);
  const n = M.n, pad = M.pad;
  const yen = v => '¥' + n(v).toLocaleString('ja-JP');
  const num = v => n(v).toLocaleString('ja-JP');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = M.todayJST();
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const fmtD = d => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}(${WD[new Date(d + 'T00:00:00').getDay()]})` : '-';
  const fmtYm = ym => `${ym.slice(0, 4)}年${+ym.slice(5, 7)}月`;

  // ---------- 画面の状態(端末に記憶) ----------
  const pref = (() => { try { return JSON.parse(localStorage.getItem('tk.pref')) || {}; } catch (e) { return {}; } })();
  const savePref = () => { try { localStorage.setItem('tk.pref', JSON.stringify(pref)); } catch (e) { } };
  let tab = pref.tab || 'home';
  let store = pref.store || '';
  let staff = pref.staff || '';
  let ym = today.slice(0, 7);
  let satYm = ym, saleYm = ym, buyYm = ym, budgetYm = ym;
  let st = API.view();

  // ---------- 便利 ----------
  function toast(t1, t2, err) {
    const el = $('toast'); $('toastT1').textContent = t1 || ''; $('toastT2').textContent = t2 || '';
    el.classList.toggle('err', !!err); el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }
  const kinds = (all) => st.kinds.filter(k => String(k.store) === String(store) && (all || !k.eventDate || k.eventDate >= today)).sort((a, b) => (a.eventDate || '9999').localeCompare(b.eventDate || '9999'));
  const kindName = id => { const k = st.kinds.find(k => String(k.id) === String(id)); return k ? k.name : '?'; };
  const kindUnit = id => { const k = st.kinds.find(k => String(k.id) === String(id)); return k ? n(k.unit) : 0; };
  const storeName = id => { const s = st.stores.find(s => String(s.id) === String(id)); return s ? s.name : ''; };
  function fillKinds(sel, keep) {
    const cur = keep ? sel.value : '';
    const ks = kinds(false);
    sel.innerHTML = ks.length ? ks.map(k => `<option value="${esc(k.id)}">${esc(k.name)}${k.eventDate ? `（${fmtD(k.eventDate)}）` : ''}</option>`).join('') : `<option value="">${esc(L('common.noKind'))}</option>`;
    if (cur && ks.some(k => String(k.id) === cur)) sel.value = cur;
  }
  function needStaff() { if (!staff) { toast(L('common.noStaff'), '', true); switchTab(tab); return false; } return true; }
  function needStore() { if (!store) { toast(L('common.noStore'), '', true); return false; } return true; }
  function needKind(v) { if (!v) { toast(L('common.noKind'), '', true); return false; } return true; }
  const staffName = () => { const s = st.staff.find(s => String(s.id) === String(staff)); return s ? s.name : ''; };

  // ---------- 描画 ----------
  function render() {
    st = API.view();
    Labels.setOverride(Object.fromEntries(st.labels.map(l => [l.id, l.value])));
    Labels.apply();
    // 店舗
    if (!st.stores.some(s => String(s.id) === String(store))) store = st.stores[0] ? String(st.stores[0].id) : '';
    $('storeSeg').innerHTML = st.stores.length ? st.stores.map(s => `<button data-store="${esc(s.id)}" class="${String(s.id) === String(store) ? 'on' : ''}">${esc(s.name)}</button>`).join('') : `<button class="on">${esc(L('common.noStore'))}</button>`;
    $('hTitle').textContent = storeName(store) || L('app.title');
    $('sheetLink').href = CFG.SHEET_URL || '#'; $('sheetLink').hidden = !CFG.SHEET_URL;
    // 入力者
    if (!st.staff.some(s => String(s.id) === String(staff))) staff = '';
    const chips = `<span class="lbl">${esc(L('common.by'))}</span>` + (st.staff.length ? st.staff.map(s => `<button data-staff="${esc(s.id)}" class="${String(s.id) === String(staff) ? 'on' : ''}">${esc(s.name)}</button>`).join('') : `<button data-go="set">${esc(L('set.addStaff'))}</button>`);
    ['staffChips1', 'staffChips2', 'staffChips3'].forEach(id => { $(id).innerHTML = chips; });
    // タブ
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + tab));
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    renderSync();
    renderHome(); renderSat(); renderSale(); renderBuy(); renderSet();
  }
  function renderSync() {
    const b = $('syncBtn'), s = $('syncSt');
    b.className = 'syncbtn';
    if (API.mode === 'local') { s.textContent = L('common.localMode'); return; }
    if (API.isSyncing()) { b.classList.add('spin'); s.textContent = L('common.syncing'); return; }
    if (API.lastError()) { b.classList.add('err'); s.textContent = L('common.syncErr'); return; }
    if (st.pendingCount) { b.classList.add('dirty'); s.textContent = st.pendingCount + L('common.pending'); return; }
    s.textContent = st.syncedAt ? L('common.synced') + ' ' + new Date(st.syncedAt).toTimeString().slice(0, 5) : '';
  }

  function renderHome() {
    $('mLabel').textContent = fmtYm(ym);
    if (!store) { $('alerts').innerHTML = `<div class="empty">${esc(L('common.noStore'))}</div>`; $('tiles').innerHTML = ''; $('perKind').innerHTML = ''; $('stockList').innerHTML = ''; $('report').textContent = ''; return; }
    const m = M.month(st, store, ym, { today, warnDays: CFG.EXPIRE_WARN_DAYS });
    const stockNow = M.stock(st, store, today, CFG.EXPIRE_WARN_DAYS);
    // 警告
    const pendingAll = st.sats.filter(s => String(s.store) === String(store) && (s.actual === '' || s.actual == null) && s.date < today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const al = [];
    pendingAll.forEach(s => al.push(`<div class="row alert" data-go="sat" data-ym="${s.date.slice(0, 7)}"><div><div class="main">${esc(L('home.alertSat'))}</div><div class="sub">${fmtD(s.date)} ${esc(s.time)} ${esc(kindName(s.kind))} ${L('home.plan')}${num(s.plan)}</div></div><div class="right">›</div></div>`));
    m.unpaid.forEach(p => al.push(`<div class="row alert" data-go="buy" data-ym="${(p.payDate || '').slice(0, 7)}"><div><div class="main">${esc(L('home.alertUnpaid'))}</div><div class="sub">${fmtD(p.payDate)} ${esc(kindName(p.kind))} ${num(p.qty)}枚</div></div><div class="right">${yen(p.total)}</div></div>`));
    stockNow.filter(x => x.warn).forEach(x => al.push(`<div class="row" data-go="home"><div><div class="main" style="color:#ff9500">${esc(L('home.alertExpire'))}</div><div class="sub">${esc(x.kind.name)} ${fmtD(x.kind.eventDate)}</div></div><div class="right">${num(x.left)}枚<small>${L('home.left')} ${x.daysLeft}日</small></div></div>`));
    stockNow.filter(x => x.expired && x.left > 0).forEach(x => al.push(`<div class="row alert"><div><div class="main">${esc(L('home.alertExpired'))}</div><div class="sub">${esc(x.kind.name)} ${fmtD(x.kind.eventDate)}</div></div><div class="right">${num(x.left)}枚</div></div>`));
    $('alerts').innerHTML = al.length ? `<div class="list">${al.join('')}</div>` : `<div class="empty">${esc(L('home.noAlert'))}</div>`;
    $('dotHome').hidden = !al.some(x => x.includes('row alert'));
    // タイル
    $('tiles').innerHTML = `
      <div><span>${esc(L('home.budget'))}</span><b>${num(m.budgetQty)}</b><small>${yen(m.budgetAmount)}</small></div>
      <div><span>${esc(L('home.plan'))}</span><b>${num(m.plan)}</b><small>${esc(L('home.satCount'))} ${m.sats.length}</small></div>
      <div><span>${esc(L('home.actual'))}</span><b>${num(m.actual)}</b><small>${esc(L('home.rate'))} ${(m.rate * 100).toFixed(0)}%</small></div>
      <div><span>${esc(L('home.unspent'))}</span><b class="${m.unspent ? 'warn' : 'ok'}">${num(m.unspent)}</b></div>
      <div><span>${esc(L('home.sale'))}</span><b>${num(m.sold)}</b><small>${yen(m.saleAmount)}</small></div>
      <div><span>${esc(L('home.used'))}</span><b>${num(m.used)}</b></div>
      <div><span>${esc(L('home.bought'))}</span><b>${num(m.bought)}</b><small>${yen(m.boughtAmount)}</small></div>
      <div><span>${esc(L('home.cost'))}</span><b>${yen(m.cost)}</b></div>
      <div><span>${esc(L('home.carry'))}</span><b>${num(m.carry)}</b><small>${esc(L('common.sheets'))}</small></div>`;
    // 券種別
    $('perKind').innerHTML = m.perKind.length ? m.perKind.map(x => `<div class="row"><div><div class="main">${esc(x.kind.name)}</div><div class="sub">${esc(L('home.budget'))} ${num(x.budget)} / ${esc(L('home.plan'))} ${num(x.plan)} / ${esc(L('home.bought'))} ${num(x.bought)}</div></div><div class="right">${num(x.actual)}<small>${esc(L('home.sale'))} ${num(x.sold)}</small></div></div>`).join('') : '';
    // 在庫(今日時点)
    $('stockList').innerHTML = stockNow.length ? `<div class="list">${stockNow.filter(x => x.left || x.waiting || !x.expired).map(x => `<div class="row"><div><div class="main">${esc(x.kind.name)}${x.expired ? ` <span class="tag ng">${esc(L('set.expired'))}</span>` : x.warn ? ` <span class="tag warn">${esc(L('home.left'))} ${x.daysLeft}日</span>` : ''}</div><div class="sub">${x.kind.eventDate ? fmtD(x.kind.eventDate) + ' ・ ' : ''}${yen(x.kind.unit)}${x.waiting ? ` ・ ${esc(L('home.stockWait'))} ${num(x.waiting)}` : ''}</div></div><div class="right ${x.left < 0 ? 'neg' : ''}">${num(x.left)}<small>${esc(L('home.stockIn'))}</small></div></div>`).join('')}</div>` : `<div class="empty">${esc(L('common.noKind'))}</div>`;
    $('report').textContent = M.report(m, storeName(store), L);
  }

  function renderSat() {
    $('sLabel').textContent = fmtYm(satYm);
    fillKinds($('s-kind'), true); fillKinds($('b-kind'), true);
    if (!$('s-date').value) $('s-date').value = today;
    if (!$('b-ym').value) $('b-ym').value = ym;
    const only = $('s-onlyPending').checked;
    let list = st.sats.filter(s => String(s.store) === String(store) && s.date.slice(0, 7) === satYm);
    if (only) list = list.filter(s => s.actual === '' || s.actual == null);
    list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    $('satList').innerHTML = list.length ? list.map(s => {
      const pending = s.actual === '' || s.actual == null, past = s.date < today;
      const un = pending ? null : n(s.plan) - n(s.actual);
      return `<div class="row ${pending && past ? 'alert' : ''}"><div><div class="main">${fmtD(s.date)} ${esc(s.time)} ・ ${esc(kindName(s.kind))}</div><div class="sub">${esc(L('sat.plan'))} ${num(s.plan)}${pending ? ` ・ <b>${esc(L('sat.notEntered'))}</b>` : ` ・ ${esc(L('sat.unspent'))} ${num(un)}`}${s.by ? ' ・ ' + esc(s.by) : ''}</div></div>
        <div class="acts"><input class="inl" type="number" inputmode="numeric" data-sat="${esc(s.id)}" value="${pending ? '' : esc(s.actual)}" placeholder="${esc(L('common.qty'))}"><button class="danger" data-delsat="${esc(s.id)}">${esc(L('common.delete'))}</button></div></div>`;
    }).join('') : `<div class="empty">—</div>`;
  }

  function renderSale() {
    $('hLabel').textContent = fmtYm(saleYm);
    fillKinds($('h-kind'), true);
    if (!$('h-date').value) $('h-date').value = today;
    const list = st.sales.filter(s => String(s.store) === String(store) && s.date.slice(0, 7) === saleYm).sort((a, b) => (b.date + b.ts).localeCompare(a.date + a.ts));
    const tq = list.reduce((s, x) => s + n(x.qty), 0), tp = list.reduce((s, x) => s + n(x.price), 0);
    $('saleList').innerHTML = (list.length ? list.map(s => `<div class="row"><div><div class="main">${fmtD(s.date)} ・ ${esc(kindName(s.kind))}</div><div class="sub">${num(s.qty)}枚${s.by ? ' ・ ' + esc(s.by) : ''}</div></div><div class="acts"><div class="right">${yen(s.price)}</div><button class="danger" data-delsale="${esc(s.id)}">${esc(L('common.delete'))}</button></div></div>`).join('') : `<div class="empty">—</div>`)
      + (list.length ? `<div class="row"><div class="main">${esc(L('sale.total'))}</div><div class="right">${num(tq)}枚<small>${yen(tp)}</small></div></div>` : '');
  }

  function renderBuy() {
    $('pLabel').textContent = fmtYm(buyYm);
    fillKinds($('p-kind'), true);
    if (!$('p-pay').value) $('p-pay').value = today;
    if (!$('p-unit').value && $('p-kind').value) $('p-unit').value = kindUnit($('p-kind').value) || '';
    const list = st.purchases.filter(p => String(p.store) === String(store) && (p.payDate || '').slice(0, 7) === buyYm).sort((a, b) => (b.payDate || '').localeCompare(a.payDate || ''));
    $('buyList').innerHTML = list.length ? list.map(p => {
      const wait = p.arriveDate && p.arriveDate > today;
      return `<div class="row ${n(p.paid) ? '' : 'alert'}"><div><div class="main">${fmtD(p.payDate)} ・ ${esc(kindName(p.kind))} ${num(p.qty)}枚</div><div class="sub">${yen(p.unit)} × ${num(p.qty)} ・ ${esc(L('buy.arrive'))} ${fmtD(p.arriveDate)} <span class="tag ${wait ? 'wait' : 'ok'}">${esc(wait ? L('buy.waiting') : L('buy.arrived'))}</span>${p.note ? ' ・ ' + esc(p.note) : ''}</div></div>
        <div class="acts"><div class="right">${yen(p.total)}</div><label class="tag ${n(p.paid) ? 'ok' : 'ng'}" style="display:flex;align-items:center;gap:4px"><input type="checkbox" data-paid="${esc(p.id)}" ${n(p.paid) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--blue)">${esc(n(p.paid) ? L('buy.paidTag') : L('buy.unpaid'))}</label><button class="danger" data-delbuy="${esc(p.id)}">${esc(L('common.delete'))}</button></div></div>`;
    }).join('') : `<div class="empty">—</div>`;
  }

  function renderSet() {
    $('storeList').innerHTML = st.stores.length ? `<div class="list">${st.stores.map(s => `<div class="row"><input type="text" value="${esc(s.name)}" data-edit="stores:${esc(s.id)}" style="padding:7px 10px"><button class="danger" data-del="stores:${esc(s.id)}">${esc(L('common.delete'))}</button></div>`).join('')}</div>` : '';
    $('staffList').innerHTML = st.staff.length ? `<div class="list">${st.staff.map(s => `<div class="row"><input type="text" value="${esc(s.name)}" data-edit="staff:${esc(s.id)}" style="padding:7px 10px"><button class="danger" data-del="staff:${esc(s.id)}">${esc(L('common.delete'))}</button></div>`).join('')}</div>` : '';
    const ks = kinds($('k-showExpired').checked);
    $('kindList').innerHTML = ks.length ? `<div class="list">${ks.map(k => `<div class="row" style="grid-template-columns:1fr auto"><div class="grid" style="grid-template-columns:2fr 1fr 1.3fr;gap:6px"><input type="text" value="${esc(k.name)}" data-kind="${esc(k.id)}:name" style="padding:7px 8px"><input type="number" value="${esc(k.unit)}" data-kind="${esc(k.id)}:unit" style="padding:7px 8px"><input type="date" value="${esc(k.eventDate || '')}" data-kind="${esc(k.id)}:eventDate" style="padding:7px 8px"></div><button class="danger" data-del="kinds:${esc(k.id)}">${esc(L('common.delete'))}</button></div>`).join('')}</div>` : `<div class="empty">—</div>`;
    // 予算
    $('bgLabel').textContent = fmtYm(budgetYm);
    const bks = kinds(false);
    const bg = id => { const b = st.budgets.find(b => String(b.store) === String(store) && b.ym === budgetYm && String(b.kind) === String(id)); return b ? n(b.qty) : ''; };
    $('budgetList').innerHTML = bks.length ? `<div class="list">${bks.map(k => `<div class="row"><div><div class="main">${esc(k.name)}</div><div class="sub">${yen(k.unit)}${k.eventDate ? ' ・ ' + fmtD(k.eventDate) : ''}</div></div><div class="acts"><input class="inl" type="number" inputmode="numeric" data-budget="${esc(k.id)}" value="${bg(k.id)}" placeholder="0"><span class="sub">${esc(L('common.sheets'))}</span></div></div>`).join('')}</div>` : `<div class="empty">${esc(L('common.noKind'))}</div>`;
    const tq = bks.reduce((s, k) => s + n(bg(k.id)), 0), ta = bks.reduce((s, k) => s + n(bg(k.id)) * n(k.unit), 0);
    $('budgetTotal').textContent = `${L('set.budgetTotal')}: ${num(tq)}枚 / ${yen(ta)}`;
    // 文言
    const q = ($('l-q').value || '').trim();
    const ov = Object.fromEntries(st.labels.map(l => [l.id, l.value]));
    const keys = Labels.keys().filter(k => !q || k.includes(q) || Labels.DEFAULT[k].includes(q) || (ov[k] || '').includes(q));
    $('labelList').innerHTML = `<div class="list">${keys.map(k => `<div class="row" style="grid-template-columns:1fr 1.4fr;gap:8px"><div><div class="main" style="font-size:13px">${esc(Labels.DEFAULT[k])}</div><div class="sub" style="font-family:ui-monospace,Menlo,monospace">${esc(k)}</div></div><input type="text" data-label="${esc(k)}" value="${esc(ov[k] || '')}" placeholder="${esc(Labels.DEFAULT[k])}" style="padding:7px 10px;font-size:14px"></div>`).join('')}</div>`;
    $('modeHint').textContent = API.mode === 'local' ? L('common.localMode') : '';
  }

  // ---------- 操作 ----------
  function switchTab(t) { tab = t; pref.tab = t; savePref(); render(); window.scrollTo(0, 0); }
  document.querySelector('nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });
  $('storeSeg').addEventListener('click', e => { const b = e.target.closest('[data-store]'); if (!b) return; store = b.dataset.store; pref.store = store; savePref(); render(); });
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-staff]'); if (c) { staff = c.dataset.staff; pref.staff = staff; savePref(); render(); return; }
    const g = e.target.closest('[data-go]'); if (g && !e.target.closest('input')) { if (g.dataset.ym) { satYm = buyYm = g.dataset.ym; } switchTab(g.dataset.go); }
  });
  const monthNav = (prev, next, get, set) => { $(prev).onclick = () => { set(M.addMonth(get(), -1)); render(); }; $(next).onclick = () => { set(M.addMonth(get(), 1)); render(); }; };
  monthNav('mPrev', 'mNext', () => ym, v => { ym = v; });
  monthNav('sPrev', 'sNext', () => satYm, v => { satYm = v; });
  monthNav('hPrev', 'hNext', () => saleYm, v => { saleYm = v; });
  monthNav('pPrev', 'pNext', () => buyYm, v => { buyYm = v; });
  monthNav('bgPrev', 'bgNext', () => budgetYm, v => { budgetYm = v; });

  $('syncBtn').onclick = () => API.sync().then(() => toast(L('common.synced'))).catch(e => toast(L('common.syncErr'), e.message, true));
  API.onChange(() => { st = API.view(); renderSync(); });
  $('copyRep').onclick = async () => {
    const t = $('report').textContent;
    try { await navigator.clipboard.writeText(t); toast(L('common.copied')); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('report')); getSelection().removeAllRanges(); getSelection().addRange(r); toast(L('common.copied')); }
  };

  // サテ
  $('s-add').onclick = () => {
    if (!needStore() || !needStaff() || !needKind($('s-kind').value)) return;
    const date = $('s-date').value; if (!date) return toast(L('common.date'), '', true);
    const a = $('s-actual').value;
    API.put('sats', { store, date, time: $('s-time').value.trim(), kind: $('s-kind').value, plan: n($('s-plan').value), actual: a === '' ? '' : n(a), by: staffName(), ts: Date.now() });
    $('s-plan').value = ''; $('s-actual').value = ''; satYm = date.slice(0, 7);
    toast(L('common.saved')); render();
  };
  $('b-dow').innerHTML = WD.map((w, i) => `<button data-dow="${i}" class="${i === 0 || i === 6 ? '' : ''}">${w}</button>`).join('');
  $('b-dow').addEventListener('click', e => { const b = e.target.closest('[data-dow]'); if (b) b.classList.toggle('on'); });
  $('b-run').onclick = () => {
    if (!needStore() || !needStaff() || !needKind($('b-kind').value)) return;
    const days = [...$('b-dow').querySelectorAll('.on')].map(b => +b.dataset.dow);
    const m = $('b-ym').value; if (!days.length || !m) return toast(L('sat.bulkDays'), '', true);
    const rows = M.bulkSats(st, store, m, days, $('b-time').value.trim(), $('b-kind').value, $('b-plan').value, staffName());
    if (!rows.length) return toast(L('sat.bulkNone'), '', true);
    rows.forEach(r => API.put('sats', r));
    satYm = m; toast(rows.length + L('sat.bulkDone')); render();
  };
  $('s-onlyPending').onchange = render;
  $('satList').addEventListener('change', e => {
    const i = e.target.closest('[data-sat]'); if (!i) return;
    const s = st.sats.find(s => String(s.id) === i.dataset.sat); if (!s) return;
    API.put('sats', Object.assign({}, s, { actual: i.value === '' ? '' : n(i.value), by: staffName() || s.by, ts: Date.now() }));
    toast(L('common.saved')); render();
  });
  $('satList').addEventListener('click', e => {
    const b = e.target.closest('[data-delsat]'); if (!b) return;
    if (!confirm(L('common.confirmDel'))) return;
    API.del('sats', b.dataset.delsat); render();
  });

  // 手売り
  $('h-add').onclick = () => {
    if (!needStore() || !needStaff() || !needKind($('h-kind').value)) return;
    const date = $('h-date').value; if (!date) return;
    API.put('sales', { store, date, kind: $('h-kind').value, qty: n($('h-qty').value) || 1, price: n($('h-price').value), by: staffName(), ts: Date.now() });
    $('h-price').value = ''; $('h-qty').value = 1; saleYm = date.slice(0, 7);
    toast(L('common.saved')); render();
  };
  $('saleList').addEventListener('click', e => {
    const b = e.target.closest('[data-delsale]'); if (!b) return;
    if (!confirm(L('common.confirmDel'))) return;
    API.del('sales', b.dataset.delsale); render();
  });

  // 購入
  const calcTotal = () => { $('p-total').value = n($('p-unit').value) * n($('p-qty').value) || ''; };
  $('p-unit').addEventListener('input', calcTotal); $('p-qty').addEventListener('input', calcTotal);
  $('p-kind').addEventListener('change', () => { $('p-unit').value = kindUnit($('p-kind').value) || ''; calcTotal(); });
  $('p-add').onclick = () => {
    if (!needStore() || !needStaff() || !needKind($('p-kind').value)) return;
    const qty = n($('p-qty').value); if (!qty) return toast(L('common.qty'), '', true);
    const unit = n($('p-unit').value) || kindUnit($('p-kind').value);
    API.put('purchases', { store, kind: $('p-kind').value, payDate: $('p-pay').value, unit, qty, total: n($('p-total').value) || unit * qty, paid: $('p-paid').checked ? 1 : 0, arriveDate: $('p-arrive').value, note: $('p-note').value.trim(), by: staffName(), ts: Date.now() });
    $('p-qty').value = ''; $('p-total').value = ''; $('p-note').value = ''; $('p-paid').checked = false; buyYm = ($('p-pay').value || today).slice(0, 7);
    toast(L('common.saved')); render();
  };
  $('buyList').addEventListener('change', e => {
    const c = e.target.closest('[data-paid]'); if (!c) return;
    const p = st.purchases.find(p => String(p.id) === c.dataset.paid); if (!p) return;
    API.put('purchases', Object.assign({}, p, { paid: c.checked ? 1 : 0 })); render();
  });
  $('buyList').addEventListener('click', e => {
    const b = e.target.closest('[data-delbuy]'); if (!b) return;
    if (!confirm(L('common.confirmDel'))) return;
    API.del('purchases', b.dataset.delbuy); render();
  });

  // 設定
  $('st-add').onclick = () => { const v = $('st-name').value.trim(); if (!v) return; API.put('stores', { name: v, order: st.stores.length + 1 }); $('st-name').value = ''; render(); };
  $('sf-add').onclick = () => { const v = $('sf-name').value.trim(); if (!v) return; API.put('staff', { name: v, order: st.staff.length + 1 }); $('sf-name').value = ''; render(); };
  $('k-add').onclick = () => {
    if (!needStore()) return;
    const v = $('k-name').value.trim(); if (!v) return toast(L('set.kindName'), '', true);
    API.put('kinds', { store, name: v, unit: n($('k-unit').value), eventDate: $('k-date').value, order: st.kinds.length + 1 });
    $('k-name').value = ''; $('k-unit').value = ''; $('k-date').value = ''; render();
  };
  $('k-showExpired').onchange = render;
  $('tab-set').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.edit) { const [table, id] = t.dataset.edit.split(':'); const r = st[table].find(r => String(r.id) === id); if (r && t.value.trim()) API.put(table, Object.assign({}, r, { name: t.value.trim() })); render(); return; }
    if (t.dataset.kind) { const [id, f] = t.dataset.kind.split(':'); const k = st.kinds.find(k => String(k.id) === id); if (!k) return; const v = f === 'unit' ? n(t.value) : t.value.trim(); if (f === 'name' && !v) return; API.put('kinds', Object.assign({}, k, { [f]: v })); render(); return; }
    if (t.dataset.budget) { const id = `${store}|${budgetYm}|${t.dataset.budget}`; if (t.value === '') API.del('budgets', id); else API.put('budgets', { id, store, ym: budgetYm, kind: t.dataset.budget, qty: n(t.value) }); render(); return; }
    if (t.dataset.label) { const k = t.dataset.label; if (t.value.trim()) API.put('labels', { id: k, value: t.value.trim() }); else API.del('labels', k); render(); return; }
  });
  $('tab-set').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    if (!confirm(L('common.confirmDel'))) return;
    const [table, id] = b.dataset.del.split(':'); API.del(table, id); render();
  });
  $('l-q').addEventListener('input', renderSet);
  $('export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' }));
    a.download = `casa-ticket-${today}.json`; a.click();
  };

  // ---------- 起動 ----------
  render();
  if (API.mode === 'gas') API.sync().then(render).catch(e => toast(L('common.syncErr'), e.message, true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && API.mode === 'gas') API.sync().then(render).catch(() => { }); });
})();

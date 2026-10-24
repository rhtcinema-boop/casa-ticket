/**
 * casa チケット — Google Apps Script バックエンド
 *
 * スプレッドシートに「コンテナバインド」で貼り付けて
 * 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *   実行ユーザー: 自分 / アクセスできるユーザー: 全員
 * でデプロイし、表示された URL(…/exec)を config.js の GAS_URL に入れる。
 *
 * タブ構成(無ければ自動作成)。全テーブル共通で 1列目=id、最後の列=deleted(1なら削除扱い)。
 * 削除は行を消さずに deleted=1 にするだけ(履歴が残る)。
 */

var TABLES = {
  stores:    { sheet: '店舗',   head: ['id', 'name', 'order', 'deleted'] },
  staff:     { sheet: 'スタッフ', head: ['id', 'name', 'order', 'deleted'] },
  kinds:     { sheet: '券種',   head: ['id', 'store', 'name', 'unit', 'eventDate', 'order', 'deleted'] },
  purchases: { sheet: '購入',   head: ['id', 'store', 'kind', 'payDate', 'unit', 'qty', 'total', 'paid', 'arriveDate', 'note', 'by', 'ts', 'deleted'] },
  sats:      { sheet: 'サテ',   head: ['id', 'store', 'date', 'time', 'kind', 'plan', 'actual', 'by', 'ts', 'deleted'] },
  sales:     { sheet: '手売り', head: ['id', 'store', 'date', 'kind', 'qty', 'price', 'by', 'ts', 'deleted'] },
  budgets:   { sheet: '予算',   head: ['id', 'store', 'ym', 'kind', 'qty', 'deleted'] },
  labels:    { sheet: '文言',   head: ['id', 'value', 'deleted'] },
};
var TEXT_COLS = { id: 1, store: 1, kind: 1, date: 1, payDate: 1, arriveDate: 1, eventDate: 1, ym: 1, time: 1 }; // 日付などが勝手に変換されないよう文字列扱い

function doGet() { return json(state()); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.op === 'batch') batch(body.ops || [], body.by);
    else if (body.op === 'put' || body.op === 'del') batch([body], body.by);
    else if (body.op === 'wipeTest') wipeTest(body.prefix);
    else return json({ error: 'unknown op: ' + body.op });
    return json(state());
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- 読み出し: 全テーブルをまとめて返す ----------
function state() {
  var ss = SpreadsheetApp.getActive();
  var out = { serverTime: Date.now() };
  Object.keys(TABLES).forEach(function (t) {
    out[t] = rowsOf(sheet(ss, t)).filter(function (r) { return !Number(r.deleted); }).map(function (r) { delete r.deleted; return r; });
  });
  return out;
}

// ---------- 書き込み: put(追加/更新) と del(削除) をまとめて ----------
function batch(ops, by) {
  var ss = SpreadsheetApp.getActive();
  var cache = {}; // table -> { sh, head, idRow }
  function tbl(t) {
    if (!TABLES[t]) throw new Error('unknown table: ' + t);
    if (!cache[t]) {
      var sh = sheet(ss, t), vals = sh.getDataRange().getValues(), idRow = {};
      for (var i = 1; i < vals.length; i++) idRow[String(vals[i][0])] = i + 1;
      cache[t] = { sh: sh, head: TABLES[t].head, idRow: idRow };
    }
    return cache[t];
  }
  ops.forEach(function (op) {
    var T = tbl(op.table), row = op.row || {}, id = String(op.id || row.id || '');
    if (!id) return;
    if (op.op === 'del') {
      if (T.idRow[id]) T.sh.getRange(T.idRow[id], T.head.length).setValue(1);
      return;
    }
    row.id = id; row.deleted = 0;
    if (row.by == null && by) row.by = by;
    var vals = T.head.map(function (h) { var v = row[h]; return v == null ? '' : v; });
    var r = T.idRow[id];
    if (!r) { r = T.sh.getLastRow() + 1; T.idRow[id] = r; }
    var rng = T.sh.getRange(r, 1, 1, T.head.length);
    T.head.forEach(function (h, i) { if (TEXT_COLS[h]) T.sh.getRange(r, i + 1).setNumberFormat('@'); });
    rng.setValues([vals.map(function (v, i) { return TEXT_COLS[T.head[i]] ? String(v) : v; })]);
  });
}

// テスト用: id が prefix で始まる行を物理削除
function wipeTest(prefix) {
  if (!prefix) return;
  var ss = SpreadsheetApp.getActive();
  Object.keys(TABLES).forEach(function (t) {
    var sh = sheet(ss, t), vals = sh.getDataRange().getValues();
    for (var i = vals.length - 1; i >= 1; i--) if (String(vals[i][0]).indexOf(prefix) === 0) sh.deleteRow(i + 1);
  });
}

// ---------- ユーティリティ ----------
function sheet(ss, t) {
  var def = TABLES[t], sh = ss.getSheetByName(def.sheet);
  if (!sh) {
    sh = ss.insertSheet(def.sheet); sh.appendRow(def.head); sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, def.head.length).setFontWeight('bold');
  }
  return sh;
}
function rowsOf(sh) {
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0];
  return vals.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {};
    head.forEach(function (h, i) {
      var v = r[i];
      if (v instanceof Date) v = TEXT_COLS[h] ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd') : v.getTime();
      if (TEXT_COLS[h]) v = String(v);
      o[h] = v;
    });
    return o;
  });
}
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

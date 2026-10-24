// casa チケット — 文言辞書
// 画面に出る文字はすべてここに集める。設定タブ「文言」から書き換えると全端末に反映される(シートの「文言」タブに保存)。
// HTML 側は <span data-l="key"> / placeholder は data-lp="key" で参照する。
(function (g) {
  const DEFAULT = {
    // タブ
    'tab.home': 'ホーム', 'tab.sat': 'サテ', 'tab.sale': '手売り', 'tab.buy': '購入', 'tab.set': '設定',
    // 共通
    'app.title': 'casa チケット', 'common.save': '保存', 'common.add': '追加', 'common.delete': '削除', 'common.cancel': 'キャンセル',
    'common.edit': '編集', 'common.close': '閉じる', 'common.sheet': 'シート', 'common.sync': '同期', 'common.synced': '同期済み',
    'common.pending': '件 未送信', 'common.syncing': '送信中…', 'common.syncErr': '同期エラー', 'common.localMode': 'テストモード(端末内のみ)',
    'common.by': '入力者', 'common.date': '日付', 'common.kind': '券種', 'common.qty': '枚数', 'common.sheets': '枚', 'common.yen': '円',
    'common.store': '店舗', 'common.month': '月', 'common.all': '全部', 'common.noKind': '券種を先に登録してください(設定タブ)',
    'common.noStaff': '入力者を選んでください', 'common.confirmDel': '削除しますか？', 'common.copied': 'コピーしました', 'common.saved': '保存しました',
    'common.noStore': '店舗を先に登録してください(設定タブ)',
    // ホーム
    'home.alerts': '確認が必要', 'home.alertSat': '実枚数が未入力のサテ', 'home.alertUnpaid': '請求書 未払い', 'home.alertExpire': '大会日が近い券種',
    'home.alertExpired': '期限切れで残った枚数(失効)', 'home.noAlert': '確認が必要なものはありません',
    'home.month': '当月サマリー', 'home.budget': '予算枚数', 'home.plan': '予定', 'home.actual': '実吐き出し', 'home.sale': '手売り',
    'home.unspent': '未付与', 'home.used': '消化合計', 'home.bought': '当月購入', 'home.cost': '当月経費(支払済)', 'home.unpaid': '未払い請求',
    'home.stock': '券種別 在庫', 'home.stockIn': '在庫', 'home.stockWait': '入荷待ち', 'home.stockExpired': '失効', 'home.carry': '翌月繰越',
    'home.report': '月次レポート', 'home.copy': 'レポートをコピー', 'home.rate': '消化率', 'home.saleAmount': '手売り売上',
    'home.satCount': 'サテ回数', 'home.left': 'あと',
    // サテ
    'sat.title': 'サテ記録', 'sat.time': '時間 / サテ名', 'sat.plan': '予定枚数', 'sat.actual': '実吐き出し', 'sat.add': 'サテを登録',
    'sat.bulk': '週次スケジュールで一括登録', 'sat.bulkDays': '曜日', 'sat.bulkMonth': '対象月', 'sat.bulkRun': 'まとめて登録',
    'sat.bulkDone': '件 登録しました', 'sat.bulkNone': '追加するサテはありません(すでに登録済み)', 'sat.notEntered': '未入力',
    'sat.enter': '実枚数を入力', 'sat.list': 'サテ一覧', 'sat.filterPending': '未入力だけ', 'sat.unspent': '未付与',
    'sat.enterHint': '実枚数を入れて保存', 'sat.timeHint': '例: 19:00',
    // 手売り
    'sale.title': '手売り記録', 'sale.price': '販売額(円)', 'sale.add': '手売りを記録', 'sale.list': '手売り一覧', 'sale.total': '合計',
    // 購入
    'buy.title': 'チケット購入', 'buy.payDate': '支払日', 'buy.unit': '単価(円)', 'buy.total': '総額(円)', 'buy.paid': '請求書 支払い済み',
    'buy.arrive': '到着日', 'buy.note': 'メモ', 'buy.add': '購入を追加', 'buy.list': '購入一覧', 'buy.unpaid': '未払い', 'buy.paidTag': '支払済',
    'buy.waiting': '入荷待ち', 'buy.arrived': '到着済',
    // 設定
    'set.store': '店舗', 'set.staff': 'スタッフ(入力者)', 'set.kind': '券種(大会・イベント)', 'set.kindName': '大会名', 'set.kindUnit': '単価(円)',
    'set.kindDate': '大会日 / 有効期限', 'set.budget': '月予算(券種ごとの枚数)', 'set.budgetTotal': '予算合計',
    'set.labels': '文言(画面の文字)', 'set.labelsHint': '画面に表示される文字を変えられます。空にすると元に戻ります。',
    'set.labelsSearch': '文言を検索', 'set.name': '名前', 'set.addStore': '店舗を追加', 'set.addStaff': 'スタッフを追加', 'set.addKind': '券種を追加',
    'set.expired': '期限切れ', 'set.showExpired': '期限切れも表示', 'set.data': 'データ', 'set.export': 'JSONを書き出す',
  };
  let override = {};
  const api = {
    DEFAULT,
    setOverride(map) { override = map || {}; },
    get(key) { const v = override[key]; return (v != null && v !== '') ? v : (DEFAULT[key] != null ? DEFAULT[key] : key); },
    keys() { return Object.keys(DEFAULT); },
    apply(root) {
      (root || document).querySelectorAll('[data-l]').forEach(el => { el.textContent = api.get(el.dataset.l); });
      (root || document).querySelectorAll('[data-lp]').forEach(el => { el.placeholder = api.get(el.dataset.lp); });
    },
  };
  g.L = api.get; g.Labels = api;
})(typeof window !== 'undefined' ? window : globalThis);

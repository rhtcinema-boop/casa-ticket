// casa チケット — 接続設定
// GAS_URL: Google Apps Script のウェブアプリ URL(…/exec)。空のときは端末内(localStorage)だけで動く「テストモード」。
window.TICKET_CONFIG = {
  GAS_URL: "",
  SHEET_URL: "https://docs.google.com/spreadsheets/d/1RTufjcm2KRMxD64zar1PzzYWkIyvEKYLOYsXdFRV-qg/edit",
  EXPIRE_WARN_DAYS: 14,   // 大会日までこの日数以内なら警告
};

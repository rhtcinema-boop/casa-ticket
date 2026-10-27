// casa チケット — 接続設定
// GAS_URL: Google Apps Script のウェブアプリ URL(…/exec)。空のときは端末内(localStorage)だけで動く「テストモード」。
window.TICKET_CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbxEMSf6R8shcaFF30_bOUXHOpONhAslvy6vZMVOw6XTMA2dBnnoZJ_tLNxnBqt5mFcLXg/exec",
  SHEET_URL: "https://docs.google.com/spreadsheets/d/1RTufjcm2KRMxD64zar1PzzYWkIyvEKYLOYsXdFRV-qg/edit",
  EXPIRE_WARN_DAYS: 14,   // 大会日までこの日数以内なら警告
};

// ============================================================
//  登入守門員 — 放在每個工具頁最前面。
//  未登入（或不在白名單）→ 導去 /login。
//  已登入 → 設 window.__USER__ 並發出 'jstwins-auth' 事件。
// ============================================================
(function () {
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.user) {
        location.replace('/login/?next=' + encodeURIComponent(location.pathname + location.search));
        return;
      }
      window.__USER__ = d;
      document.documentElement.setAttribute('data-user', d.user);
      if (d.isAdmin) document.documentElement.setAttribute('data-admin', '1');
      document.dispatchEvent(new CustomEvent('jstwins-auth', { detail: d }));
    })
    .catch(() => { /* 網路問題就先不強制導離，避免卡死 */ });
})();

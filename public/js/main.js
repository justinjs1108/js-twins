// ============================================================
//  JS_TWINS — 前端互動：漂浮塵粒 + 滾動浮現 + Hero 視差
//  全部最基本的 JS，方便閱讀與修改。
// ============================================================
(function () {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 登入狀態：是管理員才顯示「邀請碼」連結；登出按鈕綁好
  document.addEventListener('jstwins-auth', (e) => {
    if (e.detail.isAdmin) { const a = document.getElementById('nav-admin'); if (a) a.style.display = ''; }
  });
  const logout = document.getElementById('nav-logout');
  if (logout) logout.addEventListener('click', (ev) => { ev.preventDefault(); fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(() => location.href = '/login/'); });

  // 頁尾年份
  const yr = document.querySelector('.foot-yr');
  if (yr) yr.textContent = '© ' + new Date().getFullYear();

  // 手機選單（點點）→ 捲到工具區
  const dots = document.querySelector('.nav-dots');
  if (dots) dots.addEventListener('click', () => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' }));

  // 工具清單：滾到才交錯浮現
  const rows = Array.prototype.slice.call(document.querySelectorAll('.tool-row'));
  if (reduce || !('IntersectionObserver' in window)) {
    rows.forEach((r) => r.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = rows.indexOf(e.target);
        e.target.style.transitionDelay = (i % 6) * 0.07 + 's';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.2 });
    rows.forEach((r) => io.observe(r));
  }

  // 漂浮塵粒（電影感）
  const canvas = document.getElementById('dust');
  if (canvas && !reduce) {
    const ctx = canvas.getContext('2d');
    let W, H, motes = [], raf = 0;
    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const n = Math.min(90, Math.floor((W * H) / 26000));
      motes = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.4 + 0.3,
        vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
        a: Math.random() * 0.4 + 0.05,
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const m of motes) {
        m.x += m.vx; m.y += m.vy;
        if (m.x < 0) m.x = W; else if (m.x > W) m.x = 0;
        if (m.y < 0) m.y = H; else if (m.y > H) m.y = 0;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,' + m.a + ')'; ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    resize(); frame();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) frame();
    });
  }

  // HERO 視覺：滑鼠輕微視差
  const visual = document.querySelector('.hero-visual');
  if (visual && !reduce) {
    window.addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      visual.style.transform = 'translate(' + (x * 18).toFixed(1) + 'px,' + (y * 14).toFixed(1) + 'px)';
    }, { passive: true });
  }
})();

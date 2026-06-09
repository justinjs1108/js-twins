// ============================================================
//  全站背景：紅色賽博漸層緩漂動 + 交叉淡入淡出
//  自動注入 DOM（不需手動加 markup），每 9 秒換一張，JS 控時序。
//  Reduced-motion 偏好下不換、只顯示第一張（由 CSS 處理）。
// ============================================================
(function () {
  if (window.__bgCyberLoaded__) return;
  window.__bgCyberLoaded__ = true;

  var IMAGES = ['01.webp', '07.webp', '14.webp', '21.webp', '28.webp', '35.webp', '42.webp'];
  var INTERVAL_MS = 9000;   // 每張的「主場」秒數
  var BASE = '/assets/bg/';

  function build() {
    var wrap = document.createElement('div');
    wrap.id = 'bg-slideshow';
    IMAGES.forEach(function (name) {
      var s = document.createElement('div');
      s.className = 'slide';
      s.style.backgroundImage = "url('" + BASE + name + "')";
      wrap.appendChild(s);
    });
    document.body.insertBefore(wrap, document.body.firstChild);

    var veil = document.createElement('div');
    veil.id = 'bg-veil';
    document.body.insertBefore(veil, wrap.nextSibling);

    return wrap;
  }

  function start() {
    var wrap = build();
    var slides = wrap.querySelectorAll('.slide');
    if (!slides.length) return;
    // 預先載入：避免換頁第一次的閃白
    IMAGES.forEach(function (n) { var i = new Image(); i.src = BASE + n; });

    // 尊重「減少動態」→ 只顯示第一張、不切換
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var i = 0;
    slides[i].classList.add('on');
    var timer = setInterval(function () {
      slides[i].classList.remove('on');
      i = (i + 1) % slides.length;
      slides[i].classList.add('on');
    }, INTERVAL_MS);
    // 分頁切走時暫停，省效能
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && timer) { clearInterval(timer); timer = null; }
      else if (!document.hidden && !timer) {
        timer = setInterval(function () {
          slides[i].classList.remove('on');
          i = (i + 1) % slides.length;
          slides[i].classList.add('on');
        }, INTERVAL_MS);
      }
    });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();

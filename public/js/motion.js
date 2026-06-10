// ============================================================
//  全站微動效引擎 — 自動讓「靜態區塊」與「雲端載入的卡片」優雅進場
//  - 頁面載入：主要區塊交錯浮現
//  - 滾動進入視窗：才浮現（IntersectionObserver）
//  - 動態渲染（fetch 後 innerHTML）：MutationObserver 自動補進場
//  - 跳過 landing 的 .reveal / .tool-row（它們有自己的動畫）
// ============================================================
(function () {
  if (window.__motionLoaded__) return;
  window.__motionLoaded__ = true;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // CSS 已保證 reduce 模式下全部直接顯示

  var STAGGER = 55;       // 交錯 ms
  var MAX_DELAY = 440;    // 單批最長延遲

  function skip(el) {
    return el.classList.contains('reveal') ||
           el.classList.contains('tool-row') ||
           el.closest('.hero-cinema') !== null ||
           el.classList.contains('m-done');
  }

  function animateIn(els) {
    var batch = [];
    els.forEach(function (el) {
      if (!el || el.nodeType !== 1 || skip(el)) return;
      el.classList.add('m-pre', 'm-done');
      batch.push(el);
    });
    if (!batch.length) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        batch.forEach(function (el, i) {
          el.style.setProperty('--m-d', Math.min(i * STAGGER, MAX_DELAY) + 'ms');
          el.classList.add('m-show');
          el.addEventListener('transitionend', function te() {
            el.classList.remove('m-pre', 'm-show');
            el.style.removeProperty('--m-d');
            el.removeEventListener('transitionend', te);
          });
        });
      });
    });
  }

  // ── 1) 靜態區塊：載入即交錯浮現 ──
  var STATIC_SELECTOR = ['header.nav', '.hero', '.tabs', '.panel', '.crumb-block', '.toolbar-2', '.history h2', '.imgnotes'].join(',');
  function initStatic() {
    var els = Array.prototype.slice.call(document.querySelectorAll(STATIC_SELECTOR));
    var inView = [], below = [];
    var vh = window.innerHeight;
    els.forEach(function (el) {
      if (skip(el)) return;
      var r = el.getBoundingClientRect();
      (r.top < vh ? inView : below).push(el);
    });
    animateIn(inView);
    // 視窗下方的：滾到才浮現
    if ('IntersectionObserver' in window && below.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          animateIn([e.target]);
          io.unobserve(e.target);
        });
      }, { threshold: 0.12 });
      below.forEach(function (el) { io.observe(el); });
    } else {
      animateIn(below);
    }
  }

  // ── 2) 動態容器：fetch 後 innerHTML 的卡片自動進場 ──
  var DYNAMIC_CONTAINERS = ['#list', '#hlist', '#scripts-list', '.vargrid', '#vargrid'];
  function watchDynamic() {
    DYNAMIC_CONTAINERS.forEach(function (sel) {
      var box = document.querySelector(sel);
      if (!box) return;
      var mo = new MutationObserver(function (muts) {
        var added = [];
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (n.nodeType === 1) added.push(n);
          });
        });
        if (added.length) animateIn(added);
      });
      mo.observe(box, { childList: true });
      // 第一次載入時容器可能已有內容
      animateIn(Array.prototype.slice.call(box.children));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initStatic(); watchDynamic(); });
  } else {
    initStatic(); watchDynamic();
  }
})();

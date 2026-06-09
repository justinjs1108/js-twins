// ============================================================
//  共用 Lightbox — 點縮圖開大圖；支援多張、左右鍵、Esc、點背景關
//  用法： JSTLightbox.open(images, startIndex, caption)
//        images 可傳 string 或 string[]（dataURL 或 URL）
// ============================================================
(function () {
  var BODY_OPEN = 'lb-open';

  function build() {
    var ov = document.createElement('div');
    ov.className = 'jst-lb';
    ov.innerHTML =
      '<button class="lb-close" type="button" title="關閉 (Esc)">✕</button>' +
      '<button class="lb-nav lb-prev" type="button" title="上一張 (←)">‹</button>' +
      '<div class="lb-stage"><img class="lb-img" alt="" /></div>' +
      '<button class="lb-nav lb-next" type="button" title="下一張 (→)">›</button>' +
      '<div class="lb-caption"></div>' +
      '<div class="lb-counter"></div>';
    return ov;
  }

  window.JSTLightbox = {
    open: function (images, startIndex, caption) {
      if (typeof images === 'string') images = [images];
      images = (images || []).filter(Boolean);
      if (!images.length) return;
      var i = Math.max(0, Math.min(startIndex || 0, images.length - 1));

      var ov = build();
      document.body.appendChild(ov);
      document.body.classList.add(BODY_OPEN);
      var imgEl = ov.querySelector('.lb-img');
      var counter = ov.querySelector('.lb-counter');
      var cap = ov.querySelector('.lb-caption');
      var prev = ov.querySelector('.lb-prev');
      var next = ov.querySelector('.lb-next');

      function show(idx) {
        if (idx < 0) idx = images.length - 1;
        if (idx >= images.length) idx = 0;
        i = idx;
        imgEl.src = images[idx];
        counter.textContent = images.length > 1 ? (idx + 1) + ' / ' + images.length : '';
        if (caption) cap.textContent = caption;
        prev.style.display = next.style.display = (images.length > 1 ? '' : 'none');
      }
      show(i);

      function close() {
        ov.classList.add('out');
        document.removeEventListener('keydown', onKey);
        setTimeout(function () {
          if (ov.parentNode) ov.parentNode.removeChild(ov);
          document.body.classList.remove(BODY_OPEN);
        }, 240);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
      }
      document.addEventListener('keydown', onKey);
      ov.querySelector('.lb-close').addEventListener('click', close);
      imgEl.addEventListener('click', close);
      prev.addEventListener('click', function (e) { e.stopPropagation(); show(i - 1); });
      next.addEventListener('click', function (e) { e.stopPropagation(); show(i + 1); });
      ov.addEventListener('click', function (e) {
        if (e.target === ov || e.target.classList.contains('lb-stage')) close();
      });
    },
  };
})();

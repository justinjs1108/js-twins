// ============================================================
//  共用：縮圖選圖 + 縮放 + 轉 base64
//  瀏覽器端壓縮，避免把原始大檔送上雲端。
//  最大邊長 480x320，JPEG 品質 78 → 約 30-60 KB / 張。
// ============================================================
(function () {
  window.JSTImg = {
    // 把 File 轉成壓縮後的 base64 dataURL
    resize: function (file, maxW, maxH, quality) {
      maxW = maxW || 480; maxH = maxH || 320; quality = quality || 0.78;
      return new Promise(function (resolve, reject) {
        if (!file || !/^image\//.test(file.type)) return reject(new Error('請選圖片'));
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            var r = Math.min(maxW / img.width, maxH / img.height, 1);
            var w = Math.max(1, Math.round(img.width * r));
            var h = Math.max(1, Math.round(img.height * r));
            var c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            try { resolve(c.toDataURL('image/jpeg', quality)); }
            catch (err) { reject(err); }
          };
          img.onerror = function () { reject(new Error('無法讀取圖片')); };
          img.src = e.target.result;
        };
        reader.onerror = function () { reject(new Error('檔案讀取失敗')); };
        reader.readAsDataURL(file);
      });
    },
    // 開檔案對話框，回傳 File（或 null）
    pickFile: function () {
      return new Promise(function (resolve) {
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = function () { resolve(inp.files && inp.files[0]); };
        inp.click();
      });
    },
  };
})();

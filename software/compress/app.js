/* XK Compress —— 纯本地图片压缩（Canvas + toBlob） */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var queue = [];
  var seq = 0;

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function human(n) {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function extFor(type) {
    if (type === 'image/jpeg') return 'jpg';
    if (type === 'image/png') return 'png';
    return 'webp';
  }

  function addFiles(files) {
    if (!files || !files.length) return;
    Array.prototype.forEach.call(files, function (f) {
      if (!/^image\//.test(f.type)) { toast('跳过非图片：' + f.name, 'bad'); return; }
      queue.push({ id: 'i' + (++seq), file: f, url: URL.createObjectURL(f), out: null, outUrl: null, err: null });
    });
    render();
  }

  function render() {
    var grid = $('cGrid');
    grid.innerHTML = '';
    var saved = 0, done = 0;
    queue.forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'img-card';

      var img = document.createElement('img');
      img.src = it.outUrl || it.url;
      img.alt = it.file.name;
      img.loading = 'lazy';

      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = it.file.name;

      var sizes = document.createElement('div');
      sizes.className = 'sizes';
      if (it.out) {
        done++;
        saved += Math.max(0, it.file.size - it.out.size);
        var pct = it.file.size ? Math.round((1 - it.out.size / it.file.size) * 100) : 0;
        sizes.innerHTML = '<s>' + human(it.file.size) + '</s> → <b>' + human(it.out.size) + '</b> · ' + (pct >= 0 ? '省 ' + pct + '%' : '增大 ' + Math.abs(pct) + '%');
      } else if (it.err) {
        sizes.innerHTML = '<span style="color:var(--rose)">' + it.err + '</span>';
      } else {
        sizes.textContent = human(it.file.size) + ' · 待压缩';
      }

      var acts = document.createElement('div');
      acts.className = 'tool-row';
      var dl = document.createElement('button');
      dl.type = 'button'; dl.className = 'tiny-btn'; dl.textContent = '下载';
      dl.disabled = !it.out;
      dl.addEventListener('click', function () { download(it); });
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'tiny-btn danger'; rm.textContent = '移除';
      rm.addEventListener('click', function () {
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
        URL.revokeObjectURL(it.url);
        queue = queue.filter(function (x) { return x.id !== it.id; });
        render();
      });
      acts.appendChild(dl); acts.appendChild(rm);

      card.appendChild(img); card.appendChild(name); card.appendChild(sizes); card.appendChild(acts);
      grid.appendChild(card);
    });
    if (!queue.length) {
      grid.innerHTML = '<div class="empty-hint">队列为空。拖入几张图片试试，默认输出 WebP、最长边 1920px。</div>';
    }
    $('cCount').textContent = queue.length + ' 张';
    $('cSaved').textContent = human(saved) + (done ? '（' + done + ' 张已压缩）' : '');
  }

  function compressOne(it) {
    return new Promise(function (resolve) {
      var maxSide = parseInt($('cMax').value, 10) || 1920;
      var quality = parseFloat($('cQ').value) || 0.82;
      var fmt = $('cFmt').value || 'image/webp';

      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { it.err = '读不到尺寸'; resolve(); return; }
        var scale = Math.min(1, maxSide / Math.max(w, h));
        var tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
        var cv = document.createElement('canvas');
        cv.width = tw; cv.height = th;
        var ctx = cv.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        if (fmt === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tw, th); }
        ctx.drawImage(img, 0, 0, tw, th);
        var finish = function (blob) {
          if (!blob) { it.err = '浏览器不支持该格式输出'; resolve(); return; }
          if (it.outUrl) URL.revokeObjectURL(it.outUrl);
          it.out = blob;
          it.outUrl = URL.createObjectURL(blob);
          resolve();
        };
        try { cv.toBlob(finish, fmt, fmt === 'image/png' ? undefined : quality); }
        catch (e) { it.err = '压缩失败：' + e.message; resolve(); }
      };
      img.onerror = function () { it.err = '图片无法解码（可能是 SVG 或损坏文件）'; resolve(); };
      img.src = it.url;
    });
  }

  function run() {
    var pending = queue.filter(function (it) { return !it.out; });
    if (!queue.length) { toast('先选择图片', 'bad'); return; }
    if (!pending.length) { toast('全部已压缩，参数改了可先「清空队列」', 'ok'); return; }
    $('cRun').disabled = true;
    $('cRun').textContent = '压缩中…';
    var i = 0;
    (function step() {
      if (i >= pending.length) {
        $('cRun').disabled = false;
        $('cRun').textContent = '开始压缩';
        render();
        toast('完成 ' + pending.length + ' 张', 'ok');
        return;
      }
      compressOne(pending[i]).then(function () { i++; render(); setTimeout(step, 0); });
    })();
  }

  function download(it) {
    if (!it.out) return;
    var base = it.file.name.replace(/\.[^.]+$/, '');
    var a = document.createElement('a');
    a.href = it.outUrl;
    a.download = base + '-xk.' + extFor(it.out.type || $('cFmt').value);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function init() {
    var drop = $('cDrop'), file = $('cFile');
    drop.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
    $('cMax').addEventListener('input', function () { $('cMaxV').textContent = this.value; });
    $('cQ').addEventListener('input', function () { $('cQV').textContent = this.value; });
    $('cRun').addEventListener('click', run);
    $('cClear').addEventListener('click', function () {
      queue.forEach(function (it) { if (it.outUrl) URL.revokeObjectURL(it.outUrl); URL.revokeObjectURL(it.url); });
      queue = []; render();
    });
    $('cDownAll').addEventListener('click', function () {
      var ready = queue.filter(function (it) { return it.out; });
      if (!ready.length) { toast('还没有压缩结果', 'bad'); return; }
      ready.forEach(function (it, i) { setTimeout(function () { download(it); }, i * 260); });
      toast('开始下载 ' + ready.length + ' 张', 'ok');
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

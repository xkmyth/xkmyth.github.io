/* XK Wallpaper —— 程序化渐层壁纸生成器 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = null, ctx = null;
  var W = 1280, H = 720;

  var SCHEMES = {
    aurora: ['#04060f', '#0a1e3a', '#fcd34d', '#9ae3ff', '#4c1d95'],
    sunset: ['#1a0a12', '#3b1020', '#f59e0b', '#fb7185', '#7c2d12'],
    deep: ['#020a14', '#062236', '#38bdf8', '#22d3ee', '#0e7490'],
    violet: ['#0a0614', '#1e1039', '#c4b5fd', '#f0abfc', '#4c1d95'],
    forest: ['#04100a', '#0b2418', '#6ee7b7', '#fef3c7', '#166534'],
    mono: ['#06070a', '#15181f', '#e8eeff', '#8aa3d8', '#334155']
  };

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function rnd(seed) { /* 简单确定性伪随机 */
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function draw() {
    var scheme = SCHEMES[$('wScheme').value] || SCHEMES.aurora;
    var seed = parseInt($('wSeed').value, 10) || 7;
    var blobs = parseInt($('wBlobs').value, 10) || 5;
    var grain = parseFloat($('wGrain').value) || 0;
    var vig = parseFloat($('wVig').value) || 0;
    var r = rnd(seed * 7919 + blobs * 131);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* 底色 */
    var base = ctx.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, scheme[0]);
    base.addColorStop(1, scheme[1]);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    /* 色块：screen 叠加，模拟极光 */
    ctx.globalCompositeOperation = 'screen';
    for (var i = 0; i < blobs; i++) {
      var cx = r() * W, cy = r() * H, rad = (0.24 + r() * 0.42) * Math.max(W, H);
      var col = scheme[2 + (i % 3)];
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, hexA(col, 0.52));
      g.addColorStop(0.55, hexA(col, 0.18));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    /* 细线光带 */
    ctx.globalCompositeOperation = 'screen';
    for (var k = 0; k < 3; k++) {
      var y0 = r() * H;
      var grad = ctx.createLinearGradient(0, y0, W, y0 + (r() - 0.5) * H * 0.6);
      grad.addColorStop(0, hexA(scheme[3], 0));
      grad.addColorStop(0.5, hexA(scheme[3], 0.1 + r() * 0.12));
      grad.addColorStop(1, hexA(scheme[3], 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(-40, y0);
      ctx.bezierCurveTo(W * 0.3, y0 + (r() - 0.5) * 220, W * 0.7, y0 + (r() - 0.5) * 220, W + 40, y0 + (r() - 0.5) * 120);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    /* 颗粒 */
    if (grain > 0.001) {
      var gw = 320, gh = 180;
      var gc = document.createElement('canvas');
      gc.width = gw; gc.height = gh;
      var gx = gc.getContext('2d');
      var img = gx.createImageData(gw, gh);
      for (var p = 0; p < img.data.length; p += 4) {
        var v = 128 + (Math.random() - 0.5) * 255;
        img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = v;
        img.data[p + 3] = Math.round(grain * 255);
      }
      gx.putImageData(img, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(gc, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    /* 暗角 */
    if (vig > 0.001) {
      var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,' + vig.toFixed(2) + ')');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    /* 文字水印（右下角极小） */
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.24)';
    ctx.textAlign = 'right';
    ctx.fillText('XKMYTH · seed ' + seed, W - 26, H - 22);

    $('wSeedOut').textContent = String(seed);
    $('wSizeOut').textContent = ($('wSize').value || '').replace('x', ' × ');
    $('wHint').textContent = '当前：' + $('wScheme').selectedOptions[0].textContent + ' · 种子 ' + seed + ' · ' + blobs + ' 个色块';
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function exportPng() {
    var size = ($('wSize').value || '2560x1440').split('x');
    var tw = parseInt(size[0], 10) || 2560, th = parseInt(size[1], 10) || 1440;
    var off = document.createElement('canvas');
    off.width = tw; off.height = th;
    var octx = off.getContext('2d');
    /* 按预览等比放大重绘 */
    var oldCtx = ctx, oldW = W, oldH = H;
    ctx = octx; W = tw; H = th;
    draw();
    ctx = oldCtx; W = oldW; H = oldH;
    draw();
    try {
      off.toBlob(function (blob) {
        if (!blob) { toast('导出失败', 'bad'); return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'xk-wallpaper-' + $('wScheme').value + '-' + $('wSeed').value + '-' + tw + 'x' + th + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        toast('已导出 ' + tw + '×' + th, 'ok');
      }, 'image/png');
    } catch (e) { toast('浏览器拒绝了导出', 'bad'); }
  }

  function cssGradient() {
    var scheme = SCHEMES[$('wScheme').value] || SCHEMES.aurora;
    var css = 'background:\n  radial-gradient(60% 50% at 78% 12%, ' + hexA(scheme[2], 0.35) + ', transparent 70%),\n' +
      '  radial-gradient(50% 45% at 18% 22%, ' + hexA(scheme[3], 0.3) + ', transparent 70%),\n' +
      '  linear-gradient(165deg, ' + scheme[0] + ', ' + scheme[1] + ');';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(css).then(function () { toast('CSS 已复制', 'ok'); }, function () { toast('复制失败', 'bad'); });
    } else { toast('当前浏览器不支持自动复制', 'bad'); }
  }

  function init() {
    cv = $('wCanvas'); ctx = cv.getContext('2d');
    W = cv.width; H = cv.height;
    ['wScheme', 'wSeed', 'wBlobs', 'wGrain', 'wVig', 'wSize'].forEach(function (id) {
      var el = $(id);
      el.addEventListener('input', function () {
        var map = { wSeed: 'wSeedV', wBlobs: 'wBlobsV', wGrain: 'wGrainV', wVig: 'wVigV' };
        if (map[id]) $(map[id]).textContent = el.value;
        draw();
      });
    });
    $('wGen').addEventListener('click', function () {
      var s = $('wSeed');
      s.value = String(1 + Math.floor(Math.random() * 99));
      $('wSeedV').textContent = s.value;
      draw();
    });
    cv.addEventListener('click', function () {
      var s = $('wSeed');
      s.value = String(1 + Math.floor(Math.random() * 99));
      $('wSeedV').textContent = s.value;
      draw();
    });
    $('wDown').addEventListener('click', exportPng);
    $('wCopyCss').addEventListener('click', cssGradient);
    draw();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

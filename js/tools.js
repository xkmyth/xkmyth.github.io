/* 星空工具集 · 纯前端，12 个常用工具，零上传零后端 */
(function () {
  'use strict';
  var T = [];
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function $(s, r) { return (r || document).querySelector(s); }
  function btn(label, fn, cls) { var b = el('button', 'tl-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function row() { var d = el('div', 'tl-row'); for (var i = 0; i < arguments.length; i++) if (arguments[i]) d.appendChild(arguments[i]); return d; }
  function area(ph, rows) { var t = el('textarea', 'tl-area'); t.placeholder = ph || ''; if (rows) t.rows = rows; return t; }
  function out() { var p = el('pre', 'tl-out', ''); p.textContent = ''; return p; }
  function note(txt) { return el('p', 'tl-note', txt || ''); }
  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function utf8ToB64(str) {
    var b = new TextEncoder().encode(str), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function b64ToUtf8(b64) {
    var s = atob(b64.replace(/\s+/g, '')), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return new TextDecoder().decode(b);
  }

  /* 1 JSON */
  T.push({ id: 'json', name: 'JSON 格式化', icon: '{}', desc: '格式化 / 压缩 / 校验，报错精确到位置',
    render: function (box) {
      var a = area('粘贴 JSON...', 10), o = out();
      box.appendChild(a); box.appendChild(row(
        btn('格式化', function () { run(2); }),
        btn('压缩', function () { run(0); }),
        btn('校验', function () { run(-1); }),
        btn('复制', function () { copy(o.textContent); })
      )); box.appendChild(o);
      function run(ind) {
        try {
          var v = JSON.parse(a.value);
          o.textContent = ind < 0 ? '✓ 合法 JSON · 类型 ' + (Array.isArray(v) ? 'array' : typeof v) : JSON.stringify(v, null, ind);
          o.className = 'tl-out ok';
        } catch (e) { o.textContent = '✗ ' + e.message; o.className = 'tl-out bad'; }
      }
    } });

  /* 2 Base64 */
  T.push({ id: 'base64', name: 'Base64 编解码', icon: '64', desc: '中文安全（UTF-8）',
    render: function (box) {
      var a = area('文本或 Base64...', 8), o = out();
      box.appendChild(a); box.appendChild(row(
        btn('编码', function () { try { o.textContent = utf8ToB64(a.value); o.className = 'tl-out ok'; } catch (e) { o.textContent = e.message; o.className = 'tl-out bad'; } }),
        btn('解码', function () { try { o.textContent = b64ToUtf8(a.value); o.className = 'tl-out ok'; } catch (e) { o.textContent = '解码失败：不是合法 Base64'; o.className = 'tl-out bad'; } }),
        btn('复制', function () { copy(o.textContent); })
      )); box.appendChild(o);
    } });

  /* 3 URL */
  T.push({ id: 'url', name: 'URL 编解码', icon: '%', desc: 'encodeURIComponent 双向',
    render: function (box) {
      var a = area('https:// 或带中文的文本...', 8), o = out();
      box.appendChild(a); box.appendChild(row(
        btn('编码', function () { o.textContent = encodeURIComponent(a.value); o.className = 'tl-out ok'; }),
        btn('解码', function () { try { o.textContent = decodeURIComponent(a.value); o.className = 'tl-out ok'; } catch (e) { o.textContent = '解码失败'; o.className = 'tl-out bad'; } }),
        btn('复制', function () { copy(o.textContent); })
      )); box.appendChild(o);
    } });

  /* 4 时间戳 */
  T.push({ id: 'time', name: '时间戳转换', icon: '⏱', desc: '秒 / 毫秒 / 日期互转',
    render: function (box) {
      var a = el('input', 'tl-input'); a.placeholder = '1700000000 或 2026-11-21 21:00:00';
      var o = out();
      box.appendChild(a); box.appendChild(row(
        btn('转换', function () {
          var v = a.value.trim(), d = null;
          if (/^\d+$/.test(v)) { var n = parseInt(v, 10); d = new Date(v.length > 10 ? n : n * 1000); }
          else d = new Date(v.replace(/-/g, '/'));
          if (!d || isNaN(d.getTime())) { o.textContent = '看不懂这个输入'; o.className = 'tl-out bad'; return; }
          var pad = function (x) { return x < 10 ? '0' + x : '' + x; };
          o.textContent = '本地：' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '\n' +
            'UTC ：' + d.toISOString() + '\n秒  ：' + Math.floor(d.getTime() / 1000) + '\n毫秒：' + d.getTime();
          o.className = 'tl-out ok';
        }),
        btn('现在', function () { a.value = Math.floor(Date.now() / 1000); }),
        btn('复制', function () { copy(o.textContent); })
      )); box.appendChild(o);
    } });

  /* 5 颜色 */
  T.push({ id: 'color', name: '颜色 / 对比度', icon: '🎨', desc: 'HEX ⇄ RGB ⇄ HSL，WCAG 对比度检测',
    render: function (box) {
      var c1 = el('input', 'tl-input'); c1.value = '#0ea5e9';
      var c2 = el('input', 'tl-input'); c2.value = '#0b1020';
      var o = out();
      box.appendChild(row(el('label', 'tl-lb', '前景'), c1, el('label', 'tl-lb', '背景'), c2));
      box.appendChild(row(btn('计算', function () {
        var h = hex2rgb(c1.value), b = hex2rgb(c2.value);
        if (!h || !b) { o.textContent = '颜色格式要 #RRGGBB'; o.className = 'tl-out bad'; return; }
        var l1 = lum(h), l2 = lum(b);
        var ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        o.textContent = 'RGB：rgb(' + h.join(', ') + ')\nHSL：' + rgb2hsl(h) +
          '\n对比度：' + ratio.toFixed(2) + ':1\n正文 AA(4.5)：' + (ratio >= 4.5 ? '✓ 通过' : '✗ 不合格') +
          '\n大字 AA(3.0)：' + (ratio >= 3 ? '✓ 通过' : '✗ 不合格') +
          '\nAAA(7.0)：' + (ratio >= 7 ? '✓ 通过' : '✗ 不合格');
        o.className = 'tl-out ok';
      }), btn('反色', function () { c1.value = invert(c1.value); c2.value = invert(c2.value); })));
      var sw = el('div', 'tl-swatch');
      c1.addEventListener('input', function () { sw.style.background = 'linear-gradient(90deg,' + c1.value + ',' + c2.value + ')'; });
      sw.style.background = 'linear-gradient(90deg,' + c1.value + ',' + c2.value + ')';
      box.appendChild(sw); box.appendChild(o);
      function hex2rgb(v) { var m = /^#?([0-9a-f]{6})$/i.exec((v || '').trim()); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
      function lum(c) { var a = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
      function rgb2hsl(c) { var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return 'hsl(' + Math.round(h * 360) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)'; }
      function invert(v) { var c = hex2rgb(v); if (!c) return v; return '#' + c.map(function (x) { return ('0' + (255 - x).toString(16)).slice(-2); }).join(''); }
    } });

  /* 6 图片压缩 */
  T.push({ id: 'img', name: '图片压缩', icon: '🖼', desc: '本地 canvas 压缩，可调质量与宽度',
    render: function (box) {
      var f = el('input'); f.type = 'file'; f.accept = 'image/*'; f.className = 'tl-file';
      var q = el('input'); q.type = 'range'; q.min = 30; q.max = 95; q.value = 80; q.className = 'tl-range';
      var w = el('input', 'tl-input'); w.placeholder = '最大宽度（留空不改）'; w.value = '1600';
      var o = out(), imgsrc = null, name = 'image';
      box.appendChild(f); box.appendChild(row(el('label', 'tl-lb', '质量 '), q, w));
      box.appendChild(row(btn('压缩并下载', function () { go(); })));
      box.appendChild(o);
      f.addEventListener('change', function () {
        var file = f.files && f.files[0]; if (!file) return;
        name = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '');
        var img = new Image();
        img.onload = function () { imgsrc = img; o.textContent = '已载入 ' + img.width + '×' + img.height + ' · ' + (file.size / 1024).toFixed(0) + ' KB'; o.className = 'tl-out ok'; };
        img.src = URL.createObjectURL(file);
      });
      function go() {
        if (!imgsrc) { o.textContent = '先选一张图片'; o.className = 'tl-out bad'; return; }
        var maxw = parseInt(w.value, 10) || imgsrc.width;
        var scale = Math.min(1, maxw / imgsrc.width);
        var cv = document.createElement('canvas');
        cv.width = Math.round(imgsrc.width * scale); cv.height = Math.round(imgsrc.height * scale);
        cv.getContext('2d').drawImage(imgsrc, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) {
          if (!b) { o.textContent = '压缩失败'; return; }
          download(name + '-min.jpg', b);
          o.textContent = '输出 ' + cv.width + '×' + cv.height + ' · ' + (b.size / 1024).toFixed(0) + ' KB（原图 ' + (imgsrc.naturalWidth * imgsrc.naturalHeight) + ' 像素）';
          o.className = 'tl-out ok';
        }, 'image/jpeg', parseInt(q.value, 10) / 100);
      }
    } });

  /* 7 PNG → ICO */
  T.push({ id: 'ico', name: 'PNG 转 ICO', icon: '⬛', desc: '生成 Windows 图标（256 单尺寸）',
    render: function (box) {
      var f = el('input'); f.type = 'file'; f.accept = 'image/png,image/*'; f.className = 'tl-file';
      var o = out();
      box.appendChild(f); box.appendChild(row(btn('转成 .ico 并下载', function () { go(); }))); box.appendChild(o);
      function go() {
        var file = f.files && f.files[0];
        if (!file) { o.textContent = '先选一张 PNG'; o.className = 'tl-out bad'; return; }
        var img = new Image();
        img.onload = function () {
          var s = 256, cv = document.createElement('canvas'); cv.width = s; cv.height = s;
          var ctx = cv.getContext('2d');
          var k = Math.max(s / img.width, s / img.height);
          var dw = img.width * k, dh = img.height * k;
          ctx.clearRect(0, 0, s, s);
          ctx.drawImage(img, (s - dw) / 2, (s - dh) / 2, dw, dh);
          cv.toBlob(function (png) {
            png.arrayBuffer().then(function (ab) {
              var pngBytes = new Uint8Array(ab);
              var head = new Uint8Array(22);
              var dv = new DataView(head.buffer);
              dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, 1, true);
              head[6] = 0; head[7] = 0; head[8] = 0; head[9] = 0;
              dv.setUint16(10, 1, true); dv.setUint16(12, 32, true);
              dv.setUint32(14, pngBytes.length, true); dv.setUint32(18, 22, true);
              var ico = new Blob([head, pngBytes], { type: 'image/x-icon' });
              download((file.name || 'icon').replace(/\.[a-z0-9]+$/i, '') + '.ico', ico);
              o.textContent = '已生成 256×256 ICO · ' + ico.size + ' 字节';
              o.className = 'tl-out ok';
            });
          }, 'image/png');
        };
        img.src = URL.createObjectURL(file);
      }
    } });

  /* 8 Hash */
  T.push({ id: 'hash', name: '文本 Hash', icon: '#', desc: 'SHA-1 / SHA-256 / SHA-384 / SHA-512',
    render: function (box) {
      var a = area('要计算 Hash 的文本...', 6), o = out(), sel = el('select', 'tl-input');
      ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512'].forEach(function (x) { var op = el('option', null, x); op.value = x; sel.appendChild(op); });
      box.appendChild(a); box.appendChild(row(sel, btn('计算', function () {
        if (!window.crypto || !crypto.subtle) { o.textContent = '需要 https 环境'; return; }
        crypto.subtle.digest(sel.value, new TextEncoder().encode(a.value)).then(function (buf) {
          var arr = Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); });
          o.textContent = arr.join(''); o.className = 'tl-out ok';
        });
      }), btn('复制', function () { copy(o.textContent); })));
      box.appendChild(o);
    } });

  /* 9 密码 */
  T.push({ id: 'pwd', name: '随机密码', icon: '🔑', desc: 'crypto 强随机，可选字符集',
    render: function (box) {
      var len = el('input', 'tl-input'); len.value = '20';
      var o = out();
      var opts = [['大小写字母', 'abc'], ['数字', '123'], ['符号', '!@#'], ['易混淆字符（l1IO0）也允许', 'x']];
      var checks = opts.map(function (p) {
        var lab = el('label', 'tl-chk'); var cb = el('input'); cb.type = 'checkbox';
        cb.checked = p[1] !== 'x'; cb.dataset.k = p[1];
        lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + p[0]));
        return lab;
      });
      box.appendChild(row(el('label', 'tl-lb', '长度'), len));
      var wrap = el('div', 'tl-chks'); checks.forEach(function (c) { wrap.appendChild(c); });
      box.appendChild(wrap);
      box.appendChild(row(btn('生成', function () { gen(); })));
      box.appendChild(o);
      function gen() {
        var pool = '';
        var useSym = checks[2].querySelector('input').checked;
        var noAmbig = !checks[3].querySelector('input').checked;
        if (checks[0].querySelector('input').checked) pool += 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
        if (checks[1].querySelector('input').checked) pool += '23456789';
        if (useSym) pool += '!@#$%^&*()-_=+[]{};:,.?/';
        if (!noAmbig) pool += 'l1IO0';
        if (!pool) { o.textContent = '至少选一类字符'; o.className = 'tl-out bad'; return; }
        var n = Math.max(4, Math.min(128, parseInt(len.value, 10) || 20));
        var buf = new Uint32Array(n); crypto.getRandomValues(buf);
        var s = '';
        for (var i = 0; i < n; i++) s += pool[buf[i] % pool.length];
        var kinds = (checks[0].querySelector('input').checked ? 1 : 0) + (checks[1].querySelector('input').checked ? 1 : 0) + (useSym ? 1 : 0);
        var bits = n * Math.log2(pool.length);
        o.textContent = s + '\n\n长度 ' + n + ' · 字符集 ' + pool.length + ' · 熵约 ' + bits.toFixed(0) + ' bit · ' + (bits > 100 ? '很强' : bits > 70 ? '够用' : '偏弱');
        o.className = 'tl-out ok';
      }
      gen();
    } });

  /* 10 正则 */
  T.push({ id: 'regex', name: '正则测试', icon: '.*', desc: '实时匹配、分组、替换预览',
    render: function (box) {
      var p = el('input', 'tl-input'); p.placeholder = '正则，例如 (\\d{4})-(\\d{2})'; p.value = '(\\w+)@(\\w+)\\.com';
      var fl = el('input', 'tl-input'); fl.value = 'gi'; fl.placeholder = 'flags';
      var t = area('测试文本...', 8);
      var o = out();
      box.appendChild(row(p, fl)); box.appendChild(t); box.appendChild(o);
      function run() {
        try {
          var re = new RegExp(p.value, fl.value.replace(/[^gimsuy]/g, ''));
          var src = t.value, ms = [], m, guard = 0;
          if (!re.global) { m = re.exec(src); if (m) ms.push(m); }
          else { while ((m = re.exec(src)) && guard++ < 500) { ms.push(m); if (m[0] === '') re.lastIndex++; } }
          if (!ms.length) { o.textContent = '没有匹配'; o.className = 'tl-out bad'; return; }
          var txt = '共 ' + ms.length + ' 处匹配\n';
          ms.slice(0, 30).forEach(function (mm, i) {
            txt += '\n#' + (i + 1) + ' @' + mm.index + '  "' + mm[0] + '"';
            for (var g = 1; g < mm.length; g++) txt += '\n    $' + g + ' = ' + (mm[g] === undefined ? '(空)' : mm[g]);
          });
          o.textContent = txt;
          o.className = 'tl-out ok';
        } catch (e) { o.textContent = '正则错误：' + e.message; o.className = 'tl-out bad'; }
      }
      p.addEventListener('input', run); fl.addEventListener('input', run); t.addEventListener('input', run);
      run();
    } });

  /* 11 Markdown */
  T.push({ id: 'md', name: 'Markdown 预览', icon: 'M↓', desc: '边写边看，支持表格与代码块',
    render: function (box) {
      var a = area('# 标题\n\n- 列表项\n- **粗体** 和 *斜体*\n\n> 引用\n\n[链接](https://xkmyth.dpdns.org)', 12);
      var mdDemo = '# 标题' + String.fromCharCode(10,10) + '- 列表项' + String.fromCharCode(10) + '- **粗体** 和 *斜体*' + String.fromCharCode(10,10) + '> 引用' + String.fromCharCode(10,10) + '[链接](https://xkmyth.dpdns.org)';
      a.value = mdDemo;
      var o = el('div', 'tl-md');
      box.appendChild(a); box.appendChild(o);
      a.addEventListener('input', function () { o.innerHTML = md(a.value); });
      o.innerHTML = md(a.value);
      function md(s) {
        var esc = function (x) { return x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var lines = esc(s).split('\n'), html = '', inCode = false, inUl = false;
        lines.forEach(function (ln) {
          if (/^```/.test(ln)) { html += inCode ? '</code></pre>' : '<pre><code>'; inCode = !inCode; return; }
          if (inCode) { html += ln + '\n'; return; }
          var l = ln.replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
            .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
          if (/^###\s/.test(l)) { html += '<h3>' + l.slice(4) + '</h3>'; return; }
          if (/^##\s/.test(l)) { html += '<h2>' + l.slice(3) + '</h2>'; return; }
          if (/^#\s/.test(l)) { html += '<h1>' + l.slice(2) + '</h1>'; return; }
          if (/^&gt;\s?/.test(l)) { html += '<blockquote>' + l.replace(/^&gt;\s?/, '') + '</blockquote>'; return; }
          if (/^-\s/.test(l)) { if (!inUl) { html += '<ul>'; inUl = true; } html += '<li>' + l.slice(2) + '</li>'; return; }
          if (inUl) { html += '</ul>'; inUl = false; }
          if (/^---$/.test(l)) { html += '<hr>'; return; }
          html += l.trim() ? '<p>' + l + '</p>' : '';
        });
        if (inUl) html += '</ul>';
        if (inCode) html += '</code></pre>';
        return html;
      }
    } });

  /* 12 进制转换 */
  T.push({ id: 'base', name: '进制转换', icon: '01', desc: '二 / 八 / 十 / 十六进制互转',
    render: function (box) {
      var a = el('input', 'tl-input'); a.placeholder = '输入数字，例如 255 或 0xFF'; a.value = '255';
      var o = out();
      box.appendChild(a); box.appendChild(row(btn('转换', function () {
        var v = a.value.trim(), n = NaN;
        if (/^0x[0-9a-f]+$/i.test(v)) n = parseInt(v.slice(2), 16);
        else if (/^0b[01]+$/i.test(v)) n = parseInt(v.slice(2), 2);
        else if (/^[0-9]+$/.test(v)) n = parseInt(v, 10);
        if (isNaN(n)) { o.textContent = '看不懂这个数字'; o.className = 'tl-out bad'; return; }
        o.textContent = '十进制：' + n + '\n二进制：' + n.toString(2) + '\n八进制：' + n.toString(8) + '\n十六进制：' + n.toString(16).toUpperCase() +
          '\n字符：' + (n > 31 && n < 0x10ffff ? String.fromCodePoint(n) : '(不可显示)');
        o.className = 'tl-out ok';
      }))); box.appendChild(o);
    } });

  function copy(txt) {
    if (!txt) return;
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    else { var t = el('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  }

  function boot() {
    var nav = document.getElementById('tlNav'), panel = document.getElementById('tlPanel');
    if (!nav || !panel) return;
    T.forEach(function (t, i) {
      var b = el('button', 'tl-card' + (i === 0 ? ' on' : ''));
      b.type = 'button';
      b.innerHTML = '<span class="tl-ico">' + t.icon + '</span><span class="tl-name">' + t.name + '</span><span class="tl-desc">' + t.desc + '</span>';
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(nav.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        panel.innerHTML = '';
        var head = el('h2', 'tl-h2', t.name);
        var sub = el('p', 'tl-sub', t.desc);
        panel.appendChild(head); panel.appendChild(sub);
        var box = el('div', 'tl-box');
        panel.appendChild(box);
        t.render(box);
        if (history.replaceState) history.replaceState(null, '', '#t=' + t.id);
      });
      nav.appendChild(b);
    });
    var hash = (location.hash.match(/t=([a-z0-9]+)/) || [])[1];
    var idx = Math.max(0, T.findIndex(function (x) { return x.id === hash; }));
    nav.children[idx].click();
  }
  window.addEventListener('hashchange', function () {
    var h = (location.hash.match(/t=([a-z0-9]+)/) || [])[1];
    if (!h) return;
    var i = T.findIndex(function (x) { return x.id === h; });
    var nav = document.getElementById('tlNav');
    if (i >= 0 && nav && nav.children[i]) nav.children[i].click();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.XKTools = { list: T };
})();

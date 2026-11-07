/* ============================================================
   xkmyth 全站脚本 v2 —— 星空 / 主题 / 命令面板 / 滚动进度 / 渐入 / Toast
   被所有页面引用：<script src="/sub.js"></script>
   1) 星空背景（DPR≤2，后台暂停，减少动效时静止）
   2) 深浅色主题（localStorage 记忆，跟随系统）
   3) 全局命令面板 ⌘K / Ctrl+K / `/`：页面 + 工具 + 文档统一检索
   4) 顶部阅读进度条、.reveal 渐入、代码块复制、Toast、年份
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var docEl = document.documentElement;

  /* ---------- 0. 主题（尽早应用，避免闪白） ---------- */
  var THEME_KEY = 'xkmyth-theme2';
  function savedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function applyTheme(t) {
    if (t === 'light') docEl.setAttribute('data-theme', 'light');
    else docEl.removeAttribute('data-theme');
    var btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = t === 'light' ? '☾' : '☀';
      btn.setAttribute('aria-label', t === 'light' ? '切换到深色模式' : '切换到浅色模式');
      btn.setAttribute('title', t === 'light' ? '切换到深色模式' : '切换到浅色模式');
    }
  }
  var stored = savedTheme();
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(stored || (prefersLight ? 'light' : 'dark'));

    /* ---------- 1. 星空（三层视差 + 缓慢漂移 + 偶尔流星） ---------- */
  var canvas = document.getElementById('sky');
  if (canvas && canvas.getContext && !canvas.dataset.owner) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var stars = [], meteors = [], raf = null, W = 0, H = 0;
    var mx = 0, my = 0, tmx = 0, tmy = 0;          /* 指针视差（当前 / 目标） */
    var meteorGap = 5500, lastMeteor = 0, lastT = 0;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(230, Math.round((W * H) / 10500));
      stars = [];
      for (var i = 0; i < count; i++) {
        var z = Math.pow(Math.random(), 1.6);        /* 偏远景：多数星小且慢 */
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: (0.4 + Math.random() * 1.1) * (0.55 + z * 0.95),
          a: Math.random() * 6.2832,
          s: 0.004 + Math.random() * 0.012,          /* 闪烁速度 */
          v: 0.010 + z * 0.075,                      /* 上升速度 */
          z: z,
          hue: Math.random() < 0.22 ? '252,211,77' : (Math.random() < 0.5 ? '154,227,255' : '232,238,255'),
          halo: Math.random() < 0.14
        });
      }
    }

    function spawnMeteor() {
      var fromLeft = Math.random() < 0.55;
      meteors.push({
        x: fromLeft ? -70 : W + 70,
        y: Math.random() * H * 0.55 - 40,
        vx: (fromLeft ? 1 : -1) * (0.30 + Math.random() * 0.22),
        vy: 0.16 + Math.random() * 0.12,
        t: 0, ttl: 1500 + Math.random() * 900,
        len: 110 + Math.random() * 90,
        hue: Math.random() < 0.45 ? '252,211,77' : '154,227,255'
      });
    }

    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + st.hue + ',' + (0.22 + st.z * 0.5).toFixed(3) + ')';
        ctx.arc(st.x, st.y, st.r, 0, 6.2832);
        ctx.fill();
      }
    }

    function frame(t) {
      var dt = lastT ? Math.min(t - lastT, 48) : 16.7;
      lastT = t;
      var k = dt / 16.7;

      mx += (tmx - mx) * 0.045 * k;
      my += (tmy - my) * 0.045 * k;

      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.a += st.s * k;
        st.y -= st.v * k;
        if (st.y < -6) { st.y = H + 6; st.x = Math.random() * W; }
        var alpha = 0.16 + Math.abs(Math.sin(st.a)) * 0.62;
        var x = st.x + mx * st.z * 20, y = st.y + my * st.z * 14;
        if (st.halo) {
          ctx.beginPath();
          ctx.fillStyle = 'rgba(' + st.hue + ',' + (alpha * 0.1).toFixed(3) + ')';
          ctx.arc(x, y, st.r * 3.6, 0, 6.2832);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + st.hue + ',' + alpha.toFixed(3) + ')';
        ctx.arc(x, y, st.r, 0, 6.2832);
        ctx.fill();
      }

      if (t - lastMeteor > meteorGap && meteors.length < 2) {
        spawnMeteor();
        lastMeteor = t;
        meteorGap = 7000 + Math.random() * 8000;
      }
      for (var m = meteors.length - 1; m >= 0; m--) {
        var me = meteors[m];
        me.t += dt;
        var p = me.t / me.ttl;
        if (p >= 1) { meteors.splice(m, 1); continue; }
        me.x += me.vx * dt; me.y += me.vy * dt;
        var fade = Math.sin(Math.PI * p) * 0.9;
        var ex = me.x - me.vx * me.len, ey = me.y - me.vy * me.len;
        var gd = ctx.createLinearGradient(me.x, me.y, ex, ey);
        gd.addColorStop(0, 'rgba(' + me.hue + ',' + (fade * 0.95).toFixed(3) + ')');
        gd.addColorStop(1, 'rgba(' + me.hue + ',0)');
        ctx.strokeStyle = gd;
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(me.x, me.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,' + (fade * 0.9).toFixed(3) + ')';
        ctx.arc(me.x, me.y, 1.6, 0, 6.2832); ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf && !reduce) { lastT = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    canvas.style.transition = 'opacity 1.4s ease';
    if (reduce) {
      canvas.style.opacity = '1';
      drawStatic();
    } else {
      canvas.style.opacity = '0';
      start();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { canvas.style.opacity = '1'; });
      });
    }
    window.addEventListener('resize', function () {
      stop(); resize(); if (reduce) { drawStatic(); } else { start(); }
    }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { start(); }
    });
    window.addEventListener('pointermove', function (e) {
      tmx = (e.clientX / (W || 1)) * 2 - 1;
      tmy = (e.clientY / (H || 1)) * 2 - 1;
    }, { passive: true });
  }

  /* ---------- 2. 年份 ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- 3. 滚动进度条 ---------- */
  var bar = document.getElementById('scrollBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'scrollBar';
    document.body.appendChild(bar);
  }
  var progTick = false;
  function updateProgress() {
    var h = docEl.scrollHeight - window.innerHeight;
    var p = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.width = Math.max(0, Math.min(100, p)).toFixed(2) + '%';
    progTick = false;
  }
  window.addEventListener('scroll', function () {
    if (!progTick) { progTick = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();

  /* ---------- 4. 导航增强：主题按钮 + 检索按钮 ---------- */
  var navInner = document.querySelector('.nav-inner') || document.querySelector('.nav');
  if (navInner && !document.getElementById('themeBtn')) {
    var tools = document.createElement('div');
    tools.className = 'nav-tools';

    var cmdkBtn = document.createElement('button');
    cmdkBtn.type = 'button';
    cmdkBtn.className = 'nav-btn';
    cmdkBtn.id = 'cmdkBtn';
    cmdkBtn.setAttribute('aria-label', '打开全站检索');
    cmdkBtn.innerHTML = '<span aria-hidden="true">⌕</span><span class="kbd">⌘K</span>';
    cmdkBtn.addEventListener('click', function () { openPalette(); });

    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'nav-btn';
    themeBtn.id = 'themeBtn';
    themeBtn.addEventListener('click', function () {
      var next = docEl.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme(next);
    });

    tools.appendChild(cmdkBtn);
    tools.appendChild(themeBtn);
    navInner.appendChild(tools);
    /* 按钮是后插入的，重放一次主题，把图标 / aria-label 补上（否则是个空按钮） */
    applyTheme(docEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }

  /* ---------- 4.1 导航折叠（手机 / 窄屏）+ 当前栏目高亮 ---------- */
  (function navShell() {
    var header = document.querySelector('.nav');
    var inner = document.querySelector('.nav-inner');
    var nav = document.querySelector('.nav .nav-links') || document.querySelector('.nav nav');
    if (header && inner && nav) {
      if (!nav.id) nav.id = 'mainNav';
      var burger = document.createElement('button');
      burger.type = 'button';
      burger.className = 'nav-burger';
      burger.id = 'navBurger';
      burger.setAttribute('aria-label', '展开导航菜单');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-controls', nav.id);
      burger.innerHTML = '<span></span><span></span><span></span>';
      inner.appendChild(burger);

      var setOpen = function (open) {
        if (open) header.classList.add('nav-open'); else header.classList.remove('nav-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        burger.setAttribute('aria-label', open ? '收起导航菜单' : '展开导航菜单');
      };
      burger.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(!header.classList.contains('nav-open'));
      });
      nav.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('a')) setOpen(false);
      });
      document.addEventListener('click', function (e) {
        if (header.classList.contains('nav-open') && !header.contains(e.target)) setOpen(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 900) setOpen(false);
      });
    }

    /* 当前栏目点亮 */
    var here = location.pathname.replace(/\/index\.html$/, '/');
    var links = document.querySelectorAll('.nav .nav-links a, .nav nav a');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (href.charAt(0) !== '/' || href.indexOf('#') >= 0) continue;
      var target = href.replace(/\/index\.html$/, '/');
      var hit = target === '/' ? here === '/' : (here === target || here.indexOf(target) === 0);
      if (hit) { links[i].setAttribute('aria-current', 'page'); break; }
    }
  })();

  /* ---------- 5. 命令面板 ---------- */
  var INDEX_URL = '/search-index.json';
  var index = [], indexState = 0, lastFocus = null;
  var cmdk = null, inputEl = null, listEl = null, sel = 0, view = [];

  function norm(s) { return String(s || '').toLowerCase(); }

  function buildPalette() {
    if (cmdk) return;
    cmdk = document.createElement('div');
    cmdk.id = 'cmdk';
    cmdk.setAttribute('role', 'dialog');
    cmdk.setAttribute('aria-modal', 'true');
    cmdk.setAttribute('aria-label', '全站检索');
    cmdk.innerHTML =
      '<div class="scrim" data-close="1"></div>' +
      '<div class="box">' +
        '<input class="cmdk-input" id="cmdkInput" type="search" autocomplete="off" spellcheck="false" ' +
          'placeholder="搜索页面、工具、文档…（↑↓ 选择，Enter 打开，Esc 关闭）">' +
        '<div class="cmdk-list" id="cmdkList" role="listbox"></div>' +
        '<div class="cmdk-foot"><span><span class="kbd">↑</span><span class="kbd">↓</span> 选择</span>' +
        '<span><span class="kbd">Enter</span> 打开</span><span><span class="kbd">Esc</span> 关闭</span></div>' +
      '</div>';
    document.body.appendChild(cmdk);
    inputEl = cmdk.querySelector('#cmdkInput');
    listEl = cmdk.querySelector('#cmdkList');
    inputEl.addEventListener('input', function () { renderPalette(inputEl.value); });
    cmdk.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-close')) closePalette();
    });
    cmdk.addEventListener('keydown', onPaletteKey);
  }

  function loadIndex(cb) {
    if (index.length) { cb(); return; }
    if (indexState === 2) { cb(); return; }
    fetch(INDEX_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        index = Array.isArray(data.items) ? data.items : [];
        indexState = 1;
        cb();
      })
      .catch(function () {
        indexState = 2;
        index = fallbackIndex();
        cb();
      });
  }

  /* 索引不可用时，退化到「扫描当前页链接」 */
  function fallbackIndex() {
    var out = [], seen = {};
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|javascript:)/.test(href)) continue;
      if (seen[href]) continue;
      seen[href] = 1;
      out.push({ title: (a.textContent || href).replace(/\s+/g, ' ').trim().slice(0, 60), url: href, kind: '页面', kw: '', icon: '›' });
    }
    return out;
  }

  function score(item, q) {
    var t = norm(item.title), u = norm(item.url), k = norm(item.kw);
    if (!q) return 1;
    if (t === q) return 100;
    if (t.indexOf(q) === 0) return 82;
    if (t.indexOf(q) > -1) return 64;
    if (k.indexOf(q) > -1) return 46;
    if (u.indexOf(q) > -1) return 34;
    /* 多词：分词后每条都命中才算，标题命中越多分越高 */
    var parts = q.split(/[\s,，、/]+/);
    var multi = [];
    for (var p = 0; p < parts.length; p++) if (parts[p].length > 1) multi.push(parts[p]);
    if (multi.length > 1) {
      var all = true, inTitle = 0;
      for (var m = 0; m < multi.length; m++) {
        var hitT = t.indexOf(multi[m]) > -1;
        if (hitT) inTitle++;
        if (!hitT && k.indexOf(multi[m]) === -1 && u.indexOf(multi[m]) === -1) { all = false; break; }
      }
      if (all) return 40 + inTitle * 6;
    }
    /* 中文长词兜底：命中任意相邻两字 */
    if (q.length >= 2 && /[\u4e00-\u9fa5]/.test(q)) {
      var best = 0;
      for (var bi = 0; bi < q.length - 1; bi++) {
        var bi2 = q.substr(bi, 2);
        if (t.indexOf(bi2) > -1) best = Math.max(best, 30);
        else if (k.indexOf(bi2) > -1) best = Math.max(best, 20);
      }
      if (best) return best;
    }
    /* 松散匹配：q 的字符按序出现 */
    var i = 0;
    for (var j = 0; j < t.length && i < q.length; j++) if (t.charAt(j) === q.charAt(i)) i++;
    return i === q.length ? 12 : 0;
  }

  function renderPalette(q) {
    q = norm(q).trim();
    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var s = score(index[i], q);
      if (s > 0) scored.push({ it: index[i], s: s });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    view = scored.slice(0, 40).map(function (x) { return x.it; });
    sel = 0;
    listEl.innerHTML = '';
    if (!view.length) {
      var empty = document.createElement('div');
      empty.className = 'cmdk-empty';
      empty.textContent = q ? ('没有匹配「' + q + '」，试试 tools / docs / 软件名') : '输入关键词开始检索';
      listEl.appendChild(empty);
      return;
    }
    view.forEach(function (it, idx) {
      var row = document.createElement('a');
      row.className = 'cmdk-item';
      row.href = it.url;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      var ico = document.createElement('span');
      ico.setAttribute('aria-hidden', 'true');
      ico.textContent = it.icon || '›';
      var label = document.createElement('span');
      label.textContent = it.title || it.url;
      var kind = document.createElement('span');
      kind.className = 'cmdk-kind';
      kind.textContent = it.kind || '页面';
      row.appendChild(ico); row.appendChild(label); row.appendChild(kind);
      listEl.appendChild(row);
    });
  }

  function moveSel(delta) {
    var rows = listEl.querySelectorAll('.cmdk-item');
    if (!rows.length) return;
    if (rows[sel]) rows[sel].setAttribute('aria-selected', 'false');
    sel = (sel + delta + rows.length) % rows.length;
    rows[sel].setAttribute('aria-selected', 'true');
    if (rows[sel].scrollIntoView) rows[sel].scrollIntoView({ block: 'nearest' });
  }

  function onPaletteKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    else if (e.key === 'Enter') {
      var rows = listEl.querySelectorAll('.cmdk-item');
      if (rows[sel]) { e.preventDefault(); window.location.href = rows[sel].getAttribute('href'); }
    } else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  }

  function openPalette(prefill) {
    buildPalette();
    lastFocus = document.activeElement;
    cmdk.classList.add('open');
    inputEl.value = prefill || '';
    loadIndex(function () {
      renderPalette(inputEl.value);
      inputEl.focus();
      if (prefill) inputEl.select();
    });
  }

  function closePalette() {
    if (!cmdk) return;
    cmdk.classList.remove('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openPalette(); return; }
    if (e.key === '/' && !typing) { e.preventDefault(); openPalette(); return; }
    if (e.key === 'Escape') {
      if (cmdk && cmdk.classList.contains('open')) { e.preventDefault(); closePalette(); return; }
      if (helpBox && helpBox.classList.contains('open')) { e.preventDefault(); closeHelp(); return; }
    }
    if (e.key === '?' && !typing) { e.preventDefault(); openHelp(); return; }
    if ((e.key === 't' || e.key === 'T') && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var tb = document.getElementById('themeBtn');
      if (tb) { e.preventDefault(); tb.click(); }
    }
  });


  /* ---------- 键盘帮助 ---------- */
  var helpBox = null;
  function openHelp() {
    if (!helpBox) {
      helpBox = document.createElement('div');
      helpBox.id = 'kbdHelp';
      helpBox.setAttribute('role', 'dialog');
      helpBox.setAttribute('aria-modal', 'true');
      helpBox.setAttribute('aria-label', '键盘快捷键');
      helpBox.innerHTML =
        '<div class="kb-box" role="document">' +
        '<div class="kb-h">键盘快捷键</div>' +
        '<dl class="kb-list">' +
        '<div><dt><span class="kbd">/</span></dt><dd>全站检索</dd></div>' +
        '<div><dt><span class="kbd">⌘K</span> <span class="kbd">Ctrl K</span></dt><dd>全站检索（同上）</dd></div>' +
        '<div><dt><span class="kbd">T</span></dt><dd>切换深色 / 浅色</dd></div>' +
        '<div><dt><span class="kbd">?</span></dt><dd>打开本页</dd></div>' +
        '<div><dt><span class="kbd">Esc</span></dt><dd>关闭弹层 / 清空搜索</dd></div>' +
        '<div><dt><span class="kbd">↑</span> <span class="kbd">↓</span> <span class="kbd">Enter</span></dt><dd>在检索结果里选择并打开</dd></div>' +
        '</dl>' +
        '<p class="kb-foot">这是纯键盘可达的站：导航、工具、检索、主题都能只用手完成。</p>' +
        '</div>';
      document.body.appendChild(helpBox);
      helpBox.addEventListener('click', function (e) {
        if (e.target === helpBox) closeHelp();
      });
    }
    helpBox.classList.add('open');
    var box = helpBox.querySelector('.kb-box');
    if (box) { box.tabIndex = -1; box.focus(); }
  }
  function closeHelp() {
    if (helpBox) helpBox.classList.remove('open');
  }
  window.xkmythHelp = openHelp;

  /* ---------- 6. 渐入 ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('in'); });
  }

  /* ---------- 7. Toast ---------- */
  var toastEl = document.querySelector('.toast');
  if (toastEl) { toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); }
  var toastTimer = null;
  function showToast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.className = 'toast' + (kind ? ' ' + kind : '');
    toastEl.textContent = String(msg || '');
    void toastEl.offsetWidth; /* 强制回流，连续调用时动画重播 */
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }
  window.showToast = showToast;

  /* ---------- 8. 复制 ---------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand failed'));
      } catch (err) { reject(err); }
    });
  }

  /* data-copy 委托：点击带 data-copy 的元素复制其值（或指向的元素内容） */
  document.addEventListener('click', function (e) {
    var node = e.target;
    while (node && node !== document.body) {
      if (node.hasAttribute && node.hasAttribute('data-copy')) break;
      node = node.parentNode;
    }
    if (!node || node === document.body || !node.hasAttribute || !node.hasAttribute('data-copy')) return;
    var spec = node.getAttribute('data-copy') || '';
    var text = spec;
    if (spec.charAt(0) === '#' || spec.charAt(0) === '.') {
      var target = null;
      try { target = document.querySelector(spec); } catch (err) { target = null; }
      text = target ? (('value' in target) ? target.value : target.textContent) : '';
    }
    if (!text) { showToast('没有可复制的内容', 'bad'); return; }
    copyText(text).then(function () {
      showToast('已复制', 'ok');
      node.classList.add('copied');
      setTimeout(function () { node.classList.remove('copied'); }, 1200);
    }).catch(function () { showToast('复制失败，请手动选择', 'bad'); });
  });

  /* ---------- 9. 代码块复制按钮 ---------- */
  var codes = document.querySelectorAll('pre > code');
  Array.prototype.forEach.call(codes, function (code, i) {
    var pre = code.parentNode;
    if (!pre || pre.querySelector('.code-copy')) return;
    if (!code.id) code.id = 'code-' + i;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.setAttribute('data-copy', '#' + code.id);
    btn.textContent = '复制';
    pre.appendChild(btn);
  });

  /* ---------- 10. 外链统一加固 ---------- */
  var anchors = document.querySelectorAll('a[href^="http"]');
  Array.prototype.forEach.call(anchors, function (a) {
    if (!a.getAttribute('target')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  /* 暴露给页面脚本 */
  window.xkmythUI = { toast: showToast, copy: copyText, palette: openPalette };
})();


/* ---------------- xkmyth-pwa：service worker + 安装引导 ---------------- */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var secure = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!secure || /[?&]nosw=1/.test(location.search)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* 静默失败 */ });
  });
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    var bar = document.querySelector('.nav-tools');
    if (!bar || document.getElementById('pwaBtn')) return;
    var b = document.createElement('button');
    b.id = 'pwaBtn';
    b.className = 'nav-btn';
    b.type = 'button';
    b.title = '把 xkmyth 装到桌面（离线可用）';
    b.innerHTML = '<span aria-hidden="true">⤓</span><span class="nav-btn-txt">安装</span>';
    b.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; b.remove(); });
    });
    bar.insertBefore(b, bar.firstChild);
  });
  window.addEventListener('appinstalled', function () {
    var b = document.getElementById('pwaBtn');
    if (b) b.remove();
    if (window.showToast) window.showToast('已安装到桌面，离线也能用', 'ok');
  });
})();

/* ============================================================
   第六节（追加）：页内目录 / 回到顶部 / 卡片光晕
   全站共用（本文件被 59 个页面加载），纯增量，无依赖。
   ============================================================ */
(function () {
  'use strict';
  var docEl = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hoverable = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  /* ---------- 1. 页内目录（≥3 个 h2 才生成，≥1200px 才显示） ---------- */
  function buildToc() {
    if (docEl.hasAttribute('data-notoc')) return;
    var main = document.getElementById('main') || document.querySelector('main') || document.body;
    var all = Array.prototype.slice.call(main.querySelectorAll('h2'));
    var hs = all.filter(function (h) {
      if (h.closest('.nav') || h.closest('.foot')) return false;
      return (h.textContent || '').trim().length > 1;
    });
    if (hs.length < 3) return;

    var seen = {};
    var items = hs.map(function (h) {
      var txt = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (!h.id) {
        var base = txt.toLowerCase().replace(/[\s\u3000]+/g, '-')
          .replace(/[^\w\u4e00-\u9fa5-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'sec';
        var id = base, n = 1;
        while (seen[id] || document.getElementById(id)) { id = base + '-' + (n++); }
        h.id = id;
      }
      seen[h.id] = 1;
      h.classList.add('toc-anchor');
      return { h: h, txt: txt.length > 26 ? txt.slice(0, 25) + '…' : txt };
    });

    var box = document.createElement('aside');
    box.className = 'toc-float';
    box.id = 'tocFloat';
    box.setAttribute('aria-label', '页内目录');
    var cap = document.createElement('div');
    cap.className = 'toc-cap';
    cap.textContent = '本页目录';
    box.appendChild(cap);
    var nav = document.createElement('nav');
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'toc-link';
      a.href = '#' + it.h.id;
      a.setAttribute('data-t', it.h.id);
      a.textContent = it.txt;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        it.h.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        if (history.replaceState) history.replaceState(null, '', '#' + it.h.id);
      });
      nav.appendChild(a);
    });
    box.appendChild(nav);
    document.body.appendChild(box);

    var links = nav.querySelectorAll('.toc-link');
    function setActive(id) {
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute('data-t') === id) links[i].classList.add('on');
        else links[i].classList.remove('on');
      }
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        var best = null;
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        });
        if (best) setActive(best.target.id);
      }, { rootMargin: '-84px 0px -68% 0px', threshold: [0, 0.15, 0.5, 1] });
      items.forEach(function (it) { io.observe(it.h); });
    }
    function vis() {
      var y = window.pageYOffset || window.scrollY || 0;
      box.classList.toggle('show', y > 200 && window.innerWidth >= 1200);
    }
    window.addEventListener('scroll', vis, { passive: true });
    window.addEventListener('resize', vis);
    vis();
  }

  /* ---------- 2. 回到顶部 ---------- */
  function buildTop() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'to-top';
    b.id = 'toTop';
    b.setAttribute('aria-label', '回到顶部');
    b.setAttribute('title', '回到顶部');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6"/><path d="M5 13l7-7 7 7"/></svg>';
    document.body.appendChild(b);
    b.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    function vis() {
      var y = window.pageYOffset || window.scrollY || 0;
      b.classList.toggle('show', y > 680);
    }
    window.addEventListener('scroll', vis, { passive: true });
    vis();
  }

  /* ---------- 3. 卡片指针光晕（仅鼠标设备 + 未开减弱动效） ---------- */
  function glow() {
    if (!hoverable || reduce) return;
    var sel = '[class*="card"],[class*="tile"]';
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) els[i].classList.add('glowable');
    var raf = null, pend = null;
    document.addEventListener('pointermove', function (e) {
      var t = e.target;
      var el = t && t.closest ? t.closest('.glowable') : null;
      if (!el) return;
      pend = { el: el, x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        if (!pend) return;
        var r = pend.el.getBoundingClientRect();
        pend.el.style.setProperty('--mx', (pend.x - r.left) + 'px');
        pend.el.style.setProperty('--my', (pend.y - r.top) + 'px');
      });
    }, { passive: true });
  }

  function boot() {
    try { buildToc(); } catch (e) { }
    try { buildTop(); } catch (e) { }
    try { glow(); } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ============================================================
   第七节：账号系统（全站注入脚本 + 导航入口 + 访问记录）
   ============================================================ */
(function () {
  'use strict';
  if (window.__xkAccBoot) return;
  window.__xkAccBoot = 1;

  function ensure(cb) {
    if (window.XKAccount) return cb();
    var s = document.createElement('script');
    s.src = '/js/account.js';
    s.async = true;
    s.onload = function () { cb(); };
    s.onerror = function () { };
    document.head.appendChild(s);
  }

  // 导航里补一个「论坛」入口（全站统一，只插一次）
  function forumLink() {
    var lyn = document.getElementById('mainNav');
    if (!lyn || lyn.querySelector('[data-navx="forum"]')) return;
    var a = document.createElement('a');
    a.href = '/forum/';
    a.textContent = '论坛';
    a.setAttribute('data-navx', 'forum');
    var last = lyn.querySelector('a[href="/docs/"]');
    if (last && last.nextSibling) lyn.insertBefore(a, last.nextSibling);
    else lyn.appendChild(a);
  }

  function chip() {
    forumLink();
    if (!window.XKAccount) return;
    var inner = document.querySelector('.nav-inner');
    if (!inner || document.getElementById('navAcc')) return;
    var u = window.XKAccount.user();
    var a = document.createElement('a');
    a.id = 'navAcc';
    a.className = 'nav-acc';
    a.href = '/account/';
    if (u) {
      var t = window.XKAccount.tier(u);
      var ini = String(u.name).slice(0, 1).toUpperCase();
      a.innerHTML = '<i class="nav-acc-ava t' + t + '">' + ini + '</i><span id="navAccTxt">T' + t + '</span>';
      a.title = u.name + ' · T' + t + ' · ' + window.XKAccount.tierName(t);
    } else {
      a.innerHTML = '<span id="navAccTxt">登录</span>';
      a.title = '账号 · 直接注册即可用';
    }
    var burger = inner.querySelector('.nav-burger');
    if (burger) inner.insertBefore(a, burger);
    else inner.appendChild(a);
  }

  function searchHook() {
    if (window.__xkSearchHook) return;
    window.__xkSearchHook = 1;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var el = document.activeElement;
      if (!el || !el.classList || !el.classList.contains('cmdk-input')) return;
      var q = (el.value || '').trim();
      if (q && window.XKAccount) {
        try { window.XKAccount.log('search', q); } catch (err) { }
      }
    }, true);
  }

  function run() {
    ensure(function () {
      try { chip(); } catch (e) { }
      try { window.XKAccount.visit(location.pathname, document.title); } catch (e) { }
      try { searchHook(); } catch (e) { }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
/* ---- 手机底部 Tab ---- */
(function () {
  if (window.__xkTab) return;
  window.__xkTab = 1;
  function build() {
    if (document.querySelector('.xk-tabbar')) return;
    var items = [
      ['/', '\u2302', '\u9996\u9875'],
      ['/forum/', '\u2709', '\u8bba\u575b'],
      ['/start/', '\u2733', '\u4e2d\u8f6c\u7ad9'],
      ['/account/', '\u263A', '\u8d26\u53f7']
    ];
    var path = location.pathname;
    var nav = document.createElement('nav');
    nav.className = 'xk-tabbar';
    nav.setAttribute('aria-label', '\u624b\u673a\u5bfc\u822a');
    nav.innerHTML = items.map(function (it) {
      var on = it[0] === '/' ? (path === '/' || path === '/index.html') : path.indexOf(it[0]) === 0;
      return '<a href="' + it[0] + '"' + (on ? ' class="on" aria-current="page"' : '') + '><b aria-hidden="true">' + it[1] + '</b>' + it[2] + '</a>';
    }).join('');
    document.body.appendChild(nav);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

/* ============================================================
   第十节：星空 AI 气泡（全站）
   ============================================================ */
(function () {
  'use strict';
  function boot() {
    if (window.__xkAiBoot) return;
    window.__xkAiBoot = 1;
    if (!window.XKAccount) {
      var s0 = document.createElement('script');
      s0.src = '/js/account.js'; s0.async = true;
      s0.onload = function () { plug(); };
      document.head.appendChild(s0);
    } else plug();
    function plug() {
      if (document.querySelector('script[src="/js/ai.js"]')) return;
      var sc = document.createElement('script');
      sc.src = '/js/ai.js'; sc.async = true; sc.defer = true;
      sc.onerror = function () { };
      document.body.appendChild(sc);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

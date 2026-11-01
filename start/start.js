/* 星空中转站 · 逻辑
   数据：预装存在 sites.js，用户改动存 localStorage（只存 diff：custom + hidden）
   不依赖任何后端，断网可用。 */
(function () {
  'use strict';

  var KEY = 'xkmyth-start-v1';
  var MINE = '__mine';  /* 「我的添加」虚拟分类，不是一个真分类 */
  var P = window.XK_PRESET || { cats: [], items: [] };

  var state = {
    custom: [],     // [{id,n,u,c,d}]
    hidden: [],     // [url, ...] 被隐藏的预装项
    cat: '全部',
    q: ''
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  /* ---------- 存储 ---------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (Array.isArray(raw.custom)) state.custom = raw.custom.filter(valid);
      if (Array.isArray(raw.hidden)) state.hidden = raw.hidden.filter(function (x) { return typeof x === 'string'; });
    } catch (e) { state.custom = []; state.hidden = []; }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, custom: state.custom, hidden: state.hidden }));
    } catch (e) {
      toast('本地存储写不进去（可能是隐私模式），这次改动不会保留');
    }
  }
  function valid(o) {
    return o && typeof o === 'object' && typeof o.n === 'string' && typeof o.u === 'string' && /^https?:\/\//i.test(o.u);
  }

  /* ---------- 数据合并 ---------- */
  function presetItems() {
    return P.items.map(function (it, i) {
      return { id: 'p' + i, n: it[0], u: it[1], c: it[2], d: it[3] || '', preset: true };
    });
  }
  function allItems() {
    return presetItems().concat(state.custom.map(function (o) { return Object.assign({ preset: false }, o); }));
  }
  function visibleItems() {
    return allItems().filter(function (o) { return state.hidden.indexOf(o.u) < 0; });
  }
  function catList() {
    var seen = {};
    var out = [];
    P.cats.concat(state.custom.map(function (o) { return o.c; })).forEach(function (c) {
      if (c && !seen[c]) { seen[c] = 1; out.push(c); }
    });
    return out;
  }
  function host(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; }
  }

  /* ---------- 渲染：分类 chips ---------- */
  function renderChips() {
    var box = $('#sfChips');
    if (!box) return;
    box.textContent = '';
    var items = visibleItems();
    var cats = catList();

    var mk = function (label, key, count) {
      var b = el('button', 'sf-chip' + (state.cat === key ? ' on' : ''), label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', state.cat === key ? 'true' : 'false');
      b.dataset.cat = key;
      b.appendChild(el('span', 'n', count));
      b.addEventListener('click', function () {
        state.cat = key;
        render();
      });
      return b;
    };

    box.appendChild(mk('全部', '全部', items.length));
    cats.forEach(function (c) {
      var n = items.filter(function (o) { return o.c === c; }).length;
      if (n) box.appendChild(mk(c, c, n));
    });
    if (state.custom.length) {
      box.appendChild(mk('我的添加', MINE, items.filter(function (o) { return !o.preset; }).length));
    }
  }

  /* ---------- 渲染：站点 ---------- */
  function iconNode(item) {
    var box = el('span', 'ico');
    box.dataset.l = (item.n || '?').trim().charAt(0);
    var h = host(item.u);
    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', function () {
      if (!img.dataset.step) {
        img.dataset.step = '2';
        img.src = 'https://' + h + '/favicon.ico';
      } else {
        img.remove();
      }
    });
    img.src = 'https://favicon.im/' + h;
    box.appendChild(img);
    return box;
  }

  function siteNode(item) {
    var wrap = el('div', 'site');
    var a = document.createElement('a');
    a.className = 'site-a';
    a.href = item.u;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = item.n + (item.d ? ' · ' + item.d : '') + '\n' + item.u;

    a.appendChild(iconNode(item));
    var txt = el('span', 'txt');
    txt.appendChild(el('b', null, item.n));
    txt.appendChild(el('small', null, item.d || host(item.u)));
    a.appendChild(txt);
    wrap.appendChild(a);

    var ops = el('span', 'ops');
    if (item.preset) {
      var hide = el('button', null, '×');
      hide.type = 'button';
      hide.title = '隐藏这个站点（可在「恢复默认」里找回）';
      hide.addEventListener('click', function (e) {
        e.preventDefault();
        state.hidden.push(item.u);
        save(); render();
      });
      ops.appendChild(hide);
    } else {
      var ed = el('button', null, '✎');
      ed.type = 'button';
      ed.title = '编辑';
      ed.addEventListener('click', function (e) { e.preventDefault(); openDialog(item); });
      var del = el('button', 'del', '🗑');
      del.type = 'button';
      del.title = '删除';
      del.addEventListener('click', function (e) {
        e.preventDefault();
        if (!confirm('删除「' + item.n + '」？')) return;
        state.custom = state.custom.filter(function (o) { return o.id !== item.id; });
        save(); render();
      });
      ops.appendChild(ed);
      ops.appendChild(del);
    }
    wrap.appendChild(ops);
    return wrap;
  }

  function catMatch(o) {
    if (state.cat === '全部') return true;
    if (state.cat === MINE) return !o.preset;
    return o.c === state.cat;
  }

  function matches(item) {
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    return (item.n + ' ' + item.u + ' ' + (item.d || '') + ' ' + item.c).toLowerCase().indexOf(q) >= 0;
  }

  function renderList() {
    var box = $('#sfList');
    if (!box) return;
    box.textContent = '';

    var items = visibleItems().filter(catMatch).filter(matches);
    if (!items.length) {
      var e = el('div', 'sf-empty');
      e.appendChild(el('b', null, state.q ? '没有匹配的站点。' : '这一类还是空的。'));
      e.appendChild(document.createTextNode(' 换个词搜搜，或者点右上角「+ 添加网站」自己加一个。'));
      box.appendChild(e);
      return;
    }

    /* 分组：全部 → 每个真分类一组；搜索 → 单组；我的添加 → 单组；具体分类 → 单组
       注意：一个站点只能出现在一组里，否否则计数会和列表对不上 */
    var groups;
    if (state.q && state.cat === '全部') {
      groups = [{ name: '搜索结果', list: items }];
    } else if (state.cat === '全部') {
      groups = catList().map(function (c) {
        return {
          name: c,
          list: items.filter(function (o) { return o.c === c; })
        };
      }).filter(function (g) { return g.list.length; });
    } else if (state.cat === MINE) {
      groups = [{ name: '我的添加', list: items }];
    } else {
      groups = [{ name: state.cat, list: items }];
    }

    groups.forEach(function (g) {
      var h = el('h2', 'sf-cat');
      h.appendChild(document.createTextNode(g.name));
      h.appendChild(el('span', 'n', g.list.length));
      box.appendChild(h);

      var grid = el('ul', 'sf-grid');
      g.list.forEach(function (it) {
        var li = document.createElement('li');
        li.appendChild(siteNode(it));
        grid.appendChild(li);
      });
      box.appendChild(grid);
    });
  }

  function renderCount() {
    var vis = visibleItems();
    var mine = vis.filter(function (o) { return !o.preset; }).length;
    var txt = '共 ' + vis.length + ' 个站点';
    if (mine) txt += ' · 其中自己加的 ' + mine + ' 个';
    if (state.hidden.length) txt += ' · 已隐藏 ' + state.hidden.length + ' 个';
    if (state.q) txt += ' · 匹配 ' + vis.filter(matches).length + ' 个';
    var n = $('#sfCount');
    if (n) n.textContent = txt;
  }

  function render() {
    renderChips();
    renderList();
    renderCount();
  }

  /* ---------- 弹窗 ---------- */
  var editing = null;

  function openDialog(item) {
    editing = item || null;
    $('#sfDlgTitle').textContent = item ? '编辑网站' : '添加网站';
    $('#sfName').value = item ? item.n : '';
    $('#sfUrl').value = item ? item.u : '';
    $('#sfDesc').value = item ? (item.d || '') : '';
    $('#sfErr').classList.remove('on');

    var sel = $('#sfCat');
    sel.textContent = '';
    var cats = catList();
    cats.concat(['自定义']).forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      sel.appendChild(o);
    });
    sel.value = item ? item.c : '自定义';
    if (!sel.value) sel.value = '自定义';

    var dlg = $('#sfDlg');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    setTimeout(function () { $('#sfName').focus(); }, 30);
  }

  function normalizeUrl(u) {
    u = (u || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = 'https://' + u;
    try {
      var x = new URL(u);
      if (x.protocol !== 'http:' && x.protocol !== 'https:') return '';
      return x.href;
    } catch (e) { return ''; }
  }

  function submitDialog() {
    var n = ($('#sfName').value || '').trim();
    var u = normalizeUrl($('#sfUrl').value);
    var c = $('#sfCat').value || '自定义';
    var d = ($('#sfDesc').value || '').trim();
    if (!n || !u) {
      $('#sfErr').classList.add('on');
      return false;
    }
    if (editing) {
      state.custom = state.custom.map(function (o) {
        return o.id === editing.id ? { id: o.id, n: n, u: u, c: c, d: d } : o;
      });
    } else {
      if (allItems().some(function (o) { return o.u === u; })) {
        toast('这个网址已经在里面了');
        return false;
      }
      state.custom.push({ id: 'c' + Date.now().toString(36), n: n, u: u, c: c, d: d });
      state.cat = '全部';
      state.q = '';
      $('#sfQ').value = '';
    }
    save(); render();
    toast(editing ? '已保存修改' : '已添加「' + n + '」');
    editing = null;
    return true;
  }

  /* ---------- 导入 / 导出 ---------- */
  function exportJson() {
    var data = { app: 'xkmyth-start', v: 1, exportedAt: new Date().toISOString(), custom: state.custom, hidden: state.hidden };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    var d = new Date();
    var pad = function (x) { return String(x).padStart(2, '0'); };
    a.href = URL.createObjectURL(blob);
    a.download = 'xkmyth-start-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('已导出 ' + state.custom.length + ' 个自定义站点');
  }

  function importJson(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var raw;
      try { raw = JSON.parse(String(fr.result)); } catch (e) { toast('这个文件不是合法的 JSON'); return; }
      var inc = Array.isArray(raw) ? raw : (raw.custom || []);
      var inh = Array.isArray(raw.hidden) ? raw.hidden : [];
      if (!Array.isArray(inc)) { toast('文件里没有找到站点数据'); return; }

      var have = {};
      allItems().forEach(function (o) { have[o.u] = 1; });
      var added = 0;
      inc.filter(valid).forEach(function (o) {
        if (have[o.u]) return;
        have[o.u] = 1;
        state.custom.push({
          id: 'c' + Date.now().toString(36) + added,
          n: String(o.n).slice(0, 24),
          u: o.u,
          c: String(o.c || '自定义').slice(0, 12),
          d: String(o.d || '').slice(0, 30)
        });
        added++;
      });
      inh.forEach(function (u) { if (state.hidden.indexOf(u) < 0) state.hidden.push(u); });
      save(); render();
      toast('导入完成：新增 ' + added + ' 个站点');
    };
    fr.onerror = function () { toast('读文件失败'); };
    fr.readAsText(file);
  }

  /* ---------- 轻提示 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('sfToast');
    if (!t) {
      t = el('div', null, '');
      t.id = 'sfToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;' +
        'padding:11px 18px;border-radius:11px;font-size:13.5px;max-width:86vw;text-align:center;' +
        'background:var(--bg1,#0a1020);color:var(--text,#e8eeff);' +
        'border:1px solid var(--line-gold,rgba(255,212,121,.42));' +
        'box-shadow:0 18px 44px -16px rgba(0,0,0,.8);opacity:0;transition:opacity .22s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = '0'; }, 2400);
  }

  /* ---------- 事件 ---------- */
  function bind() {
    var q = $('#sfQ');
    q.addEventListener('input', function () {
      state.q = q.value.trim();
      render();
    });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        q.value = '';
        state.q = '';
        render();
      }
      if (e.key === 'Enter') {
        var first = $('#sfList a.site-a');
        if (first) { window.open(first.href, '_blank', 'noopener'); }
      }
    });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        q.focus();
      }
    });

    $('#sfAdd').addEventListener('click', function () { openDialog(null); });
    $('#sfExport').addEventListener('click', exportJson);
    $('#sfImport').addEventListener('click', function () { $('#sfFile').click(); });
    $('#sfFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = '';
    });
    $('#sfReset').addEventListener('click', function () {
      if (state.custom.length || state.hidden.length) {
        if (!confirm('恢复默认会清掉你自己加的 ' + state.custom.length + ' 个站点和 ' + state.hidden.length + ' 个隐藏记录，继续？')) return;
      }
      state.custom = [];
      state.hidden = [];
      state.cat = '全部';
      state.q = '';
      $('#sfQ').value = '';
      save(); render();
      toast('已恢复默认');
    });

    $('#sfForm').addEventListener('submit', function (e) {
      var action = (e.submitter && e.submitter.value) || 'save';
      if (action === 'cancel') { editing = null; return; }
      e.preventDefault();
      if (submitDialog()) {
        var dlg = $('#sfDlg');
        if (dlg.open) dlg.close();
      }
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    load();

    var pt = $('#sfPresetTotal');
    if (pt) pt.textContent = P.items.length;
    var ct = $('#sfCatTotal');
    if (ct) ct.textContent = P.cats.length;

    bind();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

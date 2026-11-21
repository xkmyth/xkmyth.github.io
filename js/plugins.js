/* 插件市场 · 浏览 / 搜索 / 下载 / 发布 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var list = [], filtered = [], curTag = '', q = '';
  function conf() { return window.XKAccount && XKAccount.conf ? XKAccount.conf() : null; }
  function call(payload) {
    var c = conf();
    if (!c) return Promise.reject(new Error('云端未就绪'));
    var B = String.fromCharCode(66, 101, 97, 114, 101, 114, 32);
    return fetch(c.endpoint + '/rest/v1/rpc/xk_plug', {
      method: 'POST',
      headers: { apikey: c.key, Authorization: B + c.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: payload })
    }).then(function (r) { return r.json(); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso), n = Date.now() - d.getTime();
    if (n < 3600e3) return Math.max(1, Math.round(n / 60e3)) + ' 分钟前';
    if (n < 86400e3) return Math.round(n / 3600e3) + ' 小时前';
    if (n < 30 * 86400e3) return Math.round(n / 86400e3) + ' 天前';
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function render() {
    var box = $('#plugList');
    if (!box) return;
    filtered = list.filter(function (p) {
      if (curTag && (p.tags || []).indexOf(curTag) === -1) return false;
      if (!q) return true;
      var hay = (p.name + ' ' + (p.summary || '') + ' ' + (p.tags || []).join(' ') + ' ' + (p.author || '')).toLowerCase();
      return hay.indexOf(q.toLowerCase()) > -1;
    });
    box.innerHTML = '';
    if (!filtered.length) {
      box.innerHTML = '<div class="plug-empty">' + (list.length ? '没有匹配的插件' : '市场还空着 —— 打开右下角 AI，让它做个插件，然后点「发布到市场」') + '</div>';
      return;
    }
    filtered.forEach(function (p) {
      var a = document.createElement('a');
      a.className = 'plug-card';
      a.href = '#p' + p.id;
      a.innerHTML = '<div class="plug-top"><span class="plug-ico">🧩</span><span class="plug-name">' + esc(p.name) + '</span></div>' +
        '<p class="plug-sum">' + esc(p.summary || '（作者没写简介）') + '</p>' +
        '<div class="plug-meta"><span>@' + esc(p.author || 'anon') + '</span>' +
        '<span>★ ' + (p.stars || 0) + '</span><span>↓ ' + (p.dls || 0) + '</span>' +
        '<span>' + (p.files || []).length + ' 文件</span><span>' + when(p.created) + '</span></div>' +
        ((p.tags || []).length ? '<div class="plug-tags">' + p.tags.map(function (t) { return '<span class="plug-tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '');
      box.appendChild(a);
    });
  }

  function open(id) {
    call({ op: 'get', id: id }).then(function (j) {
      if (!j.ok) { alert('打不开这个插件：' + (j.err || '未知')); return; }
      var p = j.plugin;
      var m = $('#plugModal');
      $('#plugTitle').textContent = p.name;
      $('#plugBy').textContent = '@' + (p.author || 'anon') + ' · ★ ' + p.stars + ' · ↓ ' + p.dls;
      $('#plugDesc').textContent = p.summary || '';
      $('#plugFiles').textContent = (p.files || []).map(function (f) { return f.name + ' (' + (f.data || '').length + ' 字符)'; }).join('\n');
      $('#plugCode').textContent = (p.code || '').slice(0, 4000);
      m.classList.add('open');
      m.dataset.id = id;
      m.dataset.name = p.name;
      window.__plugFiles = p.files || [];
      list.forEach(function (x) { if (x.id === p.id) x.dls = p.dls; });
      render();
    }).catch(function (e) { alert('请求失败：' + e.message); });
  }

  function downloadZip() {
    var files = window.__plugFiles || [];
    if (!files.length) { alert('这个插件没有文件'); return; }
    if (window.XKAI && XKAI.zip) {
      var blob = XKAI.zip(files.map(function (f) { return { name: f.name, data: f.data }; }));
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ($('#plugModal').dataset.name || 'plugin') + '.zip';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    } else {
      var txt = files.map(function (f) { return '===== ' + f.name + ' =====\n' + f.data; }).join('\n\n');
      var b = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      var a2 = document.createElement('a');
      a2.href = URL.createObjectURL(b); a2.download = ($('#plugModal').dataset.name || 'plugin') + '.txt';
      document.body.appendChild(a2); a2.click();
    }
  }

  function load() {
    call({ op: 'list' }).then(function (j) {
      list = (j && j.list) || [];
      var tags = {};
      list.forEach(function (p) { (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
      var tb = $('#plugTags');
      if (tb) {
        tb.innerHTML = '<button type="button" class="plug-tag' + (curTag ? '' : ' on') + '" data-t="">全部 ' + list.length + '</button>' +
          Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; }).slice(0, 12).map(function (t) {
            return '<button type="button" class="plug-tag' + (t === curTag ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>';
          }).join('');
      }
      render();
    }).catch(function (e) {
      var box = $('#plugList');
      if (box) box.innerHTML = '<div class="plug-empty">加载失败：' + esc(e.message) + '</div>';
    });
  }

  function boot() {
    var box = $('#plugList');
    if (!box) return;
    load();
    var s = $('#plugSearch');
    if (s) {
      var t = null;
      s.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { q = s.value.trim(); render(); }, 200); });
    }
    var tb = $('#plugTags');
    if (tb) tb.addEventListener('click', function (e) {
      var b = e.target.closest('.plug-tag');
      if (!b) return;
      curTag = b.getAttribute('data-t') || '';
      Array.prototype.forEach.call(tb.children, function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      render();
    });
    box.addEventListener('click', function (e) {
      var a = e.target.closest('.plug-card');
      if (!a) return;
      e.preventDefault();
      open(String(a.getAttribute('href')).replace('#p', ''));
    });
    var m = $('#plugModal');
    if (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m || e.target.classList.contains('plug-x')) m.classList.remove('open');
      });
      var dl = $('#plugDl');
      if (dl) dl.addEventListener('click', downloadZip);
      var st = $('#plugStar');
      if (st) st.addEventListener('click', function () {
        call({ op: 'star', id: m.dataset.id }).then(function (j) {
          if (j.ok) { st.textContent = '★ ' + j.stars; }
        });
      });
    }
    var hash = (location.hash.match(/p(\d+)/) || [])[1];
    if (hash) setTimeout(function () { open(hash); }, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.XKPlug = { reload: load, publish: function (o) { return call(Object.assign({ op: 'publish' }, o)); } };
})();

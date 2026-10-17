// 版本日志：从 GitHub Releases 渲染时间轴（10 分钟缓存，失败降级）
(function () {
  'use strict';
  var API = 'https://api.github.com/repos/xkmyth/xkmyth/releases?per_page=10';
  var KEY = 'xkmyth-changelog-cache';
  var TTL = 10 * 60 * 1000;
  var list = document.getElementById('clList');
  if (!list) return;

  function humanSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(n < 10 ? 2 : 1)) + ' ' + units[i];
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function readCache() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.t || Date.now() - obj.t > TTL) return null;
      return obj.d;
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: data })); } catch (e) {}
  }

  function render(releases) {
    list.textContent = '';
    if (!releases || !releases.length) {
      var empty = document.createElement('div');
      empty.className = 'tl-item dim';
      var tag = document.createElement('span');
      tag.className = 'tl-tag';
      tag.textContent = '暂无版本记录';
      var meta = document.createElement('p');
      meta.className = 'tl-meta';
      meta.textContent = 'GitHub Releases 里还没有发布记录，或网络暂时不可达。';
      empty.appendChild(tag); empty.appendChild(meta);
      list.appendChild(empty);
      return;
    }
    releases.forEach(function (rel, idx) {
      var item = document.createElement('div');
      item.className = 'tl-item reveal' + (idx === 0 ? '' : ' dim');

      var tag = document.createElement('span');
      tag.className = 'tl-tag';
      tag.textContent = rel.tag_name || '未命名版本';
      item.appendChild(tag);

      var meta = document.createElement('p');
      meta.className = 'tl-meta';
      var parts = [];
      if (rel.published_at) parts.push('发布于 ' + fmtDate(rel.published_at));
      if (rel.assets && rel.assets.length) {
        var total = 0, dl = 0;
        rel.assets.forEach(function (a) { total += a.size || 0; dl += a.download_count || 0; });
        parts.push(rel.assets.length + ' 个安装包 · 合计 ' + humanSize(total) + ' · 下载 ' + dl + ' 次');
      }
      meta.textContent = parts.join(' · ');
      item.appendChild(meta);

      if (rel.body && rel.body.trim()) {
        var body = document.createElement('div');
        body.className = 'tl-body';
        body.textContent = rel.body.trim();
        item.appendChild(body);
      }

      var actions = document.createElement('p');
      actions.style.marginTop = '10px';
      var a1 = document.createElement('a');
      a1.className = 'btn ghost small';
      a1.href = rel.html_url || 'https://github.com/xkmyth/xkmyth/releases';
      a1.target = '_blank';
      a1.rel = 'noopener';
      a1.textContent = '查看该版本 ↗';
      actions.appendChild(a1);
      item.appendChild(actions);

      list.appendChild(item);
    });

    // 渐入
    var items = list.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.05 });
      Array.prototype.forEach.call(items, function (el) { io.observe(el); });
    } else {
      Array.prototype.forEach.call(items, function (el) { el.classList.add('in'); });
    }
  }

  var cached = readCache();
  if (cached) { render(cached); return; }

  fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) { writeCache(data); render(data); })
    .catch(function () {
      render(null);
      if (window.showToast) window.showToast('版本列表暂时取不到，可点下方按钮直达 GitHub');
    });
})();

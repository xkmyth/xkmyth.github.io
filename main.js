/* xkmyth 主站：Releases 动态版本（星空 / 主题 / 命令面板统一由 /sub.js 提供
   - DPR≤2 降采样省电 · 后台自动暂停 · prefers-reduced-motion 全关
   - 版本数据：GitHub Releases API + 10min 本地缓存 + 失败优雅降级
   - 所有动态文本一律 textContent 渲染，防 XSS */
(function () {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 页脚年份 ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Releases 动态版本 ---------- */
  const CACHE_KEY = 'xkmyth-site-releases-cache';
  const TTL = 10 * 60 * 1000;
  const ASSET_META = {
    'xkmyth-browser-win-x64.zip': '浏览器 Windows',
    'xkmyth-cloud-win-x64.zip':   '云盘客户端 Windows',
    'xkmyth-browser.apk':         '浏览器 Android',
    'xkmyth-cloud.apk':           '云盘 Android'
  };

  function humanSize(bytes) {
    if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + ' GB';
    if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + ' MB';
    if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(0) + ' KB';
    return bytes + ' B';
  }

  function fallbackMeta() {
    const meta = document.getElementById('heroMeta');
    if (meta) {
      meta.textContent = '浏览器 / 云盘 / 系统 · ';
      const a = document.createElement('a');
      a.href = 'https://github.com/xkmyth/xkmyth/releases';
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = '最新版见 Releases';
      meta.appendChild(a);
    }
    document.querySelectorAll('.dl-card[data-asset] .dl-meta').forEach(function (el) {
      el.textContent = '版本见 Releases';
    });
  }

  function render(releases) {
    const latest = Array.isArray(releases) && releases[0];
    const assets = (latest && latest.assets) || [];
    const byName = {};
    assets.forEach(function (a) { byName[a.name] = a; });

    const meta = document.getElementById('heroMeta');
    if (meta) {
      meta.textContent = '';
      const parts = [];
      if (byName['xkmyth-browser-win-x64.zip']) parts.push(['浏览器', 'v' + latest.tag_name.replace(/^v/, '')]);
      if (byName['xkmyth-cloud-win-x64.zip']) parts.push(['云盘', 'v' + latest.tag_name.replace(/^v/, '')]);
      parts.push(['系统', 'v1.0（Win11 25H2）']);
      parts.forEach(function (p, i) {
        if (i) meta.appendChild(document.createTextNode(' · '));
        const b = document.createElement('b');
        b.textContent = p[0] + ' ' + p[1];
        meta.appendChild(b);
      });
      if (latest && latest.published_at) {
        const d = document.createElement('span');
        d.textContent = ' · 更新于 ' + new Date(latest.published_at).toLocaleDateString('zh-CN');
        meta.appendChild(d);
      }
    }

    document.querySelectorAll('.dl-card[data-asset]').forEach(function (card) {
      const name = card.getAttribute('data-asset');
      const el = card.querySelector('.dl-meta');
      if (!el) return;
      const a = byName[name];
      if (a) {
        el.textContent = '';
        const s = document.createElement('span');
        s.className = 'dl-size';
        s.textContent = humanSize(a.size);
        el.appendChild(s);
        el.appendChild(document.createTextNode(' · 下载 ' + a.download_count + ' 次 · ' + new Date(a.updated_at).toLocaleDateString('zh-CN')));
      } else {
        el.textContent = '构建中…';
      }
    });
  }

  fetch('https://api.github.com/repos/xkmyth/xkmyth/releases?per_page=5', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
    .then(function (data) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data })); } catch (e) {}
      render(data);
    })
    .catch(function () {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.t < TTL) { render(cached.d); return; }
      } catch (e) {}
      fallbackMeta();
    });
})();

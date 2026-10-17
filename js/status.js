// 生态状态：四仓最近提交 / CI 结论 / 最新版本
// 额度策略：未登录 api.github.com 是 60 次/小时/IP，一轮 4 仓 × 3 接口 = 12 次
// 故自动刷新间隔 15 分钟（48 次/小时），与缓存 TTL 对齐；点「刷新」按需拉取。
(function () {
  'use strict';
  var REPOS = [
    { id: 'xkmyth/xkmyth', name: 'Downloads', url: 'https://xkmyth.github.io/xkmyth/', icon: '⬇️' },
    { id: 'xkmyth/xkmyth.github.io', name: '主站', url: 'https://xkmyth.github.io/', icon: '🌌' },
    { id: 'xkmyth/Timarsky', name: '工具站', url: 'https://xkmyth.github.io/Timarsky/', icon: '🧰' },
    { id: 'xkmyth/about', name: '关于页', url: 'https://xkmyth.github.io/about/', icon: '👤' }
  ];
  var KEY = 'xkmyth-status-cache-v1';
  var TTL = 15 * 60 * 1000;
  var REFRESH_MS = 15 * 60 * 1000;
  var grid = document.getElementById('stGrid');
  var updatedEl = document.getElementById('stUpdated');
  if (!grid) return;

  var busy = false;
  var lastSig = '';

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function short(sha) { return sha ? sha.slice(0, 7) : '—'; }

  // 并发取三个接口，任何一个失败都不影响其它
  function load(repo) {
    var h = { Accept: 'application/vnd.github+json' };
    var commit = fetch('https://api.github.com/repos/' + repo.id + '/commits?per_page=1', { headers: h })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    var runs = fetch('https://api.github.com/repos/' + repo.id + '/actions/runs?per_page=1', { headers: h })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    var rel = fetch('https://api.github.com/repos/' + repo.id + '/releases/latest', { headers: h })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return Promise.all([commit, runs, rel]).then(function (res) {
      var c = res[0] && res[0][0];
      var run = res[1] && res[1].workflow_runs && res[1].workflow_runs[0];
      var r = res[2];
      return {
        id: repo.id, name: repo.name, url: repo.url, icon: repo.icon,
        commitMsg: c ? (c.commit && c.commit.message ? c.commit.message.split('\n')[0] : '') : '',
        commitSha: c ? short(c.sha) : '',
        commitDate: c ? fmtDate(c.commit && c.commit.author && c.commit.author.date) : '',
        ciName: run ? (run.name || 'workflow') : '',
        ciState: run ? (run.status === 'completed' ? run.conclusion : run.status) : 'unknown',
        ciDate: run ? fmtDate(run.updated_at || run.created_at) : '',
        relTag: r && r.tag_name ? r.tag_name : '',
        relDate: r ? fmtDate(r.published_at) : ''
      };
    });
  }

  function stateClass(s) {
    if (s === 'success') return 'ok';
    if (s === 'failure' || s === 'cancelled' || s === 'timed_out') return 'bad';
    if (s === 'queued' || s === 'in_progress') return 'wait';
    return '';
  }

  function card(d) {
    var wrap = document.createElement('div');
    wrap.className = 'stat reveal';

    var h3 = document.createElement('h3');
    var dot = document.createElement('span');
    dot.className = 'dot ' + stateClass(d.ciState);
    var title = document.createElement('a');
    title.href = d.url;
    title.style.color = 'inherit';
    title.style.textDecoration = 'none';
    title.textContent = d.icon + ' ' + d.name;
    h3.appendChild(dot);
    h3.appendChild(title);
    wrap.appendChild(h3);

    function kv(k, v, cls) {
      var row = document.createElement('div');
      row.className = 'kv';
      var kk = document.createElement('span');
      kk.textContent = k;
      var vv = document.createElement('b');
      vv.textContent = v || '—';
      if (cls) vv.className = cls;
      row.appendChild(kk); row.appendChild(vv);
      wrap.appendChild(row);
    }

    kv('最新提交', d.commitSha ? d.commitSha + ' · ' + (d.commitMsg || '').slice(0, 42) : '读取失败');
    kv('提交时间', d.commitDate);
    kv('CI 结论', d.ciName ? d.ciName + ' · ' + d.ciState : '暂无运行', stateClass(d.ciState));
    kv('CI 时间', d.ciDate);
    kv('最新版本', d.relTag || '暂无 Release', d.relTag ? 'ok' : '');
    kv('发版时间', d.relDate);

    var repoRow = document.createElement('div');
    repoRow.className = 'kv';
    var a = document.createElement('a');
    a.href = 'https://github.com/' + d.id;
    a.target = '_blank'; a.rel = 'noopener';
    a.style.color = 'var(--ice)'; a.style.fontSize = '12.5px';
    a.textContent = d.id + ' ↗';
    repoRow.appendChild(a);
    wrap.appendChild(repoRow);
    return wrap;
  }

  function stamp(fromCache) {
    if (!updatedEl) return;
    updatedEl.textContent = (fromCache ? '缓存数据 · ' : '已更新 · ') + new Date().toLocaleTimeString();
  }

  function paint(data, fromCache) {
    var sig = JSON.stringify(data);
    if (sig === lastSig) { stamp(fromCache); return; }   // 数据没变就不重建，避免每轮重播渐入
    lastSig = sig;
    grid.textContent = '';
    data.forEach(function (d) { grid.appendChild(card(d)); });
    var items = grid.querySelectorAll('.reveal');
    Array.prototype.forEach.call(items, function (el, i) {
      setTimeout(function () { el.classList.add('in'); }, i * 70);
    });
    stamp(fromCache);
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
  function writeCache(d) {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  }

  function hasData(data) {
    return (data || []).some(function (d) { return d.commitSha || d.relTag || d.ciName; });
  }

  function fetchAll() {
    if (busy) return;
    busy = true;
    Promise.all(REPOS.map(load)).then(function (data) {
      busy = false;
      // 只在真的拿到东西时写缓存，避免把 403/限流的降级结果粘住 15 分钟
      if (hasData(data)) { writeCache(data); paint(data, false); }
      else if (lastSig === '') { paint(data, false); }
    }).catch(function () {
      busy = false;
      if (lastSig === '') {
        paint(REPOS.map(function (r) {
          return { id: r.id, name: r.name, url: r.url, icon: r.icon, ciState: 'unknown' };
        }), false);
      }
      if (window.showToast) window.showToast('GitHub API 暂时不可达，稍后再试');
    });
  }

  function refresh(useCache) {
    if (useCache) {
      var c = readCache();
      if (c) { paint(c, true); fetchAll(); return; }   // 先渲染缓存，再静默更新
    }
    fetchAll();
  }

  var btn = document.getElementById('stRefresh');
  if (btn) btn.addEventListener('click', function () {
    refresh(false);
    if (window.showToast) window.showToast('正在重新读取…');
  });

  refresh(true);
  setInterval(function () { if (!document.hidden) fetchAll(); }, REFRESH_MS);
})();

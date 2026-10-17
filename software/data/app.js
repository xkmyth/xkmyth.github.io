/* XK Data —— 本地数据台账：列出、导出、清理本站 localStorage */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var QUOTA = 5 * 1024 * 1024;
  var PRE = ['xk-', 'xkmyth-'];

  // 已知键的用途说明；未知但前缀匹配的也会列出来（标成「未登记」）
  var META = {
    'xk-vault-v1': ['XK Vault 密文', 'app'],
    'xk-vault-salt': ['XK Vault 盐值', 'app'],
    'xk-notes-v1': ['XK Notes 笔记', 'app'],
    'xk-ledger-v1': ['XK Ledger 账本', 'app'],
    'xk-focus-tasks-v1': ['XK Focus 任务清单', 'app'],
    'xk-focus-stat-v1': ['XK Focus 今日统计', 'app'],
    'xk-snips-v1': ['XK Snippets 代码片段', 'app'],
    'xk-clip-v1': ['XK Clipboard 剪贴板历史', 'app'],
    'xk-wallpaper-last': ['XK Wallpaper 上次配色', 'app'],
    'xkmyth-theme': ['主题偏好（工具站/星站共用）', 'setting'],
    'xkmyth-theme2': ['主题偏好（主站）', 'setting'],
    'xkmyth-site-releases-cache': ['Releases 缓存（10 分钟）', 'cache'],
    'xkmyth-changelog-cache': ['更新日志缓存（10 分钟）', 'cache'],
    'xkmyth-status-cache-v1': ['状态页缓存（10 分钟）', 'cache'],
    'xkmyth-search-cache': ['搜索索引缓存', 'cache']
  };
  var KIND_TEXT = { app: '应用数据', setting: '偏好设置', cache: '站点缓存', unknown: '未登记' };

  var wipeArmed = 0;

  function bytes(s) {
    if (window.Blob) {
      try { return new Blob([s]).size; } catch (e) { }
    }
    return Math.round(unescape(encodeURIComponent(s)).length);
  }

  function size(bytesN) {
    if (bytesN < 1024) return bytesN + ' B';
    if (bytesN < 1024 * 1024) return (bytesN / 1024).toFixed(1) + ' KiB';
    return (bytesN / 1024 / 1024).toFixed(2) + ' MiB';
  }

  function keys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        var match = PRE.some(function (p) { return k.indexOf(p) === 0; });
        if (!match) continue;
        var v = localStorage.getItem(k) || '';
        out.push({ key: k, value: v, size: bytes(v) });
      }
    } catch (e) { }
    out.sort(function (a, b) { return b.size - a.size; });
    return out;
  }

  function label(key) {
    var m = META[key];
    return m ? m[0] : '未登记的键';
  }

  function kindOf(key) {
    var m = META[key];
    if (m) return m[1];
    return 'unknown';
  }

  function line(text, bad) {
    var out = $('dOut');
    if (!out) return;
    out.textContent = text;
    out.className = 'out' + (bad ? ' err' : ' flash');
    setTimeout(function () { out.className = 'out'; }, 1600);
  }

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }

  function stamp() {
    var t = $('dStamp');
    if (t) t.textContent = '最后读取 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  function render() {
    var rows = keys();
    var total = rows.reduce(function (s, r) { return s + r.size; }, 0);
    $('dKeys').textContent = String(rows.length);
    $('dBytes').textContent = size(total);
    $('dShare').textContent = (total / QUOTA * 100 < 0.1 ? '<0.1' : (total / QUOTA * 100).toFixed(1)) + '%';
    $('dEmpty').hidden = rows.length > 0;

    var tb = $('dRows');
    tb.textContent = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');

      var td1 = document.createElement('td');
      td1.textContent = label(r.key);
      var td2 = document.createElement('td');
      var code = document.createElement('code');
      code.textContent = r.key;
      td2.appendChild(code);
      var td3 = document.createElement('td');
      td3.textContent = size(r.size);
      var td4 = document.createElement('td');
      var b = document.createElement('span');
      b.className = 'badge' + (kindOf(r.key) === 'cache' ? ' ice' : (kindOf(r.key) === 'unknown' ? ' rose' : ''));
      b.textContent = KIND_TEXT[kindOf(r.key)];
      td4.appendChild(b);

      var td5 = document.createElement('td');
      var be = document.createElement('button');
      be.className = 'tiny-btn';
      be.type = 'button';
      be.textContent = '导出';
      be.addEventListener('click', function () { exportOne(r); });
      var bc = document.createElement('button');
      bc.className = 'tiny-btn danger';
      bc.type = 'button';
      bc.textContent = '清空';
      bc.addEventListener('click', function () { clearOne(r); });
      td5.appendChild(be);
      td5.appendChild(document.createTextNode(' '));
      td5.appendChild(bc);

      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tr.appendChild(td4); tr.appendChild(td5);
      tb.appendChild(tr);
    });
    stamp();
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function today() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function exportOne(r) {
    var payload = { key: r.key, value: r.value, exportedAt: new Date().toISOString() };
    download('xk-' + r.key.replace(/[^\w.-]+/g, '_') + '.json', JSON.stringify(payload, null, 2));
    line('已导出 ' + r.key + '（' + size(r.size) + '）');
    toast('已导出 ' + r.key, 'ok');
  }

  function clearOne(r) {
    if (!window.confirm('删除「' + label(r.key) + '」（' + r.key + '，' + size(r.size) + '）？此操作不可撤销。')) return;
    try { localStorage.removeItem(r.key); } catch (e) { line('删除失败：' + e.message, true); return; }
    line('已删除 ' + r.key);
    toast('已删除 ' + r.key, 'ok');
    render();
  }

  function exportAll() {
    var rows = keys();
    if (!rows.length) { toast('还没有可导出的数据', 'bad'); return; }
    var out = { site: 'https://xkmyth.github.io', exportedAt: new Date().toISOString(), keys: {} };
    rows.forEach(function (r) { out.keys[r.key] = r.value; });
    download('xk-my-data-' + today() + '.json', JSON.stringify(out, null, 2));
    line('已导出 ' + rows.length + ' 个键，共 ' + size(rows.reduce(function (s, r) { return s + r.size; }, 0)));
    toast('已导出 ' + rows.length + ' 个键', 'ok');
  }

  function clearCache() {
    var rows = keys().filter(function (r) { return kindOf(r.key) === 'cache'; });
    if (!rows.length) { toast('没有缓存项', 'ok'); return; }
    var bytesN = rows.reduce(function (s, r) { return s + r.size; }, 0);
    rows.forEach(function (r) { try { localStorage.removeItem(r.key); } catch (e) { } });
    line('清掉了 ' + rows.length + ' 项缓存，释放 ' + size(bytesN) + '（应用数据没动）');
    toast('已清理 ' + rows.length + " 项缓存", 'ok');
    render();
  }

  function wipe() {
    var rows = keys();
    if (!rows.length) { toast('本来就是空的', 'ok'); return; }
    if (wipeArmed < 2) {
      wipeArmed++;
      $('dWipe').textContent = wipeArmed === 1 ? '再点一次（清 ' + rows.length + ' 项）' : '最后确认：点第三下就清空';
      toast('这一步不可撤销，建议先导出', 'bad');
      setTimeout(function () {
        if (wipeArmed < 3) { wipeArmed = 0; $('dWipe').textContent = '全部清空'; }
      }, 6000);
      return;
    }
    var bytesN = 0;
    rows.forEach(function (r) { bytesN += r.size; try { localStorage.removeItem(r.key); } catch (e) { } });
    wipeArmed = 0;
    $('dWipe').textContent = '全部清空';
    line('已清空 ' + rows.length + ' 项，释放 ' + size(bytesN), true);
    toast('已清空全部本站数据', 'ok');
    render();
  }

  function init() {
    $('dRefresh').addEventListener('click', function () { render(); toast('已重新读取', 'ok'); });
    $('dExportAll').addEventListener('click', exportAll);
    $('dClearCache').addEventListener('click', clearCache);
    $('dWipe').addEventListener('click', wipe);
    render();
    // 别的标签页改过数据，回来时重新读一遍
    window.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
    });
    window.addEventListener('storage', function () { render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

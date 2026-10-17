/* XK Clipboard —— 本地剪贴板历史 */
(function () {
  'use strict';
  var KEY = 'xk-clip-v1';
  var LIMIT = 80;
  var $ = function (id) { return document.getElementById(id); };
  var items = [];

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function load() {
    try { items = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
  }
  function persist() {
    /* 置顶优先，再按时间，超上限裁掉最旧的未置顶条目 */
    items.sort(function (a, b) { return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.ts - a.ts; });
    if (items.length > LIMIT) {
      var keep = items.slice(0, LIMIT);
      var dropped = items.length - keep.length;
      items = keep;
      if (dropped) toast('超出上限，已丢弃 ' + dropped + ' 条未置顶记录');
    }
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) { toast('存储已满，建议清理旧条目', 'bad'); }
  }
  function stamp(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function add(text) {
    text = String(text || '');
    if (!text.trim()) { toast('内容为空', 'bad'); return; }
    if (text.length > 20000) text = text.slice(0, 20000);
    if (items.length && items[0].text === text && !items[0].pin) { toast('最近一条就是这个', 'ok'); return; }
    items = items.filter(function (x) { return x.text !== text; });
    items.unshift({ text: text, ts: Date.now(), pin: false });
    persist(); render();
    toast('已收录', 'ok');
  }

  function render() {
    var q = ($('kSearch').value || '').toLowerCase().trim();
    var box = $('kList');
    box.innerHTML = '';
    var shown = 0, pinned = 0;
    items.forEach(function (it, idx) {
      if (it.pin) pinned++;
      if (q && it.text.toLowerCase().indexOf(q) === -1) return;
      shown++;
      var row = document.createElement('div');
      row.className = 'clip-item';
      var txt = document.createElement('div');
      txt.className = 'txt';
      txt.textContent = it.text.length > 280 ? it.text.slice(0, 280) + '…' : it.text;
      var small = document.createElement('small');
      small.textContent = stamp(it.ts) + ' · ' + it.text.length + ' 字符' + (it.pin ? ' · 已置顶' : '');
      txt.appendChild(small);

      var acts = document.createElement('div');
      acts.className = 'tool-row';
      var cp = document.createElement('button');
      cp.type = 'button'; cp.className = 'tiny-btn'; cp.textContent = '复制';
      cp.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(it.text).then(function () { toast('已复制', 'ok'); }, function () { toast('复制失败', 'bad'); });
        } else { toast('当前浏览器不支持自动复制', 'bad'); }
      });
      var pin = document.createElement('button');
      pin.type = 'button'; pin.className = 'tiny-btn'; pin.textContent = it.pin ? '取消置顶' : '置顶';
      pin.addEventListener('click', function () { it.pin = !it.pin; persist(); render(); });
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'tiny-btn danger'; del.textContent = '×';
      del.addEventListener('click', function () {
        items = items.filter(function (x) { return x !== it; });
        persist(); render();
      });
      acts.appendChild(cp); acts.appendChild(pin); acts.appendChild(del);

      row.appendChild(txt); row.appendChild(acts);
      box.appendChild(row);
    });
    if (!shown) {
      var d = document.createElement('div');
      d.className = 'empty-hint';
      d.textContent = items.length ? '没有匹配的历史' : '剪贴板历史为空。复制点什么，然后回到这个页面按 Ctrl+V。';
      box.appendChild(d);
    }
    $('kCount').textContent = String(items.length);
    $('kPin').textContent = String(pinned);
  }

  function init() {
    load(); render();
    $('kAdd').addEventListener('click', function () {
      add($('kInput').value);
      $('kInput').value = '';
    });
    $('kSearch').addEventListener('input', render);
    $('kClearSearch').addEventListener('click', function () { $('kSearch').value = ''; render(); });
    $('kPasteRead').addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { toast('浏览器不允许读取剪贴板，请手动粘贴', 'bad'); return; }
      navigator.clipboard.readText().then(function (t) { add(t); }, function () { toast('读取被拒绝，请手动粘贴', 'bad'); });
    });
    $('kExport').addEventListener('click', function () {
      if (!items.length) { toast('没有历史', 'bad'); return; }
      var blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'xk-clipboard.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      toast('已导出', 'ok');
    });
    $('kWipe').addEventListener('click', function () {
      if (!confirm('清空全部剪贴板历史？')) return;
      items = []; localStorage.removeItem(KEY); render();
    });
    document.addEventListener('paste', function (e) {
      var tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      var text = e.clipboardData && e.clipboardData.getData('text');
      if (text) add(text);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

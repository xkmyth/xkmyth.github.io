/* dev.js —— 开发者模式（接口日志 / 身份探针 / 维护与同步工具）
   只在开启的浏览器里起作用，键：xkmyth-dev */
(function () {
  'use strict';
  var A = window.XKAccount;
  var KEY = 'xkmyth-dev', LOG = [], MAX = 60;
  var $ = function (id) { return document.getElementById(id); };
  function on() { return localStorage.getItem(KEY) === '1'; }
  function toast(t, k) { if (window.xkmythUI && window.xkmythUI.toast) window.xkmythUI.toast(t, k); }

  /* ---------- 接口日志：包一层 fetch ---------- */
  var orig = window.fetch;
  if (orig && !orig.__xk) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var isApi = url.indexOf('/rest/v1/rpc/xk_api') >= 0 || url.indexOf('/storage/v1/') >= 0;
      if (!isApi || !on()) return orig.apply(this, arguments);
      var op = '', body = init && init.body;
      try {
        if (typeof body === 'string') { var j = JSON.parse(body); op = (j && j.p && j.p.op) || ''; }
      } catch (e) { }
      var t0 = performance.now();
      return orig.apply(this, arguments).then(function (r) {
        var ms = Math.round(performance.now() - t0);
        var kind = url.indexOf('/storage/') >= 0 ? (init && init.method === 'POST' ? 'upload' : 'file') : (op || 'rpc');
        push({ t: Date.now(), kind: kind, ms: ms, st: r.status });
        return r;
      }).catch(function (e) {
        push({ t: Date.now(), kind: (op || 'rpc'), ms: Math.round(performance.now() - t0), st: 'ERR', note: String(e && e.message || e).slice(0, 40) });
        throw e;
      });
    };
    window.fetch.__xk = 1;
  }
  function push(e) {
    LOG.unshift(e);
    if (LOG.length > MAX) LOG.pop();
    paintBadge(); paintLog();
  }

  /* ---------- 角标 ---------- */
  function badge() {
    var b = $('xkdevBadge');
    if (b) return b;
    b = document.createElement('button');
    b.id = 'xkdevBadge';
    b.type = 'button';
    b.className = 'xkdev-badge';
    b.innerHTML = '<span>DEV</span><i id="xkdevN">0</i>';
    b.addEventListener('click', function () { var d = $('xkdevPanel'); if (d) d.hidden = !d.hidden; });
    document.body.appendChild(b);
    var p = document.createElement('div');
    p.id = 'xkdevPanel';
    p.className = 'xkdev-panel';
    p.hidden = true;
    p.innerHTML = '<div class="xkdev-h"><b>开发者模式</b><button type="button" class="xkdev-x" id="xkdevClose" aria-label="收起">×</button></div>' +
      '<div class="xkdev-cap">身份</div><pre class="xkdev-pre" id="xkdevId">读取中…</pre>' +
      '<div class="xkdev-cap">最近调用 <button type="button" class="xkdev-mini" id="xkdevClr">清空</button></div>' +
      '<div class="xkdev-log" id="xkdevLog">—</div>' +
      '<div class="xkdev-cap">工具</div>' +
      '<div class="xkdev-row"><button type="button" class="xkdev-mini" id="xkdevSync">强制同步</button>' +
      '<button type="button" class="xkdev-mini" id="xkdevFix">重建身份</button>' +
      '<button type="button" class="xkdev-mini" id="xkdevOff">关闭开发模式</button></div>' +
      '<p class="xkdev-out" id="xkdevOut"></p>';
    document.body.appendChild(p);
    p.addEventListener('click', function (e) {
      var id = e.target && e.target.id;
      if (id === 'xkdevClose') p.hidden = true;
      if (id === 'xkdevClr') { LOG = []; paintBadge(); paintLog(); }
      if (id === 'xkdevOff') { off(); }
      if (id === 'xkdevSync') { if (A && A.syncNow) A.syncNow(false).then(function () { out('同步完成', true); }).catch(function (e) { out('同步失败：' + (e && e.message || e), false); }); }
      if (id === 'xkdevFix') {
        if (!A || !A.bindCloud) return;
        A.bindCloud(A.user()).then(function (r) { out(r === 'auth' ? '云端有这个用户名但密码不同' : '已重建云端身份', r !== 'auth'); if (A.syncNow) A.syncNow(true).catch(function () { }); })
          .catch(function (e) { out('失败：' + (e && e.message || e), false); });
      }
    });
    return b;
  }
  function out(msg, good) { var o = $('xkdevOut'); if (o) { o.textContent = msg; o.className = 'xkdev-out ' + (good ? 'ok' : 'err'); } }
  function paintBadge() {
    var b = badge();
    b.hidden = !on();
    var n = $('xkdevN');
    if (n) { n.textContent = String(LOG.length); n.hidden = !LOG.length; }
  }
  function paintLog() {
    var box = $('xkdevLog');
    if (!box) return;
    if (!LOG.length) { box.textContent = '还没有调用。'; return; }
    box.innerHTML = LOG.slice(0, 20).map(function (e) {
      var t = new Date(e.t);
      var hh = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
      var bad = e.st === 'ERR' || e.st >= 400;
      return '<div class="xkdev-line' + (bad ? ' bad' : '') + '"><span>' + hh + '</span><b>' + e.kind + '</b><em>' + e.ms + 'ms</em><i>' + e.st + (e.note ? ' ' + e.note : '') + '</i></div>';
    }).join('');
  }

  /* ---------- 身份探针 ---------- */
  function identity() {
    var id = $('xkdevId'), tab = $('devId');
    var u = A && A.user ? A.user() : null;
    var conf = (A && A.conf) ? A.conf() : { endpoint: '—', key: '—' };
    var base = { user: u ? u.name : null, tier: u ? A.tier(u) : null, endpoint: conf.endpoint, key: (conf.key || '').slice(-6) };
    if (!u) { write(JSON.stringify(base, null, 1)); return Promise.resolve(base); }
    return A.api('perm').then(function (r) {
      var o = Object.assign({}, base, {
        role: r.role, admin: r.admin, mod: r.mod, banned: r.banned, maint: r.maint,
        caps: r.caps, login: (u && u.logins) || 0
      });
      write(JSON.stringify(o, null, 1));
      return o;
    }).catch(function (e) {
      var o = Object.assign({}, base, { error: (e && (e.err || e.message)) || 'unknown' });
      write(JSON.stringify(o, null, 1));
      return o;
    });
    function write(txt) {
      if (id) id.textContent = txt;
      if (tab) tab.textContent = txt;
    }
  }

  /* ---------- 账号页「开发」tab ---------- */
  function paintTab() {
    var st = $('devState');
    if (!st) return;
    st.textContent = on() ? '已开启' : '关闭';
    st.className = 'badge' + (on() ? ' mint' : '');
    var btn = $('devToggle');
    if (btn) btn.textContent = on() ? '关闭开发者模式' : '开启开发者模式';
    var conf = (A && A.conf) ? A.conf() : {};
    if ($('devEp')) $('devEp').textContent = conf.endpoint || '—';
    if ($('devKey')) $('devKey').textContent = conf.key ? ('…' + conf.key.slice(-8)) : '—';
    var c = $('devCount'); if (c) c.textContent = LOG.length + ' 条';
    paintLog();
  }
  function wireTab() {
    if (!$('devToggle')) return;
    paintTab(); identity();
    $('devToggle').addEventListener('click', function () { if (on()) off(); else on2(); });
    var rl = $('devReload'); if (rl) rl.addEventListener('click', function () { identity().then(function (o) { toast('已刷新身份', 'ok'); }); });
    var cp = $('devCopy'); if (cp) cp.addEventListener('click', function () {
      var t = $('devId') ? $('devId').textContent : '';
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('已复制', 'ok'); }).catch(function () { toast('复制失败，手动选中吧', 'err'); });
    });
    var cl = $('devClear'); if (cl) cl.addEventListener('click', function () { LOG = []; paintTab(); paintBadge(); });
    var sy = $('devSync'); if (sy) sy.addEventListener('click', function () {
      if (!A || !A.syncNow) return;
      $('devOut').textContent = '同步中…';
      A.syncNow(false).then(function () { $('devOut').textContent = '同步完成'; }).catch(function (e) { $('devOut').textContent = '失败：' + (e && e.message || e); });
    });
    var fx = $('devFix'); if (fx) fx.addEventListener('click', function () {
      if (!A || !A.bindCloud) return;
      $('devOut').textContent = '重建中…';
      A.bindCloud(A.user()).then(function (r) {
        $('devOut').textContent = r === 'auth' ? '云端已有同名账号，密码不同' : '已重建云端身份';
        if (A.syncNow) A.syncNow(true).catch(function () { });
      }).catch(function (e) { $('devOut').textContent = '失败：' + (e && e.message || e); });
    });
    var pg = $('devPurge'); if (pg) pg.addEventListener('click', function () {
      if (!window.confirm('清掉这台浏览器里的本地账号缓存？（云端不受影响）')) return;
      try { localStorage.removeItem('xkmyth-acct-v1'); localStorage.removeItem('xkmyth-hist-v1'); } catch (e) { }
      $('devOut').textContent = '本地缓存已清，刷新后生效。';
    });
  }

  function on2() { localStorage.setItem(KEY, '1'); paintBadge(); paintTab(); identity(); toast('开发者模式已开启', 'ok'); }
  function off() { localStorage.setItem(KEY, '0'); var b = $('xkdevBadge'); if (b) b.hidden = true; var p = $('xkdevPanel'); if (p) p.hidden = true; paintTab(); toast('开发者模式已关闭'); }

  window.XKDev = { on: on2, off: off, isOn: on, log: function () { return LOG.slice(); }, identity: identity, paint: paintTab };

  function boot() {
    if (on()) { paintBadge(); paintLog(); identity(); }
    wireTab();
    if (on() && A && A.api) setTimeout(function () { }, 0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

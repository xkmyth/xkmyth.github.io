/* ============================================================
   星空中转站 · 账号系统（本地模式 + 云端同步协议）
   - 密码：PBKDF2-SHA256 / 12 万次迭代 / 16 字节随机盐
   - 等级：T1–T5 自动计算，站长可手动指定
   - 历史：访问 / 搜索 / 中转站 / 同步 / 账号 五类
   - 同步：POST/GET 协议已定，填上服务地址即启用
   ============================================================ */
(function () {
  'use strict';

  var K_ACCT = 'xkmyth-acct-v1';
  var K_HIST = 'xkmyth-hist-v1';
  var K_SYNC = 'xkmyth-sync-v1';
  var HIST_MAX = 400;
  var DAYS_MAX = 400;
  var ITER = 120000;
  var VISIT_GAP = 5 * 60 * 1000;

  var TIERS = [
    { t: 1, name: '新星', days: 0, events: 0 },
    { t: 2, name: '常客', days: 3, events: 15 },
    { t: 3, name: '熟客', days: 10, events: 60 },
    { t: 4, name: '资深', days: 25, events: 150 },
    { t: 5, name: '元老', days: 60, events: 400 }
  ];
  var KIND_NAME = { visit: '浏览', search: '搜索', start: '中转站', sync: '同步', account: '账号' };
  var KIND_ICO = { visit: '◈', search: '⌕', start: '✦', sync: '⟳', account: '◉' };

  /* ---------------- 存储 ---------------- */
  function read(k, def) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function db() {
    var d = read(K_ACCT, null);
    if (!d || !d.users) d = { v: 1, users: {}, session: null };
    return d;
  }
  function saveDb(d) { write(K_ACCT, d); }
  function histAll() {
    var h = read(K_HIST, {});
    return (h && typeof h === 'object') ? h : {};
  }
  function saveHist(h) { write(K_HIST, h); }
  // 内置云端（publishable key 是公开密钥，放前端安全；真正的门是每个账号的密码派生凭据）
  var DFLT = {
    endpoint: 'https://bjmyukjviazgnathjyyq.supabase.co',
    key: 'sb_publishable_hq05xWJQ_RLOW6VovD381Q_0ycPahqG'
  };
  function syncConf() {
    var s = read(K_SYNC, {});
    if (!s || typeof s !== 'object') s = {};
    if (!s.endpoint) s.endpoint = DFLT.endpoint;
    if (!s.key) s.key = DFLT.key;
    return s;
  }

  function cloudReady() { var c = syncConf(); return !!(c.endpoint && c.key); }
  function authHash(u) {
    if (u && u.syncAuth && /^[0-9a-f]{64}$/.test(u.syncAuth)) return Promise.resolve(u.syncAuth);
    var raw = (u && u.name) + ':' + (u && u.hash);
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
        .then(function (b) { return toHex(new Uint8Array(b)); });
    }
    return Promise.resolve(weakHash(raw));
  }
  // 云凭据 = PBKDF2(密码, 'xkmyth-sync|用户名', 6 万次)
  // 只由「用户名 + 密码」决定，跟本机盐无关 —— 所以换设备打同一个密码就能认回账号。
  function syncAuthOf(name, pass) {
    var salt = toHex(new TextEncoder().encode('xkmyth-sync|' + name));
    return hashPass(pass, salt, 60000).then(function (a) {
      if (!/^[0-9a-f]{64}$/.test(a)) a = (a + a + a + a + a).slice(0, 64);
      return a;
    });
  }
  function rpc(payload, retried) {
    return rpcOnce(payload).catch(function (e) {
      var netErr = /Failed to fetch|NetworkError|network|fetch/i.test(e && e.message || '');
      if (!retried && netErr) {
        return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return rpc(payload, true); });
      }
      throw e;
    });
  }
  function rpcOnce(payload) {
    var c = syncConf(), S = String.fromCharCode(66, 101, 97, 114, 101, 114, 32);
    if (!c.endpoint) return Promise.reject(new Error('还没填同步服务地址'));
    if (!c.key) return Promise.reject(new Error('还没填云端密钥'));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 12000) : null;
    var hdr = { 'Content-Type': 'application/json', Accept: 'application/json', apikey: c.key };
    hdr.Authorization = S + c.key;
    return fetch(c.endpoint.replace(/\/+$/, '') + '/rest/v1/rpc/xk_api', {
      method: 'POST', headers: hdr, body: JSON.stringify({ p: payload }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) { }
        if (!r.ok) throw new Error('云端 ' + r.status + (j && (j.message || j.hint) ? '：' + (j.message || j.hint) : ''));
        if (!j || typeof j !== 'object') throw new Error('云端响应不是 JSON');
        if (j.ok === false) {
          throw new Error(j.err === 'auth' ? '云端校验失败（密码在本机之外被改过？）'
            : j.err === 'not_admin' ? '云端没有管理员权限'
              : j.err === 'no_user' ? '云端还没这个账号，先在当前设备点一次同步'
                : '云端错误：' + (j.err || '未知'));
        }
        return j;
      });
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      throw new Error(e.name === 'AbortError' ? '云端超时（12 秒）' : (e.message || '同步失败'));
    });
  }
  function bindCloud(u) {
    if (!cloudReady() || !u) return Promise.resolve(false);
    return authHash(u).then(function (a) { return rpc({ op: 'bind', user: u.name, auth: a }); })
      .then(function () { return true; })
      .catch(function (e) { return /云端校验失败/.test(e.message) ? 'auth' : false; });
  }

  /* ---------------- 加密 ---------------- */
  function toHex(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += ('0' + u8[i].toString(16)).slice(-2);
    return s;
  }
  function fromHex(h) {
    var a = new Uint8Array(h.length / 2);
    for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
    return a;
  }
  function rnd(n) {
    var a = new Uint8Array(n);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return toHex(a);
  }
  function weakHash(pass, salt) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    var str = salt + '|' + pass + '|' + salt;
    for (var r = 0; r < 4000; r++) {
      for (var i = 0; i < str.length; i++) {
        h1 ^= str.charCodeAt(i); h1 = (h1 * 16777619) >>> 0;
        h2 = ((h2 << 5) - h2 + str.charCodeAt(i) + r) >>> 0;
      }
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }
  function hashPass(pass, salt, iter) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle || !subtle.importKey || !window.TextEncoder) {
      return Promise.resolve(weakHash(pass, salt));
    }
    return subtle.importKey('raw', new TextEncoder().encode(pass), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (key) {
        return subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(salt), iterations: iter || ITER, hash: 'SHA-256' }, key, 256);
      })
      .then(function (bits) { return toHex(new Uint8Array(bits)); })
      .catch(function () { return weakHash(pass, salt); });
  }

  /* ---------------- 时间工具 ---------------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function ago(ts) {
    var s = (Date.now() - ts) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dayOf(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ---------------- 账号核心 ---------------- */
  function current() {
    var d = db();
    if (!d.session || !d.session.name) return null;
    var u = d.users[d.session.name];
    return u || null;
  }
  function histOf(name) {
    var h = histAll();
    return Array.isArray(h[name]) ? h[name] : [];
  }
  function seen(u) {
    return Array.isArray(u.seen) ? u.seen : [];
  }
  function tierOf(u) {
    if (!u) return 1;
    if (u.tierManual) return Math.max(1, Math.min(5, u.tierManual));
    var days = seen(u).length, ev = histOf(u.name).length, t = 1;
    for (var i = 0; i < TIERS.length; i++) {
      if (days >= TIERS[i].days && ev >= TIERS[i].events) t = TIERS[i].t;
    }
    return t;
  }
  function tierInfo(t) {
    for (var i = 0; i < TIERS.length; i++) if (TIERS[i].t === t) return TIERS[i];
    return TIERS[0];
  }
  function progress(u) {
    var cur = tierOf(u);
    if (cur >= 5) return { cur: cur, next: null, pct: 100, days: seen(u).length, events: histOf(u.name).length };
    var nx = tierInfo(cur + 1);
    var d = seen(u).length, e = histOf(u.name).length;
    var pd = nx.days ? Math.min(1, d / nx.days) : 1;
    var pe = nx.events ? Math.min(1, e / nx.events) : 1;
    return {
      cur: cur, next: nx, pct: Math.round(Math.min(pd, pe) * 100),
      days: d, events: e, needDays: Math.max(0, nx.days - d), needEvents: Math.max(0, nx.events - e)
    };
  }
  function checkName(n) {
    if (!n) return '用户名不能为空';
    if (n.length < 3 || n.length > 20) return '用户名要 3–20 位';
    if (!/^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/.test(n)) return '只能中英文、数字、下划线、连字符';
    return null;
  }
  function checkPass(p) {
    if (!p || p.length < 8) return '密码至少 8 位';
    if (p.length > 128) return '密码太长了';
    return null;
  }

  function register(name, pass) {
    name = (name || '').trim();
    var e1 = checkName(name); if (e1) return Promise.reject(new Error(e1));
    var e2 = checkPass(pass); if (e2) return Promise.reject(new Error(e2));
    var d = db();
    if (d.users[name]) return Promise.reject(new Error('这个用户名已经有人用了'));
    var isFirst = Object.keys(d.users).length === 0;
    var salt = rnd(16);
    return Promise.all([hashPass(pass, salt, ITER), syncAuthOf(name, pass)]).then(function (rr) {
      var hash = rr[0], sa = rr[1];
      var d2 = db();
      if (d2.users[name]) throw new Error('这个用户名已经有人用了');
      d2.users[name] = {
        id: 'u_' + rnd(6),
        name: name,
        salt: salt,
        hash: hash,
        syncAuth: sa,
        iter: ITER,
        role: Object.keys(d2.users).length === 0 ? 'admin' : 'user',
        tierManual: 0,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        logins: 1,
        seen: [today()]
      };
      d2.session = { name: name, at: Date.now() };
      saveDb(d2);
      if (isFirst) log('account', '成为本站第一个账号（站长）');
      else log('account', '注册账号');
      var nu = d2.users[name];
      return bindCloud(nu).then(function (r) {
        if (r === 'auth') {
          var d3 = db();
          delete d3.users[name];
          if (d3.session && d3.session.name === name) d3.session = null;
          saveDb(d3);
          throw new Error('云端已经有这个用户名，但密码不一样。如果那是你的号，直接用「登录」——同一个密码就能把数据接回来。');
        }
        autoSync();
        return nu;
      });
    });
  }

  function login(name, pass) {
    name = (name || '').trim();
    var d = db();
    var u = d.users[name];
    if (!u) {
      if (!cloudReady()) return Promise.reject(new Error('没有这个账号'));
      // 这台设备没登录过：拿密码去云端认领
      return syncAuthOf(name, pass).then(function (sa) {
        return rpc({ op: 'bind', user: name, auth: sa }).then(function () { return sa; });
      }).then(function (sa) {
        var salt = rnd(16);
        return hashPass(pass, salt, ITER).then(function (hash) {
          var d2 = db();
          if (d2.users[name]) throw new Error('这个用户名已经有人用了');
          d2.users[name] = {
            id: 'u_' + rnd(6), name: name, salt: salt, hash: hash, iter: ITER,
            role: 'user', tierManual: 0, createdAt: Date.now(), lastLogin: Date.now(),
            logins: 1, seen: [today()], syncAuth: sa
          };
          d2.session = { name: name, at: Date.now() };
          saveDb(d2);
          log('account', '从云端认回账号');
          autoSync();
          return d2.users[name];
        });
      }).catch(function (e) {
        throw /云端校验失败/.test(e.message) ? new Error('本机没这个账号，云端密码也不对') : e;
      });
    }
    return hashPass(pass, u.salt, u.iter || ITER).then(function (h) {
      if (h !== u.hash) throw new Error('密码不对');
      return syncAuthOf(name, pass);
    }).then(function (sa) {
      var d2 = db();
      var u2 = d2.users[name];
      u2.syncAuth = sa;
      u2.logins = (u2.logins || 0) + 1;
      u2.lastLogin = Date.now();
      var s = seen(u2); var t = today();
      if (s.indexOf(t) < 0) { s.push(t); if (s.length > DAYS_MAX) s = s.slice(-DAYS_MAX); }
      u2.seen = s;
      d2.session = { name: name, at: Date.now() };
      saveDb(d2);
      log('account', '登录');
      bindCloud(u2);
      autoSync();
      return u2;
    });
  }

  function logout() {
    var d = db();
    if (d.session) log('account', '退出登录');
    d.session = null;
    saveDb(d);
  }

  /* ---------------- 历史 ---------------- */
  function log(kind, title, extra) {
    var u = current();
    if (!u) return;
    var h = histAll();
    var arr = Array.isArray(h[u.name]) ? h[u.name] : [];
    var rec = {
      id: 'e_' + rnd(6),
      ts: Date.now(),
      kind: KIND_NAME[kind] ? kind : 'visit',
      title: String(title || '').slice(0, 120),
      url: (extra && extra.url) || ''
    };
    arr.unshift(rec);
    if (arr.length > HIST_MAX) arr = arr.slice(0, HIST_MAX);
    h[u.name] = arr;
    saveHist(h);
    return rec;
  }
  function visit(path, title) {
    var u = current();
    if (!u) return;
    var h = histAll();
    var arr = Array.isArray(h[u.name]) ? h[u.name] : [];
    var last = arr[0];
    if (last && last.url === path && (Date.now() - last.ts) < VISIT_GAP) return;
    var d = db();
    var u2 = d.users[u.name];
    if (u2) {
      var s = seen(u2), t = today();
      if (s.indexOf(t) < 0) { s.push(t); if (s.length > DAYS_MAX) s = s.slice(-DAYS_MAX); saveDb(d); }
    }
    var k = 'visit';
    if (/^\/start(\/|$)/.test(path)) k = 'start';
    else if (/^\/account(\/|$)/.test(path)) k = 'account';
    log(k, title || path, { url: path });
  }
  function clearHist(name) {
    var h = histAll();
    h[name || (current() || {}).name] = [];
    saveHist(h);
  }

  /* ---------------- 备份 / 同步 ---------------- */
  function backupObj() {
    return {
      app: 'xkmyth-account', v: 1, exportedAt: Date.now(),
      acct: db(), hist: histAll(), sync: syncConf()
    };
  }
  function download(name, text) {
    try {
      var b = new Blob([text], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return true;
    } catch (e) { return false; }
  }
  function exportBackup() {
    return download('xkmyth-account-' + today() + '.json', JSON.stringify(backupObj(), null, 1));
  }
  function mergeHist(a, b) {
    var byId = {}, out = [];
    (a || []).concat(b || []).forEach(function (r) {
      if (!r || !r.id) return;
      if (!byId[r.id] || (r.ts || 0) > (byId[r.id].ts || 0)) byId[r.id] = r;
    });
    Object.keys(byId).forEach(function (k) { out.push(byId[k]); });
    out.sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
    return out.slice(0, HIST_MAX);
  }
  function importBackup(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('这不是有效的 JSON 备份'); }
    if (!o || o.app !== 'xkmyth-account' || !o.acct) throw new Error('不是本系统的备份文件');
    var d = db(), added = 0;
    var inc = o.acct.users || {};
    Object.keys(inc).forEach(function (k) {
      if (!d.users[k]) { d.users[k] = inc[k]; added++; }
    });
    if (!d.session && o.acct.session && d.users[o.acct.session.name]) d.session = o.acct.session;
    saveDb(d);
    var h = histAll(), ih = o.hist || {}, evAdd = 0;
    Object.keys(ih).forEach(function (k) {
      var before = (h[k] || []).length;
      h[k] = mergeHist(h[k], ih[k]);
      evAdd += Math.max(0, h[k].length - before);
    });
    saveHist(h);
    if (o.sync && !syncConf().endpoint) write(K_SYNC, o.sync);
    return { users: added, events: evAdd };
  }
  function syncNow(quiet) {
    var u = current();
    if (!u) return Promise.reject(new Error('先登录'));
    var c = syncConf();
    if (!c.endpoint) return Promise.reject(new Error('还没填同步服务地址'));
    if (!c.key) return Promise.reject(new Error('还没填云端密钥（publishable key）'));
    function doMerge(a) {
      return rpc({ op: 'merge', user: u.name, auth: a, hist: histOf(u.name), logins: u.logins || 0, seen: seen(u) });
    }
    return authHash(u).then(function (a) {
      // 云端被清空过（或这台设备从没推上去）时，先补一次 bind 再合并
      return doMerge(a).catch(function (e) {
        if (!/还没这个账号/.test(e.message || '')) throw e;
        return bindCloud(u).then(function (r) {
          if (r === 'auth') throw new Error('云端已经有这个用户名，但密码不一样');
          return doMerge(a);
        });
      });
    }).then(function (res) {
      var merged = mergeHist(histOf(u.name), res.hist || []);
      var h = histAll(); h[u.name] = merged; saveHist(h);
      var d = db(), uu = d.users[u.name];
      if (uu) { uu.cloudAdmin = !!res.admin; saveDb(d); }
      if (!quiet) log('sync', '云端同步完成（' + merged.length + ' 条）');
      renderHist(); renderUser();
      return merged.length;
    });
  }
  // 静默同步：登录后 / 打开页面后自己跑，失败不打扰
  function autoSync() {
    var u = current();
    if (!u || !cloudReady()) return;
    setTimeout(function () { syncNow(true).catch(function () { }); }, 400);
  }

  /* ---------------- 页面渲染 ---------------- */
  var ui = {};
  function $(id) { return document.getElementById(id); }
  function toast(msg, kind) {
    if (window.xkmythUI && window.xkmythUI.toast) window.xkmythUI.toast(msg, kind);
  }
  function err(box, msg) {
    if (!box) return;
    box.className = 'out err';
    box.textContent = msg;
  }
  function ok(box, msg) {
    if (!box) return;
    box.className = 'out flash';
    box.textContent = msg;
  }

  function renderGuest() {
    var d = db(), n = Object.keys(d.users).length;
    var note = $('accNote');
    if (!note) return;
    if (n === 0) {
      note.className = 'note ok';
      note.innerHTML = '<b>本机还没有账号。</b>你现在注册的第一个账号会自动成为 <b>站长（admin）</b>，能进管理面板给别的账号调等级、清数据。';
    } else {
      note.className = 'note';
      note.innerHTML = '这台设备上已经注册了 <b>' + n + '</b> 个账号。换设备请在登录后进「同步」导出备份，再在另一端导入 —— 账号和历史会一起搬过去。';
    }
  }

  function renderUser() {
    var u = current();
    if (!u) return;
    var t = tierOf(u), info = tierInfo(t), pg = progress(u);
    var ava = $('accAva');
    if (ava) {
      ava.textContent = (u.name || '星').slice(0, 1).toUpperCase();
      ava.setAttribute('data-t', t);
    }
    var nm = $('accName'); if (nm) nm.textContent = u.name;
    var tr = $('accTier'); if (tr) { tr.textContent = 'T' + t; tr.className = 'acc-tier t' + t; }
    var ab = $('accAdminBadge'); if (ab) ab.hidden = u.role !== 'admin';
    var pr = $('accProg'); if (pr) pr.style.width = pg.pct + '%';
    var nx = $('accNext');
    if (nx) {
      nx.textContent = pg.next
        ? (info.name + ' → ' + pg.next.name + ' · ' + pg.pct + '%（还差 ' + pg.needDays + ' 天 / ' + pg.needEvents + ' 条）')
        : ('已是最高等级 · ' + info.name);
    }
    var st = $('accStats');
    if (st) {
      st.innerHTML = [
        ['活跃天数', pg.days],
        ['历史记录', pg.events],
        ['登录次数', u.logins || 0],
        ['加入时间', new Date(u.createdAt || Date.now()).toLocaleDateString('zh-CN')]
      ].map(function (x) { return '<span><b>' + x[1] + '</b>' + x[0] + '</span>'; }).join('');
    }
    var tabA = $('accTabAdmin'); if (tabA) tabA.hidden = u.role !== 'admin';
  }

  var filterKind = 'all';
  function renderHist() {
    var u = current();
    var list = $('histList');
    if (!u || !list) return;
    var arr = histOf(u.name);
    var show = filterKind === 'all' ? arr : arr.filter(function (r) { return r.kind === filterKind; });
    var zero = $('histZero');
    if (zero) zero.hidden = show.length > 0;
    list.innerHTML = show.slice(0, 200).map(function (r) {
      return '<li class="acc-h-row">' +
        '<span class="acc-h-ico k-' + r.kind + '">' + (KIND_ICO[r.kind] || '◈') + '</span>' +
        '<span class="acc-h-main"><b>' + esc(r.title || '(无标题)') + '</b>' +
        (r.url ? '<a href="' + esc(r.url) + '">' + esc(r.url) + '</a>' : '') + '</span>' +
        '<span class="acc-h-kind">' + (KIND_NAME[r.kind] || r.kind) + '</span>' +
        '<time>' + ago(r.ts) + '</time>' +
        '</li>';
    }).join('');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderAdmin() {
    var u = current();
    if (!u || u.role !== 'admin') return;
    var d = db(), h = histAll();
    var cl = $('adminCloud');
    if (cl && !cl.getAttribute('data-wired')) {
      cl.setAttribute('data-wired', '1');
      cl.addEventListener('change', function (e) {
        var t = e.target; if (!t || !t.getAttribute('data-cl')) return;
        var u0 = current(), nm = t.getAttribute('data-cl'), v = parseInt(t.value, 10) || 0;
        authHash(u0).then(function (a) { return rpc({ op: 'admin_tier', user: u0.name, auth: a, target: nm, val: v }); })
          .then(function () { ok($('adminOut'), '云端已把 ' + nm + ' 设为 ' + (v ? 'T' + v : '自动等级')); })
          .catch(function (e2) { err($('adminOut'), e2.message); });
      });
      cl.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-clw]') : null;
        if (!b) return;
        var u0 = current(), nm = b.getAttribute('data-clw');
        authHash(u0).then(function (a) { return rpc({ op: 'admin_wipe', user: u0.name, auth: a, target: nm }); })
          .then(function () { ok($('adminOut'), '云端已清空 ' + nm + ' 的历史'); renderCloudUsers(); })
          .catch(function (e2) { err($('adminOut'), e2.message); });
      });
    }
    var cl = $('adminCloud');
    if (cl && !cl.getAttribute('data-wired')) {
      cl.setAttribute('data-wired', '1');
      cl.addEventListener('change', function (e) {
        var t = e.target; if (!t || !t.getAttribute('data-cl')) return;
        var u0 = current(), nm = t.getAttribute('data-cl'), v = parseInt(t.value, 10) || 0;
        authHash(u0).then(function (a) { return rpc({ op: 'admin_tier', user: u0.name, auth: a, target: nm, val: v }); })
          .then(function () { ok($('adminOut'), '云端已把 ' + nm + ' 设为 ' + (v ? 'T' + v : '自动等级')); })
          .catch(function (e2) { err($('adminOut'), e2.message); });
      });
      cl.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-clw]') : null;
        if (!b) return;
        var u0 = current(), nm = b.getAttribute('data-clw');
        authHash(u0).then(function (a) { return rpc({ op: 'admin_wipe', user: u0.name, auth: a, target: nm }); })
          .then(function () { ok($('adminOut'), '云端已清空 ' + nm + ' 的历史'); renderCloudUsers(); })
          .catch(function (e2) { err($('adminOut'), e2.message); });
      });
    }
    var body = $('adminBody');
    if (!body) return;
    var names = Object.keys(d.users).sort(function (a, b) {
      return (d.users[b].lastLogin || 0) - (d.users[a].lastLogin || 0);
    });
    body.innerHTML = names.map(function (n) {
      var x = d.users[n], t = tierOf(x);
      return '<tr><td><b>' + esc(n) + '</b>' + (x.role === 'admin' ? ' <span class="badge rose">ADMIN</span>' : '') + '</td>' +
        '<td><select class="input acc-mini" data-n="' + esc(n) + '">' +
        [0, 1, 2, 3, 4, 5].map(function (k) {
          var lab = k === 0 ? '自动 (T' + tierOf({ name: n, seen: x.seen, tierManual: 0 }) + ')' : 'T' + k;
          return '<option value="' + k + '"' + ((x.tierManual || 0) === k ? ' selected' : '') + '>' + lab + '</option>';
        }).join('') + '</select></td>' +
        '<td>' + seen(x).length + '</td>' +
        '<td>' + ((h[n] || []).length) + '</td>' +
        '<td>' + (x.lastLogin ? ago(x.lastLogin) : '—') + '</td>' +
        '<td><button class="btn tiny ghost" data-act="clear" data-n="' + esc(n) + '">清历史</button> ' +
        (x.role === 'admin' ? '' : '<button class="btn tiny ghost" data-act="del" data-n="' + esc(n) + '">删除</button>') +
        '</td></tr>';
    }).join('');
    var us = $('adminUsers'); if (us) us.textContent = names.length;
    var ev = 0; Object.keys(h).forEach(function (k) { ev += (h[k] || []).length; });
    var evEl = $('adminEvents'); if (evEl) evEl.textContent = ev;
    var by = 0;
    try { by = (localStorage.getItem(K_ACCT) || '').length + (localStorage.getItem(K_HIST) || '').length; } catch (e) { }
    var bt = $('adminBytes'); if (bt) bt.textContent = (by / 1024).toFixed(1) + ' KB';
    renderCloudUsers();
  }

  function renderCloudUsers() {
    var box = $('adminCloud');
    if (!box) return;
    var u = current();
    if (!u || u.role !== 'admin') { box.innerHTML = ''; return; }
    if (!cloudReady()) {
      box.innerHTML = '<p class="hint">云端还没接：账号目前只在这台设备的浏览器里。填好「同步服务地址 + 云端密钥」后，这里会列出所有设备注册过的账号。</p>';
      return;
    }
    box.innerHTML = '<p class="hint">正在读取云端账号…</p>';
    authHash(u).then(function (a) { return rpc({ op: 'admin_list', user: u.name, auth: a }); }).then(function (res) {
      var us = res.users || [];
      if (!us.length) { box.innerHTML = '<p class="hint">云端还没有账号。点「立即同步」把当前账号推上去。</p>'; return; }
      box.innerHTML = '<h4 style="margin:0 0 10px">云端账号 <span class="badge ice">' + us.length + '</span></h4><div class="tbl-wrap"><table class="tbl"><thead><tr><th>账号</th><th>等级</th><th>登录</th><th>记录</th><th>最近更新</th><th>操作</th></tr></thead><tbody>' +
        us.map(function (x) {
          return '<tr><td><b>' + esc(x.user) + '</b>' + (x.admin ? ' <span class="badge rose">ADMIN</span>' : '') + '</td>' +
            '<td><select class="input acc-mini" data-cl="' + esc(x.user) + '">' + [0, 1, 2, 3, 4, 5].map(function (k2) {
              return '<option value="' + k2 + '"' + ((x.tier || 0) === k2 ? ' selected' : '') + '>' + (k2 ? 'T' + k2 : '自动') + '</option>';
            }).join('') + '</select></td>' +
            '<td>' + (x.logins || 0) + '</td><td>' + (x.hist || 0) + '</td>' +
            '<td>' + (x.updated ? ago(Date.parse(x.updated)) : '—') + '</td>' +
            '<td><button class="btn tiny ghost" data-clw="' + esc(x.user) + '">清历史</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function (e) {
      box.innerHTML = '<p class="out err">读云端账号失败：' + esc(e.message) + '</p>';
    });
  }

  function renderSyncStat() {
    var box = $('syncStat');
    if (!box) return;
    var u = current();
    var conf = syncConf();
    var ep = $('syncEp');
    if (ep && !ep.value) ep.value = conf.endpoint || '';
    var kk = $('syncKey'); if (kk && !kk.value) kk.value = conf.key || '';
    var kk = $('syncKey'); if (kk && !kk.value) kk.value = conf.key || '';
    var h = histAll(), tot = 0;
    Object.keys(h).forEach(function (k) { tot += (h[k] || []).length; });
    box.className = (conf.endpoint && conf.key) ? 'note ok' : 'note';
    box.innerHTML = (conf.endpoint && conf.key)
      ? '云端地址已配置：<b>' + esc(conf.endpoint) + '</b>　当前账号 ' + esc(u ? u.name : '—') + ' 有 <b>' + histOf(u ? u.name : '').length + '</b> 条记录，本机总计 ' + tot + ' 条。'
      : (conf.endpoint ? '地址已填，还差云端密钥（publishable key）——填上就能跨设备同步。' : '还没配置云端地址。现在可用「导出 / 导入」手动搬数据；接上 Supabase 后这里会自动双向合并。');
  }

  function renderAll() {
    var guest = $('accGuest'), user = $('accUser');
    if (!guest) return;
    var u = current();
    if (!u) { guest.hidden = false; user.hidden = true; renderGuest(); return; }
    guest.hidden = true; user.hidden = false;
    renderUser(); renderHist(); renderSyncStat(); renderAdmin();
  }

  function setTab(name) {
    if (!ui.tabs) return;
    ui.tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    ['hist', 'sync', 'profile', 'perm', 'dev', 'admin', 'tiers'].forEach(function (k) {
      var el = $('tab-' + k);
      if (el) el.hidden = k !== name;
    });
  }

  function boot() {
    if (!$('accGuest')) return;
    autoSync();
    ui.tabs = Array.prototype.slice.call(document.querySelectorAll('#accTabs .pill'));

    /* 登录 / 注册 */
    var regForm = $('accReg');
    if (regForm) regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = $('regName').value, p = $('regPass').value, p2 = $('regPass2').value, box = $('regOut');
      if (n.trim() !== n) { err(box, '用户名首尾不能有空格'); return; }
      if (p !== p2) { err(box, '两次密码不一样'); return; }
      box.className = 'out'; box.textContent = '正在创建…';
      register(n, p).then(function () {
        regForm.reset();
        renderAll(); setTab('hist');
        toast('注册成功，欢迎加入', 'ok');
        log('account', '首次进入账号页');
        autoSync();
      }).catch(function (ex) { err(box, ex.message); });
    });

    var logForm = $('accLogin');
    if (logForm) logForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = $('logName').value, p = $('logPass').value, box = $('logOut');
      box.className = 'out'; box.textContent = '正在验证…';
      login(n, p).then(function () {
        logForm.reset();
        renderAll(); setTab('hist');
        toast('登录成功', 'ok');
        autoSync();
      }).catch(function (ex) { err(box, ex.message); });
    });

    var toReg = $('accToReg'), toLog = $('accToLog');
    if (toReg) toReg.addEventListener('click', function () { showAuth('reg'); });
    if (toLog) toLog.addEventListener('click', function () { showAuth('log'); });
    showAuth('log');

    var out = $('accOut');
    if (out) out.addEventListener('click', function () { setTimeout(function () { showAuth('log'); }, 120);
      logout(); renderAll();
      toast('已退出登录');
    });

    /* tabs */
    if (ui.tabs.length) ui.tabs.forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });

    /* 历史筛选 */
    var fs = document.querySelectorAll('#histFilters .pill');
    Array.prototype.forEach.call(fs, function (b) {
      b.addEventListener('click', function () {
        filterKind = b.getAttribute('data-k');
        Array.prototype.forEach.call(fs, function (x) { x.classList.toggle('active', x === b); });
        renderHist();
      });
    });

    var hc = $('histClear');
    if (hc) hc.addEventListener('click', function () {
      var u = current(); if (!u) return;
      if (!confirm('清空当前账号的全部历史记录？清完就没了。')) return;
      clearHist(u.name); renderHist(); renderUser();
      toast('历史已清空', 'ok');
    });
    var he = $('histExport');
    if (he) he.addEventListener('click', function () {
      var u = current(); if (!u) return;
      download('xkmyth-history-' + u.name + '-' + today() + '.json', JSON.stringify(histOf(u.name), null, 1));
    });

    /* 同步 */
    var se = $('syncExport');
    if (se) se.addEventListener('click', function () {
      var box = $('syncOut');
      if (exportBackup()) ok(box, '已导出备份文件，保存好它。');
      else err(box, '导出失败，试试换个浏览器');
      log('sync', '导出备份');
    });
    var si = $('syncImport'), sf = $('syncFile');
    if (si && sf) {
      si.addEventListener('click', function () { sf.click(); });
      sf.addEventListener('change', function () {
        var f = sf.files && sf.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var r = importBackup(String(rd.result));
            renderAll();
            ok($('syncOut'), '导入完成：新增 ' + r.users + ' 个账号、' + r.events + ' 条记录。');
          } catch (ex) { err($('syncOut'), ex.message); }
        };
        rd.readAsText(f);
        sf.value = '';
      });
    }
    var sv = $('syncSave');
    if (sv) sv.addEventListener('click', function () {
      var v = ($('syncEp').value || '').trim();
      var k = ($('syncKey').value || '').trim();
      var c = syncConf();
      c.endpoint = v; c.key = k;
      write(K_SYNC, c);
      renderSyncStat();
      ok($('syncCloudOut'), v ? (k ? '地址与密钥已保存' : '地址已保存，还差密钥') : '已清空地址');
    });
    var sn = $('syncNow');
    if (sn) sn.addEventListener('click', function () {
      var box = $('syncCloudOut');
      box.className = 'out'; box.textContent = '正在同步…';
      syncNow().then(function (n) {
        ok(box, '同步完成，现在有 ' + n + ' 条记录');
        renderAll();
      }).catch(function (ex) { err(box, ex.message); });
    });

    /* 管理 */
    var body = $('adminBody');
    if (body) body.addEventListener('change', function (e) {
      var t = e.target;
      if (t.tagName !== 'SELECT') return;
      var n = t.getAttribute('data-n'), v = parseInt(t.value, 10) || 0;
      var d = db();
      if (!d.users[n]) return;
      d.users[n].tierManual = v;
      saveDb(d);
      renderAdmin(); renderUser();
      ok($('adminOut'), v ? ('已把 ' + n + ' 设为 T' + v) : ('已把 ' + n + ' 恢复自动计算'));
    });
    if (body) body.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!b) return;
      var n = b.getAttribute('data-n'), act = b.getAttribute('data-act');
      if (act === 'clear') {
        if (!confirm('清空 ' + n + ' 的历史？')) return;
        clearHist(n); renderAdmin();
        ok($('adminOut'), '已清空 ' + n + ' 的历史');
      } else if (act === 'del') {
        if (!confirm('删除账号 ' + n + ' 及其全部历史？不可恢复。')) return;
        var d = db();
        delete d.users[n];
        if (d.session && d.session.name === n) d.session = null;
        saveDb(d);
        var h = histAll(); delete h[n]; saveHist(h);
        renderAll();
        ok($('adminOut'), '已删除 ' + n);
      }
    });
    var ar = $('adminRecalc');
    if (ar) ar.addEventListener('click', function () {
      renderAdmin(); ok($('adminOut'), '已按当前规则重算全部账号等级');
    });
    var aw = $('adminWipeHist');
    if (aw) aw.addEventListener('click', function () {
      if (!confirm('清空本机全部账号的历史记录？')) return;
      write(K_HIST, {}); renderAll();
      ok($('adminOut'), '全部历史已清空');
    });

    /* 跨标签页同步 */
    window.addEventListener('storage', function (e) {
      if (e.key === K_ACCT || e.key === K_HIST) renderAll();
    });

    renderAll();
  }

  /* ---------------- 对外 ---------------- */
  // 改密码：本地盐/哈希 + 云端凭据一起换（任何设备都能用新密码登回来）
  function changePass(oldPass, newPass) {
    var u = current();
    if (!u) return Promise.reject(new Error('先登录'));
    return hashPass(oldPass, u.salt, u.iter || ITER).then(function (hh) {
      if (hh !== u.hash) throw new Error('当前密码不对');
      var salt = rnd(16);
      return Promise.all([hashPass(newPass, salt, ITER), syncAuthOf(u.name, newPass)]).then(function (rr) {
        return authHash(u).then(function (a) {
          return rpc({ op: 'set_pass', user: u.name, auth: a, newauth: rr[1] });
        }).then(function () {
          var d = db(), uu = d.users[u.name];
          if (uu) { uu.salt = salt; uu.hash = rr[0]; uu.iter = ITER; uu.syncAuth = rr[1]; saveDb(d); }
          return true;
        });
      });
    });
  }
  // 重置成功后同步本机：本机有这号就换掉本地盐/哈希
  function adoptPass(name, newPass) {
    var d = db(), uu = d.users[name];
    if (!uu) return Promise.resolve(false);
    var salt = rnd(16);
    return Promise.all([hashPass(newPass, salt, ITER), syncAuthOf(name, newPass)]).then(function (rr) {
      uu.salt = salt; uu.hash = rr[0]; uu.iter = ITER; uu.syncAuth = rr[1];
      saveDb(d); return true;
    });
  }

  // 对外：带鉴权的云端调用（论坛 / 资料 / 站长操作都走这里）
  function api(op, extra) {
    var u = current();
    if (!u) return Promise.reject(new Error('先登录'));
    return authHash(u).then(function (a) {
      return rpc(Object.assign({ op: op, user: u.name, auth: a }, extra || {}));
    });
  }
  function apiRaw(p) { return rpc(p); }
  function myName() { var u = current(); return u ? u.name : ''; }

  function ctx() {
    var u = current();
    if (!u) return Promise.reject(new Error('先登录'));
    return authHash(u).then(function (h) { return { user: u.name, auth: h }; });
  }

  function showAuth(which) {
    var r = $('accReg'), l = $('accLogin');
    if (!r || !l) return;
    r.hidden = which !== 'reg';
    l.hidden = which === 'reg';
    var f = which === 'reg' ? $('regName') : $('logName');
    if (f) setTimeout(function () { try { f.focus(); } catch (e) { } }, 50);
  }

  window.XKAccount = {
    api: api, apiRaw: apiRaw, ctx: ctx, showAuth: showAuth, myName: myName, changePass: changePass, adoptPass: adoptPass,
    cloudReady: cloudReady, bindCloud: bindCloud, renderCloudUsers: renderCloudUsers, syncAuthOf: syncAuthOf, autoSync: autoSync,
    v: 1,
    conf: function () { var c = syncConf(); return { endpoint: c.endpoint, key: c.key, ref: (c.endpoint || '').replace(/^https:\/\//, '').split('.')[0] }; },
    perm: function () { return api('perm').catch(function () { return null; }); },
    user: current,
    tier: tierOf,
    tierName: function (t) { return tierInfo(t).name; },
    progress: progress,
    hist: histOf,
    log: log,
    visit: visit,
    register: register,
    login: login,
    logout: logout,
    clearHist: clearHist,
    exportBackup: exportBackup,
    importBackup: importBackup,
    syncNow: syncNow,
    render: renderAll
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

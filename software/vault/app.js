/* XK Vault —— 本地加密保险箱（WebCrypto，纯前端） */
(function () {
  'use strict';
  var KEY = 'xk-vault-v1';
  var SALT_KEY = 'xk-vault-salt';
  var IDLE_MS = 5 * 60 * 1000;
  var ITER = 150000;

  var cryptoKey = null;
  var items = [];
  var idleTimer = null;
  var state = loadRaw();

  var $ = function (id) { return document.getElementById(id); };
  var hasCrypto = !!(window.crypto && window.crypto.subtle);

  function b64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    var raw = atob(str), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function enc(str) { return new TextEncoder().encode(str); }
  function dec(buf) { return new TextDecoder().decode(buf); }

  function loadRaw() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function getSalt() {
    var s = localStorage.getItem(SALT_KEY);
    if (!s) {
      var r = new Uint8Array(16);
      crypto.getRandomValues(r);
      s = b64(r);
      localStorage.setItem(SALT_KEY, s);
    }
    return unb64(s);
  }

  function deriveKey(pass) {
    var base = crypto.subtle.importKey('raw', enc(pass), { name: 'PBKDF2' }, false, ['deriveKey']);
    return base.then(function (k) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: getSalt(), iterations: ITER, hash: 'SHA-256' },
        k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function seal(obj) {
    var iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, enc(JSON.stringify(obj)))
      .then(function (ct) { return { v: 1, iv: b64(iv), ct: b64(ct) }; });
  }

  function unseal(blob) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, cryptoKey, unb64(blob.ct))
      .then(function (pt) { return JSON.parse(dec(pt)); });
  }

  function persist() {
    if (!cryptoKey) return Promise.resolve();
    return seal({ items: items }).then(function (blob) {
      localStorage.setItem(KEY, JSON.stringify(blob));
    });
  }

  function toast(msg, kind) { if (window.showToast) window.showToast(msg, kind); }

  function render() {
    var list = $('vList');
    if (!list) return;
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<div class="empty-hint">还没有条目。在上方输入标题与内容，点「保存」。</div>';
    }
    items.forEach(function (it, idx) {
      var row = document.createElement('div');
      row.className = 'vault-item';

      var meta = document.createElement('div');
      meta.className = 'meta';
      var b = document.createElement('b');
      b.textContent = it.title;
      b.style.cursor = 'pointer';
      b.title = '点击复制内容';
      b.addEventListener('click', function () {
        copy(it.value, '已复制「' + it.title + '」');
      });
      var val = document.createElement('div');
      val.className = 'val masked';
      val.textContent = '••••••••••';
      var small = document.createElement('small');
      small.textContent = '更新于 ' + new Date(it.updated || Date.now()).toLocaleString();
      meta.appendChild(b); meta.appendChild(val); meta.appendChild(small);

      var acts = document.createElement('div');
      acts.className = 'tool-row';

      var eye = document.createElement('button');
      eye.type = 'button'; eye.className = 'tiny-btn'; eye.textContent = '显示';
      eye.addEventListener('click', function () {
        var shown = val.className.indexOf('masked') === -1;
        if (shown) { val.className = 'val masked'; val.textContent = '••••••••••'; eye.textContent = '显示'; }
        else { val.className = 'val'; val.textContent = it.value; eye.textContent = '隐藏'; }
      });

      var cp = document.createElement('button');
      cp.type = 'button'; cp.className = 'tiny-btn'; cp.textContent = '复制';
      cp.addEventListener('click', function () { copy(it.value, '已复制'); });

      var del = document.createElement('button');
      del.type = 'button'; del.className = 'tiny-btn danger'; del.textContent = '删除';
      del.addEventListener('click', function () {
        if (!confirm('删除「' + it.title + '」？')) return;
        items.splice(idx, 1);
        persist().then(function () { render(); toast('已删除'); });
      });

      acts.appendChild(eye); acts.appendChild(cp); acts.appendChild(del);
      row.appendChild(meta); row.appendChild(acts);
      list.appendChild(row);
    });
    $('vCount').textContent = String(items.length);
  }

  function copy(text, msg) {
    var done = function () { toast(msg, 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { toast('复制失败', 'bad'); });
    } else { toast('当前浏览器不支持自动复制', 'bad'); }
  }

  function touch() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(lock, IDLE_MS);
  }

  function lock() {
    cryptoKey = null;
    items = [];
    var gp = $('gatePanel'), vp = $('vaultPanel');
    if (gp) gp.hidden = false;
    if (vp) vp.hidden = true;
    var p = $('vPass'); if (p) p.value = '';
    $('vState').textContent = '已锁定';
    $('vCount').textContent = '0';
  }

  function unlock() {
    if (!hasCrypto) { toast('浏览器不支持 WebCrypto，无法加密', 'bad'); return; }
    var pass = ($('vPass').value || '');
    if (pass.length < 8) { toast('主密码至少 8 位', 'bad'); $('vPass').focus(); return; }
    var hint = $('gateHint');
    hint.textContent = '正在派生密钥（约 0.2~1 秒）…';
    deriveKey(pass).then(function (k) {
      cryptoKey = k;
      var fresh = !state;
      if (fresh) { items = []; return persist().then(function () { return true; }); }
      return unseal(state).then(function (data) {
        items = (data && data.items) || [];
        return false;
      });
    }).then(function (fresh) {
      state = loadRaw();
      $('gatePanel').hidden = true;
      $('vaultPanel').hidden = false;
      $('vState').textContent = '已解锁';
      $('vPass').value = '';
      hint.textContent = '第一次使用会用你输入的密码创建加密仓库。';
      render(); touch();
      toast(fresh ? '保险箱已创建' : ('已解锁 · ' + items.length + ' 条'), 'ok');
    }).catch(function (err) {
      cryptoKey = null;
      hint.textContent = '密码不对，或这份数据来自另一个主密码。';
      toast('解锁失败', 'bad');
    });
  }

  function add() {
    var t = ($('vTitle').value || '').trim();
    var v = ($('vValue').value || '').trim();
    if (!t || !v) { toast('标题和内容都要填', 'bad'); return; }
    items.unshift({ title: t, value: v, updated: Date.now() });
    $('vTitle').value = ''; $('vValue').value = '';
    persist().then(function () { state = loadRaw(); render(); touch(); toast('已加密保存', 'ok'); });
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function init() {
    if (!hasCrypto) {
      $('gateHint').textContent = '当前浏览器不支持 WebCrypto（需 HTTPS 或 localhost），此应用不可用。';
      $('unlockBtn').disabled = true;
      return;
    }
    $('unlockBtn').addEventListener('click', unlock);
    $('vPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });
    $('vAdd').addEventListener('click', add);
    $('vValue').addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    $('lockBtn').addEventListener('click', function () { lock(); toast('已锁定'); });
    document.addEventListener('mousemove', touch, { passive: true });
    document.addEventListener('keydown', touch);
    $('exportBtn').addEventListener('click', function () {
      if (!cryptoKey) { toast('先解锁', 'bad'); return; }
      var blob = localStorage.getItem(KEY) || '{}';
      download('xk-vault-' + new Date().toISOString().slice(0, 10) + '.json', blob);
      toast('已导出加密备份', 'ok');
    });
    $('importFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var data = JSON.parse(String(fr.result));
          if (!data || !data.iv || !data.ct) throw new Error('bad');
          localStorage.setItem(KEY, JSON.stringify(data));
          toast('备份已导入，请用对应主密码解锁', 'ok');
          state = loadRaw(); lock();
        } catch (err) { toast('文件不是有效的保险箱备份', 'bad'); }
      };
      fr.readAsText(f);
      e.target.value = '';
    });
    $('wipeBtn').addEventListener('click', function () {
      if (!confirm('清空保险箱与盐值？数据无法恢复。')) return;
      localStorage.removeItem(KEY);
      localStorage.removeItem(SALT_KEY);
      state = null; lock(); toast('已清空');
    });
    if (state) $('gateHint').textContent = '检测到已有加密仓库，输入主密码解锁。';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

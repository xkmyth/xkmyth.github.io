/* ============================================================
   星空 AI · 站内助手（/js/ai.js）
   ------------------------------------------------------------
   · 全站右下角一个气泡，点开就是聊天面板
   · 后端走 Supabase RPC xk_ai（key 在服务端，前端拿不到）
   · 内置四种活：写帖 / 中转站条目 / 做插件（可下载 zip）/ 讲人话
   · 对话存本机（localStorage xkmyth-ai-v1），关掉页面还在
   ============================================================ */
(function () {
  'use strict';

  var K_CHAT = 'xkmyth-ai-v1';
  var MAX_TURNS = 20;
  var SITE = 'xkmyth.dpdns.org';

  var SYS = [
    '你是「星空 AI」，嵌在 xkmyth 个人站内的助手。站点域名 ' + SITE + '，风格是深空蓝＋金色、少字、有画面感。',
    '站点结构：/ 首页 · /forum/ 论坛 · /software/ 软件库（纯前端小工具） · /start/ 常用网站中转站（160+ 站点分 14 类） · /account/ 账号 · /dl/ 下载。',
    '论坛 8 个板块：综合、技术、闲聊、求助、资源、作品、公告（仅站长）、站务（版主以上）。正文支持 markdown：代码块、列表、引用、粗斜体、链接、@提及。',
    '用户说话要简短、直接、中文，不客套。给代码就只给代码，必要时一行说明。',
    '如果用户让你做插件，按这个格式输出（严格）：',
    '===FILE: manifest.json===',
    '（Manifest V3 的 json，name 用中文，permissions 尽量少，content_scripts 指 content.js 或 page.js）',
    '===FILE: content.js===',
    '（可直接运行的代码，不要 ES module import，不要外部依赖）',
    '最后可以加一句使用说明。文件之间不要写别的分隔符。'
  ].join('\n');

  var PRESET = [
    { k: 'post', t: '写个帖子', p: '帮我写一条论坛帖：标题和正文都给我，正文 120 字以内，别太广告。主题是「我做了个常用网站中转站」。' },
    { k: 'site', t: '中转站条目', p: '给我 6 个还没被收进中转站的好用网站，输出 JSON 数组，字段 name / url / cat / desc，cat 从 工具、开发、设计、AI、影音、阅读、学习、效率 里选，desc 一句中文。' },
    { k: 'ext', t: '做个插件', p: '做一个 Edge/Chrome 扩展（Manifest V3），功能：给当前网页加一个深空蓝阅读模式，一键切换，状态存 chrome.storage。按 ===FILE:=== 格式给我 manifest.json 和 content.js。' },
    { k: 'plain', t: '讲人话', p: '用大白话解释一下：什么叫 CDN，它和我把网站放 GitHub Pages 有什么区别？' }
  ];

  var state = { open: false, busy: false, msgs: [], model: '' };

  /* ---------------- 存储 ---------------- */
  function load() {
    try { var s = localStorage.getItem(K_CHAT); var o = s ? JSON.parse(s) : null; if (o && Array.isArray(o.msgs)) state.msgs = o.msgs.slice(-MAX_TURNS * 2); } catch (e) { }
  }
  function save() {
    try { localStorage.setItem(K_CHAT, JSON.stringify({ msgs: state.msgs.slice(-MAX_TURNS * 2) })); } catch (e) { }
  }

  /* ---------------- 小工具 ---------------- */
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function esc(s) { return h(s); }
  function md(s) {
    var t = esc(s);
    t = t.replace(/```([\s\S]*?)```/g, function (m, c) { return '<pre class="ai-code"><code>' + c.replace(/^\n+|\n+$/g, '') + '</code></pre>'; });
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    t = t.replace(/^###\s+(.+)$/gm, '<b>$1</b>');
    t = t.replace(/^[-*]\s+(.+)$/gm, '· $1');
    t = t.replace(/\n/g, '<br>');
    return t;
  }
  function toast(m, k) { if (window.xkmythUI && xkmythUI.toast) return xkmythUI.toast(m, k); console.log('[ai]', m); }
  function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }

  /* ---------------- RPC ---------------- */
  function conf() { try { return window.XKAccount.conf(); } catch (e) { return null; } }
  function ctx() {
    if (window.XKAccount && XKAccount.ctx) return XKAccount.ctx();
    return Promise.reject(new Error('账号模块还没好，刷新一下试试'));
  }
  function rpc(payload) {
    var c = conf();
    if (!c) return Promise.reject(new Error('云端配置缺失'));
    var BK = String.fromCharCode(66, 101, 97, 114, 101, 114, 32);
    function once(retry) {
      return fetch(c.endpoint + '/rest/v1/rpc/xk_ai', {
        method: 'POST',
        headers: { apikey: c.key, Authorization: BK + c.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p: payload })
      }).then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) { }
          if (!r.ok) throw new Error('云端 ' + r.status + ' ' + (t || '').slice(0, 120));
          if (!j) throw new Error('云端回了看不懂的东西');
          if (j.ok === false) { var e2 = new Error(errText(j)); e2.code = j.err; e2.raw = j; throw e2; }
          return j;
        });
      }).catch(function (e) {
        if (!retry && /Failed to fetch|NetworkError|fetch/i.test(e && e.message || '')) {
          return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return once(true); });
        }
        throw e;
      });
    }
    return once(false);
  }
  function errText(j) {
    var m = {
      auth: '云端密码对不上，去账号页重新登录一下',
      no_user: '云端还没这个账号，去账号页刷新一次会自动补上',
      banned: '这个账号被封了',
      slow: '问太快了，歇一会儿（每小时 40 次）',
      no_key: '站长还没配 AI key',
      timeout: '模型想太久没回，重发一次试试',
      empty: '模型这次没说话，再问一遍',
      bad_param: '请求参数不对'
    };
    if (j.err === 'api') return '模型接口报错 ' + (j.status || '') + '：' + String(j.detail || '').slice(0, 120);
    return m[j.err] || ('出错了：' + j.err);
  }

  /* ---------------- 插件打包（store 方式，不压缩） ---------------- */
  var CRCT = (function () { var t = new Int32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  function crc32(u8) { var c = -1; for (var i = 0; i < u8.length; i++) c = (c >>> 8) ^ CRCT[(c ^ u8[i]) & 0xFF]; return (c ^ -1) >>> 0; }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function zipStore(files) {
    var enc = new TextEncoder(), locals = [], centrals = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var lh = [].concat([0x50, 0x4b, 3, 4], u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      locals.push(new Uint8Array(lh), name, data);
      var ch = [].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off));
      centrals.push(new Uint8Array(ch), name);
      off += lh.length + name.length + data.length;
    });
    var cSize = centrals.reduce(function (a, b) { return a + b.length; }, 0);
    var end = [].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length), u32(cSize), u32(off), u16(0));
    var all = locals.concat(centrals, [new Uint8Array(end)]);
    var total = all.reduce(function (a, b) { return a + b.length; }, 0);
    var out = new Uint8Array(total), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return new Blob([out], { type: 'application/zip' });
  }
  function parseFiles(text) {
    var out = [], re = /===\s*FILE:\s*([^\s=]+)\s*===([\s\S]*?)(?====\s*FILE:|$)/g, m;
    while ((m = re.exec(text))) {
      var body = m[2].replace(/^\s*\n/, '');
      body = body.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, '$1');
      out.push({ name: m[1].trim(), data: body.trim() + '\n' });
    }
    return out;
  }
  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }

  /* ---------------- UI ---------------- */
  var bubble, panel, listEl, inputEl, footEl;

  function build() {
    bubble = el('button', 'ai-bubble');
    bubble.type = 'button';
    bubble.title = '星空 AI（点开聊）';
    bubble.setAttribute('aria-label', '星空 AI');
    bubble.innerHTML = '<span class="ai-bub-ico">🐉</span><span class="ai-bub-dot" hidden></span>';
    document.body.appendChild(bubble);

    panel = el('div', 'ai-panel');
    panel.hidden = true;
    panel.innerHTML = [
      '<div class="ai-head">',
      '  <div class="ai-title"><span class="ai-ico">🐉</span><span>星空 AI</span><span class="ai-model" id="aiModel"></span></div>',
      '  <div class="ai-head-btns">',
      '    <button class="ai-hbtn" type="button" id="aiNew" title="开新对话">＋</button>',
      '    <button class="ai-hbtn" type="button" id="aiClose" title="关掉">✕</button>',
      '  </div>',
      '</div>',
      '<div class="ai-body" id="aiBody"></div>',
      '<div class="ai-chips" id="aiChips"></div>',
      '<form class="ai-form" id="aiForm">',
      '  <textarea id="aiInput" rows="1" placeholder="问点什么，或者让它给你做个插件…"></textarea>',
      '  <button class="ai-send" type="submit" id="aiSend" title="发送">↑</button>',
      '</form>',
      '<div class="ai-foot"><span id="aiFoot">Enter 发送 · Shift+Enter 换行</span><span class="ai-by">DeepSeek 驱动</span></div>'
    ].join('');
    document.body.appendChild(panel);

    listEl = panel.querySelector('#aiBody');
    inputEl = panel.querySelector('#aiInput');
    footEl = panel.querySelector('#aiFoot');

    PRESET.forEach(function (p) {
      var b = el('button', 'ai-chip', p.t);
      b.type = 'button';
      b.dataset.k = p.k;
      b.addEventListener('click', function () { send(p.p); });
      panel.querySelector('#aiChips').appendChild(b);
    });

    bubble.addEventListener('click', function () { toggle(); });
    panel.querySelector('#aiClose').addEventListener('click', function () { toggle(false); });
    panel.querySelector('#aiNew').addEventListener('click', function () {
      state.msgs = []; save(); renderMsgs(); toast('开了个新对话', 'ok');
    });
    panel.querySelector('#aiForm').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
      if (e.key === 'Escape') toggle(false);
    });
    inputEl.addEventListener('input', function () {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 132) + 'px';
    });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dl]');
      if (!b) return;
      var idx = +b.dataset.dl, files = state.msgs[idx] && state.msgs[idx].files;
      if (!files || !files.length) return;
      download(zipStore(files), (b.dataset.name || 'xkmyth-plugin') + '.zip');
      toast('打包好了，解压后在扩展页面「加载解压缩」', 'ok');
    });
  }

  function toggle(force) {
    var want = force == null ? panel.hidden : !!force;
    panel.hidden = !want;
    bubble.classList.toggle('on', want);
    if (want) {
      renderMsgs();
      setTimeout(function () { inputEl.focus(); }, 60);
      info();
    }
  }

  function info() {
    ctx().then(function (c) {
      return rpc({ op: 'info', user: c.user, auth: c.auth });
    }).then(function (j) {
      state.model = j.model || '';
      var m = panel.querySelector('#aiModel'); if (m) m.textContent = j.model || '';
      footEl.textContent = j.limit === -1 ? '站长不限次 · Enter 发送' : ('剩 ' + Math.max(0, j.limit - j.used) + '/' + j.limit + ' 次 · Enter 发送');
    }).catch(function (e) {
      footEl.textContent = e && e.code === 'auth' ? '云端还没同步，去账号页刷新一次' : 'Enter 发送 · Shift+Enter 换行';
    });
  }

  function renderMsgs() {
    listEl.innerHTML = '';
    if (!state.msgs.length) {
      var w = el('div', 'ai-welcome');
      w.innerHTML = '<p class="ai-hi">我是星空 AI，站里的助手 🐉</p><p class="ai-sub">写帖子、找站点、做浏览器插件、讲人话都行。下面点一个试试，或者直接问我。</p>';
      listEl.appendChild(w);
      return;
    }
    state.msgs.forEach(function (m, i) {
      var row = el('div', 'ai-row ' + (m.role === 'user' ? 'me' : 'ai'));
      var bub = el('div', 'ai-msg');
      bub.innerHTML = m.role === 'user' ? h(m.content).replace(/\n/g, '<br>') : md(m.content);
      row.appendChild(bub);
      if (m.files && m.files.length) {
        var bar = el('div', 'ai-files');
        var list = m.files.map(function (f) { return f.name; }).join(' · ');
        bar.innerHTML = '<span class="ai-fname">' + h(list) + '</span>';
        var dl = el('button', 'ai-dlbtn', '⬇ 下载 .zip');
        dl.type = 'button'; dl.dataset.dl = i; dl.dataset.name = 'xkmyth-plugin';
        bar.appendChild(dl);
        row.appendChild(bar);
      }
      listEl.appendChild(row);
    });
    listEl.scrollTop = listEl.scrollHeight;
  }

  function push(role, content, extra) {
    var m = { role: role, content: content, ts: Date.now() };
    if (extra) for (var k in extra) m[k] = extra[k];
    state.msgs.push(m); save(); renderMsgs();
  }

  function askPoll(c, history) {
    return rpc({ op: 'ask', user: c.user, auth: c.auth, messages: history, system: SYS, kind: 'chat' }).then(function (j) {
      if (!j.rid) throw new Error('没拿到请求号');
      var tries = 0;
      return new Promise(function (resolve, reject) {
        (function loop() {
          tries++;
          rpc({ op: 'poll', user: c.user, auth: c.auth, rid: j.rid }).then(function (r) {
            if (r && r.pending) {
              if (tries > 80) return reject(new Error('模型想太久没回，重发一次试试'));
              return setTimeout(loop, 900);
            }
            resolve(r);
          }).catch(reject);
        })();
      });
    });
  }

  function submit() {
    var v = inputEl.value.trim();
    if (!v) return;
    inputEl.value = ''; inputEl.style.height = 'auto';
    send(v);
  }

  function send(text) {
    if (state.busy) { toast('上一个还在想', 'warn'); return; }
    push('user', text);
    state.busy = true;
    var thinking = el('div', 'ai-row ai thinking');
    thinking.innerHTML = '<div class="ai-msg"><span class="ai-dots"><i></i><i></i><i></i></span></div>';
    listEl.appendChild(thinking);
    listEl.scrollTop = listEl.scrollHeight;

    var history = state.msgs.slice(-12).map(function (m) { return { role: m.role, content: m.content }; });
    ctx().then(function (c) {
      return askPoll(c, history);
    }).then(function (j) {
      var files = parseFiles(j.text || '');
      push('assistant', j.text || '', files.length ? { files: files } : null);
      if (j.usage && j.usage.total_tokens) footEl.textContent = '这次 ' + j.usage.total_tokens + ' tokens';
    }).catch(function (e) {
      push('assistant', '⚠️ ' + (e && e.message ? e.message : '出错了'));
    }).then(function () {
      state.busy = false;
      var t = listEl.querySelector('.ai.thinking'); if (t) t.remove();
      if (panel.hidden === false) setTimeout(function () { inputEl.focus(); }, 30);
    });
  }

  function boot() {
    if (document.body.classList.contains('ai-off')) return;
    if (document.getElementById('aiBubble')) return;
    load();
    build();
  }

  window.XKAI = { open: function () { toggle(true); }, close: function () { toggle(false); }, ask: send, files: parseFiles, zip: zipStore };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* forum.js v4 —— 板块 / 发图 / 收藏 / 举报审核 / 通知中心 / @提及 / 草稿 / 深链 */
(function () {
  'use strict';
  var A = window.XKAccount;
  if (!A) return;
  var $ = function (id) { return document.getElementById(id); };
  var BEAR = String.fromCharCode(66, 101, 97, 114, 101, 114, 32);
  var S = {
    cat: '', sort: 'new', mine: '', q: '', before: 0,
    reply: 0, replyName: '', admin: false, mod: false, role: 'user', caps: {},
    boards: [], imgs: [], lockedRoot: {}
  };
  var list = [], MAP = {}, AUTHORS = [], POLL = null;
  var DRAFT_KEY = 'xkmyth-fm-draft', SEEN_KEY = 'xkmyth-fm-seen';

  function toast(t, k) { if (window.xkmythUI && window.xkmythUI.toast) window.xkmythUI.toast(t, k); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- markdown-lite v2 ---------------- */
  function md(s) {
    var raw = String(s == null ? '' : s).replace(/\r\n/g, '\n');
    var fences = [];
    raw = raw.replace(/```([\s\S]*?)```/g, function (_, c) {
      fences.push(c.replace(/^\n/, ''));
      return '\u0000F' + (fences.length - 1) + '\u0000';
    });
    var h = esc(raw);
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(（])\*([^*\n]{1,60})\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
      .replace(/@([A-Za-z0-9_\u4e00-\u9fa5.\-]{2,40})/g, '<span class="fm-at">@$1</span>');
    var lines = h.split('\n'), out = [], ul = [], ol = [], q = [];
    function fUl() { if (ul.length) { out.push('<ul>' + ul.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'); ul = []; } }
    function fOl() { if (ol.length) { out.push('<ol>' + ol.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'); ol = []; } }
    function fQ() { if (q.length) { out.push('<blockquote>' + q.join('<br>') + '</blockquote>'); q = []; } }
    function fAll() { fUl(); fOl(); fQ(); }
    lines.forEach(function (ln) {
      if (/^\s*[-*+]\s+/.test(ln)) { fQ(); fOl(); ul.push(ln.replace(/^\s*[-*+]\s+/, '')); return; }
      if (/^\s*\d+[.)]\s+/.test(ln)) { fQ(); fUl(); ol.push(ln.replace(/^\s*\d+[.)]\s+/, '')); return; }
      if (/^\s*&gt;\s?/.test(ln)) { fUl(); fOl(); q.push(ln.replace(/^\s*&gt;\s?/, '')); return; }
      if (/^\s*(---|\*\*\*)\s*$/.test(ln)) { fAll(); out.push('<hr>'); return; }
      fAll(); out.push('<span class="md-l">' + ln + '</span>');
    });
    fAll();
    var html = out.join('');
    html = html.replace(/\u0000F(\d+)\u0000/g, function (_, i) {
      return '<pre class="md-pre"><code>' + esc(fences[+i]) + '</code></pre>';
    });
    return html;
  }

  function ago(ts) {
    var d = new Date(ts), s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 2592000) return Math.floor(s / 86400) + ' 天前';
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function ini(n) { return String(n || '?').slice(0, 1).toUpperCase(); }
  function roleBadge(p) {
    if (p.author_role === 'admin' || p.author_admin) return ' <span class="badge rose">站长</span>';
    if (p.author_role === 'mod') return ' <span class="badge ice">版主</span>';
    return '';
  }
  function imgGrid(imgs) {
    if (!imgs || !imgs.length) return '';
    return '<div class="fm-ig">' + imgs.map(function (u, i) {
      return '<a class="fm-ig-i" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' +
        '<img src="' + esc(u) + '" alt="图 ' + (i + 1) + '" loading="lazy"></a>';
    }).join('') + '</div>';
  }

  /* ---------------- 统计 / 板块 ---------------- */
  function loadStats() {
    if (!A.myName()) return;
    A.api('stats').then(function (r) {
      if (r.ok === false) return;
      var box = $('fmStats');
      if (!box) return;
      var items = [['账号', r.users], ['在线', r.online], ['版主', r.mods], ['主题', r.posts],
        ['回复', r.replies], ['点赞', r.likes], ['收藏', r.favs], ['24 小时', r.today]];
      box.innerHTML = items.map(function (it) {
        return '<span class="fm-stat"><b>' + (it[1] == null ? 0 : it[1]) + '</b>' + it[0] + '</span>';
      }).join('');
      if (typeof r.reports === 'number') {
        var b = $('fmModBtn'), n = $('fmModN');
        if (b) { b.hidden = false; if (n) n.textContent = r.reports; }
      }
    }).catch(function () { });
  }

  function loadBoards() {
    if (!A.myName()) return Promise.resolve();
    return A.api('boards').then(function (r) {
      if (r.ok === false) throw r;
      S.boards = r.boards || [];
      S.mod = !!r.mod;
      S.role = r.role || 'user';
      var sel = $('fmCat');
      if (sel) {
        sel.innerHTML = S.boards.map(function (b) {
          return '<option value="' + esc(b.name) + '"' + (b.can ? '' : ' disabled') + '>' +
            b.name + (b.can ? '' : '（' + (b.need === 'admin' ? '仅站长' : '版主以上') + '）') + '</option>';
        }).join('');
      }
      var chips = '<button class="fm-chip' + (S.cat === '' ? ' on' : '') + '" type="button" data-cat="">全部</button>' +
        S.boards.map(function (b) {
          return '<button class="fm-chip' + (S.cat === b.name ? ' on' : '') + '" type="button" data-cat="' + esc(b.name) + '">' +
            esc(b.name) + (b.n ? '<em>' + b.n + '</em>' : '') + '</button>';
        }).join('');
      if ($('fmCats')) $('fmCats').innerHTML = chips;
    }).catch(function () { });
  }

  /* ---------------- 列表 ---------------- */
  function actsFor(p) {
    var mine = p.mine, adm = S.admin, mod = S.mod, out = [];
    out.push('<button class="fm-act' + (p.liked ? ' on' : '') + '" type="button" data-a="like" data-id="' + p.id + '">♥ <b>' + (p.likes || 0) + '</b></button>');
    if (p.parent == null) {
      out.push('<button class="fm-act" type="button" data-a="open" data-id="' + p.id + '">💬 <b>' + (p.replies || 0) + '</b> 回复</button>');
      out.push('<span class="fm-views" title="浏览">👁 ' + (p.views || 0) + '</span>');
    }
    out.push('<button class="fm-act' + (p.fav ? ' on' : '') + '" type="button" data-a="fav" data-id="' + (p.parent || p.id) + '" title="收藏">★</button>');
    out.push('<button class="fm-act" type="button" data-a="reply" data-id="' + (p.parent || p.id) + '" data-u="' + esc(p.author) + '">回复 TA</button>');
    out.push('<button class="fm-act" type="button" data-a="share" data-id="' + (p.parent || p.id) + '">分享</button>');
    if (mine || mod) out.push('<button class="fm-act" type="button" data-a="edit" data-id="' + p.id + '">编辑</button>');
    if (!mine) out.push('<button class="fm-act warn" type="button" data-a="report" data-id="' + p.id + '">举报</button>');
    if (mod && p.parent == null) out.push('<button class="fm-act" type="button" data-a="lock" data-id="' + p.id + '" data-v="' + (p.locked ? 1 : 0) + '">' + (p.locked ? '解锁' : '锁帖') + '</button>');
    if (adm && p.parent == null) {
      out.push('<button class="fm-act" type="button" data-a="pin" data-id="' + p.id + '" data-v="' + (p.pinned ? 1 : 0) + '">' + (p.pinned ? '取消置顶' : '置顶') + '</button>');
      out.push('<button class="fm-act" type="button" data-a="feat" data-id="' + p.id + '" data-v="' + (p.featured ? 1 : 0) + '">' + (p.featured ? '取消精华' : '加精') + '</button>');
    }
    if (mine || mod) out.push('<button class="fm-act warn" type="button" data-a="del" data-id="' + p.id + '">删除</button>');
    return out.join('');
  }

  function head(p) {
    return '<div class="fm-phead">' +
      '<span class="fm-ava t' + (p.tier || 1) + '" data-a="prof" data-u="' + esc(p.author) + '" role="button" tabindex="0">' +
      esc(p.avatar || ini(p.author)) + '</span>' +
      '<div class="fm-pmeta"><b data-a="prof" data-u="' + esc(p.author) + '">' + esc(p.author) + '</b>' +
      '<span class="acc-tier t' + (p.tier || 1) + '">T' + (p.tier || 1) + '</span>' + roleBadge(p) +
      (p.author_banned ? ' <span class="badge">封禁</span>' : '') +
      (p.pinned ? ' <span class="badge">置顶</span>' : '') +
      (p.featured ? ' <span class="badge gold">精华</span>' : '') +
      (p.locked ? ' <span class="badge">已锁</span>' : '') +
      '<span class="fm-ptime">' + ago(p.ts) + (p.edited ? ' · 已编辑' : '') +
      (p.cat ? ' · <em class="fm-cat">' + esc(p.cat) + '</em>' : '') + '</span></div></div>';
  }

  function renderPost(p) {
    MAP[p.id] = p;
    if (p.author && AUTHORS.indexOf(p.author) < 0) AUTHORS.push(p.author);
    var t = (p.title || '').trim();
    return '<article class="fm-post" data-id="' + p.id + '" id="p' + p.id + '">' +
      head(p) +
      (t ? '<h3 class="fm-ptitle" data-a="open" data-id="' + p.id + '">' + esc(t) + '</h3>' : '') +
      (p.body ? '<div class="fm-body" data-body="' + p.id + '">' + md(p.body) + '</div>' : '') +
      imgGrid(p.imgs) +
      '<div class="fm-kids" id="kids-' + p.id + '" hidden></div>' +
      '<div class="fm-acts">' + actsFor(p) + '</div>' +
      '</article>';
  }

  function render() {
    var box = $('fmList');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '';
      if ($('fmZero')) {
        $('fmZero').hidden = false;
        $('fmZero').textContent = S.q ? '没有搜到「' + S.q + '」。' :
          S.mine === 'fav' ? '你还没收藏过帖子。点帖子下面的 ★ 收藏。' :
            S.mine === '1' ? '你还没发过帖。' : '这里还没有内容。做第一个吧。';
      }
      return;
    }
    if ($('fmZero')) $('fmZero').hidden = true;
    box.innerHTML = list.map(renderPost).join('');
  }

  function heading() {
    var h = $('fmHeading');
    if (!h) return;
    var name = S.mine === 'fav' ? '我收藏的' : S.mine === '1' ? '我发的帖'
      : S.sort === 'hot' ? '最热话题' : S.sort === 'best' ? '精华帖' : '最新话题';
    h.textContent = name + (S.cat ? ' · ' + S.cat : '') + (S.q ? ' · “' + S.q + '”' : '');
    if ($('fmHint')) $('fmHint').textContent = list.length ? '显示 ' + list.length + ' 条' : '';
  }

  function loadFeed(reset) {
    if (!A.myName()) return Promise.resolve();
    if (reset) S.before = 0;
    return A.api('feed', { cat: S.cat, sort: S.sort, mine: S.mine, q: S.q, limit: 20, before: S.before })
      .then(function (r) {
        if (r.ok === false) throw r;
        S.admin = !!r.admin; S.mod = !!r.mod; S.role = r.role || 'user';
        var posts = r.posts || [];
        if (reset) list = posts; else list = list.concat(posts);
        if (posts.length) S.before = posts[posts.length - 1].id;
        if ($('fmMore')) $('fmMore').hidden = posts.length < 20;
        heading(); render();
      }).catch(function (e) {
        if (e && e.err === 'maint') {
          if ($('fmMaint')) $('fmMaint').hidden = false;
          if ($('fmList')) $('fmList').innerHTML = '';
          if ($('fmCompose')) $('fmCompose').hidden = true;
          return;
        }
        out(e && (e.message || e.err) || '加载失败');
      });
  }
  function out(msg) { var o = $('fmOut'); if (o) { o.className = 'out err'; o.textContent = msg; } }

  /* ---------------- 线程 ---------------- */
  function openThread(id, force) {
    var box = $('kids-' + id);
    if (!box) return Promise.resolve();
    if (!box.hidden && !force) { box.hidden = true; return Promise.resolve(); }
    box.hidden = false;
    box.innerHTML = '<p class="hint">正在加载回复…</p>';
    return A.api('thread', { id: id }).then(function (r) {
      if (r.ok === false) throw r;
      S.lockedRoot[id] = !!r.locked;
      var posts = (r.posts || []).filter(function (p) { return p.parent != null; });
      if (!posts.length) { box.innerHTML = '<p class="hint">还没有回复。' + (r.locked ? '（本帖已锁）' : '') + '</p>'; return; }
      box.innerHTML = posts.map(function (p) {
        MAP[p.id] = p;
        return '<div class="fm-kid" data-id="' + p.id + '" id="p' + p.id + '">' + head(p) +
          '<div class="fm-body" data-body="' + p.id + '">' + md(p.body) + '</div>' + imgGrid(p.imgs) +
          '<div class="fm-acts">' + actsFor(p) + '</div></div>';
      }).join('');
    }).catch(function () { box.innerHTML = '<p class="hint">回复加载失败。</p>'; });
  }

  /* ---------------- 名片 ---------------- */
  function openProfile(name) {
    if (!name) return;
    var m = $('fmModal');
    if (!m) return;
    m.hidden = false;
    $('fmModalName').textContent = name;
    $('fmModalBio').textContent = '正在读取…';
    A.api('profile', { target: name }).then(function (r) {
      if (r.ok === false) throw r;
      var u = r.u || {};
      $('fmModalAva').textContent = u.avatar || ini(u.user);
      $('fmModalAva').className = 'fm-ava big t' + (u.tier || 1);
      $('fmModalName').textContent = u.user || name;
      $('fmModalTier').textContent = 'T' + (u.tier || 1);
      $('fmModalTier').className = 'acc-tier t' + (u.tier || 1);
      $('fmModalAdmin').hidden = !u.admin;
      $('fmModalMod').hidden = u.role !== 'mod';
      $('fmModalBan').hidden = !u.banned;
      $('fmModalBio').textContent = u.bio || '这个人很安静，什么也没写。';
      $('fmModalJoin').textContent = u.joined || '—';
      $('fmModalDays').textContent = (u.days || 0) + ' 天';
      $('fmModalPosts').textContent = (u.posts || 0) + ' / ' + (u.replies || 0);
      $('fmModalLikes').textContent = (u.likes_got == null ? '—' : u.likes_got) + ' / ' + (u.favs == null ? '—' : u.favs);
      $('fmModalLast').textContent = u.last || '—';
      $('fmModalOut').textContent = '';
      $('fmModalMine').hidden = !(u.posts > 0);
      $('fmModalMine').setAttribute('data-u', u.user || name);
    }).catch(function (e) {
      $('fmModalBio').textContent = '';
      var msg = e && e.err === 'private' ? '对方的名片是私密的。' : (e && (e.message || e.err)) || '读不到名片';
      $('fmModalOut').className = 'out err'; $('fmModalOut').textContent = msg;
    });
  }

  /* ---------------- 通知中心 ---------------- */
  function loadNotifs() {
    if (!A.myName()) return;
    A.api('notifs').then(function (r) {
      if (r.ok === false) return;
      var items = r.items || [];
      var seen = +(localStorage.getItem(SEEN_KEY) || 0);
      var fresh = items.filter(function (i) { return new Date(i.ts).getTime() > seen; }).length;
      var n = $('fmBellN');
      if (n) { n.hidden = !fresh; n.textContent = fresh > 99 ? '99+' : String(fresh); }
      if ($('fmBell')) $('fmBell').classList.toggle('has', fresh > 0);
      var box = $('fmBellBox');
      if (!box) return;
      if (!items.length) { box.innerHTML = '<p class="hint">还没有人回复、点赞或提到你。</p>'; return; }
      var ICON = { reply: '💬', like: '♥', mention: '@' };
      box.innerHTML = '<div class="fm-bell-h">通知 <button class="fm-x2" type="button" id="fmBellRead">全部已读</button></div>' +
        items.map(function (i) {
          var un = new Date(i.ts).getTime() > seen;
          return '<button class="fm-noti' + (un ? ' un' : '') + '" type="button" data-noti="' + i.pid + '" data-t="' + i.type + '">' +
            '<span class="fm-noti-i">' + (ICON[i.type] || '·') + '</span>' +
            '<span class="fm-noti-t"><b>' + esc(i.author) + '</b>' +
            (i.type === 'reply' ? ' 回复了你' : i.type === 'like' ? ' 赞了你' : ' 提到了你') +
            '<em>' + esc(i.body) + '</em></span>' +
            '<span class="fm-noti-ts">' + ago(i.ts) + '</span></button>';
        }).join('');
      var rd = $('fmBellRead');
      if (rd) rd.addEventListener('click', function () {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
        loadNotifs(); var n2 = $('fmBellN'); if (n2) n2.hidden = true;
      });
    }).catch(function () { });
  }

  /* ---------------- 草稿 ---------------- */
  function saveDraft() {
    try {
      var d = { body: $('fmText') ? $('fmText').value : '', title: $('fmTitle') ? $('fmTitle').value : '', cat: $('fmCat') ? $('fmCat').value : '', ts: Date.now() };
      if (!d.body.trim() && !d.title.trim()) { localStorage.removeItem(DRAFT_KEY); if ($('fmDraft')) $('fmDraft').hidden = true; return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      if ($('fmDraft')) $('fmDraft').hidden = false;
    } catch (e) { }
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (!d || Date.now() - (d.ts || 0) > 7 * 864e5) return;
      if (d.body && $('fmText')) $('fmText').value = d.body;
      if (d.title && $('fmTitle')) $('fmTitle').value = d.title;
      if (d.cat && $('fmCat')) $('fmCat').value = d.cat;
      if ((d.body || d.title) && $('fmDraft')) $('fmDraft').hidden = false;
      countText();
    } catch (e) { }
  }
  function countText() {
    var t = $('fmText');
    if (t && $('fmCount')) $('fmCount').textContent = (t.value || '').length + ' / 2000';
  }

  /* ---------------- 图片 ---------------- */
  function uploadOne(file) {
    return new Promise(function (res, rej) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) return rej(new Error('只收图片'));
      if (file.size > 4 * 1024 * 1024) return rej(new Error('图片超过 4MB'));
      var conf = A.conf ? A.conf() : {};
      if (!conf.endpoint || !conf.key) return rej(new Error('云端没配置'));
      var ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      var path = 'u/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + ext;
      fetch(conf.endpoint + '/storage/v1/object/xkimg/' + path, {
        method: 'POST',
        headers: { apikey: conf.key, Authorization: BEAR + conf.key, 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file
      }).then(function (r) {
        if (!r.ok) throw new Error('上传失败 ' + r.status);
        res(conf.endpoint + '/storage/v1/object/public/xkimg/' + path);
      }).catch(rej);
    });
  }
  function addFiles(files) {
    if (!files || !files.length) return;
    var arr = Array.prototype.slice.call(files).slice(0, 4 - S.imgs.length);
    if (!arr.length) { toast('最多 4 张图', 'err'); return; }
    arr.forEach(function (f) {
      var ph = 'blob-pending';
      S.imgs.push(ph);
      paintImgs();
      uploadOne(f).then(function (u) {
        S.imgs[S.imgs.indexOf(ph)] = u;
        paintImgs();
        toast('图片已上传', 'ok');
      }).catch(function (e) {
        var i = S.imgs.indexOf(ph);
        if (i >= 0) S.imgs.splice(i, 1);
        paintImgs();
        toast(e.message || '上传失败', 'err');
      });
    });
  }
  function paintImgs() {
    var box = $('fmImgs');
    if (!box) return;
    box.hidden = !S.imgs.length;
    box.innerHTML = S.imgs.map(function (u, i) {
      return '<span class="fm-ig-thumb' + (u === 'blob-pending' ? ' loading' : '') + '">' +
        (u === 'blob-pending' ? '<i>上传中…</i>' : '<img src="' + esc(u) + '" alt="">') +
        '<button type="button" class="fm-ig-x" data-imgi="' + i + '" aria-label="移除">×</button></span>';
    }).join('');
  }

  /* ---------------- 发布 ---------------- */
  function setReply(pid, name) {
    S.reply = pid; S.replyName = name || '';
    var box = $('fmReplyTo');
    if (box) {
      box.hidden = !pid;
      box.innerHTML = pid ? '回复 <b>' + esc(name || '') + '</b>　<button class="fm-x2" type="button" id="fmReplyX" aria-label="取消">×</button>' : '';
    }
    if ($('fmCancel')) $('fmCancel').hidden = !pid;
    if (pid && $('fmText')) { $('fmText').focus(); }
    if (pid && !/^\s*@/.test($('fmText').value)) { $('fmText').value = '@' + (name || '') + ' ' + $('fmText').value; countText(); }
  }

  function send() {
    var ta = $('fmText'), btn = $('fmSend'), o = $('fmOut');
    if (!ta) return;
    var body = (ta.value || '').trim();
    var imgs = S.imgs.filter(function (u) { return u !== 'blob-pending'; });
    if (!body && !imgs.length) { if (o) { o.className = 'out err'; o.textContent = '写点什么或加张图再发。'; } return; }
    btn.disabled = true;
    var payload = { body: body, title: $('fmTitle') ? $('fmTitle').value : '', cat: $('fmCat') ? $('fmCat').value : '综合', imgs: imgs };
    if (S.reply) payload.parent = S.reply;
    A.api('post', payload).then(function (r) {
      if (r.ok === false) throw r;
      ta.value = ''; if ($('fmTitle')) $('fmTitle').value = '';
      S.imgs = []; paintImgs(); countText();
      localStorage.removeItem(DRAFT_KEY);
      if ($('fmDraft')) $('fmDraft').hidden = true;
      if (o) { o.className = 'out ok'; o.textContent = '发布成功'; }
      toast('发布成功', 'ok');
      var pid = S.reply;
      setReply(0, '');
      loadStats(); loadBoards();
      if (pid) loadFeed(true).then(function () { openThread(pid, true); });
      else loadFeed(true);
    }).catch(function (e) {
      var m = e && e.err === 'banned' ? '你已被封禁，只能看不能发。'
        : e && e.err === 'bad_body' ? '内容长度要 1–2000 字。'
          : e && e.err === 'slow' ? '发得太快了，等半分钟。'
            : e && e.err === 'dup' ? '这句你刚发过。'
              : e && e.err === 'no_perm' ? '你的身份不能在这个板块发帖。'
                : e && e.err === 'maint' ? '站点维护中。'
                  : (e && (e.message || e.err)) || '发布失败';
      if (o) { o.className = 'out err'; o.textContent = m; }
    }).then(function () { btn.disabled = false; });
  }

  /* ---------------- 编辑 ---------------- */
  function startEdit(id) {
    var p = MAP[id] || null;
    if (!p) return;
    var host = document.querySelector('[data-body="' + id + '"]');
    if (!host) return;
    host.innerHTML = '<textarea class="input fm-ta" rows="4" maxlength="2000" id="ed-' + id + '">' + esc(p.body || '') + '</textarea>' +
      '<div class="row" style="margin-top:8px">' +
      '<button class="btn tiny primary" type="button" data-a="save" data-id="' + id + '">保存</button>' +
      '<button class="btn tiny ghost" type="button" data-a="cancel" data-id="' + id + '">取消</button>' +
      (p.parent == null ? '<input class="input tiny-in" id="edt-' + id + '" maxlength="80" placeholder="标题" value="' + esc(p.title || '') + '">' : '') +
      '</div>';
    var t = $('ed-' + id); if (t) t.focus();
  }

  /* ---------------- 举报 / 版务 ---------------- */
  function openReport(id) {
    S.repId = id;
    var m = $('fmRep');
    if (!m) return;
    m.hidden = false;
    if ($('fmRepWhy')) $('fmRepWhy').value = '';
    if ($('fmRepOut')) $('fmRepOut').textContent = '';
  }
  function openMod() {
    var m = $('fmMod');
    if (!m) return;
    m.hidden = false;
    var box = $('fmModList');
    box.innerHTML = '加载中…';
    A.api('report_list').then(function (r) {
      if (r.ok === false) throw r;
      var items = r.items || [];
      if (!items.length) { box.innerHTML = '<p class="hint">没有待处理的举报。干净。</p>'; return; }
      box.innerHTML = items.map(function (it) {
        return '<div class="fm-repline" data-rid="' + it.id + '">' +
          '<div class="fm-repmeta"><b>' + esc(it.by || it.by_user || '') + '</b> 举报 <b>' + esc(it.author) + '</b>' +
          '<span class="fm-ptime">' + ago(it.ts) + '</span></div>' +
          '<div class="fm-repbody">' + (it.title ? '<b>' + esc(it.title) + '</b> ' : '') + esc(it.body || '（已删）') + '</div>' +
          (it.reason ? '<div class="hint">理由：' + esc(it.reason) + '</div>' : '') +
          '<div class="row" style="margin-top:6px">' +
          '<button class="btn tiny warn" type="button" data-rep="del" data-rid="' + it.id + '">删帖</button>' +
          '<button class="btn tiny ghost" type="button" data-rep="ignore" data-rid="' + it.id + '">忽略</button>' +
          '<button class="btn tiny ghost" type="button" data-rep="go" data-pid="' + it.pid + '">看原帖</button>' +
          '</div></div>';
      }).join('');
    }).catch(function (e) {
      box.innerHTML = '<p class="out err">' + ((e && (e.message || e.err)) || '读不到举报队列') + '</p>';
    });
  }

  /* ---------------- @ 提及候选 ---------------- */
  function mentionBox() {
    var ta = $('fmText'), box = $('fmMention');
    if (!ta || !box) return;
    var val = ta.value, pos = ta.selectionStart;
    var before = val.slice(0, pos);
    var m = /@([A-Za-z0-9_\u4e00-\u9fa5.\-]{0,40})$/.exec(before);
    if (!m) { box.hidden = true; return; }
    var q = m[1].toLowerCase();
    var pool = [];
    (AUTHORS || []).forEach(function (n) { if (n && pool.indexOf(n) < 0) pool.push(n); });
    var me = A.myName(); if (me && pool.indexOf(me) < 0) pool.push(me);
    var cand = pool.filter(function (n) { return !q || n.toLowerCase().indexOf(q) === 0; }).slice(0, 6);
    if (!cand.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = cand.map(function (n) { return '<button type="button" data-at="' + esc(n) + '">@' + esc(n) + '</button>'; }).join('');
  }
  function insertAt(name) {
    var ta = $('fmText');
    if (!ta) return;
    var val = ta.value, pos = ta.selectionStart;
    var before = val.slice(0, pos).replace(/@[A-Za-z0-9_\u4e00-\u9fa5.\-]{0,40}$/, '@' + name + ' ');
    ta.value = before + val.slice(pos);
    ta.focus();
    var box = $('fmMention'); if (box) box.hidden = true;
    countText(); saveDraft();
  }

  /* ---------------- 事件 ---------------- */
  function onClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var imgx = t.closest('[data-imgi]');
    if (imgx) { S.imgs.splice(+imgx.getAttribute('data-imgi'), 1); paintImgs(); return; }
    var at = t.closest('[data-at]');
    if (at) { insertAt(at.getAttribute('data-at')); return; }
    var rep = t.closest('[data-rep]');
    if (rep) {
      var rid = rep.getAttribute('data-rid'), act = rep.getAttribute('data-rep');
      if (act === 'go') { $('fmMod').hidden = true; gotoPost(+rep.getAttribute('data-pid')); return; }
      A.api('report_act', { id: rid, act: act }).then(function (r) {
        if (r.ok === false) throw r;
        toast(act === 'del' ? '已删帖并处理' : '已忽略', 'ok');
        openMod(); loadStats(); loadFeed(true);
      }).catch(function (e) { toast((e && (e.message || e.err)) || '操作失败', 'err'); });
      return;
    }
    var noti = t.closest('[data-noti]');
    if (noti) {
      var pid = +noti.getAttribute('data-noti');
      var ntype = noti.getAttribute('data-t');
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      $('fmBellBox').hidden = true;
      var n = $('fmBellN'); if (n) { n.hidden = true; }
      gotoPost(pid, ntype === 'reply' || ntype === 'mention');
      return;
    }
    var el = t.closest('[data-a]');
    if (!el) return;
    var act = el.getAttribute('data-a'), id = el.getAttribute('data-id'), u = el.getAttribute('data-u');
    if (act === 'prof') { ev.preventDefault(); openProfile(u); return; }
    if (act === 'open') { openThread(id); return; }
    if (act === 'reply') { setReply(id, u); return; }
    if (act === 'share') { sharePost(id); return; }
    if (act === 'like') {
      A.api('like', { id: id }).then(function (r) {
        if (r.ok === false) throw r;
        var p = MAP[id]; if (p) { p.likes = r.likes; p.liked = r.liked; }
        var host = el.closest('.fm-acts');
        if (host && p) host.outerHTML = '<div class="fm-acts">' + actsFor(p) + '</div>';
      }).catch(function () { toast('操作失败', 'err'); });
      return;
    }
    if (act === 'fav') {
      A.api('fav', { id: id }).then(function (r) {
        if (r.ok === false) throw r;
        var p = MAP[id]; if (p) p.fav = r.fav;
        var host = el.closest('.fm-acts');
        if (host && p) host.outerHTML = '<div class="fm-acts">' + actsFor(p) + '</div>';
        toast(r.fav ? '已收藏' : '已取消收藏', 'ok');
        if (S.mine === 'fav') loadFeed(true);
      }).catch(function () { toast('操作失败', 'err'); });
      return;
    }
    if (act === 'report') { openReport(+id); return; }
    if (act === 'edit') { startEdit(id); return; }
    if (act === 'cancel') { loadFeed(true); return; }
    if (act === 'save') {
      var ta = $('ed-' + id), ti = $('edt-' + id);
      if (!ta) return;
      el.disabled = true;
      A.api('edit_post', { id: id, body: ta.value, title: ti ? ti.value : undefined }).then(function (r) {
        if (r.ok === false) throw r;
        toast('已保存', 'ok'); loadFeed(true);
      }).catch(function (e) { toast((e && (e.message || e.err)) || '保存失败', 'err'); el.disabled = false; });
      return;
    }
    if (act === 'pin' || act === 'feat' || act === 'lock') {
      var op = act === 'pin' ? 'pin_post' : act === 'feat' ? 'feature_post' : 'lock_post';
      var val = el.getAttribute('data-v') !== '1';
      A.api(op, { id: id, val: val }).then(function (r) {
        if (r.ok === false) throw r;
        toast(val ? '已标记' : '已取消', 'ok'); loadFeed(true);
      }).catch(function (e) { toast((e && (e.message || e.err)) || '操作失败', 'err'); });
      return;
    }
    if (act === 'del') {
      if (!window.confirm('删除这条？（连同它的回复）')) return;
      A.api('del_post', { id: id }).then(function (r) {
        if (r.ok === false) throw r;
        toast('已删除', 'ok'); loadFeed(true); loadStats();
      }).catch(function (e) { toast((e && (e.message || e.err)) || '删除失败', 'err'); });
      return;
    }
  }

  function sharePost(id) {
    var url = location.origin + location.pathname + '#p' + id;
    var done = function () { toast('链接已复制', 'ok'); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(function () { window.prompt('复制这个链接', url); });
    else window.prompt('复制这个链接', url);
  }

  function gotoPost(pid, expand) {
    S.cat = ''; S.q = ''; S.mine = ''; S.sort = 'new';
    if ($('fmQ')) $('fmQ').value = '';
    syncTools();
    return loadFeed(true).then(function () {
      var el = document.getElementById('p' + pid);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('fm-flash'); setTimeout(function () { el.classList.remove('fm-flash'); }, 1600); }
      var root = MAP[pid];
      if (root && root.parent) openThread(root.parent, true);
      else if (expand) openThread(pid, true);
    });
  }

  function syncTools() {
    Array.prototype.forEach.call(document.querySelectorAll('#fmSort .pill'), function (b) {
      var on = (!S.mine && (b.getAttribute('data-sort') || '') === S.sort) || (S.mine && b.getAttribute('data-mine') === S.mine);
      b.classList.toggle('active', !!on);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#fmCats .fm-chip'), function (b) {
      b.classList.toggle('on', (b.getAttribute('data-cat') || '') === S.cat);
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var u = A.user();
    var guest = $('fmGuest'), comp = $('fmCompose');
    if (!u) {
      if (guest) guest.hidden = false;
      if (comp) comp.hidden = true;
      if ($('fmZero')) { $('fmZero').hidden = false; $('fmZero').textContent = '登录后可以看到全部话题。'; }
      if ($('fmBell')) $('fmBell').hidden = true;
      return;
    }
    if (guest) guest.hidden = true;
    if (comp) comp.hidden = false;
    $('fmMyName').textContent = u.name;
    $('fmMyAva').textContent = (u.avatar || ini(u.name));
    $('fmMyTier').textContent = 'T' + A.tier(u);
    $('fmMyTier').className = 'acc-tier t' + A.tier(u);
    A.api('perm').then(function (r) {
      S.caps = r.caps || {}; S.admin = !!r.admin; S.mod = !!r.mod; S.role = r.role || 'user';
      var rb = $('fmMyRole');
      if (rb) {
        rb.hidden = S.role === 'user';
        rb.textContent = S.role === 'admin' ? '站长' : S.role === 'mod' ? '版主' : '会员';
        rb.className = 'badge ' + (S.role === 'admin' ? 'rose' : 'ice');
      }
      if (S.mod && $('fmModBtn')) $('fmModBtn').hidden = false;
      if (r.maint && !r.admin && $('fmMaint')) $('fmMaint').hidden = false;
    }).catch(function () { });

    loadStats(); loadBoards().then(function () { return loadFeed(true); }); loadNotifs(); loadDraft();

    $('fmSend').addEventListener('click', send);
    $('fmCancel').addEventListener('click', function () { setReply(0, ''); });
    $('fmRefresh').addEventListener('click', function () { loadStats(); loadBoards(); loadFeed(true); loadNotifs(); });
    $('fmMore').addEventListener('click', function () { loadFeed(false); });
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.id === 'fmReplyX') { setReply(0, ''); return; }
      var chip = t.closest('#fmCats .fm-chip');
      if (chip) { S.cat = chip.getAttribute('data-cat') || ''; syncTools(); loadFeed(true); return; }
      var pill = t.closest('#fmSort .pill');
      if (pill) {
        if (pill.getAttribute('data-mine')) { var v = pill.getAttribute('data-mine'); S.mine = S.mine === v ? '' : v; if (S.mine) S.sort = 'new'; }
        else { S.mine = ''; S.sort = pill.getAttribute('data-sort') || 'new'; }
        syncTools(); loadFeed(true); return;
      }
      if (t.closest('#fmImgs')) return;
      onClick(ev);
    });
    var ta = $('fmText');
    if (ta) {
      ta.addEventListener('input', function () { countText(); mentionBox(); saveDraft(); });
      ta.addEventListener('keyup', mentionBox);
      ta.addEventListener('click', mentionBox);
      ta.addEventListener('blur', function () { setTimeout(function () { var b = $('fmMention'); if (b) b.hidden = true; }, 180); });
      ta.addEventListener('paste', function (e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        var files = [];
        for (var i = 0; i < items.length; i++) if (items[i].kind === 'file') files.push(items[i].getAsFile());
        if (files.length) { e.preventDefault(); addFiles(files); }
      });
      ta.addEventListener('dragover', function (e) { e.preventDefault(); });
      ta.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); }
      });
    }
    if ($('fmTitle')) $('fmTitle').addEventListener('input', saveDraft);
    if ($('fmFile')) $('fmFile').addEventListener('change', function () { addFiles(this.files); this.value = ''; });
    var q = $('fmQ');
    if (q) {
      var timer = 0;
      q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { S.q = (q.value || '').trim(); loadFeed(true); }, 350); });
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timer); S.q = (q.value || '').trim(); loadFeed(true); } });
    }

    /* 通知铃 */
    if ($('fmBell')) $('fmBell').addEventListener('click', function (e) {
      e.stopPropagation();
      var b = $('fmBellBox');
      b.hidden = !b.hidden;
      if (!b.hidden) loadNotifs();
    });
    if ($('fmBellBox')) $('fmBellBox').setAttribute('data-wired', '1');
    if ($('fmModBtn')) $('fmModBtn').addEventListener('click', openMod);

    /* 举报弹窗 */
    if ($('fmRepX')) $('fmRepX').addEventListener('click', function () { $('fmRep').hidden = true; });
    if ($('fmRepGo')) $('fmRepGo').addEventListener('click', function () {
      var why = $('fmRepWhy') ? $('fmRepWhy').value : '';
      A.api('report', { id: S.repId, reason: why }).then(function (r) {
        if (r.ok === false) throw r;
        $('fmRepOut').className = 'out ok';
        $('fmRepOut').textContent = r.dup ? '已经举报过了，等处理。' : '收到，感谢。';
        setTimeout(function () { $('fmRep').hidden = true; }, 900);
      }).catch(function (e) {
        $('fmRepOut').className = 'out err';
        $('fmRepOut').textContent = (e && (e.message || e.err)) || '提交失败';
      });
    });

    /* 版务弹窗 */
    if ($('fmModX')) $('fmModX').addEventListener('click', function () { $('fmMod').hidden = true; });
    if ($('fmMod')) $('fmMod').addEventListener('click', function (e) { if (e.target === $('fmMod')) $('fmMod').hidden = true; });

    /* 名片 */
    if ($('fmModalX')) $('fmModalX').addEventListener('click', function () { $('fmModal').hidden = true; });
    if ($('fmModal')) $('fmModal').addEventListener('click', function (e) { if (e.target === $('fmModal')) $('fmModal').hidden = true; });
    if ($('fmModalMine')) $('fmModalMine').addEventListener('click', function () {
      $('fmModal').hidden = true;
      S.q = $('fmModalName').textContent;
      if ($('fmQ')) $('fmQ').value = S.q;
      loadFeed(true);
    });
    document.addEventListener('click', function (e) {
      var box = $('fmBellBox');
      if (box && !box.hidden && !e.target.closest('#fmBell') && !e.target.closest('#fmBellBox')) box.hidden = true;
    });
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      ['fmModal', 'fmRep', 'fmMod'].forEach(function (id) { var el = $(id); if (el) el.hidden = true; });
      var b = $('fmBellBox'); if (b) b.hidden = true;
    });
    syncTools();

    /* 深链 #p123 */
    if (/^#p\d+$/.test(location.hash)) {
      var pid = +location.hash.slice(2);
      setTimeout(function () { gotoPost(pid); }, 900);
    }
    window.addEventListener('hashchange', function () {
      if (/^#p\d+$/.test(location.hash)) gotoPost(+location.hash.slice(2));
    });

    /* 通知轮询：90 秒一次，页面可见才跑 */
    POLL = setInterval(function () {
      if (document.visibilityState === 'visible') { loadNotifs(); }
    }, 90000);
  }

  window.XKForum = {
    reload: function () { loadStats(); loadBoards(); loadFeed(true); loadNotifs(); },
    openThread: openThread, openProfile: openProfile, gotoPost: gotoPost, md: md
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

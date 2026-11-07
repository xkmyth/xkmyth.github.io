/* forum.js —— 论坛（板块 / 标题 / 精华 / 搜索 / 回复提醒 / 名片） */
(function () {
  'use strict';
  var A = window.XKAccount;
  var $ = function (id) { return document.getElementById(id); };
  var CATS = ['综合', '技术', '闲聊', '求助', '公告'];
  var S = { cat: '', sort: 'new', mine: '', q: '', before: 0, admin: false, reply: 0, replyName: '' };
  var list = [];
  var MAP = {};   // id -> 原始数据（feed 与楼中楼都进来，编辑要用它）
  var HAS = {};

  function toast(t, k) { if (window.xkmythUI && window.xkmythUI.toast) window.xkmythUI.toast(t, k); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function md(s) {
    var h = esc(s);
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    h = h.replace(/\n/g, '<br>');
    return h;
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
  function tierOf(p) { return p.tier || 1; }

  /* ---------------- 统计 ---------------- */
  function loadStats() {
    if (!A.myName()) return;
    A.api('stats').then(function (r) {
      if (r.ok === false) return;
      var box = $('fmStats');
      if (!box) return;
      var items = [
        ['账号', r.users], ['在线', r.online], ['主题', r.posts],
        ['回复', r.replies], ['点赞', r.likes], ['24 小时', r.today]
      ];
      box.innerHTML = items.map(function (it) {
        return '<span class="fm-stat"><b>' + (it[1] == null ? 0 : it[1]) + '</b>' + it[0] + '</span>';
      }).join('');
      var cats = r.cats || {};
      var chips = '<button class="fm-chip' + (S.cat === '' ? ' on' : '') + '" type="button" data-cat="">全部</button>' +
        CATS.map(function (c) {
          return '<button class="fm-chip' + (S.cat === c ? ' on' : '') + '" type="button" data-cat="' + c + '">' + c +
            (cats[c] ? '<em>' + cats[c] + '</em>' : '') + '</button>';
        }).join('');
      if ($('fmCats')) $('fmCats').innerHTML = chips;
    }).catch(function () { });
  }

  /* ---------------- 列表 ---------------- */
  function actsFor(p) {
    var mine = p.mine, adm = S.admin;
    var out = [];
    out.push('<button class="fm-act' + (p.liked ? ' on' : '') + '" type="button" data-a="like" data-id="' + p.id + '" aria-pressed="' + (p.liked ? 'true' : 'false') + '">♥ <b>' + (p.likes || 0) + '</b></button>');
    if (p.parent == null) {
      out.push('<button class="fm-act" type="button" data-a="open" data-id="' + p.id + '">💬 <b>' + (p.replies || 0) + '</b> 回复</button>');
      out.push('<span class="fm-views" title="浏览">👁 ' + (p.views || 0) + '</span>');
    }
    out.push('<button class="fm-act" type="button" data-a="reply" data-id="' + (p.parent || p.id) + '" data-u="' + esc(p.author) + '">回复 TA</button>');
    if (mine || adm) out.push('<button class="fm-act" type="button" data-a="edit" data-id="' + p.id + '">编辑</button>');
    if (adm && p.parent == null) {
      out.push('<button class="fm-act" type="button" data-a="pin" data-id="' + p.id + '" data-v="' + (p.pinned ? 1 : 0) + '">' + (p.pinned ? '取消置顶' : '置顶') + '</button>');
      out.push('<button class="fm-act" type="button" data-a="feat" data-id="' + p.id + '" data-v="' + (p.featured ? 1 : 0) + '">' + (p.featured ? '取消精华' : '加精') + '</button>');
    }
    if (mine || adm) out.push('<button class="fm-act warn" type="button" data-a="del" data-id="' + p.id + '">删除</button>');
    return out.join('');
  }

  function head(p) {
    return '<div class="fm-phead">' +
      '<span class="fm-ava t' + tierOf(p) + '" data-a="prof" data-u="' + esc(p.author) + '" role="button" tabindex="0">' + esc(p.avatar || ini(p.author)) + '</span>' +
      '<div class="fm-pmeta"><b data-a="prof" data-u="' + esc(p.author) + '">' + esc(p.author) + '</b>' +
      '<span class="acc-tier t' + tierOf(p) + '">T' + tierOf(p) + '</span>' +
      (p.author_admin ? ' <span class="badge rose">ADMIN</span>' : '') +
      (p.author_banned ? ' <span class="badge">封禁</span>' : '') +
      (p.pinned ? ' <span class="badge">置顶</span>' : '') +
      (p.featured ? ' <span class="badge gold">精华</span>' : '') +
      '<span class="fm-ptime">' + ago(p.ts) + (p.edited ? ' · 已编辑' : '') +
      (p.cat ? ' · <em class="fm-cat">' + esc(p.cat) + '</em>' : '') + '</span></div></div>';
  }

  function renderPost(p) {
    MAP[p.id] = p;
    var t = (p.title || '').trim();
    return '<article class="fm-post" data-id="' + p.id + '">' +
      head(p) +
      (t ? '<h3 class="fm-ptitle" data-a="open" data-id="' + p.id + '">' + esc(t) + '</h3>' : '') +
      '<div class="fm-body" data-body="' + p.id + '">' + md(p.body) + '</div>' +
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
        $('fmZero').textContent = S.q ? '没有搜到「' + S.q + '」。' : '这里还没有内容。做第一个吧。';
      }
      return;
    }
    if ($('fmZero')) $('fmZero').hidden = true;
    box.innerHTML = list.map(renderPost).join('');
  }

  function heading() {
    var h = $('fmHeading');
    if (!h) return;
    var name = S.sort === 'hot' ? '最热话题' : S.sort === 'best' ? '精华帖' : S.mine === '1' ? '我发的帖' : '最新话题';
    h.textContent = name + (S.cat ? ' · ' + S.cat : '') + (S.q ? ' · “' + S.q + '”' : '');
  }

  function loadFeed(reset) {
    if (!A.myName()) return Promise.resolve();
    if (reset) { S.before = 0; }
    return A.api('feed', {
      cat: S.cat, sort: S.sort, mine: S.mine, q: S.q, limit: 20, before: S.before
    }).then(function (r) {
      if (r.ok === false) throw r;
      S.admin = !!r.admin;
      var posts = r.posts || [];
      if (reset) list = posts; else list = list.concat(posts);
      if (posts.length) S.before = posts[posts.length - 1].id;
      if ($('fmMore')) $('fmMore').hidden = posts.length < 20;
      heading(); render();
    }).catch(function (e) {
      if ($('fmOut')) { $('fmOut').className = 'out err'; $('fmOut').textContent = (e && (e.message || e.err)) || '加载失败'; }
    });
  }

  /* ---------------- 回复 / 线 ---------------- */
  function openThread(id, force) {
    var box = $('kids-' + id);
    if (!box) return;
    if (!box.hidden && !force) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<p class="hint">正在加载回复…</p>';
    A.api('thread', { id: id }).then(function (r) {
      if (r.ok === false) throw r;
      var posts = (r.posts || []).filter(function (p) { return p.parent != null; });
      if (!posts.length) { box.innerHTML = '<p class="hint">还没有回复。</p>'; return; }
      box.innerHTML = posts.map(function (p) {
        MAP[p.id] = p;
        return '<div class="fm-kid" data-id="' + p.id + '">' + head(p) +
          '<div class="fm-body" data-body="' + p.id + '">' + md(p.body) + '</div>' +
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
    if ($('fmModalName')) $('fmModalName').textContent = name;
    if ($('fmModalBio')) $('fmModalBio').textContent = '正在读取…';
    A.api('profile', { target: name }).then(function (r) {
      if (r.ok === false) throw r;
      var u = r.u || {};
      if ($('fmModalAva')) { $('fmModalAva').textContent = u.avatar || ini(u.user); $('fmModalAva').className = 'fm-ava big t' + (u.tier || 1); }
      if ($('fmModalName')) $('fmModalName').textContent = u.user || name;
      if ($('fmModalTier')) { $('fmModalTier').textContent = 'T' + (u.tier || 1); $('fmModalTier').className = 'acc-tier t' + (u.tier || 1); }
      if ($('fmModalAdmin')) $('fmModalAdmin').hidden = !u.admin;
      if ($('fmModalBan')) $('fmModalBan').hidden = !u.banned;
      if ($('fmModalBio')) $('fmModalBio').textContent = u.bio || '这个人很安静，什么也没写。';
      if ($('fmModalJoin')) $('fmModalJoin').textContent = u.joined || '—';
      if ($('fmModalDays')) $('fmModalDays').textContent = (u.days || 0) + ' 天';
      if ($('fmModalPosts')) $('fmModalPosts').textContent = (u.posts || 0) + ' / ' + (u.replies || 0);
      if ($('fmModalLikes')) $('fmModalLikes').textContent = u.likes_got == null ? '—' : u.likes_got;
      if ($('fmModalLast')) $('fmModalLast').textContent = u.last || '—';
      if ($('fmModalOut')) $('fmModalOut').textContent = '';
      if ($('fmModalMine')) { $('fmModalMine').hidden = !(u.posts > 0); $('fmModalMine').setAttribute('data-u', u.user || name); }
    }).catch(function (e) {
      var msg = (e && e.err === 'private') ? '对方的名片是私密的。' : ((e && (e.message || e.err)) || '读不到名片');
      if ($('fmModalBio')) $('fmModalBio').textContent = '';
      if ($('fmModalOut')) { $('fmModalOut').className = 'out err'; $('fmModalOut').textContent = msg; }
    });
  }

  /* ---------------- 通知 ---------------- */
  function loadNotifs() {
    if (!A.myName()) return;
    A.api('notifs').then(function (r) {
      if (r.ok === false) return;
      var bar = $('fmNotif');
      if (!bar) return;
      var items = r.items || [];
      if (!items.length) { bar.hidden = true; return; }
      var seen = +(localStorage.getItem('xkmyth-fm-seen') || 0);
      var fresh = items.filter(function (i) { return new Date(i.ts).getTime() > seen; }).length;
      bar.hidden = false;
      bar.innerHTML = '<span class="fm-notif-dot" aria-hidden="true">' + (fresh || items.length) + '</span>' +
        '<span>' + (fresh ? '有 <b>' + fresh + '</b> 条新回复在你的帖子里' : '最近有 ' + items.length + ' 条回复在你的帖子里') +
        '　<em>' + esc(items[0].author) + '：' + esc(items[0].body) + '</em></span>' +
        '<button class="btn tiny ghost" type="button" id="fmNotifGo">去看看</button>';
      var go = $('fmNotifGo');
      if (go) go.addEventListener('click', function () {
        localStorage.setItem('xkmyth-fm-seen', String(Date.now()));
        bar.hidden = true;
        var first = items[0];
        S.cat = ''; S.q = ''; S.mine = ''; S.sort = 'new';
        syncTools();
        loadFeed(true).then(function () { openThread(first.pid, true); });
      });
    }).catch(function () { });
  }

  function syncTools() {
    Array.prototype.forEach.call(document.querySelectorAll('#fmSort .pill'), function (b) {
      var on = (b.getAttribute('data-sort') || '') === S.sort && !S.mine
        || (b.getAttribute('data-mine') === '1' && S.mine === '1');
      b.classList.toggle('active', !!on);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#fmCats .fm-chip'), function (b) {
      b.classList.toggle('on', (b.getAttribute('data-cat') || '') === S.cat);
    });
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
    if (pid && $('fmText')) $('fmText').focus();
  }

  function send() {
    var ta = $('fmText'), btn = $('fmSend'), out = $('fmOut');
    var body = (ta.value || '').trim();
    if (!body) { if (out) { out.className = 'out err'; out.textContent = '写点什么再发。'; } return; }
    btn.disabled = true;
    var payload = { body: body, title: ($('fmTitle') ? $('fmTitle').value : ''), cat: ($('fmCat') ? $('fmCat').value : '综合') };
    if (S.reply) payload.parent = S.reply;
    A.api('post', payload).then(function (r) {
      if (r.ok === false) throw r;
      ta.value = ''; if ($('fmTitle')) $('fmTitle').value = '';
      if ($('fmCount')) $('fmCount').textContent = '0 / 2000';
      if (out) { out.className = 'out ok'; out.textContent = '发布成功'; }
      toast('发布成功', 'ok');
      var pid = S.reply;
      setReply(0, '');
      loadStats();
      if (pid) {
        if (S.cat && list.filter(function (p) { return p.id === pid; }).length === 0) { S.cat = ''; syncTools(); }
        loadFeed(true).then(function () { openThread(pid, true); });
      } else {
        loadFeed(true);
      }
    }).catch(function (e) {
      var m = e && e.err === 'banned' ? '你已被封禁，只能看不能发。' : e && e.err === 'bad_body' ? '内容长度要 1–2000 字。' : ((e && (e.message || e.err)) || '发布失败');
      if (out) { out.className = 'out err'; out.textContent = m; }
    }).then(function () { btn.disabled = false; });
  }

  /* ---------------- 编辑 ---------------- */
  function startEdit(id) {
    var p = MAP[id] || null;
    if (!p) list.forEach(function (x) { if (String(x.id) === String(id)) p = x; });
    if (!p) p = { id: id, body: '', title: '' };
    var host = document.querySelector('[data-body="' + id + '"]');
    if (!host) return;
    host.innerHTML = '<textarea class="input fm-ta" rows="4" maxlength="2000" id="ed-' + id + '">' + esc(p.body) + '</textarea>' +
      '<div class="row" style="margin-top:8px"><button class="btn tiny primary" type="button" data-a="save" data-id="' + id + '">保存</button>' +
      '<button class="btn tiny ghost" type="button" data-a="cancel" data-id="' + id + '">取消</button>' +
      (p.parent == null && S.admin ? '<input class="input tiny-in" id="edt-' + id + '" maxlength="80" placeholder="标题" value="' + esc(p.title || '') + '">' : '') +
      '</div>';
    var t = $('ed-' + id); if (t) t.focus();
  }

  /* ---------------- 事件 ---------------- */
  function onClick(ev) {
    var el = ev.target.closest ? ev.target.closest('[data-a]') : null;
    if (!el) return;
    var act = el.getAttribute('data-a'), id = el.getAttribute('data-id'), u = el.getAttribute('data-u');
    if (act === 'prof') { ev.preventDefault(); openProfile(u); return; }
    if (act === 'open') { openThread(id); return; }
    if (act === 'reply') { setReply(id, u); return; }
    if (act === 'like') {
      A.api('like', { id: id }).then(function (r) {
        if (r.ok === false) throw r;
        var p = null; list.forEach(function (x) { if (String(x.id) === String(id)) p = x; });
        if (p) { p.likes = r.likes; p.liked = r.liked; }
        var host = el.closest('.fm-acts') || el.parentNode;
        if (host) host.outerHTML = '<div class="fm-acts">' + actsFor(p || { id: id, likes: r.likes, liked: r.liked, mine: true }) + '</div>';
      }).catch(function () { toast('操作失败', 'err'); });
      return;
    }
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
    if (act === 'pin' || act === 'feat') {
      var op = act === 'pin' ? 'pin_post' : 'feature_post';
      var val = el.getAttribute('data-v') !== '1';
      A.api(op, { id: id, val: val }).then(function (r) {
        if (r.ok === false) throw r; toast(val ? '已标记' : '已取消', 'ok'); loadFeed(true);
      }).catch(function (e) { toast((e && e.err === 'not_admin') ? '只有站长能这么做' : '操作失败', 'err'); });
      return;
    }
    if (act === 'del') {
      if (!window.confirm('删除这条？（站长恢复不了）')) return;
      A.api('del_post', { id: id }).then(function (r) {
        if (r.ok === false) throw r; toast('已删除', 'ok'); loadFeed(true); loadStats();
      }).catch(function () { toast('删除失败', 'err'); });
      return;
    }
  }

  function boot() {
    var u = A.user();
    var guest = $('fmGuest'), comp = $('fmCompose');
    if (!u) {
      if (guest) guest.hidden = false;
      if (comp) comp.hidden = true;
      if ($('fmZero')) { $('fmZero').hidden = false; $('fmZero').textContent = '登录后可以看到全部话题。'; }
      return;
    }
    if (guest) guest.hidden = true;
    if (comp) comp.hidden = false;
    if ($('fmMyName')) $('fmMyName').textContent = u.name;
    if ($('fmMyAva')) $('fmMyAva').textContent = (u.avatar || ini(u.name));
    if ($('fmMyTier')) { $('fmMyTier').textContent = 'T' + A.tier(u); $('fmMyTier').className = 'acc-tier t' + A.tier(u); }
    loadStats(); loadFeed(true); loadNotifs();

    if ($('fmSend')) $('fmSend').addEventListener('click', send);
    if ($('fmCancel')) $('fmCancel').addEventListener('click', function () { setReply(0, ''); });
    if ($('fmRefresh')) $('fmRefresh').addEventListener('click', function () { loadStats(); loadFeed(true); loadNotifs(); });
    if ($('fmMore')) $('fmMore').addEventListener('click', function () { loadFeed(false); });
    if ($('fmList')) $('fmList').addEventListener('click', onClick);
    if ($('fmText')) $('fmText').addEventListener('input', function () {
      if ($('fmCount')) $('fmCount').textContent = ($('fmText').value || '').length + ' / 2000';
    });
    if ($('fmText')) $('fmText').addEventListener('click', function () {
      var x = $('fmReplyX'); if (x) x.onclick = function () { setReply(0, ''); };
    });
    document.addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'fmReplyX') setReply(0, '');
      var chip = ev.target.closest ? ev.target.closest('#fmCats .fm-chip') : null;
      if (chip) { S.cat = chip.getAttribute('data-cat') || ''; syncTools(); loadFeed(true); }
      var pill = ev.target.closest ? ev.target.closest('#fmSort .pill') : null;
      if (pill) {
        if (pill.getAttribute('data-mine') === '1') { S.mine = S.mine === '1' ? '' : '1'; if (S.mine) S.sort = 'new'; }
        else { S.mine = ''; S.sort = pill.getAttribute('data-sort') || 'new'; }
        syncTools(); loadFeed(true);
      }
    });
    var q = $('fmQ');
    if (q) {
      var t = 0;
      q.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { S.q = (q.value || '').trim(); loadFeed(true); }, 350);
      });
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { clearTimeout(t); S.q = (q.value || '').trim(); loadFeed(true); }
      });
    }
    if ($('fmModalX')) $('fmModalX').addEventListener('click', function () { $('fmModal').hidden = true; });
    if ($('fmModal')) $('fmModal').addEventListener('click', function (e) { if (e.target === $('fmModal')) $('fmModal').hidden = true; });
    if ($('fmModalMine')) $('fmModalMine').addEventListener('click', function () {
      $('fmModal').hidden = true;
      S.q = $('fmModalName').textContent; if ($('fmQ')) $('fmQ').value = S.q;
      loadFeed(true);
    });
    syncTools();
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('fmModal') && !$('fmModal').hidden) $('fmModal').hidden = true; });
  }

  HAS.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.XKForum = { reload: function () { loadFeed(true); loadStats(); }, openThread: openThread, openProfile: openProfile };
})();

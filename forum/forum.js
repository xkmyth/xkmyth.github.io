/* forum.js —— 论坛前端（依赖 account.js 的 XKAccount.api） */
(function () {
  'use strict';
  var A = window.XKAccount;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ava(t) { return t ? String(t).slice(0, 2) : '星'; }
  function ago(ts) {
    var d = new Date(ts), s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 2592000) return Math.floor(s / 86400) + ' 天前';
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  var E = {
    auth: '云端校验失败，重新登录一下', no_user: '云端没有这个账号', not_admin: '只有站长能这么干',
    banned: '你的账号被封禁了', bad_body: '内容要 1–2000 字', private: '对方的名片是私密的',
    bad_param: '参数不对', net: '网络不通，稍后再试'
  };
  function em(e) { return E[e && e.err] || (e && e.message) || '出错了'; }
  function out(t, k) { var el = $('fmOut'); if (!el) return; el.className = 'out' + (k ? ' ' + k : ''); el.textContent = t || ''; }
  function toast(t, k) { if (window.xkmythUI && window.xkmythUI.toast) window.xkmythUI.toast(t, k); }

  var me = '', isAdmin = false, tier = 0, avatar = '';
  var posts = [], before = 0, replyTo = null;

  function canMod(p) { return isAdmin || p.mine; }

  function item(p) {
    var acts = '<button class="btn tiny ghost" data-a="like" data-id="' + p.id + '">' + (p.liked ? '♥' : '♡') + ' ' + p.likes + '</button>' +
      '<button class="btn tiny ghost" data-a="reply" data-id="' + p.id + '" data-name="' + esc(p.author) + '">回复' + (p.replies ? ' ' + p.replies : '') + '</button>';
    if (canMod(p)) acts += '<button class="btn tiny ghost" data-a="del" data-id="' + p.id + '">删除</button>';
    if (isAdmin) acts += '<button class="btn tiny ghost" data-a="pin" data-id="' + p.id + '" data-val="' + (p.pinned ? '0' : '1') + '">' + (p.pinned ? '取消置顶' : '置顶') + '</button>';
    return '<article class="fm-post' + (p.pinned ? ' pinned' : '') + '" data-id="' + p.id + '">' +
      '<header class="fm-head">' +
      '<span class="fm-ava" data-a="prof" data-name="' + esc(p.author) + '">' + esc(ava(p.avatar)) + '</span>' +
      '<div class="fm-meta"><b data-a="prof" data-name="' + esc(p.author) + '">' + esc(p.author) + '</b>' +
      (p.author_admin ? ' <span class="badge rose">ADMIN</span>' : '') +
      (p.tier ? ' <span class="acc-tier">T' + p.tier + '</span>' : '') +
      (p.pinned ? ' <span class="badge">置顶</span>' : '') +
      '<span class="fm-time">' + ago(p.ts) + '</span></div></header>' +
      '<div class="fm-body">' + esc(p.body).replace(/\n/g, '<br>') + '</div>' +
      '<footer class="fm-acts">' + acts + '</footer></article>';
  }

  function render(list) {
    var box = $('fmList');
    if (!box) return;
    box.innerHTML = (list || []).map(item).join('');
    if ($('fmZero')) $('fmZero').hidden = (list || []).length > 0;
  }

  function load(reset) {
    if (!me) return;
    if (reset) { posts = []; before = 0; }
    var extra = before ? { before: before } : {};
    A.api('feed', extra).then(function (r) {
      if (r.ok === false) throw r;
      var got = r.posts || [];
      posts = posts.concat(got);
      if (got.length) before = got[got.length - 1].id;
      render(posts);
      if ($('fmMore')) $('fmMore').hidden = got.length < 20;
    }).catch(function (e) { out(em(e), 'err'); });
  }

  function showThread(id) {
    A.api('thread', { id: id }).then(function (r) {
      if (r.ok === false) throw r;
      var all = r.posts || [], root = null, kids = [];
      all.forEach(function (p) { if (p.id === id) root = p; else kids.push(p); });
      render(posts);
      var box = $('fmList');
      var html = root ? item(root) : '';
      html += kids.map(function (p) { return '<div class="fm-kid">' + item(p) + '</div>'; }).join('');
      html += '<button class="btn ghost tiny" type="button" data-a="back">← 回到全部</button>';
      box.innerHTML = html;
      $('fmZero').hidden = true;
    }).catch(function (e) { out(em(e), 'err'); });
  }

  function bind() {
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-a]');
      if (!t) return;
      var a = t.getAttribute('data-a'), id = parseInt(t.getAttribute('data-id'), 10) || 0;
      if (a === 'like') {
        A.api('like', { id: id }).then(function (r) {
          if (r.ok === false) throw r;
          var p = posts.filter(function (x) { return x.id === id; })[0];
          if (p) { p.likes = r.likes; p.liked = r.liked; render(posts); }
        }).catch(function (e) { out(em(e), 'err'); });
      } else if (a === 'reply') {
        replyTo = { id: id, name: t.getAttribute('data-name') };
        $('fmReplyTo').hidden = false;
        $('fmReplyTo').textContent = '正在回复 @' + replyTo.name;
        $('fmCancel').hidden = false;
        $('fmText').focus();
        window.scrollTo({ top: $('fmCompose').offsetTop - 80, behavior: 'smooth' });
      } else if (a === 'del') {
        if (!window.confirm('删掉这条？')) return;
        A.api('del_post', { id: id }).then(function (r) {
          if (r.ok === false) throw r;
          posts = posts.filter(function (p) { return p.id !== id; });
          render(posts); toast('已删除', 'ok');
        }).catch(function (e) { out(em(e), 'err'); });
      } else if (a === 'pin') {
        A.api('pin_post', { id: id, val: t.getAttribute('data-val') === '1' }).then(function (r) {
          if (r.ok === false) throw r;
          load(true);
        }).catch(function (e) { out(em(e), 'err'); });
      } else if (a === 'prof') {
        openProfile(t.getAttribute('data-name'));
      } else if (a === 'back') {
        render(posts);
      }
    });

    var ta = $('fmText');
    if (ta) ta.addEventListener('input', function () { $('fmCount').textContent = ta.value.length + ' / 2000'; });
    var send = $('fmSend');
    if (send) send.addEventListener('click', function () {
      var body = ($('fmText').value || '').trim();
      if (!body) { out('写点东西再发', 'err'); return; }
      send.disabled = true;
      var extra = { body: body };
      if (replyTo) extra.parent = replyTo.id;
      A.api('post', extra).then(function (r) {
        if (r.ok === false) throw r;
        $('fmText').value = ''; $('fmCount').textContent = '0 / 2000';
        replyTo = null; $('fmReplyTo').hidden = true; $('fmCancel').hidden = true;
        out('');
        toast('发布成功', 'ok');
        if (extra.parent) showThread(extra.parent); else load(true);
      }).catch(function (e) { out(em(e), 'err'); }).then(function () { send.disabled = false; });
    });
    var cancel = $('fmCancel');
    if (cancel) cancel.addEventListener('click', function () {
      replyTo = null; $('fmReplyTo').hidden = true; cancel.hidden = true;
    });
    var more = $('fmMore');
    if (more) more.addEventListener('click', function () { load(false); });
    var rf = $('fmRefresh');
    if (rf) rf.addEventListener('click', function () { load(true); });
    var mx = $('fmModalX');
    if (mx) mx.addEventListener('click', function () { $('fmModal').hidden = true; });
    var mo = $('fmModal');
    if (mo) mo.addEventListener('click', function (e) { if (e.target === mo) mo.hidden = true; });
  }

  function openProfile(name) {
    var m = $('fmModal');
    if (!m) return;
    m.hidden = false;
    $('fmModalName').textContent = name;
    $('fmModalBio').textContent = '';
    $('fmModalOut').textContent = '';
    A.api('profile', { target: name }).then(function (r) {
      if (r.ok === false) throw r;
      var u = r.u || {};
      $('fmModalAva').textContent = ava(u.avatar);
      $('fmModalName').textContent = u.user + (u.banned ? '（已封禁）' : '');
      $('fmModalTier').textContent = u.tier ? 'T' + u.tier : 'T1';
      $('fmModalAdmin').hidden = !u.admin;
      $('fmModalBio').textContent = u.bio || '这个人很懒，什么都没写。';
      $('fmModalJoin').textContent = u.joined || '—';
      $('fmModalDays').textContent = u.days == null ? '—' : u.days + ' 天';
      $('fmModalPosts').textContent = u.posts == null ? '—' : u.posts;
      $('fmModalLast').textContent = u.last || '—';
    }).catch(function (e) { $('fmModalOut').textContent = em(e); });
  }

  function boot() {
    if (!A) { out('账号模块没加载出来', 'err'); return; }
    me = A.myName();
    if (!me) {
      $('fmGuest').hidden = false;
      return;
    }
    $('fmCompose').hidden = false;
    A.api('get').then(function (r) {
      tier = r.tier || 0; isAdmin = !!r.admin;
      avatar = ((r.profile || {}).avatar) || '';
      $('fmMyAva').textContent = ava(avatar);
      $('fmMyName').textContent = me;
      $('fmMyTier').textContent = 'T' + (tier || 1);
      if (isAdmin) $('fmMyTier').insertAdjacentHTML('afterend', ' <span class="badge rose">ADMIN</span>');
      load(true);
    }).catch(function (e) { out(em(e), 'err'); });
    bind();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

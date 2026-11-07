/* account-plus.js —— 资料 / 邮箱 / 改密码 / 忘记密码 / 站长工具（依赖 account.js 的 XKAccount.api） */
(function () {
  'use strict';
  var A = window.XKAccount;
  if (!A) return;
  function $(id) { return document.getElementById(id); }
  function set(el, txt, cls) { if (!el) return; el.className = 'out' + (cls ? ' ' + cls : ''); el.textContent = txt || ''; }
  function ok(el, t) { set(el, t, 'ok'); }
  function bad(el, t) { set(el, t, 'err'); }
  function toast(t, k) { if (window.xkmythUI && window.xkmythUI.toast) window.xkmythUI.toast(t, k); else console.log(t); }
  function fmt(ts) {
    if (!ts) return '';
    var d = new Date(ts), n = Date.now(), s = (n - d.getTime()) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 2592000) return Math.floor(s / 86400) + ' 天前';
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  var ERR = {
    auth: '云端校验失败，请重新登录', no_user: '云端没有这个账号', not_admin: '你不是站长',
    bad_param: '参数不对', bad_body: '内容长度不对（1–2000 字）', banned: '你的账号已被封禁', self: '不能对站长自己动手',
    bad_email: '邮箱格式不对', bad_code: '验证码不对', code_expired: '验证码过期了，重新发一次',
    no_mail: '这个邮箱没有绑定过本站账号', private: '对方的名片是私密的', name: '邮箱对应的账号和用户名不一致'
  };
  function emsg(e) { return ERR[e && e.err] || (e && (e.message || e.err)) || '出错了'; }

  /* ---------------- 资料 ---------------- */
  function loadProfile() {
    if (!A.myName()) return;
    A.api('get').then(function (r) {
      var p = r.profile || {};
      if ($('pfAva')) $('pfAva').value = p.avatar || '';
      if ($('pfBio')) $('pfBio').value = p.bio || '';
      if ($('pfPub')) $('pfPub').checked = p.pub !== false;
      if ($('emCur')) $('emCur').textContent = p.email ? (p.email + (p.email_ok ? ' ✓' : '（未验证）')) : '未绑定';
      if ($('emHint')) $('emHint').textContent = p.email_ok ? '邮箱已验证，可以用它找回密码。' : '验证过邮箱才能用它找回密码。';
    }).catch(function () { });
  }
  function bindProfile() {
    var sv = $('pfSave');
    if (sv) sv.addEventListener('click', function () {
      sv.disabled = true;
      A.api('set_profile', { bio: $('pfBio').value, avatar: $('pfAva').value, pub: $('pfPub').checked })
        .then(function (r) { if (r.ok === false) throw r; ok($('pfOut'), '名片已保存'); toast('名片已更新', 'ok'); })
        .catch(function (e) { bad($('pfOut'), emsg(e)); })
        .then(function () { sv.disabled = false; });
    });
    var es = $('emSend');
    if (es) es.addEventListener('click', function () {
      var mail = ($('emAddr').value || '').trim();
      if (!mail) { bad($('emHint'), '先填邮箱'); return; }
      es.disabled = true;
      A.api('set_email', { email: mail }).then(function (r) {
        if (r.ok === false) throw r;
        if (r.sent) ok($('emHint'), '验证码已发到 ' + mail + '，10 分钟内有效');
        else if (r.manual) { ok($('emHint'), '邮件通道还没开通，验证码：' + r.code + '（自己填进去点验证）'); $('emCode').value = r.code || ''; }
        else ok($('emHint'), '验证码已生成');
      }).catch(function (e) { bad($('emHint'), emsg(e)); }).then(function () { es.disabled = false; });
    });
    var eo = $('emOk');
    if (eo) eo.addEventListener('click', function () {
      A.api('email_verify', { code: ($('emCode').value || '').trim() }).then(function (r) {
        if (r.ok === false) throw r;
        ok($('emHint'), '邮箱验证通过 ✓'); loadProfile(); toast('邮箱已验证', 'ok');
      }).catch(function (e) { bad($('emHint'), emsg(e)); });
    });
    var pg = $('pwGo');
    if (pg) pg.addEventListener('click', function () {
      var o = $('pwOld').value, n = $('pwNew').value;
      if (n.length < 8) { bad($('pwOut'), '新密码至少 8 位'); return; }
      pg.disabled = true;
      A.changePass(o, n).then(function () {
        ok($('pwOut'), '密码已改，所有设备都用新密码登录');
        $('pwOld').value = ''; $('pwNew').value = '';
        toast('密码已修改', 'ok');
      }).catch(function (e) { bad($('pwOut'), e.message || '改密码失败'); }).then(function () { pg.disabled = false; });
    });
  }

  /* ---------------- 忘记密码 ---------------- */
  function bindForgot() {
    var send = $('fgSend');
    if (send) send.addEventListener('click', function () {
      var mail = ($('fgMail').value || '').trim();
      if (!mail) { bad($('fgOut'), '先填邮箱'); return; }
      send.disabled = true;
      A.apiRaw({ op: 'reset_request', user: 'guest', auth: new Array(65).join('f'), email: mail }).then(function (r) {
        if (r.ok === false) throw r;
        if (r.sent) ok($('fgOut'), '验证码已发到 ' + mail);
        else if (r.manual) { ok($('fgOut'), '邮件通道没开通，验证码：' + r.code); $('fgCode').value = r.code || ''; }
      }).catch(function (e) { bad($('fgOut'), emsg(e)); }).then(function () { send.disabled = false; });
    });
    var go = $('fgGo');
    if (go) go.addEventListener('click', function () {
      var mail = ($('fgMail').value || '').trim()
        , code = ($('fgCode').value || '').trim()
        , nm = ($('fgName') ? $('fgName').value : '').trim()
        , np = $('fgPass').value;
      if (!mail || !code || !np) { bad($('fgOut'), '邮箱、验证码、新密码都要填'); return; }
      if (np.length < 8) { bad($('fgOut'), '新密码至少 8 位'); return; }
      go.disabled = true;
      var name = nm;
      (name ? Promise.resolve(name) : Promise.reject(new Error('要填用户名'))).then(function (n) {
        return A.syncAuthOf(n, np).then(function (na) {
          return A.apiRaw({ op: 'reset_commit', user: n, auth: new Array(65).join('f'), email: mail, code: code, newauth: na });
        });
      }).then(function (r) {
        if (r.ok === false) throw r;
        return A.adoptPass(r.user, np).then(function () {
          ok($('fgOut'), '密码已重置，现在用新密码登录即可');
          toast('密码已重置', 'ok');
        });
      }).catch(function (e) { bad($('fgOut'), emsg(e)); }).then(function () { go.disabled = false; });
    });
  }

  /* ---------------- 站长工具 ---------------- */
  var TIERS = ['自动', 'T1 新星', 'T2 常客', 'T3 熟客', 'T4 资深', 'T5 元老'];
  function loadAdmin() {
    var box = $('adminTools');
    if (!box) return;
    A.api('admin_list').then(function (r) {
      if (r.ok === false) { box.innerHTML = '<p class="hint">' + emsg(r) + '</p>'; return; }
      var me = A.myName();
      var rows = (r.users || []).map(function (u) {
        var mine = (u.user === me);
        return '<tr data-u="' + u.user + '"' + (mine ? ' data-mine="1"' : '') + '>' +
          '<td><b>' + u.user + '</b>' + (u.admin ? ' <span class="badge rose">ADMIN</span>' : '') +
          (u.banned ? ' <span class="badge">封禁</span>' : '') + '<br><span class="hint">' + (u.email || '无邮箱') + (u.email_ok ? ' ✓' : '') + '</span></td>' +
          '<td>' + u.posts + '</td><td>' + (u.last || '') + '</td>' +
          '<td><select class="input tiny-in" data-a="tier">' + TIERS.map(function (t, i) {
            return '<option value="' + i + '"' + (i === (u.tier || 0) ? ' selected' : '') + '>' + t + '</option>';
          }).join('') + '</select></td>' +
          '<td class="acc-acts2">' +
          (mine ? '<span class="hint">这是你</span>' :
            '<button class="btn tiny ghost" data-a="ban">' + (u.banned ? '解封' : '封禁') + '</button>' +
            '<button class="btn tiny ghost" data-a="role">' + (u.admin ? '取消管理' : '设为管理') + '</button>') +
          '<button class="btn tiny ghost" data-a="reset">重置密码</button>' +
          '<button class="btn tiny ghost" data-a="note">备注</button>' +
          (mine ? '' : '<button class="btn tiny ghost" data-a="del">删除</button>') +
          '</td></tr>';
      }).join('');
      box.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>账号</th><th>帖子</th><th>活跃</th><th>等级</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="out" id="admToolOut" role="status"></p>';
      var out = $('adminOut2') || $('admToolOut');
      box.querySelectorAll('tbody tr').forEach(function (tr) {
        var u = tr.getAttribute('data-u');
        tr.querySelectorAll('[data-a]').forEach(function (el) {
          var act = el.getAttribute('data-a');
          if (act === 'tier') el.addEventListener('change', function () {
            A.api('admin_tier', { target: u, val: parseInt(el.value, 10) || 0 })
              .then(function (r) { if (r.ok === false) throw r; ok(out, u + ' 等级已设为 ' + TIERS[parseInt(el.value, 10) || 0]); })
              .catch(function (e) { bad(out, emsg(e)); });
          });
          else if (act === 'ban') el.addEventListener('click', function () {
            var val = el.textContent.indexOf('解封') < 0;
            A.api('admin_ban', { target: u, val: val }).then(function (r) {
              if (r.ok === false) throw r; ok(out, u + (val ? ' 已封禁' : ' 已解封')); loadAdmin();
            }).catch(function (e) { bad(out, emsg(e)); });
          });
          else if (act === 'role') el.addEventListener('click', function () {
            var val = el.textContent.indexOf('取消') < 0;
            A.api('admin_role', { target: u, val: val }).then(function (r) {
              if (r.ok === false) throw r; ok(out, u + (val ? ' 已设为管理员' : ' 已取消管理员')); loadAdmin();
            }).catch(function (e) { bad(out, emsg(e)); });
          });
          else if (act === 'reset') el.addEventListener('click', function () {
            var np = window.prompt('给 ' + u + ' 设置一个临时密码（至少 8 位）：', '');
            if (!np) return;
            if (np.length < 8) { bad(out, '临时密码至少 8 位'); return; }
            A.syncAuthOf(u, np).then(function (na) {
              return A.api('admin_set_auth', { target: u, auth2: na });
            }).then(function (r) {
              if (r.ok === false) throw r;
              ok(out, u + ' 的密码已重置为临时密码，让他登录后自己改');
            }).catch(function (e) { bad(out, emsg(e)); });
          });
          else if (act === 'note') el.addEventListener('click', function () {
            var nv = window.prompt('给 ' + u + ' 写个备注（只有站长看得到）：', '');
            if (nv === null) return;
            A.api('admin_note', { target: u, val: nv }).then(function (r) {
              if (r.ok === false) throw r; ok(out, '备注已保存');
            }).catch(function (e) { bad(out, emsg(e)); });
          });
          else if (act === 'del') el.addEventListener('click', function () {
            if (!window.confirm('确定删除 ' + u + '？帖子、点赞、历史都会一起没。')) return;
            A.api('admin_del', { target: u }).then(function (r) {
              if (r.ok === false) throw r; ok(out, u + ' 已删除'); loadAdmin();
            }).catch(function (e) { bad(out, emsg(e)); });
          });
        });
      });
    }).catch(function (e) { box.innerHTML = '<p class="hint">' + emsg(e) + '</p>'; });

    var pg = $('adminPurge');
    if (pg && !pg._b) pg._b = (pg.addEventListener('click', function () {
      if (!window.confirm('清空论坛全部帖子？（软删除，库里还留着）')) return;
      A.api('admin_purge').then(function (r) {
        if (r.ok === false) throw r; ok($('adminOut2'), '论坛已清空'); toast('论坛已清空', 'ok');
      }).catch(function (e) { bad($('adminOut2'), emsg(e)); });
    }), 1);

    var conf = $('adminConf');
    if (conf && !conf._b) {
      conf._b = 1;
      conf.innerHTML = '<h4 style="margin:0 0 8px">邮件通道（可选，用来发验证码 / 找回密码）</h4>' +
        '<p class="hint">免费方案：resend.com 注册后拿 API key（每月 3000 封），填进来就能真发信。</p>' +
        '<div class="field"><label for="cfKey">Resend API key</label><input class="input" id="cfKey" placeholder="re_…"></div>' +
        '<div class="field"><label for="cfFrom">发件人</label><input class="input" id="cfFrom" placeholder="xkmyth &lt;noreply@yourdomain&gt;"></div>' +
        '<div class="row"><button class="btn tiny soft" type="button" id="cfSave">保存配置</button>' +
        '<input class="input tiny-in" id="cfTest" placeholder="测试收件邮箱"><button class="btn tiny ghost" type="button" id="cfGo">发测试信</button></div>' +
        '<div class="kvline"><span>当前配置</span><span id="cfNow">—</span></div>';
      var loadConf = function () {
        A.api('admin_config_get').then(function (r) {
          var c = r.conf || {};
          if ($('cfNow')) $('cfNow').textContent = (c.resend_key ? 'key ' + c.resend_key : '未配置') + (c.mail_from ? ' · ' + c.mail_from : '');
          if (c.mail_from && !$('cfFrom').value) $('cfFrom').value = c.mail_from;
        }).catch(function () { });
      };
      loadConf();
      $('cfSave').addEventListener('click', function () {
        var k = ($('cfKey').value || '').trim(), f = ($('cfFrom').value || '').trim();
        var jobs = [];
        if (k) jobs.push(A.api('admin_config', { k: 'resend_key', v: k }));
        if (f) jobs.push(A.api('admin_config', { k: 'mail_from', v: f }));
        Promise.all(jobs).then(function () { ok($('adminOut2'), '邮件配置已保存'); loadConf(); })
          .catch(function (e) { bad($('adminOut2'), emsg(e)); });
      });
      $('cfGo').addEventListener('click', function () {
        A.api('admin_mail_test', { email: ($('cfTest').value || '').trim() }).then(function (r) {
          ok($('adminOut2'), r.sent ? '测试信已提交发送' : '发送失败：配置不全或 API key 不对');
        }).catch(function (e) { bad($('adminOut2'), emsg(e)); });
      });
    }
  }

  /* ---------------- 挂载 ---------------- */
  function hook() {
    bindProfile(); bindForgot();
    var tabs = document.querySelectorAll('#accTabs .pill');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab');
        if (t === 'profile') loadProfile();
        if (t === 'admin') loadAdmin();
      });
    });
    if (!document.getElementById('accGuest').hidden === false) { /* noop */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
  window.XKAccountPlus = { reload: function () { loadProfile(); loadAdmin(); }, fmt: fmt };
})();

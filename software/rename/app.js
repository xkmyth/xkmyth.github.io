/* XK Rename —— 批量重命名（本地计算 + 预览） */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var result = [];

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }

  function names() {
    return ($('rInput').value || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function splitExt(name) {
    var m = name.match(/^(.*?)(\.[A-Za-z0-9]{1,8})$/);
    if (!m) return { base: name, ext: '' };
    return { base: m[1], ext: m[2] };
  }

  function compute() {
    var list = names();
    var find = $('rFind').value || '';
    var rep = $('rRep').value || '';
    var useRe = $('rRe').checked;
    var icase = $('rCase').checked;
    var prefix = $('rPrefix').value || '';
    var suffix = $('rSuffix').value || '';
    var forceExt = ($('rExt').value || '').trim().replace(/^\./, '');
    var numMode = $('rNumMode').value;
    var start = parseInt($('rNumStart').value, 10) || 1;
    var step = parseInt($('rNumStep').value, 10) || 1;
    var pad = Math.max(1, Math.min(8, parseInt($('rNumPad').value, 10) || 2));
    var space = $('rSpace').value;

    var re = null;
    if (find) {
      try {
        re = useRe ? new RegExp(find, icase ? 'gi' : 'g')
                   : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), icase ? 'gi' : 'g');
      } catch (e) { re = null; }
    }

    result = list.map(function (name, i) {
      var parts = splitExt(name);
      var base = parts.base, ext = forceExt ? ('.' + forceExt) : parts.ext;
      if (re) base = base.replace(re, rep);
      if (space !== 'keep') {
        var sp = space === 'dash' ? '-' : (space === 'under' ? '_' : '');
        base = base.replace(/\s+/g, sp);
      }
      var num = String(start + i * step);
      while (num.length < pad) num = '0' + num;
      if (numMode === 'prefix') base = num + '_' + base;
      if (numMode === 'suffix') base = base + '_' + num;
      base = prefix + base + suffix;
      base = base.replace(/[\\/:*?"<>|]/g, '_');
      return { old: name, new: base + ext };
    });
    return result;
  }

  function paint() {
    var rows = compute();
    var tb = $('rRows');
    tb.innerHTML = '';
    rows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      var n = document.createElement('td'); n.textContent = String(i + 1);
      var o = document.createElement('td'); o.className = 'old'; o.textContent = r.old;
      var w = document.createElement('td'); w.className = 'new'; w.textContent = r.new;
      tr.appendChild(n); tr.appendChild(o); tr.appendChild(w);
      tb.appendChild(tr);
    });
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="3" style="color:var(--dim);text-align:center;padding:20px">还没有文件，先在左侧粘贴或选择</td></tr>';
    }
    $('rCount').textContent = String(rows.length);
    $('rPreviewHint').textContent = rows.length ? (rows.length + ' 条预览') : '规则改动后自动更新';
    return rows;
  }

  function init() {
    var ids = ['rFind', 'rRep', 'rPrefix', 'rSuffix', 'rExt', 'rNumStart', 'rNumStep', 'rNumPad', 'rInput'];
    ids.forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', paint);
    });
    ['rRe', 'rCase', 'rNumMode', 'rSpace'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', paint);
    });
    $('rRun').addEventListener('click', function () { paint(); toast('已重新计算', 'ok'); });
    $('rCopy').addEventListener('click', function () {
      var rows = compute();
      if (!rows.length) { toast('没有可复制的结果', 'bad'); return; }
      var text = rows.map(function (r) { return r.old + ' -> ' + r.new; }).join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('已复制 ' + rows.length + ' 行', 'ok'); },
          function () { toast('复制失败', 'bad'); });
      }
    });
    $('rDl').addEventListener('click', function () {
      var rows = compute();
      if (!rows.length) { toast('没有结果', 'bad'); return; }
      var sh = '#!/usr/bin/env bash\n# 由 XK Rename 生成：请在目标目录执行，跑之前自己再看一遍\nset -e\n\n';
      rows.forEach(function (r) {
        if (r.old === r.new) return;
        sh += 'mv -- "' + r.old.replace(/"/g, '\\"') + '" "' + r.new.replace(/"/g, '\\"') + '"\n';
      });
      var blob = new Blob([sh], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'xk-rename.sh';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      toast('已下载脚本', 'ok');
    });
    $('rPick').addEventListener('change', function (e) {
      var files = e.target.files || [];
      if (!files.length) return;
      var list = Array.prototype.map.call(files, function (f) { return f.name; });
      $('rInput').value = list.join('\n');
      $('rPickHint').textContent = '已读取 ' + files.length + ' 个文件名';
      paint();
      e.target.value = '';
    });
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

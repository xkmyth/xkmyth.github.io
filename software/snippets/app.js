/* XK Snippets —— 本地代码片段库 */
(function () {
  'use strict';
  var KEY = 'xk-snips-v1';
  var $ = function (id) { return document.getElementById(id); };
  var snips = [];

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function load() {
    try { snips = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { snips = []; }
    if (!Array.isArray(snips)) snips = [];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(snips)); }
    catch (e) { toast('保存失败：存储已满', 'bad'); }
  }
  function stamp() { return new Date().toLocaleString(); }

  function render() {
    var q = ($('sSearch').value || '').toLowerCase().trim();
    var langFilter = $('sFilter').value;
    var list = $('sList');
    list.innerHTML = '';
    var langs = {};
    snips.forEach(function (s) { if (s.lang) langs[s.lang] = 1; });
    var sel = $('sFilter');
    var cur = sel.value;
    sel.innerHTML = '<option value="">全部语言</option>';
    Object.keys(langs).sort().forEach(function (l) {
      var o = document.createElement('option');
      o.value = l; o.textContent = l;
      sel.appendChild(o);
    });
    sel.value = cur;

    var tags = {};
    snips.forEach(function (s) { (s.tags || '').split(/[,，\s]+/).filter(Boolean).forEach(function (t) { tags[t] = 1; }); });
    $('sCount').textContent = String(snips.length);
    $('sTagCount').textContent = String(Object.keys(tags).length);

    var shown = 0;
    snips.forEach(function (s, idx) {
      var hay = (s.title + ' ' + s.tags + ' ' + s.code + ' ' + s.lang).toLowerCase();
      if (q && hay.indexOf(q) === -1) return;
      if (langFilter && s.lang !== langFilter) return;
      shown++;

      var item = document.createElement('div');
      item.className = 'snip-item';

      var head = document.createElement('div');
      head.className = 'snip-head';
      var b = document.createElement('b'); b.textContent = s.title || '(无标题)';
      var lang = document.createElement('span'); lang.className = 'lang'; lang.textContent = s.lang || 'text';
      var spacer = document.createElement('span'); spacer.className = 'spacer';
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button'; copyBtn.className = 'tiny-btn'; copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', function () {
        var done = function () { toast('已复制「' + (s.title || '') + '」', 'ok'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s.code).then(done, done);
        else done();
      });
      var delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'tiny-btn danger'; delBtn.textContent = '删除';
      delBtn.addEventListener('click', function () {
        if (!confirm('删除「' + (s.title || '') + '」？')) return;
        var real = snips.indexOf(s);
        if (real > -1) snips.splice(real, 1);
        persist(); render(); toast('已删除');
      });
      head.appendChild(b); head.appendChild(lang); head.appendChild(spacer);
      head.appendChild(copyBtn); head.appendChild(delBtn);

      var pre = document.createElement('pre');
      pre.className = 'snip-code';
      pre.textContent = s.code || '';

      item.appendChild(head); item.appendChild(pre);
      list.appendChild(item);
    });
    if (!shown) {
      var d = document.createElement('div');
      d.className = 'empty-hint';
      d.textContent = snips.length ? '没有匹配的片段' : '还没有片段。左侧填标题和代码保存第一条。';
      list.appendChild(d);
    }
  }

  function add() {
    var title = ($('sTitle').value || '').trim();
    var code = $('sCode').value || '';
    if (!title || !code.trim()) { toast('标题和代码都要填', 'bad'); return; }
    snips.unshift({
      title: title,
      lang: ($('sLang').value || 'text').trim(),
      tags: ($('sTags').value || '').trim(),
      code: code,
      updated: stamp()
    });
    persist();
    $('sTitle').value = ''; $('sCode').value = ''; $('sTags').value = '';
    render();
    toast('已保存', 'ok');
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function init() {
    load();
    render();
    $('sAdd').addEventListener('click', add);
    $('sSearch').addEventListener('input', render);
    $('sFilter').addEventListener('change', render);
    $('sExport').addEventListener('click', function () {
      download('xk-snippets.json', JSON.stringify(snips, null, 2));
      toast('已导出', 'ok');
    });
    $('sImport').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var data = JSON.parse(String(fr.result));
          if (!Array.isArray(data)) throw new Error('bad');
          data.forEach(function (d) {
            if (d && d.title && d.code) snips.push({ title: d.title, lang: d.lang || 'text', tags: d.tags || '', code: d.code, updated: d.updated || stamp() });
          });
          persist(); render(); toast('已导入 ' + data.length + ' 条', 'ok');
        } catch (err) { toast('不是有效的片段 JSON', 'bad'); }
      };
      fr.readAsText(f);
      e.target.value = '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

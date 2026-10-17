/* XK Notes —— 本地 Markdown 笔记 */
(function () {
  'use strict';
  var KEY = 'xk-notes-v1';
  var $ = function (id) { return document.getElementById(id); };
  var notes = [], cur = 0, saveTimer = null, dirty = false;

  function load() {
    try { notes = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { notes = []; }
    if (!Array.isArray(notes)) notes = [];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(notes)); return true; }
    catch (e) { toast('保存失败：浏览器存储已满', 'bad'); return false; }
  }
  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function nowText() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* --- 极简 Markdown 渲染（先转义，再处理块级，最后行内） --- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  function md(src) {
    var lines = esc(src).split(/\r?\n/), out = [], inList = false, inCode = false, buf = [];
    function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (/^```/.test(ln)) {
        if (inCode) { out.push('<pre>' + buf.join('\n') + '</pre>'); buf = []; inCode = false; }
        else { closeList(); inCode = true; }
        continue;
      }
      if (inCode) { buf.push(ln); continue; }
      if (/^\s*$/.test(ln)) { closeList(); continue; }
      var h = ln.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeList(); var lv = h[1].length; out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); continue; }
      if (/^\s*[-*+]\s+/.test(ln)) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + inline(ln.replace(/^\s*[-*+]\s+/, '')) + '</li>');
        continue;
      }
      if (/^&gt;\s?/.test(ln)) { closeList(); out.push('<blockquote class="quote">' + inline(ln.replace(/^&gt;\s?/, '')) + '</blockquote>'); continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(ln)) { closeList(); out.push('<hr>'); continue; }
      closeList();
      out.push('<p>' + inline(ln) + '</p>');
    }
    if (inCode && buf.length) out.push('<pre>' + buf.join('\n') + '</pre>');
    closeList();
    return out.join('\n');
  }

  function renderList() {
    var q = ($('nSearch').value || '').toLowerCase().trim();
    var list = $('nList');
    list.innerHTML = '';
    var shown = 0;
    notes.forEach(function (n, idx) {
      var hay = (n.title + ' ' + n.body).toLowerCase();
      if (q && hay.indexOf(q) === -1) return;
      shown++;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'note-item' + (idx === cur ? ' active' : '');
      var t = document.createElement('span');
      t.textContent = n.title || '(无标题)';
      var s = document.createElement('small');
      s.textContent = (n.updated || '') + ' · ' + (n.body || '').replace(/\s+/g, ' ').slice(0, 26);
      b.appendChild(t); b.appendChild(s);
      b.addEventListener('click', function () { open(idx); });
      list.appendChild(b);
    });
    if (!shown) {
      var d = document.createElement('div');
      d.className = 'empty-hint';
      d.textContent = q ? '没有匹配的笔记' : '还没有笔记，点左侧「新建笔记」';
      list.appendChild(d);
    }
    $('nCount').textContent = notes.length + ' 篇';
  }

  function open(idx) {
    cur = idx;
    var n = notes[idx] || { title: '', body: '', updated: '' };
    $('nTitle').value = n.title || '';
    $('nBody').value = n.body || '';
    $('nHint').textContent = n.updated ? ('上次保存 ' + n.updated) : '改动后 1.2 秒自动保存';
    $('nPreview').hidden = true;
    renderList();
  }

  function save(silent) {
    if (!notes[cur]) return;
    notes[cur].title = $('nTitle').value.trim() || '(无标题)';
    notes[cur].body = $('nBody').value;
    notes[cur].updated = nowText();
    if (persist()) {
      dirty = false;
      $('nHint').textContent = '已保存 ' + notes[cur].updated;
      if (!silent) toast('已保存', 'ok');
      renderList();
    }
  }

  function scheduleSave() {
    dirty = true;
    $('nHint').textContent = '正在输入…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { save(true); }, 1200);
  }

  function add() {
    save(true);
    notes.unshift({ title: '新笔记', body: '', updated: nowText() });
    cur = 0;
    persist();
    open(0);
    $('nTitle').focus();
    $('nTitle').select();
  }

  function del() {
    if (!notes[cur]) return;
    if (!confirm('删除「' + (notes[cur].title || '') + '」？')) return;
    notes.splice(cur, 1);
    persist();
    cur = 0;
    if (notes.length) open(0);
    else { $('nTitle').value = ''; $('nBody').value = ''; renderList(); }
    toast('已删除');
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function safeName(s) { return String(s || 'note').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40); }

  function init() {
    load();
    if (!notes.length) notes.push({ title: '欢迎使用 XK Notes', body: '# 你好\n\n这是一份**本地**笔记，数据只存在这个浏览器里。\n\n- 左边列表切换、搜索\n- 右侧编辑，1.2 秒自动保存\n- 支持 `代码`、> 引用、- 列表、[链接](https://xkmyth.github.io/)\n\n```\n代码块也会高亮保留原文\n```', updated: nowText() });
    open(0);
    $('nNew').addEventListener('click', add);
    $('nDel').addEventListener('click', del);
    $('nBody').addEventListener('input', scheduleSave);
    $('nTitle').addEventListener('input', scheduleSave);
    $('nSearch').addEventListener('input', renderList);
    $('nSaveBtn').addEventListener('click', function () { save(false); });
    $('nPreviewBtn').addEventListener('click', function () {
      var p = $('nPreview');
      if (p.hidden) { p.innerHTML = md($('nBody').value); p.hidden = false; this.textContent = '收起预览'; }
      else { p.hidden = true; this.textContent = '预览'; }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(false); }
    });
    window.addEventListener('beforeunload', function () { if (dirty) save(true); });
    $('nExport').addEventListener('click', function () {
      if (!notes[cur]) return;
      download(safeName(notes[cur].title) + '.md', notes[cur].body || '');
      toast('已导出 .md', 'ok');
    });
    $('nExportAll').addEventListener('click', function () {
      var all = notes.map(function (n) { return '# ' + (n.title || '') + '\n\n' + (n.body || ''); }).join('\n\n---\n\n');
      download('xk-notes-' + new Date().toISOString().slice(0, 10) + '.md', all);
      toast('已导出全部笔记', 'ok');
    });
    $('nImport').addEventListener('change', function (e) {
      var files = e.target.files || [];
      var pending = files.length;
      if (!pending) return;
      Array.prototype.forEach.call(files, function (f) {
        var fr = new FileReader();
        fr.onload = function () {
          notes.unshift({ title: f.name.replace(/\.(md|markdown|txt)$/i, ''), body: String(fr.result), updated: nowText() });
          if (--pending === 0) { persist(); open(0); toast('已导入 ' + files.length + ' 篇', 'ok'); }
        };
        fr.readAsText(f);
      });
      e.target.value = '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

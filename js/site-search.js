/* 站内搜索：读 /search-index.json，本地打分排序。无后端、无依赖。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var input = $('siteSearch');
  var list = $('siteSearchList');
  var countEl = $('siteSearchCount');
  var empty = $('siteSearchEmpty');
  if (!input || !list) return;

  var items = [];
  var ready = false;

  function score(item, q) {
    var t = (item.title || '').toLowerCase();
    var u = (item.url || '').toLowerCase();
    var k = (item.kw || '').toLowerCase();
    var s = 0;
    if (t === q) s += 100;
    else if (t.indexOf(q) === 0) s += 80;
    else if (t.indexOf(q) > -1) s += 60;
    if (k.indexOf(q) > -1) s += 40;
    if (u.indexOf(q) > -1) s += 30;
    if (!s && subseq(t, q)) s += 12;
    return s;
  }

  function subseq(text, q) {
    var i = 0, j = 0;
    while (i < text.length && j < q.length) {
      if (text[i] === q[j]) j++;
      i++;
    }
    return j === q.length;
  }

  function render(q) {
    list.innerHTML = '';
    q = (q || '').trim().toLowerCase();
    if (!q) {
      countEl.textContent = ready ? (items.length + ' 条索引') : '读取索引…';
      empty.hidden = true;
      return;
    }
    var hits = [];
    items.forEach(function (it) {
      var s = score(it, q);
      if (s > 0) hits.push({ s: s, it: it });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    hits = hits.slice(0, 40);
    countEl.textContent = hits.length + ' 条结果';
    empty.hidden = hits.length !== 0;

    hits.forEach(function (h, i) {
      var a = document.createElement('a');
      a.className = 'list-item search-hit';
      a.href = h.it.url;
      if (i === 0) a.setAttribute('data-first', '1');

      var left = document.createElement('div');
      left.style.minWidth = '0';
      var title = document.createElement('b');
      title.textContent = h.it.title;
      var path = document.createElement('small');
      path.style.display = 'block';
      path.style.color = 'var(--dim)';
      path.style.fontSize = '11.5px';
      path.textContent = h.it.url + (h.it.kind ? ' · ' + h.it.kind : '');
      left.appendChild(title);
      left.appendChild(path);

      var right = document.createElement('span');
      right.className = 'site-go';
      right.textContent = '打开 →';

      a.appendChild(left);
      a.appendChild(right);
      list.appendChild(a);
    });
  }

  function load() {
    fetch('/search-index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        items = (data && data.items) || [];
        ready = true;
        render(input.value);
      })
      .catch(function () {
        /* 退化：扫描当前页面链接 */
        items = [];
        var links = document.querySelectorAll('main a[href^="/"]');
        Array.prototype.forEach.call(links, function (a) {
          var t = (a.textContent || '').trim();
          if (!t || t.length > 40) return;
          items.push({ title: t, url: a.getAttribute('href'), kind: 'link' });
        });
        ready = true;
        countEl.textContent = items.length + ' 条（退化模式）';
        render(input.value);
      });
  }

  input.addEventListener('input', function () { render(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var first = list.querySelector('a[data-first="1"]');
      if (first) window.location.href = first.getAttribute('href');
    }
    if (e.key === 'Escape') { input.value = ''; render(''); }
  });

  load();
  input.focus();
})();

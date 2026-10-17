/* XK Ledger —— 本地记账本 */
(function () {
  'use strict';
  var KEY = 'xk-ledger-v1';
  var $ = function (id) { return document.getElementById(id); };
  var rows = [];

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function today() {
    var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function load() {
    try { rows = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { rows = []; }
    if (!Array.isArray(rows)) rows = [];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); }
    catch (e) { toast('保存失败：存储已满', 'bad'); }
  }

  function filtered() {
    var q = ($('lSearch').value || '').toLowerCase().trim();
    var range = $('lRange').value;
    var now = new Date();
    var monthPrefix = today().slice(0, 7);
    var cut = Date.now() - 30 * 864e5;
    return rows.filter(function (r) {
      if (q && (String(r.cat) + ' ' + String(r.note || '')).toLowerCase().indexOf(q) === -1) return false;
      if (range === 'month' && String(r.date || '').slice(0, 7) !== monthPrefix) return false;
      if (range === '30') {
        var t = Date.parse(r.date || '');
        if (!isNaN(t) && t < cut) return false;
      }
      return true;
    }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || (b.ts || 0) - (a.ts || 0); });
  }

  function render() {
    var all = rows, list = filtered();
    var income = 0, expense = 0, dayOut = 0, t = today();
    all.forEach(function (r) {
      var amt = Number(r.amt) || 0;
      if (r.type === 'in') income += amt; else { expense += amt; if (r.date === t) dayOut += amt; }
    });
    $('sIn').textContent = money(income);
    $('sOut').textContent = money(expense);
    $('sBal').textContent = money(income - expense);
    $('sDay').textContent = money(dayOut);
    $('lCount').textContent = all.length + ' 条';
    $('lMonth').textContent = money(all.filter(function (r) {
      return r.type !== 'in' && String(r.date).slice(0, 7) === t.slice(0, 7);
    }).reduce(function (a, r) { return a + (Number(r.amt) || 0); }, 0));
    $('lFilterHint').textContent = list.length + ' 条显示';

    /* 分类柱状 */
    var byCat = {};
    list.forEach(function (r) {
      if (r.type === 'in') return;
      byCat[r.cat || '其他'] = (byCat[r.cat || '其他'] || 0) + (Number(r.amt) || 0);
    });
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).slice(0, 8);
    var maxV = cats.length ? byCat[cats[0]] : 0;
    var bars = $('lBars');
    bars.innerHTML = '';
    if (!cats.length) {
      bars.innerHTML = '<div class="empty-hint">这段时间没有支出记录</div>';
    }
    cats.forEach(function (c) {
      var line = document.createElement('div');
      line.className = 'bar-line';
      var label = document.createElement('span'); label.className = 't'; label.textContent = c;
      var b = document.createElement('span'); b.className = 'b';
      var i = document.createElement('i');
      i.style.width = (maxV > 0 ? Math.max(3, Math.round(byCat[c] / maxV * 100)) : 0) + '%';
      b.appendChild(i);
      var v = document.createElement('span'); v.className = 'v'; v.textContent = money(byCat[c]);
      line.appendChild(label); line.appendChild(b); line.appendChild(v);
      bars.appendChild(line);
    });

    /* 流水 */
    var box = $('lRows');
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<div class="empty-hint">还没有记录。左侧填一笔试试。</div>';
    }
    list.slice(0, 200).forEach(function (r, idx) {
      var row = document.createElement('div');
      row.className = 'ledger-row';
      var d = document.createElement('span'); d.className = 'd'; d.textContent = r.date || '';
      var c = document.createElement('span'); c.className = 'c'; c.textContent = r.cat || '其他';
      if (r.note) { var sm = document.createElement('small'); sm.textContent = r.note; c.appendChild(sm); }
      var a = document.createElement('span');
      a.className = 'a ' + (r.type === 'in' ? 'plus' : 'minus');
      a.textContent = (r.type === 'in' ? '+' : '−') + money(Number(r.amt) || 0);
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'tiny-btn danger'; x.textContent = '×';
      x.title = '删除这条';
      x.addEventListener('click', function () {
        var real = rows.indexOf(r);
        if (real === -1) return;
        rows.splice(real, 1);
        persist(); render(); toast('已删除');
      });
      row.appendChild(d); row.appendChild(c); row.appendChild(a); row.appendChild(x);
      box.appendChild(row);
    });
  }

  function add() {
    var amt = parseFloat($('lAmt').value);
    if (!(amt > 0)) { toast('金额要大于 0', 'bad'); $('lAmt').focus(); return; }
    var rec = {
      date: $('lDate').value || today(),
      type: $('lType').value,
      cat: ($('lCat').value || '其他').trim(),
      amt: Math.round(amt * 100) / 100,
      note: ($('lNote').value || '').trim(),
      ts: Date.now()
    };
    rows.push(rec);
    persist();
    $('lAmt').value = ''; $('lNote').value = '';
    render();
    toast('已记 ' + (rec.type === 'in' ? '收入 ' : '支出 ') + money(rec.amt), 'ok');
  }

  function csv() {
    if (!rows.length) { toast('账本为空', 'bad'); return; }
    var head = '日期,类型,分类,金额,备注\n';
    var body = rows.map(function (r) {
      var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
      return [q(r.date), q(r.type === 'in' ? '收入' : '支出'), q(r.cat), q(money(Number(r.amt) || 0)), q(r.note)].join(',');
    }).join('\n');
    var blob = new Blob(['\ufeff' + head + body], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'xk-ledger-' + today() + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('已导出 CSV', 'ok');
  }

  function init() {
    load();
    var d = $('lDate');
    if (d) d.value = today();
    $('lAdd').addEventListener('click', add);
    $('lAmt').addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    $('lSearch').addEventListener('input', render);
    $('lRange').addEventListener('change', render);
    $('lCsv').addEventListener('click', csv);
    $('lWipe').addEventListener('click', function () {
      if (!confirm('清空全部账本记录？无法恢复。')) return;
      rows = []; localStorage.removeItem(KEY); render(); toast('已清空');
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

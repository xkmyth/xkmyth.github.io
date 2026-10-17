/* XK Focus —— 番茄钟 + 白噪音 + 任务清单 */
(function () {
  'use strict';
  var TASK_KEY = 'xk-focus-tasks-v1';
  var STAT_KEY = 'xk-focus-stat-v1';
  var $ = function (id) { return document.getElementById(id); };

  var total = 25 * 60, left = total, ticking = false, timer = null;
  var completedToday = 0, minutesToday = 0;
  var tasks = [];
  var ac = null, noiseSrc = null, gain = null;

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function paint() {
    var m = Math.floor(left / 60), s = left % 60;
    $('fClock').textContent = pad(m) + ':' + pad(s);
    var ring = $('fRing');
    var C = 2 * Math.PI * 96;
    ring.setAttribute('stroke-dasharray', C.toFixed(1));
    ring.setAttribute('stroke-dashoffset', (C * (1 - left / total)).toFixed(1));
    document.title = (ticking ? '▶ ' : '') + pad(m) + ':' + pad(s) + ' · XK Focus';
  }

  function loadStat() {
    try {
      var s = JSON.parse(localStorage.getItem(STAT_KEY) || '{}');
      if (s.day === todayKey()) { completedToday = s.done || 0; minutesToday = s.min || 0; }
    } catch (e) {}
    paintStat();
  }
  function paintStat() {
    $('fDone').textContent = String(completedToday);
    $('fMin').textContent = String(minutesToday);
  }
  function saveStat() {
    try { localStorage.setItem(STAT_KEY, JSON.stringify({ day: todayKey(), done: completedToday, min: minutesToday })); } catch (e) {}
    paintStat();
  }

  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var c = new Ctx();
      [0, 0.28, 0.56].forEach(function (t) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.22);
        o.connect(g); g.connect(c.destination);
        o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.26);
      });
      setTimeout(function () { try { c.close(); } catch (e) {} }, 1400);
    } catch (e) {}
  }

  function start() {
    if (ticking) return;
    ticking = true;
    startNoise();
    timer = setInterval(function () {
      left -= 1;
      if (left <= 0) { finish(); return; }
      paint();
    }, 1000);
    paint();
    $('fHint').textContent = '专注中…别碰手机，一轮只有 ' + Math.round(total / 60) + ' 分钟。';
  }
  function pause() {
    if (!ticking) return;
    ticking = false;
    clearInterval(timer);
    timer = null;
    stopNoise();
    paint();
    $('fHint').textContent = '已暂停，按「开始」或空格继续。';
  }
  function reset() {
    pause();
    left = total;
    paint();
    $('fHint').textContent = '按空格开始 / 暂停，Esc 重置。';
  }
  function finish() {
    clearInterval(timer); timer = null; ticking = false;
    var wasFocus = total >= 15 * 60;
    left = 0; paint();
    beep();
    stopNoise();
    if (wasFocus) {
      completedToday += 1;
      minutesToday += Math.round(total / 60);
      saveStat();
      toast('完成一轮专注 · 已累计 ' + minutesToday + ' 分钟', 'ok');
    } else {
      toast('休息结束，回到工作吧', 'ok');
    }
    setTimeout(function () { left = total; paint(); }, 1800);
  }

  /* ---- 白噪音（WebAudio 实时合成） ---- */
  function startNoise() {
    var kind = $('fNoise').value;
    if (kind === 'none' || noiseSrc) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!ac) ac = new Ctx();
      if (ac.state === 'suspended') ac.resume();
      var len = ac.sampleRate * 2;
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var data = buf.getChannelData(0);
      var last = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; data[i] = last * 3.2; }
        else data[i] = w;
      }
      noiseSrc = ac.createBufferSource();
      noiseSrc.buffer = buf;
      noiseSrc.loop = true;
      var filt = ac.createBiquadFilter();
      filt.type = kind === 'rain' ? 'bandpass' : 'lowpass';
      filt.frequency.value = kind === 'rain' ? 1400 : (kind === 'brown' ? 700 : 4200);
      filt.Q.value = kind === 'rain' ? 0.7 : 0.4;
      gain = ac.createGain();
      gain.gain.value = parseFloat($('fVol').value) * 0.5;
      noiseSrc.connect(filt); filt.connect(gain); gain.connect(ac.destination);
      noiseSrc.start();
    } catch (e) { noiseSrc = null; }
  }
  function stopNoise() {
    if (noiseSrc) { try { noiseSrc.stop(); } catch (e) {} }
    noiseSrc = null;
    if (gain) { try { gain.disconnect(); } catch (e) {} gain = null; }
  }

  /* ---- 任务 ---- */
  function loadTasks() {
    try { tasks = JSON.parse(localStorage.getItem(TASK_KEY) || '[]') || []; } catch (e) { tasks = []; }
    if (!Array.isArray(tasks)) tasks = [];
  }
  function saveTasks() {
    try { localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); } catch (e) {}
  }
  function paintTasks() {
    var box = $('fTasks');
    box.innerHTML = '';
    if (!tasks.length) box.innerHTML = '<div class="empty-hint">还没有任务。写下这一轮要完成的一件事。</div>';
    tasks.forEach(function (t, i) {
      var row = document.createElement('div');
      row.className = 'task-item' + (t.done ? ' done' : '');
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = !!t.done;
      cb.addEventListener('change', function () {
        tasks[i].done = cb.checked; saveTasks(); paintTasks();
      });
      var span = document.createElement('span');
      span.className = 't'; span.textContent = t.text;
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'tiny-btn danger'; x.textContent = '×';
      x.addEventListener('click', function () { tasks.splice(i, 1); saveTasks(); paintTasks(); });
      row.appendChild(cb); row.appendChild(span); row.appendChild(x);
      box.appendChild(row);
    });
    var doneN = tasks.filter(function (t) { return t.done; }).length;
    $('fTaskCount').textContent = doneN + ' / ' + tasks.length;
  }
  function addTask() {
    var v = ($('fTaskInput').value || '').trim();
    if (!v) return;
    tasks.push({ text: v, done: false });
    $('fTaskInput').value = '';
    saveTasks(); paintTasks();
  }

  function init() {
    loadStat(); loadTasks(); paintTasks();
    total = left = (parseInt($('fPreset').value, 10) || 25) * 60;
    paint();
    $('fStart').addEventListener('click', start);
    $('fPause').addEventListener('click', pause);
    $('fReset').addEventListener('click', reset);
    $('fPreset').addEventListener('change', function () {
      pause();
      total = left = (parseInt(this.value, 10) || 25) * 60;
      paint();
    });
    $('fVol').addEventListener('input', function () {
      $('fVolV').textContent = this.value;
      if (gain) gain.gain.value = parseFloat(this.value) * 0.5;
    });
    $('fNoise').addEventListener('change', function () {
      stopNoise();
      if (ticking) startNoise();
    });
    $('fTaskAdd').addEventListener('click', addTask);
    $('fTaskInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') addTask(); });
    $('fResetStat').addEventListener('click', function () {
      completedToday = 0; minutesToday = 0; saveStat(); toast('统计已重置');
    });
    document.addEventListener('keydown', function (e) {
      var tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') { e.preventDefault(); ticking ? pause() : start(); }
      if (e.key === 'Escape') reset();
    });
    window.addEventListener('beforeunload', function () { stopNoise(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

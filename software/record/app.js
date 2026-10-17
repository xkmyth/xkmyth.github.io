/* XK Record —— 浏览器内录音备忘 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var rec = null, chunks = [], stream = null;
  var startedAt = 0, tick = null, clips = [], seq = 0;

  function toast(m, k) { if (window.showToast) window.showToast(m, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(ms) {
    var s = Math.floor(ms / 1000);
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }
  function human(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function pickMime() {
    var list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (var i = 0; i < list.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(list[i])) return list[i];
    }
    return '';
  }

  function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('当前浏览器不支持录音', 'bad'); return;
    }
    if (!window.MediaRecorder) { toast('当前浏览器不支持 MediaRecorder', 'bad'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      var mime = pickMime();
      try { rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s); }
      catch (e) { rec = new MediaRecorder(s); }
      chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        var dur = Date.now() - startedAt;
        clips.unshift({ id: ++seq, blob: blob, url: URL.createObjectURL(blob), dur: dur, at: new Date() });
        render();
        toast('已录制 ' + mmss(dur), 'ok');
        stopStream();
      };
      rec.start();
      startedAt = Date.now();
      $('rState').textContent = '录音中';
      $('rRec').disabled = true;
      $('rStop').disabled = false;
      $('rRec').classList.add('rec-dot');
      clearInterval(tick);
      tick = setInterval(function () { $('rTime').textContent = mmss(Date.now() - startedAt); }, 200);
    }).catch(function (err) {
      toast('拿不到麦克风权限：' + (err && err.name ? err.name : '未知错误'), 'bad');
    });
  }

  function stop() {
    if (rec && rec.state !== 'inactive') rec.stop();
    clearInterval(tick);
    tick = null;
    $('rState').textContent = '空闲';
    $('rRec').disabled = false;
    $('rStop').disabled = true;
    $('rRec').classList.remove('rec-dot');
  }

  function stopStream() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }

  function render() {
    var box = $('rList');
    box.innerHTML = '';
    if (!clips.length) {
      box.innerHTML = '<div class="empty-hint">还没有录音。点左侧「开始录音」，允许麦克风权限即可。</div>';
    }
    clips.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'rec-item';
      var audio = document.createElement('audio');
      audio.controls = true;
      audio.src = c.url;
      audio.preload = 'metadata';
      var meta = document.createElement('div');
      meta.style.minWidth = '86px';
      var b = document.createElement('b');
      b.style.fontSize = '12.5px';
      b.textContent = mmss(c.dur);
      var small = document.createElement('small');
      small.style.display = 'block';
      small.style.color = 'var(--dim)';
      small.style.fontSize = '11px';
      small.textContent = human(c.blob.size) + ' · ' + c.at.toTimeString().slice(0, 5);
      meta.appendChild(b); meta.appendChild(small);

      var dl = document.createElement('button');
      dl.type = 'button'; dl.className = 'tiny-btn'; dl.textContent = '下载';
      dl.addEventListener('click', function () { download(c); });
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'tiny-btn danger'; rm.textContent = '删除';
      rm.addEventListener('click', function () {
        URL.revokeObjectURL(c.url);
        clips = clips.filter(function (x) { return x.id !== c.id; });
        render();
      });
      row.appendChild(audio); row.appendChild(meta); row.appendChild(dl); row.appendChild(rm);
      box.appendChild(row);
    });
    $('rCount').textContent = clips.length + ' 段';
  }

  function extFor(type) {
    if (!type) return 'webm';
    if (type.indexOf('mp4') > -1) return 'm4a';
    if (type.indexOf('ogg') > -1) return 'ogg';
    return 'webm';
  }

  function download(c) {
    var a = document.createElement('a');
    a.href = c.url;
    var d = c.at;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    a.download = 'xk-record-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.' + extFor(c.blob.type);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function init() {
    render();
    $('rRec').addEventListener('click', start);
    $('rStop').addEventListener('click', stop);
    $('rClear').addEventListener('click', function () {
      if (!clips.length) return;
      if (!confirm('清空全部录音？未下载的会丢失。')) return;
      clips.forEach(function (c) { URL.revokeObjectURL(c.url); });
      clips = []; render();
    });
    $('rDownAll').addEventListener('click', function () {
      if (!clips.length) { toast('还没有录音', 'bad'); return; }
      clips.forEach(function (c, i) { setTimeout(function () { download(c); }, i * 260); });
    });
    window.addEventListener('beforeunload', function () { stopStream(); stop(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

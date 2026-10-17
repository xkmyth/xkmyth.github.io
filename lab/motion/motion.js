/* 动效实验室 —— 六个真跑得动的 canvas 演示
   全部本地计算，不请求网络；尊重 prefers-reduced-motion；离屏自动暂停。 */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function fit(canvas) {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * DPR || canvas.height !== h * DPR) {
      canvas.width = w * DPR;
      canvas.height = h * DPR;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* 简易 value noise（够用，不引库） */
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = smooth(xf), v = smooth(yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi);
    var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  /* ---------- 1. 星空 ---------- */
  function Stars(canvas, ui) {
    var self = this;
    this.count = 520;
    this.speed = 1;
    this.pointer = { x: -9999, y: -9999 };
    this.resize = function () {
      var s = fit(canvas);
      self.ctx = s.ctx; self.w = s.w; self.h = s.h;
      self.seed();
    };
    this.seed = function () {
      var out = [];
      for (var i = 0; i < self.count; i++) {
        out.push({
          x: Math.random() * self.w,
          y: Math.random() * self.h,
          z: 0.25 + Math.random() * 0.75,
          r: 0.5 + Math.random() * 1.5,
          tw: Math.random() * Math.PI * 2
        });
      }
      self.pts = out;
    };
    this.step = function (t) {
      var ctx = self.ctx, w = self.w, h = self.h;
      ctx.clearRect(0, 0, w, h);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(8,12,26,0.55)');
      g.addColorStop(1, 'rgba(4,6,15,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (var i = 0; i < self.pts.length; i++) {
        var p = self.pts[i];
        p.y += p.z * 0.35 * self.speed;
        if (p.y > h) { p.y = -4; p.x = Math.random() * w; }
        var dx = p.x - self.pointer.x, dy = p.y - self.pointer.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 9000 && d2 > 0.01) {
          var f = (1 - d2 / 9000) * 16 / Math.sqrt(d2);
          p.x += dx * f * 0.06;
          p.y += dy * f * 0.06;
        }
        var tw = 0.55 + 0.45 * Math.sin(t * 0.002 + p.tw);
        ctx.globalAlpha = tw * p.z;
        ctx.fillStyle = p.z > 0.8 ? '#fff3c4' : (p.z > 0.5 ? '#fcd34d' : '#9ae3ff');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.z * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
  }

  /* ---------- 2. 极光流场 ---------- */
  function Aurora(canvas) {
    var self = this;
    this.lines = 130;
    this.turb = 120;
    this.resize = function () {
      var s = fit(canvas);
      self.ctx = s.ctx; self.w = s.w; self.h = s.h;
    };
    this.step = function (t) {
      var ctx = self.ctx, w = self.w, h = self.h;
      ctx.fillStyle = 'rgba(4,6,15,0.10)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      var ts = t * 0.00022;
      for (var i = 0; i < self.lines; i++) {
        var n = i / self.lines;
        var x = n * w;
        var y = h * 0.5 + noise2(n * 2.3, ts * 3) * h * 0.28;
        var hue = 190 + Math.sin(n * 6.2 + ts * 4) * 26;
        var light = 52 + noise2(n * 5.0, ts * 2 + 4) * 26;
        ctx.strokeStyle = 'hsla(' + hue + ',92%,' + light + '%,0.055)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (var k = 1; k <= 10; k++) {
          var yy = y + Math.sin(k * 0.7 + ts * 9 + n * 12) * (self.turb * 0.05) * k;
          ctx.lineTo(x + (k * w) / (self.lines * 90), yy);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
  }

  /* ---------- 3. 粒子文字 ---------- */
  function PartiText(canvas) {
    var self = this;
    this.text = '星空';
    this.pull = 0.055;
    this.pts = [];
    this.pointer = { x: -9999, y: -9999 };
    this.resize = function () {
      var s = fit(canvas);
      self.ctx = s.ctx; self.w = s.w; self.h = s.h;
      self.build();
    };
    this.build = function () {
      var off = document.createElement('canvas');
      off.width = self.w; off.height = self.h;
      var o = off.getContext('2d');
      var size = Math.min(self.w / Math.max(2, self.text.length) * 1.5, self.h * 0.72);
      o.fillStyle = '#fff';
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.font = '700 ' + size + 'px "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif';
      o.fillText(self.text || '星空', self.w / 2, self.h / 2);
      var data = o.getImageData(0, 0, self.w, self.h).data;
      var step = Math.max(2, Math.round(Math.sqrt((self.w * self.h) / 9000)));
      var pts = [];
      for (var y = 0; y < self.h; y += step) {
        for (var x = 0; x < self.w; x += step) {
          if (data[(y * self.w + x) * 4 + 3] > 128) {
            pts.push({
              hx: x, hy: y,
              x: Math.random() * self.w, y: Math.random() * self.h,
              vx: 0, vy: 0, r: 0.7 + Math.random() * 1.3
            });
          }
        }
      }
      self.pts = pts;
    };
    this.step = function () {
      var ctx = self.ctx, w = self.w, h = self.h;
      ctx.fillStyle = 'rgba(4,6,15,0.22)';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < self.pts.length; i++) {
        var p = self.pts[i];
        p.vx += (p.hx - p.x) * self.pull;
        p.vy += (p.hy - p.y) * self.pull;
        var dx = p.x - self.pointer.x, dy = p.y - self.pointer.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 5200 && d2 > 0.01) {
          var f = (1 - d2 / 5200) * 2.6 / Math.sqrt(d2);
          p.vx += dx * f;
          p.vy += dy * f;
        }
        p.vx *= 0.86; p.vy *= 0.86;
        p.x += p.vx; p.y += p.vy;
        ctx.fillStyle = i % 7 === 0 ? '#9ae3ff' : '#fcd34d';
        ctx.globalAlpha = 0.72;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
      ctx.globalAlpha = 1;
    };
  }

  /* ---------- 4. 声波演示（鼠标驱动，不碰麦克风） ---------- */
  function Waves(canvas) {
    var self = this;
    this.rows = 7;
    this.amp = 1;
    this.pointer = { x: 0.5, y: 0.5 };
    this.resize = function () {
      var s = fit(canvas);
      self.ctx = s.ctx; self.w = s.w; self.h = s.h;
    };
    this.step = function (t) {
      var ctx = self.ctx, w = self.w, h = self.h;
      ctx.fillStyle = 'rgba(4,6,15,0.24)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (var r = 0; r < self.rows; r++) {
        var n = r / Math.max(1, self.rows - 1);
        var hue = 186 + n * 46;
        ctx.strokeStyle = 'hsla(' + hue + ',95%,64%,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var x = 0; x <= w; x += 3) {
          var k = x / w;
          var y = h * (0.18 + n * 0.64) +
            Math.sin(k * 14 + t * 0.0022 + n * 3.4) * h * 0.055 * self.amp * (0.4 + self.pointer.y) +
            Math.sin(k * 31 - t * 0.0035 + n) * h * 0.018 * self.amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
  }

  /* ---------- 5. 万花筒 ---------- */
  function Kaleido(canvas) {
    var self = this;
    this.segs = 8;
    this.resize = function () {
      var s = fit(canvas);
      self.ctx = s.ctx; self.w = s.w; self.h = s.h;
    };
    this.step = function (t) {
      var ctx = self.ctx, w = self.w, h = self.h;
      ctx.fillStyle = '#04060f';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      var rad = Math.min(w, h) * 0.42;
      for (var s = 0; s < self.segs; s++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / self.segs) * s + t * 0.00016);
        ctx.beginPath();
        for (var i = 0; i < 26; i++) {
          var a = (i / 26) * Math.PI * 2;
          var rr = rad * (0.55 + 0.42 * Math.sin(i * 0.8 + t * 0.0016 + s));
          var x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.32;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'hsla(' + (196 + s * 11) + ',90%,62%,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    };
  }

  /* ---------- 6. 三体小剧场 ---------- */
  function NBody(canvas) {
    var self = this;
    this.n = 5;
    this.g = 900;
    this.resize = function () {
      var s = fit(canvas);
      self.ctx = s.ctx; self.w = s.w; self.h = s.h;
      self.seed();
    };
    this.seed = function () {
      var bodies = [];
      for (var i = 0; i < self.n; i++) {
        var ang = (i / self.n) * Math.PI * 2;
        var rr = Math.min(self.w, self.h) * 0.24;
        bodies.push({
          x: self.w / 2 + Math.cos(ang) * rr,
          y: self.h / 2 + Math.sin(ang) * rr,
          vx: -Math.sin(ang) * 0.5,
          vy: Math.cos(ang) * 0.5,
          trail: []
        });
      }
      self.bodies = bodies;
    };
    this.step = function () {
      var ctx = self.ctx, w = self.w, h = self.h, bs = self.bodies;
      ctx.fillStyle = 'rgba(4,6,15,0.20)';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < bs.length; i++) {
        var a = bs[i];
        var ax = 0, ay = 0;
        for (var j = 0; j < bs.length; j++) {
          if (i === j) continue;
          var b = bs[j];
          var dx = b.x - a.x, dy = b.y - a.y;
          var d2 = Math.max(60, dx * dx + dy * dy);
          var f = self.g / d2;
          ax += (dx / Math.sqrt(d2)) * f;
          ay += (dy / Math.sqrt(d2)) * f;
        }
        a.vx += ax * 0.016; a.vy += ay * 0.016;
        a.vx *= 0.9995; a.vy *= 0.9995;
        a.x += a.vx; a.y += a.vy;
        if (a.x < -40) a.x = w + 40; else if (a.x > w + 40) a.x = -40;
        if (a.y < -40) a.y = h + 40; else if (a.y > h + 40) a.y = -40;
        a.trail.push({ x: a.x, y: a.y });
        if (a.trail.length > 48) a.trail.shift();
        ctx.strokeStyle = 'hsla(' + (188 + i * 26) + ',92%,64%,0.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (var k = 0; k < a.trail.length; k++) {
          var p = a.trail[k];
          if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(a.x, a.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };
  }

  /* ---------- 调度：一屏一个 rAF，离屏暂停 ---------- */
  var FACTORY = {
    stars: Stars, aurora: Aurora, partitext: PartiText, waves: Waves,
    kaleido: Kaleido, nbody: NBody
  };

  var demos = [];
  var running = true;
  var fpsEl = document.getElementById('mlFps');
  var toggle = document.getElementById('mlPlay');

  function boot() {
    var nodes = [].slice.call(document.querySelectorAll('canvas[data-demo]'));
    nodes.forEach(function (canvas) {
      var kind = canvas.getAttribute('data-demo');
      var F = FACTORY[kind];
      if (!F) return;
      var inst = new F(canvas);
      inst.canvas = canvas;
      inst.visible = false;
      inst.resize();
      demos.push(inst);
      window.addEventListener('resize', function () { inst.resize(); });
      canvas.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        inst.pointer = { x: e.clientX - r.left, y: 1 - (e.clientY - r.top) / r.height };
      });
      canvas.addEventListener('pointerleave', function () {
        inst.pointer = { x: -9999, y: -9999 };
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (en) { inst.visible = en.isIntersecting; });
        }, { threshold: 0.01 }).observe(canvas);
      } else {
        inst.visible = true;
      }
    });

    // 参数控件
    [].slice.call(document.querySelectorAll('[data-bind]')).forEach(function (input) {
      var pair = input.getAttribute('data-bind').split(':');
      var idx = parseInt(input.getAttribute('data-demo-index'), 10);
      input.addEventListener('input', function () {
        var inst = demos[idx];
        if (!inst) return;
        var val = input.type === 'range' ? parseFloat(input.value) : input.value;
        if (pair[0] === 'text' && inst.build) { inst.text = val; inst.build(); }
        else if (pair[0] === 'count') { inst.count = Math.round(val * 10); inst.seed(); }
        else inst[pair[1]] = val;
        var out = document.getElementById(input.id + '-val');
        if (out) out.textContent = val;
      });
    });

    if (toggle) {
      toggle.addEventListener('click', function () {
        running = !running;
        toggle.textContent = running ? '暂停' : '继续';
        if (running) loop(performance.now());
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && running) loop(performance.now());
    });
    loop(performance.now());
  }

  var last = 0, frames = 0, fpsT = 0;

  function loop(t) {
    if (!running) return;
    var dt = t - last;
    last = t;
    if (dt < 15) { requestAnimationFrame(loop); return; } // 约 60fps 上限
    if (t - fpsT > 600) {
      if (fpsEl) fpsEl.textContent = Math.round((frames * 1000) / (t - fpsT));
      frames = 0; fpsT = t;
    }
    for (var i = 0; i < demos.length; i++) {
      var d = demos[i];
      if (!d.visible) continue;
      try { d.step(t, dt); frames++; } catch (e) { /* 单个演示出错不拖垮其他 */ }
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

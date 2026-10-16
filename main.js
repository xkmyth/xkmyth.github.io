// xkmyth 官网：星空动画 + 流星
(function () {
  const cv = document.getElementById('sky');
  const ctx = cv.getContext('2d');
  let W, H, stars = [], meteors = [];

  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  resize();
  addEventListener('resize', resize);

  for (let i = 0; i < 170; i++) {
    stars.push({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      tw: Math.random() * Math.PI * 2
    });
  }

  function spawnMeteor() {
    meteors.push({
      x: Math.random() * W * 0.8 + W * 0.2,
      y: Math.random() * H * 0.25,
      vx: -(Math.random() * 3 + 4),
      vy: Math.random() * 1.6 + 1.6,
      life: 1
    });
  }
  setInterval(spawnMeteor, 2600);

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const t = Date.now() / 1000;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const x = (s.x + t * 0.004 * s.z) % 2 - 1;
      const a = 0.3 + 0.7 * Math.abs(Math.sin(s.tw + t * 1.3));
      ctx.globalAlpha = a * (0.4 + 0.6 * s.z);
      ctx.fillStyle = i % 9 === 0 ? '#9ae3ff' : '#fff';
      ctx.beginPath();
      ctx.arc((x + 1) / 2 * W, (s.y + 1) / 2 * H, s.r * (0.5 + s.z), 0, 7);
      ctx.fill();
    }
    // 流星
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx; m.y += m.vy; m.life -= 0.012;
      if (m.life <= 0) { meteors.splice(i, 1); continue; }
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
      grad.addColorStop(0, 'rgba(255,255,255,' + m.life + ')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  frame();
})();

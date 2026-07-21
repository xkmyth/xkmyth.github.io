// ===== 星空动画 =====
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const stars = [];
for (let i = 0; i < 200; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 0.3,
    speed: Math.random() * 0.3 + 0.05,
    alpha: Math.random()
  });
}

function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of stars) {
    s.alpha += 0.01;
    if (s.alpha > 1 || s.alpha < 0.2) s.alpha = 0.2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.abs(Math.sin(s.alpha))})`;
    ctx.fill();
  }
  requestAnimationFrame(drawStars);
}
drawStars();

// ===== 网名生成器 =====
function generateName() {
  const prefix = ['星尘','星河','星云','星野','星眠','星屿','星澜','星雾'];
  const suffix = ['低语','入梦','远航','私语','幻梦','微光','晚风','破晓'];
  const p = prefix[Math.floor(Math.random() * prefix.length)];
  const s = suffix[Math.floor(Math.random() * suffix.length)];
  document.getElementById('nameResult').innerText = p + s;
}

// ===== 运势测算 =====
function showFortune() {
  const fortunes = [
    '今日运势极佳，适合开展新计划 ✨',
    '今日运势平稳，稳扎稳打即可 👍',
    '今日运势小吉，注意把握机会 🌟',
    '今日运势尚可，避免冲动决策 💫'
  ];
  document.getElementById('fortuneResult').innerText =
    fortunes[Math.floor(Math.random() * fortunes.length)];
}

// ===== 表情包生成 =====
function generateEmoji() {
  const text = prompt('请输入表情包文字：');
  if (text) alert(`已生成表情包：${text}`);
}

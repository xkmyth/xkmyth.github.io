// ===== 展开/折叠 =====
function toggle(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

// ===== 复制内容 =====
function copyContent(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText.trim()).then(() => {
    const btn = event?.target || document.querySelector(`[onclick*="copyContent('${id}')"]`);
    const orig = btn?.innerText;
    if (btn) btn.innerText = '✅ 已复制';
    setTimeout(() => { if (btn) btn.innerText = orig || '复制'; }, 1500);
  }).catch(() => alert('复制失败，请手动复制'));
}

// ===== 搜索功能 =====
let searchTimer = null;
function initSearch() {
  const searchBox = document.createElement('div');
  searchBox.innerHTML = `
    <div style="max-width:600px;margin:0 auto;position:relative">
      <input type="text" id="searchInput" placeholder="🔍 搜索工具... 例如：Ctrl+C、CAD、Word..."
        style="width:100%;padding:14px 20px;border-radius:30px;border:1px solid rgba(255,255,255,0.15);
        background:rgba(0,0,0,0.4);color:#fff;font-size:16px;outline:none;backdrop-filter:blur(8px)">
      <span id="searchCount" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);
        font-size:13px;color:#888;pointer-events:none"></span>
    </div>`;
  
  const banner = document.querySelector('.banner');
  if (banner) banner.after(searchBox);

  document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchTools(this.value), 200);
  });
}

function searchTools(q) {
  const cards = document.querySelectorAll('.tool-card');
  const modules = document.querySelectorAll('.module');
  const count = document.getElementById('searchCount');
  q = q.toLowerCase().trim();

  if (!q) {
    cards.forEach(c => { c.style.display = ''; });
    modules.forEach(m => { m.style.display = ''; });
    if (count) count.innerText = '';
    return;
  }

  let visible = 0;
  cards.forEach(c => {
    const text = c.innerText.toLowerCase();
    const match = text.includes(q);
    c.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  // Hide empty modules
  modules.forEach(m => {
    const hasVisible = [...m.querySelectorAll('.tool-card')].some(c => c.style.display !== 'none');
    m.style.display = hasVisible ? '' : 'none';
  });

  if (count) count.innerText = visible > 0 ? `${visible} 个结果` : '无结果';
}

// ===== 深色/浅色切换 =====
document.addEventListener('DOMContentLoaded', function() {
  // Init search
  initSearch();

  // Theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function() {
      document.body.classList.toggle('light');
      this.innerText = document.body.classList.contains('light') ? '深色模式' : '浅色模式';
    });
  }
});

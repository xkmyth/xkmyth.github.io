// 展开/折叠功能
function toggle(id) {
  const content = document.getElementById(id);
  if (content.style.display === "block" || content.style.display === "") {
    content.style.display = "none";
  } else {
    content.style.display = "block";
  }
}

// 复制功能
function copyContent(id) {
  const content = document.getElementById(id).innerText;
  navigator.clipboard.writeText(content).then(() => {
    alert("复制成功！");
  }).catch(err => {
    console.error('复制失败:', err);
  });
}
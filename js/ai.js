/* 星空 AI 助手 —— 纯前端直连 DeepSeek Chat Completions。
 * 没有后端：key 从 /js/ai-key.js 或本机 localStorage['xk-ai-key'] 取，
 * 会话只存在本机（localStorage['xk-ai-chat']，最多 20 轮），不上传任何站点数据。
 */
(function () {
  "use strict";
  if (window.__xkAiLoaded) return;
  window.__xkAiLoaded = true;
  if (document.documentElement.hasAttribute("data-no-ai")) return;

  var KEY_LS = "xk-ai-key";
  var CHAT_LS = "xk-ai-chat";
  var MODEL_LS = "xk-ai-model";
  var MAX_TURNS = 20;

  var cfg = window.XK_AI_CONFIG || null;
  var state = {
    open: false,
    busy: false,
    aborter: null,
    messages: [],
    model: localStorage.getItem(MODEL_LS) || "deepseek-chat"
  };

  var SYS = [
    "你是 xkmyth 星空生态的站内助手，服务对象是普通访客与开发者。",
    "xkmyth 是纯静态、零后端的效率工具生态：160 个浏览器内运行的在线工具、11 个本地数据应用、",
    "下载中心（浏览器/云盘两个产品，Windows zip 与 Android apk），站点在 https://xkmyth.github.io 。",
    "回答要求：中文；先给结论再给做法；能一句话说清就不要展开；工具/页面可以直接给路径，例如",
    "/Timarsky/tools/totp/ 是 TOTP 验证码，/software/vault/ 是本地密码库，/collections/ 是按场景的工具合集。",
    "涉及密钥、隐私、法律风险时直接说清边界，不要编造不存在的功能；不知道就说不知道。",
    "不要输出 Markdown 表格以外的复杂排版，代码用三个反引号包裹。"
  ].join("");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function loadConfig() {
    return new Promise(function (resolve) {
      if (window.XK_AI_CONFIG) return resolve(window.XK_AI_CONFIG);
      var s = document.createElement("script");
      s.src = "/js/ai-key.js";
      s.onload = function () { resolve(window.XK_AI_CONFIG || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  function apiKey() {
    return localStorage.getItem(KEY_LS) || (cfg && cfg.key) || "";
  }

  /* ---------------- 界面 ---------------- */
  var fab, panel, list, input, sendBtn, stopBtn, statusEl, modelSel;

  function build() {
    fab = el("button", "ai-fab");
    fab.type = "button";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-controls", "aiPanel");
    fab.innerHTML =
      '<span class="ai-fab-dot" aria-hidden="true"></span>' +
      '<span class="ai-fab-label">AI 助手</span>';
    fab.addEventListener("click", function () { state.open ? close() : open(); });

    panel = el("div", "ai-panel");
    panel.id = "aiPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", "星空 AI 助手");
    panel.hidden = true;

    var head = el("div", "ai-head");
    var title = el("div", "ai-title");
    title.innerHTML = '<svg class="ai-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.6 6.1 6.6.6-5 4.3 1.5 6.5L12 16.8 6.3 20.1l1.5-6.5-5-4.3 6.6-.6z"/></svg><span>星空 AI 助手</span>';
    var tools = el("div", "ai-head-tools");

    modelSel = el("select", "ai-model");
    modelSel.setAttribute("aria-label", "模型");
    ["deepseek-chat", "deepseek-reasoner"].forEach(function (m) {
      var o = el("option", null, m === "deepseek-chat" ? "chat 快答" : "reasoner 深思");
      o.value = m;
      if (m === state.model) o.selected = true;
      modelSel.appendChild(o);
    });
    modelSel.addEventListener("change", function () {
      state.model = modelSel.value;
      localStorage.setItem(MODEL_LS, state.model);
    });

    var gear = el("button", "ai-icon", "设");
    gear.type = "button";
    gear.title = "设置 key";
    gear.setAttribute("aria-label", "设置 API key");
    gear.addEventListener("click", showSettings);

    var clear = el("button", "ai-icon", "清");
    clear.type = "button";
    clear.title = "清空会话";
    clear.setAttribute("aria-label", "清空会话");
    clear.addEventListener("click", function () {
      state.messages = [];
      localStorage.removeItem(CHAT_LS);
      render();
    });

    var closeBtn = el("button", "ai-icon ai-close", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "关闭助手");
    closeBtn.addEventListener("click", close);

    tools.appendChild(modelSel);
    tools.appendChild(gear);
    tools.appendChild(clear);
    tools.appendChild(closeBtn);
    head.appendChild(title);
    head.appendChild(tools);

    list = el("div", "ai-list");
    list.setAttribute("role", "log");
    list.setAttribute("aria-live", "polite");
    list.setAttribute("aria-relevant", "additions text");

    var form = el("form", "ai-form");
    input = el("textarea", "ai-input");
    input.rows = 1;
    input.placeholder = "问点什么…（Enter 发送，Shift+Enter 换行）";
    input.setAttribute("aria-label", "输入问题");
    input.addEventListener("input", autosize);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    sendBtn = el("button", "ai-send", "发送");
    sendBtn.type = "submit";
    stopBtn = el("button", "ai-send ai-stop", "停止");
    stopBtn.type = "button";
    stopBtn.hidden = true;
    stopBtn.addEventListener("click", function () {
      if (state.aborter) state.aborter.abort();
    });

    form.appendChild(input);
    form.appendChild(sendBtn);
    form.appendChild(stopBtn);
    form.addEventListener("submit", function (e) { e.preventDefault(); send(); });

    statusEl = el("div", "ai-status");
    statusEl.textContent = "DeepSeek 直连 · 会话只存在本机";

    panel.appendChild(head);
    panel.appendChild(list);
    panel.appendChild(form);
    panel.appendChild(statusEl);

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.open) close();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        state.open ? close() : open();
      }
    });
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(140, input.scrollHeight) + "px";
  }

  function open() {
    state.open = true;
    panel.hidden = false;
    fab.classList.add("is-open");
    document.documentElement.classList.add("ai-open");
    loadConfig().then(function (c) { cfg = c; });
    if (!state.messages.length) {
      var saved = localStorage.getItem(CHAT_LS);
      if (saved) {
        try { state.messages = JSON.parse(saved) || []; } catch (e) { state.messages = []; }
      }
    }
    if (!state.messages.length) {
      state.messages.push({
        role: "assistant",
        content: "你好，我是站内助手。可以问我：某个工具怎么用、这条报错什么意思、站点有哪些东西、这个项目的取舍为什么是这样。"
      });
    }
    render();
    input.focus();
  }

  function close() {
    state.open = false;
    panel.hidden = true;
    fab.classList.remove("is-open");
    document.documentElement.classList.remove("ai-open");
    if (state.aborter) state.aborter.abort();
  }

  function render() {
    list.innerHTML = "";
    state.messages.forEach(function (m) {
      var row = el("div", "ai-msg ai-" + m.role);
      var who = el("div", "ai-who", m.role === "user" ? "你" : "助手");
      var body = el("div", "ai-body");
      body.textContent = m.content || "";
      row.appendChild(who);
      row.appendChild(body);
      list.appendChild(row);
    });
    list.scrollTop = list.scrollHeight;
  }

  function push(role, content) {
    state.messages.push({ role: role, content: content });
    if (state.messages.length > MAX_TURNS * 2) state.messages = state.messages.slice(-MAX_TURNS * 2);
    localStorage.setItem(CHAT_LS, JSON.stringify(state.messages.slice(-MAX_TURNS * 2)));
    render();
  }

  function showSettings() {
    var cur = localStorage.getItem(KEY_LS) || "";
    var v = window.prompt(
      "填入你自己的 DeepSeek API key（sk- 开头）。\n留空 = 继续用站点内置的演示 key。\nkey 只保存在本机浏览器。",
      cur
    );
    if (v === null) return;
    if (v.trim()) {
      localStorage.setItem(KEY_LS, v.trim());
      statusEl.textContent = "已改用你自己填的 key（只存在本机）";
    } else {
      localStorage.removeItem(KEY_LS);
      statusEl.textContent = "已切回站点内置的演示 key";
    }
  }

  function errText(status, detail) {
    if (status === 401) return "key 无效或已失效（401）。点「设」换成你自己的 key。";
    if (status === 402) return "账户余额不足（402），去 platform.deepseek.com 充值后再试。";
    if (status === 429) return "请求太频繁（429），等几秒再发。";
    if (status === 400) return "请求被拒绝（400）：" + (detail || "参数问题");
    return "请求失败（HTTP " + status + "）" + (detail ? "：" + detail : "");
  }

  function send() {
    if (state.busy) return;
    var text = (input.value || "").trim();
    if (!text) return;
    var key = apiKey();
    if (!key) {
      push("assistant", "还没有可用的 key。点标题栏的「设」填一个，或确认 /js/ai-key.js 能加载。");
      return;
    }
    input.value = "";
    autosize();
    push("user", text);

    state.busy = true;
    sendBtn.hidden = true;
    stopBtn.hidden = false;
    statusEl.textContent = "思考中…";
    state.aborter = new AbortController();

    var payload = {
      model: state.model,
      stream: true,
      max_tokens: 1200,
      temperature: 0.6,
      messages: [{ role: "system", content: SYS }].concat(
        state.messages.filter(function (m) { return m.role !== "system"; })
          .slice(-10)
          .map(function (m) { return { role: m.role, content: m.content }; })
      )
    };

    var answer = "";
    var row, bodyEl;

    function appendToken(t) {
      if (!row) {
        row = el("div", "ai-msg ai-assistant ai-streaming");
        row.appendChild(el("div", "ai-who", "助手"));
        bodyEl = el("div", "ai-body");
        row.appendChild(bodyEl);
        list.appendChild(row);
      }
      answer += t;
      bodyEl.textContent = answer;
      list.scrollTop = list.scrollHeight;
    }

    fetch((cfg && cfg.base ? cfg.base : "https://api.deepseek.com") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key
      },
      body: JSON.stringify(payload),
      signal: state.aborter.signal
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var detail = t;
          try { detail = JSON.parse(t).error.message; } catch (e) {}
          throw new Error("HTTP " + res.status + "|" + detail);
        });
      }
      if (!res.body || !res.body.getReader) return res.json().then(function (j) {
        appendToken((j.choices && j.choices[0].message.content) || "");
      });

      var reader = res.body.getReader();
      var dec = new TextDecoder("utf-8");
      var buf = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split("\n");
          buf = parts.pop();
          parts.forEach(function (line) {
            line = line.trim();
            if (!line || line.indexOf("data:") !== 0) return;
            var data = line.slice(5).trim();
            if (data === "[DONE]") return;
            try {
              var j = JSON.parse(data);
              var d = j.choices && j.choices[0].delta;
              if (d && d.content) appendToken(d.content);
            } catch (e) {}
          });
          return pump();
        });
      }
      return pump();
    }).then(function () {
      if (answer) push("assistant", answer);
      statusEl.textContent = "DeepSeek 直连 · 会话只存在本机";
    }).catch(function (err) {
      if (err && err.name === "AbortError") {
        if (answer) push("assistant", answer);
        statusEl.textContent = "已停止";
        return;
      }
      var msg = String(err && err.message || err);
      var m = msg.match(/^HTTP (\d+)\|([\s\S]*)$/);
      push("assistant", "⚠ " + (m ? errText(Number(m[1]), m[2]) : "网络层失败：" + msg));
      statusEl.textContent = "请求失败";
    }).then(function () {
      state.busy = false;
      stopBtn.hidden = true;
      sendBtn.hidden = false;
      if (row) row.classList.remove("ai-streaming");
      input.focus();
    });
  }

  function boot() {
    if (!document.body) return;
    build();
    // 页面上的 [data-ai-open] 按钮也能唤起
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-ai-open]");
      if (t) { e.preventDefault(); open(); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

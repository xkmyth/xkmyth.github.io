/* xkmyth 内置演示 key —— 纯静态站点无法隐藏密钥：这段内容对任何访客都是公开的。
 * 建议：用它做体验，正式对外前在 https://platform.deepseek.com 轮换并设置额度上限，
 *      或者改成自己的后端代理（/docs/api/ 里有直连示例）。
 * 想临时换 key：在 AI 助手设置里填一次，存在本机 localStorage['xk-ai-key']，优先于这里。
 */
window.XK_AI_CONFIG = {
  key: "sk-e8bd85a69e3340beab2a5bdc7897d91e",
  base: "https://api.deepseek.com",
  models: ["deepseek-chat", "deepseek-reasoner"],
  label: "内置演示 key（公开可见）"
};

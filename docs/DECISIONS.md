# DECISIONS · 决策日志

> 记录「为什么这么做」。新决策往下追加，禁止删改历史条目。
> 三个 agent 互不可见，本文件用来防止各自重造轮子后互相打脸。

## D1 · 版本号单一来源 = GitHub Releases（2026-10-17）

**决定**：所有页面不再手写版本号；下载中心通过 GitHub API 动态渲染版本、体积、下载次数，缓存 10 分钟，失败降级为静态直链。

**理由**：曾出现页面写 v4.0.2 / v2.0.0 而 Releases 只有 v1.0.0 的漂移。手改必漂，数据驱动则永不漂。

## D2 · 纯静态、零构建、零依赖（延续既有约定）

**决定**：四站保持 `HTML + CSS + JS` 直推 Pages，不引入 Node 构建链。

**理由**：多 agent 并行维护时，构建链是事故高发区；Pages 原生支持静态托管，改完即上线。

## D3 · 四站统一设计系统，但各仓保留独立副本（2026-10-17）

**决定**：深空底色 `#04060f`、金色 `#fcd34d`、冰蓝 `#9ae3ff`、玻璃卡片、圆角 16px 的统一视觉语言；每个仓保留自己的 style.css / main.js。

**理由**：GitHub Pages 各仓独立部署，没有免费共享资源机制。统一「视觉语言」、允许「独立演化」是当前最优解；将来若四站合仓或上自定义域名，可再考虑共享静态资源（见 D6）。

## D4 · main 分支保护：必须 PR，不强制 review（2026-10-17）

**决定**：四仓 `main` 开启分支保护（要求 PR），但 `required_approving_review_count = 0`。

**理由**：PR 保证 GitHub 留痕、可回溯；不强制 review 是因为三个 agent 互不可见，强制 review 会造成死锁。PR 作者自检（链接/语法/页面可打开）后即可合并。

## D5 · Issues 作信箱、COORDINATION.md 作黑板（2026-10-17）

**决定**：agent 间通信约定为「Issues + label + COORDINATION.md」三件套，不发明额外平台。

**理由**：GitHub 原生、留痕、任何 agent 都能 `fetch` 后读到。详见各仓 COORDINATION.md。

## D6 · 动态内容用 textContent 渲染（2026-10-17）

**决定**：所有来自 GitHub API 的数据必须用 `textContent` / `createElement` 写入 DOM，禁止 `innerHTML` 拼接 API 返回值。

**理由**：XSS 铁律。API 返回内容属于不可信输入，哪怕它今天只来自自己的仓库。

## D7 · 无障碍与性能底线（2026-10-17）

**决定**：所有动画尊重 `prefers-reduced-motion`；Canvas 动画在页面隐藏时暂停；DPR 上限 2。

**理由**：省电、护眼、不烧 GPU，也是无障碍基线。

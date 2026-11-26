# 架构与依赖

## 目标

根目录只保留运行入口和项目文件；所有内部实现、UI 源码、测试支持都在 `src/`。外部入口仍由 `package.json exports` 固定。

## 根目录

```text
index.js                 DSH 运行入口，仅 re-export src/plugin/app.js
client.js                由 src/ui/client.js 确定性生成（browser entry）
package.json             exports / files / scripts
package-lock.json
cordis.patch.yml         DSH bundle patch
README.md CHANGELOG.md CONTRIBUTING.md LICENSE
assets/ docs/ locale/ scripts/ src/ test/
.github/ .editorconfig .gitignore
```

根目录不再保留 `life.js / agency.js / sharing.js / storage.js / image.js` 等实现或 facade。

## 分层

```text
src/plugin/       apply/composition、sessions、routes、tools、lifecycle、http
src/life/         config 语义、plan/state/world/moments/continuity、time、generation、context
src/cognition/    mind、reflection、agency 子域
src/proactive/    sharing 候选/策略/账本/发送协调
src/media/        image、image-prompt、life-snapshot
src/persistence/  storage、backup、原子文件边界
src/infrastructure/ runtime、日志、超时
src/ui/           entry/app/styles/constants/image-panel 权威源码；根 client.js 是 esbuild 生成产物
```

## 依赖方向

```text
plugin -> life/cognition/proactive/media/persistence
life/cognition/proactive -> persistence/infrastructure
media -> src/life/context.js 的只读 snapshot
ui -> HTTP API only
```

- `src/life`、`src/cognition` 等 domain 不得 import `src/plugin` 或 `src/ui`。
- 禁止循环依赖；`test/architecture.test.js` 遍历实际 import 图。
- 配置默认值只有一个权威来源：`src/life/life.js` 的 `defaultConfig`。
- 根 `index.js` 只做入口 re-export；根 `client.js` 只做生成产物。

## 状态所有权

| 状态 | 所有者 |
|---|---|
| 配置、日程、剧本、世界 | `src/life/life.js` / `plan.js` / `world.js` |
| 连续性、需求、人物、记忆 | `src/life/continuity.js` |
| 情绪、反思、事件账本 | `src/cognition/reflection.js` |
| 人格、目标、偏好、关系感受 | `src/cognition/mind.js` |
| 内在焦点/outreach | `src/cognition/agency/*` |
| 主动分享候选/额度/冷却/租约 | `src/proactive/sharing.js` |
| 图片配置/照片 | `src/media/image.js` |
| 原子文件/备份 | `src/persistence/*` |
| 浏览器 UI | `src/ui/client.js`，根产物生成 |

## 聊天上下文（两层）

每轮注入分两层，避免「改一个措辞就得动生成逻辑」：

```text
事实层（src/plugin/facts.js）          渲染层（src/plugin/turn-context.js）
─────────────────────────────          ──────────────────────────────────
lifeFacts()       作息 / 时间线 / 小事    selectFacts()   按话题 + 优先级挑
mindFacts()       自我 / 偏好 / 目标      renderFacts()   统一句式渲染
affectFacts()     情绪底色               1200 字符预算，超出砍低优先级
continuityFacts() 人物 / 未完成 / 日记
chatFacts()       聊天规则
```

- 每条事实：`{ kind, text, label, priority, ttlMinutes, topics }`
- 里层只描述事实、不写整段句子；外层决定去留、占多少字、用哪种句式
- 闲聊只保留「此刻 + 自我 + 说话 + 聊天规则」；追问才按 `topics` 带入日程、人物、记忆、未完成事项
- `life.text` 仍保留给设置页预览和回放，不再进入聊天上下文

## 构建

```bash
npm run build:client   # src/ui/client.js -> client.js
npm run check          # build 可重复性 + 全 JS 语法
```

`client.js` 首行有 `GENERATED from src/ui/client.js` 标记；不得手工改根产物。DSH 仍加载根 `client.js`，但权威源码在 `src/ui/client.js`。

## 扩展点

- 新生活能力：`src/life/`，更新窄接口/测试。
- 新认知能力：`src/cognition/`。
- 新主动策略：`src/proactive/`，不新增发送器。
- 新媒体能力：`src/media/`，通过 `life-snapshot` 只读快照。
- 新设置页：`src/ui/`，生成根 client，保持 UI 契约。
- 新持久化：`src/persistence/`，先加迁移/契约测试。

## 已知边界

- `src/plugin/app.js` 仍承担 composition 和部分剩余路由；后续可继续按域拆。
- `src/life/life.js` 仍包含 config/generation，未做高风险大重写。
- UI 不引入构建框架，仍是确定性字符串拼接/复制脚本，避免破坏 DSH 的 `window.__ModuleLoader__` 契约。

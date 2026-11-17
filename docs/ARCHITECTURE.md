# 架构与依赖

## 目标

`dsh-feiyu-life` 是一个 DSH 插件。根目录文件是稳定 facade，实现按职责放在 `src/`。重构的第一目标是降低单文件认知负担和跨域耦合；不是减少总行数。

## 分层

```text
src/plugin/      DSH 适配：系统上下文、会话事件、工具、HTTP 路由、主动调度
src/life/        生活领域：时间/日历/身体/睡眠投影（逐步从 life.js 抽出）
src/cognition/   认知领域：agency 状态机、候选、outreach、runner
src/proactive/   主动分享候选/策略/账本/发送协调
src/media/       图片提示词与媒体适配
src/persistence/ 原子写、锁、bounded read、quarantine
src/ui/          浏览器设置页（受 DSH 无构建加载方式限制，暂保留根 client.js）
```

根目录 `index.js`、`client.js`、`life.js`、`agency.js`、`sharing.js`、`storage.js`、`image-prompt.js` 等继续存在，作为兼容入口/re-export facade。

## 依赖方向

```text
plugin -> domain/application
domain -> persistence
media   -> life narrow read interface
ui      -> HTTP API only (not server state rules)
```

- `src/cognition/*`、`src/life/*` 不得 import `src/plugin/*` 或根 `index.js/client.js`。
- `src/persistence/*` 不 import 业务模块。
- `src/media/*` 可以通过 `life.js` facade 读取快照，但不能反向拥有生活状态；`image.js` 与 `image-prompt.js` 均已移入 `src/media`，根文件只做 facade。
- 禁止新的循环依赖；`test/architecture.test.js` 会遍历实际 import 图。

## 状态所有权

| 状态 | 所有者 |
|---|---|
| 配置、日程、剧本、世界 | `life.js` / `plan.js` / `world.js` |
| 连续性、需求、人物、记忆 | `continuity.js` |
| 情绪、事件账本、反思 | `reflection.js` |
| 人格、目标、偏好、关系感受 | `mind.js` |
| 内在焦点、defer/abandon/outreach | `src/cognition/agency/*` |
| 主动分享候选/额度/冷却/租约 | `sharing.js` |
| 图片配置、照片 | `image.js` / `src/media` |
| 原子文件和锁 | `src/persistence/storage.js` |

## 主要数据流

1. 计划/状态/身体/世界 -> `life.generate()` -> 每轮上下文。
2. 对话结束 -> reflection -> affect/mind 候选 -> 存储。
3. 连续性结算 -> 真实完成/进展 -> agency 候选。
4. 内部 tick -> 选择/复盘/推迟/关闭焦点 -> agency 文件。
5. 主动分享 tick -> 候选 + 全部安全闸门 -> `agent.followup` 入队 -> sharing 账本；失败释放租约。
6. 设置页 -> HTTP API -> 同一组 domain 函数。

## 扩展点

- 新生活内容：优先放 `src/life/`，通过根 facade 导出；不要从 domain import plugin。
- 新主动策略：候选/策略放 `src/proactive/` 或 sharing，不新增发送器。
- 新模型/图片能力：`src/media/`，通过窄接口读生活快照。
- 新设置页区域：`src/ui/`（在 DSH 浏览器加载约束允许时），只调用 HTTP API。
- 新持久化格式：先加迁移/规范化测试，再改 storage 边界。

## 已知偏差

- `life.js` 仍保留配置 schema/迁移和 generation/context；已抽出 time/calendar。完全拆 config/generator 需要单独迁移窗口。
- `src/plugin/tools.js` 已承载 DSH 工具注册；HTTP 路由/生命周期仍在根 `index.js`，下一轮继续收敛。
- `client.js` 受 DSH 的 `window.__ModuleLoader__` 无构建加载约束，暂不做物理多文件拆分；视觉和 data 属性由现有 UI 测试锁住。
- continuity/mind/reflection 仍通过根 `storage.js` facade 使用持久化；没有一次性重写全部持久化，避免行为风险。

<p align="center"><img src="./icon.png" width="120" alt="鱼的生活 Logo"></p>

# dsh-feiyu-life · 鱼的生活

[![npm](https://img.shields.io/npm/v/dsh-feiyu-life)](https://www.npmjs.com/package/dsh-feiyu-life)
[![CI](https://github.com/Vansnc/dsh-feiyu-life/actions/workflows/ci.yml/badge.svg)](https://github.com/Vansnc/dsh-feiyu-life/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/dsh-feiyu-life)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A522-informational)](https://nodejs.org/)

![我的一天](./assets/banner.jpg)

大肥鱼是 DSH 里的一个有自己生活线的角色插件：她有一天的作息、地点、身体状态、自己的小目标、关系记忆和有限的主动性。她不是客服，也不是只会在被叫到时才存在的聊天人格。

## 能力

- **连续生活**：每日剧本、课表/作息、地点世界、身体状态、衣物、每日小事；计划未结算前仍是计划。
- **内在状态**：短期情绪、长期记忆、偏好、关系、虚拟目标和可追溯议程；敏感内容不自动沉淀。
- **有限主动**：从真实生活变化、未完成事项和关系承诺里形成候选，经过安静时段、睡眠、忙碌、额度、冷却和最低分后才可能发一条消息；没有候选就安静。
- **内在议程**：没有用户输入时也会更新焦点、复盘自己的目标、处理推迟/恢复/放弃；现实任务和外部动作不会被自动完成。
- **设置与观察**：设置页可查看此刻、连续性、内在、分享、数据、照片等；有可审计的事件和分享账本。
- **相机与媒体**：照片、参考图、图片生成和本地图库。

## 安装

```bash
dsh plugin --profile web add dsh-feiyu-life
```

本地开发：

```bash
git clone https://github.com/Vansnc/dsh-feiyu-life.git
cd dsh-feiyu-life
npm ci
npm run check
npm test
```

本地目录开发时，把 `cordis.patch.yml` 里的 `name` 改成当前目录 `index.js` 的绝对路径，或在 profile 中 link 当前目录。

## 快速开始

在 **设置 → 鱼的生活**：

1. 先在「课表 / 作息」填自己的作息、课表和衣柜；角色设定留空时不会硬塞人格文案。
2. 在「人格 / 内在」设置记忆、情绪反思和模型；不配置时使用安全默认值。
3. 在「分享」设置主动分享的开关、每日上限、冷却、安静时段和最低分。默认克制。
4. 在「连续性」查看/管理长期主线、短期事项、约定、人物和最近记忆。
5. 在「数据」导出/恢复设置。备份不包含 API Key、日志、照片和运行时账本。

## 关键边界

- 不执行现实动作，不代替用户赴约、取快递、发消息或调用外部服务。
- 没有天气数据时不编天气；没有实际出入地点时不编“已经取回来了”。
- 主动分享是入队语义，DSH 目前没有模型回复回执；插件不会假装知道用户已读。
- 设置页和 API 由 DSH 的连接认证保护；运行时文件只写插件自己的目录。
- 数据默认在 `~/.dsh`；升级/迁移前请先导出备份。

## 文档

- [架构与依赖](docs/ARCHITECTURE.md)
- [配置参考与迁移](docs/CONFIGURATION.md)
- [安装、升级、备份、发布与故障排查](docs/OPERATIONS.md)
- [设计原则与关键决策](docs/DESIGN.md)
- [life 依赖盘点](docs/LIFE_DEPENDENCY_INVENTORY.md)
- [贡献指南](CONTRIBUTING.md)
- [更新记录](CHANGELOG.md)

## 仓库结构

根目录只有 `index.js`、`client.js` 和项目文件；内部实现与 UI 源码都在 `src/`。

- `index.js`：DSH 入口，re-export `src/plugin/app.js`
- `client.js`：由 `src/ui/client.js` 生成，不要手改
- `src/plugin/`：装配、工具、路由、生命周期
- `src/life/`：生活、日程、状态、世界、连续性
- `src/cognition/`：人格、反思、内在议程
- `src/proactive/`：主动分享
- `src/media/`：图片与快照
- `src/persistence/`、`src/infrastructure/`：存储与运行时
- `src/ui/`：浏览器 UI 权威源码

## 开发

```bash
npm run check
npm test
npm run test:ui     # 需要本机 Chromium
npm pack --dry-run
```

测试目录镜像 `src/` 的职责；新增功能必须遵守 `docs/ARCHITECTURE.md` 的依赖方向，并为公共入口、配置迁移、状态文件或 UI 契约补回归测试。

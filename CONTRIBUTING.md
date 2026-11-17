# 参与贡献

先读 [架构与依赖](docs/ARCHITECTURE.md)。新增功能要放在正确层，不新增根目录巨石文件。

## 分层规则

- `src/plugin/`：DSH 适配、路由、工具、会话事件、调度；可以依赖 domain。
- `src/life/`、`src/cognition/`：领域逻辑；不得 import `src/plugin/` 或根 `index.js/client.js`。
- `src/proactive/`：主动候选/策略，不新增第二个发送器。
- `src/media/`：媒体能力，通过窄接口读取生活快照。
- `src/persistence/`：原子写、锁、迁移边界。
- `src/ui/`：浏览器设置页；界面只调用 HTTP API。

根 `index.js` 只是 DSH 入口；`client.js` 只是 `src/ui/client.js` 的生成产物。不要再往根目录放内部实现或 facade。

## 提交前

```bash
npm run check
npm test
npm run test:ui   # 有 Chromium 时
npm pack --dry-run
```

公共导出、配置迁移、状态文件、HTTP 路由、工具名、UI data 属性、包文件清单都要有回归测试。测试不得通过删除有效断言或降低检查来变绿。


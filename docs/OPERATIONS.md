# 安装、升级、发布与故障排查

## 安装

```bash
dsh plugin --profile web add dsh-feiyu-life
```

本地开发使用 link 或把 `cordis.patch.yml` 的 `name` 指向当前 `index.js` 绝对路径。安装后刷新设置页。

## 升级

1. 先导出「数据 → 设置备份」。
2. 安装目标版本：
   ```bash
   dsh plugin --profile web add dsh-feiyu-life@x.y.z
   ```
3. 重载 DSH 插件/服务；见下文。
4. 检查日志无模块加载错误、设置页可打开、状态 API 正常。

## 服务重载

服务由 systemd 管理：

```bash
systemctl status deepseek-harness.service
sudo systemctl restart deepseek-harness.service
```

只重启 `deepseek-harness.service`，不要 `pkill`、`nohup`、`reboot` 或操作其他服务。重启后核对：

```bash
systemctl show deepseek-harness.service -p ActiveState -p MainPID -p NRestarts
curl -I http://127.0.0.1:3080/
```

端口返回 401 是正常鉴权行为。若存在宿主提供的插件级热重载，优先使用；否则才重启服务。

## npm 发布

1. 确认版本、HEAD、工作树。
2. `npm run check && npm test && npm pack --dry-run`。
3. 检查 tarball 不含 `.codex`、`.git`、node_modules、凭据、日志、运行时 JSON、备份。
4. `npm publish --access public`。
5. `npm view dsh-feiyu-life@x.y.z version dist.integrity dist.tarball`。
6. 下载 registry tarball，对比 integrity 和关键文件。

不要重复发布已存在版本；不要创建新 token/账号。

## 备份与恢复

设置页「数据」导出便携 JSON。恢复会先完整校验；三份数据写入失败时整体回滚。备份不含 API Key、照片、日志、每日剧本、运行时账本和临时调整。

## 故障排查

- 设置页打不开：先看 HTTP 状态和 DSH 连接认证。
- 插件不加载：看 `journalctl -u deepseek-harness.service` 是否有模块路径/语法错误。
- 状态不一致：导出备份，检查 `~/.dsh/feiyu-life-*.json` 是否损坏；不要手改正在使用的文件。
- 主动消息过多：在「分享」提高最低分、拉长冷却、降低每日上限，或直接关闭分享。
- 发布后 registry 404：等待 npm 处理，查询 registry；不要重复 publish。

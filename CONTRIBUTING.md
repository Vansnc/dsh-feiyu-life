# 参与贡献

感谢参与 `dsh-feiyu-life`。提交前请先理解一个边界：计划和 `life_adjust` 是事实来源，地图、动画和相机都是同一份世界状态的消费者。

## 提问题

- Bug 使用 [Bug 报告](../../issues/new?template=bug_report.yml)，附上插件版本、Node/DSH 版本、复现步骤和相关日志；
- 功能建议使用 [功能建议](../../issues/new?template=feature_request.yml)，优先描述使用场景和期望结果；
- 提问前先查看 README 的“常见问题”和“已知边界”。

请勿在 Issue 中粘贴 token、方舟密钥、个人配置全文或含隐私的角色照片。

## 本地开发

```bash
git clone https://github.com/Vansnc/dsh-feiyu-life.git
cd dsh-feiyu-life
npm run check
npm test
npm pack --dry-run
dsh plugin --profile web add "$(pwd)"
```

本地目录安装后，确认 `cordis.patch.yml` 的 `name` 指向当前目录中 `index.js` 的绝对路径。客户端模块在加载时读取，代码变化后通常需要移除插件、重新安装并刷新浏览器。

## 提交前检查

```bash
npm run check
npm test
npm pack --dry-run
```

当前测试至少应覆盖：

- 配置规范化和迁移；
- 跨午夜、IANA 时区与 DST 边界；
- 调整覆盖、剧本历史和数据清理；
- 模型硬超时与日志轮转；
- 地点推断、路径、自动通勤、移动进度和行为识别。

如果改动了前端，请同时在浅色/深色主题和窄屏下检查设置页。涉及动作资源时，还要核对透明通道、网格尺寸和每一行动画。

## 动作图集约束

运行时动作位于 `assets/actions/`，每个文件都是 4 列 × 1 行、单帧 128×128 的透明 PNG：

```text
idle / walk / sleep / study / eat / phone / photo
```

更换资源时：

- 每个单元格必须等大；
- 角色比例、中心和脚底基线保持一致；
- 不允许白底、文字、网格线、外框和半透明生成噪点；
- 道具只出现在对应动作中；
- 更新 README、设计文档和必要的行为测试；
- 用浅色背景合成预览，确认边缘没有蓝黑杂点。

四帧必须分别保持水平中心和底部基线一致。`assets/character-actions.png` 仅作为兼容旧客户端的完整图集保留，不再作为当前前端的播放源。

如果增加新行为，需要同步修改 `world.js` 的行为枚举、`index.js` 的动作资源接口、`client.js` 的资源映射、设计文档和回归测试，不能只增加图片。

## 真实地图素材

学院路底图的三层 SVG 位于 `assets/maps/`，使用统一的 `1000 × 560` 视图。如果更新 OpenStreetMap 数据，使用 `node scripts/build-xueyuan-map.mjs <xueyuan-road.osm>` 重新生成，并同步检查地点坐标、路线折点和 `assets/maps/ATTRIBUTION.md` 的数据日期。不要删除用户界面中的 OpenStreetMap 署名。

## 代码与数据约定

- 使用纯 JavaScript（ESM），不引入构建步骤；
- 代码标识符使用英文，用户配置键继续使用中文；
- 面向用户的文案使用中文并保持简洁；
- 注释解释“为什么”，不复述代码；
- 文件写入优先采用临时文件 + 原子替换；
- 模型、网络和子进程调用必须有硬超时；
- 新配置字段必须提供迁移和安全默认值；
- 不在客户端复制服务端状态计算规则。

## 文档同步

行为或配置有变化时，至少检查：

- `README.md`：用户可见能力、安装、常见问题和边界；
- `docs/CONFIGURATION.md`：字段、默认值、范围和迁移；
- `docs/DESIGN.md`：数据流、模块职责和长期约束；
- `CHANGELOG.md`：对应版本的用户可见变化。

不要保留指向不存在文件的图片或章节链接。相对链接应从当前 Markdown 文件所在目录解析。

## 提交 PR

- 一个 PR 尽量只解决一个主题；
- 标题说明结果，正文说明动机、实现边界、验证和兼容性；
- 不提交本地路径、token、个人配置、生成日志和临时图片；
- 提交前确认 `npm pack --dry-run` 中只包含预期发布文件；
- CI 通过后再合并，必要时保留独立提交以便回滚。

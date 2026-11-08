# 参与贡献

## 提问题

- **Bug**：用 [Bug 报告](../../issues/new?template=bug_report.yml) 模板，把版本、复现步骤、日志带上。没有日志的 issue 很难查。
- **功能建议**：用 [功能建议](../../issues/new?template=feature_request.yml) 模板，重点说**场景**——你卡在哪一步，比「希望支持 X」有用得多。
- 提问前先翻一眼 README 的「排错」/「已知边界」。

## 改代码

```bash
git clone https://github.com/Vansnc/dsh-feiyu-life.git
cd dsh-feiyu-life
# 本地装进 DSH（改完重装一次才生效）
dsh plugin --profile web add "$(pwd)"
```

改完提交前自己跑一遍：

```bash
for f in index.js life.js client.js; do node --check "$f"; done
npm pack --dry-run      # 看会发出去哪些文件
```

## 提交 PR

- 一个 PR 只做一件事，说明「为什么」而不只是「改了什么」；
- 行为有变化就更新 README / CHANGELOG；
- 别把本地路径、token、个人配置带进来。

## 代码风格

- 纯 JavaScript（ESM），不引入构建步骤；
- 面向用户的文案写中文，和现有风格保持一致；
- 注释写「为什么」，不写「这一行在干嘛」。

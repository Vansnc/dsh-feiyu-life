# 主动分享 14 天离线模拟

- 时间：2026-11-16 至 2026-11-29，07:00–23:00，每 10 分钟检查一次
- 检查次数：1344｜触发次数：11｜日均：0.79
- 每日上限：2｜全局冷却：1440 分钟｜同类冷却：480 分钟｜最低分：84

| 日期 | 触发 | 类别 | 抑制原因（前四项） |
|---|---:|---|---|
| 2026-11-16 | 1 | moment:throat | no-candidate 61；sleep-or-bath 15；below-min-score 13；quiet-hours 6 |
| 2026-11-17 | 1 | moment:package | class 35；global-cooldown 19；below-min-score 15；sleep-or-bath 10 |
| 2026-11-18 | 1 | moment:homework | class 22；below-min-score 22；no-candidate 21；deduped-or-cooldown 17 |
| 2026-11-19 | 1 | moment:laundry | below-min-score 36；sleep-or-bath 23；global-cooldown 13；deduped-or-cooldown 11 |
| 2026-11-20 | 0 | — | class 43；below-min-score 25；no-candidate 12；sleep-or-bath 7 |
| 2026-11-21 | 1 | moment:sleepy | below-min-score 36；no-candidate 24；class 15；sleep-or-bath 10 |
| 2026-11-22 | 1 | completed:walk | below-min-score 39；no-candidate 17；class 15；sleep-or-bath 10 |
| 2026-11-23 | 1 | moment:homework | class 43；below-min-score 27；deduped-or-cooldown 12；sleep-or-bath 7 |
| 2026-11-24 | 0 | — | class 36；below-min-score 28；no-candidate 16；sleep-or-bath 10 |
| 2026-11-25 | 1 | moment:charger | no-candidate 31；below-min-score 29；class 22；sleep-or-bath 7 |
| 2026-11-26 | 1 | completed:walk | no-candidate 28；below-min-score 27；sleep-or-bath 23；global-cooldown 10 |
| 2026-11-27 | 0 | — | class 43；below-min-score 27；no-candidate 12；sleep-or-bath 7 |
| 2026-11-28 | 2 | moment:homework、moment:homework | no-candidate 47；deduped-or-cooldown 18；sleep-or-bath 15；quiet-hours 6 |
| 2026-11-29 | 0 | — | below-min-score 38；no-candidate 20；class 15；sleep-or-bath 10 |

## 汇总

- 有分享的天数：10/14
- 类别分布：moment:homework 4；completed:walk 2；moment:throat 1；moment:package 1；moment:laundry 1；moment:sleepy 1；moment:charger 1
- 连续两天首条同类别：0/13
- 同一事件后续：1 次（同一 eventId 的新阶段）
- 同一天同类别重复：1 次（全部为后续，不是陌生事件重发）
- 抑制原因：below-min-score 365；no-candidate 299；class 289；sleep-or-bath 161；quiet-hours 84；global-cooldown 63；deduped-or-cooldown 62；phone-away 5；daily-limit 5

## 示例上下文

### 2026-11-16
```text
<feiyu-share>
这是你自己生活里刚发生、可以追溯的一件小事，不是对方发来的，也不是计划：
- 热水喝了两杯，还是干
如果你想分享，就用 1–2 句口语说一句；不强制提问或称呼，不报时间、不列清单、不解释来源，也别每次都用“刚刚/突然/对了”开头。他没回也可以放下。
</feiyu-share>
```
### 2026-11-17
```text
<feiyu-share>
这是你自己生活里刚发生、可以追溯的一件小事，不是对方发来的，也不是计划：
- 快递拿回来了，箱子搁在门口
如果你想分享，就用 1–2 句口语说一句；不强制提问或称呼，不报时间、不列清单、不解释来源，也别每次都用“刚刚/突然/对了”开头。他没回也可以放下。
</feiyu-share>
```
### 2026-11-18
```text
<feiyu-share>
这是你自己生活里刚发生、可以追溯的一件小事，不是对方发来的，也不是计划：
- 硬着头皮写了两页
如果你想分享，就用 1–2 句口语说一句；不强制提问或称呼，不报时间、不列清单、不解释来源，也别每次都用“刚刚/突然/对了”开头。他没回也可以放下。
</feiyu-share>
```
### 2026-11-19
```text
<feiyu-share>
这是你自己生活里刚发生、可以追溯的一件小事，不是对方发来的，也不是计划：
- 衣服干了，还没收
如果你想分享，就用 1–2 句口语说一句；不强制提问或称呼，不报时间、不列清单、不解释来源，也别每次都用“刚刚/突然/对了”开头。他没回也可以放下。
</feiyu-share>
```

> 这是纯离线模拟，没有创建会话、没有调用 followup、没有向任何真实会话发送消息；账本和时刻都落在临时 DSH_HOME。

# 可携带的定时任务

> 2026-11-13 · 内核方法文档
> 解决的问题：卸载 WorkBuddy 或换 AI 工具后，原来那些定时任务跟着消失，得凭记忆重建。

## 1. 思路

每个工具自己的调度器继续负责“什么时候跑”，但任务的**定义**统一存一份：

```
WorkBuddy automations ─┐
OpenMausBot routines  ─┼─▶ PG16 mem.task ─▶ state/tasks/tasks.json + TASKS.md
Windows 计划任务      ─┘
```

任务定义包括：名称、完整指令、计划、状态、目标目录、下次运行时间。
换工具时，任何一个 AI 读 `TASKS.md` 就能在目标工具里按原样重建。

## 2. 表结构

```sql
create table mem.task (
  id text primary key,          -- source:external_id
  source text not null,         -- workbuddy / openmausbot / windows / manual
  external_id text not null,
  name text not null,
  instructions text not null,   -- 原样保存，不截断
  schedule_type text not null,  -- cron / interval / weekly / rrule / windows
  schedule text not null,       -- 人能读的表达式
  status text not null,         -- enabled / paused / unknown
  next_run_at timestamptz,
  last_run_at timestamptz,
  target text not null,         -- 目录 / 模型 / bot
  raw text not null,            -- 原始 JSON，便于回滚
  hash text not null,
  updated_at timestamptz not null default now()
);
```

## 3. 采集器

| 来源 | 读取位置 | 映射 |
|---|---|---|
| WorkBuddy | `~/.workbuddy/workbuddy.db` 的 `automations`（排除 `deleted_at`） | `rrule` / `scheduled_at` → schedule；`ACTIVE`/`PAUSED` → status |
| OpenMausBot | `~/.openmausbot/routines.json` 的 `routines` | interval/cron/weekly/daily/once → 可读计划 |
| Windows | `Get-ScheduledTask`，只看 `ai-native-*` / `zhishu-*` / `OpenMausBot*` | Trigger + Action → schedule/instructions |

命令：

```bash
python scripts/tasks.py import-all     # 三个来源都采
python scripts/tasks.py list
python scripts/tasks.py export         # 写 state/tasks/
```

已挂进 `scripts/sync-all.ps1`，每小时随会话同步一起刷新。

## 4. 换工具怎么恢复

1. 打开 `state/tasks/TASKS.md`（或 `tasks.json`）。
2. 找要带走的任务，保留 `name`、`schedule`、完整 `instructions`。
3. 在目标工具里新建同名任务：
   - OpenMausBot：把 instructions 原文作为自动化指令，计划按 `schedule` 填。
   - WorkBuddy：新建 Automation，粘贴 instructions，计划按 rrule/时间填。
   - 其他工具：没有调度器就交给系统计划任务，或让 AI 每次会话读取 `TASKS.md` 自行判断。
4. 恢复后在原工具删除旧任务，避免双跑。

自动恢复暂不开放：写入别人的调度器需要各工具自己的 API 与授权，贸然创建会造成重复执行。当前是“定义可携带、创建由 AI 辅助”。

## 5. 边界

- `mem.task` 和 `state/tasks/` 含个人路径、项目指令，**只存在私有语料库和本机 PG，禁止提交到公开仓库**。
- 指令里如果出现令牌、密码，先脱敏再入库；采集器不主动读环境变量。
- 任务注册表只做备份与迁移，不代替各工具的调度器，不保证“下次运行时间”跨工具一致。

## 6. 当前状态

- 2026-11-13 首次采集：23 条任务（WorkBuddy 1、OpenMausBot 18、Windows 4）。
- 导出文件：`state/tasks/tasks.json`（约 40KB）、`state/tasks/TASKS.md`（约 40KB）。
- 飞轮自检已加入任务清单新鲜度检查（>26h WARN）。

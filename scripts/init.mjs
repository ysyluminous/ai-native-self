#!/usr/bin/env node
// Zero-dependency scaffold for a personal life-data repo (ai-native-self skill).
// Usage: node scripts/init.mjs <targetDir> [--priv private|secret] [--time HH:MM] [--no-git]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('用法: node scripts/init.mjs <目标目录> [--priv private|secret] [--time HH:MM] [--no-git]');
  process.exit(2);
}
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : dflt;
};
const privDefault = opt('priv', 'private') === 'secret' ? 'secret' : 'private';
const timeOpt = opt('time', '22:30');
const dailyTime = /^\d{1,2}:\d{2}$/.test(timeOpt) ? timeOpt : '22:30';
const root = path.resolve(target);
const skillUrl = path
  .resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  .replace(/\\/g, '/');

const now = new Date();
const year = now.getFullYear();
const half = now.getMonth() < 6 ? 'H1' : 'H2';
const today = now.toISOString().slice(0, 10);

const created = [];
const skipped = [];
const mk = (p) => {
  if (fs.existsSync(p)) return skipped.push(p);
  fs.mkdirSync(p, { recursive: true });
  created.push(`${p}/`);
};
const put = (p, body) => {
  if (fs.existsSync(p)) return skipped.push(p);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
  created.push(p);
};

[
  'inbox', 'entities', 'decisions', 'beliefs', 'artifacts', 'metrics',
  'reviews/daily', 'reviews/weekly', 'reviews/monthly', 'reviews/quarterly',
  `attachments/${year}`, 'attachments/imports', 'packs/self', 'secret', 'index',
].forEach((d) => mk(path.join(root, d)));

put(path.join(root, 'inbox', `${year}-${half}.md`), `---
repo: inbox
period: ${year}-${half}
priv_default: ${privDefault}
---

# ${year} ${half} 倾倒区

<!-- 追加到文件末尾。一条一个块，块首是 front matter。永不重写历史块。 -->
`);

put(path.join(root, 'secret', 'README.md'), `---
priv: secret
committed: false
---

# secret

此目录默认被 .gitignore 排除：不进 git、不进检索索引、不进日报。
需要提交时由用户显式修改 .gitignore。
`);

put(path.join(root, '.gitignore'), `secret/
index/
*.tmp
.DS_Store
Thumbs.db
# attachments 体积大或含敏感原件时，取消下一行注释
# attachments/imports/**
`);

put(path.join(root, 'AGENTS.md'), `---
kind: data-repo
generated: ${today}
skill_root: ${skillUrl}
kernel_version: 0.1.0
---

# 我的语料仓库（ai-native-self）

这是**唯一真相源**，纯 Markdown + git。任何 agent 在本仓库工作前先读：

1. \`${skillUrl}/SKILL.md\` — 七段协议
2. \`${skillUrl}/kernel/record-types.md\` — 记录类型与字段
3. \`${skillUrl}/kernel/capture.md\` — 采集与 20 秒规则
4. \`${skillUrl}/packs/README.md\` — 模型包契约

## 我的设置

- 默认隐私等级：\`${privDefault}\`（涉及他人、健康诊断、身份信息、精确位置一律降为 \`secret\`）
- 日节律时间：${dailyTime}
- 内核位置：\`${skillUrl}\`
- 内核升级方式：在上面的目录里 \`git pull\`，本仓库数据不动

## 硬约束（不得违反）

- 不重写、重排、删除 \`inbox/\` 历史块；更正用新块 + refs 指向原块。
- 不把语料外发到任何第三方服务（含 embedding、云同步、联网搜索的 query）。
- \`priv: secret\` 的内容不进日报、不进索引、不进 git、不进对外产出。
- 写入前按业务键查重合并（一个实体一页），不建重复页。
- 推断内容标 \`inferred\`；写入 \`beliefs/\` 前需用户确认措辞。
- 借来的框架（\`packs/<slug>\`）不写进 \`beliefs/\`，只用 \`refs: pack:<slug>@<version>\` 关联。
- 装官方包是把目录复制进本仓库：\`cp -r ${skillUrl}/packs/bayes packs/\`（包是数据文件，不是独立 skill）。改动 \`packs/\` 后跑结构检查：\`node ${skillUrl}/scripts/lint-packs.mjs "${root.replace(/\\/g, '/')}"\`。
- \`reviews/\` 与 \`index/\` 是派生物，可删除重建，不得被 refs 指向。
- 冷启动时间表：第 1-2 周只允许写 \`inbox/\`；不要提前建索引、装数据库、加自动化。
- 采集超过 20 秒就是本系统的缺陷：不追问、不要求填表、不做评判。
`);

put(path.join(root, 'README.md'), `---
kind: data-repo
---

# 我的数据

这个仓库属于我。它由 ai-native-self 内核管理（协议与字段定义在内核目录里），
内容是 UTF-8 Markdown，可被任何工具与任何模型读取——换工具不丢数据。

- 备份：私有 git 远端 + 一个异地副本；每季度做一次恢复演练。
- 协议与字段定义在内核仓库，本仓库只放数据。
- 想退出这套系统：删掉 skill 目录，本仓库仍然是完全可读的纯文本。
`);

if (!args.includes('--no-git') && !fs.existsSync(path.join(root, '.git'))) {
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    created.push('.git/');
  } catch {
    console.warn('警告: 未找到 git，已跳过 git init，可稍后手动执行。');
  }
}

console.log(`\n目标仓库: ${root}`);
console.log(`新建 ${created.length} 项，跳过已存在 ${skipped.length} 项（幂等：不覆盖任何已有文件）。`);
if (skipped.length) {
  const names = skipped.slice(0, 6).map((p) => path.relative(root, p)).join(', ');
  console.log(`跳过: ${names}${skipped.length > 6 ? ' …' : ''}`);
}
console.log('\n下一步：');
console.log(`  1. 在这个目录里打开 agent，说「记一下：${today} 今天 …」`);
console.log(`  2. 每晚 ${dailyTime} 花 30 秒倾倒；第 1-2 周只写 inbox/`);
console.log('  3. 第 4 周说「周复盘」；第 12 周说「季度编译我」');
console.log('  4. 配私有远端：git remote add origin <你的私有仓库>');
console.log('  5. 想插一套思维框架：自建说「给 <名字> 建一个包」（需要 A/B 级材料）；');
console.log('     官方包直接复制进来：cp -r <内核目录>/packs/{munger,bayes} packs/\n');

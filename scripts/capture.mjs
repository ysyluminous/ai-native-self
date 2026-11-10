#!/usr/bin/env node
/**
 * capture.mjs —— 唯一写入入口（所有工具都走这一个）
 *
 *   node scripts/capture.mjs "今天跟供应商谈崩了，对方要预付 50%" --topic work
 *   node scripts/capture.mjs "决定先上域名再加口令" --type decision --slug domain-first --topic zhishu
 *   node scripts/capture.mjs - --tool cursor --topic x-creator   < draft.md
 *
 * 设计约束（不许违反）：
 *   - 只追加，不改历史块；写错就再写一条更正块并用 --refs 指向原块。
 *   - 分片按「月 × 工具」：inbox/YYYY-MM.md（AI 手写）或 inbox/YYYY-MM.<tool>.md（多工具并发）。
 *     旧库的半年一文件 inbox/YYYY-H2.md 继续被识别，不迁移、不重排。
 *   - priv: secret 只写进 secret/，其它目录只留指针 —— 这是 .gitignore 唯一能生效的位置。
 *   - 写完自动重建派生索引（index/ 可删可重建）。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgv,
  findVault,
  todayISO,
  stampOf,
  pad2,
  rebuildIndex,
  allBlocks,
  toPosix,
} from './lib.mjs';

const USAGE = `用法:
  node scripts/capture.mjs "<内容>" [选项]
  <文本> | node scripts/capture.mjs - [选项]

选项:
  --vault <路径>     语料仓库（默认从当前目录向上找）
  --type <t>         event(默认) | decision | entity | belief | metric | artifact
  --tool <名字>      写入者（workbuddy/trae/cursor/claude/codex…），决定分片
  --topic a,b        主题，逗号分隔，支持分层 career/switch
  --slot <s>         event 专用: changed|decided|misjudged|avoided|body|learned|next|free
  --priv <p>         private(默认) | public | secret
  --date YYYY-MM-DD  事件实际发生日（补录用），默认今天
  --slug <slug>      decision/entity/metric/artifact 的文件名与 id 后缀
  --name <词>        entity/metric 的显示名/指标名
  --value <数>       metric 专用：本次观测值
  --unit <单位>      metric 专用
  --refs a,b         反链，形如 [[20261011-e12]] 或 pack:munger@0.1.0
  --source <s>       text(默认)|voice|screenshot|import
  --json             机器可读输出

退出码: 0 成功写入 / 2 参数错误 / 3 仓库不是语料库`;

const args = parseArgv(process.argv.slice(2));
const json = !!args.json;

let content = args._.join(' ').trim();
if (args._[0] === '-') {
  try {
    content = fs.readFileSync(0, 'utf8').trim();
  } catch {
    content = '';
  }
}

if (!content) {
  console.error(USAGE);
  process.exit(2);
}

let vault;
try {
  vault = findVault(args.vault);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(3);
}

const type = String(args.type || 'event');
const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args.date || '')) ? String(args.date) : todayISO();
const priv = ['public', 'private', 'secret'].includes(String(args.priv)) ? String(args.priv) : 'private';
const tool = args.tool ? String(args.tool).toLowerCase().replace(/[^a-z0-9._-]/g, '') : '';
const slot = args.slot ? String(args.slot) : '';
const source = args.source ? String(args.source) : 'text';
const refs = (args.refs ? String(args.refs) : '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const topics = (args.topic ? String(args.topic) : '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const stamp = stampOf(date);
const recorded = todayISO();

const warnings = [];
const notes = [];

const asciiSlug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const ensureTrailingNewline = (file) => {
  if (!fs.existsSync(file)) return '';
  const cur = fs.readFileSync(file, 'utf8');
  return cur && !cur.endsWith('\n') ? '\n' : '';
};

function appendFile(file, block, header) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const head = header ? `${header}\n` : '';
    fs.writeFileSync(file, `${head}${block}\n`, 'utf8');
    return { file, line: header ? header.split('\n').length + 1 : 1 };
  }
  const before = fs.readFileSync(file, 'utf8');
  const line = before.split('\n').length + 1; // 块首 --- 的行号（1-based）
  fs.appendFileSync(file, `${ensureTrailingNewline(file)}\n${block}\n`, 'utf8');
  return { file, line };
}

function secretBlocks() {
  return allBlocks(vault, { includeSecret: true }).filter((b) => String(b.fm.id || '').startsWith('sec-'));
}

const fmLines = (pairs) => pairs.filter(Boolean).join('\n');

function eventBlock(id) {
  return `---
id: ${id}
type: event
date: ${date}
slot: ${slot || 'free'}
topic: [${topics.join(', ')}]
priv: ${priv}
source: ${source}
refs: [${refs.map((r) => `"${r}"`).join(', ')}]${tool ? `\ntool: ${tool}` : ''}
recorded: ${recorded}
---

${content}`;
}

function eventShardPath() {
  const [y, m] = date.split('-');
  const month = `${y}-${m}`;
  if (tool) return path.join(vault, 'inbox', `${month}.${tool}.md`);
  const monthly = path.join(vault, 'inbox', `${month}.md`);
  if (fs.existsSync(monthly)) return monthly;
  const legacy = path.join(vault, 'inbox', `${y}-${Number(m) <= 6 ? 'H1' : 'H2'}.md`);
  if (fs.existsSync(legacy)) {
    notes.push(`沿用旧库的半年分片 ${path.basename(legacy)}`);
    return legacy;
  }
  return monthly;
}

function nextSeq(prefix, pool) {
  let max = 0;
  for (const b of pool) {
    const id = String(b.fm.id || '');
    const m = id.match(new RegExp(`^${prefix}-?(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

// ---- 按类型路由 ---------------------------------------------------------

let result;

if (type === 'event') {
  if (priv === 'secret') {
    const file = path.join(vault, 'secret', `${date.slice(0, 7)}${tool ? '.' + tool : ''}.md`);
    const id = `sec-${stamp}-${pad2(secretBlocks().length + 1)}`;
    const { line } = appendFile(
      file,
      `---
id: ${id}
type: event
date: ${date}
slot: ${slot || 'free'}
topic: [${topics.join(', ')}]
priv: secret
source: ${source}
refs: []
recorded: ${recorded}
---

${content}`,
      `---\nrepo: secret\nperiod: ${date.slice(0, 7)}\n---\n\n# secret（不进 git / 不进索引 / 不进日报）\n`,
    );
    result = { id, type, file: toPosix(path.relative(vault, file)), line };
    notes.push(`已写入 secret/，其它目录只能留指针：refs: ["[[${id}]]"]`);
  } else {
    const file = eventShardPath();
    const seq = nextSeq(`${stamp}-e`, allBlocksVault());
    const id = `${stamp}-e${pad2(seq)}`;
    const header = `---
repo: inbox
period: ${date.slice(0, 7)}
priv_default: ${priv}
---

# ${date.slice(0, 7)} 倾倒区

<!-- 追加到文件末尾。一条一个块，块首是 front matter。永不重写历史块。 -->
`;
    const { line } = appendFile(file, eventBlock(id), header);
    result = { id, type, file: toPosix(path.relative(vault, file)), line };
  }
} else if (type === 'decision') {
  const slug = asciiSlug(args.slug) || `d${pad2(nextSeq(`${stamp}-d`, allBlocksVault()))}`;
  const id = `${stamp}-${slug}`;
  const file = path.join(vault, 'decisions', `${id}.md`);
  if (fs.existsSync(file)) {
    console.error(`决策已存在：${toPosix(path.relative(vault, file))}（一决策一文件，不覆盖；要改请追加复盘块）`);
    process.exit(2);
  }
  const firstLine = content.split(/\r?\n/)[0].slice(0, 120);
  const block = `---
id: ${id}
type: decision
date: ${date}
topic: [${topics.join(', ')}]
priv: ${priv}
question: ${args.question ? String(args.question) : firstLine}
reversibility: ${args.reversibility || 'unverified'}
confidence: ${args.confidence || '0.0'}
status: ${args.status || 'pending'}
sources_opened: ${args.sources || '0'}
samples: ${args.samples || '0'}
packs_consulted: [${String(args.packs || '').split(',').filter(Boolean).map((p) => p.trim()).join(', ')}]
worst_case: ${String(args.worst || '待补：最坏结果是什么，能不能承受')}
tolerable: ${args.tolerable || 'false'}
cost_of_not: ${String(args.cost || '待补：选这个意味着放弃什么')}
review_on: ${args.review || ''}
refs: [${refs.map((r) => `"${r}"`).join(', ')}]
---

${content}
`;
  const { line } = appendFile(file, block, '');
  result = { id, type, file: toPosix(path.relative(vault, file)), line };
  if (!args.worst) warnings.push('1 个决策待补最坏值（worst_case）');
  if (!args.cost) warnings.push('1 个决策待补机会成本（cost_of_not）');
  if (!args.review) warnings.push('1 个决策缺 review_on，不会进入月度审计');
} else if (type === 'entity') {
  const name = String(args.name || args.slug || '').trim();
  const slug = asciiSlug(args.slug) || asciiSlug(name);
  if (!slug) {
    console.error('entity 需要 --slug（ascii）或 --name（中文名会转不出 slug，请显式给 --slug）');
    process.exit(2);
  }
  const id = `ent-${slug}`;
  const file = path.join(vault, 'entities', `${slug}.md`);
  if (fs.existsSync(file)) {
    const cur = fs.readFileSync(file, 'utf8');
    const add = `\n- ${date} ${content}\n`;
    const next = cur.includes('## 交互记录')
      ? cur.replace(/## 交互记录\s*\n/, (m) => `${m}${add}`)
      : `${cur.replace(/\s*$/, '')}\n\n## 交互记录\n${add}`;
    fs.writeFileSync(file, next, 'utf8');
    notes.push('实体页已存在：追加观测，不新建页（按业务键合并）');
    result = { id, type, file: toPosix(path.relative(vault, file)), line: 1 };
  } else {
    const block = `---
id: ${id}
type: entity
kind: ${args.kind || 'person'}
name: ${name || slug}
created: ${date}
updated: ${date}
topic: [${topics.join(', ')}]
priv: ${priv}
refs: [${refs.map((r) => `"${r}"`).join(', ')}]
---

## 事实（带日期与证据等级）

- ${date} ${content}

## 我的判断（inferred）

## 交互记录

- ${date} ${content}
`;
    const { line } = appendFile(file, block, '');
    result = { id, type, file: toPosix(path.relative(vault, file)), line };
  }
} else if (type === 'belief') {
  const slug = asciiSlug(args.slug);
  const seq = nextSeq('bel', allBlocksVault());
  const id = slug ? `bel-${slug}` : `bel-${String(seq).padStart(3, '0')}`;
  const file = path.join(vault, 'beliefs', `${id}.md`);
  if (fs.existsSync(file)) {
    console.error(`信念已存在：${id}（要改置信度请改原文件的 confidence，并在正文记一条复核）`);
    process.exit(2);
  }
  const falsifier = args.falsifier
    ? String(args.falsifier)
    : '待补（入库前必须补：什么证据会让你改这条）';
  const block = `---
id: ${id}
type: belief
date: ${date}
claim: ${args.claim ? String(args.claim) : content.split(/\r?\n/)[0].slice(0, 120)}
kind: ${args.kind || 'observation'}
evidence: ${args.evidence || 'C'}
sources: [${refs.map((r) => `"${r}"`).join(', ')}]
confidence: ${args.confidence || '0.5'}
falsifier: ${falsifier}
last_tested: ${date}
status: ${args.status || 'held'}
topic: [${topics.join(', ')}]
priv: ${priv}
---

${content}
`;
  const { line } = appendFile(file, block, '');
  result = { id, type, file: toPosix(path.relative(vault, file)), line };
  if (!args.falsifier) warnings.push('1 条信念缺 falsifier（月审会被打回）');
  if (!refs.length) warnings.push('1 条信念没有 sources，证据等级不可核');
} else if (type === 'metric') {
  const slug = asciiSlug(args.slug || args.name);
  if (!slug) {
    console.error('metric 需要 --slug（ascii 指标名，如 body-fat）');
    process.exit(2);
  }
  if (args.value === undefined || args.value === true) {
    console.error('metric 需要 --value <数值>（一行一观测）');
    process.exit(2);
  }
  const file = path.join(vault, 'metrics', `${slug}.md`);
  if (fs.existsSync(file)) {
    const cur = fs.readFileSync(file, 'utf8');
    const nl = cur.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(file, `${cur}${nl}- ${date} ${args.value}\n`, 'utf8');
    notes.push('台账已存在：追加一行观测（不改历史行）');
    result = { id: `met-${slug}`, type, file: toPosix(path.relative(vault, file)), line: cur.split('\n').length };
  } else {
    const block = `---
id: met-${slug}
type: metric
date: ${date}
topic: [${topics.join(', ')}]
priv: ${priv}
unit: ${args.unit || ''}
source: ${args.source ? String(args.source) : '自述'}
verified: ${args.verified || 'false'}
---

# ${args.name || slug}

- ${date} ${args.value}
`;
    const { line } = appendFile(file, block, '');
    result = { id: `met-${slug}`, type, file: toPosix(path.relative(vault, file)), line };
  }
} else if (type === 'artifact') {
  const slug = asciiSlug(args.slug) || `a${pad2(nextSeq('art', allBlocksVault()))}`;
  const id = `art-${slug}`;
  const file = path.join(vault, 'artifacts', `${slug}.md`);
  if (fs.existsSync(file)) {
    console.error(`产出已存在：${id}`);
    process.exit(2);
  }
  const block = `---
id: ${id}
type: artifact
name: ${args.name ? String(args.name) : content.split(/\r?\n/)[0].slice(0, 80)}
kind: ${args.kind || 'article'}
date: ${date}
published: ${args.published || date}
url: ${args.url || '""'}
topic: [${topics.join(', ')}]
priv: ${priv}
outcome: {views: 0, feedback: ""}
refs: [${refs.map((r) => `"${r}"`).join(', ')}]
---

${content}
`;
  const { line } = appendFile(file, block, '');
  result = { id, type, file: toPosix(path.relative(vault, file)), line };
} else {
  console.error(`未知类型：${type}`);
  process.exit(2);
}

function allBlocksVault() {
  return allBlocks(vault, { includeSecret: false });
}

if (!topics.length && type !== 'metric') warnings.push('缺 topic（检索与反链都靠它，补一条 --topic 或事后补字段）');

const index = rebuildIndex(vault);

if (json) {
  console.log(JSON.stringify({ ...result, warnings, notes, index: index.count }, null, 2));
} else {
  console.log(`已归档 1 条 → ${result.file}:${result.line} · ${result.id}（${result.type}）`);
  for (const n of notes) console.log(`说明：${n}`);
  if (warnings.length) console.log(`待补：${warnings.join('；')}`);
  console.log(`索引已重建：${index.count} 块（index/ 是派生物，可随时删除重建）`);
}

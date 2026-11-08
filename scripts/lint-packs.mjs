#!/usr/bin/env node
// 零依赖的模型包**结构** lint：只查机器可判的项（字段、章节、四件套数量、登记表一致性）。
// 语义项（无造神、无群体化断言、版权、失效条件是否空洞）仍需 AI/人判，见 packs/README.md。
// 用法：node scripts/lint-packs.mjs [仓库根] [--verbose] [--selftest]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) || path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const verbose = args.includes('--verbose');
const selftest = args.includes('--selftest');

const REQUIRED_KEYS = ['slug', 'name', 'kind', 'version', 'maintained-by', 'window', 'evidence',
  'evidence-ratio', 'license', 'source-of-truth', 'trigger', 'auto-trigger', 'domain-fit',
  'domain-na', 'conflicts', 'guardrails'];
const KINDS = new Set(['person', 'school', 'method', 'tool', 'self']);

/** YAML 内联列表的元素数（`[]` 与 `[ ]` 为空；多行 `- {pack: …}` 形式返回 0，由调用方另判）。 */
const listItems = (v = '') => {
  const inner = String(v).replace(/^\s*\[/, '').replace(/\]\s*$/, '').trim();
  return inner === '' ? [] : inner.split(',').map((s) => s.trim()).filter(Boolean);
};

const splitFront = (text) => {
  if (!text.startsWith('---')) return [{}, text];
  const end = text.indexOf('\n---', 3);
  if (end === -1) return [{}, text];
  const fm = {};
  for (const line of text.slice(3, end).split('\n')) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) fm[m[1]] = m[2].trim();
  }
  return [fm, text.slice(end + 4)];
};

/** 检查一个 pack.md 的正文与元数据。template=true 时只查键存在（值是占位符）。 */
function checkPack(text, { template = false } = {}) {
  const [fm, body] = splitFront(text);
  const fails = [];
  const f = (msg) => fails.push(msg);

  for (const k of REQUIRED_KEYS) if (!(k in fm)) f(`缺 front matter 字段 ${k}`);
  if (template) return { fm, fails, stats: {} };

  if (fm['auto-trigger'] !== 'false') f(`auto-trigger 必须是 false（当前：${fm['auto-trigger']}）`);
  if (!KINDS.has(fm.kind)) f(`kind 非法：${fm.kind}`);
  if (!/^[ABC]$/.test(fm.evidence || '')) f(`evidence 必须是 A|B|C：${fm.evidence}`);
  if (listItems(fm['domain-na']).length === 0) f('domain-na 为空 — 一个不说自己哪里无效的包不可信');
  if (listItems(fm['domain-fit']).length === 0) f('domain-fit 为空');
  if (listItems(fm.trigger).length === 0) f('trigger 为空');
  const hasConflicts = /^\s*-\s*\{pack:/m.test(text.slice(0, 3000)) || listItems(fm.conflicts).length > 0;
  const conflictsDeclared = hasConflicts || /当前无其他已装包/.test(body);
  if (!conflictsDeclared) f('冲突表为空且未写明"当前无其他已装包"');
  const guardrails = listItems(fm.guardrails).join(',');

  const sections = {
    '一句话总纲': /^## 一句话总纲/m.test(body),
    '心智模型': /^## 心智模型/m.test(body),
    '决策启发式': /^## 决策启发式/m.test(body),
    '诚实边界': /^## 诚实边界/m.test(body),
    '双模式': /^## 双模式/m.test(body),
    '冲突': /^## 冲突(表|记录)/m.test(body),
    '材料清单': /^## 材料清单/m.test(body),
    '压力测试': /^## 压力测试/m.test(body),
  };
  for (const [name, ok] of Object.entries(sections)) if (!ok) f(`缺章节「${name}」`);
  if (guardrails && !/^## 护栏/m.test(body)) f(`guardrails 非空但缺「护栏」章节：[${guardrails}]`);
  if (fm.kind && ['method', 'tool', 'self', 'school'].includes(fm.kind) && /模式二\s*·\s*扮演/.test(body)) {
    f(`kind: ${fm.kind} 不应实现扮演模式（契约第 6 条）`);
  }

  const models = (body.match(/^### 模型/gm) || []).length;
  if (models < 3 || models > 9) f(`心智模型数量 ${models} 不在 3-9 之间`);
  const tuple = {
    一句话: (body.match(/^\*\*一句话\*\*/gm) || []).length,
    证据: (body.match(/^\*\*证据\*\*/gm) || []).length,
    应用条件: (body.match(/^\*\*应用条件\*\*/gm) || []).length,
    失效条件: (body.match(/^\*\*失效条件与反例\*\*/gm) || []).length,
  };
  for (const [k, v] of Object.entries(tuple)) if (v !== models) f(`四件套不齐：${k} 出现 ${v} 次，模型 ${models} 个`);
  if (/失效条件与反例\*\*[^：]*：\s*(仅供参考|待补|TBD)/.test(body)) f('失效条件是空话（"仅供参考"）');

  const heuristics = (body.match(/^\d+\.\s+\*\*/gm) || []).length;
  if (heuristics < 5) f(`决策启发式 ${heuristics} 条，少于 5`);
  if ((body.match(/什么时候别/g) || []).length < Math.min(heuristics, 5)) {
    f('启发式缺"什么时候别按它做"（数量不足）');
  }

  const stress = (body.match(/Q[：:]/g) || []).length;
  if (stress < 3) f(`压力测试 ${stress} 问，要求 ≥3`);

  if (!/^## lint 自检/m.test(body)) f('缺 lint 自检表（入库需附 12 项 pass 记录）');
  else {
    const tail = body.slice(body.indexOf('## lint 自检'));
    const rows = (tail.match(/^\|\s*\d+\s*\|/gm) || []).length;
    if (rows < 12) f(`lint 自检表 ${rows} 行，要求 12 行`);
    if (/\|\s*fail\s*\|/i.test(tail)) f('lint 自检表存在 fail 项');
  }

  if (conflictsDeclared && !/裁决(顺序|规则)/.test(body)) f('有冲突但未给出裁决顺序/裁决规则');

  const unverified = (body.match(/verified:\s*false/g) || []).length;
  return { fm, fails, stats: { models, heuristics, stress, unverified } };
}

function lintAll(base) {
  const packsDir = path.join(base, 'packs');
  if (!fs.existsSync(packsDir)) return [{ slug: '(no packs/)', fails: ['目录不存在'] }];
  const out = [];
  for (const entry of fs.readdirSync(packsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(packsDir, entry.name, 'pack.md');
    if (!fs.existsSync(file)) {
      // 脚手架会预建空的 packs/self/（第 12 周才编译）；登记表与磁盘的一致性另有检查。
      out.push({ slug: entry.name, fails: [], empty: true });
      continue;
    }
    const r = checkPack(fs.readFileSync(file, 'utf8'), { template: entry.name.startsWith('_') });
    out.push({ slug: entry.name, ...r });
  }
  return out;
}

/** 登记表与磁盘必须一致：计划中的包不算存在。 */
function crossCheckRegistry(base, results) {
  const regPath = path.join(base, 'packs', 'registry.md');
  const fails = [];
  if (!fs.existsSync(regPath)) return { fails, skipped: true };   // 数据仓库可以没有官方登记表
  const reg = fs.readFileSync(regPath, 'utf8');
  const published = reg.split('## 计划中')[0];
  const cells = (line) => line.split('|').slice(1, -1).map((s) => s.trim());
  const rowFor = (slug) => published.split('\n')
    .find((l) => l.startsWith('| `') && cells(l)[0] === `\`${slug}\``);
  for (const r of results) {
    if (r.slug.startsWith('_')) continue;
    const line = rowFor(r.slug);
    if (r.slug === 'self') {
      if (!line) fails.push('self 未在登记表「已发布」区（它应当作为契约内置行存在）');
      continue;
    }
    if (!line) { fails.push(`包 ${r.slug} 存在于磁盘但未登记（或登记在"计划中"区）`); continue; }
    const [, kind, version, evidence] = cells(line);
    if (r.fm.kind && kind !== r.fm.kind) fails.push(`${r.slug} 登记 kind=${kind}，包内 kind=${r.fm.kind}`);
    if (r.fm.version && version !== r.fm.version) fails.push(`${r.slug} 登记版本=${version}，包内 version=${r.fm.version}`);
    const ev = (evidence || '').replace(/\*\*/g, '').replace(/（.*$/, '').trim();
    if (r.fm.evidence && ev !== r.fm.evidence) fails.push(`${r.slug} 登记证据=${ev}，包内 evidence=${r.fm.evidence}`);
  }
  for (const m of published.matchAll(/\|\s*`([a-z][\w-]*)`\s*\|/g)) {
    if (m[1] === 'self' || m[1] === '_template') continue;
    if (!fs.existsSync(path.join(base, 'packs', m[1], 'pack.md'))) fails.push(`登记表有 ${m[1]} 但目录不存在`);
  }
  return { fails, skipped: false };
}

// ---- 阳性对照：证明检查器不是永真 ----
const realPack = path.join(root, 'packs', 'munger', 'pack.md');
const sample = fs.existsSync(realPack) ? fs.readFileSync(realPack, 'utf8') : null;
function selftestRun() {
  if (!sample) { console.log('selftest 跳过：找不到 packs/munger/pack.md'); return false; }
  const mutations = [
    ['删掉 domain-na', (t) => t.replace(/^domain-na: .*$/m, 'domain-na: []')],
    ['auto-trigger 改 true', (t) => t.replace('auto-trigger: false', 'auto-trigger: true')],
    ['删一个模型的失效条件', (t) => t.replace(/^\*\*失效条件与反例\*\*/m, '**随便写的**')],
    ['删「诚实边界」章节', (t) => t.replace(/^## 诚实边界/m, '## 赞美自己')],
    ['原文应通过（对照组）', (t) => t],
  ];
  let ok = true;
  for (const [label, mutate] of mutations) {
    const res = checkPack(mutate(sample));
    const expectFail = label !== '原文应通过（对照组）';
    const got = res.fails.length > 0;
    const pass = expectFail === got;
    ok = ok && pass;
    console.log(`${pass ? '✔' : '✘'} selftest ${label}: ${got ? `报出 ${res.fails.length} 项` : '无输出'}`);
    if (!pass) console.log('   期望', expectFail ? '至少 1 项 fail' : '全 pass', '实际:', res.fails.slice(0, 3));
  }
  return ok;
}

if (selftest) {
  process.exit(selftestRun() ? 0 : 1);
}

const results = lintAll(root);
const registry = crossCheckRegistry(root, results);
let bad = 0;
console.log(`\n仓库: ${root}`);
for (const r of results) {
  if (r.empty) { console.log(`skip  ${r.slug}/（目录存在但还没有 pack.md；第 12 周编译 self 前这是正常的）`); continue; }
  const isTemplate = r.slug.startsWith('_');
  const head = isTemplate ? `${r.slug}（模板：只查字段键）`
    : `${r.slug} · kind=${r.fm?.kind} · evidence=${r.fm?.evidence} · v${r.fm?.version}`;
  if (r.fails.length) {
    bad++;
    console.log(`\nFAIL  ${head}`);
    r.fails.forEach((x) => console.log(`      ✗ ${x}`));
  } else {
    const s = r.stats || {};
    console.log(`pass  ${head}  （模型 ${s.models ?? '-'} / 启发式 ${s.heuristics ?? '-'} / 压力测试 ${s.stress ?? '-'} / verified:false 标注 ${s.unverified ?? '-'}）`);
  }
  if (verbose && r.fails.length === 0) console.log('      ' + JSON.stringify(r.fm));
}
if (registry.fails.length) { bad++; console.log('\nFAIL  registry 一致性'); registry.fails.forEach((x) => console.log(`      ✗ ${x}`)); }
else if (registry.skipped) console.log('skip  registry ↔ 磁盘（此仓库无 packs/registry.md；自建仓库想查一致性就建一份）');
else console.log('pass  registry ↔ 磁盘 一致');
console.log(`\n结构项：${results.length} 个包目录，${bad} 处失败。语义项（造神/群体化断言/版权/空洞失效条件/外发要求）仍需人工或 AI 判。\n`);
process.exit(bad ? 1 : 0);

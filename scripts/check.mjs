#!/usr/bin/env node
/**
 * check.mjs —— 语料体检 / 一致性自检（每次批量写入后跑，可挂 CI）
 *
 *   node scripts/check.mjs                 # 人读
 *   node scripts/check.mjs --json          # 机器读（CI 用）
 *   node scripts/check.mjs --selftest      # 阳性对照：故意造 6 处缺陷，必须全部报出
 *
 * 退出码：0 无 FAIL / 1 有 FAIL / 3 不是语料库
 * FAIL = 真相源被破坏（断链、重复 id、secret 越界、缺 falsifier…）
 * WARN = 节律或派生层问题（索引过期、决策到期、没有周复盘），不阻断提交
 *
 * 自检自己也验：干净仓库必须 0 FAIL，脏仓库必须报出每一处。报告"0 处断链"之前先跑它。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgv, findVault, allBlocks, readIndex, blockDate, todayISO } from './lib.mjs';

const REQUIRED = {
  event: ['id', 'type', 'date', 'priv'],
  entity: ['id', 'type', 'name', 'created', 'updated', 'priv'],
  decision: ['id', 'type', 'date', 'question', 'reversibility', 'status', 'review_on', 'priv'],
  belief: ['id', 'type', 'claim', 'kind', 'evidence', 'confidence', 'falsifier', 'status', 'priv'],
  artifact: ['id', 'type', 'name', 'kind', 'priv'],
  metric: ['id', 'type', 'date', 'priv'],
};

function analyze(vault, blocks) {
  const fails = [];
  const warns = [];
  const idIndex = new Map();
  for (const b of blocks) {
    const id = String(b.fm.id || '').trim();
    if (!id) {
      fails.push({ code: 'required-fields', detail: `${b.file}:${b.line} 块缺 id` });
      continue;
    }
    if (idIndex.has(id)) fails.push({ code: 'dup-id', detail: `${id} 重复：${idIndex.get(id)} 与 ${b.file}:${b.line}` });
    else idIndex.set(id, `${b.file}:${b.line}`);
  }

  const refsOf = (b) => [].concat(b.fm.refs || [], b.fm.sources || []).map(String);
  for (const b of blocks) {
    const type = String(b.fm.type || '');
    const req = REQUIRED[type];
    if (req) {
      const missing = req.filter((k) => b.fm[k] === undefined || b.fm[k] === '' || (Array.isArray(b.fm[k]) && b.fm[k].length === 0 && k !== 'topic'));
      if (missing.length) fails.push({ code: 'required-fields', detail: `${b.fm.id} 缺字段 ${missing.join(', ')}` });
    }
    if (type !== 'artifact' && type !== 'metric' && (!b.fm.topic || (Array.isArray(b.fm.topic) && !b.fm.topic.length))) {
      fails.push({ code: 'required-fields', detail: `${b.fm.id} 缺 topic（检索靠它）` });
    }

    for (const raw of refsOf(b)) {
      const m = raw.match(/\[\[([^\]]+)\]\]/);
      if (m) {
        const target = m[1].trim();
        if (/^reviews\//.test(target)) {
          fails.push({ code: 'derived-refs', detail: `${b.fm.id} 把派生物当真相源：refs → ${target}` });
        } else if (!idIndex.has(target)) {
          fails.push({ code: 'orphan-refs', detail: `${b.fm.id} 的 refs 指向不存在的 ${target}` });
        }
      }
    }

    if (type === 'belief') {
      const f = String(b.fm.falsifier || '');
      if (!f || /待补/.test(f)) fails.push({ code: 'belief-falsifier', detail: `${b.fm.id} 缺推翻条件（没有 falsifier 的信念只是偏好）` });
      if (!b.fm.evidence || !/^[ABC]$/.test(String(b.fm.evidence))) fails.push({ code: 'belief-evidence', detail: `${b.fm.id} 的 evidence 不是 A/B/C` });
    }

    if (String(b.fm.priv) === 'secret' && !b.file.startsWith('secret/')) {
      fails.push({ code: 'secret-outside', detail: `${b.fm.id} 是 priv: secret 但写在 ${b.file}（.gitignore 只排除 secret/ 目录）` });
    }
  }

  // 节律与派生层：只报 WARN
  const today = todayISO();
  for (const b of blocks) {
    if (b.fm.type !== 'decision') continue;
    const r = String(b.fm.review_on || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(r) && r <= today && !['done', 'overturned'].includes(String(b.fm.status))) {
      warns.push({ code: 'decisions-due', detail: `${b.fm.id} 到期（${r}，status=${b.fm.status}）` });
    }
    if (b.fm.reversibility === 'one-way' && String(b.fm.tolerable) !== 'true' && /待补/.test(String(b.fm.worst_case || ''))) {
      warns.push({ code: 'worst-case-missing', detail: `${b.fm.id} 是不可逆决策但没有可用的最坏值` });
    }
  }

  const idx = readIndex(vault);
  if (!idx) warns.push({ code: 'index-missing', detail: 'index/blocks.jsonl 不存在（下次 capture 会重建；不影响真相源）' });
  else {
    const metaPath = path.join(vault, 'index', 'meta.json');
    const built = fs.existsSync(metaPath) ? Date.parse(JSON.parse(fs.readFileSync(metaPath, 'utf8')).built || 0) : 0;
    const newest = blocks.reduce((max, b) => Math.max(max, fs.statSync(b.abs).mtimeMs), 0);
    if (built && newest > built + 1000) warns.push({ code: 'index-stale', detail: '索引比语料旧（派生层过期，重跑 capture 或重建索引）' });
  }

  const events = blocks.filter((b) => b.fm.type === 'event' && blockDate(b));
  if (events.length) {
    const last = events.map(blockDate).sort().pop();
    const days = Math.floor((Date.parse(today) - Date.parse(last)) / 86400000);
    if (days >= 7) warns.push({ code: 'inbox-gap', detail: `最近一次倾倒距今 ${days} 天（reflection 断档，如实记 gap 即可）` });
  }
  for (const cadence of ['weekly', 'monthly']) {
    const dir = path.join(vault, 'reviews', cadence);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
    if (!files.length) warns.push({ code: `no-${cadence}-review`, detail: `还没有任何 ${cadence} 复盘（节律是硬约束，不是建议）` });
  }

  return { fails, warns, blockCount: blocks.length };
}

// ---- 阳性对照：自己造脏仓库，必须报出来 ---------------------------------

function fixture(dir, blocks) {
  for (const [rel, body] of Object.entries(blocks)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  }
}

function selftest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ans-check-'));
  const clean = path.join(root, 'clean');
  fixture(clean, {
    'AGENTS.md': '---\nkind: data-repo\n---\n',
    'inbox/2026-11.md': `---
repo: inbox
---

---
id: 20261101-e01
type: event
date: 2026-11-01
slot: free
topic: [work]
priv: private
refs: []
---

今天谈崩了。
`,
    'decisions/20261101-x.md': `---
id: 20261101-x
type: decision
date: 2026-11-01
question: 要不要预付
reversibility: two-way
status: decided
review_on: 2099-01-01
topic: [work]
priv: private
worst_case: 损失预付款
refs: ["[[20261101-e01]]"]
---

不答应。
`,
    'beliefs/bel-001.md': `---
id: bel-001
type: belief
claim: 我在压力下判断更差
kind: observation
evidence: B
confidence: 0.5
falsifier: 若连续三次压力下决策复盘为好则降级
status: held
topic: [self]
priv: private
sources: ["[[20261101-e01]]"]
---

记录。
`,
  });

  const dirty = path.join(root, 'dirty');
  fixture(dirty, {
    'AGENTS.md': '---\nkind: data-repo\n---\n',
    'inbox/2026-11.md': `---
repo: inbox
---

---
id: 20261102-e01
type: event
date: 2026-11-02
slot: free
topic: [work]
priv: private
refs: ["[[不存在的id]]"]
---

断链的一条。

---
id: 20261102-e01
type: event
date: 2026-11-02
slot: free
topic: [work]
priv: private
refs: []
---

重复 id 的一条。

---
id: 20261102-e03
type: event
date: 2026-11-02
slot: free
priv: secret
refs: []
---

secret 写在了 inbox 里，而且没有 topic。
`,
    'beliefs/bel-002.md': `---
id: bel-002
type: belief
claim: 没有推翻条件的判断
kind: observation
evidence: Q
confidence: 0.4
status: held
topic: [self]
priv: private
sources: []
---

这一条没有 falsifier。
`,
    'decisions/20261102-y.md': `---
id: 20261102-y
type: decision
date: 2026-11-02
question: 派生物当证据
reversibility: two-way
status: pending
review_on: 2026-11-01
topic: [work]
priv: private
refs: ["[[reviews/weekly/2026-W44]]"]
---

refs 指向了派生物。
`,
  });

  const expect = ['dup-id', 'orphan-refs', 'derived-refs', 'secret-outside', 'belief-falsifier', 'belief-evidence', 'required-fields'];
  const got = analyze(dirty, allBlocks(dirty, { includeSecret: true })).fails.map((f) => f.code);
  const cleanFails = analyze(clean, allBlocks(clean, { includeSecret: true })).fails;

  let ok = true;
  for (const code of expect) {
    const hit = got.includes(code);
    if (!hit) ok = false;
    console.log(`${hit ? '✔' : '✘'} selftest 脏仓库应报 ${code}：${hit ? '报出' : '漏报'}`);
  }
  const cleanOK = cleanFails.length === 0;
  if (!cleanOK) ok = false;
  console.log(`${cleanOK ? '✔' : '✘'} selftest 干净仓库应 0 FAIL：${cleanOK ? '0 处' : `${cleanFails.length} 处（${cleanFails[0].detail}）`}`);

  fs.rmSync(root, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}

const args = parseArgv(process.argv.slice(2));
if (args.selftest) selftest();

let vault;
try {
  vault = findVault(args.vault);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(3);
}

const blocks = allBlocks(vault, { includeSecret: true });
const { fails, warns } = analyze(vault, blocks);

if (args.json) {
  console.log(JSON.stringify({ vault, blocks: blocks.length, fails, warns, ok: fails.length === 0 }, null, 2));
} else {
  console.log(`\n语料体检 · ${vault}\n记录块 ${blocks.length} 个\n`);
  if (fails.length) {
    console.log(`FAIL ${fails.length} 处（真相源被破坏，先修这些）：`);
    for (const f of fails) console.log(`  ✗ [${f.code}] ${f.detail}`);
  } else console.log('FAIL 0 处：id 唯一、refs 无断链、secret 未越界、信念带推翻条件。');
  if (warns.length) {
    console.log(`\nWARN ${warns.length} 处（不阻断提交，但节律/派生层要处理）：`);
    for (const w of warns) console.log(`  · [${w.code}] ${w.detail}`);
  }
  console.log('');
}

process.exit(fails.length ? 1 : 0);

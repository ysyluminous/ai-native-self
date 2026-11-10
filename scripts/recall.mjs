#!/usr/bin/env node
/**
 * recall.mjs —— 跨会话记忆召回："我以前怎么想的 / 上次定过什么"
 *
 *   node scripts/recall.mjs "域名要不要先上"
 *   node scripts/recall.mjs "以前怎么决定买房的" --limit 5
 *
 * 与 search.mjs 的区别：search 给命中行，recall 给**结论形状**（决策的 status 与结论、
 * 信念的置信度与推翻条件、事件的原始倾倒数）。回答历史问题时先跑它，不要用模型常识补。
 * 强制顺序：先库内检索 → 命中就引用 id 与原文 → 没命中就明说"库里没有这条记录"。
 */
import {
  parseArgv,
  findVault,
  allBlocks,
  tokens,
  blockTitle,
  blockDate,
} from './lib.mjs';

const args = parseArgv(process.argv.slice(2));
const limit = Math.max(1, Number(args.limit) || 6);
const json = !!args.json;

let vault;
try {
  vault = findVault(args.vault);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(3);
}

const question = args._.join(' ').trim();
if (!question) {
  console.error(`用法: node scripts/recall.mjs "<问句>" [--limit 6] [--json]`);
  process.exit(2);
}

const blocks = allBlocks(vault, { includeSecret: false });
const qTokens = tokens(question, { dropStop: true });
const phrase = question.toLowerCase();

const score = (b) => {
  const fm = b.fm || {};
  const head = [fm.id, fm.type, blockTitle(b), Array.isArray(fm.topic) ? fm.topic.join(' ') : fm.topic || '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hay = `${head}\n${b.text.toLowerCase()}`;
  let s = 0;
  if (hay.includes(phrase)) s += 8;
  for (const t of qTokens) if (hay.includes(t)) s += t.length >= 2 ? 3 : 1;
  return s;
};

const ranked = blocks
  .map((b) => ({ b, s: score(b) }))
  .filter((x) => x.s > 0)
  .sort((x, y) => y.s - x.s || String(blockDate(y.b)).localeCompare(String(blockDate(x.b))));

const pick = (type) => ranked.filter((x) => String(x.b.fm.type) === type).slice(0, limit);
const decisions = pick('decision');
const beliefs = pick('belief');
const entities = pick('entity');
const events = pick('event');

const firstMeaningful = (b, dropHeading = true) => {
  const lines = b.text.split('\n').filter((l) => l.trim());
  const line = lines.find((l) => (dropHeading ? !l.trim().startsWith('#') : true));
  return (line || '').trim().replace(/^[-*]\s*/, '').slice(0, 100);
};

if (json) {
  console.log(
    JSON.stringify(
      {
        question,
        decisions: decisions.map(({ b, s }) => ({ score: s, id: b.fm.id, date: blockDate(b), status: b.fm.status, question: b.fm.question || '', file: b.file, line: b.line })),
        beliefs: beliefs.map(({ b, s }) => ({ score: s, id: b.fm.id, confidence: b.fm.confidence, status: b.fm.status, claim: b.fm.claim || '', file: b.file, line: b.line })),
        entities: entities.map(({ b, s }) => ({ score: s, id: b.fm.id, name: b.fm.name || '', file: b.file, line: b.line })),
        events: events.map(({ b, s }) => ({ score: s, id: b.fm.id, date: blockDate(b), file: b.file, line: b.line })),
        empty: ranked.length === 0,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(`\n问：${question}\n`);

if (!ranked.length) {
  console.log('库里没有这条记录。');
  console.log('不要用模型常识补一个"你以前大概这么想"——那会把推断写成你的历史。');
  console.log(`可以换个词再查：node scripts/search.mjs "${qTokens.slice(0, 2).join(' ')}"`);
  console.log('先确认检索链路没断：node scripts/search.mjs --selftest\n');
  process.exit(0);
}

if (decisions.length) {
  console.log('## 决策');
  for (const { b } of decisions) {
    console.log(`- ${b.fm.id} · ${blockDate(b)} · status=${b.fm.status || '-'} · ${b.fm.question || blockTitle(b)}`);
    const concl = firstMeaningful(b);
    if (concl) console.log(`  结论/首行：${concl}`);
    if (b.fm.worst_case) console.log(`  最坏值：${String(b.fm.worst_case).slice(0, 90)}`);
    console.log(`  出处：${b.file}:${b.line}`);
  }
  console.log('');
}

if (beliefs.length) {
  console.log('## 当时的判断（belief，带置信度）');
  for (const { b } of beliefs) {
    console.log(`- ${b.fm.id} · confidence=${b.fm.confidence ?? '-'} · status=${b.fm.status || '-'} · ${b.fm.claim || blockTitle(b)}`);
    if (b.fm.falsifier) console.log(`  推翻条件：${String(b.fm.falsifier).slice(0, 90)}`);
  }
  console.log('');
}

if (entities.length) {
  console.log('## 相关实体');
  for (const { b } of entities) console.log(`- ${b.fm.id} · ${b.fm.name || blockTitle(b)}（${b.file}）`);
  console.log('');
}

if (events.length) {
  console.log('## 原始倾倒（Event，原文优先）');
  for (const { b } of events) {
    console.log(`- ${b.fm.id} · ${blockDate(b)} · ${firstMeaningful(b)}`);
    console.log(`  ${b.file}:${b.line}`);
  }
  console.log('');
}

console.log(`（${ranked.length} 处弱相关，未列全部；要更精确就用 search.mjs --type）\n`);

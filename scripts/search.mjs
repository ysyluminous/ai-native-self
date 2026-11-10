#!/usr/bin/env node
/**
 * search.mjs —— 全文检索（grep 之上的可排序版本，无数据库）
 *
 *   node scripts/search.mjs "涨粉" --limit 8
 *   node scripts/search.mjs "预付" --type decision --since 2026-10
 *   node scripts/search.mjs --selftest        # 阳性对照：确认检索链路活着
 *
 * 默认排除 secret/ index/ .git/（与 SKILL.md 协议四的排除清单一致）。
 * 中文按二元切分，所以"预付 50%"这类跨词查询也能命中。
 */
import {
  parseArgv,
  findVault,
  allBlocks,
  tokens,
  readIndex,
  blockTitle,
  blockDate,
} from './lib.mjs';

const args = parseArgv(process.argv.slice(2));
const limit = Math.max(1, Number(args.limit) || 8);
const json = !!args.json;

let vault;
try {
  vault = findVault(args.vault);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(3);
}

const blocks = allBlocks(vault, { includeSecret: false });

if (args.selftest) {
  // 阳性对照：库里必然存在的 id 必须能被检索到；查不到说明链路断了，不能报"0 命中"
  const sample = blocks.find((b) => b.fm.id);
  if (!sample) {
    console.error('FAIL selftest：库里没有任何带 id 的块，先 capture 一条再测');
    process.exit(1);
  }
  const id = String(sample.fm.id);
  const hit = blocks.filter((b) => String(b.fm.id) === id);
  const ok = hit.length === 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} selftest：已知 id ${id} ${ok ? '命中' : '查不到'}（检索链路${ok ? '正常' : '断了'}）`);
  const idx = readIndex(vault);
  console.log(idx ? `索引：${idx.length} 块（index/blocks.jsonl 存在）` : '索引：缺失（下次 capture 会自动重建）');
  process.exit(ok ? 0 : 1);
}

const query = args._.join(' ').trim();
if (!query) {
  console.error(`用法: node scripts/search.mjs "<关键词>" [--limit 8] [--type <t>] [--since YYYY-MM] [--json] [--selftest]`);
  process.exit(2);
}

const phrase = query.toLowerCase();
const qTokens = tokens(query, { dropStop: true });
const typeFilter = args.type ? String(args.type) : '';
const since = args.since ? String(args.since) : '';

function snippetOf(b) {
  const needle = qTokens.find((t) => t.length >= 2) || qTokens[0] || phrase;
  const lines = b.text.split('\n').filter((l) => l.trim());
  const line = lines.find((l) => l.toLowerCase().includes(needle)) || lines[0] || '';
  return line.trim().replace(/^[-*]\s*/, '').slice(0, 110);
}

const scored = [];
for (const b of blocks) {
  const fm = b.fm || {};
  if (typeFilter && String(fm.type || '') !== typeFilter) continue;
  const date = blockDate(b);
  if (since && date && date < since) continue;
  if (since && !date) continue;

  const head = [fm.id, fm.type, fm.date, blockTitle(b), (Array.isArray(fm.topic) ? fm.topic.join(' ') : fm.topic || '')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hay = `${head}\n${b.text.toLowerCase()}`;

  let score = 0;
  if (String(fm.id || '').toLowerCase() === phrase) score += 40;
  if (hay.includes(phrase)) score += 12;
  for (const t of qTokens) {
    if (!hay.includes(t)) continue;
    score += t.length >= 2 ? 3 : 1;
    if (head.includes(t)) score += 2;
  }
  if (score === 0) continue;
  // 时间越新略微加分，避免一屏全是古早记录
  if (date) score += Math.max(0, 3 - (2026 - Number(date.slice(0, 4))));
  scored.push({ b, score, date });
}

scored.sort((x, y) => y.score - x.score || String(y.date).localeCompare(String(x.date)));
const hits = scored.slice(0, limit);

if (json) {
  console.log(
    JSON.stringify(
      hits.map((h) => ({
        score: h.score,
        id: h.b.fm.id || '',
        type: h.b.fm.type || '',
        date: blockDate(h.b),
        file: h.b.file,
        line: h.b.line,
        snippet: snippetOf(h.b),
      })),
      null,
      2,
    ),
  );
} else {
  console.log(`\n${hits.length} 条命中 / 扫描 ${blocks.length} 块 · 关键词「${query}」\n`);
  hits.forEach((h, i) => {
    const fm = h.b.fm;
    console.log(`${i + 1}) ${String(h.score).padStart(3)}分  ${h.b.file}:${h.b.line}  ${fm.id} · ${fm.type}${blockDate(h.b) ? ` · ${blockDate(h.b)}` : ''}`);
    console.log(`     ${snippetOf(h.b)}`);
  });
  if (!hits.length) {
    console.log('库里没有命中。先验一下检索链路再报 0 命中：node scripts/search.mjs --selftest');
  }
  console.log('');
}

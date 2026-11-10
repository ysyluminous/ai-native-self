#!/usr/bin/env node
/**
 * q.mjs —— 具名结构化查询（把"我库里到底有什么、到期了什么"一次问清）
 *
 *   node scripts/q.mjs list
 *   node scripts/q.mjs stats
 *   node scripts/q.mjs decisions-due
 *   node scripts/q.mjs orphan-refs --json
 *
 * 只读。不做写入、不改语料。查询名固定，脚本不猜。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgv,
  findVault,
  allBlocks,
  blockDate,
  blockTitle,
  todayISO,
} from './lib.mjs';

const args = parseArgv(process.argv.slice(2));
const json = !!args.json;
const limit = Math.max(1, Number(args.limit) || 25);

let vault;
try {
  vault = findVault(args.vault);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(3);
}

const today = todayISO();
const blocks = allBlocks(vault, { includeSecret: false });
const ids = new Set(blocks.map((b) => String(b.fm.id || '')).filter(Boolean));
const refList = (b) => {
  const raw = [].concat(b.fm.refs || [], b.fm.sources || []);
  const out = [];
  for (const r of raw) {
    const s = String(r);
    const m = s.match(/\[\[([^\]]+)\]\]/);
    if (m) out.push({ kind: 'id', value: m[1] });
    else if (/^pack:/.test(s)) out.push({ kind: 'pack', value: s });
  }
  return out;
};

const num = (b, k, dflt) => {
  const v = Number(b.fm[k]);
  return Number.isFinite(v) ? v : dflt;
};
const byDateDesc = (x, y) => String(blockDate(y.b)).localeCompare(String(blockDate(x.b)));

const QUERIES = {
  stats: {
    desc: '总量：文件/块/类型/主题分布、最近写入日',
    run: () => {
      const byType = {};
      const byTopic = {};
      const files = new Set();
      for (const b of blocks) {
        files.add(b.file);
        const t = String(b.fm.type || 'unknown');
        byType[t] = (byType[t] || 0) + 1;
        const topics = Array.isArray(b.fm.topic) ? b.fm.topic : b.fm.topic ? [b.fm.topic] : [];
        for (const tp of topics) byTopic[tp] = (byTopic[tp] || 0) + 1;
      }
      const dates = blocks.map(blockDate).filter(Boolean).sort();
      return {
        rows: [
          ['文件数', String(files.size)],
          ['记录块', String(blocks.length)],
          ['最近一条', dates[dates.length - 1] || '无'],
          ...Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => [`type: ${k}`, String(v)]),
          ...Object.entries(byTopic)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([k, v]) => [`topic: ${k}`, String(v)]),
        ],
      };
    },
  },
  'decisions-pending': {
    desc: '还没结论的决策（pending / blocked-on-precondition）',
    run: () => ({
      rows: blocks
        .filter((b) => b.fm.type === 'decision' && ['pending', 'blocked-on-precondition'].includes(String(b.fm.status)))
        .sort(byDateDesc)
        .slice(0, limit)
        .map((b) => [String(b.fm.id), String(b.fm.status), String(b.fm.review_on || '-'), blockTitle(b)]),
      head: ['id', 'status', 'review_on', '问题'],
    }),
  },
  'decisions-due': {
    desc: '到期未复盘的决策（review_on <= 今天）',
    run: () => ({
      rows: blocks
        .filter((b) => {
          if (b.fm.type !== 'decision') return false;
          const r = String(b.fm.review_on || '');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(r)) return false;
          return r <= today && !['done', 'overturned'].includes(String(b.fm.status));
        })
        .sort((x, y) => String(x.fm.review_on).localeCompare(String(y.fm.review_on)))
        .map((b) => [String(b.fm.id), String(b.fm.review_on), String(b.fm.status), blockTitle(b)]),
      head: ['id', 'review_on', 'status', '问题'],
      empty: '没有到期的决策（月审不必补台账）',
    }),
  },
  'beliefs-low': {
    desc: '低置信信念（confidence < 0.5）与缺推翻条件的信念',
    run: () => ({
      rows: blocks
        .filter((b) => b.fm.type === 'belief' && ['held', 'challenged'].includes(String(b.fm.status || 'held')))
        .filter((b) => num(b, 'confidence', 0.5) < 0.5 || !b.fm.falsifier || /待补/.test(String(b.fm.falsifier)))
        .map((b) => [
          String(b.fm.id),
          String(b.fm.confidence ?? '-'),
          /待补/.test(String(b.fm.falsifier || '')) || !b.fm.falsifier ? '缺' : '有',
          blockTitle(b),
        ]),
      head: ['id', 'confidence', 'falsifier', 'claim'],
    }),
  },
  'orphan-refs': {
    desc: '断链：refs 指向的 id 在库里不存在',
    run: () => {
      const rows = [];
      for (const b of blocks) {
        for (const r of refList(b)) {
          if (r.kind !== 'id') continue;
          if (!ids.has(r.value)) rows.push([String(b.fm.id), b.file, r.value]);
        }
      }
      return { rows, head: ['来源 id', 'file', '缺失目标'], empty: '没有断链（refs 全部指向真实存在的块）' };
    },
  },
  untagged: {
    desc: '没有 topic 的记录（检索靠它，缺了就 grep 不到）',
    run: () => ({
      rows: blocks
        .filter((b) => {
          const t = b.fm.topic;
          return !t || (Array.isArray(t) && t.length === 0) || t === '';
        })
        .slice(0, limit)
        .map((b) => [String(b.fm.id), String(b.fm.type), b.file]),
      head: ['id', 'type', 'file'],
      empty: '每条记录都有 topic',
    }),
  },
  'secret-outside': {
    desc: '越界的 secret：priv: secret 却写在 secret/ 之外（.gitignore 拦不住）',
    run: () => ({
      rows: blocks
        .filter((b) => String(b.fm.priv) === 'secret' && !b.file.startsWith('secret/'))
        .map((b) => [String(b.fm.id), b.file]),
      head: ['id', 'file'],
      empty: '没有越界的 secret 块',
    }),
  },
  'inbox-gap': {
    desc: '最近一次倾倒距今几天（中断不算错，如实记 gap）',
    run: () => {
      const events = blocks.filter((b) => b.fm.type === 'event').map(blockDate).filter(Boolean).sort();
      const last = events[events.length - 1];
      if (!last) return { rows: [['状态', 'inbox 里还没有任何 event']] };
      const days = Math.floor((Date.parse(today) - Date.parse(last)) / 86400000);
      return { rows: [['最近倾倒', last], ['距今', `${days} 天`], ['第一条', events[0]]] };
    },
  },
  'reviews-last': {
    desc: '最近一次日/周/月/季复盘是哪天（节律断没断）',
    run: () => {
      const rows = [];
      for (const cadence of ['daily', 'weekly', 'monthly', 'quarterly']) {
        const dir = path.join(vault, 'reviews', cadence);
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
        rows.push([cadence, files.length ? files[files.length - 1] : '从未']);
      }
      return { rows, head: ['节律', '最近一份'] };
    },
  },
  packs: {
    desc: '已装模型包与版本（顾问团只能点名这里的包）',
    run: () => {
      const dir = path.join(vault, 'packs');
      const rows = [];
      if (fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
          const p = path.join(dir, name, 'pack.md');
          if (!fs.existsSync(p)) continue;
          const head = fs.readFileSync(p, 'utf8').slice(0, 1200);
          const g = (k) => (head.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [, '-'])[1].trim();
          rows.push([name, g('kind'), g('version'), g('evidence'), g('maintained-by')]);
        }
      }
      return { rows, head: ['slug', 'kind', 'version', 'evidence', '维护'], empty: '还没装任何包（只有 self 也能跑）' };
    },
  },
};

if (!args._.length || args._[0] === 'list') {
  console.log('\n可用查询：\n');
  for (const [name, q] of Object.entries(QUERIES)) console.log(`  ${name.padEnd(18)} ${q.desc}`);
  console.log('\n用法: node scripts/q.mjs <查询名> [--limit 25] [--json]\n');
  process.exit(0);
}

const name = String(args._[0]);
const q = QUERIES[name];
if (!q) {
  console.error(`没有这个查询：${name}\n先跑 node scripts/q.mjs list`);
  process.exit(2);
}

const res = q.run();
const rows = res.rows || [];

if (json) {
  console.log(JSON.stringify({ query: name, head: res.head || null, rows }, null, 2));
  process.exit(0);
}

console.log(`\n${name} · ${q.desc}\n`);
if (!rows.length) {
  console.log(`  ${res.empty || '无结果'}\n`);
  process.exit(0);
}
if (res.head) {
  const widths = res.head.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)));
  const fmt = (r) => '  ' + r.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(fmt(res.head));
  console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(fmt(r));
} else {
  for (const r of rows) console.log('  ' + r.join('  '));
}
console.log(`\n  共 ${rows.length} 条\n`);

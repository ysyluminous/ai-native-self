#!/usr/bin/env node
/**
 * history.mjs — 跨工具对话召回（读 omnihist 的本地库）
 *
 *   node scripts/history.mjs "协调库为什么改成五段"
 *   node scripts/history.mjs "缓存键" --source codex --limit 5 --json
 *
 * 和 search.mjs / recall.mjs 的分工：
 *   search/recall 查的是这个语料库（Markdown，决策/信念/事件）；
 *   history 查的是你和各个 AI 工具的真实对话（omnihist 收进来的 16 类来源）。
 *
 * 找不到库时不会瞎猜，会明确告诉你先装 omnihist。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();

export function findDb(explicit) {
  const p = explicit || process.env.OMNIHIST_DB || path.join(HOME, '.omnihist', 'omnihist.db');
  return fs.existsSync(p) ? p : null;
}

export async function openHistory(explicit) {
  const dbPath = findDb(explicit);
  if (!dbPath) return { dbPath: null, db: null };
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: true });
    return { dbPath, db };
  } catch {
    return { dbPath, db: null };
  }
}

function ftsQuery(q) {
  const s = String(q || '').trim();
  if (!s) return '""';
  const parts = s.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]|[A-Za-z0-9_]+/g) || [];
  if (!parts.length) return '""';
  return parts.map((t) => `"${t.replace(/"/g, '')}"`).join(' ');
}

export async function searchHistory(question, { limit = 6, source = '', dbPath } = {}) {
  const { db } = await openHistory(dbPath);
  if (!db) return { available: false, hits: [], dbPath: findDb(dbPath) };
  try {
    const cjk = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/.test(question);
    const open = cjk ? '' : '[';
    const close = cjk ? '' : ']';
    const sql = `
      select m.id, m.role, m.created_at, c.id as conversation_id, c.source, c.title,
             snippet(message_fts, 0, ?, ?, '...', 14) as snippet
      from message_fts
      join message m on m.id = message_fts.rowid
      join conversation c on c.id = m.conversation_id
      where message_fts match ?
        ${source ? 'and c.source = ?' : ''}
      order by rank
      limit ?`;
    const args = source ? [open, close, ftsQuery(question), source, limit] : [open, close, ftsQuery(question), limit];
    const hits = db.prepare(sql).all(...args);
    return { available: true, hits, dbPath: findDb(dbPath) };
  } finally {
    db.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  let limit = 6;
  let source = '';
  let json = false;
  let dbPath = '';
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--limit') limit = Number(argv[++i]) || limit;
    else if (a === '--source') source = argv[++i] || '';
    else if (a === '--db') dbPath = argv[++i] || '';
    else words.push(a);
  }
  const question = words.join(' ').trim();
  if (!question) {
    console.error('用法: node scripts/history.mjs "<问句>" [--source <id>] [--limit 6] [--json] [--db <file>]');
    process.exit(2);
  }

  const r = await searchHistory(question, { limit, source, dbPath });
  if (!r.available) {
    console.error('没有找到 omnihist 的库（~/.omnihist/omnihist.db）。');
    console.error('先装并同步：npm i -g github:ysyluminous/omnihist && omnihist sync');
    process.exit(3);
  }
  if (json) {
    console.log(JSON.stringify({ question, db: r.dbPath, hits: r.hits }, null, 2));
    return;
  }
  console.log(`\n问：${question}`);
  console.log(`库：${r.dbPath}\n`);
  if (!r.hits.length) {
    console.log('对话库里没有命中。换个词，或先跑 omnihist sync 把新会话收进来。\n');
    return;
  }
  for (const h of r.hits) {
    const d = h.created_at ? new Date(Number(h.created_at)).toISOString().slice(0, 16).replace('T', ' ') : '';
    console.log(`- [${h.source}] ${d} · ${h.title || '(untitled)'}`);
    console.log(`  ${String(h.snippet || '').replace(/\s+/g, ' ').slice(0, 260)}`);
    console.log(`  id: ${h.conversation_id}`);
  }
  console.log('\n要看全文：omnihist show <id>\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e.message); process.exit(1); });

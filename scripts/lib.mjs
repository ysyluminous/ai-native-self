// 内核共享库 · 零依赖。
// 只做四件事：找仓库、解析 front matter 块、切词、重建派生索引。
// 所有脚本共用这一套解析，避免"每个脚本各自理解 schema"导致的字段漂移。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KERNEL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 派生目录与私密区默认不参与检索（SKILL.md 协议四的排除清单）
export const SKIP_DIRS = new Set(['secret', 'index', '.git', 'node_modules', '.obsidian', '.trash']);

export const toPosix = (p) => p.split(path.sep).join('/');

export function parseArgv(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

// 语料仓库判定：有 inbox/ ，并且是 git 仓库或由 init.mjs 生成过 AGENTS.md
export function findVault(explicit) {
  const start = explicit ? path.resolve(String(explicit)) : process.cwd();
  let dir = start;
  for (;;) {
    const hasInbox = fs.existsSync(path.join(dir, 'inbox'));
    const marked = fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'AGENTS.md'));
    if (hasInbox && marked) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(
    `不是语料仓库：${start}\n需要含 inbox/ 且带 .git/ 或 AGENTS.md 的目录；用 --vault <路径> 显式指定。`,
  );
}

export const pad2 = (n) => String(n).padStart(2, '0');

export const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const stampOf = (iso) => String(iso).replace(/-/g, '');

// ---- front matter -------------------------------------------------------

const FENCE = /^-{3,}\s*$/;

function cleanValue(raw) {
  let v = raw.trim();
  if (!v) return '';
  // 行尾注释：值不是以 # 开头的字符串时才剥
  if (!v.startsWith('#') && /"\s+#/.test(v) === false) {
    const m = v.match(/^(.*?\S)\s+#\s.*$/);
    if (m && !/^["']/.test(m[1])) v = m[1];
  }
  if (/^\[.*\]$/.test(v)) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return v.replace(/^["']|["']$/g, '');
}

export function parseFrontMatter(lines) {
  const fm = {};
  for (const line of lines) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    fm[m[1]] = cleanValue(m[2]);
  }
  return fm;
}

// 一个块 = 一段 front matter（必含 id）+ 其后的正文，直到下一个块开始
export function readBlocks(absFile, relFile) {
  const text = fs.readFileSync(absFile, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (!FENCE.test(lines[i])) continue;
    let hasId = false;
    for (let k = i + 1; k < Math.min(i + 13, lines.length); k++) {
      if (FENCE.test(lines[k])) break;
      if (/^id:\s*\S/.test(lines[k])) {
        hasId = true;
        break;
      }
    }
    if (hasId) starts.push(i);
  }
  const blocks = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    let end = start + 1;
    while (end < lines.length && !FENCE.test(lines[end])) end++;
    const bodyEnd = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const bodyLines = lines.slice(end + 1, bodyEnd);
    const fm = parseFrontMatter(lines.slice(start + 1, end));
    blocks.push({
      file: relFile,
      abs: absFile,
      line: start + 1, // 1-based，指向块首的 ---
      fm,
      body: bodyLines.join('\n').trim(),
      bodyLines,
      text: bodyLines.join('\n'),
    });
  }
  return blocks;
}

export function walkMarkdown(dir, base = '', out = [], opts = {}) {
  for (const name of fs.readdirSync(dir)) {
    if (!opts.includeSecret && SKIP_DIRS.has(name)) continue;
    if (name === 'secret' && !opts.includeSecret) continue;
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) walkMarkdown(abs, rel, out, opts);
    else if (name.endsWith('.md')) out.push({ abs, rel });
  }
  return out;
}

export function allBlocks(vault, opts = {}) {
  const files = walkMarkdown(vault, '', [], opts);
  const blocks = [];
  for (const f of files) {
    try {
      blocks.push(...readBlocks(f.abs, f.rel));
    } catch {
      /* 单文件读不出来不拖垮全库检索 */
    }
  }
  return blocks;
}

// ---- 检索用切词：中文二元 + 英文/数字词 --------------------------------

const STOP_TOKENS = new Set(
  [
    '我', '的', '了', '是', '在', '有', '和', '就', '不', '上', '也', '很', '到', '说', '要', '去', '你', '会',
    '什么', '怎么', '以前', '上次', '定过', '之前', '那个', '这个', '还有', '吗', '呢', '吧', '啊',
  ].map((s) => s),
);

export function tokens(text, { dropStop = false } = {}) {
  const t = String(text || '').toLowerCase();
  const out = new Set();
  for (const w of t.match(/[a-z0-9][a-z0-9._@/-]*/g) || []) {
    if (w.length >= 2) out.add(w);
  }
  for (const run of t.match(/[\u4e00-\u9fff]+/g) || []) {
    if (run.length === 1) {
      if (!dropStop) out.add(run);
      continue;
    }
    for (let i = 0; i + 1 < run.length; i++) {
      const bg = run.slice(i, i + 2);
      if (dropStop && STOP_TOKENS.has(bg)) continue;
      out.add(bg);
    }
    out.add(run); // 整段用于短语加权
  }
  if (dropStop) for (const s of STOP_TOKENS) out.delete(s);
  return [...out];
}

export function blockTitle(b) {
  const fm = b.fm || {};
  if (fm.question) return String(fm.question);
  if (fm.claim) return String(fm.claim);
  if (fm.name) return String(fm.name);
  const firstLine = (b.bodyLines || []).find((l) => l.trim() && !l.trim().startsWith('#'));
  if (firstLine) return firstLine.trim().replace(/^[-*]\s*/, '').slice(0, 80);
  return String(fm.id || '');
}

export function blockDate(b) {
  const fm = b.fm || {};
  return String(fm.date || fm.updated || fm.created || fm.published || '');
}

// ---- 派生索引 ----------------------------------------------------------

export function rebuildIndex(vault) {
  const blocks = allBlocks(vault, { includeSecret: false });
  const dir = path.join(vault, 'index');
  fs.mkdirSync(dir, { recursive: true });
  const rows = blocks.map((b) => ({
    id: b.fm.id || '',
    type: b.fm.type || '',
    date: blockDate(b),
    topic: Array.isArray(b.fm.topic) ? b.fm.topic : b.fm.topic ? [b.fm.topic] : [],
    priv: b.fm.priv || '',
    file: b.file,
    line: b.line,
    title: blockTitle(b),
  }));
  fs.writeFileSync(path.join(dir, 'blocks.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  fs.writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify({ built: new Date().toISOString(), blocks: rows.length, kernel: KERNEL_ROOT }, null, 2) + '\n',
    'utf8',
  );
  return { dir, count: rows.length };
}

export function readIndex(vault) {
  const p = path.join(vault, 'index', 'blocks.jsonl');
  if (!fs.existsSync(p)) return null;
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export const relTo = (vault, abs) => toPosix(path.relative(vault, abs));

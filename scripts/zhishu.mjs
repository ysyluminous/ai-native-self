#!/usr/bin/env node
/**
 * zhishu.mjs — 查智枢检索服务（推文/案例/素材/协调任务/决策）
 *
 *   node scripts/zhishu.mjs "eSIM 怎么开"
 *   node scripts/zhishu.mjs "决策" --json
 *
 * 服务默认在 http://127.0.0.1:8765，可用 ZHISHU_SEARCH_URL 覆盖。
 */
const base = (process.env.ZHISHU_SEARCH_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const args = process.argv.slice(2);
const json = args.includes('--json');
const words = args.filter((a) => a !== '--json');
const query = words.join(' ').trim();

if (!query) {
  console.error('用法: node scripts/zhishu.mjs "<问句>" [--json]');
  process.exit(2);
}

try {
  const url = `${base}/search?` + new URLSearchParams({ q: query, limit: '8' });
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`\n问：${query}\n`);
    if (!data.results.length) console.log('没有命中。\n');
    for (const r of data.results) {
      console.log(`- [${r.label}] ${r.date || ''} · ${r.title || '(untitled)'}`);
      console.log(`  ${String(r.snippet || '').replace(/\s+/g, ' ').slice(0, 240)}`);
      console.log(`  id: ${r.source}:${r.id}`);
    }
    if (data.errors?.length) console.log(`\n${data.errors.length} 个来源报错，服务日志里有细节。`);
    console.log('');
  }
} catch (e) {
  console.error(`智枢检索服务没起来（${base}）：${e.message}`);
  console.error('启动：cd D:\\code\\yunxiao\\zhishu\\search && python run.py');
  process.exit(1);
}

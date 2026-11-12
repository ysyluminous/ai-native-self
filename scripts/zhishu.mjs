#!/usr/bin/env node
/**
 * zhishu.mjs — 查智枢检索服务（推文/CMS/素材/协调任务/决策）
 *
 *   node scripts/zhishu.mjs "eSIM 怎么开"
 *   node scripts/zhishu.mjs "决策" --json
 *
 * 服务没起来时会自动拉起本机 run.py，再查询；可用 ZHISHU_SEARCH_URL 覆盖地址。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.ZHISHU_SEARCH_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const args = process.argv.slice(2);
const json = args.includes('--json');
const words = args.filter((a) => a !== '--json');
const query = words.join(' ').trim();

if (!query) {
  console.error('用法: node scripts/zhishu.mjs "<问句>" [--json]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function healthy() {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureService() {
  if (await healthy()) return true;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base)) return false;
  const home = process.env.ZHISHU_SEARCH_HOME || 'D:\\code\\yunxiao\\zhishu\\search';
  const run = path.join(home, 'run.py');
  if (!fs.existsSync(run)) return false;
  const python = process.env.PYTHON || 'python';
  const child = spawn(python, ['run.py'], {
    cwd: home,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    if (await healthy()) return true;
  }
  return false;
}

try {
  if (!(await ensureService())) {
    throw new Error('服务没有启动，自动拉起也失败');
  }
  const url = `${base}/search?` + new URLSearchParams({ q: query, limit: '8' });
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
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
  console.error(`智枢检索失败（${base}）：${e.message}`);
  console.error('检查：D:\\code\\yunxiao\\zhishu\\search\\run.py 是否可启动');
  process.exit(1);
}

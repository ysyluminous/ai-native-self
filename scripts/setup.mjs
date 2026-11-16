#!/usr/bin/env node
/**
 * setup.mjs — one-command setup for a machine.
 *
 *   node scripts/setup.mjs --vault C:\path\to\ai-native-self
 *   node scripts/setup.mjs --vault <vault> --install-deps --tasks
 *
 * It does five things, idempotently:
 *   1) check Node >= 22 and the vault layout
 *   2) check omnihist; optionally install it from GitHub
 *   3) install this skill into Claude Code / WorkBuddy / Cursor / Codex / Trae
 *   4) run the first omnihist sync
 *   5) on Windows, register the hourly sync + daily digest + daily flywheel tasks
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KERNEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const has = (f) => argv.includes(f);
const DRY = has('--dry');

const vault = resolve((arg('--vault') || process.env.AI_NATIVE_SELF || '').replace(/^~(?=$|[\\/])/, process.env.USERPROFILE || ''));
if (!vault) {
  console.error('用法: node scripts/setup.mjs --vault <语料库路径> [--install-deps] [--tasks] [--dry]');
  process.exit(2);
}
for (const d of ['inbox', 'decisions']) {
  if (!existsSync(join(vault, d))) {
    console.error(`FAIL  不是 ai-native-self 语料库：缺 ${d}/ → ${vault}`);
    process.exit(2);
  }
}

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`FAIL  Node ${process.versions.node}，需要 v22+（node:sqlite）`);
  process.exit(1);
}

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: KERNEL, encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const runLive = (cmd, args) => (spawnSync(cmd, args, { cwd: KERNEL, stdio: 'inherit' }).status ?? 1);
const say = (tag, m) => console.log(`${tag.padEnd(5)} ${m}`);

if (DRY) say('--', '演练模式，不改任何东西');

say('1/5', `语料库 ${vault}`);

const omni = run(process.platform === 'win32' ? 'where' : 'which', ['omnihist']);
say(omni.code === 0 ? 'OK' : 'WARN', omni.code === 0 ? 'omnihist 已安装' : 'omnihist 未安装');
if (omni.code !== 0) {
  if (has('--install-deps') && !DRY) {
    say('--', '安装 omnihist（npm -g github:ysyluminous/omnihist）');
    const code = runLive('npm', ['install', '-g', 'github:ysyluminous/omnihist']);
    if (code !== 0) { say('FAIL', 'omnihist 安装失败，检查网络/代理后重试'); process.exit(1); }
  } else {
    say('--', '跳过安装。要装：npm i -g github:ysyluminous/omnihist');
  }
}

say('2/5', '安装技能到各 AI 工具');
if (!DRY) {
  const code = runLive(process.execPath, [join(KERNEL, 'adapters', 'install.mjs'), '--vault', vault, '--force']);
  if (code !== 0) say('WARN', '部分工具安装失败，上面有明细');
} else say('--', '将运行 adapters/install.mjs --force');

say('3/5', '首次同步对话');
if (!DRY && omni.code === 0) {
  const code = runLive('omnihist', ['sync']);
  if (code !== 0) say('WARN', 'omnihist sync 失败，可稍后手动重跑');
} else say('--', '跳过');

say('4/5', '同步到 PG mem（可选）');
if (!DRY) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const r = run(py, [join(vault, 'scripts', 'sync-mem-pg.py')], { cwd: vault });
  if (r.code !== 0) say('WARN', 'mem 同步失败（本地 PG/mem 库未就绪？）');
  else say('OK', r.out.split('\n').slice(-1)[0] || 'mem 已同步');
} else say('--', '将运行 scripts/sync-mem-pg.py');

say('5/5', 'Windows 计划任务');
if (process.platform === 'win32') {
  if (has('--tasks') && !DRY) {
    const code = runLive('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(KERNEL, 'scripts', 'setup-tasks.ps1'), '-Vault', vault]);
    if (code !== 0) say('FAIL', '计划任务注册失败');
  } else say('--', '加 --tasks 注册同步/摘要/飞轮任务');
} else say('--', '非 Windows，跳过');

console.log(`\n完成。下一步：对任何 AI 说「先查库」，或运行 python scripts/flywheel.py --vault "${vault}"`);

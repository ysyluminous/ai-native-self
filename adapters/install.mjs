#!/usr/bin/env node
/**
 * install.mjs —— 把一个 ai-native-self 语料库接进本机所有 AI 工具
 *
 *   node adapters/install.mjs --vault ~/life
 *   node adapters/install.mjs --vault ~/life --force   # 重渲染、重建链接
 *   node adapters/install.mjs --vault ~/life --dry     # 只看会改什么
 *
 * 只做两件事：
 *   1) 把 SKILL.md.tmpl 渲染成 SKILL.md，写进各工具的 skills 目录
 *   2) 给支持常驻指令文件的工具追加一段指针
 *
 * Trae / Cursor 的常驻规则在自己的设置里，脚本会打印要粘贴的文本。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, lstatSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const lstatIfAny = (p) => { try { return lstatSync(p); } catch { return null; } };
const isDanglingLink = (p) => { const st = lstatIfAny(p); return !!st && st.isSymbolicLink() && !existsSync(p); };

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const NAME = 'ai-native-self-vault';
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const FORCE = argv.includes('--force');

const argOf = (flagName) => {
  const i = argv.indexOf(flagName);
  return i >= 0 ? argv[i + 1] : undefined;
};

let vault = argOf('--vault') || process.env.AI_NATIVE_SELF || '';
if (!vault) {
  console.error('用法: node adapters/install.mjs --vault <你的语料库路径> [--force] [--dry]');
  console.error('也可以设环境变量 AI_NATIVE_SELF。');
  process.exit(1);
}
vault = resolve(vault.replace(/^~(?=$|[\\/])/, HOME));

const need = ['scripts/capture.mjs', 'scripts/search.mjs', 'scripts/q.mjs'].map((p) => join(vault, p));
const missing = need.filter((p) => !existsSync(p));
if (missing.length) {
  console.error(`不是 ai-native-self 语料库：${vault}`);
  for (const m of missing) console.error(`  缺 ${m}`);
  console.error('先跑  node scripts/init.mjs <path>  生成语料库，再回来装。');
  process.exit(1);
}

const template = readFileSync(join(HERE, 'SKILL.md.tmpl'), 'utf8');
const rendered = template.replaceAll('{{VAULT}}', vault);

const MARK_BEGIN = '<!-- ai-native-self-vault:begin -->';
const MARK_END = '<!-- ai-native-self-vault:end -->';
const POINTER = `${MARK_BEGIN}
## 个人原生库（常驻）

个人事实、决策、笔记、产出都在 \`${vault}\`。

- 查：\`node scripts/search.mjs "词"\` / \`node scripts/q.mjs list\` / \`node scripts/recall.mjs "问句"\`
- 写：\`node scripts/capture.mjs "内容" --tool <你的名字> --topic <主题>\`
- 定下方案、跑通流程、产出文件，结束前必须落库；只追加不改历史块；语料不出本机、不进公开仓库。

细则见 skill \`${NAME}\`。
${MARK_END}
`;

const results = [];
const say = (status, label, detail = '') => {
  results.push(status);
  console.log(`${status === 'ok' ? 'OK  ' : status === 'skip' ? '--  ' : 'FAIL'} ${label}  ${detail}`);
};

const pickDir = (base, preferred, fallback) => {
  if (existsSync(join(HOME, base, preferred))) return join(HOME, base, preferred);
  if (fallback && existsSync(join(HOME, base, fallback))) return join(HOME, base, fallback);
  return join(HOME, base, preferred);
};

// 1) skill
const skills = [
  ['Claude Code', join(HOME, '.claude', 'skills', NAME)],
  ['Trae', join(HOME, '.trae', 'skills', NAME)],
  ['WorkBuddy', join(HOME, '.workbuddy', 'skills', NAME)],
  ['Cursor', join(pickDir('.cursor', 'skills', 'skills-cursor'), NAME)],
  ['Codex', join(HOME, '.codex', 'skills', NAME)],
];

for (const [label, dir] of skills) {
  const parent = dirname(dir);
  if (!existsSync(parent)) {
    say('skip', label, `没有 ${parent}`);
    continue;
  }
  try {
    const exists = existsSync(dir);
    if (exists && !FORCE) {
      say('skip', label, '已装过（--force 重装）');
      continue;
    }
    if (DRY) {
      say('ok', label, `将写入 ${join(dir, 'SKILL.md')}`);
      continue;
    }
    if (exists || isDanglingLink(dir)) {
      const st = lstatIfAny(dir);
      if (st && st.isSymbolicLink()) {
        try { unlinkSync(dir); } catch { execFileSync('cmd', ['/c', 'rmdir', '/q', dir], { stdio: 'ignore' }); }
      } else if (st) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), rendered, 'utf8');
    say('ok', label, join(dir, 'SKILL.md'));
  } catch (e) {
    say('fail', label, String(e.message || e).split('\n')[0]);
  }
}

// 2) 常驻指针
const pointers = [
  ['Claude Code', join(HOME, '.claude', 'CLAUDE.md')],
  ['Codex', join(HOME, '.codex', 'AGENTS.md')],
  ['WorkBuddy', join(HOME, '.workbuddy', 'SOUL.md')],
];

for (const [label, file] of pointers) {
  const dir = dirname(file);
  if (!existsSync(dir)) {
    say('skip', `${label} 常驻规则`, `没有 ${dir}`);
    continue;
  }
  try {
    const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (cur.includes(MARK_BEGIN)) {
      if (!FORCE) { say('skip', `${label} 常驻规则`, '已有'); continue; }
      const next = cur.replace(new RegExp(`${MARK_BEGIN}[\\s\\S]*?${MARK_END}\\n?`), POINTER);
      if (!DRY) writeFileSync(file, next, 'utf8');
      say('ok', `${label} 常驻规则`, '已更新');
      continue;
    }
    if (!DRY) appendFileSync(file, (cur ? (cur.endsWith('\n') ? '\n' : '\n\n') : '') + POINTER, 'utf8');
    say('ok', `${label} 常驻规则`, cur ? '已追加' : '已创建');
  } catch (e) {
    say('fail', `${label} 常驻规则`, String(e.message || e).split('\n')[0]);
  }
}

const ok = results.filter((r) => r === 'ok').length;
const skip = results.filter((r) => r === 'skip').length;
const fail = results.filter((r) => r === 'fail').length;
console.log(`\n完成：${ok} 处写入，${skip} 处跳过，${fail} 处失败${DRY ? '（演练，未改文件）' : ''}`);
console.log(`语料库：${vault}\n协议模板：${join(HERE, 'SKILL.md.tmpl')}`);

console.log(`
Trae / Cursor 的常驻规则在自己的设置里，把下面这段贴进「用户规则」：

我的个人事实、决策、笔记、产出都在 ${vault}。
查用 node scripts/search.mjs / q.mjs / recall.mjs；写只用 node scripts/capture.mjs "内容" --tool <工具名> --topic 主题。
定下方案、跑通流程、产出文件，结束前必须落库。
`);
if (fail) process.exit(1);

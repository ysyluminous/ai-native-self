#!/usr/bin/env node
/**
 * score.mjs — 内核自有评测：结构分（0–100），零依赖、可复现
 *
 *   node scripts/score.mjs            # 打分
 *   node scripts/score.mjs --json     # 机器可读
 *   node scripts/score.mjs --min 85   # 低于阈值退出码 1（给 CI / 棘轮用）
 *
 * 说明：这是**静态结构分**，不是效果分。效果要靠 examples 里的人跑一遍看输出。
 * 九维权重照 darwin-skill 的思路裁过：见 docs/evolution.md。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/^\uFEFF/, '') : '');
const list = (p) => (fs.existsSync(path.join(ROOT, p)) ? fs.readdirSync(path.join(ROOT, p)) : []);

const skill = read('SKILL.md');
const kernel = list('kernel').filter((f) => f.endsWith('.md')).map((f) => read(`kernel/${f}`)).join('\n');
const kernelText = `${skill}\n${kernel}`;
const readme = read('README.md');
const capture = read('kernel/capture.md');
const principles = read('kernel/principles.md');
const recordTypes = read('kernel/record-types.md');
const templates = list('templates').filter((f) => f.endsWith('.md'));
const examples = list('examples');

const dims = [];
const add = (id, name, weight, ratio, detail) => dims.push({ id, name, weight, ratio: Math.max(0, Math.min(1, ratio)), detail });

// 1 可执行具体性：模糊措辞越少越好
const vague = (kernelText.match(/建议|可以考虑|根据情况|灵活把握|视情况而定|尽量|大概|或许|看情况/g) || []).length;
add('specificity', '可执行具体性', 15, vague === 0 ? 1 : Math.max(0, 1 - vague / 12), `模糊措辞 ${vague} 处`);

// 2 结构完整性：SKILL 头部 + 四条内核 + 模板齐全
const hasFront = /^---[\s\S]*?\nname:/m.test(skill) && /^---[\s\S]*?\ndescription:/m.test(skill);
const kernelCount = list('kernel').filter((f) => f.endsWith('.md')).length;
const structOK = [hasFront, kernelCount >= 4, templates.length >= 8].filter(Boolean).length;
add('structure', '结构完整性', 15, structOK / 3, `SKILL 头部 ${hasFront ? '有' : '缺'}，内核 ${kernelCount} 篇，模板 ${templates.length} 个`);

// 3 失败模式编码：明确写出失效条件
const falsifiers = (principles.match(/失效|反例|不成立/g) || []).length;
add('failure', '失败模式编码', 12, falsifiers >= 10 ? 1 : falsifiers / 10, `原理里的失效条件/反例 ${falsifiers} 处`);

// 4 高风险黑名单：破坏性操作必须明文列禁
const banned = ['reset --hard', 'force', '公开仓库', '密码', '绝不'];
const bannedHit = banned.filter((w) => kernelText.includes(w)).length;
add('guardrail', '高风险黑名单', 10, bannedHit >= 4 ? 1 : bannedHit / 4, `明文禁用项命中 ${bannedHit}/5`);

// 5 可验证性：能跑的东西在不在
const runnable = ['scripts/init.mjs', 'scripts/lint-packs.mjs', 'scripts/score.mjs', 'examples/README.md']
  .filter((p) => fs.existsSync(path.join(ROOT, p))).length;
add('verifiable', '可验证性', 12, runnable / 4, `可运行/可复现资产 ${runnable}/4`);

// 6 模板与契约一致：每个模板都有 type 字段
const typed = templates.filter((f) => /^---[\s\S]*?type:/m.test(read(`templates/${f}`))).length;
add('contract', '模板与契约一致', 10, templates.length ? typed / templates.length : 0, `带 type 的模板 ${typed}/${templates.length}`);

// 7 隐私护栏：三级隐私 + 独立说明文件
const privLevels = /secret[\s\S]{0,40}private[\s\S]{0,40}public|priv:\s*secret/i.test(capture);
const privDoc = fs.existsSync(path.join(ROOT, 'PRIVACY.md'));
add('privacy', '隐私护栏', 10, [privLevels, privDoc].filter(Boolean).length / 2, `隐私分级 ${privLevels ? '有' : '缺'}，PRIVACY.md ${privDoc ? '有' : '缺'}`);

// 8 无个人数据：公开仓库的底线
const files = [];
const walk = (dir, rel = '') => {
  for (const n of fs.readdirSync(dir)) {
    if (n === '.git' || n === 'node_modules') continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, path.join(rel, n));
    else files.push({ rel: path.join(rel, n), body: fs.readFileSync(p, 'utf8') });
  }
};
walk(ROOT);
const stripCode = (s) => s.replace(/```[\s\S]*?```/g, '');
const EMAIL = new RegExp('[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)*\\.[a-z]{2,}', 'i');
const IPV4 = new RegExp('\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b');
const WINPATH = new RegExp('[A-Za-z]:\\\\{1,2}Users');
const SECRET = new RegExp('s' + 'sh-rsa|mysql' + '://|Bearer\\s+[A-Za-z0-9._-]{20,}');
const leak = files.filter(({ body }) => {
  const t = stripCode(body);
  return EMAIL.test(t) || IPV4.test(t) || WINPATH.test(t) || SECRET.test(t);
});
add('clean', '无个人数据', 8, leak.length === 0 ? 1 : 0, leak.length ? `可疑文件 ${leak.length} 个：${leak.slice(0, 3).map((f) => f.rel).join(', ')}` : '未发现邮箱/内网 IP/本机路径/连接串');

// 9 文档可达：README 讲得清、链接不悬空
const readmeOK = ['安装', '许可证'].filter((w) => readme.includes(w)).length / 2;
const links = [...readme.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).filter((l) => !/^https?:/.test(l) && !l.startsWith('#'));
const broken = links.filter((l) => !fs.existsSync(path.join(ROOT, l.split('#')[0])));
add('docs', '文档可达', 8, (readmeOK + (broken.length === 0 ? 1 : 0)) / 2, `README 要素 ${readmeOK * 2}/2，悬空链接 ${broken.length} 个`);

const total = dims.reduce((s, d) => s + d.weight * d.ratio, 0);
const score = Math.round(total * 10) / 10;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ score, dims: dims.map(({ id, name, weight, ratio }) => ({ id, name, weight, score: Math.round(weight * ratio * 10) / 10 })) }, null, 2));
} else {
  const w = Math.max(...dims.map((d) => d.name.length));
  console.log(`\n内核结构分  ${score} / 100\n`);
  for (const d of dims) {
    const got = (d.weight * d.ratio).toFixed(1).padStart(5);
    console.log(`  ${d.name.padEnd(w)}  ${got} / ${String(d.weight).padStart(2)}   ${d.detail}`);
  }
  console.log('\n这是结构分，不是效果分。效果看 examples/ 的实际输出。\n');
}

const min = Number((process.argv[process.argv.indexOf('--min') + 1] || 0));
if (process.argv.includes('--min') && score < min) {
  console.error(`低于阈值 ${min}，按棘轮规则应回滚这次改动。`);
  process.exit(1);
}

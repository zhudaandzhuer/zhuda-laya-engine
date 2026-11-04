#!/usr/bin/env node
// zhuda-laya-engine (@zhuda-laya/compiler) — Zhuda Doctor (靜態與拓撲相依性體檢工具)
// 1. 掃描 dist/web/index.html 中的 <script> 順序，驗證是否符合 DAG 拓撲規範
// 2. 掃描 src/ 下所有 .ts 檔案是否誤用 Laya 1.x/2.x 廢棄幻覺 API 或未受保護的原型危險操作
// 3. 驗證 AST 自動反射註冊表是否與實際類別一致

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTsFiles, parseReflectableClassesInFile } from './ast-scanner.mjs';
import { TopologyResolver } from './compiler-runtime.mjs';
import { auditAgentContract } from './agent-contract.mjs';
import { auditConsumerSources } from './consumer-guards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const BANNED_HALLUCINATION_PATTERNS = [
  {
    regex: /Laya\.MeshSprite3D\.load\b/g,
    ruleId: 'LAYA2_LEGACY_MESH_LOAD',
    message: '禁止使用 Laya 2.x 的 MeshSprite3D.load，請改用 Laya.loader.load 或 Zhuda3D.createPrimitiveMesh'
  },
  {
    regex: /Laya\.SubShader\.regSubShader\b/g,
    ruleId: 'LAYA2_LEGACY_SUBSHADER',
    message: '禁止使用舊版 SubShader.regSubShader，請使用 Laya 3.4.2 Shader3D.add'
  },
  {
    regex: /new\s+Laya\.WebGL\s*\(/g,
    ruleId: 'LAYA1_LEGACY_WEBGL_INIT',
    message: '禁止使用 Laya 1.x WebGL 建構子，請使用 await ZhudaEngine.boot()'
  }
];

export function runDoctorAudit(options = {}) {
  const root = path.resolve(options.projectRoot ?? process.cwd());
  const srcDir = path.join(root, 'src');
  const htmlPath = path.join(root, 'dist/web/index.html');

  const tsFiles = collectTsFiles(srcDir);
  const sourceFiles = [];
  const collectSources = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) collectSources(file);
      else if (/\.(?:tsx?|jsx?|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) sourceFiles.push(file);
    }
  };
  collectSources(srcDir);
  const scanIssues = sourceFiles.length ? [] : [{
    file: srcDir, line: 1, code: 'EMPTY_SOURCE_SCAN',
    message: `No application source files found in ${srcDir}. Run from the consumer directory or pass --project /path/to/game.`,
  }];
  const apiViolations = [];
  const discoveredComponents = [];

  for (const file of tsFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);

    for (const rule of BANNED_HALLUCINATION_PATTERNS) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(code)) {
        apiViolations.push({
          file: rel,
          ruleId: rule.ruleId,
          message: rule.message
        });
      }
    }

    discoveredComponents.push(...parseReflectableClassesInFile(file));
  }

  let htmlScriptFiles = [];
  let topologyIssues = [];
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const matches = [...html.matchAll(/src="libs\/([^"]+)"/g)];
    htmlScriptFiles = matches.map((m) => m[1]);
    topologyIssues = TopologyResolver.auditFileSequence(htmlScriptFiles);
  }

  const passed = apiViolations.length === 0 && topologyIssues.length === 0;
  const agentContract = auditAgentContract(projectRoot);
  const consumer = root === projectRoot ? { passed: true, issues: [] } : auditConsumerSources(root);
  const allPassed = passed && agentContract.passed && consumer.passed && !scanIssues.length;

  return {
    passed: allPassed,
    projectRoot: root,
    scannedSourceFilesCount: sourceFiles.length,
    scanIssues,
    scannedTsFilesCount: tsFiles.length,
    discoveredComponentsCount: discoveredComponents.length,
    discoveredComponents: discoveredComponents.map((c) => c.className),
    htmlScriptCount: htmlScriptFiles.length,
    topologyIssues,
    apiViolations,
    consumer,
    agentContract
  };
}

const cliArg = process.argv[1] || '';
const modulePath = fileURLToPath(import.meta.url);
const launchedAsCli = Boolean(cliArg) && (path.basename(cliArg) === path.basename(modulePath) ||
  fs.realpathSync(cliArg) === fs.realpathSync(modulePath));
if (launchedAsCli) {
  const projectIndex = process.argv.indexOf('--project');
  if (projectIndex >= 0 && (!process.argv[projectIndex + 1] || process.argv[projectIndex + 1].startsWith('--'))) {
    console.error('--project requires a project directory. Example: zhuda-laya-doctor --project .');
    process.exit(1);
  }
  const report = runDoctorAudit({ projectRoot: projectIndex < 0 ? undefined : process.argv[projectIndex + 1] });
  console.log('🩺 [Zhuda-Doctor] 引擎相依性與 AI 防幻覺體檢報告:');
  console.log(`  • 掃描專案: ${report.projectRoot}`);
  console.log(`  • 應用來源檔案: ${report.scannedSourceFilesCount}`);
  console.log(`  • 掃描 TS 檔案數: ${report.scannedTsFilesCount}`);
  console.log(`  • 反射組件數量:   ${report.discoveredComponentsCount} (${report.discoveredComponents.join(', ')})`);
  console.log(`  • HTML 拓撲模組:  ${report.htmlScriptCount} 個庫 (順序衝突: ${report.topologyIssues.length})`);
  console.log(`  • 廢棄 API 違規:  ${report.apiViolations.length} 處`);
  if (report.consumer.checks) {
    const pin = report.consumer.checks.engineDependency?.value || 'missing';
    console.log(`  • Consumer 路線:   ${report.consumer.checks.publicSdkImport && report.consumer.checks.engineBoot ? 'engine-backed static' : 'incomplete'} (pin: ${pin})`);
  }
  console.log(`  • Agent 契約守衛: ${report.agentContract.issues.length} 處`);
  for (const item of report.scanIssues)
    console.log(`    - [${item.code}] ${item.file}:${item.line}: ${item.message}`);
  for (const item of report.consumer.issues)
    console.log(`    - [${item.code}] ${item.file}:${item.line}: ${item.message}`);
  for (const item of report.agentContract.issues) {
    console.log(`    - [${item.code}] ${item.file}: ${item.message}`);
    if (item.hint) console.log(`      修復: ${item.hint}`);
  }
  console.log(`  • 體檢結論:       ${report.passed ? '✅ HEALTHY (0 阻斷錯誤)' : '❌ FAILED'}`);
  if (!report.passed) {
    process.exit(1);
  }
}

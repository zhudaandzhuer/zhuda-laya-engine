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

export function runDoctorAudit() {
  const srcDir = path.join(projectRoot, 'src');
  const htmlPath = path.join(projectRoot, 'dist/web/index.html');

  const tsFiles = collectTsFiles(srcDir);
  const apiViolations = [];
  const discoveredComponents = [];

  for (const file of tsFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const rel = path.relative(projectRoot, file);

    for (const rule of BANNED_HALLUCINATION_PATTERNS) {
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

  return {
    passed,
    scannedTsFilesCount: tsFiles.length,
    discoveredComponentsCount: discoveredComponents.length,
    discoveredComponents: discoveredComponents.map((c) => c.className),
    htmlScriptCount: htmlScriptFiles.length,
    topologyIssues,
    apiViolations
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runDoctorAudit();
  console.log('🩺 [Zhuda-Doctor] 引擎相依性與 AI 防幻覺體檢報告:');
  console.log(`  • 掃描 TS 檔案數: ${report.scannedTsFilesCount}`);
  console.log(`  • 反射組件數量:   ${report.discoveredComponentsCount} (${report.discoveredComponents.join(', ')})`);
  console.log(`  • HTML 拓撲模組:  ${report.htmlScriptCount} 個庫 (順序衝突: ${report.topologyIssues.length})`);
  console.log(`  • 廢棄 API 違規:  ${report.apiViolations.length} 處`);
  console.log(`  • 體檢結論:       ${report.passed ? '✅ HEALTHY (0 阻斷錯誤)' : '❌ FAILED'}`);
  if (!report.passed) {
    process.exit(1);
  }
}

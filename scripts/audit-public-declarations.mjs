import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const index = process.argv.indexOf('--output');
const output = path.resolve(index < 0 ? path.join(root, 'dist/declaration-audit.json') : process.argv[index + 1]);
const options = { noEmit:true, strict:true, skipLibCheck:false, types:[],
  target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext, moduleResolution:ts.ModuleResolutionKind.Bundler };
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([path.join(root,'packages/types/index.d.ts')], options));
const issues = diagnostics.map(d => ({
  file: d.file ? path.relative(root,d.file.fileName) : null,
  line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
  code:d.code, message:ts.flattenDiagnosticMessageText(d.messageText,'\n'),
}));
const byFile = {};
for (const issue of issues) byFile[issue.file] = (byFile[issue.file] || 0) + 1;
const report = {passed:issues.length===0,typescript:ts.version,options:{strict:true,skipLibCheck:false,types:[]},total:issues.length,byFile,issues};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,total:report.total,byFile,output},null,2));
if(!report.passed) process.exitCode=1;

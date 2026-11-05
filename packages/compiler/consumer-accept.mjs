#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runConsumerBuild } from './consumer-build.mjs';
import { checkPrefab } from './prefab-check.mjs';
import { createPreviewServer } from './prefab-watch.mjs';

import { validatePrefabChecks } from './prefab-checks.mjs';
export { validatePrefabChecks } from './prefab-checks.mjs';

/** Capture never publishes. Acceptance re-builds and verifies the exact candidate before publication. */
export async function acceptConsumer({projectRoot=process.cwd(), engineRoot, capture=false, check=checkPrefab}) {
  projectRoot=path.resolve(projectRoot);
  const config=JSON.parse(fs.readFileSync(path.join(projectRoot,'zhuda.config.json'),'utf8'));
  const selections=validatePrefabChecks(config,projectRoot);
  if (!config.prefabPreview) throw Error('zhuda.config.json: prefabPreview is required');
  const candidate=await runConsumerBuild({projectRoot,engineRoot,config,mode:'candidate'});
  const preview=createPreviewServer({root:candidate.output,host:'127.0.0.1',port:0,reload:false});
  try {
    const address=await preview.listening;
    const reports=[];
    for (const selection of selections) {
      const {baseline,output,maxDiffPixels,...params}=selection;
      const url=`http://127.0.0.1:${address.port}/prefab-preview.html?${new URLSearchParams(params)}`;
      const result=await check({url,baseline:path.resolve(projectRoot,baseline),output:path.resolve(projectRoot,output),
        maxDiffPixels:maxDiffPixels??0,updateBaseline:capture});
      reports.push({id:selection.id,output,passed:result.passed});
      if (!capture && !result.passed) throw Error(`${output}: browser comparison failed; release preserved`);
    }
    if (capture) return {published:false,reason:'Candidate references captured; inspect images, then rerun without --capture',reports};
    // Re-read config too: changing checks/output while testing must not be ignored.
    if (JSON.stringify(config)!==JSON.stringify(JSON.parse(fs.readFileSync(path.join(projectRoot,'zhuda.config.json'),'utf8'))))
      throw Error('Configuration changed during acceptance; release preserved');
    const release=await runConsumerBuild({projectRoot,engineRoot,config,expectedFingerprint:candidate.fingerprint});
    return {published:true,reports,release};
  } finally { await preview.close(); }
}

const launched=process.argv[1] && fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url);
if (launched) {
  const args=process.argv.slice(2), index=args.indexOf('--project');
  acceptConsumer({projectRoot:index<0?process.cwd():args[index+1],capture:args.includes('--capture')})
    .then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}

#!/usr/bin/env node
import { cliMain } from './cli.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  requestedPrefabEnvironment,
  measurePrefabEnvironment,
  auditPrefabEnvironment,
} from './prefab-environment.mjs';
import { requestedPrefabCycles, auditPrefabLifecycle } from './prefab-lifecycle.mjs';
import { selectPrefabDependencyProof } from './prefab-dependencies.mjs';

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
/** Resolve Chrome without assuming a Unix installation path. CHROME_BIN remains
 * the explicit override used by CI and is reported in every browser result. */
export function resolveChromeBinary(explicit = process.env.CHROME_BIN) {
  const candidates = [
    explicit,
    ...(process.platform === 'win32'
      ? [
          process.env.PROGRAMFILES &&
            path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
          process.env['PROGRAMFILES(X86)'] &&
            path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
          process.env.LOCALAPPDATA &&
            path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
          process.env.PROGRAMFILES &&
            path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
          process.env['PROGRAMFILES(X86)'] &&
            path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
          process.env.LOCALAPPDATA &&
            path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe'),
        ]
      : [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
        ]),
  ].filter(Boolean);
  const found = candidates.find((file) => fs.existsSync(file));
  if (found) return found;
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  for (const name of process.platform === 'win32'
    ? ['chrome.exe', 'msedge.exe']
    : ['google-chrome', 'chromium', 'chromium-browser']) {
    const result = spawnSync(command, [name], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const value =
      result.status === 0
        ? String(result.stdout || '')
            .split(/\r?\n/)
            .find(Boolean)
        : undefined;
    if (value && fs.existsSync(value.trim())) return value.trim();
  }
  return undefined;
}

async function terminateBrowser(child, profile) {
  const pid = child?.pid;
  if (pid) {
    if (process.platform === 'win32') {
      // Negative process groups are not supported by Windows. taskkill /T
      // retires Chrome's renderer children as well as the browser process.
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {}
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
    if (child.exitCode === null && child.signalCode === null)
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
  }
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
/** Run an actual browser draw. The consumer exposes the same report bridge in its scene. */
export async function checkPrefab({
  url,
  baseline,
  output,
  updateBaseline = false,
  chromeBinary,
  maxDiffPixels = 0,
  browserTimeoutMs = 30000,
  ...metrics
}) {
  if (!Number.isSafeInteger(maxDiffPixels) || maxDiffPixels < 0)
    throw Error('Invalid pixel tolerance');
  if (
    !Number.isSafeInteger(browserTimeoutMs) ||
    browserTimeoutMs < 5000 ||
    browserTimeoutMs > 180000
  )
    throw Error('Invalid browser timeout');
  const requested = requestedPrefabEnvironment(url, metrics);
  requestedPrefabCycles(url);
  const binary = resolveChromeBinary(chromeBinary);
  if (!binary) throw Error('Chrome unavailable. Set CHROME_BIN.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-prefab-browser-'));
  const child = spawn(
    binary,
    [
      '--headless=new',
      '--use-mock-keychain',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--force-device-scale-factor=1',
      '--window-size=800,600',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { detached: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let ws;
  let environment;
  let phase = 'starting-browser';
  const pending = new Map();
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Chrome startup timeout')), 10000);
      let text = '';
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(Error('Chrome exited before ready'));
      });
      child.stderr.on('data', (chunk) => {
        text += chunk;
        const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(timer);
          resolve(new URL(match[1]));
        }
      });
    });
    phase = 'connecting-devtools';
    const pages = await (await fetch(`http://${endpoint.host}/json/list`)).json();
    ws = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    let serial = 0;
    const errors = [];
    const requests = new Set();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        clearTimeout(request.timer);
        message.error
          ? request.reject(Error(message.error.message))
          : request.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown')
        errors.push(message.params.exceptionDetails.text);
      if (
        message.method === 'Network.responseReceived' &&
        message.params.response.status < 400 &&
        !message.params.response.url.endsWith('/favicon.ico')
      )
        requests.add(message.params.response.url);
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++serial;
        const timer = setTimeout(
          () => {
            pending.delete(id);
            reject(Error(`CDP timeout: ${method}`));
            // A prefab of large models can hold the page's thread for longer than
            // ten seconds while one file is parsed: a command may wait as long as
            // the whole check is allowed to take.
          },
          Math.max(10000, browserTimeoutMs),
        );
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails)
        throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    phase = 'configuring-emulation';
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: requested.viewport.width,
      height: requested.viewport.height,
      deviceScaleFactor: requested.dpr,
      mobile: false,
    });
    phase = 'navigating';
    await send('Page.navigate', { url });
    let report;
    const readyAt = Date.now() + browserTimeoutMs;
    phase = 'waiting-for-prefab';
    while (Date.now() < readyAt) {
      report = await evaluate('window.__ZHUDA_PREFAB_TEST__?.report()');
      if (report?.error) throw Error(report.error);
      if (report?.ready && auditPrefabLifecycle(report, url).passed) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!report?.ready || !report.provenance || errors.length)
      throw Error('Prefab not ready or missing actual instance provenance: ' + errors.join(', '));
    const lifecycleAudit = auditPrefabLifecycle(report, url);
    if (!lifecycleAudit.passed) throw Error(lifecycleAudit.issues.join('; '));
    phase = 'capturing';
    await evaluate(
      'document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))',
    );
    await evaluate('new Promise(resolve=>Laya.timer.frameOnce(4,null,resolve))');
    environment = auditPrefabEnvironment(
      requested,
      await evaluate(`(${measurePrefabEnvironment.toString()})()`),
    );
    if (!environment.passed)
      throw Error('Prefab environment mismatch: ' + environment.issues.join('; '));
    const clip = await evaluate(
      "(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()",
    );
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: true,
    });
    const actual = Buffer.from(shot.data, 'base64');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const actualPath = output + '.png';
    fs.writeFileSync(actualPath, actual);
    phase = 'comparing';
    const manifest = await evaluate(
      "fetch('./payload-manifest.json').then(r=>{if(!r.ok)throw Error('Missing payload manifest');return r.json()})",
    );
    let comparison = { passed: false, reason: 'Baseline updated; rerun comparison after review' };
    if (updateBaseline) {
      fs.mkdirSync(path.dirname(baseline), { recursive: true });
      fs.writeFileSync(baseline, actual);
    } else {
      const expected = fs.readFileSync(baseline).toString('base64');
      comparison = await evaluate(`(async()=>{
        async function pixels(data){
          const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob());
          const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
          const ctx=c.getContext('2d');ctx.drawImage(img,0,0);img.close();
          return {c,ctx,data:ctx.getImageData(0,0,c.width,c.height)};
        }
        const a=await pixels(${JSON.stringify(shot.data)}),b=await pixels(${JSON.stringify(expected)});
        if(a.c.width!==b.c.width||a.c.height!==b.c.height)return {passed:false,reason:'Screenshot dimensions changed'};
        let different=0;
        const diff=a.ctx.createImageData(a.c.width,a.c.height);
        for(let i=0;i<a.data.data.length;i+=4){
          const changed=[0,1,2,3].some(k=>Math.abs(a.data.data[i+k]-b.data.data[i+k])>2);
          if(changed)different++;
          diff.data[i]=changed?255:0;diff.data[i+3]=255;
        }
        a.ctx.putImageData(diff,0,0);
        return {passed:different<=${maxDiffPixels},differentPixels:different,diff:a.c.toDataURL('image/png').split(',')[1]};
      })()`);
      if (comparison.diff)
        fs.writeFileSync(output + '.diff.png', Buffer.from(comparison.diff, 'base64'));
      delete comparison.diff;
    }
    // Re-read after rendering/comparison; the initial ready snapshot can be stale.
    report = await evaluate('window.__ZHUDA_PREFAB_TEST__?.report()');
    const finalLifecycle = auditPrefabLifecycle(report, url);
    if (!report?.ready || report.error || errors.length || !finalLifecycle.passed)
      throw Error(
        'Prefab changed or failed after draw: ' +
          [report?.error, ...errors, ...finalLifecycle.issues].filter(Boolean).join('; '),
      );
    const result = {
      ...report,
      schemaVersion: 2,
      passed: comparison.passed && environment.passed,
      url,
      comparison,
      environment,
      previewEnvironment: report.environment,
      lifecycleAudit: finalLifecycle,
      dependencyProof: selectPrefabDependencyProof(manifest, report, [...requests], url),
      fingerprint: manifest.fingerprint,
      actual: path.basename(actualPath),
      actualSha256: sha(actual),
      baseline: path.relative(path.dirname(output), baseline),
      baselineSha256: sha(fs.readFileSync(baseline)),
      browser: (await send('Browser.getVersion')).product,
    };
    result.renderState = await evaluate(`(()=>{
      const labels=[];
      const walk=n=>{if(typeof Laya.Label==='function'&&n instanceof Laya.Label)labels.push({name:n.name,font:n.font,fontSize:n.fontSize,bold:n.bold,x:n.x,y:n.y,width:n.width,height:n.height,text:n.text,
        padding:n.padding,tf:{font:n.textField.font,fontSize:n.textField.fontSize,width:n.textField.textWidth,height:n.textField.textHeight,x:n.textField.x,y:n.textField.y,scaleX:n.textField.scaleX,scaleY:n.textField.scaleY}});for(let i=0;i<n.numChildren;i++)walk(n.getChildAt(i));};walk(Laya.stage);
      return {labels,scaleX:Laya.stage.clientScaleX,scaleY:Laya.stage.clientScaleY};
    })()`);
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          schemaVersion: 2,
          passed: false,
          url,
          phase,
          browser: binary,
          error: String(error),
          environment: environment || {
            requested,
            measured: null,
            passed: false,
            issues: ['Browser measurement unavailable'],
          },
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    ws?.close();
    for (const request of pending.values()) clearTimeout(request.timer);
    await terminateBrowser(child, profile);
  }
}
const launchedAsCli = cliMain(
  import.meta.url,
  'Usage: zhuda-prefab-check --url=URL --baseline=FILE --output=FILE [--update-baseline]',
);
if (launchedAsCli) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((arg) => arg.startsWith('--') && arg.includes('='))
      .map((arg) => arg.slice(2).split(/=(.*)/s, 2)),
  );
  try {
    if (!args.url || !args.baseline || !args.output)
      throw Error('Use --url=... --baseline=... --output=... [--update-baseline]');
    const result = await checkPrefab({
      ...args,
      maxDiffPixels: Number(args.maxDiffPixels ?? 0),
      browserTimeoutMs: Number(args.browserTimeoutMs ?? 30000),
      updateBaseline: process.argv.includes('--update-baseline'),
    });
    console.log(JSON.stringify(result.comparison));
    if (!result.passed && !process.argv.includes('--update-baseline')) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

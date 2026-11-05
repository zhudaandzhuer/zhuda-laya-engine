#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { requestedPrefabEnvironment, measurePrefabEnvironment, auditPrefabEnvironment } from './prefab-environment.mjs';
import { requestedPrefabCycles, auditPrefabLifecycle } from './prefab-lifecycle.mjs';
import { selectPrefabDependencyProof } from './prefab-dependencies.mjs';

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
/** Run an actual browser draw. The consumer exposes the same report bridge in its scene. */
export async function checkPrefab({ url, baseline, output, updateBaseline = false, chromeBinary, maxDiffPixels = 0, ...metrics }) {
  if (!Number.isSafeInteger(maxDiffPixels) || maxDiffPixels < 0) throw Error("Invalid pixel tolerance");
  const requested = requestedPrefabEnvironment(url, metrics);
  requestedPrefabCycles(url);
  const binary = chromeBinary || process.env.CHROME_BIN || [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium"
  ].find(file => fs.existsSync(file));
  if (!binary) throw Error("Chrome unavailable. Set CHROME_BIN.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zhuda-prefab-browser-"));
  const child = spawn(binary, ["--headless=new", "--use-mock-keychain", "--no-first-run", "--no-default-browser-check",
    "--no-sandbox", "--enable-unsafe-swiftshader", "--force-device-scale-factor=1",
    "--window-size=800,600", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
    { detached: true, stdio: ["ignore", "ignore", "pipe"] });
  let ws;
  let environment;
  const pending = new Map();
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Chrome startup timeout")), 10000);
      let text = "";
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", () => { clearTimeout(timer); reject(Error("Chrome exited before ready")); });
      child.stderr.on("data", chunk => {
        text += chunk;
        const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) { clearTimeout(timer); resolve(new URL(match[1])); }
      });
    });
    const pages = await (await fetch(`http://${endpoint.host}/json/list`)).json();
    ws = new WebSocket(pages.find(page => page.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    let serial = 0;
    const errors = [];
    const requests = new Set();
    ws.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        clearTimeout(request.timer);
        message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.method === 'Network.responseReceived' && message.params.response.status < 400 &&
          !message.params.response.url.endsWith('/favicon.ico')) requests.add(message.params.response.url);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: requested.viewport.width, height: requested.viewport.height,
      deviceScaleFactor: requested.dpr, mobile: false,
    });
    await send("Page.navigate", { url });
    let report;
    for (let i = 0; i < 100; i++) {
      report = await evaluate("window.__ZHUDA_PREFAB_TEST__?.report()");
      if (report?.error) throw Error(report.error);
      if (report?.ready && auditPrefabLifecycle(report, url).passed) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!report?.ready || !report.provenance || errors.length)
      throw Error("Prefab not ready or missing actual instance provenance: " + errors.join(", "));
    const lifecycleAudit = auditPrefabLifecycle(report, url);
    if (!lifecycleAudit.passed) throw Error(lifecycleAudit.issues.join('; '));
    await evaluate("document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");
    await evaluate("new Promise(resolve=>Laya.timer.frameOnce(4,null,resolve))");
    environment = auditPrefabEnvironment(requested, await evaluate(`(${measurePrefabEnvironment.toString()})()`));
    if (!environment.passed) throw Error('Prefab environment mismatch: ' + environment.issues.join('; '));
    const clip = await evaluate("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()");
    const shot = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
    const actual = Buffer.from(shot.data, "base64");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const actualPath = output + ".png";
    fs.writeFileSync(actualPath, actual);
    const manifest = await evaluate("fetch('./payload-manifest.json').then(r=>{if(!r.ok)throw Error('Missing payload manifest');return r.json()})");
    let comparison = { passed: false, reason: "Baseline updated; rerun comparison after review" };
    if (updateBaseline) {
      fs.mkdirSync(path.dirname(baseline), { recursive: true });
      fs.writeFileSync(baseline, actual);
    } else {
      const expected = fs.readFileSync(baseline).toString("base64");
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
      if (comparison.diff) fs.writeFileSync(output + ".diff.png", Buffer.from(comparison.diff, "base64"));
      delete comparison.diff;
    }
    // Re-read after rendering/comparison; the initial ready snapshot can be stale.
    report = await evaluate("window.__ZHUDA_PREFAB_TEST__?.report()");
    const finalLifecycle = auditPrefabLifecycle(report, url);
    if (!report?.ready || report.error || errors.length || !finalLifecycle.passed)
      throw Error('Prefab changed or failed after draw: ' + [report?.error, ...errors, ...finalLifecycle.issues].filter(Boolean).join('; '));
    const result = {
      ...report, schemaVersion: 2, passed: comparison.passed && environment.passed, url, comparison,
      environment, previewEnvironment: report.environment,
      lifecycleAudit: finalLifecycle,
      dependencyProof: selectPrefabDependencyProof(manifest,report,[...requests],url),
      fingerprint: manifest.fingerprint, actual: path.basename(actualPath), actualSha256: sha(actual),
      baseline: path.relative(path.dirname(output), baseline), baselineSha256: sha(fs.readFileSync(baseline)),
      browser: (await send("Browser.getVersion")).product
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
    fs.mkdirSync(path.dirname(output), {recursive:true});
    fs.writeFileSync(output, JSON.stringify({schemaVersion:2, passed:false, url, error: String(error),
      environment: environment || {requested, measured:null, passed:false, issues:['Browser measurement unavailable']}}, null, 2));
    throw error;
  } finally {
    ws?.close();
    for (const request of pending.values()) clearTimeout(request.timer);
    if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch {} }
    if (child.pid) await new Promise(resolve => child.exitCode !== null || child.signalCode !== null ? resolve() : child.once("exit", resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
const cliArg = process.argv[1] || '';
const modulePath = fileURLToPath(import.meta.url);
const launchedAsCli = Boolean(cliArg) && (path.basename(cliArg) === path.basename(modulePath) ||
  fs.realpathSync(cliArg) === fs.realpathSync(modulePath));
if (launchedAsCli) {
  const args = Object.fromEntries(process.argv.slice(2).filter(arg => arg.startsWith("--") && arg.includes("=")).map(arg => arg.slice(2).split(/=(.*)/s, 2)));
  try {
    if (!args.url || !args.baseline || !args.output) throw Error("Use --url=... --baseline=... --output=... [--update-baseline]");
    const result = await checkPrefab({ ...args, maxDiffPixels: Number(args.maxDiffPixels ?? 0), updateBaseline: process.argv.includes("--update-baseline") });
    console.log(JSON.stringify(result.comparison));
    if (!result.passed && !process.argv.includes("--update-baseline")) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

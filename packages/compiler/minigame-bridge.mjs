/** Uses the official public editor build API in a headless CLI script. */
export function officialBridgeSource({target, output, app, libraries, platformSettings, modules = {}}) {
  return String.raw`import fs from 'node:fs';
import path from 'node:path';
@IEditorEnv.regClass()
export class ZhudaMiniGameBuild {
 static async build() {
  const pinned = ${JSON.stringify(libraries)};
  const task = IEditorEnv.BuildTask.start(${JSON.stringify(target)}, ${JSON.stringify(output)}, {
   onSetup(task) {
    Object.assign(task.platformConfig, ${JSON.stringify(platformSettings)});
    Object.assign(task.playerSettings.modules, ${JSON.stringify(modules)});
    for(const file of pinned) if(!task.config.engineLibs.includes(file)) task.config.engineLibs.push(file);
    Object.assign(task.config, {startupScene:'', includedScenes:[], minifyJS:false,
      enableVersion:false, enableSubpackages:false, enableRemoteMainPackage:false,
      disableWebAssembly:true, renderDevice:'webgl', useSafeFileExtensions:false});
   },
   async onStart(task) {
    // The official Xiaomi quick-game CLI 3.4.2 declares webpack as a peer
    // dependency but does not install it.  Install that missing tool in the
    // generated workspace through the public editor utility before the
    // built-in onCreatePackage hook invokes quickgame build.
    if(${JSON.stringify(target)} === 'xmgame') {
      await IEditorEnv.utils.exec('npm', ['install', '--no-save', '--ignore-scripts', 'webpack@5.99.9'], {
       cwd: task.destPath, shell: false, throwIfNonZeroExitCode: true,
       throwIfAborted: true, abortToken: task.abortToken
      });
    }
   },
   onExportScripts(task) {
    const adapters = task.exports.libs.filter(f => /(?:^|\/)laya\.adapter-[^/]+\.js$/.test(f));
    if(adapters.length !== 1) throw new Error('Expected exactly one official platform adapter');
    const selected = [...pinned.map(f => 'libs/'+f), ...adapters];
    for(const file of task.exports.libs) if(!selected.includes(file)) task.exports.files.delete(file);
    task.exports.libs.splice(0, task.exports.libs.length, ...selected);
    task.exports.alternativeLibs.splice(0);
   },
   onCreateManifest(task) {
    const roots = [task.resourcePath, task.destPath, path.join(task.destPath, 'engine')];
    const entryCandidates = roots.map(root => path.resolve(root, task.exports.indexJS));
    const entry = entryCandidates.find(file => fs.existsSync(file));
    if(!entry) throw new Error('Official entry was not emitted: '+task.exports.indexJS);
    const runtimeRoot = path.basename(path.dirname(entry)) === 'js' && path.basename(path.dirname(path.dirname(entry))) === 'engine'
      ? path.dirname(path.dirname(entry)) : task.resourcePath;
    if(!entry.startsWith(path.resolve(runtimeRoot)+path.sep)) throw new Error('Official entry escapes resource directory');
    fs.writeFileSync(entry, fs.readFileSync(${JSON.stringify(app)}));
    fs.writeFileSync(path.join(${JSON.stringify(output)}, 'zhuda-official-build.json'), JSON.stringify({
      schemaVersion:1, platform:task.platform, entry:path.relative(${JSON.stringify(output)}, entry),
      resourcePath:path.relative(${JSON.stringify(output)},runtimeRoot), libraries:task.exports.libs,
      cliVersion:${JSON.stringify('3.4.2')}
    },null,2));
   }
  });
  const status = await task.waitForCompletion();
  if(status !== IEditorEnv.BuildTaskStatus.Success) throw new Error('Official build failed: '+status);
 }
}
`;
}

#!/usr/bin/env node
import { cliMain } from './cli.mjs';
import { createPrefabEditorServer, parsePrefabEditorArgs } from './prefab-editor-server.mjs';
import { createModelEditorServer, parseModelEditorArgs } from './model-editor.mjs';

if (
  cliMain(
    import.meta.url,
    'Usage: zhuda-prefab-editor --project DIRECTORY --prefab assets/FILE.lh [--port PORT] [--preview-controller MODULE] [--allow-remote]',
  )
)
  try {
    const requested =
      process.argv[process.argv.indexOf('--prefab') + 1] ||
      process.argv[process.argv.indexOf('--asset') + 1] ||
      '';
    const model = /\.(?:glb|gltf)$/i.test(requested);
    const args = model ? parseModelEditorArgs() : parsePrefabEditorArgs();
    const editor = model
      ? await createModelEditorServer(args)
      : await createPrefabEditorServer(args);
    const address = await editor.listening;
    const query = [model ? `asset=${encodeURIComponent(args.asset)}` : '', editor.startQuery]
      .filter(Boolean)
      .join('&');
    console.log(`[Zhuda Asset Editor] http://${args.host}:${address.port}/${query ? '?' + query : ''}`);
    if (editor.remote)
      console.warn(
        '[Zhuda Asset Editor] --allow-remote: anyone holding this URL can reach the project. Do not share it.',
      );
    console.log(`[Zhuda Asset Editor] editing ${args.prefab || args.asset}`);
    const stop = async () => {
      await editor.close();
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }

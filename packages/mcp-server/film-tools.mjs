/**
 * MCP tools for film scenes: author a scene as data, change it under revision
 * checks, look at previews and review grids, and render stills or MP4.
 * The browser host starts on the first image request and closes with the server.
 */
import { ZhudaFilmSessions, ZHUDA_FILM_HOST_CONTEXT } from './film-session.mjs';

const camera = {
  type: 'object',
  description: 'eye and target in metres; optional focalLengthMm (35), fStop (8), focusDistanceM',
  properties: {
    eye: { type: 'array', items: { type: 'number' } },
    target: { type: 'array', items: { type: 'number' } },
    focalLengthMm: { type: 'number' },
    fStop: { type: 'number' },
    focusDistanceM: { type: 'number' },
  },
  required: ['eye', 'target'],
};
const session = {
  sessionId: { type: 'string' },
  expectedRevision: {
    type: 'integer',
    description: 'Optional for reads: refuse if the scene has moved on',
  },
};

export const FILM_TOOLS_MANIFEST = [
  {
    name: 'film_scene_create',
    description:
      'Create a film scene session from a ZhudaFilmScene (schemaVersion 1): camera; look (preset day/dawn/dusk/night/overcast, then sky, ambient, sun, shadows, atmosphere, fog overrides, and grade for HDR tone mapping, bloom and ambient occlusion); materials (recipe, or flat colour with optional emission); nodes (prop, box, ground, light point/spot up to 32, reflector: one horizontal rectangle that mirrors the scene above it for wet ground or water, with strength, wetness, roughness, ripple and hides listing ground model ids, and model: a .glb asset id with position, yawDeg, scale and an optional baked .hdr lightmap that carries global illumination through the second UV set of the model). Returns the session id, revision 0 and the props, recipes and assets (--film-assets) this host can use, including operator packs. Data only; no code runs.',
    inputSchema: {
      type: 'object',
      properties: { scene: { type: 'object' } },
      required: ['scene'],
    },
  },
  {
    name: 'film_scene_get',
    description: 'Read a film scene session: its current revision and scene.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: session.sessionId },
      required: ['sessionId'],
    },
  },
  {
    name: 'film_scene_apply',
    description:
      'Change a scene atomically. Give expectedRevision and either a patch ({camera, look, materials, upsert, remove}) or a whole scene. An invalid change or a stale revision leaves the scene unchanged. Set preview:true to get a preview image of the new revision in the same call.',
    inputSchema: {
      type: 'object',
      properties: {
        ...session,
        patch: { type: 'object' },
        scene: { type: 'object' },
        preview: { type: 'boolean' },
      },
      required: ['sessionId', 'expectedRevision'],
    },
  },
  {
    name: 'film_scene_preview',
    description:
      'Render a PNG preview (one sample, real WebGL through the cinematic capture path) at the scene camera or a camera given. Returns the image.',
    inputSchema: {
      type: 'object',
      properties: {
        ...session,
        camera,
        width: { type: 'integer', description: '16..1920, default 640' },
        height: { type: 'integer', description: '16..1920, default 360' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'film_scene_review',
    description:
      'Render one to four labelled shots of the same revision into one PNG grid to compare views. Returns the image and each cell position.',
    inputSchema: {
      type: 'object',
      properties: {
        ...session,
        shots: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, camera },
            required: ['label', 'camera'],
          },
        },
        width: { type: 'integer', description: 'Per shot, 16..1024, default 384' },
        height: { type: 'integer', description: 'Per shot, 16..1024, default 384' },
      },
      required: ['sessionId', 'shots'],
    },
  },
  {
    name: 'film_render_job',
    description:
      'Render final output into the server film directory (--film-output). kind "still": one PNG with anti-aliasing and depth of field (samples, default 16). kind "video": MP4 along cameraPath keys [{time, camera}] starting at 0, eased between keys (fps default 24, samples default 4). Files are never overwritten.',
    inputSchema: {
      type: 'object',
      properties: {
        ...session,
        kind: { type: 'string', enum: ['still', 'video'] },
        name: { type: 'string', description: 'File name without extension: a-z, 0-9, . _ -' },
        camera,
        cameraPath: { type: 'array', items: { type: 'object' } },
        fps: { type: 'integer' },
        durationSec: { type: 'number' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        samples: { type: 'integer', description: '1..64' },
      },
      required: ['sessionId', 'kind', 'name'],
    },
  },
  {
    name: 'film_scene_close',
    description: 'Discard a film scene session.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: session.sessionId },
      required: ['sessionId'],
    },
  },
];

const FILM_TOOL_NAMES = new Set(FILM_TOOLS_MANIFEST.map((tool) => tool.name));
export const isFilmTool = (name) => FILM_TOOL_NAMES.has(name);

let outputDir = process.env.ZHUDA_FILM_OUTPUT || null;
let packs = [];
let assetsDir = null;
let host;
let sessions = new ZhudaFilmSessions();
let context = ZHUDA_FILM_HOST_CONTEXT;

/**
 * `output`: directory render jobs may write into (--film-output).
 * `packs`: operator prop/recipe modules (--film-pack), loaded into the page.
 * `assets`: directory of models (.glb) and lightmaps (.hdr) scenes may name
 * (--film-assets).
 */
export function configureFilmTools({ output, packs: list, assets } = {}) {
  if (output !== undefined) outputDir = output;
  if (assets !== undefined) assetsDir = assets;
  if (list !== undefined) packs = [...list];
}

async function filmHost() {
  if (!host) {
    const { ZhudaFilmHost } = await import('./film-host.mjs');
    host = new ZhudaFilmHost({ outputDir, packs, assets: assetsDir ?? undefined });
  }
  return host;
}

/**
 * With packs, the page reports which props and recipes it can build. The
 * asset list is read from disk on every use, so new exports are accepted
 * without restarting the server; without an asset directory it is empty and
 * model nodes are refused.
 */
async function filmContext() {
  if (context !== ZHUDA_FILM_HOST_CONTEXT) return context;
  let base = ZHUDA_FILM_HOST_CONTEXT;
  const film = packs.length || assetsDir ? await filmHost() : undefined;
  if (packs.length) {
    await film.ready();
    base = { props: film.info.props, recipes: film.info.recipes };
  }
  context = Object.freeze({
    props: base.props,
    recipes: base.recipes,
    get assets() {
      return film ? film.assetList().ids : [];
    },
  });
  sessions = new ZhudaFilmSessions({ context });
  return context;
}

export async function closeFilmTools() {
  const current = host;
  host = undefined;
  await current?.close();
}

const text = (value) => ({ type: 'text', text: JSON.stringify(value, null, 2) });
const image = (png) => ({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });

function current(args) {
  const snapshot = sessions.get(args.sessionId);
  if (args.expectedRevision !== undefined && args.expectedRevision !== snapshot.revision)
    throw Error(
      `Stale revision: expected ${args.expectedRevision}, current ${snapshot.revision}. Read the scene again.`,
    );
  return snapshot;
}

/** Returns MCP content blocks; images are PNG. */
export async function executeFilmTool(name, args = {}) {
  switch (name) {
    case 'film_scene_create': {
      await filmContext();
      const created = sessions.create(args.scene);
      return [
        text({
          tool: name,
          sessionId: created.sessionId,
          revision: created.revision,
          props: context.props,
          recipes: context.recipes,
          assets: context.assets,
        }),
      ];
    }
    case 'film_scene_get': {
      const snapshot = sessions.get(args.sessionId);
      return [text({ tool: name, ...snapshot })];
    }
    case 'film_scene_apply': {
      if ((args.patch === undefined) === (args.scene === undefined))
        throw Error('Give either patch or scene');
      const next =
        args.scene !== undefined
          ? sessions.replace(args.sessionId, args.expectedRevision, args.scene)
          : sessions.apply(args.sessionId, args.expectedRevision, args.patch);
      const result = text({ tool: name, sessionId: next.sessionId, revision: next.revision });
      if (!args.preview) return [result];
      const preview = await (await filmHost()).preview(next.scene, {});
      return [image(preview.png), result];
    }
    case 'film_scene_preview': {
      const snapshot = current(args);
      const preview = await (
        await filmHost()
      ).preview(snapshot.scene, {
        camera: args.camera,
        width: args.width,
        height: args.height,
      });
      return [
        image(preview.png),
        text({
          tool: name,
          sessionId: snapshot.sessionId,
          revision: snapshot.revision,
          batches: preview.batches,
          renderMs: preview.renderMs,
          scope: 'one-sample preview through ZhudaCinematicCapture; not a final render',
        }),
      ];
    }
    case 'film_scene_review': {
      const snapshot = current(args);
      const grid = await (
        await filmHost()
      ).review(snapshot.scene, {
        shots: args.shots,
        width: args.width,
        height: args.height,
      });
      return [
        image(grid.png),
        text({
          tool: name,
          revision: snapshot.revision,
          width: grid.width,
          height: grid.height,
          cells: grid.cells,
        }),
      ];
    }
    case 'film_render_job': {
      const snapshot = current(args),
        film = await filmHost();
      const options = {
        name: args.name,
        width: args.width,
        height: args.height,
        samples: args.samples,
      };
      const result =
        args.kind === 'still'
          ? await film.still(snapshot.scene, { ...options, camera: args.camera })
          : args.kind === 'video'
            ? await film.video(snapshot.scene, {
                ...options,
                cameraPath: args.cameraPath,
                fps: args.fps,
                durationSec: args.durationSec,
              })
            : (() => {
                throw Error('kind must be still or video');
              })();
      return [text({ tool: name, kind: args.kind, revision: snapshot.revision, ...result })];
    }
    case 'film_scene_close':
      return [text({ tool: name, closed: sessions.close(args.sessionId) })];
    default:
      throw Error(`Unknown film tool: ${name}`);
  }
}

// Neutral engine-authored lens chart and animation fixture. No game assets.
import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaModelLibrary,
  ZhudaModelInspector,
  DirectoryAssetProvider,
  ZhudaModelAnimationSampler,
  ZhudaPhysicalCameraRig,
  ZhudaCinematicCapture,
  ZhudaFilmicPipeline,
  IframeSoundAdapter,
  inspectSceneResources,
  type PrefabTree3D,
} from "zhuda-laya-engine";
async function start() {
  const context = await ZhudaEngine.boot({
    container: "#game",
    width: 640,
    height: 360,
    dprCap: 3,
    features: ["core", "2d", "3d", "gltf", "postProcess"],
    preserveDrawingBuffer: true,
  });
  const scene = Zhuda3D.createScene3D(context.rootScene),
    camera = Zhuda3D.createCamera(scene, {
      position: [0, 0, 5],
      clearColor: [0.04, 0.04, 0.04, 1],
    });
  const chartSpec: PrefabTree3D = {
    materials: {
      white: { type: "unlit", albedoColor: [1, 1, 1, 1] },
      red: { type: "unlit", albedoColor: [1, 0, 0, 1] },
      blue: { type: "unlit", albedoColor: [0, 0, 1, 1] },
      yellow: { type: "unlit", albedoColor: [1, 1, 0, 1] },
    },
    root: {
      name: "LensChart",
      children: [
        ...[-1, 0, 1].flatMap((x, i) =>
          Array.from({ length: 7 }, (_, k) => ({
            name: "bar" + i + "_" + k,
            mesh: {
              type: "box" as const,
              dimensions: { width: 0.025, height: 0.5, depth: 0.01 },
            },
            material: "white",
            localPosition: [x + (k - 3) * 0.045, 0.35, [2, 0, -2][i]] as [
              number,
              number,
              number,
            ],
          })),
        ),
        {
          name: "Top",
          mesh: {
            type: "box",
            dimensions: { width: 0.4, height: 0.08, depth: 0.01 },
          },
          material: "blue",
          localPosition: [0, 0.9, 0],
        },
        {
          name: "Bottom",
          mesh: {
            type: "box",
            dimensions: { width: 0.4, height: 0.08, depth: 0.01 },
          },
          material: "yellow",
          localPosition: [0, -0.9, 0],
        },
        {
          name: "Mover",
          mesh: { type: "sphere", dimensions: { radius: 0.1 } },
          material: "red",
          localPosition: [-1, -0.7, 1],
        },
      ],
    },
  };
  const chart = Zhuda3D.buildPrefabTree(chartSpec);
  scene.addChild(chart.root);
  const provider = new DirectoryAssetProvider({ baseUrl: "./assets/" }),
    library = new ZhudaModelLibrary({ provider, maxIdle: 0 });
  let model = await library.instantiate("multi-linear-skin.gltf");
  scene.addChild(model.node);
  let inspector = new ZhudaModelInspector(model);
  let animation = inspector.inspect().animations[0];
  let sampler = new ZhudaModelAnimationSampler(
    model,
    animation.path,
    animation.name,
    animation.layer,
  );
  const lens = new ZhudaPhysicalCameraRig(camera, {
    focalLengthMm: 50,
    fStop: 1,
    focusDistanceM: 5,
    shutterAngle: 180,
  });
  context.runtime.start(() => {});
  context.runtime.setPaused(true);
  let capture: ZhudaCinematicCapture | undefined;
  const setup = (width = 640, height = 360) => {
    capture?.dispose();
    capture = new ZhudaCinematicCapture(scene, lens, context.runtime, {
      width,
      height,
    });
  };
  setup();
  const pose = (seconds: number) => {
    sampler.sample(seconds);
    const p = chart.find("Mover").transform.localPosition.clone();
    p.x = -1 + seconds * 8;
    chart.find("Mover").transform.localPosition = p;
  };
  const encode = (frame: {
    width: number;
    height: number;
    rgba: Uint8Array;
  }) => {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(frame.rgba),
          frame.width,
          frame.height,
        ),
        0,
        0,
      );
    return canvas.toDataURL();
  };
  const png = async (
    index: number,
    samples = 1,
    aperture = true,
    motion = true,
  ) =>
    encode(
      await capture!.renderFrame({
        index,
        fps: 24,
        samples,
        aperture,
        sample: (t) => pose(motion ? t : index / 24),
      }),
    );
  const audio = new IframeSoundAdapter({
    sampleProvider: provider,
    maxActiveVoices: 24,
  });
  await audio.loadSample("tone.wav");
  await audio.loadSample("score.wav");
  const bytes = (b: Uint8Array) => {
    let s = "";
    for (let i = 0; i < b.length; i += 8192)
      s += String.fromCharCode(...b.subarray(i, i + 8192));
    return btoa(s);
  };
  Object.assign(window, {
    cinema: {
      ready: true,
      setup,
      png,
      async modelPng(time: number) {
        chart.root.active = false;
        try {
          return encode(
            await capture!.renderFrame({
              index: 0,
              fps: 24,
              sample: () => sampler.sample(time),
            }),
          );
        } finally {
          chart.root.active = true;
        }
      },
      report: () => ({
        renderer: context.renderer,
        models: library.report(),
        resources: inspectSceneResources(),
        audio: audio.getDiagnostics(),
      }),
      async sample(id: string, seconds: number, loop = false) {
        sampler.dispose();
        model.dispose();
        model = await library.instantiate(id);
        scene.addChild(model.node);
        inspector = new ZhudaModelInspector(model);
        animation = inspector.inspect().animations[0];
        sampler = new ZhudaModelAnimationSampler(
          model,
          animation.path,
          animation.name,
          animation.layer,
        );
        sampler.sample(seconds, loop);
        return {
          inspection: inspector.inspect(),
          nodes: inspector
            .inspect()
            .nodes.map((n) => ({
              name: n.name,
              position: [
                inspector.node(n.path).transform.localPosition.x,
                inspector.node(n.path).transform.localPosition.y,
                inspector.node(n.path).transform.localPosition.z,
              ],
            })),
        };
      },
      async audio(muted = false) {
        audio.setChannelVolume("master", 0.5);
        audio.setChannelVolume("bgm", 0.4);
        audio.setMuted(muted);
        const result = await audio.renderOffline({
          durationSec: 1,
          sampleRate: 48000,
          channels: 2,
          cues: [
            {
              id: "score",
              sampleId: "tone.wav",
              atSec: 0.125,
              durationSec: 0.75,
              loop: true,
              channel: "bgm",
              fadeInSec: 0.125,
              fadeOutSec: 0.125,
            },
          ],
        });
        return { ...result, wav: bytes(result.wav) };
      },
      async score() {
        audio.setMuted(false);
        return bytes(
          (
            await audio.renderOffline({
              durationSec: 1,
              cues: [
                {
                  id: "note",
                  sampleId: "score.wav",
                  atSec: 0,
                  durationSec: 1,
                  channel: "bgm",
                  fadeInSec: 0.05,
                  fadeOutSec: 0.1,
                },
              ],
            })
          ).wav,
        );
      },
      async filmic() {
        const pipeline = new ZhudaFilmicPipeline(camera, {
          ao: false,
          bloom: false,
        });
        try {
          lens.applyExposure(pipeline, 24);
          return await png(0);
        } finally {
          pipeline.dispose();
        }
      },
      async lifecycle() {
        capture?.dispose();
        capture = undefined;
        const rows = [];
        for (let i = 0; i < 30; i++) {
          setup(64, 64);
          await png(0);
          capture!.dispose();
          capture = undefined;
          rows.push(inspectSceneResources());
        }
        setup();
        return rows;
      },
      dispose() {
        capture?.dispose();
        lens.dispose();
        sampler.dispose();
        model.dispose();
        chart.dispose();
        audio.dispose();
        library.dispose();
        provider.dispose();
        const resources = inspectSceneResources();
        context.dispose();
        return resources;
      },
    },
  });
}
start().catch((error) =>
  Object.assign(window, {
    cinema: {
      ready: false,
      error: String(error),
      stack: (error as Error).stack,
    },
  }),
);

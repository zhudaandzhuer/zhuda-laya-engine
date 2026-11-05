import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaCameraCoordinates,
  ZhudaPointerInput,
  ZhudaPrefabLibrary,
  DirectoryAssetProvider,
  IframeSoundAdapter,
  ZhudaWorkerFrameDriver,
  inspectPrefabInstance,
  inspectSceneResources,
} from "zhuda-laya-engine";
import type {
  IframeSampleBackend,
  IframeBackendVoice,
  IframeSampleOptions,
  AssetProvider,
} from "zhuda-laya-engine";
const params = new URLSearchParams(location.search),
  cap = Number(params.get("cap") ?? 3);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)); // browser acceptance wait, not gameplay time
import { definitions } from "./prefabs";
async function main() {
  const container = document.querySelector<HTMLElement>("#game")!;
  const context = await ZhudaEngine.boot({
    container,
    dprCap: cap,
    designSize: params.has("fixed") ? { width: 320, height: 180 } : undefined,
    features: ["core", "2d", "3d", "ui"],
    bgColor: "#152030",
    driver: new ZhudaWorkerFrameDriver(),
    backgroundPolicy: "continue",
    recoveryPolicy: "bounded",
  });
  const provider = new DirectoryAssetProvider({
    baseUrl: "./assets/",
    streamMode: "native",
  });
  const library = new ZhudaPrefabLibrary({ provider, definitions });
  const instance = await library.instantiate("plate");
  context.rootScene.addChild(instance.root);
  let clicks: unknown[] = [];
  instance
    .find("plate")
    .on(Laya.Event.MOUSE_DOWN, () =>
      clicks.push({ x: Laya.stage.mouseX, y: Laya.stage.mouseY }),
    );
  const scene = Zhuda3D.createScene3D(context.rootScene, {
    ambientColor: [0.7, 0.7, 0.7, 1],
  });
  const camera = Zhuda3D.createCamera(scene, {
    position: [0, 0, 5],
    clearColor: [0.08, 0.12, 0.18, 1],
  });
  const coordinates = new ZhudaCameraCoordinates(camera, () => {
    const r = context.canvas.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      backingWidth: context.canvas.width,
      backingHeight: context.canvas.height,
    };
  });
  const tree = Zhuda3D.buildPrefabTree({
    materials: { box: { type: "unlit", albedoColor: [0.3, 0.7, 0.4, 1] } },
    root: {
      name: "Box",
      mesh: { type: "box", dimensions: { width: 1, height: 1, depth: 1 } },
      material: "box",
    },
  });
  scene.addChild(tree.root);
  // Keep the independent 2D fixture on top of the neutral 3D draw.
  context.rootScene.setChildIndex(
    instance.root,
    context.rootScene.numChildren - 1,
  );
  let input: ZhudaPointerInput | undefined;
  const events: unknown[] = [];
  const audio = new IframeSoundAdapter({
    sampleProvider: provider,
    maxActiveVoices: 24,
    voiceOverflow: "fifo",
    onVoiceEvent: (event) => events.push(event),
  });
  document
    .querySelector("#unlock")!
    .addEventListener("click", () => audio.unlockAudio("browser-click"));
  let ticks = 0;
  context.runtime.start(() => ticks++);
  const heap = () => {
    const memory = (performance as Performance & {memory?:{usedJSHeapSize:number,totalJSHeapSize:number}}).memory;
    return memory ? {usedJSHeapSize:memory.usedJSHeapSize,totalJSHeapSize:memory.totalJSHeapSize} : null;
  };
  const mediaAudit = async () => {
    const heapBefore=heap();
    await audio.loadStream("long.wav");
    audio.playStream({ id: "music", streamId: "long.wav", loop: true });
    await wait(150);
    const playing = audio.getDiagnostics(), heapPlaying=heap();
    audio.handleFocusOrVisibilityChange(false, false);
    await wait(30);
    const hidden = audio.getDiagnostics();
    audio.handleFocusOrVisibilityChange(true, true);
    await wait(50);
    const resumed = audio.getDiagnostics();
    audio.playStream({
      id: "music",
      streamId: "long.wav",
      loop: true,
      replace: true,
      crossFadeSec: 0.03,
    });
    await wait(100);
    const switched = audio.getDiagnostics();
    audio.unloadStream("long.wav");
    for (let i = 0; i < 30; i++) {
      await audio.loadStream("tone.wav");
      audio.playStream({ id: "cycle", streamId: "tone.wav" });
      await wait(12);
      audio.unloadStream("tone.wav");
    }
    return {
      playing,
      heap:{before:heapBefore,playing:heapPlaying,after:heap(),scope:"Chrome JS heap; excludes native decoder/media buffers"},
      hidden,
      resumed,
      switched,
      after: audio.getDiagnostics(),
      events,
    };
  };
  const backendAudit = async () => {
    const messages: unknown[] = [];
    const nodes = new Set<AudioWorkletNode>();
    let ctx: AudioContext;
    const backend: IframeSampleBackend = {
      name: "reference-worklet",
      async prepare({ context, provider, signal }) {
        ctx = context;
        if (!context.audioWorklet) throw Error("AudioWorklet unavailable");
        const asset = await provider.load("processor.js", { signal });
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(asset.bytes)], {
            type: "application/javascript",
          }),
        );
        try {
          await context.audioWorklet.addModule(url);
          if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        } finally {
          URL.revokeObjectURL(url);
          asset.release?.();
        }
      },
      createVoice(
        buffer: AudioBuffer,
        options: Readonly<IframeSampleOptions>,
      ): IframeBackendVoice {
        const node = new AudioWorkletNode(ctx, "neutral-sample");
        nodes.add(node);
        const voice: IframeBackendVoice = {
          output: node,
          onended: null,
          start(when, offset) {
            const data = buffer.getChannelData(0).slice();
            node.port.postMessage(
              {
                type: "start",
                data,
                rate: buffer.sampleRate,
                when,
                offset,
                loop: options.loop,
              },
              [data.buffer],
            );
          },
          stop(when = ctx.currentTime) {
            node.port.postMessage({ type: "stop", when });
          },
          disconnect() {
            node.disconnect();
            node.port.close();
            nodes.delete(node);
          },
        };
        node.port.onmessage = (event) => {
          messages.push(event.data);
          if (event.data.type === "ended") voice.onended?.();
        };
        return voice;
      },
      dispose() {
        for (const node of nodes) {
          node.disconnect();
          node.port.close();
        }
        nodes.clear();
      },
    };
    await audio.prepareSampleBackend(backend);
    await audio.loadSample("tone.wav");
    audio.playSample({ id: "worklet", sampleId: "tone.wav", loop: true });
    await wait(100);
    const before = performance.now();
    while (performance.now() - before < 250) {}
    await wait(150);
    const active = audio.getDiagnostics();
    audio.stop("worklet", 0.02);
    await wait(60);
    audio.unloadSample("tone.wav");
    return {
      messages,
      active,
      after: audio.getDiagnostics(),
      nodes: nodes.size,
      busyMs: 250,
    };
  };
  const bridge = {
    ready: true,
    measure: () => ({
      dpr: devicePixelRatio,
      canvas: {
        width: context.canvas.width,
        height: context.canvas.height,
        rect: context.canvas.getBoundingClientRect().toJSON(),
      },
      stage: {
        width: Laya.stage.width,
        height: Laya.stage.height,
        scaleX: Laya.stage.clientScaleX,
        scaleY: Laya.stage.clientScaleY,
      },
      clicks,
      ticks,
      pointers: input ? [...input.pointers.values()] : [],
      projected: coordinates.worldToScreen({ x: 0, y: 0, z: 0 }),
      ray: coordinates.screenToRay(
        context.canvas.getBoundingClientRect().left +
          context.canvas.getBoundingClientRect().width / 2,
        context.canvas.getBoundingClientRect().top +
          context.canvas.getBoundingClientRect().height / 2,
      ),
      resources: inspectSceneResources(),
      provenance: inspectPrefabInstance(instance.root),
    }),
    mediaAudit,
    backendAudit,
    pointers: (active: boolean) => {
      input?.dispose();
      input = active
        ? new ZhudaPointerInput(
            context.canvas,
            (event) => (event.clientX < 200 ? "left" : "right"),
            () => {},
          )
        : undefined;
    },
    background: (value: boolean) =>
      window.dispatchEvent(new Event(value ? "blur" : "focus")),
    resize: (width: number, height: number) => {
      container.style.width = width + "px";
      container.style.height = height + "px";
      context.resize();
    },
    clip: (value: boolean) => {
      instance.root.scrollRect = value
        ? new Laya.Rectangle(0, 0, 80, 60)
        : null;
    },
    dispose: () => {
      input?.dispose();
      audio.dispose();
      library.dispose();
      tree.dispose();
      provider.dispose();
      context.dispose();
      return audio.getDiagnostics();
    },
  };
  Reflect.set(window, "runtimeAudit", bridge);
}
void main().catch((error) =>
  Reflect.set(window, "runtimeError", String(error)),
);

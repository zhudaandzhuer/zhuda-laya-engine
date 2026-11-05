// Neutral acceptance processor, not the engine's production mixer.
class NeutralSample extends AudioWorkletProcessor {
  constructor() {
    super();
    this.data = null;
    this.pos = 0;
    this.startAt = Infinity;
    this.stopAt = Infinity;
    this.blocks = 0;
    this.last = -1;
    this.maxGap = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "start") {
        this.data = data.data;
        this.rate = data.rate;
        this.pos = data.offset * this.rate;
        this.loop = !!data.loop;
        this.startAt = data.when;
        this.stopAt = Infinity;
      } else if (data.type === "stop") this.stopAt = data.when;
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    const n = out[0]?.length || 128;
    // Exclude graph construction before the first playable sample.
    const active = this.data && currentTime >= this.startAt && currentTime < this.stopAt;
    if (active && this.last >= 0)
      this.maxGap = Math.max(this.maxGap, currentFrame - this.last - n);
    this.last = active ? currentFrame : -1;
    if (active) this.blocks++;
    for (let i = 0; i < n; i++) {
      const time = (currentFrame + i) / sampleRate;
      let value = 0;
      if (this.data && time >= this.startAt) {
        if (time >= this.stopAt) {
          this.data = null;
          this.port.postMessage({ type: "ended" });
        } else {
          if (this.pos >= this.data.length) {
            if (this.loop) this.pos %= this.data.length;
            else {
              this.data = null;
              this.port.postMessage({ type: "ended" });
            }
          }
          if (this.data) {
            value = this.data[Math.floor(this.pos)] || 0;
            this.pos += this.rate / sampleRate;
          }
        }
      }
      for (const channel of out) channel[i] = value;
    }
    if (active && this.blocks % 32 === 0)
      this.port.postMessage({
        type: "progress",
        blocks: this.blocks,
        frame: currentFrame,
        maxGapFrames: this.maxGap,
      });
    return true;
  }
}
registerProcessor("neutral-sample", NeutralSample);

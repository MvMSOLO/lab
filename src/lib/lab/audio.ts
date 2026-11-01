import type { EnvId, RoomId } from "@/lib/lab/catalog";

type BusName = "music" | "fx";
type SceneName = "lab" | RoomId;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * All sound is synthesized in the Web Audio API.
 * Nothing is streamed, sampled from a recording, or loaded from the network.
 */
export class LabAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFade!: GainNode;
  private fxGain!: GainNode;
  private reverbGain!: GainNode;
  private delay!: DelayNode;
  private delayGain!: GainNode;
  private delayFeedback!: GainNode;
  private convolver!: ConvolverNode;

  private env: EnvId = "dream";
  private masterVol = 0.62;
  private musicVol = 0.42;
  private fxVol = 0.7;
  private muted = false;
  private sceneMul = 1;
  private musicOn = false;
  private timer = 0;
  private fadeToken = 0;
  private chordIndex = 0;
  private activeFx = 0;
  private noiseBuf: AudioBuffer | null = null;
  private bedOsc: OscillatorNode[] = [];
  private bedNodes: AudioNode[] = [];
  private bedSources: AudioBufferSourceNode[] = [];
  private hold: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private carrier: OscillatorNode | null = null;
  private carrierNodes: AudioNode[] = [];

  isReady(): boolean {
    return this.ctx !== null;
  }

  prime(env: EnvId): void {
    this.env = env;
  }

  unlock(): void {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume();
  }

  poke(settings: { master: number; music: number; fx: number; muted: boolean; env: EnvId }): void {
    this.unlock();
    this.setVolumes(settings.master, settings.music, settings.fx, settings.muted);
    if (this.env !== settings.env) this.setEnvironment(settings.env);
    else this.ensureMusic();
  }

  setVolumes(master: number, music: number, fx: number, muted: boolean): void {
    this.masterVol = clamp01(master);
    this.musicVol = clamp01(music);
    this.fxVol = clamp01(fx);
    this.muted = muted;
    if (this.ctx) this.applyGains();
  }

  setEnvironment(env: EnvId): void {
    const same = this.env === env;
    this.env = env;
    if (!this.ctx) return;
    this.applyGains();
    if (env === "silent") {
      this.fadeTo(0, () => {
        if (this.env === "silent") this.stopMusic();
      });
      return;
    }
    if (same && this.musicOn) return;
    if (!this.musicOn) {
      this.musicFade.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicFade.gain.value = 0;
      this.ensureMusic();
      this.fadeTo(1);
      return;
    }
    this.fadeTo(0, () => {
      if (this.env !== env) return;
      this.clearBeds();
      this.startBeds();
      this.fadeTo(1);
    });
  }

  setScene(scene: SceneName): void {
    this.sceneMul = scene === "null" ? 0.38 : 1;
    if (!this.ctx) return;
    this.applyGains();
    const wet = scene === "mirror" ? 0.3 : 0;
    this.delayGain.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.06);
    if (scene !== "frequency") this.stopCarrier();
  }

  setCarrier(norm: number | null): void {
    if (norm === null || !this.canFx()) {
      this.stopCarrier();
      return;
    }
    const ctx = this.ctx;
    if (!ctx) return;
    const freq = 130 + clamp01(norm) * 620;
    if (!this.carrier) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "triangle";
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      gain.gain.value = 0.028;
      osc.frequency.value = freq;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.fxGain);
      osc.start();
      this.carrier = osc;
      this.carrierNodes = [filter, gain];
      return;
    }
    this.carrier.frequency.setTargetAtTime(freq, ctx.currentTime, 0.04);
  }

  glassTap(ny: number, intensity = 0.6): void {
    if (!this.canFx()) return;
    const freq = 480 + (1 - clamp01(ny)) * 1500;
    const gain = 0.05 * clamp01(intensity);
    this.burst({ dur: 0.045, gain: gain * 1.3, filterFreq: 1800 + freq * 0.2, q: 1.4 });
    this.ping(freq, 0.22, gain, "sine");
    this.ping(freq * 2.01, 0.14, gain * 0.35, "sine", "fx", undefined, 0.015);
  }

  doubleGlass(ny: number): void {
    if (!this.canFx()) return;
    const freq = 520 + (1 - clamp01(ny)) * 1200;
    this.ping(freq, 0.28, 0.055, "sine");
    this.ping(freq * 1.25, 0.34, 0.04, "triangle", "fx", undefined, 0.03);
    this.burst({ dur: 0.08, gain: 0.05, filterFreq: 900, q: 0.6 });
  }

  ceramic(pitch = 1): void {
    if (!this.canFx()) return;
    this.burst({ dur: 0.028, gain: 0.11, filterFreq: 860 * pitch, q: 5 });
  }

  droplet(bus: BusName = "fx"): void {
    if (bus === "fx" && !this.canFx()) return;
    if (!this.ctx) return;
    this.ping(980, 0.26, bus === "music" ? 0.012 : 0.045, "sine", bus, 420);
  }

  crystal(index: number): void {
    if (!this.canFx()) return;
    const freq = 920 + index * 190;
    this.ping(freq, 0.48, 0.05, "sine");
    this.ping(freq * 1.498, 0.36, 0.02, "triangle", "fx", undefined, 0.03);
  }

  pop(intensity = 0.6): void {
    if (!this.canFx()) return;
    const gain = 0.04 + clamp01(intensity) * 0.05;
    this.ping(180, 0.16, gain, "sine", "fx", 58);
  }

  swish(speed = 1): void {
    if (!this.canFx()) return;
    const amount = clamp01(speed);
    this.burst({
      dur: 0.28,
      gain: 0.05 + amount * 0.04,
      filterFreq: 420,
      sweepTo: 2800,
      q: 0.7,
    });
  }

  shimmer(): void {
    if (!this.canFx()) return;
    [1400, 1760, 2093].forEach((freq, index) => {
      this.ping(freq, 0.22, 0.018, "sine", "fx", undefined, index * 0.03);
    });
  }

  sparkle(): void {
    if (!this.canFx()) return;
    this.ping(2400 + Math.random() * 600, 0.08, 0.03, "sine");
    this.ping(3200, 0.06, 0.016, "triangle", "fx", undefined, 0.04);
  }

  sliderTick(): void {
    if (!this.canFx()) return;
    this.ping(1600, 0.045, 0.02, "sine");
  }

  motif(): void {
    if (!this.canFx()) return;
    this.ping(880, 0.42, 0.05, "sine");
    this.ping(1174.7, 0.46, 0.04, "sine", "fx", undefined, 0.12);
    this.ping(1568, 0.55, 0.032, "triangle", "fx", undefined, 0.24);
  }

  whisper(): void {
    if (!this.canFx()) return;
    this.ping(466.16, 1.5, 0.022, "sine", "fx", 415.3);
  }

  twin(): void {
    if (!this.canFx()) return;
    this.ping(659.25, 0.4, 0.045, "sine");
    this.ping(987.77, 0.5, 0.03, "sine", "fx", undefined, 0.02);
  }

  beginHold(): void {
    if (!this.canFx() || this.hold || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.linearRampToValueAtTime(78, t + 4);
    filter.type = "lowpass";
    filter.frequency.value = 500;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 2.4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxGain);
    osc.start(t);
    this.hold = { osc, gain, filter };
  }

  endHold(ms: number): void {
    const intensity = Math.min(1, ms / 900);
    if (this.hold && this.ctx) {
      const { osc, gain, filter } = this.hold;
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      const current = Math.max(0.0001, gain.gain.value || 0.02);
      gain.gain.setValueAtTime(current, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(Math.max(50, osc.frequency.value), t);
      osc.frequency.exponentialRampToValueAtTime(52, t + 0.18);
      osc.stop(t + 0.24);
      const held = this.hold;
      osc.onended = () => {
        try {
          held.osc.disconnect();
          held.gain.disconnect();
          held.filter.disconnect();
        } catch {
          /* already disconnected */
        }
      };
      this.hold = null;
      void filter;
    }
    this.pop(intensity);
  }

  private build(): void {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.musicFade = ctx.createGain();
    this.fxGain = ctx.createGain();
    this.reverbGain = ctx.createGain();
    this.delay = ctx.createDelay(1);
    this.delayGain = ctx.createGain();
    this.delayFeedback = ctx.createGain();
    this.convolver = ctx.createConvolver();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 16;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.012;
    comp.release.value = 0.28;

    this.convolver.buffer = this.impulse(2.4, 2.6);
    this.delay.delayTime.value = 0.31;
    this.delayGain.gain.value = 0;
    this.delayFeedback.gain.value = 0.2;
    this.reverbGain.gain.value = 0.42;
    this.musicFade.gain.value = 1;

    this.musicBus.connect(this.musicFade);
    this.musicFade.connect(this.master);
    this.musicFade.connect(this.convolver);
    this.fxGain.connect(this.master);
    this.fxGain.connect(this.convolver);
    this.fxGain.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.master);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.applyGains();
  }

  private applyGains(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, t, 0.04);
    this.musicBus.gain.setTargetAtTime(this.musicVol, t, 0.05);
    const fx = this.env === "silent" ? 0 : this.fxVol * this.sceneMul;
    this.fxGain.gain.setTargetAtTime(fx, t, 0.04);
  }

  private canFx(): boolean {
    return Boolean(this.ctx) && this.env !== "silent" && !this.muted && this.fxVol > 0.001 && this.activeFx < 26;
  }

  private ensureMusic(): void {
    if (!this.ctx || this.env === "silent" || this.musicOn) return;
    this.musicOn = true;
    this.startBeds();
    this.queueNext(280);
  }

  private stopMusic(): void {
    this.musicOn = false;
    this.fadeToken += 1;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = 0;
    this.clearBeds();
  }

  private fadeTo(value: number, done?: () => void): void {
    if (!this.ctx) {
      done?.();
      return;
    }
    const token = ++this.fadeToken;
    const t = this.ctx.currentTime;
    this.musicFade.gain.cancelScheduledValues(t);
    this.musicFade.gain.setValueAtTime(this.musicFade.gain.value, t);
    this.musicFade.gain.linearRampToValueAtTime(value, t + 0.5);
    window.setTimeout(() => {
      if (token !== this.fadeToken) return;
      done?.();
    }, 520);
  }

  private queueNext(delay: number): void {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (!this.musicOn || !this.ctx) return;
      this.playPhrase();
      const gap = this.env === "mall" ? 8800 + Math.random() * 4200 : 6400 + Math.random() * 2400;
      this.queueNext(gap);
    }, delay);
  }

  private playPhrase(): void {
    const env = this.env;
    if (env === "dream") {
      const chords = [
        [220, 261.63, 329.63],
        [174.61, 220, 261.63],
        [130.81, 196, 261.63],
        [196, 246.94, 293.66],
      ];
      const chord = chords[this.chordIndex % chords.length] ?? chords[0];
      this.chordIndex += 1;
      chord.forEach((freq) => this.pad(freq, 7.6, 0.02));
      if (Math.random() < 0.65 && chord[2]) this.ping(chord[2] * 2, 1.8, 0.012, "sine", "music");
      return;
    }
    if (env === "mall") {
      const notes = [196, 246.94, 329.63, 174.61, 293.66];
      const freq = notes[this.chordIndex % notes.length] ?? 196;
      this.chordIndex += 1;
      this.ping(freq, 4.8, 0.02, "sine", "music");
      if (Math.random() < 0.45) this.ping(freq * 2, 3.4, 0.008, "triangle", "music", undefined, 0.35);
      return;
    }
    if (env === "midnight") {
      this.ping(720 + Math.random() * 700, 0.09, 0.012, "square", "music", undefined, 0, 1100);
      if (Math.random() < 0.5) this.ping(440, 0.14, 0.008, "square", "music", undefined, 0.18, 900);
      return;
    }
    if (env === "rain") {
      this.pad(174.61, 8.2, 0.016);
      this.pad(220, 8.2, 0.012);
      this.pad(261.63, 8.2, 0.01);
      if (Math.random() < 0.85) this.droplet("music");
      return;
    }
    if (env === "liminal") {
      const roots = [196, 233.08, 311.13];
      const base = roots[this.chordIndex % roots.length] ?? 196;
      this.chordIndex += 1;
      this.pad(base, 8.4, 0.018);
      this.pad(base * 1.004, 8.4, 0.01);
      if (Math.random() < 0.34) this.ping(base * Math.SQRT2, 2.4, 0.014, "sine", "music");
    }
  }

  private startBeds(): void {
    this.clearBeds();
    if (!this.ctx || this.env === "silent") return;
    if (this.env === "dream") this.loopNoise("highpass", 2600, 0.4, 0.016);
    if (this.env === "mall") this.loopNoise("bandpass", 480, 1.1, 0.01);
    if (this.env === "rain") this.loopNoise("bandpass", 2100, 0.55, 0.05);
    if (this.env === "midnight") {
      this.bedTone(110, "sine", 0.028, 420);
      this.bedTone(164.81, "triangle", 0.012, 640);
    }
    if (this.env === "liminal") {
      this.bedTone(196, "sine", 0.018, 740);
      this.bedTone(198.4, "sine", 0.014, 740);
    }
  }

  private clearBeds(): void {
    for (const osc of this.bedOsc) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
      osc.disconnect();
    }
    for (const src of this.bedSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
    for (const node of this.bedNodes) node.disconnect();
    this.bedOsc = [];
    this.bedSources = [];
    this.bedNodes = [];
  }

  private stopCarrier(): void {
    if (this.carrier) {
      try {
        this.carrier.stop();
      } catch {
        /* already stopped */
      }
      this.carrier.disconnect();
    }
    for (const node of this.carrierNodes) node.disconnect();
    this.carrier = null;
    this.carrierNodes = [];
  }

  private bedTone(freq: number, type: OscillatorType, gainValue: number, filterFreq: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    gain.gain.value = gainValue;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start();
    this.bedOsc.push(osc);
    this.bedNodes.push(filter, gain);
  }

  private loopNoise(type: BiquadFilterType, freq: number, q: number, gainValue: number): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.getNoise();
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    src.start();
    this.bedSources.push(src);
    this.bedNodes.push(filter, gain);
  }

  private pad(freq: number, dur: number, gainValue: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc2.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 1.003, t);
    lfo.frequency.value = 0.1 + Math.random() * 0.16;
    lfoGain.gain.value = freq * 0.004;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    filter.type = "lowpass";
    filter.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + 1.5);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue * 0.55), t + dur * 0.72);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(t);
    osc2.start(t);
    lfo.start(t);
    osc.stop(t + dur);
    osc2.stop(t + dur);
    lfo.stop(t + dur);
    this.watch(osc, [osc2, lfo, lfoGain, filter, gain], false);
  }

  private ping(
    freq: number,
    dur: number,
    gainValue: number,
    type: OscillatorType,
    bus: BusName = "fx",
    slideTo?: number,
    delay = 0,
    filterFreq?: number,
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), t);
    if (slideTo && slideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    }
    filter.type = "lowpass";
    filter.frequency.value = filterFreq ?? Math.min(7000, Math.max(400, freq * 3.2));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + Math.min(0.03, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus === "music" ? this.musicBus : this.fxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.watch(osc, [filter, gain], bus === "fx");
  }

  private burst(opts: {
    dur: number;
    gain: number;
    filterFreq: number;
    q?: number;
    sweepTo?: number;
  }): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = "bandpass";
    filter.Q.value = opts.q ?? 0.8;
    filter.frequency.setValueAtTime(Math.max(80, opts.filterFreq), t);
    if (opts.sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, opts.sweepTo), t + opts.dur);
    }
    gain.gain.setValueAtTime(Math.max(0.0002, opts.gain), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxGain);
    src.start(t);
    src.stop(t + opts.dur + 0.02);
    this.watch(src, [filter, gain], true);
  }

  private watch(source: OscillatorNode | AudioBufferSourceNode, nodes: AudioNode[], count: boolean): void {
    if (count) this.activeFx += 1;
    source.onended = () => {
      if (count) this.activeFx = Math.max(0, this.activeFx - 1);
      try {
        source.disconnect();
      } catch {
        /* noop */
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          /* noop */
        }
      }
    };
  }

  private getNoise(): AudioBuffer {
    if (this.noiseBuf && this.ctx) return this.noiseBuf;
    const ctx = this.ctx!;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buffer;
    return buffer;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
      }
    }
    return buffer;
  }
}

export const labAudio = new LabAudio();

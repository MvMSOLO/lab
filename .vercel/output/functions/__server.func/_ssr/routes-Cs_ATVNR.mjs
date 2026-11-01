import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as SlidersHorizontal, c as CircleDot, l as AudioWaveform, n as VolumeX, o as Library, r as Volume2, s as Layers, t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Cs_ATVNR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function clamp01$1(value) {
	return Math.min(1, Math.max(0, value));
}
/**
* All sound is synthesized in the Web Audio API.
* Nothing is streamed, sampled from a recording, or loaded from the network.
*/
var LabAudio = class {
	ctx = null;
	master;
	musicBus;
	musicFade;
	fxGain;
	reverbGain;
	delay;
	delayGain;
	delayFeedback;
	convolver;
	env = "dream";
	masterVol = .62;
	musicVol = .42;
	fxVol = .7;
	muted = false;
	sceneMul = 1;
	musicOn = false;
	timer = 0;
	fadeToken = 0;
	chordIndex = 0;
	activeFx = 0;
	noiseBuf = null;
	bedOsc = [];
	bedNodes = [];
	bedSources = [];
	hold = null;
	carrier = null;
	carrierNodes = [];
	isReady() {
		return this.ctx !== null;
	}
	prime(env) {
		this.env = env;
	}
	unlock() {
		if (!this.ctx) this.build();
		if (this.ctx && this.ctx.state !== "running") this.ctx.resume();
	}
	poke(settings) {
		this.unlock();
		this.setVolumes(settings.master, settings.music, settings.fx, settings.muted);
		if (this.env !== settings.env) this.setEnvironment(settings.env);
		else this.ensureMusic();
	}
	setVolumes(master, music, fx, muted) {
		this.masterVol = clamp01$1(master);
		this.musicVol = clamp01$1(music);
		this.fxVol = clamp01$1(fx);
		this.muted = muted;
		if (this.ctx) this.applyGains();
	}
	setEnvironment(env) {
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
	setScene(scene) {
		this.sceneMul = scene === "null" ? .38 : 1;
		if (!this.ctx) return;
		this.applyGains();
		const wet = scene === "mirror" ? .3 : 0;
		this.delayGain.gain.setTargetAtTime(wet, this.ctx.currentTime, .06);
		if (scene !== "frequency") this.stopCarrier();
	}
	setCarrier(norm) {
		if (norm === null || !this.canFx()) {
			this.stopCarrier();
			return;
		}
		const ctx = this.ctx;
		if (!ctx) return;
		const freq = 130 + clamp01$1(norm) * 620;
		if (!this.carrier) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const filter = ctx.createBiquadFilter();
			osc.type = "triangle";
			filter.type = "lowpass";
			filter.frequency.value = 1400;
			gain.gain.value = .028;
			osc.frequency.value = freq;
			osc.connect(filter);
			filter.connect(gain);
			gain.connect(this.fxGain);
			osc.start();
			this.carrier = osc;
			this.carrierNodes = [filter, gain];
			return;
		}
		this.carrier.frequency.setTargetAtTime(freq, ctx.currentTime, .04);
	}
	glassTap(ny, intensity = .6) {
		if (!this.canFx()) return;
		const freq = 480 + (1 - clamp01$1(ny)) * 1500;
		const gain = .05 * clamp01$1(intensity);
		this.burst({
			dur: .045,
			gain: gain * 1.3,
			filterFreq: 1800 + freq * .2,
			q: 1.4
		});
		this.ping(freq, .22, gain, "sine");
		this.ping(freq * 2.01, .14, gain * .35, "sine", "fx", void 0, .015);
	}
	doubleGlass(ny) {
		if (!this.canFx()) return;
		const freq = 520 + (1 - clamp01$1(ny)) * 1200;
		this.ping(freq, .28, .055, "sine");
		this.ping(freq * 1.25, .34, .04, "triangle", "fx", void 0, .03);
		this.burst({
			dur: .08,
			gain: .05,
			filterFreq: 900,
			q: .6
		});
	}
	ceramic(pitch = 1) {
		if (!this.canFx()) return;
		this.burst({
			dur: .028,
			gain: .11,
			filterFreq: 860 * pitch,
			q: 5
		});
	}
	droplet(bus = "fx") {
		if (bus === "fx" && !this.canFx()) return;
		if (!this.ctx) return;
		this.ping(980, .26, bus === "music" ? .012 : .045, "sine", bus, 420);
	}
	crystal(index) {
		if (!this.canFx()) return;
		const freq = 920 + index * 190;
		this.ping(freq, .48, .05, "sine");
		this.ping(freq * 1.498, .36, .02, "triangle", "fx", void 0, .03);
	}
	pop(intensity = .6) {
		if (!this.canFx()) return;
		const gain = .04 + clamp01$1(intensity) * .05;
		this.ping(180, .16, gain, "sine", "fx", 58);
	}
	swish(speed = 1) {
		if (!this.canFx()) return;
		const amount = clamp01$1(speed);
		this.burst({
			dur: .28,
			gain: .05 + amount * .04,
			filterFreq: 420,
			sweepTo: 2800,
			q: .7
		});
	}
	shimmer() {
		if (!this.canFx()) return;
		[
			1400,
			1760,
			2093
		].forEach((freq, index) => {
			this.ping(freq, .22, .018, "sine", "fx", void 0, index * .03);
		});
	}
	sparkle() {
		if (!this.canFx()) return;
		this.ping(2400 + Math.random() * 600, .08, .03, "sine");
		this.ping(3200, .06, .016, "triangle", "fx", void 0, .04);
	}
	sliderTick() {
		if (!this.canFx()) return;
		this.ping(1600, .045, .02, "sine");
	}
	motif() {
		if (!this.canFx()) return;
		this.ping(880, .42, .05, "sine");
		this.ping(1174.7, .46, .04, "sine", "fx", void 0, .12);
		this.ping(1568, .55, .032, "triangle", "fx", void 0, .24);
	}
	whisper() {
		if (!this.canFx()) return;
		this.ping(466.16, 1.5, .022, "sine", "fx", 415.3);
	}
	twin() {
		if (!this.canFx()) return;
		this.ping(659.25, .4, .045, "sine");
		this.ping(987.77, .5, .03, "sine", "fx", void 0, .02);
	}
	beginHold() {
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
		gain.gain.setValueAtTime(1e-4, t);
		gain.gain.exponentialRampToValueAtTime(.07, t + 2.4);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(this.fxGain);
		osc.start(t);
		this.hold = {
			osc,
			gain,
			filter
		};
	}
	endHold(ms) {
		const intensity = Math.min(1, ms / 900);
		if (this.hold && this.ctx) {
			const { osc, gain, filter } = this.hold;
			const t = this.ctx.currentTime;
			gain.gain.cancelScheduledValues(t);
			const current = Math.max(1e-4, gain.gain.value || .02);
			gain.gain.setValueAtTime(current, t);
			gain.gain.exponentialRampToValueAtTime(1e-4, t + .2);
			osc.frequency.cancelScheduledValues(t);
			osc.frequency.setValueAtTime(Math.max(50, osc.frequency.value), t);
			osc.frequency.exponentialRampToValueAtTime(52, t + .18);
			osc.stop(t + .24);
			const held = this.hold;
			osc.onended = () => {
				try {
					held.osc.disconnect();
					held.gain.disconnect();
					held.filter.disconnect();
				} catch {}
			};
			this.hold = null;
		}
		this.pop(intensity);
	}
	build() {
		const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
		comp.attack.value = .012;
		comp.release.value = .28;
		this.convolver.buffer = this.impulse(2.4, 2.6);
		this.delay.delayTime.value = .31;
		this.delayGain.gain.value = 0;
		this.delayFeedback.gain.value = .2;
		this.reverbGain.gain.value = .42;
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
	applyGains() {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.master.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, t, .04);
		this.musicBus.gain.setTargetAtTime(this.musicVol, t, .05);
		const fx = this.env === "silent" ? 0 : this.fxVol * this.sceneMul;
		this.fxGain.gain.setTargetAtTime(fx, t, .04);
	}
	canFx() {
		return Boolean(this.ctx) && this.env !== "silent" && !this.muted && this.fxVol > .001 && this.activeFx < 26;
	}
	ensureMusic() {
		if (!this.ctx || this.env === "silent" || this.musicOn) return;
		this.musicOn = true;
		this.startBeds();
		this.queueNext(280);
	}
	stopMusic() {
		this.musicOn = false;
		this.fadeToken += 1;
		if (this.timer) window.clearTimeout(this.timer);
		this.timer = 0;
		this.clearBeds();
	}
	fadeTo(value, done) {
		if (!this.ctx) {
			done?.();
			return;
		}
		const token = ++this.fadeToken;
		const t = this.ctx.currentTime;
		this.musicFade.gain.cancelScheduledValues(t);
		this.musicFade.gain.setValueAtTime(this.musicFade.gain.value, t);
		this.musicFade.gain.linearRampToValueAtTime(value, t + .5);
		window.setTimeout(() => {
			if (token !== this.fadeToken) return;
			done?.();
		}, 520);
	}
	queueNext(delay) {
		if (this.timer) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			if (!this.musicOn || !this.ctx) return;
			this.playPhrase();
			const gap = this.env === "mall" ? 8800 + Math.random() * 4200 : 6400 + Math.random() * 2400;
			this.queueNext(gap);
		}, delay);
	}
	playPhrase() {
		const env = this.env;
		if (env === "dream") {
			const chords = [
				[
					220,
					261.63,
					329.63
				],
				[
					174.61,
					220,
					261.63
				],
				[
					130.81,
					196,
					261.63
				],
				[
					196,
					246.94,
					293.66
				]
			];
			const chord = chords[this.chordIndex % chords.length] ?? chords[0];
			this.chordIndex += 1;
			chord.forEach((freq) => this.pad(freq, 7.6, .02));
			if (Math.random() < .65 && chord[2]) this.ping(chord[2] * 2, 1.8, .012, "sine", "music");
			return;
		}
		if (env === "mall") {
			const notes = [
				196,
				246.94,
				329.63,
				174.61,
				293.66
			];
			const freq = notes[this.chordIndex % notes.length] ?? 196;
			this.chordIndex += 1;
			this.ping(freq, 4.8, .02, "sine", "music");
			if (Math.random() < .45) this.ping(freq * 2, 3.4, .008, "triangle", "music", void 0, .35);
			return;
		}
		if (env === "midnight") {
			this.ping(720 + Math.random() * 700, .09, .012, "square", "music", void 0, 0, 1100);
			if (Math.random() < .5) this.ping(440, .14, .008, "square", "music", void 0, .18, 900);
			return;
		}
		if (env === "rain") {
			this.pad(174.61, 8.2, .016);
			this.pad(220, 8.2, .012);
			this.pad(261.63, 8.2, .01);
			if (Math.random() < .85) this.droplet("music");
			return;
		}
		if (env === "liminal") {
			const roots = [
				196,
				233.08,
				311.13
			];
			const base = roots[this.chordIndex % roots.length] ?? 196;
			this.chordIndex += 1;
			this.pad(base, 8.4, .018);
			this.pad(base * 1.004, 8.4, .01);
			if (Math.random() < .34) this.ping(base * Math.SQRT2, 2.4, .014, "sine", "music");
		}
	}
	startBeds() {
		this.clearBeds();
		if (!this.ctx || this.env === "silent") return;
		if (this.env === "dream") this.loopNoise("highpass", 2600, .4, .016);
		if (this.env === "mall") this.loopNoise("bandpass", 480, 1.1, .01);
		if (this.env === "rain") this.loopNoise("bandpass", 2100, .55, .05);
		if (this.env === "midnight") {
			this.bedTone(110, "sine", .028, 420);
			this.bedTone(164.81, "triangle", .012, 640);
		}
		if (this.env === "liminal") {
			this.bedTone(196, "sine", .018, 740);
			this.bedTone(198.4, "sine", .014, 740);
		}
	}
	clearBeds() {
		for (const osc of this.bedOsc) {
			try {
				osc.stop();
			} catch {}
			osc.disconnect();
		}
		for (const src of this.bedSources) {
			try {
				src.stop();
			} catch {}
			src.disconnect();
		}
		for (const node of this.bedNodes) node.disconnect();
		this.bedOsc = [];
		this.bedSources = [];
		this.bedNodes = [];
	}
	stopCarrier() {
		if (this.carrier) {
			try {
				this.carrier.stop();
			} catch {}
			this.carrier.disconnect();
		}
		for (const node of this.carrierNodes) node.disconnect();
		this.carrier = null;
		this.carrierNodes = [];
	}
	bedTone(freq, type, gainValue, filterFreq) {
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
	loopNoise(type, freq, q, gainValue) {
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
	pad(freq, dur, gainValue) {
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
		lfo.frequency.value = .1 + Math.random() * .16;
		lfoGain.gain.value = freq * .004;
		lfo.connect(lfoGain);
		lfoGain.connect(osc.frequency);
		filter.type = "lowpass";
		filter.frequency.value = 880;
		gain.gain.setValueAtTime(1e-4, t);
		gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, gainValue), t + 1.5);
		gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, gainValue * .55), t + dur * .72);
		gain.gain.exponentialRampToValueAtTime(1e-4, t + dur);
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
		this.watch(osc, [
			osc2,
			lfo,
			lfoGain,
			filter,
			gain
		], false);
	}
	ping(freq, dur, gainValue, type, bus = "fx", slideTo, delay = 0, filterFreq) {
		if (!this.ctx) return;
		const ctx = this.ctx;
		const t = ctx.currentTime + delay;
		const osc = ctx.createOscillator();
		const filter = ctx.createBiquadFilter();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(Math.max(40, freq), t);
		if (slideTo && slideTo > 0) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
		filter.type = "lowpass";
		filter.frequency.value = filterFreq ?? Math.min(7e3, Math.max(400, freq * 3.2));
		gain.gain.setValueAtTime(1e-4, t);
		gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, gainValue), t + Math.min(.03, dur * .25));
		gain.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(bus === "music" ? this.musicBus : this.fxGain);
		osc.start(t);
		osc.stop(t + dur + .02);
		this.watch(osc, [filter, gain], bus === "fx");
	}
	burst(opts) {
		if (!this.ctx) return;
		const ctx = this.ctx;
		const t = ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = this.getNoise();
		const filter = ctx.createBiquadFilter();
		const gain = ctx.createGain();
		filter.type = "bandpass";
		filter.Q.value = opts.q ?? .8;
		filter.frequency.setValueAtTime(Math.max(80, opts.filterFreq), t);
		if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(80, opts.sweepTo), t + opts.dur);
		gain.gain.setValueAtTime(Math.max(2e-4, opts.gain), t);
		gain.gain.exponentialRampToValueAtTime(1e-4, t + opts.dur);
		src.connect(filter);
		filter.connect(gain);
		gain.connect(this.fxGain);
		src.start(t);
		src.stop(t + opts.dur + .02);
		this.watch(src, [filter, gain], true);
	}
	watch(source, nodes, count) {
		if (count) this.activeFx += 1;
		source.onended = () => {
			if (count) this.activeFx = Math.max(0, this.activeFx - 1);
			try {
				source.disconnect();
			} catch {}
			for (const node of nodes) try {
				node.disconnect();
			} catch {}
		};
	}
	getNoise() {
		if (this.noiseBuf && this.ctx) return this.noiseBuf;
		const ctx = this.ctx;
		const length = ctx.sampleRate * 2;
		const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
		this.noiseBuf = buffer;
		return buffer;
	}
	impulse(seconds, decay) {
		const ctx = this.ctx;
		const length = Math.floor(ctx.sampleRate * seconds);
		const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
		for (let channel = 0; channel < 2; channel += 1) {
			const data = buffer.getChannelData(channel);
			for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
		}
		return buffer;
	}
};
var labAudio = new LabAudio();
var ENVS = [
	{
		id: "midnight",
		name: "Midnight Computer",
		line: "A soft digital hum and sparse little tones."
	},
	{
		id: "dream",
		name: "Dream Memory",
		line: "Warm pads, slow chords, a room you almost remember."
	},
	{
		id: "silent",
		name: "Silent Space",
		line: "The laboratory, with every sound switched off."
	},
	{
		id: "mall",
		name: "Empty Mall",
		line: "Hollow distance. One note, then a long quiet."
	},
	{
		id: "liminal",
		name: "Liminal Signal",
		line: "Beautiful, slightly unsettled, never loud."
	},
	{
		id: "rain",
		name: "Rain on Glass",
		line: "Synthetic rain over a low warm harmony."
	}
];
var SECRETS = [
	{
		id: "pulse-seven",
		title: "Seven Pulses",
		line: "A counted quiet found the meter under the glass.",
		glyph: "pulse"
	},
	{
		id: "held-mark",
		title: "The Mark",
		line: "The name of the laboratory stayed warm in the hand.",
		glyph: "mark"
	},
	{
		id: "spiral-glass",
		title: "Spiral",
		line: "A turning path opened a thinner place.",
		glyph: "spiral"
	},
	{
		id: "path-of-rooms",
		title: "Path",
		line: "Four doors, touched as if they were one sentence.",
		glyph: "path"
	},
	{
		id: "four-corners",
		title: "Edges",
		line: "The room agreed, corner by corner.",
		glyph: "corners"
	},
	{
		id: "stillness",
		title: "Stillness",
		line: "Nothing moved, and something answered.",
		glyph: "still"
	},
	{
		id: "late-reflection",
		title: "Late Light",
		line: "In the darker air the highlight spoke first.",
		glyph: "reflect"
	},
	{
		id: "small-star",
		title: "Unlisted Star",
		line: "It was never only decoration.",
		glyph: "star"
	},
	{
		id: "weather-order",
		title: "Old Weather",
		line: "Four climates, remembered in their first order.",
		glyph: "weather"
	},
	{
		id: "twin-release",
		title: "Twin Hands",
		line: "Two touches left the glass together.",
		glyph: "twin"
	},
	{
		id: "passing-sigil",
		title: "Passing Sigil",
		line: "A sign that exists only between moments.",
		glyph: "sigil"
	},
	{
		id: "null-key",
		title: "Null Key",
		line: "Enough memories, held, became a door made of nothing.",
		glyph: "null"
	},
	{
		id: "garden-ring",
		title: "Glass Garden",
		line: "Five crystals rang as one instrument.",
		glyph: "garden"
	},
	{
		id: "lost-dial",
		title: "Lost Frequency",
		line: "The carrier climbed until the static stepped aside.",
		glyph: "dial"
	},
	{
		id: "mirror-lag",
		title: "The Mirror",
		line: "The delayed self was allowed to catch up.",
		glyph: "mirror"
	},
	{
		id: "null-wait",
		title: "Null Space",
		line: "Emptiness, kept, brightened by a single touch.",
		glyph: "void"
	}
];
var ROOMS = [
	{
		id: "garden",
		numeral: "01",
		name: "Glass Garden",
		line: "Translucent growth. Soft crystal.",
		needs: ["spiral-glass", "pulse-seven"]
	},
	{
		id: "frequency",
		numeral: "02",
		name: "Lost Frequency",
		line: "A midnight machine still humming.",
		needs: ["weather-order", "held-mark"]
	},
	{
		id: "mirror",
		numeral: "03",
		name: "The Mirror",
		line: "Light that arrives a moment late.",
		needs: ["late-reflection", "twin-release"]
	},
	{
		id: "null",
		numeral: "04",
		name: "Null Space",
		line: "Almost nothing. Exactly enough.",
		needs: ["null-key"]
	}
];
var SECRET_IDS = new Set(SECRETS.map((secret) => secret.id));
function roomUnlocked(id, found) {
	const room = ROOMS.find((item) => item.id === id);
	if (!room) return false;
	return room.needs.some((need) => found.includes(need));
}
function secretById(id) {
	return SECRETS.find((secret) => secret.id === id);
}
var KEY = "insane-ui-lab-v1";
var DEFAULT_SAVE = {
	seenIntro: false,
	master: .62,
	music: .42,
	fx: .7,
	muted: false,
	env: "dream",
	horror: true,
	particles: .62,
	motion: .8,
	reduced: false,
	atmosphere: "obsidian",
	discoveries: [],
	interactions: 0,
	roomsEntered: []
};
function clamp01(value, fallback) {
	if (typeof value !== "number" || Number.isNaN(value)) return fallback;
	return Math.min(1, Math.max(0, value));
}
function isEnv(value) {
	return ENVS.some((env) => env.id === value);
}
function isRoom(value) {
	return value === "garden" || value === "frequency" || value === "mirror" || value === "null";
}
function loadSave() {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		const discoveries = Array.isArray(data.discoveries) ? data.discoveries.filter((id) => typeof id === "string" && SECRET_IDS.has(id)) : [];
		const roomsEntered = Array.isArray(data.roomsEntered) ? data.roomsEntered.filter(isRoom) : [];
		return {
			seenIntro: Boolean(data.seenIntro),
			master: clamp01(data.master, DEFAULT_SAVE.master),
			music: clamp01(data.music, DEFAULT_SAVE.music),
			fx: clamp01(data.fx, DEFAULT_SAVE.fx),
			muted: Boolean(data.muted),
			env: isEnv(data.env) ? data.env : DEFAULT_SAVE.env,
			horror: data.horror !== false,
			particles: clamp01(data.particles, DEFAULT_SAVE.particles),
			motion: clamp01(data.motion, DEFAULT_SAVE.motion),
			reduced: Boolean(data.reduced),
			atmosphere: data.atmosphere === "dusk" ? "dusk" : "obsidian",
			discoveries,
			interactions: typeof data.interactions === "number" && data.interactions > 0 ? Math.min(1e6, Math.floor(data.interactions)) : 0,
			roomsEntered
		};
	} catch {
		return null;
	}
}
function writeSave(save) {
	try {
		localStorage.setItem(KEY, JSON.stringify(save));
	} catch {}
}
function prefersReducedMotion() {
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}
function Glyph({ name, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		className: className ?? "glyph",
		viewBox: "0 0 32 32",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.5",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: shape(name)
	});
}
function shape(name) {
	switch (name) {
		case "pulse": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 16h6l2-6 4 12 2-6h10" });
		case "mark": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 5v14M16 19l-6 8M16 19l6 8M8 12h16" });
		case "spiral": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 16c2 0 4 2 4 4s-2 3-4 3-5-2-5-5 3-7 7-7 8 4 8 9" });
		case "path": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 24V10h8v14M18 24V6h8v18" });
		case "corners": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 12V6h6M26 12V6h-6M6 20v6h6M26 20v6h-6" });
		case "still": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "16",
			cy: "16",
			r: "3.5"
		});
		case "reflect": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 22c4-10 12-10 16 0M10 12h12" });
		case "star": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 5l2.2 6.6H25l-5.4 4.1 2.1 6.6L16 18.8 10.3 22.3l2.1-6.6L7 11.6h6.8z" });
		case "weather": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 21h13.5a4.5 4.5 0 0 0 .6-9 6 6 0 0 0-11.6 1.6" });
		case "twin": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M11 7v18M21 7v18M11 16h10" });
		case "sigil": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 4.5l2.4 7.2H26l-6 4.5 2.3 7.3L16 19.2 9.7 23.5 12 16.2 6 11.7h7.6z" });
		case "null": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "16",
			cy: "16",
			r: "7"
		});
		case "garden": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 27V14M16 16c-4-1-7-5-6-9 4 1 6 5 6 9zM16 18c4-2 8-2 9-7-4 0-7 3-9 7z" });
		case "dial": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 22a10 10 0 1 1 18 0M16 16l5-4" });
		case "mirror": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 6h16v20H8zM8 16h16" });
		case "void": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 7v18M7 16h18" });
		default: return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "16",
			cy: "16",
			r: "2"
		});
	}
}
function baseRadius(sim, room) {
	const minSide = Math.min(sim.w, sim.h);
	return Math.max(72, Math.min(148, minSide * (room === "null" ? .11 : .2)));
}
function spring(value, target, vel, dt, stiffness, damping) {
	const nextVel = vel + ((target - value) * stiffness - vel * damping) * dt;
	return {
		value: value + nextVel * dt,
		vel: nextVel
	};
}
function OrbStage({ modelRef, onGestureRef }) {
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d", { alpha: true });
		if (!context) return;
		const sim = {
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			tx: 0,
			ty: 0,
			scale: 1,
			sv: 0,
			scaleTarget: 1,
			energy: 0,
			depth: 1,
			depthV: 0,
			depthTarget: 1,
			lightX: 0,
			lightY: 0,
			aimX: 0,
			aimY: -.2,
			ghostX: 0,
			ghostY: 0,
			holding: false,
			stillFor: 0,
			ripples: [],
			particles: [],
			waves: [],
			w: 1,
			h: 1,
			placed: false
		};
		const pointers = /* @__PURE__ */ new Map();
		let raf = 0;
		let running = true;
		let last = performance.now();
		let holdTimer = 0;
		let holding = false;
		let moved = false;
		let downX = 0;
		let downY = 0;
		let downT = 0;
		let lastTap = 0;
		let velX = 0;
		let velY = 0;
		let lastMoveT = 0;
		let twinArmed = 0;
		let spiralSent = false;
		let lastAng = null;
		let spiral = [];
		let tapTimes = [];
		let stillAtDown = 0;
		let ghostClose = false;
		let pinchDist = 0;
		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.floor(rect.width * dpr));
			canvas.height = Math.max(1, Math.floor(rect.height * dpr));
			sim.w = rect.width;
			sim.h = rect.height;
			if (!sim.placed) {
				sim.x = sim.tx = rect.width / 2;
				sim.y = sim.ty = rect.height * .42;
				sim.ghostX = sim.x;
				sim.ghostY = sim.y;
				sim.placed = true;
			}
		};
		const localPoint = (event) => {
			const rect = canvas.getBoundingClientRect();
			return {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top
			};
		};
		const addRipple = (x, y, power, delay = 0) => {
			const push = () => {
				let asym = 0;
				if (modelRef.current.consumeAsym) {
					asym = .22;
					modelRef.current.consumeAsym = false;
				}
				sim.ripples.push({
					x,
					y,
					age: 0,
					life: .95,
					power,
					asym
				});
				if (sim.ripples.length > 24) sim.ripples.shift();
			};
			if (delay > 0) window.setTimeout(push, delay);
			else push();
		};
		const burst = (x, y) => {
			const cap = particleCap();
			for (let i = 0; i < 8; i += 1) {
				if (sim.particles.length >= cap) break;
				const ang = Math.random() * Math.PI * 2;
				const speed = 20 + Math.random() * 70;
				sim.particles.push({
					x,
					y,
					vx: Math.cos(ang) * speed,
					vy: Math.sin(ang) * speed,
					life: 0,
					max: .45 + Math.random() * .4,
					r: 1 + Math.random() * 1.8,
					cool: Math.random()
				});
			}
		};
		const particleCap = () => {
			const model = modelRef.current;
			if (model.reduced) return 10;
			if (model.room === "null") return 8;
			return Math.round(12 + model.particles * 58);
		};
		const sampleSpiral = (x, y, now) => {
			const radius = baseRadius(sim, modelRef.current.room);
			const dx = x - sim.x;
			const dy = y - sim.y;
			const dist = Math.hypot(dx, dy);
			if (dist < radius * .18 || dist > radius * 1.3) {
				lastAng = null;
				return;
			}
			const ang = Math.atan2(dy, dx);
			if (lastAng === null) {
				lastAng = ang;
				return;
			}
			let delta = ang - lastAng;
			while (delta > Math.PI) delta -= Math.PI * 2;
			while (delta < -Math.PI) delta += Math.PI * 2;
			lastAng = ang;
			if (Math.abs(delta) < .012) return;
			spiral.push({
				t: now,
				delta
			});
			spiral = spiral.filter((sample) => now - sample.t < 2200);
			const sum = spiral.reduce((total, sample) => total + sample.delta, 0);
			const wrong = spiral.filter((sample) => Math.sign(sample.delta) !== Math.sign(sum) && Math.abs(sample.delta) > .08).length;
			if (Math.abs(sum) > Math.PI * 2.7 && spiral.length > 16 && wrong < 4 && !spiralSent) {
				spiralSent = true;
				onGestureRef.current({ type: "spiral" });
			}
		};
		const onDown = (event) => {
			if (!event.isPrimary && pointers.size === 0) return;
			try {
				canvas.setPointerCapture(event.pointerId);
			} catch {}
			const point = localPoint(event);
			pointers.set(event.pointerId, point);
			sim.aimX = (point.x / sim.w - .5) * 2;
			sim.aimY = (point.y / sim.h - .5) * 2;
			if (pointers.size === 1) {
				moved = false;
				holding = false;
				spiralSent = false;
				lastAng = null;
				spiral = [];
				downX = point.x;
				downY = point.y;
				downT = performance.now();
				stillAtDown = sim.stillFor;
				ghostClose = Math.hypot(sim.ghostX - sim.x, sim.ghostY - sim.y) < 22;
				sim.stillFor = 0;
				window.clearTimeout(holdTimer);
				holdTimer = window.setTimeout(() => {
					if (pointers.size !== 1 || moved) return;
					holding = true;
					sim.holding = true;
					sim.scaleTarget = .9;
					onGestureRef.current({ type: "hold-start" });
				}, 190);
			}
			if (pointers.size === 2) {
				window.clearTimeout(holdTimer);
				if (holding) {
					holding = false;
					sim.holding = false;
					sim.scaleTarget = 1;
					onGestureRef.current({
						type: "hold-end",
						ms: performance.now() - downT
					});
				}
				const pts = [...pointers.values()];
				const a = pts[0];
				const b = pts[1];
				if (a && b) pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
			}
		};
		const onMove = (event) => {
			const current = pointers.get(event.pointerId);
			if (!current) return;
			const point = localPoint(event);
			const now = performance.now();
			const dt = Math.max(.016, (now - (lastMoveT || now)) / 1e3);
			velX = (point.x - current.x) / dt;
			velY = (point.y - current.y) / dt;
			lastMoveT = now;
			current.x = point.x;
			current.y = point.y;
			sim.aimX = (point.x / sim.w - .5) * 2;
			sim.aimY = (point.y / sim.h - .5) * 2;
			if (pointers.size === 1) {
				if (Math.hypot(point.x - downX, point.y - downY) > 14) {
					moved = true;
					window.clearTimeout(holdTimer);
					if (holding) {
						holding = false;
						sim.holding = false;
						sim.scaleTarget = 1;
					}
					const pad = 24;
					sim.tx = Math.min(sim.w - pad, Math.max(pad, point.x));
					sim.ty = Math.min(sim.h - 120, Math.max(80, point.y));
				}
				sampleSpiral(point.x, point.y, now);
			} else if (pointers.size === 2) {
				const pts = [...pointers.values()];
				const a = pts[0];
				const b = pts[1];
				if (a && b && pinchDist > 0) {
					const dist = Math.hypot(a.x - b.x, a.y - b.y);
					const ratio = dist / pinchDist;
					sim.depthTarget = Math.min(1.28, Math.max(.82, sim.depthTarget * (1 + (ratio - 1) * .4)));
					pinchDist = dist;
				}
			}
		};
		const finishRelease = (now) => {
			const dt = now - downT;
			const speed = Math.hypot(velX, velY);
			sim.tx = sim.w / 2;
			sim.ty = sim.h * .42;
			if (holding) {
				holding = false;
				sim.holding = false;
				sim.scaleTarget = 1;
				sim.sv = 2.4 + Math.min(2.2, dt / 900);
				onGestureRef.current({
					type: "hold-end",
					ms: dt
				});
				addRipple(sim.x, sim.y, Math.min(1, .5 + dt / 3e3));
				return;
			}
			if (!moved && dt < 480) {
				const isDouble = now - lastTap < 300;
				lastTap = now;
				tapTimes = tapTimes.filter((stamp) => now - stamp < 1600);
				tapTimes.push(now);
				const radius = baseRadius(sim, modelRef.current.room);
				const hx = sim.x - radius * .28;
				const hy = sim.y - radius * .32;
				const reflection = Math.hypot(downX - hx, downY - hy) < radius * .36;
				const delay = reflection && modelRef.current.atmosphere === "obsidian" ? 120 : 0;
				addRipple(downX, downY, isDouble ? .95 : .72, delay);
				if (isDouble) addRipple(downX + 8, downY - 6, .55, delay + 40);
				burst(downX, downY);
				onGestureRef.current({
					type: "tap",
					x: downX,
					y: downY,
					reflection,
					rapid: tapTimes.length
				});
				if (isDouble) onGestureRef.current({
					type: "double",
					x: downX,
					y: downY
				});
				if (modelRef.current.room === "mirror" && stillAtDown > 1.6 && ghostClose) onGestureRef.current({ type: "mirror-catch" });
				return;
			}
			if (moved && speed > 900) {
				onGestureRef.current({
					type: "swipe",
					speed
				});
				sim.waves.push({
					age: 0,
					ang: Math.atan2(velY, velX),
					power: Math.min(1, speed / 2200)
				});
				if (sim.waves.length > 6) sim.waves.shift();
			}
		};
		const onUp = (event) => {
			const now = performance.now();
			const sizeBefore = pointers.size;
			pointers.delete(event.pointerId);
			window.clearTimeout(holdTimer);
			if (sizeBefore === 2) {
				twinArmed = now;
				onGestureRef.current({ type: "pinch" });
				const pts = [...pointers.values()];
				pts.forEach((point) => addRipple(point.x, point.y, .6));
				const first = pts[0];
				if (first) addRipple(sim.w - first.x, first.y, .45);
			}
			if (sizeBefore === 1 && pointers.size === 0) {
				if (twinArmed && now - twinArmed < 170) {
					twinArmed = 0;
					sim.tx = sim.w / 2;
					sim.ty = sim.h * .42;
					sim.scaleTarget = 1;
					holding = false;
					sim.holding = false;
					onGestureRef.current({ type: "twin-release" });
					addRipple(sim.w * .32, sim.h * .42, .8);
					addRipple(sim.w * .68, sim.h * .42, .8);
					return;
				}
				finishRelease(now);
			}
			velX = 0;
			velY = 0;
		};
		const onCancel = (event) => {
			pointers.delete(event.pointerId);
			window.clearTimeout(holdTimer);
			holding = false;
			sim.holding = false;
			sim.scaleTarget = 1;
			sim.tx = sim.w / 2;
			sim.ty = sim.h * .42;
		};
		const step = (dt, time) => {
			const model = modelRef.current;
			const stiffness = 90 + model.motion * 140;
			const damping = 12 + (1 - model.motion) * 8;
			if (model.nudge) {
				sim.vx += model.nudge.x;
				sim.vy += model.nudge.y;
				model.nudge = null;
			}
			const pos = spring(sim.x, sim.tx, sim.vx, dt, stiffness, damping);
			sim.x = pos.value;
			sim.vx = pos.vel;
			const posY = spring(sim.y, sim.ty, sim.vy, dt, stiffness, damping);
			sim.y = posY.value;
			sim.vy = posY.vel;
			const scale = spring(sim.scale, sim.scaleTarget, sim.sv, dt, 220, 14);
			sim.scale = scale.value;
			sim.sv = scale.vel;
			if (!sim.holding && Math.abs(sim.scale - 1) < .004 && Math.abs(sim.sv) < .02) sim.scaleTarget = 1;
			if (pointers.size < 2) sim.depthTarget += (1 - sim.depthTarget) * Math.min(1, dt * .45);
			const depth = spring(sim.depth, sim.depthTarget, sim.depthV, dt, 40, 10);
			sim.depth = depth.value;
			sim.depthV = depth.vel;
			sim.energy = sim.holding ? Math.min(1, sim.energy + dt * .32) : Math.max(0, sim.energy - dt * .45);
			const lag = model.uncanny || model.room === "mirror" ? 1.35 : 8;
			const lightLag = model.uncanny ? 1.1 : 6;
			const blend = (from, to, rate) => from + (to - from) * (1 - Math.exp(-dt * rate));
			sim.lightX = blend(sim.lightX, sim.aimX, lightLag);
			sim.lightY = blend(sim.lightY, sim.aimY, lightLag);
			sim.ghostX = blend(sim.ghostX, sim.x, lag);
			sim.ghostY = blend(sim.ghostY, sim.y, lag);
			if (pointers.size === 0 && !moved) sim.stillFor += dt;
			for (const ripple of sim.ripples) ripple.age += dt;
			sim.ripples = sim.ripples.filter((ripple) => ripple.age < ripple.life);
			for (const wave of sim.waves) wave.age += dt;
			sim.waves = sim.waves.filter((wave) => wave.age < .8);
			const cap = particleCap();
			if (sim.particles.length < cap && Math.random() < dt * 8) sim.particles.push({
				x: Math.random() * sim.w,
				y: sim.h + 4,
				vx: (Math.random() - .5) * 8,
				vy: -8 - Math.random() * 16,
				life: 0,
				max: 4 + Math.random() * 6,
				r: .6 + Math.random() * 1.4,
				cool: Math.random()
			});
			for (const particle of sim.particles) {
				particle.life += dt;
				particle.x += particle.vx * dt;
				particle.y += particle.vy * dt;
			}
			sim.particles = sim.particles.filter((particle) => particle.life < particle.max).slice(-cap);
			draw(context, sim, model, time);
		};
		const loop = (now) => {
			if (!running) return;
			const dt = Math.min(.033, (now - last) / 1e3);
			last = now;
			if (!document.hidden) step(dt || .016, now / 1e3);
			raf = requestAnimationFrame(loop);
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointercancel", onCancel);
		raf = requestAnimationFrame(loop);
		return () => {
			running = false;
			cancelAnimationFrame(raf);
			window.clearTimeout(holdTimer);
			observer.disconnect();
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onCancel);
		};
	}, [modelRef, onGestureRef]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		className: "orb-canvas",
		"aria-hidden": "true"
	});
}
function draw(ctx, sim, model, time) {
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, sim.w, sim.h);
	const radius = baseRadius(sim, model.room);
	const breathAmp = model.reduced ? 0 : .02 * (.35 + model.motion);
	const breath = 1 + Math.sin(time * .85) * breathAmp;
	const drawR = radius * sim.scale * breath * sim.depth;
	if (model.shadow) {
		const gx = sim.w * (.5 + Math.sin(time * .2) * .18);
		const gy = sim.h * .72;
		const shade = ctx.createRadialGradient(gx, gy, 10, gx, gy, sim.w * .45);
		shade.addColorStop(0, "rgba(0,0,0,0.45)");
		shade.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = shade;
		ctx.fillRect(0, 0, sim.w, sim.h);
	}
	for (const particle of sim.particles) {
		const fade = 1 - particle.life / particle.max;
		ctx.beginPath();
		ctx.fillStyle = particle.cool > .7 ? `rgba(165,244,255,${.35 * fade})` : `rgba(244,242,255,${.28 * fade})`;
		ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
		ctx.fill();
	}
	const platformY = sim.y + drawR * .92;
	const platform = ctx.createRadialGradient(sim.x, platformY, 4, sim.x, platformY, drawR * 1.5);
	const pulse = model.oddPulse ? .16 + Math.abs(Math.sin(time * 9)) * .08 : .1 + sim.energy * .08;
	platform.addColorStop(0, `rgba(165,244,255,${pulse})`);
	platform.addColorStop(.45, "rgba(135,119,255,0.05)");
	platform.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = platform;
	ctx.beginPath();
	ctx.ellipse(sim.x, platformY, drawR * 1.35, drawR * .28, 0, 0, Math.PI * 2);
	ctx.fill();
	if (model.room === "mirror") drawSphere(ctx, sim.ghostX, sim.ghostY, drawR * .96, sim.energy * .4, sim.lightX, sim.lightY, .28);
	drawSphere(ctx, sim.x, sim.y, drawR, sim.energy + (model.nullArmed ? .35 : 0), sim.lightX, sim.lightY, 1);
	if (model.whisper) {
		ctx.save();
		ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
		ctx.fillStyle = "rgba(244,242,255,0.42)";
		ctx.textAlign = "center";
		ctx.fillText("still", sim.x, sim.y + drawR * .46);
		ctx.restore();
	}
	ctx.save();
	ctx.translate(sim.x, sim.y);
	ctx.rotate(time * .08);
	ctx.strokeStyle = "rgba(244,242,255,0.13)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(0, 0, drawR * 1.22, .2, 1.4);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, 0, drawR * 1.22, 2.4, 3.5);
	ctx.stroke();
	ctx.restore();
	for (const ripple of sim.ripples) {
		const p = ripple.age / ripple.life;
		ctx.save();
		ctx.translate(ripple.x, ripple.y);
		ctx.scale(1, 1 + ripple.asym * Math.sin(p * 6));
		ctx.beginPath();
		ctx.arc(0, 0, 8 + p * 150, 0, Math.PI * 2);
		ctx.strokeStyle = `rgba(165,244,255,${(1 - p) * .55 * ripple.power})`;
		ctx.lineWidth = 1.4;
		ctx.stroke();
		ctx.restore();
	}
	for (const wave of sim.waves) {
		const p = wave.age / .8;
		ctx.save();
		ctx.translate(sim.w / 2, sim.h * .42);
		ctx.rotate(wave.ang);
		const grad = ctx.createLinearGradient(-sim.w, 0, sim.w, 0);
		grad.addColorStop(0, "rgba(165,244,255,0)");
		grad.addColorStop(.5, `rgba(244,242,255,${(1 - p) * .22 * wave.power})`);
		grad.addColorStop(1, "rgba(165,244,255,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(-sim.w, -2 - p * 18, sim.w * 2, 4 + p * 36);
		ctx.restore();
	}
}
function drawSphere(ctx, x, y, radius, energy, lightX, lightY, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(x, y);
	const glow = ctx.createRadialGradient(0, 0, radius * .2, 0, 0, radius * 1.7);
	glow.addColorStop(0, `rgba(165,244,255,${.08 + energy * .16})`);
	glow.addColorStop(.5, `rgba(135,119,255,${.05 + energy * .06})`);
	glow.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(0, 0, radius * 1.7, 0, Math.PI * 2);
	ctx.fill();
	const body = ctx.createRadialGradient(-radius * .34, -radius * .4, radius * .08, 0, 0, radius);
	body.addColorStop(0, "rgba(244,242,255,0.95)");
	body.addColorStop(.16, "rgba(198,236,244,0.62)");
	body.addColorStop(.42, "rgba(46,54,84,0.62)");
	body.addColorStop(.78, "rgba(14,18,32,0.88)");
	body.addColorStop(1, "rgba(8,9,13,0.15)");
	ctx.beginPath();
	ctx.arc(0, 0, radius, 0, Math.PI * 2);
	ctx.fillStyle = body;
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(-radius * .12, radius * .08, radius * .62, radius * .42, -.5, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(165,244,255,0.16)";
	ctx.lineWidth = 1;
	ctx.stroke();
	const sx = -radius * .28 + lightX * radius * .16;
	const sy = -radius * .34 + lightY * radius * .12;
	const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * .46);
	spec.addColorStop(0, "rgba(255,255,255,0.9)");
	spec.addColorStop(.32, "rgba(165,244,255,0.28)");
	spec.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = spec;
	ctx.beginPath();
	ctx.arc(0, 0, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(0, 0, radius - .8, 0, Math.PI * 2);
	ctx.strokeStyle = `rgba(244,242,255,${.28 + energy * .35})`;
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.restore();
}
var NAV_CODE = [
	"rooms",
	"journal",
	"sound",
	"settings"
];
var WEATHER_CODE = [
	"dream",
	"mall",
	"rain",
	"liminal"
];
var SHARD_SPOTS = [
	{
		x: "16%",
		y: "36%"
	},
	{
		x: "84%",
		y: "34%"
	},
	{
		x: "18%",
		y: "64%"
	},
	{
		x: "82%",
		y: "66%"
	},
	{
		x: "50%",
		y: "30%"
	}
];
function cx(...parts) {
	return parts.filter(Boolean).join(" ");
}
function magnet(value) {
	for (const dent of [
		0,
		.5,
		1
	]) if (Math.abs(value - dent) < .03) return dent;
	return value;
}
function formatClock(total) {
	return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}
var INITIAL_MODEL = {
	reduced: false,
	particles: .62,
	motion: .8,
	uncanny: false,
	room: "lab",
	atmosphere: "obsidian",
	consumeAsym: false,
	shadow: false,
	oddPulse: false,
	nullArmed: false,
	whisper: false,
	nudge: null
};
function InsaneLab() {
	const [phase, setPhase] = (0, import_react.useState)("pending");
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	const [view, setView] = (0, import_react.useState)("lab");
	const [room, setRoom] = (0, import_react.useState)(null);
	const [seenIntro, setSeenIntro] = (0, import_react.useState)(false);
	const [master, setMaster] = (0, import_react.useState)(DEFAULT_SAVE.master);
	const [music, setMusic] = (0, import_react.useState)(DEFAULT_SAVE.music);
	const [fx, setFx] = (0, import_react.useState)(DEFAULT_SAVE.fx);
	const [muted, setMuted] = (0, import_react.useState)(false);
	const [env, setEnv] = (0, import_react.useState)(DEFAULT_SAVE.env);
	const [horror, setHorror] = (0, import_react.useState)(true);
	const [particles, setParticles] = (0, import_react.useState)(DEFAULT_SAVE.particles);
	const [motion, setMotion] = (0, import_react.useState)(DEFAULT_SAVE.motion);
	const [reduced, setReduced] = (0, import_react.useState)(false);
	const [atmosphere, setAtmosphere] = (0, import_react.useState)("obsidian");
	const [discoveries, setDiscoveries] = (0, import_react.useState)([]);
	const [interactions, setInteractions] = (0, import_react.useState)(0);
	const [roomsEntered, setRoomsEntered] = (0, import_react.useState)([]);
	const [toast, setToast] = (0, import_react.useState)(null);
	const [flash, setFlash] = (0, import_react.useState)(false);
	const [sigil, setSigil] = (0, import_react.useState)(false);
	const [charging, setCharging] = (0, import_react.useState)(false);
	const [glitch, setGlitch] = (0, import_react.useState)(false);
	const [uncanny, setUncanny] = (0, import_react.useState)(false);
	const [shadow, setShadow] = (0, import_react.useState)(false);
	const [whisper, setWhisper] = (0, import_react.useState)(false);
	const [oddPulse, setOddPulse] = (0, import_react.useState)(false);
	const [nullArmed, setNullArmed] = (0, import_react.useState)(false);
	const [weird, setWeird] = (0, import_react.useState)(null);
	const [cornerFlash, setCornerFlash] = (0, import_react.useState)(null);
	const [touched, setTouched] = (0, import_react.useState)(false);
	const [shards, setShards] = (0, import_react.useState)([
		false,
		false,
		false,
		false,
		false
	]);
	const [dial, setDial] = (0, import_react.useState)(.32);
	const [confirm, setConfirm] = (0, import_react.useState)(false);
	const [now, setNow] = (0, import_react.useState)(() => Date.now());
	const rootRef = (0, import_react.useRef)(null);
	const grainRef = (0, import_react.useRef)(null);
	const modelRef = (0, import_react.useRef)(INITIAL_MODEL);
	const onGestureRef = (0, import_react.useRef)(() => {});
	const settingsRef = (0, import_react.useRef)({
		master,
		music,
		fx,
		muted,
		env
	});
	const foundRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const discRef = (0, import_react.useRef)([]);
	const unlockRef = (0, import_react.useRef)(() => {});
	const roomRef = (0, import_react.useRef)(null);
	const atmosphereRef = (0, import_react.useRef)("obsidian");
	const horrorRef = (0, import_react.useRef)(true);
	const viewRef = (0, import_react.useRef)("lab");
	const phaseRef = (0, import_react.useRef)("pending");
	const openViewRef = (0, import_react.useRef)(() => {});
	const chooseEnvRef = (0, import_react.useRef)(() => {});
	const toggleMuteRef = (0, import_react.useRef)(() => {});
	const rhythmRef = (0, import_react.useRef)([]);
	const reflRef = (0, import_react.useRef)([]);
	const navRef = (0, import_react.useRef)([]);
	const navCount = (0, import_react.useRef)(0);
	const envSeq = (0, import_react.useRef)([]);
	const cornerStep = (0, import_react.useRef)(0);
	const cornerAt = (0, import_react.useRef)(0);
	const starAt = (0, import_react.useRef)(0);
	const markTimer = (0, import_react.useRef)(0);
	const sigilTimer = (0, import_react.useRef)(0);
	const nullTimer = (0, import_react.useRef)(0);
	const tickAt = (0, import_react.useRef)(0);
	const started = (0, import_react.useRef)(Date.now());
	const dockTally = (0, import_react.useRef)({
		id: "",
		n: 0
	});
	settingsRef.current = {
		master,
		music,
		fx,
		muted,
		env
	};
	discRef.current = discoveries;
	roomRef.current = room;
	atmosphereRef.current = atmosphere;
	horrorRef.current = horror;
	viewRef.current = view;
	phaseRef.current = phase;
	modelRef.current = {
		reduced,
		particles,
		motion,
		uncanny,
		room: room ?? "lab",
		atmosphere,
		consumeAsym: modelRef.current.consumeAsym,
		shadow,
		oddPulse,
		nullArmed,
		whisper,
		nudge: modelRef.current.nudge
	};
	const unlock = (id) => {
		if (foundRef.current.has(id)) return;
		foundRef.current.add(id);
		setDiscoveries((prev) => prev.includes(id) ? prev : [...prev, id]);
		setToast(secretById(id)?.title ?? "Memory");
		setFlash(true);
		window.setTimeout(() => setFlash(false), 720);
		labAudio.motif();
	};
	unlockRef.current = unlock;
	const noteNav = (id) => {
		navCount.current += 1;
		if (navCount.current % 3 === 0 && phaseRef.current === "lab") {
			setSigil(true);
			window.clearTimeout(sigilTimer.current);
			sigilTimer.current = window.setTimeout(() => setSigil(false), 1500);
			labAudio.sparkle();
		}
		const nowStamp = performance.now();
		let trail = navRef.current.filter((item) => nowStamp - item.t < 8e3);
		trail.push({
			id,
			t: nowStamp
		});
		const ids = trail.map((item) => item.id);
		if (!(ids.length <= NAV_CODE.length && ids.every((item, index) => item === NAV_CODE[index]))) trail = id === "rooms" ? [{
			id,
			t: nowStamp
		}] : [];
		navRef.current = trail;
		if (trail.map((item) => item.id).join() === NAV_CODE.join()) unlockRef.current("path-of-rooms");
	};
	const openView = (next) => {
		if (next !== "room") setRoom(null);
		setView(next);
		noteNav(next);
		labAudio.ceramic();
		setInteractions((count) => count + 1);
	};
	openViewRef.current = openView;
	const chooseEnv = (id) => {
		let seq = [...envSeq.current, id].slice(-4);
		if (!seq.every((item, index) => item === WEATHER_CODE[index])) seq = id === "dream" ? ["dream"] : [];
		envSeq.current = seq;
		if (seq.join() === WEATHER_CODE.join()) unlock("weather-order");
		setEnv(id);
		settingsRef.current = {
			...settingsRef.current,
			env: id
		};
		if (labAudio.isReady()) labAudio.setEnvironment(id);
		labAudio.droplet();
		setInteractions((count) => count + 1);
	};
	chooseEnvRef.current = chooseEnv;
	const toggleMute = () => {
		setMuted((value) => {
			const next = !value;
			settingsRef.current = {
				...settingsRef.current,
				muted: next
			};
			if (labAudio.isReady()) labAudio.setVolumes(master, music, fx, next);
			return next;
		});
		labAudio.ceramic(.8);
	};
	toggleMuteRef.current = toggleMute;
	const pushVolume = (partial) => {
		const next = {
			...settingsRef.current,
			...partial
		};
		settingsRef.current = next;
		if (labAudio.isReady()) labAudio.setVolumes(next.master, next.music, next.fx, next.muted);
	};
	const tickSlider = (value) => {
		if (Math.abs(value - tickAt.current) < .06) return;
		tickAt.current = value;
		labAudio.sliderTick();
	};
	const armNull = () => {
		window.clearTimeout(nullTimer.current);
		setNullArmed(false);
		nullTimer.current = window.setTimeout(() => setNullArmed(true), 18e3);
	};
	onGestureRef.current = (gesture) => {
		if (phaseRef.current !== "lab") return;
		setTouched(true);
		setInteractions((count) => count + 1);
		const stamp = performance.now();
		if (gesture.type === "tap") {
			const height = Math.max(1, window.innerHeight);
			labAudio.glassTap(gesture.y / height, Math.min(1, .42 + gesture.rapid * .07));
			let taps = rhythmRef.current;
			const previous = taps[taps.length - 1];
			if (previous !== void 0 && stamp - previous > 920) taps = [];
			taps = [...taps, stamp].slice(-7);
			rhythmRef.current = taps;
			if (taps.length === 7) {
				let ok = true;
				for (let i = 1; i < taps.length; i += 1) {
					const gap = taps[i] - taps[i - 1];
					if (gap < 260 || gap > 800) ok = false;
				}
				if (ok) unlockRef.current("pulse-seven");
			}
			if (gesture.reflection && atmosphereRef.current === "obsidian") {
				const recent = reflRef.current.filter((item) => stamp - item < 5e3);
				recent.push(stamp);
				reflRef.current = recent;
				if (recent.length >= 3) unlockRef.current("late-reflection");
			}
			if (roomRef.current === "null") {
				if (modelRef.current.nullArmed) unlockRef.current("null-wait");
				armNull();
			}
		} else if (gesture.type === "double") labAudio.doubleGlass(gesture.y / Math.max(1, window.innerHeight));
		else if (gesture.type === "hold-start") labAudio.beginHold();
		else if (gesture.type === "hold-end") {
			labAudio.endHold(gesture.ms);
			if (gesture.ms >= 5e3 && discRef.current.filter((id) => id !== "null-key").length >= 6) unlockRef.current("null-key");
		} else if (gesture.type === "swipe") labAudio.swish(Math.min(1, gesture.speed / 1800));
		else if (gesture.type === "spiral") {
			labAudio.shimmer();
			unlockRef.current("spiral-glass");
		} else if (gesture.type === "twin-release") {
			labAudio.twin();
			unlockRef.current("twin-release");
		} else if (gesture.type === "pinch") labAudio.sparkle();
		else if (gesture.type === "mirror-catch") {
			labAudio.crystal(2);
			unlockRef.current("mirror-lag");
		}
	};
	(0, import_react.useEffect)(() => {
		const saved = loadSave();
		if (saved) {
			setSeenIntro(saved.seenIntro);
			setMaster(saved.master);
			setMusic(saved.music);
			setFx(saved.fx);
			setMuted(saved.muted);
			setEnv(saved.env);
			setHorror(saved.horror);
			setParticles(saved.particles);
			setMotion(saved.motion);
			setReduced(saved.reduced);
			setAtmosphere(saved.atmosphere);
			setDiscoveries(saved.discoveries);
			setInteractions(saved.interactions);
			setRoomsEntered(saved.roomsEntered);
			foundRef.current = new Set(saved.discoveries);
			labAudio.prime(saved.env);
			setPhase(saved.seenIntro ? "quick" : "boot");
		} else if (prefersReducedMotion()) {
			setReduced(true);
			setMotion(.25);
			setParticles(.2);
			setPhase("boot");
		} else setPhase("boot");
		setHydrated(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		writeSave({
			seenIntro,
			master,
			music,
			fx,
			muted,
			env,
			horror,
			particles,
			motion,
			reduced,
			atmosphere,
			discoveries,
			interactions,
			roomsEntered
		});
	}, [
		hydrated,
		seenIntro,
		master,
		music,
		fx,
		muted,
		env,
		horror,
		particles,
		motion,
		reduced,
		atmosphere,
		discoveries,
		interactions,
		roomsEntered
	]);
	(0, import_react.useEffect)(() => {
		if (phase !== "boot" && phase !== "quick") return;
		const ms = phase === "quick" ? 860 : reduced ? 640 : 2900;
		const id = window.setTimeout(() => {
			setSeenIntro(true);
			setPhase("lab");
		}, ms);
		return () => window.clearTimeout(id);
	}, [phase, reduced]);
	(0, import_react.useEffect)(() => {
		if (!toast) return;
		const id = window.setTimeout(() => setToast(null), 2600);
		return () => window.clearTimeout(id);
	}, [toast]);
	(0, import_react.useEffect)(() => {
		if (view !== "journal") return;
		const id = window.setInterval(() => setNow(Date.now()), 1e3);
		return () => window.clearInterval(id);
	}, [view]);
	(0, import_react.useEffect)(() => {
		const poke = () => labAudio.poke(settingsRef.current);
		window.addEventListener("pointerdown", poke, true);
		window.addEventListener("keydown", poke, true);
		return () => {
			window.removeEventListener("pointerdown", poke, true);
			window.removeEventListener("keydown", poke, true);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const el = rootRef.current;
		if (!el) return;
		const move = (event) => {
			const rect = el.getBoundingClientRect();
			el.style.setProperty("--lx", `${event.clientX - rect.left}px`);
			el.style.setProperty("--ly", `${event.clientY - rect.top}px`);
		};
		el.addEventListener("pointermove", move);
		return () => el.removeEventListener("pointermove", move);
	}, []);
	(0, import_react.useEffect)(() => {
		const grain = grainRef.current;
		if (!grain || phase === "pending") return;
		const canvas = document.createElement("canvas");
		canvas.width = 128;
		canvas.height = 128;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const image = ctx.createImageData(128, 128);
		for (let i = 0; i < image.data.length; i += 4) {
			const shade = 170 + Math.random() * 80;
			image.data[i] = shade;
			image.data[i + 1] = shade;
			image.data[i + 2] = shade;
			image.data[i + 3] = 22 + Math.random() * 24;
		}
		ctx.putImageData(image, 0, 0);
		grain.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
	}, [phase]);
	(0, import_react.useEffect)(() => {
		if (phase !== "lab") return;
		let timer = window.setTimeout(() => unlockRef.current("stillness"), 42e3);
		const reset = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => unlockRef.current("stillness"), 42e3);
		};
		window.addEventListener("pointerdown", reset);
		window.addEventListener("keydown", reset);
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("pointerdown", reset);
			window.removeEventListener("keydown", reset);
		};
	}, [phase]);
	(0, import_react.useEffect)(() => {
		if (phase !== "lab" || !horror || reduced) return;
		let count = 0;
		let killed = false;
		const timers = [];
		const later = (fn, ms) => {
			const id = window.setTimeout(() => {
				if (!killed) fn();
			}, ms);
			timers.push(id);
		};
		const run = () => {
			later(() => {
				if (count >= 4) return;
				count += 1;
				const kind = count % 4;
				if (kind === 1) {
					setUncanny(true);
					setOddPulse(true);
					later(() => {
						setUncanny(false);
						setOddPulse(false);
					}, 2400);
				} else if (kind === 2) {
					setGlitch(true);
					later(() => setGlitch(false), 90);
				} else if (kind === 3) modelRef.current.consumeAsym = true;
				else {
					setShadow(true);
					setWhisper(true);
					labAudio.whisper();
					later(() => {
						setShadow(false);
						setWhisper(false);
					}, 1800);
				}
				if (count < 4) run();
			}, count === 0 ? 2e4 : 15e3 + Math.random() * 12e3);
		};
		run();
		return () => {
			killed = true;
			timers.forEach((id) => window.clearTimeout(id));
		};
	}, [
		phase,
		horror,
		reduced
	]);
	(0, import_react.useEffect)(() => {
		if (!labAudio.isReady()) return;
		labAudio.setScene(room ?? "lab");
	}, [room]);
	(0, import_react.useEffect)(() => {
		if (room !== "frequency") return;
		labAudio.setCarrier(dial);
		if (dial <= .9 || foundRef.current.has("lost-dial")) return;
		const startedAt = performance.now();
		const id = window.setInterval(() => {
			if (performance.now() - startedAt > 1500) {
				unlockRef.current("lost-dial");
				window.clearInterval(id);
			}
		}, 200);
		return () => window.clearInterval(id);
	}, [dial, room]);
	(0, import_react.useEffect)(() => {
		if (room === "garden") setShards([
			false,
			false,
			false,
			false,
			false
		]);
		if (room === "null") armNull();
		return () => window.clearTimeout(nullTimer.current);
	}, [room]);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			const target = event.target;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
				if (event.key === "Escape") openViewRef.current("lab");
				return;
			}
			if (event.key === "Escape") openViewRef.current("lab");
			if (event.key === "m" || event.key === "M") toggleMuteRef.current();
			const picked = {
				"1": "dream",
				"2": "mall",
				"3": "midnight",
				"4": "rain",
				"5": "liminal",
				"6": "silent"
			}[event.key];
			if (picked && phaseRef.current === "lab") chooseEnvRef.current(picked);
			if (phaseRef.current !== "lab") return;
			if (event.key === " ") {
				event.preventDefault();
				onGestureRef.current({
					type: "tap",
					x: window.innerWidth / 2,
					y: window.innerHeight * .42,
					reflection: false,
					rapid: 1
				});
			}
			if (event.key === "ArrowLeft") modelRef.current.nudge = {
				x: -320,
				y: 0
			};
			if (event.key === "ArrowRight") modelRef.current.nudge = {
				x: 320,
				y: 0
			};
			if (event.key === "ArrowUp") modelRef.current.nudge = {
				x: 0,
				y: -280
			};
			if (event.key === "ArrowDown") modelRef.current.nudge = {
				x: 0,
				y: 280
			};
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	const finishBoot = () => {
		setSeenIntro(true);
		setPhase("lab");
	};
	const onDock = (id) => {
		if (horrorRef.current) {
			if (dockTally.current.id === id) dockTally.current.n += 1;
			else dockTally.current = {
				id,
				n: 1
			};
			if (dockTally.current.n >= 12 && dockTally.current.n % 12 === 0) {
				setWeird(id);
				labAudio.ceramic(.55);
				window.setTimeout(() => setWeird(null), 640);
			}
		}
		if (viewRef.current === id) openView("lab");
		else openView(id);
	};
	const onMarkDown = (event) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		setCharging(true);
		labAudio.ceramic(1.2);
		window.clearTimeout(markTimer.current);
		markTimer.current = window.setTimeout(() => {
			unlockRef.current("held-mark");
			setCharging(false);
		}, 3e3);
	};
	const onMarkUp = (event) => {
		window.clearTimeout(markTimer.current);
		setCharging(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	};
	const hitCorner = (index) => {
		const stamp = performance.now();
		let step = cornerStep.current;
		if (stamp - cornerAt.current > 2600) step = 0;
		if (index === step) step += 1;
		else step = index === 0 ? 1 : 0;
		cornerStep.current = step;
		cornerAt.current = stamp;
		setCornerFlash(index);
		window.setTimeout(() => setCornerFlash(null), 240);
		labAudio.ceramic(1 + index * .07);
		setInteractions((count) => count + 1);
		if (step === 4) unlock("four-corners");
	};
	const enterRoom = (id) => {
		if (!roomUnlocked(id, discoveries)) return;
		setRoom(id);
		setView("room");
		setRoomsEntered((prev) => prev.includes(id) ? prev : [...prev, id]);
		noteNav("room");
		labAudio.shimmer();
		if (labAudio.isReady()) labAudio.setScene(id);
		setInteractions((count) => count + 1);
	};
	const lightShard = (index) => {
		labAudio.crystal(index);
		setInteractions((count) => count + 1);
		setShards((prev) => {
			const next = [...prev];
			next[index] = true;
			if (next.every(Boolean)) unlockRef.current("garden-ring");
			return next;
		});
	};
	const resetArchive = () => {
		foundRef.current = /* @__PURE__ */ new Set();
		setDiscoveries([]);
		setInteractions(0);
		setRoomsEntered([]);
		setRoom(null);
		setView("lab");
		setConfirm(false);
		setToast("Archive cleared");
		labAudio.ceramic(.7);
	};
	const envName = ENVS.find((item) => item.id === env)?.name ?? "Dream Memory";
	const openRooms = ROOMS.filter((item) => roomUnlocked(item.id, discoveries)).length;
	const activeRoom = ROOMS.find((item) => item.id === room);
	const sheet = view === "rooms" || view === "journal" || view === "sound" || view === "settings";
	const seconds = Math.max(0, Math.floor((now - started.current) / 1e3));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: cx("lab-root", reduced && "is-reduced", flash && !reduced && "is-flash", phase === "lab" && "is-live"),
		"data-env": env,
		"data-atmosphere": atmosphere,
		"data-room": room ?? "lab",
		"data-ready": phase === "lab" ? "true" : "false",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "sr-only",
				children: "INSANE UI LAB"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "haze" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "haze haze-b" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grid-fade" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "light-follow" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: grainRef,
				className: "grain"
			}),
			phase !== "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "scanlines" }) : null,
			phase !== "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrbStage, {
					modelRef,
					onGestureRef
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "sr-only",
					onClick: () => onGestureRef.current({
						type: "tap",
						x: window.innerWidth / 2,
						y: window.innerHeight * .42,
						reflection: false,
						rapid: 1
					}),
					children: "Touch the glass"
				}),
				phase === "lab" && !sheet ? [
					0,
					1,
					2,
					3
				].map((index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cx("corner", `corner-${index}`, cornerFlash === index && "lit"),
					"aria-label": "Quiet edge of the laboratory",
					onPointerDown: (event) => {
						event.stopPropagation();
						hitCorner(index);
					}
				}, index)) : null,
				phase === "lab" && !sheet ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "star",
					"aria-label": "Small glint",
					onPointerDown: (event) => {
						event.stopPropagation();
						const stamp = performance.now();
						if (stamp - starAt.current < 360) unlock("small-star");
						starAt.current = stamp;
						labAudio.sparkle();
						setInteractions((count) => count + 1);
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Glyph, { name: "star" })
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "topbar",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: cx("mark", charging && "charging"),
						"aria-label": "Laboratory mark",
						onPointerDown: onMarkDown,
						onPointerUp: onMarkUp,
						onPointerCancel: onMarkUp,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
							className: "mark-svg",
							viewBox: "0 0 36 36",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
								cx: "18",
								cy: "18",
								r: "15"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
								cx: "18",
								cy: "18",
								r: "3"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "brand-copy",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "eyebrow",
								children: glitch ? "LABORAT0RY" : "LABORATORY"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "wordmark",
								children: "INSANE UI LAB"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mute",
						"aria-label": muted ? "Unmute" : "Mute",
						"aria-pressed": muted,
						onClick: toggleMute,
						children: muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { strokeWidth: 1.5 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { strokeWidth: 1.5 })
					})]
				}),
				view === "lab" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: cx("invite", touched && "gone"),
					children: "Touch something. Discover something."
				}) : null,
				view === "lab" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "env-pill",
					children: env === "silent" ? "Silent" : envName
				}) : null,
				view === "room" && activeRoom ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "room-hud",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "room-kicker",
							children: ["Room ", activeRoom.numeral]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "room-title",
							children: activeRoom.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "room-line",
							children: activeRoom.line
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "return-btn",
						onClick: () => openView("lab"),
						children: "Return"
					})]
				}) : null,
				room === "garden" && view === "room" ? SHARD_SPOTS.map((spot, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cx("shard", shards[index] && "lit"),
					style: {
						left: spot.x,
						top: spot.y
					},
					"aria-label": `Crystal ${index + 1}`,
					onClick: () => lightShard(index)
				}, spot.x)) : null,
				room === "frequency" && view === "room" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "tuner",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "tuner-top",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "field-label",
							children: "Carrier"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tuner-read",
							children: Math.round(130 + dial * 620)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "slider",
						type: "range",
						min: 0,
						max: 1,
						step: .01,
						value: dial,
						"aria-label": "Carrier frequency",
						onChange: (event) => {
							const value = magnet(Number(event.target.value));
							setDial(value);
							tickSlider(value);
						}
					})]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "dock",
					"aria-label": "Laboratory",
					children: [
						[
							"lab",
							"Orb",
							CircleDot
						],
						[
							"rooms",
							"Rooms",
							Layers
						],
						[
							"journal",
							"Journal",
							Library
						],
						[
							"sound",
							"Sound",
							AudioWaveform
						],
						[
							"settings",
							"Settings",
							SlidersHorizontal
						]
					].map(([id, label, Icon]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: cx("dock-btn", (view === id || id === "rooms" && view === "room") && "active", weird === id && "weird"),
						"aria-current": view === id ? "page" : void 0,
						onClick: () => onDock(id),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { strokeWidth: 1.5 }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }),
							id === "journal" && discoveries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", {
								className: "badge",
								children: discoveries.length
							}) : null,
							id === "rooms" && openRooms > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", {
								className: "badge",
								children: openRooms
							}) : null
						]
					}, id))
				}),
				sheet ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "scrim",
					"aria-label": "Close panel",
					onClick: () => openView("lab")
				}) : null,
				sheet ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "sheet",
					role: "dialog",
					"aria-label": view,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sheet-body",
						children: [
							view === "sound" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sheet-head",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "sheet-kicker",
										children: "Sound"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "sheet-title",
										children: "Environments"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "icon-btn",
										"aria-label": "Close sound",
										onClick: () => openView("lab"),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { strokeWidth: 1.5 })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "sheet-note",
									children: "Original tones, made in the moment. Music keeps playing as you move."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "env-list",
									children: ENVS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: cx("env-card", env === item.id && "active"),
										"aria-pressed": env === item.id,
										onClick: () => chooseEnv(item.id),
										onPointerMove: reduced ? void 0 : tilt,
										onPointerLeave: untilt,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "env-name",
											children: item.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "env-line",
											children: item.line
										})]
									}, item.id))
								})
							] }) : null,
							view === "journal" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sheet-head",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "sheet-kicker",
										children: "Archive"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "sheet-title",
										children: "Discovery journal"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "icon-btn",
										"aria-label": "Close journal",
										onClick: () => openView("lab"),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { strokeWidth: 1.5 })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "sheet-note",
									children: discoveries.length === 0 ? "The archive is quiet. The laboratory is not." : "Memories the room agreed to keep."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "meter",
									role: "meter",
									"aria-valuemin": 0,
									"aria-valuemax": SECRETS.length,
									"aria-valuenow": discoveries.length,
									"aria-label": "Discovery progress",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { transform: `scaleX(${discoveries.length / SECRETS.length})` } })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "meter-label",
									children: [
										discoveries.length,
										" of ",
										SECRETS.length,
										" memories"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "stat-row",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "stat",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Touches" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: interactions })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "stat",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rooms" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
												openRooms,
												"/",
												ROOMS.length
											] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "stat",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Session" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: formatClock(seconds) })]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "memory-list",
									children: SECRETS.map((secret) => {
										const open = discoveries.includes(secret.id);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
											className: cx("memory", !open && "sealed"),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Glyph, { name: open ? secret.glyph : "still" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "memory-title",
												children: open ? secret.title : "Unopened"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "memory-line",
												children: open ? secret.line : "A memory that has not surfaced."
											})] })]
										}, secret.id);
									})
								})
							] }) : null,
							view === "rooms" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sheet-head",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "sheet-kicker",
										children: "Chambers"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "sheet-title",
										children: "Hidden rooms"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "icon-btn",
										"aria-label": "Close rooms",
										onClick: () => openView("lab"),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { strokeWidth: 1.5 })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "sheet-note",
									children: "Doors open from what you find, not from a list of instructions."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "env-list",
									children: ROOMS.map((item) => {
										const open = roomUnlocked(item.id, discoveries);
										const visited = roomsEntered.includes(item.id);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
											className: cx("env-card", open && "active"),
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "env-name",
													children: [
														item.numeral,
														" ",
														open ? item.name : "Sealed"
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "env-line",
													children: [open ? item.line : "This chamber has not opened.", visited ? " Visited." : ""]
												}),
												open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													className: "return-btn",
													onClick: () => enterRoom(item.id),
													children: "Enter"
												}) : null
											]
										}, item.id);
									})
								})
							] }) : null,
							view === "settings" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sheet-head",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "sheet-kicker",
										children: "Control"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "sheet-title",
										children: "Settings"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "icon-btn",
										"aria-label": "Close settings",
										onClick: () => openView("lab"),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { strokeWidth: 1.5 })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Master"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "slider",
										type: "range",
										min: 0,
										max: 1,
										step: .01,
										value: master,
										"aria-label": "Master volume",
										onChange: (event) => {
											const value = magnet(Number(event.target.value));
											setMaster(value);
											pushVolume({ master: value });
											tickSlider(value);
										}
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Music"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "slider",
										type: "range",
										min: 0,
										max: 1,
										step: .01,
										value: music,
										"aria-label": "Music volume",
										onChange: (event) => {
											const value = magnet(Number(event.target.value));
											setMusic(value);
											pushVolume({ music: value });
											tickSlider(value);
										}
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Effects"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "slider",
										type: "range",
										min: 0,
										max: 1,
										step: .01,
										value: fx,
										"aria-label": "Effects volume",
										onChange: (event) => {
											const value = magnet(Number(event.target.value));
											setFx(value);
											pushVolume({ fx: value });
											tickSlider(value);
										}
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Particles"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "slider",
										type: "range",
										min: 0,
										max: 1,
										step: .01,
										value: particles,
										"aria-label": "Particle intensity",
										onChange: (event) => setParticles(magnet(Number(event.target.value)))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Motion"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "slider",
										type: "range",
										min: 0,
										max: 1,
										step: .01,
										value: motion,
										"aria-label": "Motion intensity",
										onChange: (event) => setMotion(magnet(Number(event.target.value)))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Aware layer"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-help",
										children: "Subtle unease. Never a scare. Switch it off whenever you want."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										on: horror,
										label: "Aware layer",
										onToggle: () => {
											setHorror((value) => !value);
											labAudio.droplet();
										}
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Reduced effects"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-help",
										children: "Fewer particles, no blur, calmer motion."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										on: reduced,
										label: "Reduced effects",
										onToggle: () => {
											setReduced((value) => !value);
											labAudio.ceramic();
										}
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "field column",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "field-label",
										children: "Atmosphere"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "choice-row",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: cx("choice", atmosphere === "obsidian" && "active"),
											"aria-pressed": atmosphere === "obsidian",
											onClick: () => {
												setAtmosphere("obsidian");
												labAudio.ceramic(.9);
											},
											children: "Obsidian"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: cx("choice", atmosphere === "dusk" && "active"),
											"aria-pressed": atmosphere === "dusk",
											onClick: () => {
												setAtmosphere("dusk");
												labAudio.ceramic(1.15);
											},
											children: "Dusk"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "action-row",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "text-btn",
										onClick: () => setPhase("boot"),
										children: "Replay introduction"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "text-btn danger",
										onClick: () => setConfirm(true),
										children: "Reset discoveries"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "help",
									children: "Space touches the glass. Arrows nudge it. M mutes. 1–6 change the weather. Esc closes a panel."
								})
							] }) : null
						]
					})
				}) : null,
				sigil ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "sigil",
					"aria-label": "Passing sign",
					onClick: () => {
						unlock("passing-sigil");
						setSigil(false);
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Glyph, { name: "sigil" })
				}) : null,
				toast ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "toast",
					role: "status",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
						className: "toast-ring",
						viewBox: "0 0 36 36",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							cx: "18",
							cy: "18",
							r: "14"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: toast })]
				}) : null
			] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "boot-title pending-title",
				children: "INSANE UI LAB"
			}),
			phase === "boot" || phase === "quick" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cx("boot", phase === "quick" && "boot-quick", reduced && "boot-calm"),
				role: "dialog",
				"aria-label": "Introduction",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "boot-point" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "boot-line" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "boot-sphere" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "boot-kicker",
						children: "Laboratory"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "boot-title",
						children: "INSANE UI LAB"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "boot-invite",
						children: "Touch something. Discover something."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "boot-skip",
						onClick: finishBoot,
						children: "Skip"
					})
				]
			}) : null,
			confirm ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "modal",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "modal-card",
					role: "dialog",
					"aria-labelledby": "reset-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "reset-title",
							children: "Clear the archive?"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Memories, room visits, and the touch count return to zero. Sound settings stay." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "action-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-btn",
								onClick: () => setConfirm(false),
								children: "Keep"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-btn danger",
								onClick: resetArchive,
								children: "Reset"
							})]
						})
					]
				})
			}) : null
		]
	});
}
function Switch({ on, label, onToggle }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		role: "switch",
		"aria-checked": on,
		"aria-label": label,
		className: cx("switch", on && "on"),
		onClick: onToggle,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "switch-knob" })
	});
}
function tilt(event) {
	const rect = event.currentTarget.getBoundingClientRect();
	const px = (event.clientX - rect.left) / rect.width - .5;
	const py = (event.clientY - rect.top) / rect.height - .5;
	event.currentTarget.style.setProperty("--ry", `${px * 7}deg`);
	event.currentTarget.style.setProperty("--rx", `${-py * 6}deg`);
}
function untilt(event) {
	event.currentTarget.style.setProperty("--ry", "0deg");
	event.currentTarget.style.setProperty("--rx", "0deg");
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InsaneLab, {});
}
//#endregion
export { Home as component };

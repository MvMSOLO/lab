import { useEffect, useRef, type MutableRefObject } from "react";
import type { Atmosphere, RoomId } from "@/lib/lab/catalog";

export type Gesture =
  | { type: "tap"; x: number; y: number; reflection: boolean; rapid: number }
  | { type: "double"; x: number; y: number }
  | { type: "hold-start" }
  | { type: "hold-end"; ms: number }
  | { type: "swipe"; speed: number }
  | { type: "spiral" }
  | { type: "twin-release" }
  | { type: "pinch" }
  | { type: "mirror-catch" };

export type OrbModel = {
  reduced: boolean;
  particles: number;
  motion: number;
  uncanny: boolean;
  room: RoomId | "lab";
  atmosphere: Atmosphere;
  consumeAsym: boolean;
  shadow: boolean;
  oddPulse: boolean;
  nullArmed: boolean;
  whisper: boolean;
  nudge: { x: number; y: number } | null;
};

type Ripple = {
  x: number;
  y: number;
  age: number;
  life: number;
  power: number;
  asym: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  cool: number;
};

type Wave = { age: number; ang: number; power: number };

type Sim = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  scale: number;
  sv: number;
  scaleTarget: number;
  energy: number;
  depth: number;
  depthV: number;
  depthTarget: number;
  lightX: number;
  lightY: number;
  aimX: number;
  aimY: number;
  ghostX: number;
  ghostY: number;
  holding: boolean;
  stillFor: number;
  ripples: Ripple[];
  particles: Particle[];
  waves: Wave[];
  w: number;
  h: number;
  placed: boolean;
};

function baseRadius(sim: Sim, room: OrbModel["room"]): number {
  const minSide = Math.min(sim.w, sim.h);
  const scale = room === "null" ? 0.11 : 0.2;
  return Math.max(72, Math.min(148, minSide * scale));
}

function spring(value: number, target: number, vel: number, dt: number, stiffness: number, damping: number) {
  const acc = (target - value) * stiffness - vel * damping;
  const nextVel = vel + acc * dt;
  return { value: value + nextVel * dt, vel: nextVel };
}

export function OrbStage({
  modelRef,
  onGestureRef,
}: {
  modelRef: MutableRefObject<OrbModel>;
  onGestureRef: MutableRefObject<(gesture: Gesture) => void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const sim: Sim = {
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
      aimY: -0.2,
      ghostX: 0,
      ghostY: 0,
      holding: false,
      stillFor: 0,
      ripples: [],
      particles: [],
      waves: [],
      w: 1,
      h: 1,
      placed: false,
    };

    const pointers = new Map<number, { x: number; y: number }>();
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
    let lastAng: number | null = null;
    let spiral: { t: number; delta: number }[] = [];
    let tapTimes: number[] = [];
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
        sim.y = sim.ty = rect.height * 0.42;
        sim.ghostX = sim.x;
        sim.ghostY = sim.y;
        sim.placed = true;
      }
    };

    const localPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const addRipple = (x: number, y: number, power: number, delay = 0) => {
      const push = () => {
        let asym = 0;
        if (modelRef.current.consumeAsym) {
          asym = 0.22;
          modelRef.current.consumeAsym = false;
        }
        sim.ripples.push({ x, y, age: 0, life: 0.95, power, asym });
        if (sim.ripples.length > 24) sim.ripples.shift();
      };
      if (delay > 0) window.setTimeout(push, delay);
      else push();
    };

    const burst = (x: number, y: number) => {
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
          max: 0.45 + Math.random() * 0.4,
          r: 1 + Math.random() * 1.8,
          cool: Math.random(),
        });
      }
    };

    const particleCap = () => {
      const model = modelRef.current;
      if (model.reduced) return 10;
      if (model.room === "null") return 8;
      return Math.round(12 + model.particles * 58);
    };

    const sampleSpiral = (x: number, y: number, now: number) => {
      const radius = baseRadius(sim, modelRef.current.room);
      const dx = x - sim.x;
      const dy = y - sim.y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius * 0.18 || dist > radius * 1.3) {
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
      if (Math.abs(delta) < 0.012) return;
      spiral.push({ t: now, delta });
      spiral = spiral.filter((sample) => now - sample.t < 2200);
      const sum = spiral.reduce((total, sample) => total + sample.delta, 0);
      const wrong = spiral.filter(
        (sample) => Math.sign(sample.delta) !== Math.sign(sum) && Math.abs(sample.delta) > 0.08,
      ).length;
      if (Math.abs(sum) > Math.PI * 2.7 && spiral.length > 16 && wrong < 4 && !spiralSent) {
        spiralSent = true;
        onGestureRef.current({ type: "spiral" });
      }
    };

    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary && pointers.size === 0) return;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* pointer already gone */
      }
      const point = localPoint(event);
      pointers.set(event.pointerId, point);
      sim.aimX = (point.x / sim.w - 0.5) * 2;
      sim.aimY = (point.y / sim.h - 0.5) * 2;
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
          sim.scaleTarget = 0.9;
          onGestureRef.current({ type: "hold-start" });
        }, 190);
      }
      if (pointers.size === 2) {
        window.clearTimeout(holdTimer);
        if (holding) {
          holding = false;
          sim.holding = false;
          sim.scaleTarget = 1;
          onGestureRef.current({ type: "hold-end", ms: performance.now() - downT });
        }
        const pts = [...pointers.values()];
        const a = pts[0];
        const b = pts[1];
        if (a && b) pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };

    const onMove = (event: PointerEvent) => {
      const current = pointers.get(event.pointerId);
      if (!current) return;
      const point = localPoint(event);
      const now = performance.now();
      const dt = Math.max(0.016, (now - (lastMoveT || now)) / 1000);
      velX = (point.x - current.x) / dt;
      velY = (point.y - current.y) / dt;
      lastMoveT = now;
      current.x = point.x;
      current.y = point.y;
      sim.aimX = (point.x / sim.w - 0.5) * 2;
      sim.aimY = (point.y / sim.h - 0.5) * 2;
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
          sim.depthTarget = Math.min(1.28, Math.max(0.82, sim.depthTarget * (1 + (ratio - 1) * 0.4)));
          pinchDist = dist;
        }
      }
    };

    const finishRelease = (now: number) => {
      const dt = now - downT;
      const speed = Math.hypot(velX, velY);
      sim.tx = sim.w / 2;
      sim.ty = sim.h * 0.42;
      if (holding) {
        holding = false;
        sim.holding = false;
        sim.scaleTarget = 1;
        sim.sv = 2.4 + Math.min(2.2, dt / 900);
        onGestureRef.current({ type: "hold-end", ms: dt });
        addRipple(sim.x, sim.y, Math.min(1, 0.5 + dt / 3000));
        return;
      }
      if (!moved && dt < 480) {
        const isDouble = now - lastTap < 300;
        lastTap = now;
        tapTimes = tapTimes.filter((stamp) => now - stamp < 1600);
        tapTimes.push(now);
        const radius = baseRadius(sim, modelRef.current.room);
        const hx = sim.x - radius * 0.28;
        const hy = sim.y - radius * 0.32;
        const reflection = Math.hypot(downX - hx, downY - hy) < radius * 0.36;
        const delay = reflection && modelRef.current.atmosphere === "obsidian" ? 120 : 0;
        addRipple(downX, downY, isDouble ? 0.95 : 0.72, delay);
        if (isDouble) addRipple(downX + 8, downY - 6, 0.55, delay + 40);
        burst(downX, downY);
        onGestureRef.current({
          type: "tap",
          x: downX,
          y: downY,
          reflection,
          rapid: tapTimes.length,
        });
        if (isDouble) onGestureRef.current({ type: "double", x: downX, y: downY });
        if (
          modelRef.current.room === "mirror" &&
          stillAtDown > 1.6 &&
          ghostClose
        ) {
          onGestureRef.current({ type: "mirror-catch" });
        }
        return;
      }
      if (moved && speed > 900) {
        onGestureRef.current({ type: "swipe", speed });
        sim.waves.push({
          age: 0,
          ang: Math.atan2(velY, velX),
          power: Math.min(1, speed / 2200),
        });
        if (sim.waves.length > 6) sim.waves.shift();
      }
    };

    const onUp = (event: PointerEvent) => {
      const now = performance.now();
      const sizeBefore = pointers.size;
      pointers.delete(event.pointerId);
      window.clearTimeout(holdTimer);
      if (sizeBefore === 2) {
        twinArmed = now;
        onGestureRef.current({ type: "pinch" });
        const pts = [...pointers.values()];
        pts.forEach((point) => addRipple(point.x, point.y, 0.6));
        const first = pts[0];
        if (first) addRipple(sim.w - first.x, first.y, 0.45);
      }
      if (sizeBefore === 1 && pointers.size === 0) {
        if (twinArmed && now - twinArmed < 170) {
          twinArmed = 0;
          sim.tx = sim.w / 2;
          sim.ty = sim.h * 0.42;
          sim.scaleTarget = 1;
          holding = false;
          sim.holding = false;
          onGestureRef.current({ type: "twin-release" });
          addRipple(sim.w * 0.32, sim.h * 0.42, 0.8);
          addRipple(sim.w * 0.68, sim.h * 0.42, 0.8);
          return;
        }
        finishRelease(now);
      }
      velX = 0;
      velY = 0;
    };

    const onCancel = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      window.clearTimeout(holdTimer);
      holding = false;
      sim.holding = false;
      sim.scaleTarget = 1;
      sim.tx = sim.w / 2;
      sim.ty = sim.h * 0.42;
    };

    const step = (dt: number, time: number) => {
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
      if (!sim.holding && Math.abs(sim.scale - 1) < 0.004 && Math.abs(sim.sv) < 0.02) {
        sim.scaleTarget = 1;
      }
      if (pointers.size < 2) sim.depthTarget += (1 - sim.depthTarget) * Math.min(1, dt * 0.45);
      const depth = spring(sim.depth, sim.depthTarget, sim.depthV, dt, 40, 10);
      sim.depth = depth.value;
      sim.depthV = depth.vel;
      sim.energy = sim.holding
        ? Math.min(1, sim.energy + dt * 0.32)
        : Math.max(0, sim.energy - dt * 0.45);
      const lag = model.uncanny || model.room === "mirror" ? 1.35 : 8;
      const lightLag = model.uncanny ? 1.1 : 6;
      const blend = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-dt * rate));
      sim.lightX = blend(sim.lightX, sim.aimX, lightLag);
      sim.lightY = blend(sim.lightY, sim.aimY, lightLag);
      sim.ghostX = blend(sim.ghostX, sim.x, lag);
      sim.ghostY = blend(sim.ghostY, sim.y, lag);
      if (pointers.size === 0 && !moved) sim.stillFor += dt;
      for (const ripple of sim.ripples) ripple.age += dt;
      sim.ripples = sim.ripples.filter((ripple) => ripple.age < ripple.life);
      for (const wave of sim.waves) wave.age += dt;
      sim.waves = sim.waves.filter((wave) => wave.age < 0.8);
      const cap = particleCap();
      if (sim.particles.length < cap && Math.random() < dt * 8) {
        sim.particles.push({
          x: Math.random() * sim.w,
          y: sim.h + 4,
          vx: (Math.random() - 0.5) * 8,
          vy: -8 - Math.random() * 16,
          life: 0,
          max: 4 + Math.random() * 6,
          r: 0.6 + Math.random() * 1.4,
          cool: Math.random(),
        });
      }
      for (const particle of sim.particles) {
        particle.life += dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
      sim.particles = sim.particles.filter((particle) => particle.life < particle.max).slice(-cap);
      draw(context, sim, model, time);
    };

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!document.hidden) step(dt || 0.016, now / 1000);
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

  return <canvas ref={canvasRef} className="orb-canvas" aria-hidden="true" />;
}

function draw(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  model: OrbModel,
  time: number,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, sim.w, sim.h);
  const radius = baseRadius(sim, model.room);
  const breathAmp = model.reduced ? 0 : 0.02 * (0.35 + model.motion);
  const breath = 1 + Math.sin(time * 0.85) * breathAmp;
  const drawR = radius * sim.scale * breath * sim.depth;

  if (model.shadow) {
    const gx = sim.w * (0.5 + Math.sin(time * 0.2) * 0.18);
    const gy = sim.h * 0.72;
    const shade = ctx.createRadialGradient(gx, gy, 10, gx, gy, sim.w * 0.45);
    shade.addColorStop(0, "rgba(0,0,0,0.45)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, sim.w, sim.h);
  }

  for (const particle of sim.particles) {
    const fade = 1 - particle.life / particle.max;
    ctx.beginPath();
    ctx.fillStyle = particle.cool > 0.7 ? `rgba(165,244,255,${0.35 * fade})` : `rgba(244,242,255,${0.28 * fade})`;
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const platformY = sim.y + drawR * 0.92;
  const platform = ctx.createRadialGradient(sim.x, platformY, 4, sim.x, platformY, drawR * 1.5);
  const pulse = model.oddPulse ? 0.16 + Math.abs(Math.sin(time * 9)) * 0.08 : 0.1 + sim.energy * 0.08;
  platform.addColorStop(0, `rgba(165,244,255,${pulse})`);
  platform.addColorStop(0.45, "rgba(135,119,255,0.05)");
  platform.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = platform;
  ctx.beginPath();
  ctx.ellipse(sim.x, platformY, drawR * 1.35, drawR * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  if (model.room === "mirror") {
    drawSphere(ctx, sim.ghostX, sim.ghostY, drawR * 0.96, sim.energy * 0.4, sim.lightX, sim.lightY, 0.28);
  }

  drawSphere(ctx, sim.x, sim.y, drawR, sim.energy + (model.nullArmed ? 0.35 : 0), sim.lightX, sim.lightY, 1);

  if (model.whisper) {
    ctx.save();
    ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(244,242,255,0.42)";
    ctx.textAlign = "center";
    ctx.fillText("still", sim.x, sim.y + drawR * 0.46);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(sim.x, sim.y);
  ctx.rotate(time * 0.08);
  ctx.strokeStyle = "rgba(244,242,255,0.13)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, drawR * 1.22, 0.2, 1.4);
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
    ctx.strokeStyle = `rgba(165,244,255,${(1 - p) * 0.55 * ripple.power})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  for (const wave of sim.waves) {
    const p = wave.age / 0.8;
    ctx.save();
    ctx.translate(sim.w / 2, sim.h * 0.42);
    ctx.rotate(wave.ang);
    const grad = ctx.createLinearGradient(-sim.w, 0, sim.w, 0);
    grad.addColorStop(0, "rgba(165,244,255,0)");
    grad.addColorStop(0.5, `rgba(244,242,255,${(1 - p) * 0.22 * wave.power})`);
    grad.addColorStop(1, "rgba(165,244,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-sim.w, -2 - p * 18, sim.w * 2, 4 + p * 36);
    ctx.restore();
  }
}

function drawSphere(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  energy: number,
  lightX: number,
  lightY: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.7);
  glow.addColorStop(0, `rgba(165,244,255,${0.08 + energy * 0.16})`);
  glow.addColorStop(0.5, `rgba(135,119,255,${0.05 + energy * 0.06})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.7, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(-radius * 0.34, -radius * 0.4, radius * 0.08, 0, 0, radius);
  body.addColorStop(0, "rgba(244,242,255,0.95)");
  body.addColorStop(0.16, "rgba(198,236,244,0.62)");
  body.addColorStop(0.42, "rgba(46,54,84,0.62)");
  body.addColorStop(0.78, "rgba(14,18,32,0.88)");
  body.addColorStop(1, "rgba(8,9,13,0.15)");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-radius * 0.12, radius * 0.08, radius * 0.62, radius * 0.42, -0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(165,244,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const sx = -radius * 0.28 + lightX * radius * 0.16;
  const sy = -radius * 0.34 + lightY * radius * 0.12;
  const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 0.46);
  spec.addColorStop(0, "rgba(255,255,255,0.9)");
  spec.addColorStop(0.32, "rgba(165,244,255,0.28)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, radius - 0.8, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(244,242,255,${0.28 + energy * 0.35})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

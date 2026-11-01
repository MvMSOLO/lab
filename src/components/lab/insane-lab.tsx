import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  AudioWaveform,
  CircleDot,
  Layers,
  Library,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { labAudio } from "@/lib/lab/audio";
import {
  ENVS,
  ROOMS,
  SECRETS,
  roomUnlocked,
  secretById,
  type Atmosphere,
  type EnvId,
  type RoomId,
} from "@/lib/lab/catalog";
import { DEFAULT_SAVE, loadSave, prefersReducedMotion, writeSave, type Save } from "@/lib/lab/storage";
import { Glyph } from "@/components/lab/glyphs";
import { OrbStage, type Gesture, type OrbModel } from "@/components/lab/orb-stage";

type Phase = "pending" | "boot" | "quick" | "lab";
type View = "lab" | "rooms" | "journal" | "sound" | "settings" | "room";
type DockId = Exclude<View, "room">;

const NAV_CODE = ["rooms", "journal", "sound", "settings"] as const;
const WEATHER_CODE: EnvId[] = ["dream", "mall", "rain", "liminal"];
const SHARD_SPOTS = [
  { x: "16%", y: "36%" },
  { x: "84%", y: "34%" },
  { x: "18%", y: "64%" },
  { x: "82%", y: "66%" },
  { x: "50%", y: "30%" },
];

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function magnet(value: number): number {
  for (const dent of [0, 0.5, 1]) {
    if (Math.abs(value - dent) < 0.03) return dent;
  }
  return value;
}

function formatClock(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const INITIAL_MODEL: OrbModel = {
  reduced: false,
  particles: 0.62,
  motion: 0.8,
  uncanny: false,
  room: "lab",
  atmosphere: "obsidian",
  consumeAsym: false,
  shadow: false,
  oddPulse: false,
  nullArmed: false,
  whisper: false,
  nudge: null,
};

export function InsaneLab() {
  const [phase, setPhase] = useState<Phase>("pending");
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("lab");
  const [room, setRoom] = useState<RoomId | null>(null);
  const [seenIntro, setSeenIntro] = useState(false);
  const [master, setMaster] = useState(DEFAULT_SAVE.master);
  const [music, setMusic] = useState(DEFAULT_SAVE.music);
  const [fx, setFx] = useState(DEFAULT_SAVE.fx);
  const [muted, setMuted] = useState(false);
  const [env, setEnv] = useState<EnvId>(DEFAULT_SAVE.env);
  const [horror, setHorror] = useState(true);
  const [particles, setParticles] = useState(DEFAULT_SAVE.particles);
  const [motion, setMotion] = useState(DEFAULT_SAVE.motion);
  const [reduced, setReduced] = useState(false);
  const [atmosphere, setAtmosphere] = useState<Atmosphere>("obsidian");
  const [discoveries, setDiscoveries] = useState<string[]>([]);
  const [interactions, setInteractions] = useState(0);
  const [roomsEntered, setRoomsEntered] = useState<RoomId[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [sigil, setSigil] = useState(false);
  const [charging, setCharging] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [uncanny, setUncanny] = useState(false);
  const [shadow, setShadow] = useState(false);
  const [whisper, setWhisper] = useState(false);
  const [oddPulse, setOddPulse] = useState(false);
  const [nullArmed, setNullArmed] = useState(false);
  const [weird, setWeird] = useState<DockId | null>(null);
  const [cornerFlash, setCornerFlash] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [shards, setShards] = useState([false, false, false, false, false]);
  const [dial, setDial] = useState(0.32);
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const rootRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<OrbModel>(INITIAL_MODEL);
  const onGestureRef = useRef<(gesture: Gesture) => void>(() => {});
  const settingsRef = useRef({ master, music, fx, muted, env });
  const foundRef = useRef(new Set<string>());
  const discRef = useRef<string[]>([]);
  const unlockRef = useRef<(id: string) => void>(() => {});
  const roomRef = useRef<RoomId | null>(null);
  const atmosphereRef = useRef<Atmosphere>("obsidian");
  const horrorRef = useRef(true);
  const viewRef = useRef<View>("lab");
  const phaseRef = useRef<Phase>("pending");
  const openViewRef = useRef<(next: View) => void>(() => {});
  const chooseEnvRef = useRef<(id: EnvId) => void>(() => {});
  const toggleMuteRef = useRef<() => void>(() => {});
  const rhythmRef = useRef<number[]>([]);
  const reflRef = useRef<number[]>([]);
  const navRef = useRef<{ id: string; t: number }[]>([]);
  const navCount = useRef(0);
  const envSeq = useRef<EnvId[]>([]);
  const cornerStep = useRef(0);
  const cornerAt = useRef(0);
  const starAt = useRef(0);
  const markTimer = useRef(0);
  const sigilTimer = useRef(0);
  const nullTimer = useRef(0);
  const tickAt = useRef(0);
  const started = useRef(Date.now());
  const dockTally = useRef({ id: "", n: 0 });

  settingsRef.current = { master, music, fx, muted, env };
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
    nudge: modelRef.current.nudge,
  };

  const unlock = (id: string) => {
    if (foundRef.current.has(id)) return;
    foundRef.current.add(id);
    setDiscoveries((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setToast(secretById(id)?.title ?? "Memory");
    setFlash(true);
    window.setTimeout(() => setFlash(false), 720);
    labAudio.motif();
  };
  unlockRef.current = unlock;

  const noteNav = (id: string) => {
    navCount.current += 1;
    if (navCount.current % 3 === 0 && phaseRef.current === "lab") {
      setSigil(true);
      window.clearTimeout(sigilTimer.current);
      sigilTimer.current = window.setTimeout(() => setSigil(false), 1500);
      labAudio.sparkle();
    }
    const nowStamp = performance.now();
    let trail = navRef.current.filter((item) => nowStamp - item.t < 8000);
    trail.push({ id, t: nowStamp });
    const ids = trail.map((item) => item.id);
    const matched = ids.length <= NAV_CODE.length && ids.every((item, index) => item === NAV_CODE[index]);
    if (!matched) trail = id === "rooms" ? [{ id, t: nowStamp }] : [];
    navRef.current = trail;
    if (trail.map((item) => item.id).join() === NAV_CODE.join()) unlockRef.current("path-of-rooms");
  };

  const openView = (next: View) => {
    if (next !== "room") setRoom(null);
    setView(next);
    noteNav(next);
    labAudio.ceramic();
    setInteractions((count) => count + 1);
  };
  openViewRef.current = openView;

  const chooseEnv = (id: EnvId) => {
    let seq = [...envSeq.current, id].slice(-4);
    const matched = seq.every((item, index) => item === WEATHER_CODE[index]);
    if (!matched) seq = id === "dream" ? ["dream"] : [];
    envSeq.current = seq;
    if (seq.join() === WEATHER_CODE.join()) unlock("weather-order");
    setEnv(id);
    settingsRef.current = { ...settingsRef.current, env: id };
    if (labAudio.isReady()) labAudio.setEnvironment(id);
    labAudio.droplet();
    setInteractions((count) => count + 1);
  };
  chooseEnvRef.current = chooseEnv;

  const toggleMute = () => {
    setMuted((value) => {
      const next = !value;
      settingsRef.current = { ...settingsRef.current, muted: next };
      if (labAudio.isReady()) labAudio.setVolumes(master, music, fx, next);
      return next;
    });
    labAudio.ceramic(0.8);
  };
  toggleMuteRef.current = toggleMute;

  const pushVolume = (partial: Partial<Save>) => {
    const next = { ...settingsRef.current, ...partial };
    settingsRef.current = next;
    if (labAudio.isReady()) labAudio.setVolumes(next.master, next.music, next.fx, next.muted);
  };

  const tickSlider = (value: number) => {
    if (Math.abs(value - tickAt.current) < 0.06) return;
    tickAt.current = value;
    labAudio.sliderTick();
  };

  const armNull = () => {
    window.clearTimeout(nullTimer.current);
    setNullArmed(false);
    nullTimer.current = window.setTimeout(() => setNullArmed(true), 18000);
  };

  onGestureRef.current = (gesture) => {
    if (phaseRef.current !== "lab") return;
    setTouched(true);
    setInteractions((count) => count + 1);
    const stamp = performance.now();
    if (gesture.type === "tap") {
      const height = Math.max(1, window.innerHeight);
      labAudio.glassTap(gesture.y / height, Math.min(1, 0.42 + gesture.rapid * 0.07));
      let taps = rhythmRef.current;
      const previous = taps[taps.length - 1];
      if (previous !== undefined && stamp - previous > 920) taps = [];
      taps = [...taps, stamp].slice(-7);
      rhythmRef.current = taps;
      if (taps.length === 7) {
        let ok = true;
        for (let i = 1; i < taps.length; i += 1) {
          const gap = taps[i]! - taps[i - 1]!;
          if (gap < 260 || gap > 800) ok = false;
        }
        if (ok) unlockRef.current("pulse-seven");
      }
      if (gesture.reflection && atmosphereRef.current === "obsidian") {
        const recent = reflRef.current.filter((item) => stamp - item < 5000);
        recent.push(stamp);
        reflRef.current = recent;
        if (recent.length >= 3) unlockRef.current("late-reflection");
      }
      if (roomRef.current === "null") {
        if (modelRef.current.nullArmed) unlockRef.current("null-wait");
        armNull();
      }
    } else if (gesture.type === "double") {
      labAudio.doubleGlass(gesture.y / Math.max(1, window.innerHeight));
    } else if (gesture.type === "hold-start") {
      labAudio.beginHold();
    } else if (gesture.type === "hold-end") {
      labAudio.endHold(gesture.ms);
      if (gesture.ms >= 5000 && discRef.current.filter((id) => id !== "null-key").length >= 6) {
        unlockRef.current("null-key");
      }
    } else if (gesture.type === "swipe") {
      labAudio.swish(Math.min(1, gesture.speed / 1800));
    } else if (gesture.type === "spiral") {
      labAudio.shimmer();
      unlockRef.current("spiral-glass");
    } else if (gesture.type === "twin-release") {
      labAudio.twin();
      unlockRef.current("twin-release");
    } else if (gesture.type === "pinch") {
      labAudio.sparkle();
    } else if (gesture.type === "mirror-catch") {
      labAudio.crystal(2);
      unlockRef.current("mirror-lag");
    }
  };

  useEffect(() => {
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
      setMotion(0.25);
      setParticles(0.2);
      setPhase("boot");
    } else {
      setPhase("boot");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
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
      roomsEntered,
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
    roomsEntered,
  ]);

  useEffect(() => {
    if (phase !== "boot" && phase !== "quick") return;
    const ms = phase === "quick" ? 860 : reduced ? 640 : 2900;
    const id = window.setTimeout(() => {
      setSeenIntro(true);
      setPhase("lab");
    }, ms);
    return () => window.clearTimeout(id);
  }, [phase, reduced]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (view !== "journal") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [view]);

  useEffect(() => {
    const poke = () => labAudio.poke(settingsRef.current);
    window.addEventListener("pointerdown", poke, true);
    window.addEventListener("keydown", poke, true);
    return () => {
      window.removeEventListener("pointerdown", poke, true);
      window.removeEventListener("keydown", poke, true);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--lx", `${event.clientX - rect.left}px`);
      el.style.setProperty("--ly", `${event.clientY - rect.top}px`);
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (phase !== "lab") return;
    let timer = window.setTimeout(() => unlockRef.current("stillness"), 42000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => unlockRef.current("stillness"), 42000);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "lab" || !horror || reduced) return;
    let count = 0;
    let killed = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
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
        } else if (kind === 3) {
          modelRef.current.consumeAsym = true;
        } else {
          setShadow(true);
          setWhisper(true);
          labAudio.whisper();
          later(() => {
            setShadow(false);
            setWhisper(false);
          }, 1800);
        }
        if (count < 4) run();
      }, count === 0 ? 20000 : 15000 + Math.random() * 12000);
    };
    run();
    return () => {
      killed = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [phase, horror, reduced]);

  useEffect(() => {
    if (!labAudio.isReady()) return;
    labAudio.setScene(room ?? "lab");
  }, [room]);

  useEffect(() => {
    if (room !== "frequency") return;
    labAudio.setCarrier(dial);
    if (dial <= 0.9 || foundRef.current.has("lost-dial")) return;
    const startedAt = performance.now();
    const id = window.setInterval(() => {
      if (performance.now() - startedAt > 1500) {
        unlockRef.current("lost-dial");
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [dial, room]);

  useEffect(() => {
    if (room === "garden") setShards([false, false, false, false, false]);
    if (room === "null") armNull();
    return () => window.clearTimeout(nullTimer.current);
  }, [room]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        if (event.key === "Escape") openViewRef.current("lab");
        return;
      }
      if (event.key === "Escape") openViewRef.current("lab");
      if (event.key === "m" || event.key === "M") toggleMuteRef.current();
      const envKeys: Record<string, EnvId> = {
        "1": "dream",
        "2": "mall",
        "3": "midnight",
        "4": "rain",
        "5": "liminal",
        "6": "silent",
      };
      const picked = envKeys[event.key];
      if (picked && phaseRef.current === "lab") chooseEnvRef.current(picked);
      if (phaseRef.current !== "lab") return;
      if (event.key === " ") {
        event.preventDefault();
        onGestureRef.current({
          type: "tap",
          x: window.innerWidth / 2,
          y: window.innerHeight * 0.42,
          reflection: false,
          rapid: 1,
        });
      }
      if (event.key === "ArrowLeft") modelRef.current.nudge = { x: -320, y: 0 };
      if (event.key === "ArrowRight") modelRef.current.nudge = { x: 320, y: 0 };
      if (event.key === "ArrowUp") modelRef.current.nudge = { x: 0, y: -280 };
      if (event.key === "ArrowDown") modelRef.current.nudge = { x: 0, y: 280 };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const finishBoot = () => {
    setSeenIntro(true);
    setPhase("lab");
  };

  const onDock = (id: DockId) => {
    if (horrorRef.current) {
      if (dockTally.current.id === id) dockTally.current.n += 1;
      else dockTally.current = { id, n: 1 };
      if (dockTally.current.n >= 12 && dockTally.current.n % 12 === 0) {
        setWeird(id);
        labAudio.ceramic(0.55);
        window.setTimeout(() => setWeird(null), 640);
      }
    }
    if (viewRef.current === id) openView("lab");
    else openView(id);
  };

  const onMarkDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setCharging(true);
    labAudio.ceramic(1.2);
    window.clearTimeout(markTimer.current);
    markTimer.current = window.setTimeout(() => {
      unlockRef.current("held-mark");
      setCharging(false);
    }, 3000);
  };

  const onMarkUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    window.clearTimeout(markTimer.current);
    setCharging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const hitCorner = (index: number) => {
    const stamp = performance.now();
    let step = cornerStep.current;
    if (stamp - cornerAt.current > 2600) step = 0;
    if (index === step) step += 1;
    else step = index === 0 ? 1 : 0;
    cornerStep.current = step;
    cornerAt.current = stamp;
    setCornerFlash(index);
    window.setTimeout(() => setCornerFlash(null), 240);
    labAudio.ceramic(1 + index * 0.07);
    setInteractions((count) => count + 1);
    if (step === 4) unlock("four-corners");
  };

  const enterRoom = (id: RoomId) => {
    if (!roomUnlocked(id, discoveries)) return;
    setRoom(id);
    setView("room");
    setRoomsEntered((prev) => (prev.includes(id) ? prev : [...prev, id]));
    noteNav("room");
    labAudio.shimmer();
    if (labAudio.isReady()) labAudio.setScene(id);
    setInteractions((count) => count + 1);
  };

  const lightShard = (index: number) => {
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
    foundRef.current = new Set();
    setDiscoveries([]);
    setInteractions(0);
    setRoomsEntered([]);
    setRoom(null);
    setView("lab");
    setConfirm(false);
    setToast("Archive cleared");
    labAudio.ceramic(0.7);
  };

  const envName = ENVS.find((item) => item.id === env)?.name ?? "Dream Memory";
  const openRooms = ROOMS.filter((item) => roomUnlocked(item.id, discoveries)).length;
  const activeRoom = ROOMS.find((item) => item.id === room);
  const sheet = view === "rooms" || view === "journal" || view === "sound" || view === "settings";
  const seconds = Math.max(0, Math.floor((now - started.current) / 1000));

  return (
    <div
      ref={rootRef}
      className={cx("lab-root", reduced && "is-reduced", flash && !reduced && "is-flash", phase === "lab" && "is-live")}
      data-env={env}
      data-atmosphere={atmosphere}
      data-room={room ?? "lab"}
      data-ready={phase === "lab" ? "true" : "false"}
    >
      <h1 className="sr-only">INSANE UI LAB</h1>
      <div className="haze" />
      <div className="haze haze-b" />
      <div className="grid-fade" />
      <div className="light-follow" />
      <div ref={grainRef} className="grain" />
      {phase !== "pending" ? <div className="scanlines" /> : null}

      {phase !== "pending" ? (
        <>
          <OrbStage modelRef={modelRef} onGestureRef={onGestureRef} />
          <button
            type="button"
            className="sr-only"
            onClick={() =>
              onGestureRef.current({
                type: "tap",
                x: window.innerWidth / 2,
                y: window.innerHeight * 0.42,
                reflection: false,
                rapid: 1,
              })
            }
          >
            Touch the glass
          </button>

          {phase === "lab" && !sheet
            ? [0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  type="button"
                  className={cx("corner", `corner-${index}`, cornerFlash === index && "lit")}
                  aria-label="Quiet edge of the laboratory"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    hitCorner(index);
                  }}
                />
              ))
            : null}

          {phase === "lab" && !sheet ? (
            <button
              type="button"
              className="star"
              aria-label="Small glint"
              onPointerDown={(event) => {
                event.stopPropagation();
                const stamp = performance.now();
                if (stamp - starAt.current < 360) unlock("small-star");
                starAt.current = stamp;
                labAudio.sparkle();
                setInteractions((count) => count + 1);
              }}
            >
              <Glyph name="star" />
            </button>
          ) : null}

          <header className="topbar">
            <button
              type="button"
              className={cx("mark", charging && "charging")}
              aria-label="Laboratory mark"
              onPointerDown={onMarkDown}
              onPointerUp={onMarkUp}
              onPointerCancel={onMarkUp}
            >
              <svg className="mark-svg" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15" />
                <circle cx="18" cy="18" r="3" />
              </svg>
              <span className="brand-copy">
                <span className="eyebrow">{glitch ? "LABORAT0RY" : "LABORATORY"}</span>
                <span className="wordmark">INSANE UI LAB</span>
              </span>
            </button>
            <button
              type="button"
              className="mute"
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
              onClick={toggleMute}
            >
              {muted ? <VolumeX strokeWidth={1.5} /> : <Volume2 strokeWidth={1.5} />}
            </button>
          </header>

          {view === "lab" ? (
            <p className={cx("invite", touched && "gone")}>Touch something. Discover something.</p>
          ) : null}
          {view === "lab" ? <p className="env-pill">{env === "silent" ? "Silent" : envName}</p> : null}

          {view === "room" && activeRoom ? (
            <div className="room-hud">
              <div>
                <p className="room-kicker">Room {activeRoom.numeral}</p>
                <h2 className="room-title">{activeRoom.name}</h2>
                <p className="room-line">{activeRoom.line}</p>
              </div>
              <button type="button" className="return-btn" onClick={() => openView("lab")}>
                Return
              </button>
            </div>
          ) : null}

          {room === "garden" && view === "room"
            ? SHARD_SPOTS.map((spot, index) => (
                <button
                  key={spot.x}
                  type="button"
                  className={cx("shard", shards[index] && "lit")}
                  style={{ left: spot.x, top: spot.y }}
                  aria-label={`Crystal ${index + 1}`}
                  onClick={() => lightShard(index)}
                />
              ))
            : null}

          {room === "frequency" && view === "room" ? (
            <div className="tuner">
              <div className="tuner-top">
                <span className="field-label">Carrier</span>
                <span className="tuner-read">{Math.round(130 + dial * 620)}</span>
              </div>
              <input
                className="slider"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={dial}
                aria-label="Carrier frequency"
                onChange={(event) => {
                  const value = magnet(Number(event.target.value));
                  setDial(value);
                  tickSlider(value);
                }}
              />
            </div>
          ) : null}

          <nav className="dock" aria-label="Laboratory">
            {(
              [
                ["lab", "Orb", CircleDot],
                ["rooms", "Rooms", Layers],
                ["journal", "Journal", Library],
                ["sound", "Sound", AudioWaveform],
                ["settings", "Settings", SlidersHorizontal],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={cx("dock-btn", (view === id || (id === "rooms" && view === "room")) && "active", weird === id && "weird")}
                aria-current={view === id ? "page" : undefined}
                onClick={() => onDock(id)}
              >
                <Icon strokeWidth={1.5} />
                <span>{label}</span>
                {id === "journal" && discoveries.length > 0 ? (
                  <em className="badge">{discoveries.length}</em>
                ) : null}
                {id === "rooms" && openRooms > 0 ? <em className="badge">{openRooms}</em> : null}
              </button>
            ))}
          </nav>

          {sheet ? (
            <button type="button" className="scrim" aria-label="Close panel" onClick={() => openView("lab")} />
          ) : null}

          {sheet ? (
            <section className="sheet" role="dialog" aria-label={view}>
              <div className="sheet-body">
                {view === "sound" ? (
                  <>
                    <div className="sheet-head">
                      <div>
                        <p className="sheet-kicker">Sound</p>
                        <h2 className="sheet-title">Environments</h2>
                      </div>
                      <button type="button" className="icon-btn" aria-label="Close sound" onClick={() => openView("lab")}>
                        <X strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="sheet-note">Original tones, made in the moment. Music keeps playing as you move.</p>
                    <div className="env-list">
                      {ENVS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cx("env-card", env === item.id && "active")}
                          aria-pressed={env === item.id}
                          onClick={() => chooseEnv(item.id)}
                          onPointerMove={reduced ? undefined : tilt}
                          onPointerLeave={untilt}
                        >
                          <span className="env-name">{item.name}</span>
                          <span className="env-line">{item.line}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {view === "journal" ? (
                  <>
                    <div className="sheet-head">
                      <div>
                        <p className="sheet-kicker">Archive</p>
                        <h2 className="sheet-title">Discovery journal</h2>
                      </div>
                      <button type="button" className="icon-btn" aria-label="Close journal" onClick={() => openView("lab")}>
                        <X strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="sheet-note">
                      {discoveries.length === 0
                        ? "The archive is quiet. The laboratory is not."
                        : "Memories the room agreed to keep."}
                    </p>
                    <div
                      className="meter"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={SECRETS.length}
                      aria-valuenow={discoveries.length}
                      aria-label="Discovery progress"
                    >
                      <span style={{ transform: `scaleX(${discoveries.length / SECRETS.length})` }} />
                    </div>
                    <p className="meter-label">
                      {discoveries.length} of {SECRETS.length} memories
                    </p>
                    <div className="stat-row">
                      <p className="stat">
                        <span>Touches</span>
                        <strong>{interactions}</strong>
                      </p>
                      <p className="stat">
                        <span>Rooms</span>
                        <strong>
                          {openRooms}/{ROOMS.length}
                        </strong>
                      </p>
                      <p className="stat">
                        <span>Session</span>
                        <strong>{formatClock(seconds)}</strong>
                      </p>
                    </div>
                    <div className="memory-list">
                      {SECRETS.map((secret) => {
                        const open = discoveries.includes(secret.id);
                        return (
                          <article key={secret.id} className={cx("memory", !open && "sealed")}>
                            <Glyph name={open ? secret.glyph : "still"} />
                            <div>
                              <h3 className="memory-title">{open ? secret.title : "Unopened"}</h3>
                              <p className="memory-line">
                                {open ? secret.line : "A memory that has not surfaced."}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {view === "rooms" ? (
                  <>
                    <div className="sheet-head">
                      <div>
                        <p className="sheet-kicker">Chambers</p>
                        <h2 className="sheet-title">Hidden rooms</h2>
                      </div>
                      <button type="button" className="icon-btn" aria-label="Close rooms" onClick={() => openView("lab")}>
                        <X strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="sheet-note">Doors open from what you find, not from a list of instructions.</p>
                    <div className="env-list">
                      {ROOMS.map((item) => {
                        const open = roomUnlocked(item.id, discoveries);
                        const visited = roomsEntered.includes(item.id);
                        return (
                          <article key={item.id} className={cx("env-card", open && "active")}>
                            <span className="env-name">
                              {item.numeral} {open ? item.name : "Sealed"}
                            </span>
                            <span className="env-line">
                              {open ? item.line : "This chamber has not opened."}
                              {visited ? " Visited." : ""}
                            </span>
                            {open ? (
                              <button type="button" className="return-btn" onClick={() => enterRoom(item.id)}>
                                Enter
                              </button>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {view === "settings" ? (
                  <>
                    <div className="sheet-head">
                      <div>
                        <p className="sheet-kicker">Control</p>
                        <h2 className="sheet-title">Settings</h2>
                      </div>
                      <button type="button" className="icon-btn" aria-label="Close settings" onClick={() => openView("lab")}>
                        <X strokeWidth={1.5} />
                      </button>
                    </div>
                    <label className="field">
                      <span className="field-label">Master</span>
                      <input
                        className="slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={master}
                        aria-label="Master volume"
                        onChange={(event) => {
                          const value = magnet(Number(event.target.value));
                          setMaster(value);
                          pushVolume({ master: value });
                          tickSlider(value);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Music</span>
                      <input
                        className="slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={music}
                        aria-label="Music volume"
                        onChange={(event) => {
                          const value = magnet(Number(event.target.value));
                          setMusic(value);
                          pushVolume({ music: value });
                          tickSlider(value);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Effects</span>
                      <input
                        className="slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={fx}
                        aria-label="Effects volume"
                        onChange={(event) => {
                          const value = magnet(Number(event.target.value));
                          setFx(value);
                          pushVolume({ fx: value });
                          tickSlider(value);
                        }}
                      />
                    </label>
                    <div className="field">
                      <span className="field-label">Particles</span>
                      <input
                        className="slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={particles}
                        aria-label="Particle intensity"
                        onChange={(event) => setParticles(magnet(Number(event.target.value)))}
                      />
                    </div>
                    <div className="field">
                      <span className="field-label">Motion</span>
                      <input
                        className="slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={motion}
                        aria-label="Motion intensity"
                        onChange={(event) => setMotion(magnet(Number(event.target.value)))}
                      />
                    </div>
                    <div className="field">
                      <span>
                        <span className="field-label">Aware layer</span>
                        <span className="field-help">Subtle unease. Never a scare. Switch it off whenever you want.</span>
                      </span>
                      <Switch
                        on={horror}
                        label="Aware layer"
                        onToggle={() => {
                          setHorror((value) => !value);
                          labAudio.droplet();
                        }}
                      />
                    </div>
                    <div className="field">
                      <span>
                        <span className="field-label">Reduced effects</span>
                        <span className="field-help">Fewer particles, no blur, calmer motion.</span>
                      </span>
                      <Switch
                        on={reduced}
                        label="Reduced effects"
                        onToggle={() => {
                          setReduced((value) => !value);
                          labAudio.ceramic();
                        }}
                      />
                    </div>
                    <div className="field column">
                      <span className="field-label">Atmosphere</span>
                      <div className="choice-row">
                        <button
                          type="button"
                          className={cx("choice", atmosphere === "obsidian" && "active")}
                          aria-pressed={atmosphere === "obsidian"}
                          onClick={() => {
                            setAtmosphere("obsidian");
                            labAudio.ceramic(0.9);
                          }}
                        >
                          Obsidian
                        </button>
                        <button
                          type="button"
                          className={cx("choice", atmosphere === "dusk" && "active")}
                          aria-pressed={atmosphere === "dusk"}
                          onClick={() => {
                            setAtmosphere("dusk");
                            labAudio.ceramic(1.15);
                          }}
                        >
                          Dusk
                        </button>
                      </div>
                    </div>
                    <div className="action-row">
                      <button type="button" className="text-btn" onClick={() => setPhase("boot")}>
                        Replay introduction
                      </button>
                      <button type="button" className="text-btn danger" onClick={() => setConfirm(true)}>
                        Reset discoveries
                      </button>
                    </div>
                    <p className="help">
                      Space touches the glass. Arrows nudge it. M mutes. 1–6 change the weather. Esc closes a
                      panel.
                    </p>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {sigil ? (
            <button type="button" className="sigil" aria-label="Passing sign" onClick={() => {
              unlock("passing-sigil");
              setSigil(false);
            }}>
              <Glyph name="sigil" />
            </button>
          ) : null}

          {toast ? (
            <div className="toast" role="status">
              <svg className="toast-ring" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="14" />
              </svg>
              <span>{toast}</span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="boot-title pending-title">INSANE UI LAB</p>
      )}

      {phase === "boot" || phase === "quick" ? (
        <div className={cx("boot", phase === "quick" && "boot-quick", reduced && "boot-calm")} role="dialog" aria-label="Introduction">
          <div className="boot-point" />
          <div className="boot-line" />
          <div className="boot-sphere" />
          <p className="boot-kicker">Laboratory</p>
          <p className="boot-title">INSANE UI LAB</p>
          <p className="boot-invite">Touch something. Discover something.</p>
          <button type="button" className="boot-skip" onClick={finishBoot}>
            Skip
          </button>
        </div>
      ) : null}

      {confirm ? (
        <div className="modal">
          <div className="modal-card" role="dialog" aria-labelledby="reset-title">
            <h2 id="reset-title">Clear the archive?</h2>
            <p>Memories, room visits, and the touch count return to zero. Sound settings stay.</p>
            <div className="action-row">
              <button type="button" className="text-btn" onClick={() => setConfirm(false)}>
                Keep
              </button>
              <button type="button" className="text-btn danger" onClick={resetArchive}>
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx("switch", on && "on")} onClick={onToggle}>
      <span className="switch-knob" />
    </button>
  );
}

function tilt(event: ReactPointerEvent<HTMLButtonElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width - 0.5;
  const py = (event.clientY - rect.top) / rect.height - 0.5;
  event.currentTarget.style.setProperty("--ry", `${px * 7}deg`);
  event.currentTarget.style.setProperty("--rx", `${-py * 6}deg`);
}

function untilt(event: ReactPointerEvent<HTMLButtonElement>) {
  event.currentTarget.style.setProperty("--ry", "0deg");
  event.currentTarget.style.setProperty("--rx", "0deg");
}

import {
  ENVS,
  SECRET_IDS,
  type Atmosphere,
  type EnvId,
  type RoomId,
} from "@/lib/lab/catalog";

const KEY = "insane-ui-lab-v1";

export type Save = {
  seenIntro: boolean;
  master: number;
  music: number;
  fx: number;
  muted: boolean;
  env: EnvId;
  horror: boolean;
  particles: number;
  motion: number;
  reduced: boolean;
  atmosphere: Atmosphere;
  discoveries: string[];
  interactions: number;
  roomsEntered: RoomId[];
};

export const DEFAULT_SAVE: Save = {
  seenIntro: false,
  master: 0.62,
  music: 0.42,
  fx: 0.7,
  muted: false,
  env: "dream",
  horror: true,
  particles: 0.62,
  motion: 0.8,
  reduced: false,
  atmosphere: "obsidian",
  discoveries: [],
  interactions: 0,
  roomsEntered: [],
};

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function isEnv(value: unknown): value is EnvId {
  return ENVS.some((env) => env.id === value);
}

function isRoom(value: unknown): value is RoomId {
  return value === "garden" || value === "frequency" || value === "mirror" || value === "null";
}

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Save>;
    const discoveries = Array.isArray(data.discoveries)
      ? data.discoveries.filter((id): id is string => typeof id === "string" && SECRET_IDS.has(id))
      : [];
    const roomsEntered = Array.isArray(data.roomsEntered)
      ? data.roomsEntered.filter(isRoom)
      : [];
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
      interactions:
        typeof data.interactions === "number" && data.interactions > 0
          ? Math.min(1_000_000, Math.floor(data.interactions))
          : 0,
      roomsEntered,
    };
  } catch {
    return null;
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage full or blocked — the session still works */
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

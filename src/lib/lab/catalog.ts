export type EnvId = "dream" | "mall" | "midnight" | "rain" | "liminal" | "silent";

export type RoomId = "garden" | "frequency" | "mirror" | "null";

export type Atmosphere = "obsidian" | "dusk";

export type Secret = {
  id: string;
  title: string;
  line: string;
  glyph: string;
};

export type RoomDef = {
  id: RoomId;
  numeral: string;
  name: string;
  line: string;
  needs: string[];
};

export type EnvDef = {
  id: EnvId;
  name: string;
  line: string;
};

export const ENVS: EnvDef[] = [
  {
    id: "midnight",
    name: "Midnight Computer",
    line: "A soft digital hum and sparse little tones.",
  },
  {
    id: "dream",
    name: "Dream Memory",
    line: "Warm pads, slow chords, a room you almost remember.",
  },
  {
    id: "silent",
    name: "Silent Space",
    line: "The laboratory, with every sound switched off.",
  },
  {
    id: "mall",
    name: "Empty Mall",
    line: "Hollow distance. One note, then a long quiet.",
  },
  {
    id: "liminal",
    name: "Liminal Signal",
    line: "Beautiful, slightly unsettled, never loud.",
  },
  {
    id: "rain",
    name: "Rain on Glass",
    line: "Synthetic rain over a low warm harmony.",
  },
];

export const SECRETS: Secret[] = [
  {
    id: "pulse-seven",
    title: "Seven Pulses",
    line: "A counted quiet found the meter under the glass.",
    glyph: "pulse",
  },
  {
    id: "held-mark",
    title: "The Mark",
    line: "The name of the laboratory stayed warm in the hand.",
    glyph: "mark",
  },
  {
    id: "spiral-glass",
    title: "Spiral",
    line: "A turning path opened a thinner place.",
    glyph: "spiral",
  },
  {
    id: "path-of-rooms",
    title: "Path",
    line: "Four doors, touched as if they were one sentence.",
    glyph: "path",
  },
  {
    id: "four-corners",
    title: "Edges",
    line: "The room agreed, corner by corner.",
    glyph: "corners",
  },
  {
    id: "stillness",
    title: "Stillness",
    line: "Nothing moved, and something answered.",
    glyph: "still",
  },
  {
    id: "late-reflection",
    title: "Late Light",
    line: "In the darker air the highlight spoke first.",
    glyph: "reflect",
  },
  {
    id: "small-star",
    title: "Unlisted Star",
    line: "It was never only decoration.",
    glyph: "star",
  },
  {
    id: "weather-order",
    title: "Old Weather",
    line: "Four climates, remembered in their first order.",
    glyph: "weather",
  },
  {
    id: "twin-release",
    title: "Twin Hands",
    line: "Two touches left the glass together.",
    glyph: "twin",
  },
  {
    id: "passing-sigil",
    title: "Passing Sigil",
    line: "A sign that exists only between moments.",
    glyph: "sigil",
  },
  {
    id: "null-key",
    title: "Null Key",
    line: "Enough memories, held, became a door made of nothing.",
    glyph: "null",
  },
  {
    id: "garden-ring",
    title: "Glass Garden",
    line: "Five crystals rang as one instrument.",
    glyph: "garden",
  },
  {
    id: "lost-dial",
    title: "Lost Frequency",
    line: "The carrier climbed until the static stepped aside.",
    glyph: "dial",
  },
  {
    id: "mirror-lag",
    title: "The Mirror",
    line: "The delayed self was allowed to catch up.",
    glyph: "mirror",
  },
  {
    id: "null-wait",
    title: "Null Space",
    line: "Emptiness, kept, brightened by a single touch.",
    glyph: "void",
  },
];

export const ROOMS: RoomDef[] = [
  {
    id: "garden",
    numeral: "01",
    name: "Glass Garden",
    line: "Translucent growth. Soft crystal.",
    needs: ["spiral-glass", "pulse-seven"],
  },
  {
    id: "frequency",
    numeral: "02",
    name: "Lost Frequency",
    line: "A midnight machine still humming.",
    needs: ["weather-order", "held-mark"],
  },
  {
    id: "mirror",
    numeral: "03",
    name: "The Mirror",
    line: "Light that arrives a moment late.",
    needs: ["late-reflection", "twin-release"],
  },
  {
    id: "null",
    numeral: "04",
    name: "Null Space",
    line: "Almost nothing. Exactly enough.",
    needs: ["null-key"],
  },
];

export const SECRET_IDS = new Set(SECRETS.map((secret) => secret.id));

export function roomUnlocked(id: RoomId, found: readonly string[]): boolean {
  const room = ROOMS.find((item) => item.id === id);
  if (!room) return false;
  return room.needs.some((need) => found.includes(need));
}

export function secretById(id: string): Secret | undefined {
  return SECRETS.find((secret) => secret.id === id);
}

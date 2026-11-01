type GlyphProps = { name: string; className?: string };

export function Glyph({ name, className }: GlyphProps) {
  return (
    <svg
      className={className ?? "glyph"}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape(name)}
    </svg>
  );
}

function shape(name: string) {
  switch (name) {
    case "pulse":
      return <path d="M4 16h6l2-6 4 12 2-6h10" />;
    case "mark":
      return <path d="M16 5v14M16 19l-6 8M16 19l6 8M8 12h16" />;
    case "spiral":
      return <path d="M16 16c2 0 4 2 4 4s-2 3-4 3-5-2-5-5 3-7 7-7 8 4 8 9" />;
    case "path":
      return <path d="M6 24V10h8v14M18 24V6h8v18" />;
    case "corners":
      return <path d="M6 12V6h6M26 12V6h-6M6 20v6h6M26 20v6h-6" />;
    case "still":
      return <circle cx="16" cy="16" r="3.5" />;
    case "reflect":
      return <path d="M8 22c4-10 12-10 16 0M10 12h12" />;
    case "star":
      return <path d="M16 5l2.2 6.6H25l-5.4 4.1 2.1 6.6L16 18.8 10.3 22.3l2.1-6.6L7 11.6h6.8z" />;
    case "weather":
      return <path d="M7 21h13.5a4.5 4.5 0 0 0 .6-9 6 6 0 0 0-11.6 1.6" />;
    case "twin":
      return <path d="M11 7v18M21 7v18M11 16h10" />;
    case "sigil":
      return <path d="M16 4.5l2.4 7.2H26l-6 4.5 2.3 7.3L16 19.2 9.7 23.5 12 16.2 6 11.7h7.6z" />;
    case "null":
      return <circle cx="16" cy="16" r="7" />;
    case "garden":
      return <path d="M16 27V14M16 16c-4-1-7-5-6-9 4 1 6 5 6 9zM16 18c4-2 8-2 9-7-4 0-7 3-9 7z" />;
    case "dial":
      return <path d="M7 22a10 10 0 1 1 18 0M16 16l5-4" />;
    case "mirror":
      return <path d="M8 6h16v20H8zM8 16h16" />;
    case "void":
      return <path d="M16 7v18M7 16h18" />;
    default:
      return <circle cx="16" cy="16" r="2" />;
  }
}

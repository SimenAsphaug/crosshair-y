import type { Design } from "./types";
import { defaultDesign, emptyCells } from "./design";

type Patch = {
  [K in keyof Design]?: Design[K] extends object ? Partial<Design[K]> : Design[K];
};

function make(id: string, name: string, tags: string[], p: Patch): BuiltinDesign {
  const base = defaultDesign(name);
  const d: Design = { ...base, id: `builtin:${id}`, name };
  for (const key of Object.keys(p) as (keyof Design)[]) {
    const v = p[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      (d as any)[key] = { ...(base as any)[key], ...v };
    } else if (v !== undefined) {
      (d as any)[key] = v;
    }
  }
  return { design: d, tags };
}

function pixelArt(rows: string[], palette: Record<string, string>, cell = 2): Design["pixels"] {
  const grid = Math.max(rows.length, ...rows.map((r) => r.length));
  const cells = emptyCells(grid);
  const offY = Math.floor((grid - rows.length) / 2);
  rows.forEach((row, y) => {
    const offX = Math.floor((grid - row.length) / 2);
    [...row].forEach((ch, x) => {
      if (palette[ch]) cells[(y + offY) * grid + x + offX] = palette[ch];
    });
  });
  return { enabled: true, grid, cell, cells };
}

const OFF = { enabled: false };

export interface BuiltinDesign {
  design: Design;
  tags: string[];
}

export const BUILTIN_DESIGNS: BuiltinDesign[] = [
  make("classic-green", "Classic", ["classic", "tactical"], {}),
  make("classic-cyan", "Cyan Cross", ["classic", "tactical"], {
    lines: { color: "#00ffff", length: 6, gap: 3 },
  }),
  make("tight-white", "Tight White", ["tactical", "small"], {
    lines: { color: "#ffffff", length: 4, gap: 2, thickness: 2 },
    outline: { opacity: 0.8 },
  }),
  make("micro-dot", "Micro Dot", ["dot", "small"], {
    lines: OFF,
    dot: { enabled: true, size: 3, color: "#ffffff" },
    outline: { opacity: 0.9 },
  }),
  make("round-dot", "Round Dot", ["dot"], {
    lines: OFF,
    dot: { enabled: true, size: 6, color: "#ff3355", shape: "circle" },
    outline: { enabled: true, opacity: 0.7 },
  }),
  make("cross-dot", "Cross + Dot", ["classic"], {
    lines: { color: "#ffee00", gap: 5, length: 6 },
    dot: { enabled: true, size: 2, color: "#ffee00" },
  }),
  make("plus", "Plus", ["classic", "small"], {
    lines: { color: "#ff44cc", gap: 0, length: 5, thickness: 2 },
  }),
  make("t-shape", "T-Shape", ["tactical"], {
    lines: { color: "#00ff88", gap: 4, length: 8 },
    tShape: "always",
  }),
  make("dynamic", "Dynamic Bloom", ["dynamic", "tactical"], {
    lines: { color: "#7cf9ff", gap: 3, length: 6 },
    bloom: { enabled: true, amount: 8, attack: 50, recovery: 250 },
  }),
  make("firing-t", "Recoil T", ["dynamic"], {
    lines: { color: "#ffffff", gap: 4, length: 7 },
    tShape: "firing",
    bloom: { enabled: true, amount: 5, attack: 40, recovery: 200 },
  }),
  make("x-cross", "X Cross", ["classic"], {
    lines: { color: "#ff5533", rotation: 45, gap: 4, length: 7 },
  }),
  make("ring", "Ring", ["circle"], {
    lines: OFF,
    circle: { enabled: true, radius: 10, thickness: 1.5, color: "#00ff88" },
  }),
  make("ring-dot", "Ring + Dot", ["circle", "dot"], {
    lines: OFF,
    dot: { enabled: true, size: 2, color: "#ffffff" },
    circle: { enabled: true, radius: 14, thickness: 1, color: "#ffffff" },
  }),
  make("scope", "Scope", ["circle", "sniper"], {
    lines: { color: "#ff2244", gap: 6, length: 14, thickness: 1 },
    circle: { enabled: true, radius: 18, thickness: 1, color: "#ff2244" },
    dot: { enabled: true, size: 2, color: "#ff2244" },
  }),
  make("soft-glow", "Soft Glow", ["glow"], {
    lines: { color: "#66ccff", gap: 4, length: 8, blur: 1.2 },
    dot: { enabled: true, size: 3, color: "#ffffff", shape: "circle", blur: 0.6 },
    outline: { enabled: true, color: "#0066ff", opacity: 0.6, thickness: 2, blur: 2 },
  }),
  make("long-lines", "Long Lines", ["sniper"], {
    lines: { color: "#00ff00", gap: 10, length: 40, thickness: 1 },
    outline: OFF,
  }),
  make("thick", "Chunky", ["visible"], {
    lines: { color: "#ffff00", gap: 5, length: 10, thickness: 4 },
    outline: { thickness: 2, opacity: 1 },
  }),
  make("chevron-px", "Chevron", ["pixel"], {
    lines: OFF,
    outline: OFF,
    pixels: pixelArt(
      ["X.......X", ".X.....X.", "..X...X..", "...X.X...", "....X...."],
      { X: "#00ffcc" },
      2,
    ),
  }),
  make("bracket-px", "Brackets", ["pixel"], {
    lines: OFF,
    outline: OFF,
    pixels: pixelArt(
      ["XX.......XX", "X.........X", "...........", ".....O.....", "...........", "X.........X", "XX.......XX"],
      { X: "#ffffff", O: "#ff3355" },
      2,
    ),
  }),
  make("diamond-px", "Diamond", ["pixel"], {
    lines: OFF,
    outline: OFF,
    pixels: pixelArt(
      ["...K...", "..KWK..", ".KW.WK.", "KW...WK", ".KW.WK.", "..KWK..", "...K..."],
      { W: "#ffffff", K: "#000000" },
      2,
    ),
  }),
  // Image crosshairs shipped with the original Crosshair Y.
  ...["3 Lines 1 Dot", "3 Lines", "5 Dots", "Chevron", "Dot", "Simple"].map((file) =>
    make(`img-${file.toLowerCase().replace(/\s+/g, "-")}`, `${file} (image)`, ["image"], {
      lines: OFF,
      outline: OFF,
      image: { enabled: true, src: `builtin/${file}.png`, size: 32 },
    }),
  ),
];

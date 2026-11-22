import type { Design, SavedDesign, Hex } from "./types";

export function uid(prefix = ""): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export const PIXEL_GRID_DEFAULT = 21;

export function emptyCells(grid: number): string[] {
  return new Array(grid * grid).fill("");
}

export function defaultDesign(name = "New crosshair"): Design {
  return {
    id: uid("d_"),
    name,
    lines: { enabled: true, color: "#00ff88", opacity: 1, length: 7, thickness: 2, gap: 4, blur: 0, rotation: 0 },
    dot: { enabled: false, color: "#00ff88", opacity: 1, size: 2, blur: 0, shape: "square" },
    outline: { enabled: true, color: "#000000", opacity: 0.6, thickness: 1, blur: 0 },
    circle: { enabled: false, color: "#00ff88", opacity: 1, radius: 12, thickness: 1, blur: 0 },
    pixels: { enabled: false, grid: PIXEL_GRID_DEFAULT, cell: 2, cells: emptyCells(PIXEL_GRID_DEFAULT) },
    image: { enabled: false, src: "", size: 48, opacity: 1, rotation: 0 },
    tShape: "never",
    bloom: { enabled: false, amount: 6, attack: 60, recovery: 220 },
  };
}

export function toSaved(d: Design, origin: SavedDesign["origin"] = "user"): SavedDesign {
  const now = Date.now();
  return { ...d, favorite: false, categoryId: null, createdAt: now, updatedAt: now, origin };
}

// ── Validation (used for anything that comes from disk, imports, or the network) ──

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const IMAGE_DATA_RE = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const BUILTIN_RE = /^builtin\/[A-Za-z0-9 _.+-]+\.(png|svg)$/;
export const MAX_IMAGE_BYTES = 1_500_000;

function num(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
function bool(v: unknown, def: boolean): boolean {
  return typeof v === "boolean" ? v : def;
}
function color(v: unknown, def: Hex): Hex {
  return typeof v === "string" && HEX_RE.test(v) ? v.toLowerCase() : def;
}
function str(v: unknown, def: string, max = 80): string {
  return typeof v === "string" ? v.slice(0, max) : def;
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function isSafeImageSrc(src: string): boolean {
  if (BUILTIN_RE.test(src) && !src.includes("..")) return true;
  return src.length <= MAX_IMAGE_BYTES * 1.4 && IMAGE_DATA_RE.test(src);
}

export function normalizeDesign(input: unknown, keepId = true): Design {
  const d = defaultDesign();
  const i = obj(input);
  const l = obj(i.lines), dt = obj(i.dot), o = obj(i.outline), c = obj(i.circle), p = obj(i.pixels), im = obj(i.image), b = obj(i.bloom);

  const grid = Math.round(num(p.grid, d.pixels.grid, 3, 64));
  const rawCells = Array.isArray(p.cells) ? p.cells : [];
  const cells = emptyCells(grid).map((_, idx) => {
    const v = rawCells[idx];
    return typeof v === "string" && HEX_RE.test(v) ? v.toLowerCase() : "";
  });

  const imageSrc = typeof im.src === "string" && isSafeImageSrc(im.src) ? im.src : "";

  return {
    id: keepId && typeof i.id === "string" && i.id.length <= 64 ? i.id : uid("d_"),
    name: str(i.name, "Untitled", 60).trim() || "Untitled",
    lines: {
      enabled: bool(l.enabled, d.lines.enabled),
      color: color(l.color, d.lines.color),
      opacity: num(l.opacity, 1, 0, 1),
      length: num(l.length, d.lines.length, 0, 200),
      thickness: num(l.thickness, d.lines.thickness, 0.5, 50),
      gap: num(l.gap, d.lines.gap, -50, 200),
      blur: num(l.blur, 0, 0, 20),
      rotation: num(l.rotation, 0, -360, 360),
    },
    dot: {
      enabled: bool(dt.enabled, d.dot.enabled),
      color: color(dt.color, d.dot.color),
      opacity: num(dt.opacity, 1, 0, 1),
      size: num(dt.size, d.dot.size, 0.5, 100),
      blur: num(dt.blur, 0, 0, 20),
      shape: dt.shape === "circle" ? "circle" : "square",
    },
    outline: {
      enabled: bool(o.enabled, d.outline.enabled),
      color: color(o.color, d.outline.color),
      opacity: num(o.opacity, d.outline.opacity, 0, 1),
      thickness: num(o.thickness, d.outline.thickness, 0.5, 10),
      blur: num(o.blur, 0, 0, 20),
    },
    circle: {
      enabled: bool(c.enabled, d.circle.enabled),
      color: color(c.color, d.circle.color),
      opacity: num(c.opacity, 1, 0, 1),
      radius: num(c.radius, d.circle.radius, 1, 200),
      thickness: num(c.thickness, d.circle.thickness, 0.5, 50),
      blur: num(c.blur, 0, 0, 20),
    },
    pixels: {
      enabled: bool(p.enabled, false),
      grid,
      cell: num(p.cell, d.pixels.cell, 1, 16),
      cells,
    },
    image: {
      enabled: bool(im.enabled, false) && imageSrc !== "",
      src: imageSrc,
      size: num(im.size, d.image.size, 4, 1024),
      opacity: num(im.opacity, 1, 0, 1),
      rotation: num(im.rotation, 0, -360, 360),
    },
    tShape: i.tShape === "always" || i.tShape === "firing" ? i.tShape : "never",
    bloom: {
      enabled: bool(b.enabled, false),
      amount: num(b.amount, d.bloom.amount, 0, 100),
      attack: num(b.attack, d.bloom.attack, 0, 2000),
      recovery: num(b.recovery, d.bloom.recovery, 0, 5000),
    },
  };
}

export function normalizeSaved(input: unknown): SavedDesign {
  const i = obj(input);
  const d = normalizeDesign(input);
  const origins = ["user", "builtin", "community", "import"] as const;
  return {
    ...d,
    favorite: bool(i.favorite, false),
    categoryId: typeof i.categoryId === "string" ? i.categoryId : null,
    createdAt: num(i.createdAt, Date.now(), 0, 1e15),
    updatedAt: num(i.updatedAt, Date.now(), 0, 1e15),
    origin: origins.includes(i.origin as never) ? (i.origin as SavedDesign["origin"]) : "user",
  };
}

/** Strips app metadata so a design can be shared. */
export function toPortable(d: Design): Omit<Design, "id"> {
  const { id: _id, ...rest } = d as Design & Partial<SavedDesign>;
  const r = rest as Record<string, unknown>;
  delete r.favorite;
  delete r.categoryId;
  delete r.createdAt;
  delete r.updatedAt;
  delete r.origin;
  return r as Omit<Design, "id">;
}

// ── Geometry ──

/**
 * Max distance (px, before profile scale) from the center that the design can
 * paint, including outline, blur and full bloom. Used to size the overlay.
 */
export function designExtent(d: Design, imageAspect = 1): number {
  let r = 2;
  const ol = d.outline.enabled ? d.outline.thickness + d.outline.blur * 2 : 0;
  if (d.lines.enabled) {
    const spread = d.bloom.enabled ? d.bloom.amount : 0;
    const reach = Math.max(0, d.lines.gap + spread + d.lines.length);
    r = Math.max(r, Math.hypot(reach, d.lines.thickness / 2) + ol + d.lines.blur * 2);
  }
  if (d.dot.enabled) r = Math.max(r, (d.dot.size / 2) * Math.SQRT2 + ol + d.dot.blur * 2);
  if (d.circle.enabled) r = Math.max(r, d.circle.radius + d.circle.thickness / 2 + ol + d.circle.blur * 2);
  if (d.pixels.enabled) r = Math.max(r, ((d.pixels.grid * d.pixels.cell) / 2) * Math.SQRT2);
  if (d.image.enabled && d.image.src) {
    const w = imageAspect >= 1 ? d.image.size : d.image.size * imageAspect;
    const h = imageAspect >= 1 ? d.image.size / imageAspect : d.image.size;
    r = Math.max(r, Math.hypot(w, h) / 2);
  }
  return r;
}

export function hasVisibleContent(d: Design): boolean {
  return (
    d.lines.enabled ||
    d.dot.enabled ||
    d.circle.enabled ||
    (d.pixels.enabled && d.pixels.cells.some(Boolean)) ||
    (d.image.enabled && !!d.image.src)
  );
}

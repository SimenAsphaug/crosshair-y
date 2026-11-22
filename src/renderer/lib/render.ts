import type { Design } from "../../shared/types";
import { designExtent } from "../../shared/design";

// ── Image cache (shared by every canvas in a page) ──

const images = new Map<string, HTMLImageElement>();
const imageListeners = new Set<() => void>();

export function onImageLoaded(cb: () => void) {
  imageListeners.add(cb);
  return () => {
    imageListeners.delete(cb);
  };
}

export function getImage(src: string): HTMLImageElement | null {
  if (!src) return null;
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = () => imageListeners.forEach((l) => l());
    img.src = src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// ── Drawing ──

export interface RenderOptions {
  cx: number; // center in canvas pixels
  cy: number;
  scale: number;
  spread?: number; // current bloom (px, unscaled)
  firing?: boolean;
  snap?: boolean; // align rectangles to the pixel grid
}

type Rect = [number, number, number, number];

let scratch: HTMLCanvasElement | null = null;
function scratchCtx(w: number, h: number) {
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  const c = scratch.getContext("2d")!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);
  return c;
}

/** Draws into an isolated layer so overlapping shapes don't double their alpha. */
function layer(ctx: CanvasRenderingContext2D, alpha: number, blur: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (alpha <= 0) return;
  const { width, height } = ctx.canvas;
  const c = scratchCtx(width, height);
  draw(c);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
  ctx.drawImage(scratch!, 0, 0);
  ctx.restore();
}

function lineRects(d: Design, o: RenderOptions): Rect[] {
  const s = o.scale;
  const l = d.lines;
  const gap = (l.gap + (d.bloom.enabled ? o.spread ?? 0 : 0)) * s;
  const len = l.length * s;
  const t = Math.max(0.5, l.thickness * s);
  const hideTop = d.tShape === "always" || (d.tShape === "firing" && !!o.firing);
  const rects: Rect[] = [
    [gap, -t / 2, len, t], // right
    [-gap - len, -t / 2, len, t], // left
    [-t / 2, gap, t, len], // bottom
  ];
  if (!hideTop) rects.push([-t / 2, -gap - len, t, len]);
  return rects.filter((r) => r[2] > 0 && r[3] > 0);
}

function fillRects(c: CanvasRenderingContext2D, rects: Rect[], o: RenderOptions, rotation: number, grow = 0) {
  c.save();
  c.translate(o.cx, o.cy);
  const snap = o.snap && rotation % 90 === 0;
  if (rotation) c.rotate((rotation * Math.PI) / 180);
  c.beginPath();
  for (const [x, y, w, h] of rects) {
    let x0 = x - grow, y0 = y - grow, x1 = x + w + grow, y1 = y + h + grow;
    if (snap) {
      const fx = o.cx % 1, fy = o.cy % 1;
      x0 = Math.round(x0 + fx) - fx;
      x1 = Math.round(x1 + fx) - fx;
      y0 = Math.round(y0 + fy) - fy;
      y1 = Math.round(y1 + fy) - fy;
      // Never let snapping erase a thin line.
      if (x1 - x0 < 1) x1 = x0 + 1;
      if (y1 - y0 < 1) y1 = y0 + 1;
    }
    c.rect(x0, y0, x1 - x0, y1 - y0);
  }
  c.fill();
  c.restore();
}

function dotPath(c: CanvasRenderingContext2D, d: Design, o: RenderOptions, grow: number) {
  const size = Math.max(0.5, d.dot.size * o.scale);
  if (d.dot.shape === "circle") {
    c.beginPath();
    c.arc(o.cx, o.cy, size / 2 + grow, 0, Math.PI * 2);
    c.fill();
  } else {
    fillRects(c, [[-size / 2, -size / 2, size, size]], o, 0, grow);
  }
}

function ringStroke(c: CanvasRenderingContext2D, d: Design, o: RenderOptions, grow: number) {
  c.beginPath();
  c.lineWidth = Math.max(0.5, d.circle.thickness * o.scale) + grow * 2;
  c.arc(o.cx, o.cy, d.circle.radius * o.scale, 0, Math.PI * 2);
  c.stroke();
}

function drawPixels(ctx: CanvasRenderingContext2D, d: Design, o: RenderOptions) {
  const p = d.pixels;
  const cell = p.cell * o.scale;
  const total = p.grid * cell;
  const ox = o.cx - total / 2;
  const oy = o.cy - total / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < p.grid; y++) {
    for (let x = 0; x < p.grid; x++) {
      const col = p.cells[y * p.grid + x];
      if (!col) continue;
      ctx.fillStyle = col;
      const x0 = Math.round(ox + x * cell), y0 = Math.round(oy + y * cell);
      const x1 = Math.round(ox + (x + 1) * cell), y1 = Math.round(oy + (y + 1) * cell);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  ctx.restore();
}

function drawImageLayer(ctx: CanvasRenderingContext2D, d: Design, o: RenderOptions) {
  const img = getImage(d.image.src);
  if (!img) return;
  const ratio = img.naturalWidth / img.naturalHeight || 1;
  const size = d.image.size * o.scale;
  const w = ratio >= 1 ? size : size * ratio;
  const h = ratio >= 1 ? size / ratio : size;
  ctx.save();
  ctx.globalAlpha = d.image.opacity;
  ctx.translate(o.cx, o.cy);
  if (d.image.rotation) ctx.rotate((d.image.rotation * Math.PI) / 180);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Renders a full design centered at (cx, cy). Does not clear the canvas. */
export function renderDesign(ctx: CanvasRenderingContext2D, d: Design, o: RenderOptions) {
  if (d.image.enabled && d.image.src) drawImageLayer(ctx, d, o);
  if (d.pixels.enabled) drawPixels(ctx, d, o);

  const ol = d.outline;
  const grow = ol.thickness * o.scale;
  const rects = d.lines.enabled ? lineRects(d, o) : [];

  if (ol.enabled) {
    layer(ctx, ol.opacity, ol.blur * o.scale, (c) => {
      c.fillStyle = ol.color;
      c.strokeStyle = ol.color;
      if (d.circle.enabled) ringStroke(c, d, o, grow);
      if (rects.length) fillRects(c, rects, o, d.lines.rotation, grow);
      if (d.dot.enabled) dotPath(c, d, o, grow);
      // Punch out the fill areas so a translucent fill doesn't show the outline beneath it.
      c.globalCompositeOperation = "destination-out";
      if (d.circle.enabled) ringStroke(c, d, o, 0);
      if (rects.length) fillRects(c, rects, o, d.lines.rotation, 0);
      if (d.dot.enabled) dotPath(c, d, o, 0);
      c.globalCompositeOperation = "source-over";
    });
  }
  if (d.circle.enabled) {
    layer(ctx, d.circle.opacity, d.circle.blur * o.scale, (c) => {
      c.strokeStyle = d.circle.color;
      ringStroke(c, d, o, 0);
    });
  }
  if (rects.length) {
    layer(ctx, d.lines.opacity, d.lines.blur * o.scale, (c) => {
      c.fillStyle = d.lines.color;
      fillRects(c, rects, o, d.lines.rotation, 0);
    });
  }
  if (d.dot.enabled) {
    layer(ctx, d.dot.opacity, d.dot.blur * o.scale, (c) => {
      c.fillStyle = d.dot.color;
      dotPath(c, d, o, 0);
    });
  }
}

/** Scale that makes the design fit a box of `size` px (with padding), within [min, max]. */
export function fitScale(d: Design, size: number, min = 0.5, max = 4) {
  const ext = designExtent(d);
  return Math.min(max, Math.max(min, (size / 2 - 4) / ext));
}

// ── Export ──

export function renderToPng(d: Design, scale = 1): string {
  const ext = Math.ceil(designExtent(d) * scale) + 2;
  const size = ext * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  renderDesign(ctx, d, { cx: size / 2, cy: size / 2, scale, snap: true });
  return canvas.toDataURL("image/png");
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export async function renderToSvg(d: Design, scale = 1): Promise<string> {
  const ext = Math.ceil(designExtent(d) * scale) + 2;
  const size = ext * 2;
  const c = size / 2;
  const defs: string[] = [];
  const body: string[] = [];
  let fid = 0;
  const filter = (blur: number) => {
    if (blur <= 0) return "";
    const id = `b${fid++}`;
    defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur / 2}"/></filter>`);
    return ` filter="url(#${id})"`;
  };
  const o: RenderOptions = { cx: 0, cy: 0, scale };
  const rects = d.lines.enabled ? lineRects(d, o) : [];
  const rectEls = (grow: number, fill: string) =>
    rects.map(([x, y, w, h]) => `<rect x="${x - grow}" y="${y - grow}" width="${w + grow * 2}" height="${h + grow * 2}" fill="${fill}"/>`).join("");
  const dotEl = (grow: number, fill: string) => {
    const s = d.dot.size * scale;
    return d.dot.shape === "circle"
      ? `<circle cx="0" cy="0" r="${s / 2 + grow}" fill="${fill}"/>`
      : `<rect x="${-s / 2 - grow}" y="${-s / 2 - grow}" width="${s + grow * 2}" height="${s + grow * 2}" fill="${fill}"/>`;
  };
  const ringEl = (grow: number, stroke: string) =>
    `<circle cx="0" cy="0" r="${d.circle.radius * scale}" fill="none" stroke="${stroke}" stroke-width="${d.circle.thickness * scale + grow * 2}"/>`;

  if (d.image.enabled && d.image.src) {
    const href = await toDataUrl(d.image.src);
    const img = getImage(d.image.src);
    const ratio = img ? img.naturalWidth / img.naturalHeight : 1;
    const s = d.image.size * scale;
    const w = ratio >= 1 ? s : s * ratio;
    const h = ratio >= 1 ? s / ratio : s;
    body.push(
      `<image href="${esc(href)}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" opacity="${d.image.opacity}" transform="rotate(${d.image.rotation})"/>`,
    );
  }
  if (d.pixels.enabled) {
    const p = d.pixels;
    const cell = p.cell * scale;
    const off = (-p.grid * cell) / 2;
    const px: string[] = [];
    p.cells.forEach((col, i) => {
      if (!col) return;
      const x = i % p.grid, y = Math.floor(i / p.grid);
      px.push(`<rect x="${off + x * cell}" y="${off + y * cell}" width="${cell}" height="${cell}" fill="${col}"/>`);
    });
    body.push(`<g shape-rendering="crispEdges">${px.join("")}</g>`);
  }
  if (d.outline.enabled) {
    const g = d.outline.thickness * scale;
    const col = d.outline.color;
    const parts = [
      d.circle.enabled ? ringEl(g, col) : "",
      rects.length ? `<g transform="rotate(${d.lines.rotation})">${rectEls(g, col)}</g>` : "",
      d.dot.enabled ? dotEl(g, col) : "",
    ].join("");
    body.push(`<g opacity="${d.outline.opacity}"${filter(d.outline.blur * scale)}>${parts}</g>`);
  }
  if (d.circle.enabled) body.push(`<g opacity="${d.circle.opacity}"${filter(d.circle.blur * scale)}>${ringEl(0, d.circle.color)}</g>`);
  if (rects.length) {
    body.push(
      `<g opacity="${d.lines.opacity}"${filter(d.lines.blur * scale)} transform="rotate(${d.lines.rotation})">${rectEls(0, d.lines.color)}</g>`,
    );
  }
  if (d.dot.enabled) body.push(`<g opacity="${d.dot.opacity}"${filter(d.dot.blur * scale)}>${dotEl(0, d.dot.color)}</g>`);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-c} ${-c} ${size} ${size}">`,
    `<title>${esc(d.name)}</title>`,
    defs.length ? `<defs>${defs.join("")}</defs>` : "",
    ...body,
    `</svg>`,
  ].join("");
}

import type { Design } from "../../shared/types";
import { defaultDesign, normalizeDesign, toPortable } from "../../shared/design";

const PREFIX = "CY1-";

function bytesToB64url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Compact, copy-pasteable share code for a design. */
export async function encodeShareCode(d: Design): Promise<string> {
  const json = JSON.stringify(compact(toPortable(d)));
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return PREFIX + bytesToB64url(packed);
}

/** Drop disabled layers that are at default values to keep codes short. */
function compact(p: Omit<Design, "id">) {
  const out: Record<string, unknown> = { ...p };
  if (!p.pixels.enabled) delete out.pixels;
  if (!p.image.enabled) delete out.image;
  return out;
}

export type ImportResult = { design: Design; source: "crosshair-y" | "valorant" | "json" };

export async function decodeAnyCode(raw: string): Promise<ImportResult> {
  const code = raw.trim();
  if (code.startsWith(PREFIX)) {
    const bytes = await pipe(b64urlToBytes(code.slice(PREFIX.length)), new DecompressionStream("deflate-raw"));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return { design: normalizeDesign(obj, false), source: "crosshair-y" };
  }
  if (code.startsWith("{")) {
    return { design: normalizeDesign(JSON.parse(code), false), source: "json" };
  }
  if (/^0;/.test(code) || /(^|;)P;/.test(code)) {
    return { design: parseValorant(code), source: "valorant" };
  }
  if (/^CSGO-/.test(code)) {
    throw new Error("CS2 share codes aren't supported yet. Use a Valorant or Crosshair Y code.");
  }
  throw new Error("Unrecognized code. Paste a Crosshair Y (CY1-…) or Valorant crosshair code.");
}

const VALORANT_COLORS = ["#ffffff", "#00ff00", "#7fff00", "#dfff00", "#ffff00", "#00ffff", "#ff00ff", "#ff0000"];

/**
 * Valorant profile codes look like "0;P;c;5;h;0;0l;4;0o;2;0a;1;1b;0".
 * Only the primary ("P") section is used; inner lines map to the lines layer.
 */
export function parseValorant(code: string): Design {
  const tokens = code.split(";");
  const kv: Record<string, string> = {};
  let section = "P";
  let i = tokens[0] === "0" ? 1 : 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "P" || t === "A" || t === "S") {
      section = t;
      i++;
      continue;
    }
    if (section === "P" && i + 1 < tokens.length) kv[t] = tokens[i + 1];
    i += 2;
  }

  const d = defaultDesign("Valorant import");
  let color = "#ffffff";
  if (kv.u && /^[0-9a-fA-F]{6,8}$/.test(kv.u)) color = "#" + kv.u.slice(0, 6).toLowerCase();
  else if (kv.c !== undefined) color = VALORANT_COLORS[parseInt(kv.c, 10)] ?? color;
  const n = (k: string, def: number) => (kv[k] !== undefined && Number.isFinite(parseFloat(kv[k])) ? parseFloat(kv[k]) : def);

  d.lines = {
    ...d.lines,
    enabled: kv["0b"] !== "0",
    color,
    thickness: n("0t", 2),
    length: n("0l", 6),
    gap: n("0o", 3),
    opacity: n("0a", 0.8),
  };
  d.dot = { ...d.dot, enabled: kv.d === "1", color, size: n("z", 2), opacity: n("a", 1) };
  d.outline = { ...d.outline, enabled: kv.h !== "0", thickness: n("t", 1), opacity: n("o", 0.5) };
  return normalizeDesign(d, false);
}

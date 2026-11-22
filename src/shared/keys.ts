import type { Binding } from "./types";

export const MOUSE_LABELS: Record<number, string> = {
  1: "Left click",
  2: "Right click",
  3: "Middle click",
  4: "Mouse 4",
  5: "Mouse 5",
};

const CODE_LABELS: Record<string, string> = {
  ControlLeft: "Ctrl",
  ControlRight: "Right Ctrl",
  AltLeft: "Alt",
  AltRight: "Right Alt",
  ShiftLeft: "Shift",
  ShiftRight: "Right Shift",
  MetaLeft: "Win",
  MetaRight: "Right Win",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Escape: "Esc",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Delete: "Del",
  Insert: "Ins",
  PrintScreen: "PrtSc",
};

export const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
]);

export function codeLabel(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6).replace("Multiply", "*").replace("Add", "+").replace("Subtract", "-").replace("Divide", "/").replace("Decimal", ".");
  return code;
}

/** Returns the parts of a binding for display, e.g. ["Ctrl", "Shift", "H"]. */
export function bindingParts(b: Binding): string[] {
  if (!b) return [];
  if (b.device === "mouse") return [MOUSE_LABELS[b.button] ?? `Mouse ${b.button}`];
  const parts: string[] = [];
  if (!MODIFIER_CODES.has(b.code)) {
    if (b.ctrl) parts.push("Ctrl");
    if (b.alt) parts.push("Alt");
    if (b.shift) parts.push("Shift");
    if (b.meta) parts.push("Win");
  }
  parts.push(codeLabel(b.code));
  return parts;
}

export function bindingLabel(b: Binding): string {
  return b ? bindingParts(b).join(" + ") : "Unbound";
}

export function sameBinding(a: Binding, b: Binding): boolean {
  if (!a || !b) return false;
  if (a.device === "mouse" && b.device === "mouse") return a.button === b.button;
  if (a.device === "keyboard" && b.device === "keyboard") {
    return a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta;
  }
  return false;
}

/** Map a DOM MouseEvent.button to our 1-based numbering (1 left, 2 right, 3 middle). */
export function domMouseButton(button: number): number {
  return [1, 3, 2, 4, 5][button] ?? button + 1;
}

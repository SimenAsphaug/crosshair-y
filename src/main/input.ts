import { EventEmitter } from "events";
import { globalShortcut } from "electron";
import type { Binding, Keybinds } from "../shared/types";
import { MODIFIER_CODES } from "../shared/keys";

export type Trigger =
  | { kind: "toggle" }
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "toCursor" }
  | { kind: "recenter" }
  | { kind: "design"; id: string };

interface Press {
  device: "keyboard" | "mouse";
  code?: string;
  button?: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** Converts uiohook key names to DOM KeyboardEvent.code values. */
function buildKeyMap(UiohookKey: Record<string, number>): Map<number, string> {
  const special: Record<string, string> = {
    Ctrl: "ControlLeft",
    CtrlRight: "ControlRight",
    Alt: "AltLeft",
    AltRight: "AltRight",
    Shift: "ShiftLeft",
    ShiftRight: "ShiftRight",
    Meta: "MetaLeft",
    MetaRight: "MetaRight",
    NumpadArrowUp: "Numpad8",
    NumpadArrowDown: "Numpad2",
    NumpadArrowLeft: "Numpad4",
    NumpadArrowRight: "Numpad6",
    NumpadHome: "Numpad7",
    NumpadEnd: "Numpad1",
    NumpadPageUp: "Numpad9",
    NumpadPageDown: "Numpad3",
    NumpadInsert: "Numpad0",
    NumpadDelete: "NumpadDecimal",
  };
  const map = new Map<number, string>();
  for (const [name, code] of Object.entries(UiohookKey)) {
    let dom = special[name];
    if (!dom) {
      if (/^[A-Z]$/.test(name)) dom = `Key${name}`;
      else if (/^[0-9]$/.test(name)) dom = `Digit${name}`;
      else dom = name;
    }
    if (!map.has(code)) map.set(code, dom);
  }
  return map;
}

function toAccelerator(b: Binding): string | null {
  if (!b || b.device !== "keyboard" || MODIFIER_CODES.has(b.code)) return null;
  let key: string | null = null;
  const c = b.code;
  if (c.startsWith("Key")) key = c.slice(3);
  else if (c.startsWith("Digit")) key = c.slice(5);
  else if (/^F\d{1,2}$/.test(c)) key = c;
  else if (c.startsWith("Arrow")) key = c.slice(5);
  else if (/^Numpad\d$/.test(c)) key = "num" + c.slice(6);
  else {
    const m: Record<string, string> = {
      Space: "Space", Enter: "Return", Tab: "Tab", Backspace: "Backspace", Delete: "Delete", Insert: "Insert",
      Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Escape: "Escape",
      Minus: "-", Equal: "=", Comma: ",", Period: ".", Slash: "/", Semicolon: ";", Quote: "'",
      BracketLeft: "[", BracketRight: "]", Backslash: "\\", Backquote: "`",
    };
    key = m[c] ?? null;
  }
  if (!key) return null;
  const mods = [b.ctrl && "Control", b.alt && "Alt", b.shift && "Shift", b.meta && "Super"].filter(Boolean);
  return [...mods, key].join("+");
}

function matchesHold(b: Binding, p: Press): boolean {
  if (!b) return false;
  if (b.device === "mouse") return p.device === "mouse" && p.button === b.button;
  return p.device === "keyboard" && p.code === b.code;
}

function matchesTrigger(b: Binding, p: Press): boolean {
  if (!matchesHold(b, p)) return false;
  if (!b || b.device === "mouse") return true;
  if (MODIFIER_CODES.has(b.code)) return true;
  return b.ctrl === p.ctrl && b.alt === p.alt && b.shift === p.shift && b.meta === p.meta;
}

/**
 * Global keyboard/mouse input. Uses uiohook (works while games are focused and
 * supports mouse buttons); falls back to Electron globalShortcut for keyboard-only.
 *
 * Events: "trigger" (Trigger), "fire" (boolean), "aim" (boolean), "status".
 */
export class Input extends EventEmitter {
  status: "ok" | "unavailable" = "unavailable";
  error: string | null = null;
  private keybinds: Keybinds | null = null;
  private suspended = false;
  private down = new Set<string>();
  private aiming = false;
  private firing = false;
  private hook: any = null;
  private keyMap = new Map<number, string>();

  constructor(private isAppFocused: () => boolean) {
    super();
  }

  start() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("uiohook-napi");
      this.keyMap = buildKeyMap(mod.UiohookKey);
      this.hook = mod.uIOhook;
      this.hook.on("keydown", (e: any) => this.onKey(e, true));
      this.hook.on("keyup", (e: any) => this.onKey(e, false));
      this.hook.on("mousedown", (e: any) => this.onMouse(e, true));
      this.hook.on("mouseup", (e: any) => this.onMouse(e, false));
      this.hook.start();
      this.status = "ok";
      this.error = null;
    } catch (err) {
      this.hook = null;
      this.status = "unavailable";
      this.error = (err as Error).message;
      console.error("Global input hook unavailable, falling back to keyboard shortcuts:", err);
    }
    this.registerFallback();
    this.emit("status");
  }

  stop() {
    try {
      this.hook?.stop();
    } catch {}
    globalShortcut.unregisterAll();
  }

  setKeybinds(k: Keybinds) {
    this.keybinds = k;
    if (k.aim.mode === "off" && this.aiming) this.setAim(false);
    this.registerFallback();
  }

  /** Pause all handling while the UI is recording a new binding. */
  setSuspended(s: boolean) {
    this.suspended = s;
    this.registerFallback();
    if (s) {
      this.down.clear();
      this.setFire(false);
      if (this.keybinds?.aim.behavior === "hold") this.setAim(false);
    }
  }

  get isAiming() {
    return this.aiming;
  }

  private onKey(e: any, pressed: boolean) {
    const code = this.keyMap.get(e.keycode);
    if (!code) return;
    this.handle({ device: "keyboard", code, ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey }, pressed);
  }

  private onMouse(e: any, pressed: boolean) {
    const button = Number(e.button);
    if (!button) return;
    this.handle({ device: "mouse", button, ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey }, pressed);
  }

  private handle(p: Press, pressed: boolean) {
    const k = this.keybinds;
    if (!k) return;
    const token = p.device === "mouse" ? `m${p.button}` : `k${p.code}`;

    if (!pressed) {
      this.down.delete(token);
      if (matchesHold(k.fire.binding, p)) this.setFire(false);
      if (k.aim.mode !== "off" && k.aim.behavior === "hold" && matchesHold(k.aim.binding, p)) this.setAim(false);
      return;
    }

    if (this.down.has(token)) return; // key auto-repeat
    this.down.add(token);
    if (this.suspended) return;

    const inApp = this.isAppFocused();
    if (!inApp) {
      if (matchesHold(k.fire.binding, p)) this.setFire(true);
      if (k.aim.mode !== "off" && matchesHold(k.aim.binding, p)) {
        this.setAim(k.aim.behavior === "toggle" ? !this.aiming : true);
      }
    }

    // With the fallback active, keyboard triggers arrive through globalShortcut instead.
    if (this.status !== "ok") return;
    if (matchesTrigger(k.toggle, p)) this.emit("trigger", { kind: "toggle" } as Trigger);
    if (matchesTrigger(k.next, p)) this.emit("trigger", { kind: "next" } as Trigger);
    if (matchesTrigger(k.prev, p)) this.emit("trigger", { kind: "prev" } as Trigger);
    if (matchesTrigger(k.toCursor, p)) this.emit("trigger", { kind: "toCursor" } as Trigger);
    if (matchesTrigger(k.recenter, p)) this.emit("trigger", { kind: "recenter" } as Trigger);
    for (const [id, b] of Object.entries(k.designShortcuts)) {
      if (matchesTrigger(b, p)) this.emit("trigger", { kind: "design", id } as Trigger);
    }
  }

  private setFire(v: boolean) {
    if (this.firing === v) return;
    this.firing = v;
    this.emit("fire", v);
  }

  private setAim(v: boolean) {
    if (this.aiming === v) return;
    this.aiming = v;
    this.emit("aim", v);
  }

  private registerFallback() {
    globalShortcut.unregisterAll();
    if (this.status === "ok" || !this.keybinds || this.suspended) return;
    const k = this.keybinds;
    const entries: [Binding, Trigger][] = [
      [k.toggle, { kind: "toggle" }],
      [k.next, { kind: "next" }],
      [k.prev, { kind: "prev" }],
      [k.toCursor, { kind: "toCursor" }],
      [k.recenter, { kind: "recenter" }],
      ...Object.entries(k.designShortcuts).map(([id, b]) => [b, { kind: "design", id }] as [Binding, Trigger]),
    ];
    for (const [b, t] of entries) {
      const acc = toAccelerator(b);
      if (!acc) continue;
      try {
        globalShortcut.register(acc, () => this.emit("trigger", t));
      } catch (err) {
        console.warn("Could not register shortcut", acc, err);
      }
    }
  }
}

import type { Action, AppState, Binding, Keybinds, Profile, Settings } from "./types";
import { BUILTIN_DESIGNS } from "./builtins";
import { normalizeSaved, toSaved } from "./design";

export const DEFAULT_PROFILE_ID = "default";
export const DEFAULT_COMMUNITY_REPO = "SimenAsphaug/crosshair-y";
export const DEFAULT_COMMUNITY_URL = `https://raw.githubusercontent.com/${DEFAULT_COMMUNITY_REPO}/main/community/index.json`;

/** Executables treated as games for "Show only in-game" (users can add more). */
export const KNOWN_GAMES = [
  "cs2.exe",
  "valorant-win64-shipping.exe",
  "fortniteclient-win64-shipping.exe",
  "r5apex.exe",
  "r5apex_dx12.exe",
  "rustclient.exe",
  "rainbowsix.exe",
  "rainbowsix_vulkan.exe",
  "tslgame.exe",
  "gta5.exe",
  "overwatch.exe",
  "escapefromtarkov.exe",
  "deadlock.exe",
  "marvel-win64-shipping.exe",
  "hunt.exe",
];

const kb = (code: string, mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }> = {}): Binding => ({
  device: "keyboard",
  code,
  ctrl: !!mods.ctrl,
  alt: !!mods.alt,
  shift: !!mods.shift,
  meta: !!mods.meta,
});

export function defaultKeybinds(): Keybinds {
  return {
    toggle: kb("KeyH", { ctrl: true, shift: true }),
    aim: { binding: { device: "mouse", button: 2 }, mode: "off", behavior: "hold", swapDesignId: null },
    fire: { binding: { device: "mouse", button: 1 } },
    next: kb("ArrowRight", { ctrl: true, shift: true }),
    prev: kb("ArrowLeft", { ctrl: true, shift: true }),
    toCursor: kb("KeyS", { ctrl: true, shift: true }),
    recenter: kb("KeyC", { ctrl: true, shift: true }),
    designShortcuts: {},
  };
}

export function defaultSettings(): Settings {
  return {
    theme: "dark",
    accent: "#2dd4bf",
    uiScale: 1,
    compact: false,
    reducedMotion: false,
    sidebarCollapsed: false,
    previewBackground: "scene",
    showOnlyInGame: false,
    autoSwitchProfiles: true,
    hideFromCapture: false,
    customGames: [],
    launchOnStartup: false,
    startMinimized: false,
    overlayOnLaunch: true,
    closeToTray: true,
    hardwareAcceleration: true,
    communityIndexUrl: DEFAULT_COMMUNITY_URL,
    communityRepo: DEFAULT_COMMUNITY_REPO,
    checkUpdates: true,
  };
}

export function defaultProfile(): Profile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: "Default",
    games: [],
    designId: null,
    displayId: null,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  };
}

export function defaultState(): AppState {
  const starter = toSaved({ ...BUILTIN_DESIGNS[0].design, id: "d_starter" }, "builtin");
  const profile = { ...defaultProfile(), designId: starter.id };
  return {
    version: 1,
    overlayEnabled: true,
    activeProfileId: DEFAULT_PROFILE_ID,
    designs: [starter],
    categories: [],
    profiles: [profile],
    keybinds: defaultKeybinds(),
    settings: defaultSettings(),
  };
}

// ── Normalization of persisted/imported state ──

function isBinding(b: unknown): b is Binding {
  if (b === null) return true;
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  if (o.device === "mouse") return typeof o.button === "number" && o.button >= 1 && o.button <= 5;
  if (o.device === "keyboard") return typeof o.code === "string" && o.code.length < 32;
  return false;
}

function bindingOr(b: unknown, def: Binding): Binding {
  if (b === undefined) return def;
  if (!isBinding(b)) return def;
  if (b && b.device === "keyboard") {
    return { device: "keyboard", code: b.code, ctrl: !!b.ctrl, alt: !!b.alt, shift: !!b.shift, meta: !!b.meta };
  }
  return b;
}

function normalizeProfile(p: unknown): Profile | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const d = defaultProfile();
  if (typeof o.id !== "string") return null;
  const n = (v: unknown, def: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  return {
    id: o.id,
    name: typeof o.name === "string" && o.name.trim() ? o.name.slice(0, 40) : "Profile",
    games: Array.isArray(o.games) ? o.games.filter((g): g is string => typeof g === "string").map((g) => g.toLowerCase().slice(0, 80)) : [],
    designId: typeof o.designId === "string" ? o.designId : null,
    displayId: typeof o.displayId === "number" ? o.displayId : null,
    offsetX: n(o.offsetX, d.offsetX, -10000, 10000),
    offsetY: n(o.offsetY, d.offsetY, -10000, 10000),
    scale: n(o.scale, 1, 0.25, 8),
  };
}

export function normalizeState(input: unknown): AppState {
  const def = defaultState();
  if (!input || typeof input !== "object") return def;
  const i = input as Record<string, unknown>;

  const designs = Array.isArray(i.designs) ? i.designs.map(normalizeSaved) : def.designs;
  const seen = new Set<string>();
  const uniqueDesigns = designs.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));

  const categories = Array.isArray(i.categories)
    ? i.categories
        .filter((c): c is { id: string; name: string } => !!c && typeof c.id === "string" && typeof c.name === "string")
        .map((c) => ({ id: c.id, name: c.name.slice(0, 40) }))
    : [];

  let profiles = Array.isArray(i.profiles) ? (i.profiles.map(normalizeProfile).filter(Boolean) as Profile[]) : def.profiles;
  if (!profiles.some((p) => p.id === DEFAULT_PROFILE_ID)) profiles = [defaultProfile(), ...profiles];
  const ids = new Set(uniqueDesigns.map((d) => d.id));
  profiles = profiles.map((p) => ({ ...p, designId: p.designId && ids.has(p.designId) ? p.designId : uniqueDesigns[0]?.id ?? null }));

  const s = (i.settings && typeof i.settings === "object" ? i.settings : {}) as Record<string, unknown>;
  const settings = { ...def.settings };
  for (const key of Object.keys(settings) as (keyof Settings)[]) {
    const v = s[key];
    if (v !== undefined && typeof v === typeof settings[key] && (Array.isArray(v) === Array.isArray(settings[key]))) {
      (settings as any)[key] = v;
    }
  }
  settings.customGames = settings.customGames.filter((g) => typeof g === "string").map((g) => g.toLowerCase());
  settings.uiScale = Math.min(1.4, Math.max(0.8, settings.uiScale));

  const k = (i.keybinds && typeof i.keybinds === "object" ? i.keybinds : {}) as Record<string, any>;
  const dk = def.keybinds;
  const shortcuts: Record<string, Binding> = {};
  if (k.designShortcuts && typeof k.designShortcuts === "object") {
    for (const [id, b] of Object.entries(k.designShortcuts)) {
      if (ids.has(id) && isBinding(b) && b) shortcuts[id] = bindingOr(b, null);
    }
  }
  const aim = k.aim && typeof k.aim === "object" ? k.aim : {};
  const keybinds: Keybinds = {
    toggle: bindingOr(k.toggle, dk.toggle),
    aim: {
      binding: bindingOr(aim.binding, dk.aim.binding),
      mode: ["off", "hide", "swap"].includes(aim.mode) ? aim.mode : dk.aim.mode,
      behavior: aim.behavior === "toggle" ? "toggle" : "hold",
      swapDesignId: typeof aim.swapDesignId === "string" && ids.has(aim.swapDesignId) ? aim.swapDesignId : null,
    },
    fire: { binding: bindingOr(k.fire?.binding, dk.fire.binding) },
    next: bindingOr(k.next, dk.next),
    prev: bindingOr(k.prev, dk.prev),
    toCursor: bindingOr(k.toCursor, dk.toCursor),
    recenter: bindingOr(k.recenter, dk.recenter),
    designShortcuts: shortcuts,
  };

  const activeProfileId =
    typeof i.activeProfileId === "string" && profiles.some((p) => p.id === i.activeProfileId) ? i.activeProfileId : DEFAULT_PROFILE_ID;

  return {
    version: 1,
    overlayEnabled: typeof i.overlayEnabled === "boolean" ? i.overlayEnabled : true,
    activeProfileId,
    designs: uniqueDesigns,
    categories,
    profiles,
    keybinds,
    settings,
  };
}

// ── Reducer ──

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "overlay/set":
      return { ...state, overlayEnabled: action.enabled };
    case "overlay/toggle":
      return { ...state, overlayEnabled: !state.overlayEnabled };

    case "design/save": {
      const incoming = normalizeSaved({ ...action.design, updatedAt: Date.now() });
      const exists = state.designs.some((d) => d.id === incoming.id);
      return {
        ...state,
        designs: exists ? state.designs.map((d) => (d.id === incoming.id ? incoming : d)) : [...state.designs, incoming],
      };
    }
    case "design/saveMany": {
      const map = new Map(state.designs.map((d) => [d.id, d]));
      for (const d of action.designs) map.set(d.id, normalizeSaved(d));
      return { ...state, designs: [...map.values()] };
    }
    case "design/delete": {
      const designs = state.designs.filter((d) => d.id !== action.id);
      const fallback = designs[0]?.id ?? null;
      const { [action.id]: _removed, ...shortcuts } = state.keybinds.designShortcuts;
      return {
        ...state,
        designs,
        profiles: state.profiles.map((p) => (p.designId === action.id ? { ...p, designId: fallback } : p)),
        keybinds: {
          ...state.keybinds,
          designShortcuts: shortcuts,
          aim: state.keybinds.aim.swapDesignId === action.id ? { ...state.keybinds.aim, swapDesignId: null } : state.keybinds.aim,
        },
      };
    }
    case "design/reorder": {
      const byId = new Map(state.designs.map((d) => [d.id, d]));
      const ordered = action.ids.map((id) => byId.get(id)).filter(Boolean) as AppState["designs"];
      const rest = state.designs.filter((d) => !action.ids.includes(d.id));
      return { ...state, designs: [...ordered, ...rest] };
    }
    case "design/favorite":
      return { ...state, designs: state.designs.map((d) => (d.id === action.id ? { ...d, favorite: action.favorite } : d)) };
    case "design/category":
      return { ...state, designs: state.designs.map((d) => (d.id === action.id ? { ...d, categoryId: action.categoryId } : d)) };
    case "design/activate": {
      if (!state.designs.some((d) => d.id === action.id)) return state;
      const pid = action.profileId ?? state.activeProfileId;
      return { ...state, profiles: state.profiles.map((p) => (p.id === pid ? { ...p, designId: action.id } : p)) };
    }

    case "category/add":
      return { ...state, categories: [...state.categories, action.category] };
    case "category/rename":
      return { ...state, categories: state.categories.map((c) => (c.id === action.id ? { ...c, name: action.name } : c)) };
    case "category/delete":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        designs: state.designs.map((d) => (d.categoryId === action.id ? { ...d, categoryId: null } : d)),
      };

    case "profile/save": {
      const p = normalizeProfile(action.profile);
      if (!p) return state;
      const exists = state.profiles.some((x) => x.id === p.id);
      return { ...state, profiles: exists ? state.profiles.map((x) => (x.id === p.id ? p : x)) : [...state.profiles, p] };
    }
    case "profile/delete":
      if (action.id === DEFAULT_PROFILE_ID) return state;
      return {
        ...state,
        profiles: state.profiles.filter((p) => p.id !== action.id),
        activeProfileId: state.activeProfileId === action.id ? DEFAULT_PROFILE_ID : state.activeProfileId,
      };
    case "profile/activate":
      return state.profiles.some((p) => p.id === action.id) ? { ...state, activeProfileId: action.id } : state;
    case "profile/offset":
      return {
        ...state,
        profiles: state.profiles.map((p) =>
          p.id === action.id
            ? {
                ...p,
                offsetX: Math.round(action.offsetX),
                offsetY: Math.round(action.offsetY),
                displayId: action.displayId !== undefined ? action.displayId : p.displayId,
              }
            : p,
        ),
      };

    case "settings/update":
      return normalizeState({ ...state, settings: { ...state.settings, ...action.patch } });
    case "keybinds/update":
      return { ...state, keybinds: { ...state.keybinds, ...action.patch } };
    case "keybinds/designShortcut": {
      const shortcuts = { ...state.keybinds.designShortcuts };
      if (action.binding) shortcuts[action.id] = action.binding;
      else delete shortcuts[action.id];
      return { ...state, keybinds: { ...state.keybinds, designShortcuts: shortcuts } };
    }
    case "state/replace":
      return normalizeState(action.state);
  }
}

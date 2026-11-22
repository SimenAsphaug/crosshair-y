import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  IpcMainEvent,
  IpcMainInvokeEvent,
  Menu,
  MenuItemConstructorOptions,
  nativeTheme,
  net,
  screen,
  shell,
  Tray,
} from "electron";
import fs from "fs/promises";
import path from "path";
import type { Action, Design, DisplayInfo, ExportFileRequest, ImportedFile, RuntimeStatus, UpdateInfo } from "../shared/types";
import { KNOWN_GAMES, DEFAULT_PROFILE_ID } from "../shared/state";
import { MAX_IMAGE_BYTES, normalizeDesign } from "../shared/design";
import { Store } from "./store";
import { Overlay, physicalBounds } from "./overlay";
import { Input, Trigger } from "./input";
import { ForegroundWatcher, IGNORED_APPS } from "./games";
import { isAppUrl, loadPage, makeCrosshairIcon, preloadPath, windowIconPath } from "./paths";

const RELEASES_REPO = "SimenAsphaug/crosshair-y";

// Dev/test: isolate data in another folder (e.g. for the smoke test).
if (process.env.CY_USER_DATA) app.setPath("userData", path.resolve(process.env.CY_USER_DATA));

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const store = new Store();
if (!store.get().settings.hardwareAcceleration) app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let previewDesign: Design | null = null;
const overlay = new Overlay();
const input = new Input(() => !!mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
const ownExe = path.basename(process.execPath).toLowerCase();
const watcher = new ForegroundWatcher(
  () => {
    refreshOverlay();
    broadcastRuntime();
  },
  (exe) => exe === ownExe || IGNORED_APPS.has(exe) || exe === "electron.exe",
);

// ── Derived state ──

function gameSet(): Set<string> {
  const s = store.get();
  return new Set([...KNOWN_GAMES, ...s.settings.customGames, ...s.profiles.flatMap((p) => p.games)]);
}

function isInGame(): boolean {
  const fg = watcher.current;
  return !!fg && gameSet().has(fg);
}

function effectiveProfile() {
  const s = store.get();
  const fg = watcher.current;
  if (s.settings.autoSwitchProfiles && fg) {
    const match = s.profiles.find((p) => p.id !== DEFAULT_PROFILE_ID && p.games.includes(fg));
    if (match) return match;
  }
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
}

function currentDesign(): Design | null {
  const s = store.get();
  const p = effectiveProfile();
  const k = s.keybinds;
  if (k.aim.mode === "swap" && input.isAiming && k.aim.swapDesignId) {
    const swap = s.designs.find((d) => d.id === k.aim.swapDesignId);
    if (swap) return swap;
  }
  return s.designs.find((d) => d.id === p?.designId) ?? s.designs[0] ?? null;
}

function overlayShouldShow(): boolean {
  const s = store.get();
  if (!s.overlayEnabled) return false;
  if (previewDesign) return true;
  if (s.settings.showOnlyInGame && watcher.status === "ok" && !isInGame()) return false;
  if (s.keybinds.aim.mode === "hide" && input.isAiming) return false;
  return true;
}

function refreshOverlay() {
  const s = store.get();
  const p = effectiveProfile();
  overlay.update({
    design: previewDesign ?? currentDesign(),
    visible: overlayShouldShow(),
    scale: p?.scale ?? 1,
    displayId: p?.displayId ?? null,
    offsetX: p?.offsetX ?? 0,
    offsetY: p?.offsetY ?? 0,
    hideFromCapture: s.settings.hideFromCapture,
  });
}

function displays(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => {
    const b = physicalBounds(d);
    return {
      id: d.id,
      label: d.label || `Display ${i + 1}`,
      primary: d.id === primary,
      width: b.width,
      height: b.height,
      scaleFactor: d.scaleFactor,
    };
  });
}

function runtime(): RuntimeStatus {
  return {
    inputHook: input.status,
    inputHookError: input.error,
    gameDetection: watcher.status,
    foreground: watcher.current,
    recentApps: watcher.recent,
    inGame: isInGame(),
    effectiveProfileId: effectiveProfile()?.id ?? DEFAULT_PROFILE_ID,
    overlayVisible: overlayShouldShow(),
    aiming: input.isAiming,
    displays: displays(),
    platform: process.platform,
    version: app.getVersion(),
  };
}

let runtimeTimer: NodeJS.Timeout | null = null;
function broadcastRuntime() {
  if (runtimeTimer) return;
  runtimeTimer = setTimeout(() => {
    runtimeTimer = null;
    sendToMain("runtime:changed", runtime());
  }, 50);
}

function sendToMain(channel: string, ...args: unknown[]) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
}

// ── Main window ──

function createMainWindow() {
  const s = store.get();
  const dark = s.settings.theme === "dark" || (s.settings.theme === "system" && nativeTheme.shouldUseDarkColors);
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 580,
    show: false,
    backgroundColor: dark ? "#0f1115" : "#f5f6f8",
    icon: process.platform === "win32" ? windowIconPath() : undefined,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: dark ? "#0f1115" : "#f5f6f8", symbolColor: dark ? "#c9ced6" : "#2a2f37", height: 48 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  mainWindow.setMenu(null);
  loadPage(mainWindow, "index");

  const hidden = process.argv.includes("--hidden") || s.settings.startMinimized;
  mainWindow.once("ready-to-show", () => {
    if (!hidden) mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!isAppUrl(url)) e.preventDefault();
  });

  mainWindow.on("close", (e) => {
    if (!quitting && store.get().settings.closeToTray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (!quitting) quit();
  });
  // Mouse-state features are ignored while the app has focus; refresh on change.
  mainWindow.on("focus", broadcastRuntime);
  mainWindow.on("blur", broadcastRuntime);
}

function showMainWindow(page?: string) {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (page) sendToMain("navigate", page);
}

function quit() {
  quitting = true;
  app.quit();
}

// ── Tray ──

function buildTray() {
  if (!tray) {
    tray = new Tray(makeCrosshairIcon(32, store.get().settings.accent));
    tray.setToolTip("Crosshair Y");
    tray.on("click", () => showMainWindow());
  }
  const s = store.get();
  const eff = effectiveProfile();
  const designs: MenuItemConstructorOptions[] = s.designs.slice(0, 30).map((d) => ({
    label: d.name,
    type: "radio",
    checked: eff?.designId === d.id,
    click: () => store.dispatch({ type: "design/activate", id: d.id, profileId: eff?.id }),
  }));
  const profiles: MenuItemConstructorOptions[] = s.profiles.map((p) => ({
    label: p.name,
    type: "radio",
    checked: s.activeProfileId === p.id,
    click: () => store.dispatch({ type: "profile/activate", id: p.id }),
  }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Crosshair Y", click: () => showMainWindow() },
      { type: "separator" },
      {
        label: "Show crosshair",
        type: "checkbox",
        checked: s.overlayEnabled,
        click: () => store.dispatch({ type: "overlay/toggle" }),
      },
      { label: "Crosshair", submenu: designs.length ? designs : [{ label: "No saved crosshairs", enabled: false }] },
      { label: "Profile", submenu: profiles },
      { type: "separator" },
      { label: "Designer", click: () => showMainWindow("designer") },
      { label: "Settings", click: () => showMainWindow("settings") },
      { type: "separator" },
      { label: "Quit", click: quit },
    ]),
  );
}

// ── Triggers from hotkeys ──

function cycleDesign(dir: 1 | -1) {
  const s = store.get();
  if (!s.designs.length) return;
  const eff = effectiveProfile();
  const idx = s.designs.findIndex((d) => d.id === eff?.designId);
  const next = s.designs[(idx + dir + s.designs.length) % s.designs.length];
  store.dispatch({ type: "design/activate", id: next.id, profileId: eff?.id });
}

function setPositionToCursor() {
  const eff = effectiveProfile();
  if (!eff) return;
  const dip = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(dip);
  const phys =
    process.platform === "win32"
      ? screen.dipToScreenPoint(dip)
      : { x: Math.round(dip.x * display.scaleFactor), y: Math.round(dip.y * display.scaleFactor) };
  const b = physicalBounds(display);
  store.dispatch({
    type: "profile/offset",
    id: eff.id,
    offsetX: phys.x - (b.x + b.width / 2),
    offsetY: phys.y - (b.y + b.height / 2),
    displayId: display.id === screen.getPrimaryDisplay().id ? null : display.id,
  });
}

input.on("trigger", (t: Trigger) => {
  switch (t.kind) {
    case "toggle":
      store.dispatch({ type: "overlay/toggle" });
      break;
    case "next":
      cycleDesign(1);
      break;
    case "prev":
      cycleDesign(-1);
      break;
    case "toCursor":
      setPositionToCursor();
      break;
    case "recenter": {
      const eff = effectiveProfile();
      if (eff) store.dispatch({ type: "profile/offset", id: eff.id, offsetX: 0, offsetY: 0 });
      break;
    }
    case "design": {
      const eff = effectiveProfile();
      store.dispatch({ type: "design/activate", id: t.id, profileId: eff?.id });
      break;
    }
  }
});
input.on("fire", (firing: boolean) => overlay.fire(firing));
input.on("aim", () => {
  refreshOverlay();
  broadcastRuntime();
});

// ── IPC ──

function fromApp(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? "";
  return isAppUrl(url);
}

function on(channel: string, fn: (e: IpcMainEvent, ...args: any[]) => void) {
  ipcMain.on(channel, (e, ...args) => {
    if (fromApp(e)) fn(e, ...args);
  });
}

function handle(channel: string, fn: (e: IpcMainInvokeEvent, ...args: any[]) => unknown) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!fromApp(e)) throw new Error("Blocked");
    return fn(e, ...args);
  });
}

handle("state:get", () => store.get());
handle("runtime:get", () => runtime());
on("state:dispatch", (_e, action: Action) => {
  if (action && typeof action === "object" && typeof action.type === "string") store.dispatch(action);
});
on("design:preview", (_e, design: unknown) => {
  previewDesign = design ? normalizeDesign(design) : null;
  refreshOverlay();
});
on("input:recording", (_e, recording: unknown) => input.setSuspended(!!recording));
on("window:titlebar", (e, color: unknown, symbol: unknown) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const hex = /^#[0-9a-f]{6}$/i;
  if (!win || typeof color !== "string" || typeof symbol !== "string" || !hex.test(color) || !hex.test(symbol)) return;
  try {
    win.setTitleBarOverlay({ color, symbolColor: symbol, height: 48 });
    win.setBackgroundColor(color);
  } catch {}
});
on("position:toCursor", () => setPositionToCursor());
on("shell:open", (_e, url: unknown) => {
  if (typeof url === "string" && /^https:\/\/[^\s]+$/.test(url)) shell.openExternal(url);
});
on("app:restart", () => {
  app.relaunch();
  quit();
});

handle("file:export", async (e, req: ExportFileRequest) => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
  const opts = {
    title: "Export",
    defaultPath: String(req.defaultName || "export").replace(/[\\/:*?"<>|]/g, "_"),
    filters: Array.isArray(req.filters) ? req.filters : [],
  };
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  if (res.canceled || !res.filePath) return false;
  const data = req.base64 ? Buffer.from(String(req.data), "base64") : String(req.data);
  await fs.writeFile(res.filePath, data);
  return true;
});

handle("file:import", async (e, kind: "image" | "design" | "backup"): Promise<ImportedFile | null> => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
  const filters =
    kind === "image"
      ? [{ name: "Images", extensions: ["png", "svg", "jpg", "jpeg", "webp", "gif"] }]
      : kind === "design"
        ? [{ name: "Crosshair", extensions: ["json", "png", "svg", "jpg", "jpeg", "webp", "gif"] }]
        : [{ name: "Backup", extensions: ["json"] }];
  const opts = { title: "Import", properties: ["openFile" as const], filters };
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  if (res.canceled || !res.filePaths[0]) return null;
  const file = res.filePaths[0];
  const ext = path.extname(file).slice(1).toLowerCase();
  const stat = await fs.stat(file);
  const mimes: Record<string, string> = {
    png: "image/png",
    svg: "image/svg+xml",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  if (mimes[ext]) {
    if (stat.size > MAX_IMAGE_BYTES) throw new Error(`Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1e6 * 10) / 10} MB).`);
    const buf = await fs.readFile(file);
    return { name: path.basename(file, path.extname(file)), ext, dataUrl: `data:${mimes[ext]};base64,${buf.toString("base64")}` };
  }
  if (stat.size > 20_000_000) throw new Error("File is too large.");
  return { name: path.basename(file, path.extname(file)), ext, text: await fs.readFile(file, "utf-8") };
});

handle("update:check", async (): Promise<UpdateInfo> => {
  const current = app.getVersion();
  try {
    const res = await net.fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "crosshair-y" },
    });
    if (res.status === 404) return { current, latest: null, url: null, newer: false, error: "No releases published yet." };
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = (data.tag_name ?? "").replace(/^v/, "");
    return { current, latest, url: data.html_url ?? null, newer: compareVersions(latest, current) > 0 };
  } catch (err) {
    return { current, latest: null, url: null, newer: false, error: (err as Error).message };
  }
});

function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

// ── State changes ──

store.subscribe((state, prev) => {
  sendToMain("state:changed", state);
  if (state.keybinds !== prev.keybinds) input.setKeybinds(state.keybinds);
  if (state.settings.launchOnStartup !== prev.settings.launchOnStartup) applyLoginItem();
  refreshOverlay();
  buildTray();
  broadcastRuntime();
});

function applyLoginItem() {
  if (process.platform === "linux") return;
  try {
    app.setLoginItemSettings({ openAtLogin: store.get().settings.launchOnStartup, args: ["--hidden"] });
  } catch (err) {
    console.error("Failed to update login item:", err);
  }
}

// ── Lifecycle ──

app.on("second-instance", () => showMainWindow());

app.whenReady().then(() => {
  if (!store.get().settings.overlayOnLaunch && store.get().overlayEnabled) {
    store.dispatch({ type: "overlay/set", enabled: false });
  }
  createMainWindow();
  buildTray();
  input.setKeybinds(store.get().keybinds);
  input.start();
  watcher.start();
  applyLoginItem();
  refreshOverlay();

  const onDisplays = () => {
    refreshOverlay();
    broadcastRuntime();
  };
  screen.on("display-added", onDisplays);
  screen.on("display-removed", onDisplays);
  screen.on("display-metrics-changed", onDisplays);

  if (process.env.CY_SMOKE_DIR) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("./smoke").runSmoke(path.resolve(process.env.CY_SMOKE_DIR));
  }
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("will-quit", () => {
  store.flush();
  input.stop();
  watcher.stop();
  overlay.destroy();
  tray?.destroy();
});

// Keep the process alive in the tray when all windows are closed.
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});

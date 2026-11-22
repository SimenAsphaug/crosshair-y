import { BrowserWindow, screen, Display } from "electron";
import type { Design, OverlayFrame } from "../shared/types";
import { designExtent } from "../shared/design";
import { loadPage, preloadPath } from "./paths";

export interface OverlayTarget {
  design: Design | null;
  visible: boolean;
  scale: number;
  displayId: number | null;
  offsetX: number;
  offsetY: number;
  hideFromCapture: boolean;
}

export function findDisplay(displayId: number | null): Display {
  if (displayId !== null) {
    const d = screen.getAllDisplays().find((x) => x.id === displayId);
    if (d) return d;
  }
  return screen.getPrimaryDisplay();
}

/** Display bounds in physical pixels. */
export function physicalBounds(d: Display) {
  if (process.platform === "win32") return screen.dipToScreenRect(null, d.bounds);
  const s = d.scaleFactor;
  return { x: Math.round(d.bounds.x * s), y: Math.round(d.bounds.y * s), width: Math.round(d.bounds.width * s), height: Math.round(d.bounds.height * s) };
}

function toDip(rect: { x: number; y: number; width: number; height: number }, d: Display) {
  if (process.platform === "win32") return screen.screenToDipRect(null, rect);
  const s = d.scaleFactor;
  return { x: rect.x / s, y: rect.y / s, width: rect.width / s, height: rect.height / s };
}

/** Transparent, click-through, always-on-top window that draws the crosshair. */
export class Overlay {
  private win: BrowserWindow | null = null;
  private ready = false;
  private target: OverlayTarget | null = null;
  private topTimer: NodeJS.Timeout | null = null;
  private lastBounds = "";

  private ensureWindow(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win;
    this.ready = false;
    this.lastBounds = "";
    const win = new BrowserWindow({
      width: 64,
      height: 64,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.setIgnoreMouseEvents(true);
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.webContents.on("did-finish-load", () => {
      this.ready = true;
      this.sendFrame();
    });
    win.on("closed", () => {
      this.win = null;
      this.ready = false;
    });
    loadPage(win, "overlay");
    this.win = win;
    return win;
  }

  update(t: OverlayTarget) {
    this.target = t;
    if (!t.visible || !t.design) {
      if (this.win && !this.win.isDestroyed() && this.win.isVisible()) this.win.hide();
      this.stopKeepTop();
      return;
    }
    const win = this.ensureWindow();
    win.setContentProtection(t.hideFromCapture);
    this.position();
    this.sendFrame();
    if (!win.isVisible()) win.showInactive();
    this.startKeepTop();
  }

  /** Re-apply the current target (e.g. after display changes). */
  refresh() {
    if (this.target) this.update(this.target);
  }

  fire(firing: boolean) {
    if (this.ready && this.win && !this.win.isDestroyed()) this.win.webContents.send("overlay:fire", firing);
  }

  private sendFrame() {
    if (!this.ready || !this.win || this.win.isDestroyed() || !this.target) return;
    const frame: OverlayFrame = { design: this.target.design, scale: this.target.scale };
    this.win.webContents.send("overlay:frame", frame);
  }

  private position() {
    const t = this.target;
    if (!t || !t.design || !this.win) return;
    const display = findDisplay(t.displayId);
    const phys = physicalBounds(display);
    const extent = designExtent(t.design) * t.scale;
    const size = Math.min(Math.max(16, Math.ceil(extent) * 2 + 8), Math.min(phys.width, phys.height));
    const cx = phys.x + phys.width / 2 + t.offsetX;
    const cy = phys.y + phys.height / 2 + t.offsetY;
    const rect = { x: Math.round(cx - size / 2), y: Math.round(cy - size / 2), width: size, height: size };
    const dip = toDip(rect, display);
    const bounds = {
      x: Math.round(dip.x),
      y: Math.round(dip.y),
      width: Math.max(1, Math.round(dip.width)),
      height: Math.max(1, Math.round(dip.height)),
    };
    const key = JSON.stringify(bounds);
    if (key !== this.lastBounds) {
      this.lastBounds = key;
      this.win.setBounds(bounds);
    }
  }

  private startKeepTop() {
    if (this.topTimer) return;
    // Some games re-assert their own z-order; periodically move back on top.
    this.topTimer = setInterval(() => {
      if (this.win && !this.win.isDestroyed() && this.win.isVisible()) {
        this.win.setAlwaysOnTop(true, "screen-saver");
        this.win.moveTop();
      }
    }, 1500);
  }

  private stopKeepTop() {
    if (this.topTimer) clearInterval(this.topTimer);
    this.topTimer = null;
  }

  destroy() {
    this.stopKeepTop();
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }
}

import { app, BrowserWindow, nativeImage } from "electron";
import path from "path";

const DEV_URL = process.env.VITE_DEV_SERVER_URL;

export function preloadPath() {
  return path.join(__dirname, "..", "preload", "preload.js");
}

export function rendererDir() {
  return path.join(app.getAppPath(), "dist", "renderer");
}

export function loadPage(win: BrowserWindow, page: "index" | "overlay") {
  if (DEV_URL) return win.loadURL(`${DEV_URL.replace(/\/$/, "")}/${page}.html`);
  return win.loadFile(path.join(rendererDir(), `${page}.html`));
}

export function isAppUrl(url: string) {
  if (DEV_URL && url.startsWith(DEV_URL)) return true;
  return url.startsWith("file://");
}

export function windowIconPath() {
  return path.join(app.getAppPath(), "build-assets", process.platform === "win32" ? "icon.ico" : "icon.png");
}

/** Draws a small crosshair icon in memory (used for the tray on every platform). */
export function makeCrosshairIcon(size = 32, hex = "#2dd4bf") {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const t = Math.max(2, Math.round(size / 10));
  const gap = Math.round(size / 8);
  const put = (x: number, y: number, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = a; // BGRA
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const inV = Math.abs(dx) < t / 2 && Math.abs(dy) > gap && Math.abs(dy) < c - 1;
      const inH = Math.abs(dy) < t / 2 && Math.abs(dx) > gap && Math.abs(dx) < c - 1;
      const dist = Math.hypot(dx, dy);
      const ring = Math.abs(dist - (c - t * 1.5)) < t / 2;
      const dot = dist < t * 0.8;
      if (inV || inH || ring || dot) put(x, y);
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

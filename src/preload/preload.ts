import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { CyApi } from "../shared/types";

// Sandboxed preload: only type imports from shared code are allowed here.

function subscribe<T extends unknown[]>(channel: string, cb: (...args: T) => void) {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T));
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const api: CyApi = {
  getState: () => ipcRenderer.invoke("state:get"),
  getRuntime: () => ipcRenderer.invoke("runtime:get"),
  dispatch: (action) => ipcRenderer.send("state:dispatch", action),
  onState: (cb) => subscribe("state:changed", cb),
  onRuntime: (cb) => subscribe("runtime:changed", cb),
  onNavigate: (cb) => subscribe("navigate", cb),

  previewDesign: (design) => ipcRenderer.send("design:preview", design),
  setRecordingInput: (recording) => ipcRenderer.send("input:recording", recording),
  setTitleBarColors: (color, symbol) => ipcRenderer.send("window:titlebar", color, symbol),
  setPositionToCursor: () => ipcRenderer.send("position:toCursor"),

  exportFile: (req) => ipcRenderer.invoke("file:export", req),
  importFile: (kind) => ipcRenderer.invoke("file:import", kind),
  openExternal: (url) => ipcRenderer.send("shell:open", url),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  restart: () => ipcRenderer.send("app:restart"),

  onOverlayFrame: (cb) => subscribe("overlay:frame", cb),
  onOverlayFire: (cb) => subscribe("overlay:fire", cb),
};

contextBridge.exposeInMainWorld("cy", api);

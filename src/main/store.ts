import { app } from "electron";
import fs from "fs";
import path from "path";
import type { Action, AppState } from "../shared/types";
import { defaultState, normalizeState, reduce } from "../shared/state";

type Listener = (state: AppState, prev: AppState) => void;

/** Owns the single source of truth for persisted app state. */
export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  private saveTimer: NodeJS.Timeout | null = null;
  readonly file: string;

  constructor() {
    this.file = path.join(app.getPath("userData"), "crosshair-y.json");
    this.state = this.load();
  }

  private load(): AppState {
    try {
      const raw = fs.readFileSync(this.file, "utf-8");
      return normalizeState(JSON.parse(raw));
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        // Keep a copy of the unreadable file so nothing is silently lost.
        try {
          fs.copyFileSync(this.file, this.file + `.corrupt-${Date.now()}`);
        } catch {}
        console.error("Failed to read state, using defaults:", err);
      }
      return defaultState();
    }
  }

  get(): AppState {
    return this.state;
  }

  dispatch(action: Action) {
    const prev = this.state;
    let next: AppState | undefined;
    try {
      next = reduce(prev, action);
    } catch (err) {
      console.error("Rejected action", action?.type, err);
      return;
    }
    if (!next || next === prev) return;
    this.state = next;
    this.scheduleSave();
    for (const l of this.listeners) l(next, prev);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error("Failed to save state:", err);
    }
  }
}

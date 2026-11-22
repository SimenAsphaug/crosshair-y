import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import type { Action, AppState, Design, RuntimeStatus, SavedDesign } from "../../shared/types";

export type Page = "library" | "designer" | "keybinds" | "profiles" | "settings";

export interface Toast {
  id: number;
  kind: "ok" | "error" | "info";
  text: string;
}

interface Ctx {
  state: AppState;
  runtime: RuntimeStatus;
  dispatch: (a: Action) => void;
  page: Page;
  navigate: (p: Page) => void;
  /** Design opened in the designer (null = start new). */
  editing: { design: Design; savedId: string | null } | null;
  openDesigner: (design: Design | null, savedId?: string | null) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  toasts: Toast[];
  activeDesign: SavedDesign | null;
  effectiveProfile: AppState["profiles"][number];
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function AppProvider({ initial, initialRuntime, children }: { initial: AppState; initialRuntime: RuntimeStatus; children: ReactNode }) {
  const [state, setState] = useState(initial);
  const [runtime, setRuntime] = useState(initialRuntime);
  const [page, setPage] = useState<Page>("library");
  const [editing, setEditing] = useState<Ctx["editing"]>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => window.cy.onState(setState), []);
  useEffect(() => window.cy.onRuntime(setRuntime), []);
  useEffect(() => window.cy.onNavigate((p) => setPage(p as Page)), []);

  const dispatch = useCallback((a: Action) => window.cy.dispatch(a), []);

  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const openDesigner = useCallback((design: Design | null, savedId: string | null = null) => {
    setEditing(design ? { design, savedId } : null);
    setPage("designer");
  }, []);

  const effectiveProfile = useMemo(
    () =>
      state.profiles.find((p) => p.id === runtime.effectiveProfileId) ??
      state.profiles.find((p) => p.id === state.activeProfileId) ??
      state.profiles[0],
    [state.profiles, state.activeProfileId, runtime.effectiveProfileId],
  );
  const activeDesign = useMemo(
    () => state.designs.find((d) => d.id === effectiveProfile?.designId) ?? null,
    [state.designs, effectiveProfile],
  );

  const value: Ctx = {
    state,
    runtime,
    dispatch,
    page,
    navigate: setPage,
    editing,
    openDesigner,
    toast,
    toasts,
    activeDesign,
    effectiveProfile,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

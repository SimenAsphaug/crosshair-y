import { useEffect, useState } from "react";
import {
  LayoutGrid,
  PenTool,
  Keyboard,
  Users,
  Settings as SettingsIcon,
  Power,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  XCircle,
  Info,
  Plus,
  Check,
} from "lucide-react";
import { useApp, Page } from "./state";
import { Thumb } from "./components/Thumb";
import { useMenu } from "./components/ui";
import { LibraryPage } from "./pages/Library";
import { DesignerPage } from "./pages/Designer";
import { KeybindsPage } from "./pages/Keybinds";
import { ProfilesPage } from "./pages/Profiles";
import { SettingsPage } from "./pages/Settings";
import { bindingLabel } from "../../shared/keys";

const NAV: { id: Page; label: string; icon: typeof LayoutGrid }[] = [
  { id: "library", label: "Crosshairs", icon: LayoutGrid },
  { id: "designer", label: "Designer", icon: PenTool },
  { id: "keybinds", label: "Keybinds", icon: Keyboard },
  { id: "profiles", label: "Profiles & games", icon: Users },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function contrastText(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#0b1512" : "#ffffff";
}

function useTheme() {
  const { state } = useApp();
  const s = state.settings;
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setSystemDark(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const dark = s.theme === "dark" || (s.theme === "system" && systemDark);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.density = s.compact ? "compact" : "comfortable";
    root.dataset.motion = s.reducedMotion ? "reduced" : "full";
    root.style.setProperty("--accent", s.accent);
    root.style.setProperty("--accent-fg", contrastText(s.accent));
    (root.style as CSSStyleDeclaration & { zoom: string }).zoom = String(s.uiScale);
    window.cy.setTitleBarColors(dark ? "#0f1115" : "#f4f5f8", dark ? "#c9ced6" : "#2a2f37");
  }, [dark, s.accent, s.compact, s.reducedMotion, s.uiScale]);
}

function TopBar() {
  const { state, runtime, dispatch, activeDesign, effectiveProfile, navigate } = useApp();
  const profileMenu = useMenu();
  const on = state.overlayEnabled;
  const autoProfile = runtime.effectiveProfileId !== state.activeProfileId;

  const openProfiles = (el: HTMLElement) =>
    profileMenu.openBelow(el, [
      { heading: "Profile" },
      ...state.profiles.map((p) => ({
        label: p.name + (p.games.length ? `  ·  ${p.games.length} game${p.games.length > 1 ? "s" : ""}` : ""),
        icon: p.id === state.activeProfileId ? <Check size={15} /> : <span style={{ width: 15 }} />,
        onClick: () => dispatch({ type: "profile/activate", id: p.id }),
      })),
      { separator: true },
      { label: "Manage profiles", icon: <Plus size={15} />, onClick: () => navigate("profiles") },
    ]);

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        <span>
          Crosshair <span className="y">Y</span>
        </span>
      </div>
      <div className="spacer" />
      {runtime.gameDetection === "ok" && (
        <span className="status-pill" title={runtime.foreground ?? "No focused app"}>
          <span className={`status-dot ${runtime.inGame ? "on" : ""}`} />
          {runtime.inGame ? `In game · ${runtime.foreground}` : "No game detected"}
        </span>
      )}
      <button className="btn sm" onClick={(e) => openProfiles(e.currentTarget)} title={autoProfile ? "Switched automatically for the focused game" : "Active profile"}>
        {effectiveProfile?.name ?? "Default"}
        {autoProfile && <span className="badge accent">auto</span>}
        <ChevronDown size={14} />
      </button>
      {activeDesign && (
        <button className="current-chip" onClick={() => navigate("library")} title="Current crosshair">
          <Thumb design={activeDesign} size={26} maxScale={2} />
          <span>{activeDesign.name}</span>
        </button>
      )}
      <button
        className={`power ${on ? "on" : ""}`}
        onClick={() => dispatch({ type: "overlay/toggle" })}
        title={`Show or hide the crosshair (${bindingLabel(state.keybinds.toggle)})`}
      >
        <span className="knob">
          <Power size={13} strokeWidth={2.6} />
        </span>
        {on ? "On" : "Off"}
      </button>
      {profileMenu.node}
    </header>
  );
}

function Sidebar() {
  const { page, navigate, state, dispatch } = useApp();
  const collapsed = state.settings.sidebarCollapsed;
  return (
    <nav className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {NAV.map((n) => (
        <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => navigate(n.id)} title={collapsed ? n.label : undefined}>
          <n.icon size={18} />
          {!collapsed && <span>{n.label}</span>}
        </button>
      ))}
      <div className="grow" />
      <button
        className="nav-item"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => dispatch({ type: "settings/update", patch: { sidebarCollapsed: !collapsed } })}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </nav>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === "ok" ? <CheckCircle2 size={17} /> : t.kind === "error" ? <XCircle size={17} /> : <Info size={17} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function useUpdateCheck() {
  const { state, toast } = useApp();
  useEffect(() => {
    if (!state.settings.checkUpdates) return;
    window.cy.checkUpdate().then((u) => {
      if (u.newer) toast(`Crosshair Y ${u.latest} is available. See Settings → About.`, "info");
    });
    // Only once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function App() {
  useTheme();
  useUpdateCheck();
  const { page } = useApp();
  return (
    <div className="app">
      <TopBar />
      <Sidebar />
      <main className="main">
        {page === "library" && <LibraryPage />}
        {page === "designer" && <DesignerPage />}
        {page === "keybinds" && <KeybindsPage />}
        {page === "profiles" && <ProfilesPage />}
        {page === "settings" && <SettingsPage />}
      </main>
      <Toasts />
    </div>
  );
}

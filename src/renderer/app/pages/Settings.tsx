import { useState } from "react";
import { Palette, Monitor, Rocket, Gauge, Globe, Database, Info, X, Download, Upload, RotateCcw, RefreshCw, Github, ExternalLink } from "lucide-react";
import type { Settings, UpdateInfo } from "../../../shared/types";
import { DEFAULT_COMMUNITY_REPO, DEFAULT_COMMUNITY_URL, defaultState, normalizeState } from "../../../shared/state";
import { useApp } from "../state";
import { ColorField, ConfirmModal, Notice, Segmented, SettingRow, Slider, Toggle } from "../components/ui";

type Cat = "interface" | "display" | "startup" | "performance" | "community" | "data" | "about";
const CATS: { id: Cat; label: string; icon: typeof Palette }[] = [
  { id: "interface", label: "Interface", icon: Palette },
  { id: "display", label: "Display", icon: Monitor },
  { id: "startup", label: "Startup", icon: Rocket },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "community", label: "Community", icon: Globe },
  { id: "data", label: "Backup & reset", icon: Database },
  { id: "about", label: "About", icon: Info },
];

const ACCENTS = ["#2dd4bf", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e"];
const REPO_URL = "https://github.com/SimenAsphaug/crosshair-y";

export function SettingsPage() {
  const [cat, setCat] = useState<Cat>("interface");
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav">
          {CATS.map((c) => (
            <button key={c.id} className={`cat ${cat === c.id ? "active" : ""}`} onClick={() => setCat(c.id)}>
              <c.icon size={15} /> {c.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {cat === "interface" && <InterfaceSettings />}
          {cat === "display" && <DisplaySettings />}
          {cat === "startup" && <StartupSettings />}
          {cat === "performance" && <PerformanceSettings />}
          {cat === "community" && <CommunitySettings />}
          {cat === "data" && <DataSettings />}
          {cat === "about" && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}

function useSettings() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const set = (patch: Partial<Settings>) => dispatch({ type: "settings/update", patch });
  return { s, set };
}

function InterfaceSettings() {
  const { s, set } = useSettings();
  return (
    <div className="card">
      <SettingRow title="Theme">
        <Segmented
          value={s.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "system", label: "System" },
          ]}
        />
      </SettingRow>
      <SettingRow title="Accent color" desc="Used for highlights, buttons and the tray icon.">
        <ColorField value={s.accent} onChange={(accent) => set({ accent })} presets={ACCENTS} />
      </SettingRow>
      <div className="setting" style={{ display: "block" }}>
        <Slider
          label={<span className="title" style={{ color: "var(--text)", fontSize: 13.5 }}>Interface size</span>}
          value={Math.round(s.uiScale * 100)}
          min={80}
          max={140}
          step={5}
          suffix="%"
          onChange={(v) => set({ uiScale: v / 100 })}
        />
      </div>
      <SettingRow title="Compact mode" desc="Tighter spacing to fit more on screen.">
        <Toggle on={s.compact} onChange={(compact) => set({ compact })} />
      </SettingRow>
      <SettingRow title="Reduce motion" desc="Turns off interface animations.">
        <Toggle on={s.reducedMotion} onChange={(reducedMotion) => set({ reducedMotion })} />
      </SettingRow>
      <SettingRow title="Collapsed sidebar" desc="Show only icons in the navigation.">
        <Toggle on={s.sidebarCollapsed} onChange={(sidebarCollapsed) => set({ sidebarCollapsed })} />
      </SettingRow>
    </div>
  );
}

function DisplaySettings() {
  const { s, set } = useSettings();
  const { runtime } = useApp();
  const [game, setGame] = useState("");
  const windows = runtime.gameDetection === "ok";
  const addGame = () => {
    const g = game.trim().toLowerCase().replace(/^.*[\\/]/, "");
    if (g && !s.customGames.includes(g)) set({ customGames: [...s.customGames, g.endsWith(".exe") || !windows ? g : `${g}.exe`] });
    setGame("");
  };
  return (
    <>
      <div className="card">
        <SettingRow
          title="Show only in game"
          desc={windows ? "Hide the crosshair unless a game is focused. Linked games and the list below count as games." : "Requires game detection, which is only available on Windows."}
        >
          <Toggle on={s.showOnlyInGame} disabled={!windows} onChange={(showOnlyInGame) => set({ showOnlyInGame })} />
        </SettingRow>
        <SettingRow title="Hide from screen recordings" desc="Keeps the crosshair out of screenshots, OBS and Discord streams. You still see it.">
          <Toggle on={s.hideFromCapture} onChange={(hideFromCapture) => set({ hideFromCapture })} />
        </SettingRow>
      </div>
      {windows && (
        <div className="card">
          <div className="card-head">
            <h3>Extra games</h3>
            <span className="sub">Popular games are recognized automatically</span>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            <div className="chips">
              {s.customGames.length === 0 && <span className="faint">None added.</span>}
              {s.customGames.map((g) => (
                <span className="chip" key={g}>
                  {g}
                  <button onClick={() => set({ customGames: s.customGames.filter((x) => x !== g) })} title="Remove">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="row wrap">
              <input className="input grow" placeholder="game.exe" value={game} onChange={(e) => setGame(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGame()} />
              <button className="btn" onClick={addGame} disabled={!game.trim()}>
                Add
              </button>
              {runtime.recentApps.length > 0 && (
                <select className="select" value="" onChange={(e) => e.target.value && set({ customGames: [...new Set([...s.customGames, e.target.value])] })}>
                  <option value="">Add a recent app…</option>
                  {runtime.recentApps
                    .filter((a) => !s.customGames.includes(a))
                    .map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>
        </div>
      )}
      <Notice>
        The crosshair is a normal always-on-top window, so it shows over games in <b>borderless</b> or <b>windowed</b> mode. Games running in exclusive
        fullscreen draw over it. Switch those to borderless fullscreen.
      </Notice>
    </>
  );
}

function StartupSettings() {
  const { s, set } = useSettings();
  const { runtime } = useApp();
  return (
    <div className="card">
      <SettingRow title="Launch when the computer starts" desc={runtime.platform === "linux" ? "Not available on Linux. Add Crosshair Y to your desktop's autostart instead." : "Starts quietly in the tray."}>
        <Toggle on={s.launchOnStartup} disabled={runtime.platform === "linux"} onChange={(launchOnStartup) => set({ launchOnStartup })} />
      </SettingRow>
      <SettingRow title="Start minimized" desc="Open to the tray instead of showing this window.">
        <Toggle on={s.startMinimized} onChange={(startMinimized) => set({ startMinimized })} />
      </SettingRow>
      <SettingRow title="Show the crosshair at launch" desc="Otherwise it starts turned off.">
        <Toggle on={s.overlayOnLaunch} onChange={(overlayOnLaunch) => set({ overlayOnLaunch })} />
      </SettingRow>
      <SettingRow title="Close to tray" desc="The close button hides the window and keeps the crosshair running.">
        <Toggle on={s.closeToTray} onChange={(closeToTray) => set({ closeToTray })} />
      </SettingRow>
    </div>
  );
}

function PerformanceSettings() {
  const { s, set } = useSettings();
  const [changed, setChanged] = useState(false);
  return (
    <>
      <div className="card">
        <SettingRow title="Hardware acceleration" desc="Turn this off if the crosshair flickers or shows a black box. Takes effect after a restart.">
          <Toggle
            on={s.hardwareAcceleration}
            onChange={(hardwareAcceleration) => {
              set({ hardwareAcceleration });
              setChanged(true);
            }}
          />
        </SettingRow>
      </div>
      {changed && (
        <Notice kind="warn">
          Restart Crosshair Y to apply this.{" "}
          <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => window.cy.restart()}>
            Restart now
          </button>
        </Notice>
      )}
    </>
  );
}

function CommunitySettings() {
  const { s, set } = useSettings();
  const [url, setUrl] = useState(s.communityIndexUrl);
  const [repo, setRepo] = useState(s.communityRepo);
  const dirty = url !== s.communityIndexUrl || repo !== s.communityRepo;
  const valid = /^https:\/\/\S+$/.test(url) && /^[\w.-]+\/[\w.-]+$/.test(repo);
  return (
    <div className="card">
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <div className="muted">
          The community gallery is a JSON index hosted on GitHub. Point it at another repository to use a different gallery, for example your own team's.
        </div>
        <div className="field">
          <label>Gallery index URL</label>
          <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field">
          <label>Repository for submissions (owner/name)</label>
          <input className="input mono" value={repo} onChange={(e) => setRepo(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn primary" disabled={!dirty || !valid} onClick={() => set({ communityIndexUrl: url, communityRepo: repo })}>
            Save
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              setUrl(DEFAULT_COMMUNITY_URL);
              setRepo(DEFAULT_COMMUNITY_REPO);
              set({ communityIndexUrl: DEFAULT_COMMUNITY_URL, communityRepo: DEFAULT_COMMUNITY_REPO });
            }}
          >
            <RotateCcw size={14} /> Defaults
          </button>
          {!valid && <span className="badge warn">Check the URL and repository</span>}
        </div>
      </div>
    </div>
  );
}

function DataSettings() {
  const { state, dispatch, toast } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof normalizeState> | null>(null);

  const exportBackup = async () => {
    const ok = await window.cy.exportFile({
      defaultName: `crosshair-y-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "Backup", extensions: ["json"] }],
      data: JSON.stringify(state, null, 2),
    });
    if (ok) toast("Backup saved");
  };
  const importBackup = async () => {
    try {
      const f = await window.cy.importFile("backup");
      if (!f?.text) return;
      const parsed = normalizeState(JSON.parse(f.text));
      setPendingImport(parsed);
    } catch (e) {
      toast(`Couldn't read the backup: ${e instanceof Error ? e.message : e}`, "error");
    }
  };

  return (
    <>
      <div className="card">
        <SettingRow title="Export backup" desc="Saves every crosshair, profile, keybind and setting to one file.">
          <button className="btn" onClick={exportBackup}>
            <Download size={15} /> Export
          </button>
        </SettingRow>
        <SettingRow title="Restore backup" desc="Replaces your current data with a backup file.">
          <button className="btn" onClick={importBackup}>
            <Upload size={15} /> Restore
          </button>
        </SettingRow>
        <SettingRow title="Reset everything" desc="Deletes all crosshairs, profiles and settings.">
          <button className="btn danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={15} /> Reset
          </button>
        </SettingRow>
      </div>
      {confirmReset && (
        <ConfirmModal
          title="Reset everything?"
          confirm="Reset"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            dispatch({ type: "state/replace", state: defaultState() });
            toast("Everything was reset");
          }}
        >
          This can't be undone. Export a backup first if you might want your crosshairs back.
        </ConfirmModal>
      )}
      {pendingImport && (
        <ConfirmModal
          title="Restore this backup?"
          confirm="Restore"
          danger={false}
          onClose={() => setPendingImport(null)}
          onConfirm={() => {
            dispatch({ type: "state/replace", state: pendingImport });
            toast(`Restored ${pendingImport.designs.length} crosshairs`);
          }}
        >
          The backup has {pendingImport.designs.length} crosshairs and {pendingImport.profiles.length} profiles. Your current data will be replaced.
        </ConfirmModal>
      )}
    </>
  );
}

function AboutSettings() {
  const { runtime } = useApp();
  const { s, set } = useSettings();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    setUpdate(await window.cy.checkUpdate());
    setChecking(false);
  };
  return (
    <>
      <div className="card">
        <SettingRow title="Crosshair Y" desc={`Version ${runtime.version} · ${runtime.platform} · MIT license`}>
          <button className="btn" onClick={() => window.cy.openExternal(REPO_URL)}>
            <Github size={15} /> GitHub
          </button>
        </SettingRow>
        <SettingRow
          title="Updates"
          desc={
            update
              ? update.error
                ? `Couldn't check: ${update.error}`
                : update.newer
                  ? `Version ${update.latest} is available.`
                  : "You're on the latest version."
              : "Check GitHub for a newer release."
          }
        >
          {update?.newer && update.url && (
            <button className="btn primary" onClick={() => window.cy.openExternal(update.url!)}>
              <ExternalLink size={15} /> Download
            </button>
          )}
          <button className="btn" onClick={check} disabled={checking}>
            <RefreshCw size={15} className={checking ? "spin" : ""} /> Check now
          </button>
        </SettingRow>
        <SettingRow title="Check for updates at launch">
          <Toggle on={s.checkUpdates} onChange={(checkUpdates) => set({ checkUpdates })} />
        </SettingRow>
      </div>
      <div className="card">
        <div className="card-head">
          <h3>Status</h3>
        </div>
        <SettingRow title="Global input hook" desc={runtime.inputHook === "ok" ? "Keyboard and mouse shortcuts work while games are focused." : runtime.inputHookError ?? "Unavailable"}>
          <span className={`badge ${runtime.inputHook === "ok" ? "ok" : "warn"}`}>{runtime.inputHook === "ok" ? "Running" : "Unavailable"}</span>
        </SettingRow>
        <SettingRow title="Game detection" desc={runtime.gameDetection === "ok" ? `Focused app: ${runtime.foreground ?? "—"}` : "Only available on Windows."}>
          <span className={`badge ${runtime.gameDetection === "ok" ? "ok" : ""}`}>{runtime.gameDetection === "ok" ? "Running" : "Off"}</span>
        </SettingRow>
        <SettingRow title="Displays" desc={runtime.displays.map((d) => `${d.label} ${d.width}×${d.height} @${Math.round(d.scaleFactor * 100)}%`).join(" · ")} />
      </div>
    </>
  );
}

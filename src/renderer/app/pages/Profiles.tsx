import { useState } from "react";
import { Plus, Trash2, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, LocateFixed, Move, Check, Gamepad2 } from "lucide-react";
import type { Profile } from "../../../shared/types";
import { uid } from "../../../shared/design";
import { DEFAULT_PROFILE_ID } from "../../../shared/state";
import { bindingLabel } from "../../../shared/keys";
import { useApp } from "../state";
import { Thumb } from "../components/Thumb";
import { ConfirmModal, Notice, PromptModal, SettingRow, Slider, Toggle } from "../components/ui";

export function ProfilesPage() {
  const { state, dispatch, runtime } = useApp();
  const [selected, setSelected] = useState(state.activeProfileId);
  const [creating, setCreating] = useState(false);
  const profile = state.profiles.find((p) => p.id === selected) ?? state.profiles[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Profiles & games</h1>
          <p>Each profile remembers its crosshair, monitor and position. Link games to switch automatically.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 1100, marginBottom: 18 }}>
        <SettingRow
          title="Switch profile automatically"
          desc={
            runtime.gameDetection === "ok"
              ? "When a linked game is focused, its profile is used. Otherwise the selected profile is used."
              : "Game detection is only available on Windows."
          }
        >
          <Toggle
            on={state.settings.autoSwitchProfiles}
            disabled={runtime.gameDetection !== "ok"}
            onChange={(v) => dispatch({ type: "settings/update", patch: { autoSwitchProfiles: v } })}
          />
        </SettingRow>
      </div>

      <div className="profiles" style={{ maxWidth: 1100 }}>
        <div style={{ display: "grid", gap: 8 }}>
          {state.profiles.map((p) => {
            const design = state.designs.find((d) => d.id === p.designId);
            return (
              <button key={p.id} className={`profile-item ${p.id === profile.id ? "active" : ""}`} onClick={() => setSelected(p.id)}>
                <span className="avatar">{design ? <Thumb design={design} size={26} maxScale={2} /> : p.name[0]?.toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div className="faint" style={{ fontSize: 11.5 }}>
                    {p.games.length ? `${p.games.length} linked game${p.games.length > 1 ? "s" : ""}` : p.id === DEFAULT_PROFILE_ID ? "Fallback" : "No games linked"}
                  </div>
                </span>
                {runtime.effectiveProfileId === p.id && <span className="badge accent">Active</span>}
              </button>
            );
          })}
          <button className="btn" onClick={() => setCreating(true)}>
            <Plus size={15} /> New profile
          </button>
        </div>

        <ProfileEditor key={profile.id} profile={profile} onDeleted={() => setSelected(DEFAULT_PROFILE_ID)} />
      </div>

      {creating && (
        <PromptModal
          title="New profile"
          label="Name (e.g. the game it's for)"
          confirm="Create"
          onClose={() => setCreating(false)}
          onSubmit={(name) => {
            const base = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
            const p: Profile = { ...base, id: uid("p_"), name, games: [] };
            dispatch({ type: "profile/save", profile: p });
            setSelected(p.id);
          }}
        />
      )}
    </div>
  );
}

function ProfileEditor({ profile, onDeleted }: { profile: Profile; onDeleted: () => void }) {
  const { state, dispatch, runtime } = useApp();
  const [gameInput, setGameInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = (patch: Partial<Profile>) => dispatch({ type: "profile/save", profile: { ...profile, ...patch } });
  const isDefault = profile.id === DEFAULT_PROFILE_ID;
  const isSelected = state.activeProfileId === profile.id;
  const display = runtime.displays.find((d) => d.id === profile.displayId) ?? runtime.displays.find((d) => d.primary);
  const halfW = Math.round((display?.width ?? 1920) / 2);
  const halfH = Math.round((display?.height ?? 1080) / 2);

  const addGame = (raw: string) => {
    const exe = raw.trim().toLowerCase().replace(/^.*[\\/]/, "");
    if (!exe) return;
    const name = exe.endsWith(".exe") || runtime.platform !== "win32" ? exe : `${exe}.exe`;
    if (!profile.games.includes(name)) save({ games: [...profile.games, name] });
    setGameInput("");
  };

  const nudge = (dx: number, dy: number) =>
    dispatch({ type: "profile/offset", id: profile.id, offsetX: profile.offsetX + dx, offsetY: profile.offsetY + dy });

  const suggestions = runtime.recentApps.filter((a) => !profile.games.includes(a));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="card">
        <div className="card-head">
          <input
            className="input"
            style={{ fontWeight: 600, width: 240 }}
            value={profile.name}
            maxLength={40}
            onChange={(e) => save({ name: e.target.value || "Profile" })}
          />
          <div className="right">
            {isSelected ? (
              <span className="badge accent">
                <Check size={11} /> Selected
              </span>
            ) : (
              <button className="btn sm" onClick={() => dispatch({ type: "profile/activate", id: profile.id })}>
                Use this profile
              </button>
            )}
            {!isDefault && (
              <button className="btn sm ghost danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 16 }}>
          <div className="field">
            <label>Crosshair</label>
            <div className="row">
              {(() => {
                const d = state.designs.find((x) => x.id === profile.designId);
                return d ? (
                  <span className="card" style={{ display: "grid", placeItems: "center", width: 40, height: 40 }}>
                    <Thumb design={d} size={34} maxScale={2} />
                  </span>
                ) : null;
              })()}
              <select className="select grow" value={profile.designId ?? ""} onChange={(e) => dispatch({ type: "design/activate", id: e.target.value, profileId: profile.id })}>
                {state.designs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isDefault && (
            <div className="field">
              <label>
                <Gamepad2 size={14} /> Linked games
              </label>
              {runtime.gameDetection !== "ok" && <Notice>Game detection is only available on Windows.</Notice>}
              <div className="chips">
                {profile.games.length === 0 && <span className="faint">No games linked. This profile is only used when you select it.</span>}
                {profile.games.map((g) => (
                  <span key={g} className="chip">
                    {g}
                    <button title="Remove" onClick={() => save({ games: profile.games.filter((x) => x !== g) })}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="row wrap">
                <input
                  className="input grow"
                  placeholder="Executable name, e.g. cs2.exe"
                  value={gameInput}
                  onChange={(e) => setGameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGame(gameInput)}
                />
                <button className="btn" onClick={() => addGame(gameInput)} disabled={!gameInput.trim()}>
                  Add
                </button>
                {suggestions.length > 0 && (
                  <select className="select" value="" onChange={(e) => e.target.value && addGame(e.target.value)} title="Apps you've recently focused">
                    <option value="">Add a recent app…</option>
                    {suggestions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {runtime.gameDetection === "ok" && (
                <div className="faint" style={{ fontSize: 12 }}>
                  Tip: start the game, alt-tab back here, and pick it from “Add a recent app”.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Monitor & position</h3>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 16 }}>
          <div className="field">
            <label>Monitor</label>
            <select
              className="select"
              value={profile.displayId === null ? "" : String(profile.displayId)}
              onChange={(e) => save({ displayId: e.target.value === "" ? null : Number(e.target.value) })}
            >
              <option value="">Primary monitor</option>
              {runtime.displays.map((d, i) => (
                <option key={d.id} value={d.id}>
                  {i + 1}. {d.label} ({d.width}×{d.height}){d.primary ? " · primary" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
            <div className="grow" style={{ display: "grid", gap: 12 }}>
              <Slider
                label="Horizontal offset"
                value={profile.offsetX}
                min={-halfW}
                max={halfW}
                step={1}
                suffix="px"
                allowBeyond
                onChange={(v) => dispatch({ type: "profile/offset", id: profile.id, offsetX: v, offsetY: profile.offsetY })}
              />
              <Slider
                label="Vertical offset"
                value={profile.offsetY}
                min={-halfH}
                max={halfH}
                step={1}
                suffix="px"
                allowBeyond
                onChange={(v) => dispatch({ type: "profile/offset", id: profile.id, offsetX: profile.offsetX, offsetY: v })}
              />
              <div className="row wrap">
                <button className="btn" onClick={() => dispatch({ type: "profile/offset", id: profile.id, offsetX: 0, offsetY: 0 })}>
                  <LocateFixed size={15} /> Re-center
                </button>
                <span className="faint" style={{ fontSize: 12 }}>
                  <Move size={12} style={{ verticalAlign: -2 }} /> In game: press {bindingLabel(state.keybinds.toCursor)} to move it to your mouse.
                </span>
              </div>
            </div>
            <div className="field">
              <label>Fine-tune</label>
              <div className="nudge">
                <span />
                <button className="btn" title="Up 1 px" onClick={() => nudge(0, -1)}>
                  <ArrowUp size={14} />
                </button>
                <span />
                <button className="btn" title="Left 1 px" onClick={() => nudge(-1, 0)}>
                  <ArrowLeft size={14} />
                </button>
                <button className="btn" title="Re-center" onClick={() => dispatch({ type: "profile/offset", id: profile.id, offsetX: 0, offsetY: 0 })}>
                  <LocateFixed size={14} />
                </button>
                <button className="btn" title="Right 1 px" onClick={() => nudge(1, 0)}>
                  <ArrowRight size={14} />
                </button>
                <span />
                <button className="btn" title="Down 1 px" onClick={() => nudge(0, 1)}>
                  <ArrowDown size={14} />
                </button>
                <span />
              </div>
            </div>
          </div>
          <Slider label="Size" hint="scales the whole crosshair" value={profile.scale} min={0.5} max={4} step={0.05} suffix="×" onChange={(scale) => save({ scale })} />
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete profile?"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: "profile/delete", id: profile.id });
            onDeleted();
          }}
        >
          “{profile.name}” will be deleted. Your crosshairs are not affected.
        </ConfirmModal>
      )}
    </div>
  );
}

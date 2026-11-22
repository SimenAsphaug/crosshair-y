import { useMemo } from "react";
import { Eye, Crosshair, MousePointerClick, ChevronRight, ChevronLeft, Move, LocateFixed, AlertTriangle } from "lucide-react";
import type { Binding, Keybinds } from "../../../shared/types";
import { sameBinding } from "../../../shared/keys";
import { useApp } from "../state";
import { KeyRecorder } from "../components/KeyRecorder";
import { Thumb } from "../components/Thumb";
import { Notice, Segmented, Empty } from "../components/ui";

type TriggerKey = "toggle" | "next" | "prev" | "toCursor" | "recenter";

const TRIGGERS: { key: TriggerKey; title: string; desc: string; icon: typeof Eye }[] = [
  { key: "toggle", title: "Show / hide crosshair", desc: "Turns the overlay on or off.", icon: Eye },
  { key: "next", title: "Next crosshair", desc: "Cycles forward through your saved crosshairs.", icon: ChevronRight },
  { key: "prev", title: "Previous crosshair", desc: "Cycles backward through your saved crosshairs.", icon: ChevronLeft },
  { key: "toCursor", title: "Move crosshair to mouse", desc: "Places the crosshair where your cursor is (saved per profile).", icon: Move },
  { key: "recenter", title: "Re-center crosshair", desc: "Moves the crosshair back to the center of the screen.", icon: LocateFixed },
];

export function KeybindsPage() {
  const { state, dispatch, runtime } = useApp();
  const k = state.keybinds;
  const set = (patch: Partial<Keybinds>) => dispatch({ type: "keybinds/update", patch });

  // Collect every assigned binding to flag duplicates.
  const all = useMemo(() => {
    const list: { id: string; label: string; b: Binding }[] = [
      ...TRIGGERS.map((t) => ({ id: t.key, label: t.title, b: k[t.key] })),
      { id: "aim", label: "Aim", b: k.aim.mode !== "off" ? k.aim.binding : null },
      { id: "fire", label: "Fire", b: k.fire.binding },
      ...Object.entries(k.designShortcuts).map(([id, b]) => ({ id: `d:${id}`, label: state.designs.find((d) => d.id === id)?.name ?? "Crosshair", b })),
    ];
    return list.filter((x) => x.b);
  }, [k, state.designs]);

  const conflict = (id: string, b: Binding) => {
    if (!b) return null;
    const other = all.find((x) => x.id !== id && sameBinding(x.b, b));
    // Aim/Fire sharing a mouse button with nothing else is fine; flag everything else.
    return other ? other.label : null;
  };

  const Conflict = ({ id, b }: { id: string; b: Binding }) => {
    const c = conflict(id, b);
    return c ? (
      <span className="badge warn" title={`Also used by “${c}”`}>
        <AlertTriangle size={11} /> {c}
      </span>
    ) : null;
  };

  const hookDown = runtime.inputHook !== "ok";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Keybinds</h1>
          <p>Shortcuts work while you're in game. Click a field, then press a key, a combination or a mouse button.</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 18, maxWidth: 940 }}>
        {hookDown && (
          <Notice kind="warn">
            The global input hook couldn't start{runtime.inputHookError ? ` (${runtime.inputHookError})` : ""}. Keyboard shortcuts still work through a
            fallback, but mouse buttons, Aim and Fire won't.
          </Notice>
        )}

        <div className="card">
          <div className="card-head">
            <h3>Actions</h3>
          </div>
          <table className="bind-table">
            <tbody>
              {TRIGGERS.map((t) => (
                <tr key={t.key}>
                  <td>
                    <div className="action">
                      <t.icon size={17} />
                      <div>
                        {t.title}
                        <div className="desc">{t.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ width: 1, whiteSpace: "nowrap" }}>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <Conflict id={t.key} b={k[t.key]} />
                      <KeyRecorder value={k[t.key]} onChange={(b) => set({ [t.key]: b } as Partial<Keybinds>)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Mouse states</h3>
            <span className="sub">Ignored while Crosshair Y itself is focused</span>
          </div>
          <table className="bind-table">
            <tbody>
              <tr>
                <td>
                  <div className="action">
                    <Crosshair size={17} />
                    <div>
                      Aim
                      <div className="desc">What happens while you aim down sights.</div>
                    </div>
                  </div>
                  <div className="row wrap" style={{ marginTop: 10, marginLeft: 27 }}>
                    <select className="select" value={k.aim.mode} onChange={(e) => set({ aim: { ...k.aim, mode: e.target.value as Keybinds["aim"]["mode"] } })}>
                      <option value="off">Do nothing</option>
                      <option value="hide">Hide the crosshair</option>
                      <option value="swap">Switch to another crosshair</option>
                    </select>
                    {k.aim.mode === "swap" && (
                      <select
                        className="select"
                        value={k.aim.swapDesignId ?? ""}
                        onChange={(e) => set({ aim: { ...k.aim, swapDesignId: e.target.value || null } })}
                      >
                        <option value="">Choose a crosshair…</option>
                        {state.designs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {k.aim.mode !== "off" && (
                      <Segmented
                        value={k.aim.behavior}
                        onChange={(behavior) => set({ aim: { ...k.aim, behavior } })}
                        options={[
                          { value: "hold", label: "While held" },
                          { value: "toggle", label: "Toggle" },
                        ]}
                      />
                    )}
                  </div>
                </td>
                <td style={{ width: 1, whiteSpace: "nowrap", verticalAlign: "top" }}>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    {k.aim.mode !== "off" && <Conflict id="aim" b={k.aim.binding} />}
                    <KeyRecorder value={k.aim.binding} onChange={(binding) => set({ aim: { ...k.aim, binding } })} />
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="action">
                    <MousePointerClick size={17} />
                    <div>
                      Fire
                      <div className="desc">Drives bloom and “T-shape while firing” in your designs.</div>
                    </div>
                  </div>
                </td>
                <td style={{ width: 1, whiteSpace: "nowrap" }}>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <KeyRecorder value={k.fire.binding} allowLeftClick onChange={(binding) => set({ fire: { binding } })} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Crosshair shortcuts</h3>
            <span className="sub">Jump straight to a saved crosshair</span>
          </div>
          {state.designs.length === 0 ? (
            <Empty title="No saved crosshairs" />
          ) : (
            <table className="bind-table">
              <tbody>
                {state.designs.map((d) => {
                  const b = k.designShortcuts[d.id] ?? null;
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="action">
                          <span className="card" style={{ display: "grid", placeItems: "center", width: 36, height: 36, flex: "none" }}>
                            <Thumb design={d} size={30} maxScale={2} />
                          </span>
                          <span>{d.name}</span>
                        </div>
                      </td>
                      <td style={{ width: 1, whiteSpace: "nowrap" }}>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <Conflict id={`d:${d.id}`} b={b} />
                          <KeyRecorder value={b} onChange={(binding) => dispatch({ type: "keybinds/designShortcut", id: d.id, binding })} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Github, FileUp, ClipboardPaste } from "lucide-react";
import type { Design, SavedDesign } from "../../../shared/types";
import { defaultDesign, normalizeDesign, toPortable, toSaved, uid } from "../../../shared/design";
import { decodeAnyCode, encodeShareCode } from "../../lib/codes";
import { renderToPng, renderToSvg } from "../../lib/render";
import { submissionJson, submissionUrl, slugify } from "../../lib/community";
import { useApp } from "../state";
import { Modal, Segmented, Notice } from "./ui";
import { Thumb } from "./Thumb";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export function ShareModal({ design, onClose, initialTab = "code" }: { design: Design; onClose: () => void; initialTab?: "code" | "export" | "submit" }) {
  const { toast, state } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [code, setCode] = useState("");
  const [pngScale, setPngScale] = useState("4");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [game, setGame] = useState("");

  useEffect(() => {
    encodeShareCode(design).then(setCode).catch(() => setCode(""));
  }, [design]);

  const fileBase = slugify(design.name);

  const exportPng = async () => {
    const url = renderToPng(design, parseFloat(pngScale));
    const ok = await window.cy.exportFile({
      defaultName: `${fileBase}.png`,
      filters: [{ name: "PNG image", extensions: ["png"] }],
      data: url.split(",")[1],
      base64: true,
    });
    if (ok) toast("PNG exported");
  };
  const exportSvg = async () => {
    const svg = await renderToSvg(design, 1);
    const ok = await window.cy.exportFile({ defaultName: `${fileBase}.svg`, filters: [{ name: "SVG image", extensions: ["svg"] }], data: svg });
    if (ok) toast("SVG exported");
  };
  const exportJson = async () => {
    const ok = await window.cy.exportFile({
      defaultName: `${fileBase}.json`,
      filters: [{ name: "Crosshair Y design", extensions: ["json"] }],
      data: JSON.stringify(toPortable(design), null, 2),
    });
    if (ok) toast("Design exported");
  };

  const tagList = tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);
  const json = submissionJson(design, author, tagList, game.trim() || null);
  const submit = async () => {
    const { url, prefilled } = submissionUrl(state.settings.communityRepo, design, json);
    if (!prefilled) {
      await copyText(json);
      toast("Design is large — JSON copied. Paste it into the GitHub editor.", "info");
    }
    window.cy.openExternal(url);
  };

  return (
    <Modal title={`Share “${design.name}”`} onClose={onClose} wide>
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="card" style={{ padding: 8, flex: "none" }}>
          <Thumb design={design} size={120} />
        </div>
        <div className="grow" style={{ display: "grid", gap: 14 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "code", label: "Share code" },
              { value: "export", label: "Export file" },
              { value: "submit", label: "Submit to community" },
            ]}
          />
          {tab === "code" && (
            <>
              <div className="muted">Anyone with Crosshair Y can paste this code under Crosshairs → Import.</div>
              <textarea className="input" rows={4} readOnly value={code} onFocus={(e) => e.target.select()} />
              <div className="row">
                <button
                  className="btn primary"
                  disabled={!code}
                  onClick={async () => {
                    await copyText(code);
                    toast("Share code copied");
                  }}
                >
                  <Copy size={15} /> Copy code
                </button>
                <span className="faint">{code.length} characters</span>
              </div>
            </>
          )}
          {tab === "export" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="row wrap">
                <button className="btn primary" onClick={exportPng}>
                  <Download size={15} /> PNG
                </button>
                <Segmented
                  value={pngScale}
                  onChange={setPngScale}
                  options={["1", "2", "4", "8"].map((s) => ({ value: s, label: `${s}×` }))}
                />
              </div>
              <div className="row wrap">
                <button className="btn" onClick={exportSvg}>
                  <Download size={15} /> SVG
                </button>
                <button className="btn" onClick={exportJson}>
                  <Download size={15} /> Design file (.json)
                </button>
              </div>
              <div className="faint">PNG and SVG are images you can use elsewhere. The .json file keeps every setting and can be imported again.</div>
            </div>
          )}
          {tab === "submit" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="muted">
                Community crosshairs live in <span className="mono">{state.settings.communityRepo}</span> on GitHub. This opens GitHub with your design
                filled in. Sign in, then propose the file. It shows up for everyone once it's merged.
              </div>
              <div className="two-col">
                <div className="field">
                  <label>Your name</label>
                  <input className="input" value={author} maxLength={40} placeholder="anonymous" onChange={(e) => setAuthor(e.target.value)} />
                </div>
                <div className="field">
                  <label>Game (optional)</label>
                  <input className="input" value={game} maxLength={40} placeholder="e.g. Valorant" onChange={(e) => setGame(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Tags (comma separated)</label>
                <input className="input" value={tags} placeholder="tactical, small, dot" onChange={(e) => setTags(e.target.value)} />
              </div>
              <div className="row">
                <button className="btn primary" onClick={submit}>
                  <Github size={15} /> Open on GitHub
                </button>
                <button
                  className="btn"
                  onClick={async () => {
                    await copyText(json);
                    toast("Submission JSON copied");
                  }}
                >
                  <Copy size={15} /> Copy JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { dispatch, toast, state } = useApp();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Design | null>(null);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      setError("");
      return;
    }
    let alive = true;
    decodeAnyCode(text)
      .then((r) => {
        if (!alive) return;
        setPreview(r.design);
        setSource(r.source === "valorant" ? "Valorant code" : r.source === "json" ? "Design JSON" : "Crosshair Y code");
        setName(r.design.name);
        setError("");
      })
      .catch((e) => {
        if (!alive) return;
        setPreview(null);
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [text]);

  const fromFile = async () => {
    try {
      const f = await window.cy.importFile("design");
      if (!f) return;
      if (f.dataUrl) {
        const d = defaultDesign(f.name);
        d.lines.enabled = false;
        d.outline.enabled = false;
        d.image = { enabled: true, src: f.dataUrl, size: 48, opacity: 1, rotation: 0 };
        setPreview(normalizeDesign(d, false));
        setSource("Image");
        setName(f.name);
        setText("");
        setError("");
      } else if (f.text) {
        setText(f.text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = (activate: boolean) => {
    if (!preview) return;
    const saved: SavedDesign = toSaved({ ...preview, id: uid("d_"), name: name.trim() || preview.name }, "import");
    dispatch({ type: "design/save", design: saved });
    if (activate) dispatch({ type: "design/activate", id: saved.id });
    toast(activate ? `Imported and equipped “${saved.name}”` : `Imported “${saved.name}”`);
    onClose();
  };

  const count = state.designs.length;
  return (
    <Modal
      title="Import crosshair"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={!preview} onClick={() => save(false)}>
            Save to library
          </button>
          <button className="btn primary" disabled={!preview} onClick={() => save(true)}>
            Save & use
          </button>
        </>
      }
    >
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="grow" style={{ display: "grid", gap: 10 }}>
          <div className="field">
            <label>Paste a code</label>
            <textarea
              className="input"
              rows={5}
              autoFocus
              placeholder="CY1-…  or a Valorant code like 0;P;c;5;h;0;0l;4;0o;2;0a;1;0f;0;1b;0"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="row wrap">
            <button
              className="btn"
              onClick={async () => {
                try {
                  setText(await navigator.clipboard.readText());
                } catch {
                  toast("Couldn't read the clipboard", "error");
                }
              }}
            >
              <ClipboardPaste size={15} /> Paste from clipboard
            </button>
            <button className="btn" onClick={fromFile}>
              <FileUp size={15} /> Open file (.json, .png, .svg)
            </button>
          </div>
          {error && <Notice kind="warn">{error}</Notice>}
        </div>
        <div className="card" style={{ width: 180, flex: "none", padding: 10, display: "grid", gap: 8, justifyItems: "center" }}>
          {preview ? (
            <>
              <Thumb design={preview} size={140} />
              <span className="badge">{source}</span>
              <input className="input" style={{ width: "100%" }} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </>
          ) : (
            <div className="faint" style={{ padding: "50px 8px", textAlign: "center" }}>
              Preview appears here
            </div>
          )}
        </div>
      </div>
      <div className="faint">Your library has {count} crosshair{count === 1 ? "" : "s"}.</div>
    </Modal>
  );
}

/** Saves a built-in/community design into the library once (stable id), returns its id. */
export function useAdopt() {
  const { state, dispatch } = useApp();
  return useMemo(
    () => (design: Design, origin: "builtin" | "community") => {
      const stableId = (origin === "builtin" ? "bi_" : "cm_") + design.id.replace(/^(builtin|community):/, "");
      if (!state.designs.some((d) => d.id === stableId)) {
        dispatch({ type: "design/save", design: toSaved({ ...design, id: stableId }, origin) });
      }
      return stableId;
    },
    [state.designs, dispatch],
  );
}

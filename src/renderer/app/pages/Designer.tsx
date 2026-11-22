import { useCallback, useEffect, useRef, useState } from "react";
import {
  Undo2,
  Redo2,
  Save,
  CopyPlus,
  Share2,
  Shuffle,
  FilePlus2,
  Minus,
  CircleDot,
  Square,
  Circle,
  Zap,
  Grid3x3,
  Image as ImageIcon,
  MousePointerClick,
  Eye,
  EyeOff,
  Upload,
  Trash2,
} from "lucide-react";
import type { Design } from "../../../shared/types";
import { defaultDesign, normalizeDesign, toSaved, uid, hasVisibleContent } from "../../../shared/design";
import { useApp } from "../state";
import { ColorField, Section, Segmented, Slider, Notice } from "../components/ui";
import { PixelEditor } from "../components/PixelEditor";
import { ShareModal } from "../components/ShareImport";
import { onImageLoaded, renderDesign } from "../../lib/render";
import { randomDesign } from "../../lib/random";

// Survives page switches so an unsaved draft isn't lost.
let session: { draft: Design; savedId: string | null; dirty: boolean } | null = null;
let consumedEditing: unknown = null;

function useHistory(initial: Design) {
  const [present, setPresent] = useState(initial);
  const past = useRef<Design[]>([]);
  const future = useRef<Design[]>([]);
  const lastPush = useRef(0);

  const set = useCallback((next: Design | ((d: Design) => Design), coalesce = true) => {
    setPresent((cur) => {
      const value = typeof next === "function" ? (next as (d: Design) => Design)(cur) : next;
      const now = performance.now();
      if (!coalesce || now - lastPush.current > 450) {
        past.current.push(cur);
        if (past.current.length > 100) past.current.shift();
      }
      lastPush.current = now;
      future.current = [];
      return value;
    });
  }, []);
  const reset = useCallback((d: Design) => {
    past.current = [];
    future.current = [];
    setPresent(d);
  }, []);
  const undo = useCallback(() => {
    setPresent((cur) => {
      const prev = past.current.pop();
      if (!prev) return cur;
      future.current.push(cur);
      lastPush.current = 0;
      return prev;
    });
  }, []);
  const redo = useCallback(() => {
    setPresent((cur) => {
      const next = future.current.pop();
      if (!next) return cur;
      past.current.push(cur);
      lastPush.current = 0;
      return next;
    });
  }, []);
  return { present, set, reset, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

type Bg = "dark" | "light" | "scene";

function Stage({ design, zoom, bg, firing }: { design: Design; zoom: number; bg: Bg; firing: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const spread = useRef(0);
  const raf = useRef(0);
  const [, bump] = useState(0);
  useEffect(() => onImageLoaded(() => bump((n) => n + 1)), []);

  useEffect(() => {
    const canvas = ref.current!;
    let last = 0;
    const frame = (now: number) => {
      const dt = last ? now - last : 16;
      last = now;
      const b = design.bloom;
      const target = firing && b.enabled ? b.amount : 0;
      if (!b.enabled) spread.current = 0;
      else if (spread.current !== target) {
        const dur = target > spread.current ? b.attack : b.recovery;
        const step = dur <= 0 ? Infinity : (b.amount / dur) * dt;
        spread.current = target > spread.current ? Math.min(target, spread.current + step) : Math.max(target, spread.current - step);
      }
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Physical-pixel preview: 1× zoom equals in-game size.
      renderDesign(ctx, design, { cx: Math.round(w / 2), cy: Math.round(h / 2), scale: zoom, spread: spread.current, firing, snap: true });
      if (spread.current !== target) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => requestAnimationFrame(frame));
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
    };
  });

  return (
    <div className={`stage stage-bg-${bg}`}>
      <canvas ref={ref} />
    </div>
  );
}

export function DesignerPage() {
  const { editing, state, dispatch, toast, activeDesign, effectiveProfile } = useApp();

  const [initial] = useState(() => {
    if (editing && editing !== consumedEditing) {
      consumedEditing = editing;
      session = { draft: normalizeDesign(editing.design), savedId: editing.savedId, dirty: false };
    } else if (!session) {
      session = activeDesign ? { draft: normalizeDesign(activeDesign), savedId: activeDesign.id, dirty: false } : { draft: defaultDesign(), savedId: null, dirty: false };
    }
    return session;
  });

  const h = useHistory(initial.draft);
  const d = h.present;
  const [savedId, setSavedId] = useState<string | null>(initial.savedId);
  const [dirty, setDirty] = useState(initial.dirty);
  const [zoom, setZoom] = useState(() => parseFloat(localStorage.getItem("designer-zoom") ?? "4"));
  const [livePreview, setLivePreview] = useState(true);
  const [firing, setFiring] = useState(false);
  const [sharing, setSharing] = useState(false);
  const bg = state.settings.previewBackground;

  // A new "editing" request from elsewhere (library → edit) replaces the draft.
  useEffect(() => {
    if (editing && editing !== consumedEditing) {
      consumedEditing = editing;
      h.reset(normalizeDesign(editing.design));
      setSavedId(editing.savedId);
      setDirty(false);
    }
  }, [editing, h]);

  useEffect(() => {
    session = { draft: d, savedId, dirty };
  }, [d, savedId, dirty]);

  useEffect(() => {
    try {
      localStorage.setItem("designer-zoom", String(zoom));
    } catch {}
  }, [zoom]);

  // Live preview on the real overlay.
  useEffect(() => {
    window.cy.previewDesign(livePreview ? d : null);
  }, [d, livePreview]);
  useEffect(() => () => window.cy.previewDesign(null), []);

  const update = <K extends keyof Design>(key: K, patch: Partial<Design[K]> | Design[K]) => {
    h.set((cur) => {
      const curVal = cur[key];
      const next = typeof curVal === "object" && curVal !== null ? { ...(curVal as object), ...(patch as object) } : patch;
      return { ...cur, [key]: next } as Design;
    });
    setDirty(true);
  };

  const existing = savedId ? state.designs.find((x) => x.id === savedId) : undefined;

  const save = useCallback(
    (asNew = false) => {
      if (!asNew && existing) {
        dispatch({ type: "design/save", design: { ...existing, ...d, id: existing.id } });
        toast(`Saved “${d.name}”`);
      } else {
        const id = uid("d_");
        const name = asNew && existing ? `${d.name} copy` : d.name;
        dispatch({ type: "design/save", design: toSaved({ ...d, id, name }, "user") });
        setSavedId(id);
        if (asNew) h.set({ ...d, name }, false);
        toast(`Saved “${name}” to your library`);
      }
      setDirty(false);
    },
    [existing, d, dispatch, toast, h],
  );

  const saveAndUse = () => {
    const id = existing && savedId ? savedId : uid("d_");
    if (existing) dispatch({ type: "design/save", design: { ...existing, ...d, id } });
    else dispatch({ type: "design/save", design: toSaved({ ...d, id }, "user") });
    dispatch({ type: "design/activate", id });
    setSavedId(id);
    setDirty(false);
    toast(`Equipped “${d.name}”`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save(false);
      } else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? h.redo() : h.undo();
      } else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        h.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, h]);

  const newDesign = (design: Design) => {
    h.reset(design);
    setSavedId(null);
    setDirty(true);
  };

  const pickImage = async () => {
    try {
      const f = await window.cy.importFile("image");
      if (f?.dataUrl) {
        update("image", { enabled: true, src: f.dataUrl });
        if (d.name === "New crosshair") update("name", f.name);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const isActive = !!savedId && activeDesign?.id === savedId;

  return (
    <div className="designer">
      <div className="designer-stage">
        <div className="designer-toolbar">
          <input className="input name-input" value={d.name} maxLength={60} onChange={(e) => update("name", e.target.value)} aria-label="Crosshair name" />
          {dirty ? <span className="badge warn">Unsaved</span> : existing ? <span className="badge ok">Saved</span> : null}
          {isActive && <span className="badge accent">In use</span>}
          <div className="sep" />
          <button className="btn ghost icon" title="Undo (Ctrl+Z)" onClick={h.undo} disabled={!h.canUndo}>
            <Undo2 size={16} />
          </button>
          <button className="btn ghost icon" title="Redo (Ctrl+Y)" onClick={h.redo} disabled={!h.canRedo}>
            <Redo2 size={16} />
          </button>
          <div className="sep" />
          <button className="btn ghost" title="Start a new crosshair" onClick={() => newDesign(defaultDesign())}>
            <FilePlus2 size={15} /> New
          </button>
          <button className="btn ghost" title="Random crosshair" onClick={() => newDesign(randomDesign())}>
            <Shuffle size={15} /> Random
          </button>
          <div className="grow" />
          <button className="btn" onClick={() => setSharing(true)}>
            <Share2 size={15} /> Share
          </button>
          {existing && (
            <button className="btn" title="Save as a new crosshair" onClick={() => save(true)}>
              <CopyPlus size={15} /> Save copy
            </button>
          )}
          <button className="btn" onClick={() => save(false)} title="Save (Ctrl+S)">
            <Save size={15} /> Save
          </button>
          <button className="btn primary" onClick={saveAndUse} title={`Save and use for “${effectiveProfile?.name}”`}>
            Save & use
          </button>
        </div>

        <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
          <Stage design={d} zoom={zoom} bg={bg} firing={firing} />
          {!hasVisibleContent(d) && (
            <div className="stage-tag">
              <Notice>Everything is turned off. Enable a layer on the right.</Notice>
            </div>
          )}
          <div className="stage-footer">
            <Segmented
              value={String(zoom)}
              onChange={(v) => setZoom(parseFloat(v))}
              options={["1", "2", "4", "8"].map((z) => ({ value: z, label: `${z}×`, title: z === "1" ? "Actual in-game size" : `${z}× zoom` }))}
            />
            <Segmented
              value={bg}
              onChange={(v) => dispatch({ type: "settings/update", patch: { previewBackground: v } })}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "scene", label: "Scene" },
              ]}
            />
            <div className="spacer" />
            <button
              className={`btn ${livePreview ? "primary" : ""}`}
              title="Show this draft on the real overlay while you edit"
              onClick={() => setLivePreview(!livePreview)}
            >
              {livePreview ? <Eye size={15} /> : <EyeOff size={15} />} Preview on screen
            </button>
            <button
              className={`btn ${firing ? "primary" : ""}`}
              title="Hold to preview bloom and T-shape while firing"
              onPointerDown={() => setFiring(true)}
              onPointerUp={() => setFiring(false)}
              onPointerLeave={() => setFiring(false)}
            >
              <MousePointerClick size={15} /> Hold to fire
            </button>
          </div>
        </div>
      </div>

      <aside className="designer-panel">
        <Section title="Lines" icon={<Minus size={15} />} enabled={d.lines.enabled} onToggle={(v) => update("lines", { enabled: v })}>
          <ColorField value={d.lines.color} onChange={(color) => update("lines", { color })} />
          <Slider label="Opacity" value={d.lines.opacity} min={0} max={1} step={0.01} onChange={(opacity) => update("lines", { opacity })} />
          <Slider label="Length" value={d.lines.length} min={0} max={60} step={0.5} suffix="px" onChange={(length) => update("lines", { length })} />
          <Slider label="Thickness" value={d.lines.thickness} min={0.5} max={12} step={0.5} suffix="px" onChange={(thickness) => update("lines", { thickness })} />
          <Slider label="Gap" hint="distance from the center" value={d.lines.gap} min={-10} max={40} step={0.5} suffix="px" onChange={(gap) => update("lines", { gap })} />
          <Slider label="Blur" value={d.lines.blur} min={0} max={8} step={0.1} suffix="px" onChange={(blur) => update("lines", { blur })} />
          <Slider label="Rotation" value={d.lines.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => update("lines", { rotation })} />
        </Section>

        <Section title="Center dot" icon={<CircleDot size={15} />} enabled={d.dot.enabled} onToggle={(v) => update("dot", { enabled: v })} defaultOpen={d.dot.enabled}>
          <ColorField value={d.dot.color} onChange={(color) => update("dot", { color })} />
          <div className="field">
            <label>Shape</label>
            <Segmented
              value={d.dot.shape}
              onChange={(shape) => update("dot", { shape })}
              options={[
                { value: "square", label: <span className="row" style={{ gap: 6 }}><Square size={13} /> Square</span> },
                { value: "circle", label: <span className="row" style={{ gap: 6 }}><Circle size={13} /> Round</span> },
              ]}
            />
          </div>
          <Slider label="Opacity" value={d.dot.opacity} min={0} max={1} step={0.01} onChange={(opacity) => update("dot", { opacity })} />
          <Slider label="Size" value={d.dot.size} min={0.5} max={20} step={0.5} suffix="px" onChange={(size) => update("dot", { size })} />
          <Slider label="Blur" value={d.dot.blur} min={0} max={8} step={0.1} suffix="px" onChange={(blur) => update("dot", { blur })} />
        </Section>

        <Section title="Outline" icon={<Square size={15} />} enabled={d.outline.enabled} onToggle={(v) => update("outline", { enabled: v })} defaultOpen={d.outline.enabled}>
          <ColorField value={d.outline.color} onChange={(color) => update("outline", { color })} />
          <Slider label="Opacity" value={d.outline.opacity} min={0} max={1} step={0.01} onChange={(opacity) => update("outline", { opacity })} />
          <Slider label="Thickness" value={d.outline.thickness} min={0.5} max={6} step={0.5} suffix="px" onChange={(thickness) => update("outline", { thickness })} />
          <Slider label="Blur" value={d.outline.blur} min={0} max={8} step={0.1} suffix="px" onChange={(blur) => update("outline", { blur })} />
        </Section>

        <Section title="Circle" icon={<Circle size={15} />} enabled={d.circle.enabled} onToggle={(v) => update("circle", { enabled: v })} defaultOpen={d.circle.enabled}>
          <ColorField value={d.circle.color} onChange={(color) => update("circle", { color })} />
          <Slider label="Opacity" value={d.circle.opacity} min={0} max={1} step={0.01} onChange={(opacity) => update("circle", { opacity })} />
          <Slider label="Radius" value={d.circle.radius} min={1} max={80} step={0.5} suffix="px" onChange={(radius) => update("circle", { radius })} />
          <Slider label="Thickness" value={d.circle.thickness} min={0.5} max={10} step={0.5} suffix="px" onChange={(thickness) => update("circle", { thickness })} />
          <Slider label="Blur" value={d.circle.blur} min={0} max={8} step={0.1} suffix="px" onChange={(blur) => update("circle", { blur })} />
        </Section>

        <Section title="Firing behavior" icon={<Zap size={15} />}>
          <div className="field">
            <label>T-shape (hide the top line)</label>
            <Segmented
              value={d.tShape}
              onChange={(tShape) => update("tShape", tShape)}
              options={[
                { value: "never", label: "Never" },
                { value: "always", label: "Always" },
                { value: "firing", label: "While firing" },
              ]}
            />
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>Bloom</div>
              <div className="faint" style={{ fontSize: 12 }}>
                Lines spread apart while you hold Fire.
              </div>
            </div>
            <button className={`toggle ${d.bloom.enabled ? "on" : ""}`} onClick={() => update("bloom", { enabled: !d.bloom.enabled })} aria-label="Enable bloom" />
          </div>
          {d.bloom.enabled && (
            <>
              <Slider label="Spread" value={d.bloom.amount} min={0} max={40} step={0.5} suffix="px" onChange={(amount) => update("bloom", { amount })} />
              <Slider label="Spread speed" value={d.bloom.attack} min={0} max={600} step={10} suffix="ms" onChange={(attack) => update("bloom", { attack })} />
              <Slider label="Recovery" value={d.bloom.recovery} min={0} max={1500} step={10} suffix="ms" onChange={(recovery) => update("bloom", { recovery })} />
            </>
          )}
          {(d.bloom.enabled || d.tShape === "firing") && (
            <div className="faint" style={{ fontSize: 12 }}>
              Fire is set under Keybinds (default: left click). Use “Hold to fire” to preview it.
            </div>
          )}
        </Section>

        <Section title="Drawing" icon={<Grid3x3 size={15} />} enabled={d.pixels.enabled} onToggle={(v) => update("pixels", { enabled: v })} defaultOpen={d.pixels.enabled}>
          <PixelEditor value={d.pixels} onChange={(p) => update("pixels", p)} />
        </Section>

        <Section title="Image" icon={<ImageIcon size={15} />} enabled={d.image.enabled} onToggle={(v) => (v && !d.image.src ? pickImage() : update("image", { enabled: v }))} defaultOpen={d.image.enabled}>
          <div className="row">
            <button className="btn" onClick={pickImage}>
              <Upload size={15} /> {d.image.src ? "Replace image" : "Choose image"}
            </button>
            {d.image.src && (
              <button className="btn ghost danger" onClick={() => update("image", { enabled: false, src: "" })}>
                <Trash2 size={15} /> Remove
              </button>
            )}
          </div>
          <Slider label="Size" value={d.image.size} min={4} max={256} step={1} suffix="px" onChange={(size) => update("image", { size })} />
          <Slider label="Opacity" value={d.image.opacity} min={0} max={1} step={0.01} onChange={(opacity) => update("image", { opacity })} />
          <Slider label="Rotation" value={d.image.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => update("image", { rotation })} />
          <div className="faint" style={{ fontSize: 12 }}>PNG, SVG, JPG, WebP or GIF up to 1.5 MB. The other layers draw on top of the image.</div>
        </Section>
      </aside>
      {sharing && <ShareModal design={d} onClose={() => setSharing(false)} />}
    </div>
  );
}

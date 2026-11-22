import { ReactNode, useEffect, useLayoutEffect, useRef, useState, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X, Info, AlertTriangle } from "lucide-react";

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const round = (v: number, step: number) => {
  const decimals = step < 1 ? Math.min(3, String(step).split(".")[1]?.length ?? 2) : 0;
  return Number(v.toFixed(decimals));
};

/** Slider with a synced numeric input. `onChange` fires continuously while dragging. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  hint,
  disabled,
  allowBeyond = false,
}: {
  label?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
  allowBeyond?: boolean;
}) {
  const [text, setText] = useState(String(round(value, step)));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(round(value, step)));
  }, [value, step]);
  const fill = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) {
      setText(String(round(value, step)));
      return;
    }
    const v = allowBeyond ? n : Math.min(max, Math.max(min, n));
    onChange(round(v, step));
  };
  return (
    <div className="field">
      {label !== undefined && (
        <div className="field-label">
          {label}
          {hint && <span className="hint">{hint}</span>}
        </div>
      )}
      <div className="slider-row">
        <input
          className="range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          disabled={disabled}
          style={{ "--fill": `${fill}%` } as CSSProperties}
          onChange={(e) => onChange(round(parseFloat(e.target.value), step))}
        />
        <div className="row" style={{ gap: 4 }}>
          <input
            className="num"
            type="number"
            step={step}
            value={text}
            disabled={disabled}
            onFocus={() => (focused.current = true)}
            onChange={(e) => {
              setText(e.target.value);
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n) && (allowBeyond || (n >= min && n <= max))) onChange(round(n, step));
            }}
            onBlur={(e) => {
              focused.current = false;
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          {suffix && <span className="faint" style={{ fontSize: 11.5 }}>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

const PRESET_COLORS = ["#ffffff", "#00ff88", "#00ffff", "#2d9bff", "#ff44cc", "#ff3355", "#ffee00", "#000000"];

export function ColorField({ value, onChange, presets = PRESET_COLORS }: { value: string; onChange: (v: string) => void; presets?: string[] }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="color-field">
      <label className="swatch-btn" style={{ background: value }} title="Pick a color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <input
        className="input hex-input"
        value={text}
        spellCheck={false}
        maxLength={7}
        onChange={(e) => {
          const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value;
          setText(v);
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
        }}
        onBlur={() => setText(value)}
      />
      <div className="swatches">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${c === value ? "active" : ""}`}
            style={{ background: c }}
            title={c}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

export function Section({
  title,
  icon,
  enabled,
  onToggle,
  defaultOpen = true,
  children,
  extra,
}: {
  title: string;
  icon?: ReactNode;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const on = enabled ?? true;
  return (
    <div className="section">
      <div className={`section-head ${open ? "open" : ""} ${on ? "on" : ""}`} role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}>
        {icon && <span className="icon-wrap">{icon}</span>}
        <span>{title}</span>
        {extra}
        {onToggle && (
          <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: "auto", display: "flex" }}>
            <Toggle on={on} onChange={onToggle} label={`Enable ${title}`} />
          </span>
        )}
        <ChevronRight size={16} className="chev" style={onToggle ? { marginLeft: 6 } : undefined} />
      </div>
      {open && <div className={`section-body ${onToggle && !on ? "disabled" : ""}`}>{children}</div>}
    </div>
  );
}

export function SettingRow({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="setting">
      <div className="text">
        <div className="title">{title}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      <div className="control">{children}</div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface MenuEntry {
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  separator?: boolean;
  heading?: string;
}

/** Popup menu anchored to a point (from a click event). */
export function Menu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.min(at.x, window.innerWidth - r.width - 8),
      y: at.y + r.height > window.innerHeight - 8 ? Math.max(8, at.y - r.height) : at.y,
    });
  }, [at]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  return createPortal(
    <div className="menu" ref={ref} style={{ left: pos.x, top: pos.y }}>
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="menu-sep" />
        ) : it.heading ? (
          <div key={i} className="menu-label">
            {it.heading}
          </div>
        ) : (
          <button
            key={i}
            className={`menu-item ${it.danger ? "danger" : ""}`}
            onClick={() => {
              onClose();
              it.onClick?.();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

export function useMenu() {
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; items: MenuEntry[] } | null>(null);
  const open = (e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: MenuEntry[]) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    setMenu({ at: { x: e.clientX, y: e.clientY }, items });
  };
  const openBelow = (el: HTMLElement, items: MenuEntry[]) => {
    const r = el.getBoundingClientRect();
    setMenu({ at: { x: r.left, y: r.bottom + 4 }, items });
  };
  const node = menu ? <Menu at={menu.at} items={menu.items} onClose={() => setMenu(null)} /> : null;
  return { open, openBelow, node };
}

export function Notice({ kind = "info", children }: { kind?: "info" | "warn"; children: ReactNode }) {
  return (
    <div className={`notice ${kind}`}>
      {kind === "warn" ? <AlertTriangle size={16} /> : <Info size={16} />}
      <div>{children}</div>
    </div>
  );
}

export function Kbd({ parts }: { parts: string[] }) {
  return (
    <span className="kbd-group">
      {parts.map((p, i) => (
        <span key={i} className="row" style={{ gap: 4 }}>
          {i > 0 && <span className="kbd-plus">+</span>}
          <span className="kbd">{p}</span>
        </span>
      ))}
    </span>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}

/** Small prompt dialog (Electron has no window.prompt). */
export function PromptModal({
  title,
  label,
  initial = "",
  confirm = "Save",
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initial?: string;
  confirm?: string;
  onSubmit: (v: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const submit = () => {
    if (v.trim()) {
      onSubmit(v.trim());
      onClose();
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={!v.trim()}>
            {confirm}
          </button>
        </>
      }
    >
      <div className="field">
        <label>{label}</label>
        <input className="input" autoFocus value={v} maxLength={60} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
    </Modal>
  );
}

export function ConfirmModal({
  title,
  children,
  confirm = "Delete",
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirm?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "danger solid" : "primary"}`}
            autoFocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirm}
          </button>
        </>
      }
    >
      <div className="muted">{children}</div>
    </Modal>
  );
}

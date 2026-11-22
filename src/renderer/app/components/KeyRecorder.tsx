import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Binding } from "../../../shared/types";
import { bindingParts, domMouseButton, MODIFIER_CODES } from "../../../shared/keys";
import { Kbd } from "./ui";

/**
 * Click to record. Press a key/combination or a mouse button. Esc cancels.
 * `allowMouse` enables mouse buttons; left click is only accepted for hold actions.
 */
export function KeyRecorder({
  value,
  onChange,
  allowMouse = true,
  allowLeftClick = false,
  placeholder = "Unbound",
}: {
  value: Binding;
  onChange: (b: Binding) => void;
  allowMouse?: boolean;
  allowLeftClick?: boolean;
  placeholder?: string;
}) {
  const [recording, setRecording] = useState(false);
  const pendingMod = useRef<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const armedAt = useRef(0);

  useEffect(() => {
    if (!recording) return;
    window.cy.setRecordingInput(true);
    armedAt.current = performance.now();

    const finish = (b: Binding | undefined) => {
      setRecording(false);
      if (b !== undefined) onChange(b);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (e.code === "Escape") return finish(undefined);
      if (MODIFIER_CODES.has(e.code)) {
        pendingMod.current = e.code;
        return;
      }
      pendingMod.current = null;
      finish({ device: "keyboard", code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      // A modifier pressed and released on its own binds the modifier itself.
      if (pendingMod.current && pendingMod.current === e.code) {
        finish({ device: "keyboard", code: e.code, ctrl: false, alt: false, shift: false, meta: false });
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      // Ignore the click that started recording.
      if (performance.now() - armedAt.current < 150) return;
      const button = domMouseButton(e.button);
      const inside = ref.current?.contains(e.target as Node);
      // Left click binds only when clicked on the recorder itself; elsewhere it cancels.
      if (!allowMouse || (button === 1 && (!allowLeftClick || !inside))) {
        if (!inside) finish(undefined);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      finish({ device: "mouse", button });
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onBlur = () => finish(undefined);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("contextmenu", onContext, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.cy.setRecordingInput(false);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("contextmenu", onContext, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [recording, allowMouse, allowLeftClick, onChange]);

  return (
    <div
      ref={ref}
      className={`recorder ${recording ? "recording" : ""}`}
      role="button"
      tabIndex={0}
      title="Click, then press a key or mouse button. Esc cancels."
      onClick={() => !recording && setRecording(true)}
      onKeyDown={(e) => !recording && e.key === "Enter" && setRecording(true)}
    >
      {recording ? (
        <span className="placeholder" style={{ color: "var(--accent)" }}>
          Press a key{allowMouse ? " or mouse button" : ""}…
        </span>
      ) : value ? (
        <Kbd parts={bindingParts(value)} />
      ) : (
        <span className="placeholder">{placeholder}</span>
      )}
      {!recording && value && (
        <button
          className="btn ghost icon sm clear"
          title="Clear"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

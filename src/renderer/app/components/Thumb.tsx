import { useEffect, useRef, useState } from "react";
import type { Design } from "../../../shared/types";
import { fitScale, onImageLoaded, renderDesign } from "../../lib/render";

/** Canvas preview of a design, fitted into a square of `size` CSS px. */
export function Thumb({ design, size = 96, maxScale = 3 }: { design: Design; size?: number; maxScale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [, bump] = useState(0);
  useEffect(() => onImageLoaded(() => bump((n) => n + 1)), []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    if (c.width !== px) {
      c.width = px;
      c.height = px;
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    const scale = fitScale(design, px, 0.25, maxScale * dpr);
    renderDesign(ctx, design, { cx: px / 2, cy: px / 2, scale, snap: true });
  });
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

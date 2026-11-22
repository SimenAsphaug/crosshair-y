import { useEffect, useRef, useState } from "react";
import { Pencil, Eraser, PaintBucket, FlipHorizontal2, FlipVertical2, Trash2 } from "lucide-react";
import type { PixelLayer } from "../../../shared/types";
import { emptyCells } from "../../../shared/design";
import { ColorField, Segmented, Slider } from "./ui";

type Tool = "draw" | "erase" | "fill";
const GRID_SIZES = [9, 15, 21, 31, 41];

function resizeCells(p: PixelLayer, grid: number): string[] {
  const out = emptyCells(grid);
  const off = Math.floor((grid - p.grid) / 2);
  for (let y = 0; y < p.grid; y++) {
    for (let x = 0; x < p.grid; x++) {
      const nx = x + off, ny = y + off;
      if (nx >= 0 && ny >= 0 && nx < grid && ny < grid) out[ny * grid + nx] = p.cells[y * p.grid + x];
    }
  }
  return out;
}

export function PixelEditor({ value, onChange }: { value: PixelLayer; onChange: (p: PixelLayer) => void }) {
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ffffff");
  const [mirrorX, setMirrorX] = useState(true);
  const [mirrorY, setMirrorY] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef<null | string>(null);
  const cellsRef = useRef(value.cells);
  cellsRef.current = value.cells;

  const g = value.grid;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const px = 12;
    c.width = g * px;
    c.height = g * px;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    value.cells.forEach((col, i) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect((i % g) * px, Math.floor(i / g) * px, px, px);
    });
    ctx.strokeStyle = "rgba(127,127,127,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < g; i++) {
      ctx.moveTo(i * px + 0.5, 0);
      ctx.lineTo(i * px + 0.5, c.height);
      ctx.moveTo(0, i * px + 0.5);
      ctx.lineTo(c.width, i * px + 0.5);
    }
    ctx.stroke();
    // Center guide
    const mid = Math.floor(g / 2);
    ctx.strokeStyle = "rgba(45,212,191,0.55)";
    ctx.strokeRect(mid * px + 0.5, mid * px + 0.5, px - 1, px - 1);
  }, [value.cells, g]);

  const cellAt = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * g);
    const y = Math.floor(((e.clientY - r.top) / r.height) * g);
    if (x < 0 || y < 0 || x >= g || y >= g) return null;
    return { x, y };
  };

  const paint = (x: number, y: number, col: string) => {
    const cells = [...cellsRef.current];
    const pts = new Set<number>([y * g + x]);
    if (mirrorX) pts.add(y * g + (g - 1 - x));
    if (mirrorY) pts.add((g - 1 - y) * g + x);
    if (mirrorX && mirrorY) pts.add((g - 1 - y) * g + (g - 1 - x));
    let changed = false;
    pts.forEach((i) => {
      if (cells[i] !== col) {
        cells[i] = col;
        changed = true;
      }
    });
    if (changed) {
      cellsRef.current = cells;
      onChange({ ...value, enabled: true, cells });
    }
  };

  const fill = (x: number, y: number) => {
    const cells = [...cellsRef.current];
    const target = cells[y * g + x];
    if (target === color) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      const i = cy * g + cx;
      if (cx < 0 || cy < 0 || cx >= g || cy >= g || cells[i] !== target) continue;
      cells[i] = color;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    onChange({ ...value, enabled: true, cells });
  };

  return (
    <div className="pixel-editor">
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <Segmented
          value={tool}
          onChange={setTool}
          options={[
            { value: "draw", label: <Pencil size={14} />, title: "Draw (right-click erases)" },
            { value: "erase", label: <Eraser size={14} />, title: "Erase" },
            { value: "fill", label: <PaintBucket size={14} />, title: "Fill" },
          ]}
        />
        <div className="row" style={{ gap: 4 }}>
          <button className={`btn icon sm ${mirrorX ? "primary" : ""}`} title="Mirror horizontally" onClick={() => setMirrorX(!mirrorX)}>
            <FlipHorizontal2 size={14} />
          </button>
          <button className={`btn icon sm ${mirrorY ? "primary" : ""}`} title="Mirror vertically" onClick={() => setMirrorY(!mirrorY)}>
            <FlipVertical2 size={14} />
          </button>
          <button className="btn icon sm" title="Clear drawing" onClick={() => onChange({ ...value, cells: emptyCells(g) })}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div
        className="pixel-grid"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          const c = cellAt(e);
          if (!c) return;
          (e.target as Element).setPointerCapture(e.pointerId);
          if (tool === "fill" && e.button === 0) return fill(c.x, c.y);
          const col = e.button === 2 || tool === "erase" ? "" : color;
          painting.current = col;
          paint(c.x, c.y, col);
        }}
        onPointerMove={(e) => {
          if (painting.current === null) return;
          const c = cellAt(e);
          if (c) paint(c.x, c.y, painting.current);
        }}
        onPointerUp={() => (painting.current = null)}
        onPointerCancel={() => (painting.current = null)}
      >
        <canvas ref={canvasRef} />
      </div>
      <ColorField value={color} onChange={setColor} />
      <div className="two-col">
        <div className="field">
          <label>Grid</label>
          <select
            className="select"
            value={g}
            onChange={(e) => {
              const grid = parseInt(e.target.value, 10);
              onChange({ ...value, grid, cells: resizeCells(value, grid) });
            }}
          >
            {GRID_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} × {s}
              </option>
            ))}
          </select>
        </div>
        <Slider label="Pixel size" value={value.cell} min={1} max={8} step={1} suffix="px" onChange={(cell) => onChange({ ...value, cell })} />
      </div>
    </div>
  );
}

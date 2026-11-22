import type { Design } from "../../shared/types";
import { defaultDesign } from "../../shared/design";

const COLORS = ["#00ff88", "#00ffff", "#ffffff", "#ff3355", "#ffee00", "#ff44cc", "#7cf9ff", "#a3ff12", "#ff8a00"];
const NAMES = ["Nova", "Pulse", "Vector", "Halo", "Ember", "Frost", "Viper", "Echo", "Drift", "Spark", "Orbit", "Prism"];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/** A random but sensible crosshair, used by "Surprise me". */
export function randomDesign(): Design {
  const d = defaultDesign(`${pick(NAMES)} ${rint(1, 99)}`);
  const color = pick(COLORS);
  d.lines = { ...d.lines, enabled: Math.random() > 0.15, color, thickness: pick([1, 2, 2, 3]), length: rint(3, 12), gap: rint(0, 8), rotation: Math.random() > 0.85 ? 45 : 0 };
  d.dot = { ...d.dot, enabled: !d.lines.enabled || Math.random() > 0.6, color, size: rint(2, 5), shape: Math.random() > 0.5 ? "circle" : "square" };
  d.circle = { ...d.circle, enabled: Math.random() > 0.8, color, radius: rint(8, 18), thickness: 1 };
  d.outline = { ...d.outline, enabled: Math.random() > 0.3, opacity: pick([0.5, 0.7, 1]) };
  d.tShape = Math.random() > 0.85 ? "always" : "never";
  d.bloom = { ...d.bloom, enabled: Math.random() > 0.7, amount: rint(3, 10) };
  return d;
}

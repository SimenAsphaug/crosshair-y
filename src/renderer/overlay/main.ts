import "./overlay.css";
import type { Design, OverlayFrame } from "../../shared/types";
import { onImageLoaded, renderDesign } from "../lib/render";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let design: Design | null = null;
let scale = 1;
let firing = false;
let spread = 0;
let animating = false;
let last = 0;

function resize() {
  // Draw in physical pixels so lines stay crisp at any Windows scale factor.
  const w = Math.round(window.innerWidth * devicePixelRatio);
  const h = Math.round(window.innerHeight * devicePixelRatio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function draw() {
  resize();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!design) return;
  renderDesign(ctx, design, {
    cx: canvas.width / 2,
    cy: canvas.height / 2,
    scale,
    spread,
    firing,
    snap: true,
  });
}

function tick(now: number) {
  const dt = last ? now - last : 16;
  last = now;
  const b = design?.bloom;
  const target = firing && b?.enabled ? b.amount : 0;
  if (!b?.enabled) {
    spread = 0;
  } else if (spread !== target) {
    const dur = target > spread ? b.attack : b.recovery;
    const step = dur <= 0 ? Infinity : (b.amount / dur) * dt;
    spread = target > spread ? Math.min(target, spread + step) : Math.max(target, spread - step);
  }
  draw();
  if (spread !== target) {
    requestAnimationFrame(tick);
  } else {
    animating = false;
    last = 0;
  }
}

function kick() {
  if (animating) return;
  animating = true;
  requestAnimationFrame(tick);
}

window.cy.onOverlayFrame((f: OverlayFrame) => {
  design = f.design;
  scale = f.scale;
  draw();
});

window.cy.onOverlayFire((f) => {
  firing = f;
  draw(); // T-shape reacts immediately
  kick();
});

window.addEventListener("resize", draw);
onImageLoaded(draw);

// Builds community/index.json from community/designs/*.json.
// Usage: node scripts/build-community-index.mjs [--check]
//   --check  validate only; exits non-zero on invalid files (used for pull requests)
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "community", "designs");
const out = path.join(root, "community", "index.json");
const check = process.argv.includes("--check");

const MAX_FILE = 2_000_000;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

function addedDate(file, previous) {
  if (previous) return previous;
  try {
    const out = execFileSync("git", ["log", "--diff-filter=A", "--format=%aI", "-1", "--", file], { cwd: root, encoding: "utf8" }).trim();
    if (out) return out;
  } catch {}
  return new Date().toISOString();
}

function validate(slug, data) {
  const errors = [];
  if (!SLUG_RE.test(slug)) errors.push("file name must be lowercase letters, digits and dashes");
  if (!data || typeof data !== "object") return ["not a JSON object"];
  const d = data.design;
  if (!d || typeof d !== "object") errors.push("missing \"design\" object");
  else {
    if (typeof d.name !== "string" || !d.name.trim()) errors.push("design.name is required");
    for (const layer of ["lines", "dot", "outline", "circle"]) {
      const c = d[layer]?.color;
      if (c !== undefined && !HEX_RE.test(c)) errors.push(`design.${layer}.color must be #rrggbb`);
    }
    if (d.image?.src && !IMAGE_RE.test(d.image.src)) errors.push("design.image.src must be a base64 data:image URL");
    if (Array.isArray(d.pixels?.cells) && d.pixels.cells.some((c) => c !== "" && !HEX_RE.test(c))) errors.push("design.pixels.cells must be \"\" or #rrggbb");
  }
  if (data.tags !== undefined && !Array.isArray(data.tags)) errors.push("tags must be an array");
  return errors;
}

const previous = (() => {
  try {
    const idx = JSON.parse(fs.readFileSync(out, "utf8"));
    return new Map(idx.designs.map((e) => [e.slug, e.added]));
  } catch {
    return new Map();
  }
})();

let failed = false;
const designs = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const full = path.join(dir, file);
  const slug = file.replace(/\.json$/, "");
  if (fs.statSync(full).size > MAX_FILE) {
    console.error(`✗ ${file}: larger than ${MAX_FILE} bytes`);
    failed = true;
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON (${e.message})`);
    failed = true;
    continue;
  }
  const errors = validate(slug, data);
  if (errors.length) {
    console.error(`✗ ${file}: ${errors.join("; ")}`);
    failed = true;
    continue;
  }
  designs.push({
    slug,
    author: String(data.author ?? "anonymous").slice(0, 40),
    tags: (data.tags ?? []).filter((t) => typeof t === "string").map((t) => t.toLowerCase().slice(0, 24)).slice(0, 8),
    game: typeof data.game === "string" ? data.game.slice(0, 40) : null,
    added: addedDate(path.relative(root, full), previous.get(slug)),
    design: data.design,
  });
}

designs.sort((a, b) => (b.added ?? "").localeCompare(a.added ?? ""));

if (failed) {
  console.error("\nSome community designs are invalid.");
  process.exit(1);
}
if (check) {
  console.log(`✓ ${designs.length} community designs are valid`);
} else {
  fs.writeFileSync(out, JSON.stringify({ version: 1, designs }, null, 1) + "\n");
  console.log(`Wrote ${designs.length} designs to ${path.relative(root, out)}`);
}

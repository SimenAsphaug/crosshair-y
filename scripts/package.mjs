// Packages the built app with @electron/packager.
// Usage: node scripts/package.mjs [platform] [arch]   (defaults to the current machine)
import { packager } from "@electron/packager";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.argv[2] ?? process.platform;
const arch = process.argv[3] ?? process.arch;

const keep = [/^\/dist(\/|$)/, /^\/node_modules(\/|$)/, /^\/package\.json$/, /^\/icon\.ico$/, /^\/LICENSE$/];

const paths = await packager({
  dir: root,
  out: resolve(root, "build"),
  name: "crosshair-y",
  executableName: "crosshair-y",
  platform,
  arch,
  overwrite: true,
  icon: resolve(root, "icon.ico"),
  asar: { unpack: "**/*.node" },
  prune: true,
  ignore: (p) => p !== "" && !keep.some((re) => re.test(p)),
});

console.log("Packaged to:", paths.join(", "));

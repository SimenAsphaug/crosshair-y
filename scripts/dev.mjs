// Development runner: Vite dev server (hot reload for the UI) + tsc watch for the
// main process + Electron. Restart the app manually after main-process changes.
import { createServer } from "vite";
import { spawn, spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const electronPath = require("electron");
const tscBin = resolve(root, "node_modules/typescript/bin/tsc");

const build = spawnSync(process.execPath, [tscBin, "-p", "tsconfig.main.json"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = await createServer({ configFile: resolve(root, "vite.config.mjs") });
await server.listen();
const url = server.resolvedUrls.local[0];

const tsc = spawn(process.execPath, [tscBin, "-p", "tsconfig.main.json", "--watch", "--preserveWatchOutput"], {
  cwd: root,
  stdio: "inherit",
});

const electron = spawn(electronPath, ["."], {
  cwd: root,
  stdio: "inherit",
  env: (() => {
    const env = { ...process.env, VITE_DEV_SERVER_URL: url };
    delete env.ELECTRON_RUN_AS_NODE;
    return env;
  })(),
});

electron.on("exit", async (code) => {
  tsc.kill();
  await server.close();
  process.exit(code ?? 0);
});

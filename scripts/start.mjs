// Launches the built app. Clears ELECTRON_RUN_AS_NODE, which some editors
// (e.g. VS Code terminals) set and which would make Electron run as plain Node.
import { spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const electronPath = createRequire(import.meta.url)("electron");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [".", ...process.argv.slice(2)], { cwd: root, stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));

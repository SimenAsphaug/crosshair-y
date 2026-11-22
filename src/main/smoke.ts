import { BrowserWindow, app } from "electron";
import fs from "fs";
import path from "path";

/**
 * Developer smoke test (CY_SMOKE_DIR=<folder>): visits every page, saves
 * screenshots of the main window and the overlay, logs renderer errors, quits.
 */
export async function runSmoke(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const log: string[] = [];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let main: BrowserWindow | undefined;
  for (let i = 0; i < 50 && !main; i++) {
    main = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("index.html"));
    if (!main) await wait(200);
  }
  if (!main) {
    fs.writeFileSync(path.join(dir, "log.txt"), "main window not found");
    app.exit(1);
    return;
  }
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.on("console-message", (_e, level, message) => {
      if (level >= 2) log.push(`[${w.webContents.getURL().split("/").pop()}] ${message}`);
    });
  }
  main.show();
  main.setSize(1280, 800);
  await wait(1800);

  const shot = async (name: string) => {
    const img = await main!.webContents.capturePage();
    fs.writeFileSync(path.join(dir, `${name}.png`), img.toPNG());
  };
  const click = (selector: string, index = 0) =>
    main!.webContents.executeJavaScript(`(() => { const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (el) el.click(); return !!el; })()`);

  const pages = ["library", "designer", "keybinds", "profiles", "settings"];
  for (let i = 0; i < pages.length; i++) {
    await click(".nav-item", i);
    await wait(700);
    await shot(pages[i]);
  }
  // Library: built-in tab
  await click(".nav-item", 0);
  await wait(300);
  await click(".tab", 1);
  await wait(500);
  await shot("library-builtin");
  await click(".tab", 2);
  await wait(2500);
  await shot("library-community");

  // Overlay window
  const overlay = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("overlay.html"));
  if (overlay) {
    const img = await overlay.webContents.capturePage();
    fs.writeFileSync(path.join(dir, "overlay.png"), img.toPNG());
    log.push(`overlay bounds ${JSON.stringify(overlay.getBounds())} visible=${overlay.isVisible()}`);
  } else {
    log.push("overlay window missing");
  }
  const runtime = await main.webContents.executeJavaScript("window.cy.getRuntime()");
  log.push(`runtime ${JSON.stringify({ ...runtime, displays: runtime.displays.length })}`);

  // Light theme + compact
  await main.webContents.executeJavaScript(`window.cy.dispatch({ type: "settings/update", patch: { theme: "light", accent: "#3b82f6" } })`);
  await click(".nav-item", 1);
  await wait(900);
  await shot("designer-light");
  await click(".nav-item", 0);
  await wait(600);
  await shot("library-light");
  fs.writeFileSync(path.join(dir, "log.txt"), log.join("\n"));
  app.exit(0);
}

# Crosshair Y

![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/Electron-37-blue)

A free and open-source crosshair overlay for games. Design your own crosshair, browse community designs, and switch them automatically per game.

## Features

- **Designer**: lines, center dot, outline, circle, pixel drawing and image layers. Every layer has its own color, opacity, size, blur and rotation. Includes undo/redo, a live on-screen preview and a "hold to fire" preview.
- **Dynamic crosshairs**: *bloom* spreads the lines while you fire. *T-shape* hides the top line never, always or only while firing.
- **Library**: saved crosshairs with favorites, categories, search, sorting and drag-to-reorder. Includes 26 built-in designs.
- **Community gallery**: browse and download designs shared on GitHub, or submit your own from the app. See [community/](community/README.md).
- **Share & export**: share codes (`CY1-…`), Valorant crosshair code import, and PNG, SVG and JSON export.
- **Smart toggles**: rebindable keyboard and mouse shortcuts that work in game. Hide or swap the crosshair while aiming (e.g. right mouse button), and jump between crosshairs.
- **Profiles per game**: each profile has its own crosshair, monitor, position and size. When a linked game is focused, its profile is used automatically (Windows).
- **Show only in game**, multi-monitor support, pixel-exact position nudging, and hiding the crosshair from screen recordings.
- **Clean, adjustable UI**: dark, light or system theme, custom accent color, interface scaling, compact mode and a collapsible sidebar.

> The crosshair is an always-on-top window. It shows over games running in **borderless** or **windowed** mode, not exclusive fullscreen.

## Getting started

Requires [Node.js](https://nodejs.org/) 20 or later.

```bash
npm install
npm start          # build and run
npm run dev        # hot-reloading UI (restart for main-process changes)
```

Package a standalone app into `build/`:

```bash
npm run package          # current platform
npm run package:win32
npm run package:linux
```

### Releases

The **Build & release** workflow (`.github/workflows/release.yml`) builds Windows and Linux packages on GitHub. To publish a release:

```bash
git tag v5.0.0
git push origin v5.0.0
```

The tag becomes the app version. The release gets `crosshair-y-win32-x64.zip` and `crosshair-y-linux-x64.tar.gz`: extract one and run `crosshair-y.exe` / `crosshair-y`. Tags with a dash (e.g. `v5.1.0-beta.1`) are published as pre-releases. To get the packages without publishing a release, run the workflow manually from the Actions tab; they're attached to the run.

## Project layout

```
src/
  main/       Electron main process: state store, overlay window, global input (uiohook-napi),
              foreground-game detection (koffi, Windows), tray, IPC
  preload/    Typed, minimal API exposed to the UI as window.cy
  shared/     Data model, reducer, validation, built-in designs (used by both sides)
  renderer/
    app/      React UI (Library, Designer, Keybinds, Profiles, Settings)
    overlay/  The transparent crosshair window
    lib/      Crosshair renderer, share codes, community client
community/    Community gallery (designs + generated index.json)
scripts/      Dev runner, launcher, packager, community index builder
```

All app state lives in one JSON file in the user data folder (`crosshair-y.json`), owned by the main process. The UI changes it by dispatching actions (`src/shared/state.ts`), so the main window, the overlay and the tray always agree.

## Credits

Originally created by [YSSF8](https://github.com/YSSF8/crosshair-y), with contributions from [deagleon](https://github.com/deagleon/crosshair-y). Licensed under the [MIT License](LICENSE).

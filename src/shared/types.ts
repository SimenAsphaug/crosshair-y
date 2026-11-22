// Shared data model used by the main process, preload and renderer.
// Units: all lengths are physical screen pixels at scale 1.

export type Hex = string; // "#rrggbb"

export interface LinesLayer {
  enabled: boolean;
  color: Hex;
  opacity: number; // 0..1
  length: number;
  thickness: number;
  gap: number; // distance from center to arm start (may be negative)
  blur: number;
  rotation: number; // degrees
}

export interface DotLayer {
  enabled: boolean;
  color: Hex;
  opacity: number;
  size: number;
  blur: number;
  shape: "square" | "circle";
}

export interface OutlineLayer {
  enabled: boolean;
  color: Hex;
  opacity: number;
  thickness: number;
  blur: number;
}

export interface CircleLayer {
  enabled: boolean;
  color: Hex;
  opacity: number;
  radius: number;
  thickness: number;
  blur: number;
}

export interface PixelLayer {
  enabled: boolean;
  grid: number; // cells per side
  cell: number; // px per cell
  cells: string[]; // grid*grid entries, "" = empty, otherwise "#rrggbb"
}

export interface ImageLayer {
  enabled: boolean;
  src: string; // data:image/... URL or "builtin/<file>"
  size: number; // px of the longest side
  opacity: number;
  rotation: number;
}

export type TShapeMode = "never" | "always" | "firing";

export interface BloomSettings {
  enabled: boolean;
  amount: number; // extra gap in px while firing
  attack: number; // ms to reach full spread
  recovery: number; // ms to recover
}

export interface Design {
  id: string;
  name: string;
  lines: LinesLayer;
  dot: DotLayer;
  outline: OutlineLayer;
  circle: CircleLayer;
  pixels: PixelLayer;
  image: ImageLayer;
  tShape: TShapeMode;
  bloom: BloomSettings;
}

export interface SavedDesign extends Design {
  favorite: boolean;
  categoryId: string | null;
  createdAt: number;
  updatedAt: number;
  origin: "user" | "builtin" | "community" | "import";
}

export interface Category {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  name: string;
  games: string[]; // lowercase executable names, e.g. "cs2.exe"
  designId: string | null;
  displayId: number | null; // null = primary display
  offsetX: number; // physical px from display center
  offsetY: number;
  scale: number;
}

export type Binding =
  | { device: "keyboard"; code: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }
  | { device: "mouse"; button: number } // 1 left, 2 right, 3 middle, 4 back, 5 forward
  | null;

export type AimMode = "off" | "hide" | "swap";

export interface Keybinds {
  toggle: Binding;
  aim: { binding: Binding; mode: AimMode; behavior: "hold" | "toggle"; swapDesignId: string | null };
  fire: { binding: Binding };
  next: Binding;
  prev: Binding;
  toCursor: Binding;
  recenter: Binding;
  designShortcuts: Record<string, Binding>;
}

export interface Settings {
  theme: "dark" | "light" | "system";
  accent: Hex;
  uiScale: number;
  compact: boolean;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  previewBackground: "dark" | "light" | "scene";

  showOnlyInGame: boolean;
  autoSwitchProfiles: boolean;
  hideFromCapture: boolean;
  customGames: string[];

  launchOnStartup: boolean;
  startMinimized: boolean;
  overlayOnLaunch: boolean;
  closeToTray: boolean;

  hardwareAcceleration: boolean;

  communityIndexUrl: string;
  communityRepo: string; // "owner/repo" used for submissions
  checkUpdates: boolean;
}

export interface AppState {
  version: 1;
  overlayEnabled: boolean;
  activeProfileId: string;
  designs: SavedDesign[];
  categories: Category[];
  profiles: Profile[];
  keybinds: Keybinds;
  settings: Settings;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  width: number; // physical
  height: number;
  scaleFactor: number;
}

export interface RuntimeStatus {
  inputHook: "ok" | "unavailable";
  inputHookError: string | null;
  gameDetection: "ok" | "unsupported";
  foreground: string | null; // exe of focused app
  recentApps: string[];
  inGame: boolean;
  effectiveProfileId: string;
  overlayVisible: boolean;
  aiming: boolean;
  displays: DisplayInfo[];
  platform: string;
  version: string;
}

export type Action =
  | { type: "overlay/set"; enabled: boolean }
  | { type: "overlay/toggle" }
  | { type: "design/save"; design: SavedDesign }
  | { type: "design/saveMany"; designs: SavedDesign[] }
  | { type: "design/delete"; id: string }
  | { type: "design/reorder"; ids: string[] }
  | { type: "design/favorite"; id: string; favorite: boolean }
  | { type: "design/category"; id: string; categoryId: string | null }
  | { type: "design/activate"; id: string; profileId?: string }
  | { type: "category/add"; category: Category }
  | { type: "category/rename"; id: string; name: string }
  | { type: "category/delete"; id: string }
  | { type: "profile/save"; profile: Profile }
  | { type: "profile/delete"; id: string }
  | { type: "profile/activate"; id: string }
  | { type: "profile/offset"; id: string; offsetX: number; offsetY: number; displayId?: number | null }
  | { type: "settings/update"; patch: Partial<Settings> }
  | { type: "keybinds/update"; patch: Partial<Keybinds> }
  | { type: "keybinds/designShortcut"; id: string; binding: Binding }
  | { type: "state/replace"; state: AppState };

export interface ExportFileRequest {
  defaultName: string;
  filters: { name: string; extensions: string[] }[];
  data: string; // utf8 text or base64 (when base64 = true)
  base64?: boolean;
}

export interface ImportedFile {
  name: string;
  ext: string;
  text?: string;
  dataUrl?: string;
}

export interface UpdateInfo {
  current: string;
  latest: string | null;
  url: string | null;
  newer: boolean;
  error?: string;
}

/** API exposed by the preload script on window.cy */
export interface CyApi {
  getState(): Promise<AppState>;
  getRuntime(): Promise<RuntimeStatus>;
  dispatch(action: Action): void;
  onState(cb: (s: AppState) => void): () => void;
  onRuntime(cb: (r: RuntimeStatus) => void): () => void;
  onNavigate(cb: (page: string) => void): () => void;

  previewDesign(design: Design | null): void;
  setRecordingInput(recording: boolean): void;
  setTitleBarColors(color: string, symbol: string): void;
  setPositionToCursor(): void;

  exportFile(req: ExportFileRequest): Promise<boolean>;
  importFile(kind: "image" | "design" | "backup"): Promise<ImportedFile | null>;
  openExternal(url: string): void;
  checkUpdate(): Promise<UpdateInfo>;
  restart(): void;

  // Overlay window only
  onOverlayFrame(cb: (f: OverlayFrame) => void): () => void;
  onOverlayFire(cb: (firing: boolean) => void): () => void;
}

export interface OverlayFrame {
  design: Design | null;
  scale: number;
}

import path from "path";

/**
 * Detects the executable of the foreground window (Windows only, via koffi FFI).
 * Other platforms report "unsupported" and the feature is disabled in the UI.
 */
export class ForegroundWatcher {
  status: "ok" | "unsupported" = "unsupported";
  current: string | null = null;
  recent: string[] = [];
  private timer: NodeJS.Timeout | null = null;
  private query: (() => string | null) | null = null;

  constructor(
    private onChange: (exe: string | null) => void,
    private ignore: (exe: string) => boolean,
  ) {}

  start() {
    if (process.platform !== "win32") return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const koffi = require("koffi");
      const user32 = koffi.load("user32.dll");
      const kernel32 = koffi.load("kernel32.dll");
      const GetForegroundWindow = user32.func("void* __stdcall GetForegroundWindow()");
      const GetWindowThreadProcessId = user32.func("uint32_t __stdcall GetWindowThreadProcessId(void* hWnd, _Out_ uint32_t* pid)");
      const OpenProcess = kernel32.func("void* __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)");
      const QueryFullProcessImageNameW = kernel32.func(
        "int __stdcall QueryFullProcessImageNameW(void* h, uint32_t flags, _Out_ uint8_t* buf, _Inout_ uint32_t* size)",
      );
      const CloseHandle = kernel32.func("int __stdcall CloseHandle(void* h)");
      const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

      this.query = () => {
        const hwnd = GetForegroundWindow();
        if (!hwnd) return null;
        const pid = [0];
        GetWindowThreadProcessId(hwnd, pid);
        if (!pid[0]) return null;
        const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid[0]);
        if (!h) return null;
        try {
          const buf = Buffer.alloc(1040);
          const size = [520];
          if (!QueryFullProcessImageNameW(h, 0, buf, size)) return null;
          const full = buf.toString("utf16le", 0, size[0] * 2);
          return path.win32.basename(full).toLowerCase();
        } finally {
          CloseHandle(h);
        }
      };
      this.query();
      this.status = "ok";
      this.timer = setInterval(() => this.poll(), 1000);
    } catch (err) {
      console.error("Foreground detection unavailable:", err);
      this.status = "unsupported";
    }
  }

  private poll() {
    let exe: string | null = null;
    try {
      exe = this.query?.() ?? null;
    } catch {
      exe = null;
    }
    if (exe && !this.ignore(exe)) {
      this.recent = [exe, ...this.recent.filter((e) => e !== exe)].slice(0, 15);
    }
    if (exe !== this.current) {
      this.current = exe;
      this.onChange(exe);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** Processes that are never interesting as "games" (shell, this app, etc.). */
export const IGNORED_APPS = new Set([
  "explorer.exe",
  "searchhost.exe",
  "startmenuexperiencehost.exe",
  "shellexperiencehost.exe",
  "applicationframehost.exe",
  "taskmgr.exe",
  "lockapp.exe",
  "textinputhost.exe",
  "systemsettings.exe",
]);

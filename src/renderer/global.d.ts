import type { CyApi } from "../shared/types";

declare global {
  interface Window {
    cy: CyApi;
  }
}

export {};

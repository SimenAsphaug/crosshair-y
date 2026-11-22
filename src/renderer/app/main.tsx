import { createRoot } from "react-dom/client";
import "./styles.css";
import { AppProvider } from "./state";
import { App } from "./App";

async function boot() {
  const [state, runtime] = await Promise.all([window.cy.getState(), window.cy.getRuntime()]);
  createRoot(document.getElementById("root")!).render(
    <AppProvider initial={state} initialRuntime={runtime}>
      <App />
    </AppProvider>,
  );
}

boot();

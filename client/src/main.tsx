import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { reportWebVitals } from "./lib/web-vitals";
import "./index.css";

const rootEl = document.getElementById("root")!;
rootEl.innerHTML = "";

createRoot(rootEl).render(<App />);

// PWA service worker — auto-updates in the background when a new build ships
registerSW({
  onNeedRefresh() {
    console.info("[PWA] New version available — updating in the background…");
  },
  onOfflineReady() {
    console.info("[PWA] App is ready to work offline");
  },
});

// Core Web Vitals — measured and reported to Sentry in production
reportWebVitals();

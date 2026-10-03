import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { attachPageViewportGuard } from "./lib/page-viewport";
import { installHeap, attachUIAnalytics } from "./lib/analytics";
installHeap(import.meta.env.PROD);
const detachAnalytics = attachUIAnalytics(document);
if (import.meta.hot) import.meta.hot.dispose(detachAnalytics);
const detachViewportGuard = attachPageViewportGuard(document);
if (import.meta.hot) import.meta.hot.dispose(detachViewportGuard);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

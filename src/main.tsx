import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { attachPageViewportGuard } from "./lib/page-viewport";
const detachViewportGuard = attachPageViewportGuard(document);
if (import.meta.hot) import.meta.hot.dispose(detachViewportGuard);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

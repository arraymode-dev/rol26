import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/three\//.test(id)) return "three";
          if (/node_modules\/(@react-three|three-stdlib|react-reconciler)\//.test(id)) return "scene-runtime";
        },
      },
    },
  },
});

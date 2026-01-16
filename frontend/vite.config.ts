import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api/v1": {
        target: "http://backend:8080",
        changeOrigin: true,
        secure: false,
      },
      "/api/tasks": {
        target: "http://python-api:8000",
        changeOrigin: true,
        secure: false,
      },
      "/api/health": {
        target: "http://python-api:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});

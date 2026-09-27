import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      ["/api", "/health", "/openapi"].map((path) => [
        path,
        {
          target: process.env.API_PROXY_TARGET || "http://localhost:5220",
          changeOrigin: false,
        },
      ]),
    ),
  },
});

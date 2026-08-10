import { defineConfig } from "vite";

export default defineConfig(async () => ({
  // Azure Static Web Apps uses Next.js SSR routes via app/api/... route handlers.
  // Vite config is retained only for local tooling; app runs on Next.js.
  server: {
    host: "0.0.0.0",
  },
}));

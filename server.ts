/**
 * Standalone / local server entry point.
 *
 * This file is NOT used on Vercel. On Vercel, api/index.ts is deployed as a
 * serverless function and Vercel serves the built frontend (dist/) statically.
 *
 * This entry reuses the exact same Express app from api/index.ts so route logic
 * never diverges between environments. It supports two modes:
 *   - dev  (default):        Vite dev server middleware + HMR
 *   - prod (NODE_ENV=production): serves the built dist/ folder statically
 *
 * Local dev:            npm run dev
 * Standalone prod host: npm run build && NODE_ENV=production npm start
 */
import nodePath from "path";
import express from "express";
import app from "./api/index";

const PORT = Number(process.env.PORT) || 3000;

async function boot() {
  if (process.env.NODE_ENV === "production") {
    const distPath = nodePath.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(nodePath.join(distPath, "index.html"));
    });
    console.log("LabMaster AI running in standalone production mode (serving dist/)");
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("LabMaster AI running in local dev mode (Express + Vite middleware)");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LabMaster AI server listening on http://localhost:${PORT}`);
  });
}

boot();

import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import { type Express } from "express";
import runApp from "./app";

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve("dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const mime = {
    ".js": "application/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".glb": "model/gltf-binary",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".json": "application/json",
  };

  app.use((req, res, next) => {
    if (req.path === "/") {
      return next();
    }
    const filePath = path.join(distPath, req.path.slice(1));
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(`${path.resolve(distPath)}${path.sep}`)) {
      return res.status(403).end("Forbidden");
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      return next();
    }
    const ext = path.extname(resolved);
    const contentType = mime[ext as keyof typeof mime] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    const content = fs.readFileSync(resolved);
    res.end(content);
  });

  app.use((req, res, next) => {
    if (path.extname(req.path)) {
      return res.status(404).end("Not found");
    }
    next();
  });

  app.use((_req, res) => {
    const indexPath = path.join(distPath, "index.html");
    const content = fs.readFileSync(indexPath);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(content);
  });
}

(async () => {
  await runApp(serveStatic);
})();

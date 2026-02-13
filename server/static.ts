import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: express.Express) {
  const clientPath = path.resolve(__dirname, "../../client/dist");

  app.use(express.static(clientPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

/**
 * Minimal HTTP server: serves the web UI and exposes a /api/convert endpoint.
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { inferSchema } from "./converter";
import { generateTypeScript } from "./typescript";
import { generateZod } from "./zod";

export function startServer(port: number): void {
  const htmlPath = path.resolve(__dirname, "..", "public", "index.html");

  const server = http.createServer((req, res) => {
    // CORS headers for local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serve web UI
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      serveHTML(res, htmlPath);
      return;
    }

    // API endpoint
    if (req.method === "POST" && req.url === "/api/convert") {
      handleConvert(req, res);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(port, () => {
    console.log(`json-to-types web UI running at http://localhost:${port}`);
  });
}

function serveHTML(res: http.ServerResponse, filePath: string): void {
  try {
    const html = fs.readFileSync(filePath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Could not load index.html");
  }
}

function handleConvert(
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const { json, rootName } = JSON.parse(body);
      const parsed = JSON.parse(json);
      const result = inferSchema(parsed, rootName || "Root");
      const ts = generateTypeScript(result);
      const zod = generateZod(result);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ typescript: ts, zod }));
    } catch (err: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "Invalid JSON" }));
    }
  });
}

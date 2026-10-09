import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist");
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Invalid PORT");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname === "/health") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(req.method === "HEAD" ? undefined : '{"status":"ok"}');
        return;
      }
      let path = resolve(root, "." + pathname);
      if (path !== root && !path.startsWith(root + "/")) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (path === root) path = resolve(root, "index.html");
      try {
        if (!(await stat(path)).isFile()) throw Error();
      } catch {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const content = await readFile(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log("Event requests: http://localhost:" + port),
  );

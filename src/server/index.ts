import "./loadEnv.js";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { app } from "./app.js";

const uploadDir = (process.env.UPLOAD_DIR ?? "./uploads").replace(/^\.\//, "");
app.use(
  "/uploads/*",
  serveStatic({
    root: "./",
    rewriteRequestPath: (path) => path.replace(/^\/uploads/, `/${uploadDir}`),
  }),
);

const clientDir = "dist/client";
if (existsSync(clientDir)) {
  app.use("/*", serveStatic({ root: clientDir }));
  app.get("/*", serveStatic({ root: clientDir, path: "index.html" }));
}

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Agape API http://127.0.0.1:${port}`);
});

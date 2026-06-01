import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { handler } from "../netlify/functions/sna-gpt.js";

const port = 8888;

function loadLocalEnv() {
  if (!existsSync(".env")) {
    return;
  }

  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    });
    res.end();
    return;
  }

  if (req.url !== "/.netlify/functions/sna-gpt") {
    res.writeHead(404, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const result = await handler({
        body,
        httpMethod: req.method,
        isBase64Encoded: false,
      });

      res.writeHead(result.statusCode || 200, result.headers || {});
      res.end(result.body || "");
    } catch (error) {
      res.writeHead(500, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({
        error: error?.message || "Local SNA GPT server failed.",
      }));
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SNA GPT local function listening on http://127.0.0.1:${port}`);
});

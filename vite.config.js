import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function localNetlifyFunctions() {
  return {
    name: "local-netlify-functions",
    configureServer(server) {
      server.middlewares.use("/.netlify/functions/sna-gpt", async (request, response) => {
        try {
          const body = await readRequestBody(request);
          const functionUrl = new URL(
            `./netlify/functions/sna-gpt.js?dev=${Date.now()}`,
            import.meta.url,
          );
          const { handler } = await import(functionUrl.href);
          const result = await handler({
            body,
            headers: request.headers,
            httpMethod: request.method,
            isBase64Encoded: false,
            path: "/.netlify/functions/sna-gpt",
            rawUrl: request.url,
          });

          response.statusCode = result.statusCode || 200;

          Object.entries(result.headers || {}).forEach(([key, value]) => {
            response.setHeader(key, value);
          });

          response.end(result.body || "");
        } catch (error) {
          server.config.logger.error(error);
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({
            error: error?.message || "Could not run the SNA GPT function.",
          }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  Object.entries(env).forEach(([key, value]) => {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });

  return {
    plugins: [react(), localNetlifyFunctions()],
  };
});

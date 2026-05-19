import { Buffer } from "node:buffer";

const removalAiEndpoint = "https://api.removal.ai/3.0/remove";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, X-File-Name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function getHeader(headers, name) {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === target,
  );

  return entry?.[1] || "";
}

function jsonResponse(statusCode, payload, headers = {}) {
  return {
    body: JSON.stringify(payload),
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      ...headers,
    },
    statusCode,
  };
}

function getUploadFileName(event) {
  const rawName = getHeader(event.headers, "x-file-name");
  let decodedName = rawName;

  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    decodedName = rawName;
  }

  return decodedName.replace(/[\\/]/g, "_") || "image.png";
}

function isSupportedImage(contentType, fileName) {
  const type = contentType.split(";")[0].trim().toLowerCase();

  if (["image/png", "image/jpeg", "image/webp"].includes(type)) {
    return true;
  }

  if (type && type !== "application/octet-stream") {
    return false;
  }

  return /\.(png|jpe?g|webp)$/i.test(fileName);
}

function parseErrorPayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getErrorMessage(payload) {
  if (!payload) {
    return "";
  }

  const apiErrors = Array.isArray(payload?.errors) ? payload.errors : [];
  const message = apiErrors
    .map((item) => item.title || item.detail || item.message || item.code)
    .filter(Boolean)
    .join(" ");

  return (
    message ||
    payload?.message ||
    payload?.error ||
    ""
  );
}

async function readRemovalAiError(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  const payload = parseErrorPayload(text);

  if (contentType.includes("application/json") || payload) {
    return getErrorMessage(payload) || "Removal.AI could not process this image.";
  }

  return text || "Removal.AI could not process this image.";
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      body: "",
      headers: corsHeaders,
      statusCode: 204,
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Use POST to remove an image background." }, {
      Allow: "POST, OPTIONS",
    });
  }

  const apiKey = process.env.REMOVAL_AI_API_KEY;

  if (!apiKey) {
    return jsonResponse(500, {
      error: "Removal.AI API key is not configured. Set REMOVAL_AI_API_KEY in Netlify.",
    });
  }

  const contentType = getHeader(event.headers, "content-type");
  const fileName = getUploadFileName(event);

  if (!isSupportedImage(contentType, fileName)) {
    return jsonResponse(415, {
      error: "Please upload a PNG, JPG, or WebP image.",
    });
  }

  if (!event.body) {
    return jsonResponse(400, { error: "No image file was uploaded." });
  }

  const imageBuffer = Buffer.from(
    event.body,
    event.isBase64Encoded ? "base64" : "binary",
  );
  const imageType = contentType.split(";")[0].trim() || "application/octet-stream";
  const uploadFileName = fileName || "image.png";
  const formData = new FormData();

  formData.append("get_file", "1");
  formData.append("image_file", new Blob([imageBuffer], { type: imageType }), uploadFileName);

  try {
    const response = await fetch(removalAiEndpoint, {
      body: formData,
      headers: {
        "Rm-Token": apiKey,
      },
      method: "POST",
    });

    if (!response.ok) {
      const error = await readRemovalAiError(response);
      const retryAfter = response.headers.get("retry-after");

      return jsonResponse(
        response.status,
        { error },
        retryAfter ? { "Retry-After": retryAfter } : {},
      );
    }

    const resultBuffer = Buffer.from(await response.arrayBuffer());

    return {
      body: resultBuffer.toString("base64"),
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store",
        "Content-Type": response.headers.get("content-type") || "image/png",
      },
      isBase64Encoded: true,
      statusCode: 200,
    };
  } catch (error) {
    return jsonResponse(502, {
      error: error?.message || "Could not reach Removal.AI.",
    });
  }
}

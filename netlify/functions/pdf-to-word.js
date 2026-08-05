const geminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
const defaultModel = "gemini-2.5-flash";
const maxUploadBytes = 20 * 1024 * 1024;
const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

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

function cleanText(value, maxLength = 4000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function getHeader(headers, name) {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry?.[1] || "";
}

function stripCodeFences(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJson(text) {
  const cleaned = stripCodeFences(text);
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Gemini did not return structured JSON.");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function getModelName() {
  const model = cleanText(process.env.PDF_TO_WORD_MODEL || process.env.GEMINI_MODEL || defaultModel, 80).replace(/^models\//, "");
  return /^[a-z0-9_.-]+$/i.test(model) ? model : defaultModel;
}

async function readGeminiPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(text || "Gemini returned an unexpected response.");
  }

  return JSON.parse(text);
}

function getGeminiError(payload) {
  return cleanText(payload?.error?.message || payload?.message || payload?.error || "Gemini could not convert this PDF.", 300);
}

async function convertWithGemini(pdfBuffer, fileName) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Set GEMINI_API_KEY in Netlify.");
  }

  const model = getModelName();
  const instruction = [
    "You convert PDFs into structured JSON for Word export.",
    "Preserve the original reading order and layout as closely as possible.",
    "Do not add page titles like Page 1 or Page 2.",
    "Do not summarize, translate, or rewrite unless the source is unreadable.",
    "If a line is clearly a page number artifact, omit it.",
    "Return only valid JSON with this shape:",
    "{",
    '  "title": "short document title",',
    '  "pages": [',
    '    { "blocks": [',
    '      { "type": "heading", "level": 1, "text": "..." },',
    '      { "type": "paragraph", "text": "..." },',
    '      { "type": "list", "items": ["...", "..."] },',
    '      { "type": "table", "rows": [["A", "B"], ["C", "D"]] }',
    "    ] }",
    "  ]",
    "}",
  ].join(" ");

  const response = await fetch(`${geminiBaseUrl}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${instruction}\n\nFile name: ${fileName}` },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: pdfBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await readGeminiPayload(response);

  if (!response.ok) {
    throw new Error(getGeminiError(payload));
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") || "";
  return extractJson(text);
}

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { body: "", headers: corsHeaders, statusCode: 204 };
    }

    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Use POST to convert a PDF to Word." }, { Allow: "POST, OPTIONS" });
    }

    if (!event.body) {
      return jsonResponse(400, { error: "No PDF file was uploaded." });
    }

    const contentType = getHeader(event.headers, "content-type").split(";")[0].trim().toLowerCase();
    const rawName = getHeader(event.headers, "x-file-name");
    let fileName = "document.pdf";

    if (rawName) {
      try {
        fileName = decodeURIComponent(rawName);
      } catch {
        fileName = rawName;
      }
    }

    fileName = cleanText(fileName.replace(/[\\/]/g, "_"), 160) || "document.pdf";

    if (contentType !== "application/pdf" && !fileName.toLowerCase().endsWith(".pdf")) {
      return jsonResponse(415, { error: "Please upload a PDF file." });
    }

    const pdfBuffer = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "binary");

    if (!pdfBuffer.length) {
      return jsonResponse(400, { error: "The uploaded PDF was empty." });
    }

    if (pdfBuffer.length > maxUploadBytes) {
      return jsonResponse(413, { error: "PDF is too large. Please upload a file smaller than 20 MB." });
    }

    const structured = await convertWithGemini(pdfBuffer, fileName);

    return jsonResponse(200, {
      fileName,
      structured,
    });
  } catch (error) {
    return jsonResponse(502, {
      error: error?.message || "Could not convert the PDF to Word.",
    });
  }
}

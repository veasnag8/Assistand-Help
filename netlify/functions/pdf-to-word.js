import { Buffer } from "node:buffer";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

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

function normalizeRuns(items, fallbackSize = 24) {
  const runs = Array.isArray(items) ? items : [];

  if (!runs.length) {
    return [new TextRun({ text: " " })];
  }

  return runs.map((item) => new TextRun({
    text: cleanText(item?.text, 12000) || " ",
    bold: Boolean(item?.bold),
    italics: Boolean(item?.italic),
    size: Math.max(16, Math.min(64, Math.round(Number(item?.size) || fallbackSize))),
  }));
}

function tableCellFromText(value) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: cleanText(value, 6000) || " " })] })],
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
  });
}

function blockToDocx(block, index) {
  const type = cleanText(block?.type, 24).toLowerCase();

  if (type === "heading") {
    const level = Number(block?.level);
    const headingLevel =
      level === 1 ? HeadingLevel.HEADING_1 :
      level === 2 ? HeadingLevel.HEADING_2 :
      level === 3 ? HeadingLevel.HEADING_3 :
      HeadingLevel.HEADING_2;

    return new Paragraph({
      heading: headingLevel,
      children: normalizeRuns(block?.runs || [{ text: block?.text }], 28),
      spacing: { after: 120, before: index === 0 ? 0 : 120 },
    });
  }

  if (type === "list") {
    const items = Array.isArray(block?.items) ? block.items : [];
    return items.map((item) => new Paragraph({
      text: cleanText(item, 8000) || " ",
      bullet: { level: 0 },
      spacing: { after: 60 },
    }));
  }

  if (type === "table") {
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    if (!rows.length) {
      return new Paragraph({ text: " " });
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map((row) => new TableRow({
        children: Array.isArray(row) ? row.map(tableCellFromText) : [tableCellFromText(row)],
      })),
    });
  }

  if (type === "page_break") {
    return new Paragraph({ text: "", pageBreakBefore: true });
  }

  return new Paragraph({
    children: normalizeRuns(block?.runs || [{ text: block?.text }], 24),
    spacing: { after: 120 },
  });
}

function buildDocxFromStructuredContent(payload, fallbackName) {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  const children = [];

  if (cleanText(payload?.title, 240)) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: cleanText(payload.title, 240), bold: true, size: 32 })],
      spacing: { after: 160 },
    }));
  }

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      children.push(new Paragraph({ text: "", pageBreakBefore: true }));
    }

    const pageTitle = cleanText(page?.title || `Page ${pageIndex + 1}`, 120);
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: pageTitle, bold: true, size: 24 })],
      spacing: { after: 120 },
    }));

    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    blocks.forEach((block, blockIndex) => {
      const item = blockToDocx(block, blockIndex);
      if (Array.isArray(item)) {
        children.push(...item);
      } else {
        children.push(item);
      }
    });
  });

  if (!children.length) {
    children.push(new Paragraph({ text: "No content could be extracted." }));
  }

  return new Document({
    sections: [{ children }],
    creator: "Assistand Help",
    title: fallbackName,
  });
}

function getModelName() {
  const model = cleanText(process.env.PDF_TO_WORD_MODEL || process.env.GEMINI_MODEL || defaultModel, 80).replace(/^models\//, "");
  return /^[a-z0-9_.-]+$/i.test(model) ? model : defaultModel;
}

async function readGeminiPayload(response) {
  const text = await response.text();
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
    "You convert PDFs into a Word-friendly structured JSON document.",
    "Preserve the original reading order, headings, paragraphs, bullet lists, tables, emphasis, and page breaks as closely as possible.",
    "Do not summarize, translate, or rewrite. Keep the original wording exactly where possible.",
    "If the PDF has scanned pages, OCR the visible text carefully.",
    "Return only valid JSON with this shape:",
    "{",
    '  "title": "short document title",',
    '  "pages": [',
    '    { "title": "Page 1", "blocks": [',
    '      { "type": "heading", "level": 1, "text": "..." },',
    '      { "type": "paragraph", "text": "..." },',
    '      { "type": "list", "items": ["...", "..."] },',
    '      { "type": "table", "rows": [["A", "B"], ["C", "D"]] }',
    "    ] }",
    "  ]",
    "}",
    "Use block.type values only from heading, paragraph, list, table.",
    "Keep tables as tables and do not flatten them into paragraphs.",
    "If a page has no readable text, still include it with an empty blocks array.",
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

  try {
    const structured = await convertWithGemini(pdfBuffer, fileName);
    const doc = buildDocxFromStructuredContent(structured, fileName);
    const docxBuffer = await Packer.toBuffer(doc);

    return {
      body: docxBuffer.toString("base64"),
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${fileName.replace(/\.pdf$/i, "")}-gemini.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      isBase64Encoded: true,
      statusCode: 200,
    };
  } catch (error) {
    return jsonResponse(502, {
      error: error?.message || "Could not convert the PDF to Word.",
    });
  }
}

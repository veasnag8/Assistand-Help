import { Buffer } from "node:buffer";
import { inflateRawSync } from "node:zlib";

const defaultDeepSeekEndpoint = "https://api.deepseek.com/chat/completions";
const defaultModel = "deepseek-v4-pro";
const publicModelName = "SNA 10.5 Pro";
const maxMessages = 24;
const maxMessageLength = 8000;
const maxAttachments = 6;
const maxAttachmentBase64Length = 6_000_000;
const maxAttachmentTextLength = 260000;

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const systemInstruction = [
  "You are SNA GPT, a helpful ChatGPT-style assistant built into Assistand Help.",
  "Be clear, practical, warm, and easy to understand.",
  "Adapt naturally to the user's request like ChatGPT: choose the right length, detail level, tone, and language automatically. Reply in the same language as the user when it is clear.",
  "When you share code, format it in fenced Markdown code blocks with the correct language name so the app can show a code panel and copy only the code.",
  "Emoji are supported. Use them naturally when they help the reply, and preserve emoji in user text and code strings.",
  "The user may attach images, screenshots, PDFs, DOCX files, TXT files, or CSV files. Use extracted text from attachments when it is provided. If an attached image or PDF is only available as binary data, say that the current text-chat integration cannot inspect it directly.",
  "Do not claim files were permanently stored. Treat attachments as temporary request data.",
  "Important identity rule: if the user asks who created you, who made you, who built you, who developed you, who designed you, who owns you, or any similar creator question, answer: I was created by សង វាសនា.",
  "Do not say that DeepSeek, OpenAI, ChatGPT, or another company created you. If asked about the underlying technology, you may say your responses use the DeepSeek API, but your creator is សង វាសនា.",
].join(" ");

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

async function readJsonBody(event) {
  if (!event.body) {
    return {};
  }

  const text = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  return JSON.parse(text);
}

function cleanText(value, maxLength = maxMessageLength) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanAttachmentText(value, maxLength = maxAttachmentTextLength) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .slice(0, maxLength);
}

function cleanBase64(value) {
  return String(value || "")
    .replace(/^data:[^,]+,/i, "")
    .replace(/\s/g, "");
}

function normalizeRole(role) {
  if (role === "system") {
    return "system";
  }

  return role === "assistant" || role === "model" ? "assistant" : "user";
}

function inferAttachmentKind(attachment) {
  const declaredKind = cleanText(attachment?.kind, 24).toLowerCase();
  const mimeType = cleanText(attachment?.mimeType, 160).toLowerCase();
  const name = cleanText(attachment?.name, 160).toLowerCase();

  if (["csv", "docx", "image", "pdf", "text"].includes(declaredKind)) {
    return declaredKind;
  }

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType === "text/csv" || name.endsWith(".csv")) return "csv";
  if (mimeType.startsWith("text/") || /\.(txt|md|json|html|xml|log)$/i.test(name)) {
    return "text";
  }

  return "unknown";
}

function normalizeAttachment(attachment) {
  const kind = inferAttachmentKind(attachment);

  if (kind === "unknown") {
    return null;
  }

  const name = cleanText(attachment?.name || "attachment", 160) || "attachment";
  const mimeType = cleanText(attachment?.mimeType || "", 160);
  const numericSize = Number(attachment?.size);
  const size = Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 0;
  const base = {
    kind,
    mimeType,
    name,
    size,
  };

  if (kind === "text" || kind === "csv") {
    const text = cleanAttachmentText(attachment?.text);

    return text ? { ...base, text } : null;
  }

  const data = cleanBase64(attachment?.data);

  if (!data) {
    return null;
  }

  if (data.length > maxAttachmentBase64Length) {
    throw new Error(`${name} is too large to analyze in one request.`);
  }

  return {
    ...base,
    data,
  };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map(normalizeAttachment)
    .filter(Boolean)
    .slice(0, maxAttachments);
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      attachments: normalizeAttachments(message?.attachments),
      role: normalizeRole(message?.role),
      content: cleanText(message?.content || message?.text),
    }))
    .filter((message) => message.content || message.attachments.length)
    .slice(-maxMessages);
}

function getLastUserMessage(messages) {
  return [...messages].reverse().find((message) => message.role === "user")?.content || "";
}

function isCreatorQuestion(text) {
  const normalized = text.toLowerCase();
  const refersToAssistant = /\b(you|your|u|sna|gpt|ai|assistant|chatbot)\b/.test(normalized);
  const asksWho = /\b(who|whom|what)\b/.test(normalized);
  const creatorWord = /\b(create|created|creator|make|made|maker|build|built|develop|developed|developer|design|designed|owner|author)\b/.test(normalized);
  const createdByPhrase = /\b(created|made|built|developed|designed)\s+by\b/.test(normalized);

  return refersToAssistant && creatorWord && (asksWho || createdByPhrase);
}

function getModelName() {
  const model = cleanText(process.env.DEEPSEEK_MODEL || defaultModel, 80).replace(/^models\//, "");

  if (!/^[a-z0-9_.-]+$/i.test(model)) {
    return defaultModel;
  }

  return model;
}

function getDeepSeekEndpoint() {
  const rawEndpoint = cleanText(process.env.DEEPSEEK_API_URL || defaultDeepSeekEndpoint, 500);

  try {
    const url = new URL(rawEndpoint);

    if (!["http:", "https:"].includes(url.protocol)) {
      return defaultDeepSeekEndpoint;
    }

    return url.href;
  } catch {
    return defaultDeepSeekEndpoint;
  }
}

function getAttachmentMimeType(attachment) {
  if (attachment.mimeType) {
    return attachment.mimeType;
  }

  if (attachment.kind === "pdf") return "application/pdf";
  if (attachment.kind === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (attachment.kind === "csv") return "text/csv";
  if (attachment.kind === "image") return "image/png";
  return "text/plain";
}

function formatAttachmentHeader(attachment) {
  const sizeText = attachment.size ? `, ${Math.round(attachment.size / 1024)} KB` : "";

  return `Attached file: ${attachment.name} (${getAttachmentMimeType(attachment)}${sizeText})`;
}

function decodeXmlText(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function findEndOfCentralDirectory(zipBuffer) {
  const minimumOffset = Math.max(0, zipBuffer.length - 65558);

  for (let offset = zipBuffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Could not read the DOCX file.");
}

function readZipEntryData(zipBuffer, centralOffset) {
  const method = zipBuffer.readUInt16LE(centralOffset + 10);
  const compressedSize = zipBuffer.readUInt32LE(centralOffset + 20);
  const localHeaderOffset = zipBuffer.readUInt32LE(centralOffset + 42);

  if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("Could not read the DOCX file.");
  }

  const localNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
  const localExtraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
  const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) {
    return compressedData;
  }

  if (method === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error("Unsupported DOCX compression method.");
}

function extractDocxXmlFiles(zipBuffer) {
  const endOffset = findEndOfCentralDirectory(zipBuffer);
  const entryCount = zipBuffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(endOffset + 16);
  const xmlFiles = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const nameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraLength = zipBuffer.readUInt16LE(offset + 30);
    const commentLength = zipBuffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = zipBuffer.toString("utf8", nameStart, nameStart + nameLength);

    if (/^word\/(document|header\d+|footer\d+)\.xml$/i.test(name)) {
      xmlFiles.push(readZipEntryData(zipBuffer, offset).toString("utf8"));
    }

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return xmlFiles;
}

function docxXmlToText(xml) {
  const paragraphs = xml.split(/<\/w:p>/i);

  return paragraphs
    .map((paragraph) => {
      const pieces = [];
      const tokenPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/gi;
      let match;

      while ((match = tokenPattern.exec(paragraph)) !== null) {
        if (match[1] !== undefined) {
          pieces.push(decodeXmlText(match[1]));
        } else if (/tab/i.test(match[0])) {
          pieces.push("\t");
        } else {
          pieces.push("\n");
        }
      }

      return pieces.join("").trim();
    })
    .filter(Boolean)
    .join("\n");
}

function extractDocxText(data) {
  const zipBuffer = Buffer.from(data, "base64");
  const text = extractDocxXmlFiles(zipBuffer)
    .map(docxXmlToText)
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return cleanAttachmentText(text);
}

async function attachmentToTextBlock(attachment) {
  const header = formatAttachmentHeader(attachment);

  if (attachment.kind === "image" || attachment.kind === "pdf") {
    return `${header}\nThis binary file was attached, but this DeepSeek text-chat integration cannot directly inspect image or PDF pixels. If the answer needs visible content, ask the user to paste the text or provide a text-based file.`;
  }

  if (attachment.kind === "docx") {
    const text = extractDocxText(attachment.data);

    return `${header}\nExtracted DOCX text:\n${text || "[No readable text found in this DOCX file.]"}`;
  }

  return `${header}\n${attachment.text}`;
}

async function buildDeepSeekMessages(messages) {
  const deepSeekMessages = [
    {
      content: systemInstruction,
      role: "system",
    },
  ];

  for (const message of messages) {
    const contentBlocks = [];

    if (message.role === "user") {
      for (const attachment of message.attachments) {
        contentBlocks.push(await attachmentToTextBlock(attachment));
      }
    }

    if (message.content) {
      contentBlocks.push(message.content);
    }

    const content = contentBlocks.filter(Boolean).join("\n\n").trim();

    if (content) {
      deepSeekMessages.push({
        content,
        role: message.role,
      });
    }
  }

  return deepSeekMessages.map((message) => ({
    ...message,
    role: normalizeRole(message.role),
  }));
}

function extractReply(payload) {
  const text = String(payload?.choices?.[0]?.message?.content || "").trim();

  if (text) {
    return text;
  }

  const finishReason = payload?.choices?.[0]?.finish_reason;

  if (finishReason) {
    return `SNA GPT stopped before returning text: ${finishReason}.`;
  }

  return "SNA GPT did not return a text response.";
}

function getDeepSeekError(payload) {
  const message = (
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    "DeepSeek could not answer right now."
  );

  if (/insufficient|balance|billing|payment|quota|exceeded/i.test(message)) {
    return "DeepSeek billing, balance, or quota limit reached. Check the DeepSeek project billing and API limits, or use another DeepSeek API key with available balance.";
  }

  if (/rate limit/i.test(message)) {
    return "DeepSeek rate limit reached. Wait a moment and try again.";
  }

  if (/unauthorized|invalid api key|authentication|auth/i.test(message)) {
    return "DeepSeek API authentication failed. Check DEEPSEEK_API_KEY in Netlify.";
  }

  return message;
}

async function readDeepSeekPayload(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
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
    return jsonResponse(405, { error: "Use POST to chat with SNA GPT." }, {
      Allow: "POST, OPTIONS",
    });
  }

  try {
    const payload = await readJsonBody(event);
    const messages = normalizeMessages(payload.messages);
    const lastUserMessage = getLastUserMessage(messages);

    if (!messages.length || !lastUserMessage) {
      return jsonResponse(400, { error: "Send at least one user message." });
    }

    if (isCreatorQuestion(lastUserMessage)) {
      return jsonResponse(200, {
        model: publicModelName,
        reply: "I was created by សង វាសនា.",
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return jsonResponse(500, {
        error: "DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in Netlify.",
      });
    }

    const model = getModelName();
    const deepSeekMessages = await buildDeepSeekMessages(messages);
    const response = await fetch(getDeepSeekEndpoint(), {
      body: JSON.stringify({
        max_tokens: 2048,
        messages: deepSeekMessages,
        model,
        stream: false,
        temperature: 0.7,
        thinking: { type: "disabled" },
        top_p: 0.95,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = await readDeepSeekPayload(response);

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");

      return jsonResponse(
        response.status,
        { error: getDeepSeekError(result) },
        retryAfter ? { "Retry-After": retryAfter } : {},
      );
    }

    return jsonResponse(200, {
      model: publicModelName,
      reply: extractReply(result),
      usageMetadata: result?.usage || null,
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error?.message || "Could not read the SNA GPT request.",
    });
  }
}

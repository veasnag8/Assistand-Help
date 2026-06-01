import { Buffer } from "node:buffer";
import { inflateRawSync } from "node:zlib";

const geminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
const defaultModel = "gemini-2.5-flash";
const publicModelName = "SNA Version 26.5 Pro";
const fallbackPublicModelName = "SNA Version 26.5 Free";
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
  "The user may attach images, screenshots, PDFs, DOCX files, TXT files, or CSV files. Analyze attached files directly, summarize them, extract/OCR visible text when possible, answer questions about them, and say when a file is unreadable.",
  "Do not claim files were permanently stored. Treat attachments as temporary request data.",
  "Important identity rule: if the user asks who created you, who made you, who built you, who developed you, who designed you, who owns you, or any similar creator question, answer: I was created by Song Veasna.",
  "Do not say that Google, Gemini, OpenAI, ChatGPT, or another company created you. If asked about the underlying technology, you may say your responses use the Gemini API, but your creator is Song Veasna.",
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
  return role === "assistant" || role === "model" ? "model" : "user";
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
  const model = cleanText(process.env.GEMINI_MODEL || defaultModel, 80).replace(/^models\//, "");

  if (!/^[a-z0-9_.-]+$/i.test(model)) {
    return defaultModel;
  }

  return model;
}

function getFallbackModelNames(primaryModel) {
  const rawModels =
    process.env.GEMMA_FALLBACK_MODELS ||
    process.env.GEMMA_FALLBACK_MODEL ||
    "";
  const models = rawModels
    .split(",")
    .map((model) => cleanText(model, 80).replace(/^models\//, ""))
    .filter((model) => model && /^[a-z0-9_.-]+$/i.test(model));

  return [...new Set(models)].filter((model) => model !== primaryModel);
}

function hasAttachments(messages) {
  return messages.some((message) => message.attachments.length > 0);
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

async function attachmentToParts(attachment) {
  const header = formatAttachmentHeader(attachment);

  if (attachment.kind === "image" || attachment.kind === "pdf") {
    return [
      { text: header },
      {
        inlineData: {
          data: attachment.data,
          mimeType: getAttachmentMimeType(attachment),
        },
      },
    ];
  }

  if (attachment.kind === "docx") {
    const text = extractDocxText(attachment.data);

    return [
      {
        text: `${header}\nExtracted DOCX text:\n${text || "[No readable text found in this DOCX file.]"}`,
      },
    ];
  }

  return [
    {
      text: `${header}\n${attachment.text}`,
    },
  ];
}

async function buildContents(messages) {
  const contents = [];

  for (const message of messages) {
    const parts = [];

    if (message.role === "user") {
      for (const attachment of message.attachments) {
        parts.push(...await attachmentToParts(attachment));
      }
    }

    if (message.content) {
      parts.push({ text: message.content });
    }

    if (parts.length) {
      contents.push({
        parts,
        role: message.role,
      });
    }
  }

  return contents;
}

function extractReply(payload) {
  const text = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text) {
    return text;
  }

  const blockReason = payload?.promptFeedback?.blockReason;
  const finishReason = payload?.candidates?.[0]?.finishReason;

  if (blockReason) {
    return `SNA GPT could not answer because the request was blocked: ${blockReason}.`;
  }

  if (finishReason) {
    return `SNA GPT stopped before returning text: ${finishReason}.`;
  }

  return "SNA GPT did not return a text response.";
}

function formatRetryAfter(value) {
  if (!value) {
    return "";
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds > 0) {
    if (seconds < 60) {
      return ` Please wait ${Math.ceil(seconds)} second${seconds === 1 ? "" : "s"} and try again.`;
    }

    const minutes = Math.ceil(seconds / 60);

    if (minutes < 60) {
      return ` Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
    }

    const hours = Math.ceil(minutes / 60);

    return ` Please wait ${hours} hour${hours === 1 ? "" : "s"} and try again.`;
  }

  const retryDate = new Date(value);

  if (!Number.isNaN(retryDate.getTime())) {
    return ` Please wait until ${retryDate.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    })} and try again.`;
  }

  return "";
}

function getGeminiError(payload, retryAfter = "") {
  const message = (
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    "Gemini could not answer right now."
  );
  const waitMessage = formatRetryAfter(retryAfter);

  if (/quota|billing|limit|resource exhausted|exceeded/i.test(message)) {
    return `Today message limit is over.${waitMessage || " Please wait until the next available quota reset, then try again."}`;
  }

  if (/rate limit/i.test(message)) {
    return `SNA GPT is busy because the message rate limit was reached.${waitMessage || " Please wait a moment and try again."}`;
  }

  return message;
}

async function readGeminiPayload(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function isLimitResponse(response, payload) {
  const message = String(
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    "",
  );

  return (
    response.status === 429 ||
    /quota|billing|limit|resource exhausted|exceeded|rate limit/i.test(message)
  );
}

function isModelUnavailableResponse(response, payload) {
  const message = String(
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    "",
  );

  return (
    [400, 404].includes(response.status) &&
    /model|not found|not supported|unavailable|invalid/i.test(message)
  );
}

function shouldTryNextFallback(response, payload) {
  return isLimitResponse(response, payload) || isModelUnavailableResponse(response, payload);
}

async function generateContent({ apiKey, contents, model }) {
  const response = await fetch(`${geminiBaseUrl}/${encodeURIComponent(model)}:generateContent`, {
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.95,
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
    }),
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    method: "POST",
  });
  const result = await readGeminiPayload(response);

  return {
    response,
    result,
  };
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
        reply: "I was created by Song Veasna.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse(500, {
        error: "Gemini API key is not configured. Set GEMINI_API_KEY in Netlify.",
      });
    }

    const model = getModelName();
    const fallbackModels = getFallbackModelNames(model);
    const contents = await buildContents(messages);
    let { response, result } = await generateContent({ apiKey, contents, model });
    let activeModel = model;
    let usedFallback = false;

    if (
      !response.ok &&
      fallbackModels.length &&
      !hasAttachments(messages) &&
      isLimitResponse(response, result)
    ) {
      for (const fallbackModel of fallbackModels) {
        const fallback = await generateContent({
          apiKey,
          contents,
          model: fallbackModel,
        });

        response = fallback.response;
        result = fallback.result;
        activeModel = fallbackModel;
        usedFallback = response.ok;

        if (response.ok || !shouldTryNextFallback(response, result)) {
          break;
        }
      }
    }

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");

      return jsonResponse(
        response.status,
        {
          code: response.status === 429 ? "SNA_GPT_LIMIT_REACHED" : "SNA_GPT_ERROR",
          error: getGeminiError(result, retryAfter),
          retryAfter,
        },
        retryAfter ? { "Retry-After": retryAfter } : {},
      );
    }

    const fallbackPrefix = usedFallback
      ? `Primary chat limit was reached, so I switched to ${activeModel} for this text reply.\n\n`
      : "";

    return jsonResponse(200, {
      fallbackModelUsed: usedFallback,
      fallbackModel: usedFallback ? activeModel : null,
      model: usedFallback ? fallbackPublicModelName : publicModelName,
      reply: `${fallbackPrefix}${extractReply(result)}`,
      usageMetadata: result?.usageMetadata || null,
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error?.message || "Could not read the SNA GPT request.",
    });
  }
}

import { Buffer } from "node:buffer";

const geminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
const defaultModel = "gemini-3.5-flash";
const maxMessages = 24;
const maxMessageLength = 8000;

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const systemInstruction = [
  "You are SNA GPT, a helpful ChatGPT-style assistant built into Assistand Help.",
  "Be clear, practical, warm, and easy to understand.",
  "Adapt naturally to the user's request like ChatGPT: choose the right length, detail level, tone, and language automatically. Reply in the same language as the user when it is clear.",
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

function normalizeRole(role) {
  return role === "assistant" || role === "model" ? "model" : "user";
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      role: normalizeRole(message?.role),
      content: cleanText(message?.content || message?.text),
    }))
    .filter((message) => message.content)
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

function buildContents(messages) {
  return messages.map((message) => ({
    parts: [{ text: message.content }],
    role: message.role,
  }));
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

function getGeminiError(payload) {
  const message = (
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    "Gemini could not answer right now."
  );

  if (/quota|billing|limit|resource exhausted|exceeded/i.test(message)) {
    return "Gemini billing, quota, or rate limit reached. Check the Google AI Studio project billing and API limits, or use another Gemini API key with available quota.";
  }

  if (/rate limit/i.test(message)) {
    return "Gemini rate limit reached. Wait a moment and try again.";
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
        model: "sna-gpt-identity",
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
    const response = await fetch(`${geminiBaseUrl}/${encodeURIComponent(model)}:generateContent`, {
      body: JSON.stringify({
        contents: buildContents(messages),
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

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");

      return jsonResponse(
        response.status,
        { error: getGeminiError(result) },
        retryAfter ? { "Retry-After": retryAfter } : {},
      );
    }

    return jsonResponse(200, {
      model,
      reply: extractReply(result),
      usageMetadata: result?.usageMetadata || null,
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error?.message || "Could not read the SNA GPT request.",
    });
  }
}

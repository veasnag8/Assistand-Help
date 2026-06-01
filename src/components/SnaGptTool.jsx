import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Moon,
  Paperclip,
  RefreshCw,
  Send,
  Gauge,
  Sun,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { readFileAsDataUrl } from "../lib/file-utils";
import {
  formatFileSize,
  getClipboardImageFile,
} from "../lib/ocr-utils";
import snaGptLogo from "../image/sna-gpt.png";

const snaGptEndpointPath = "/.netlify/functions/sna-gpt";
const chatStorageKey = "sna-gpt-chat-v1";
const sidebarStorageKey = "sna-gpt-sidebar-collapsed-v2";
const themeStorageKey = "sna-gpt-theme-v1";
const usageStorageKey = "sna-gpt-usage-v1";
const publicModelName = "SNA Version 26.5 Pro";
const dailyTokenLimit = Math.max(
  0,
  Number(import.meta.env.VITE_SNA_GPT_DAILY_TOKEN_LIMIT || 0),
);
const dailyMessageLimit = Math.max(
  0,
  Number(import.meta.env.VITE_SNA_GPT_DAILY_MESSAGE_LIMIT || 0),
);
const maxAttachments = 6;
const maxBinaryFileBytes = 4 * 1024 * 1024;
const maxTextFileBytes = 1.2 * 1024 * 1024;
const maxTextAttachmentLength = 260000;
const supportedAttachmentTypes =
  "image/*,application/pdf,.pdf,.docx,.txt,.csv,.md,.json,.html,.xml,.log";

const starterPrompts = [
  "Who created you?",
  "Help me write a professional message.",
  "Translate this text to Khmer.",
];
const providerCapacityMessage =
  "SNA GPT is busy because the model is experiencing high demand. Please try again in a moment.";

const languageAliases = {
  bash: "bash",
  css: "css",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  py: "python",
  python: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  xml: "html",
};

const commonKeywords = [
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "return",
  "static",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
];

const languageKeywords = {
  bash: [
    "case",
    "do",
    "done",
    "elif",
    "else",
    "esac",
    "fi",
    "for",
    "function",
    "if",
    "in",
    "then",
    "until",
    "while",
  ],
  python: [
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
  ],
  typescript: [
    "abstract",
    "as",
    "enum",
    "implements",
    "interface",
    "namespace",
    "private",
    "protected",
    "public",
    "readonly",
    "type",
  ],
};

const builtinWords = [
  "Array",
  "Boolean",
  "Date",
  "Error",
  "JSON",
  "Math",
  "Object",
  "Promise",
  "String",
  "console",
  "dict",
  "fetch",
  "int",
  "len",
  "list",
  "print",
  "range",
  "set",
  "str",
];

const literals = ["False", "None", "True", "false", "null", "true"];

const codeTokenPattern =
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|'''[\s\S]*?'''|"""[\s\S]*?"""|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|<\/?[A-Za-z][^>\n]*?>|\b[A-Za-z_$][\w$-]*(?=\s*\()|\b[A-Za-z_$][\w$-]*\b|\b\d+(?:\.\d+)?\b|[{}()[\].,;:+\-*/%=<>!&|^~?]+/g;

function createMessage(role, content, attachments = []) {
  const id = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    attachments,
    content,
    createdAt: new Date().toISOString(),
    id,
    role,
  };
}
function createWelcomeMessage() {
  return createMessage(
    "assistant",
    "Hello, I am SNA GPT. I was created by \u179F\u1784 \u179C\u17B6\u179F\u1793\u17B6. How can I help today?",
  );
}

function isProviderCapacityReply(text) {
  return /currently experiencing high demand|spikes in demand are usually temporary|please try again later/i.test(String(text || ""));
}

function normalizeMessageContent(message) {
  if (message?.role === "assistant" && isProviderCapacityReply(message.content)) {
    return providerCapacityMessage;
  }

  return message.content;
}

function loadStoredMessages() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(chatStorageKey) || "[]");

    if (Array.isArray(parsed) && parsed.length) {
      return parsed
        .filter((message) => message?.role && message?.content)
        .map((message) => ({
          ...message,
          attachments: Array.isArray(message.attachments) ? message.attachments : [],
          content: normalizeMessageContent(message),
        }))
        .slice(-40);
    }
  } catch {
    // Fall back to the welcome message.
  }

  return [createWelcomeMessage()];
}

function sanitizeAttachmentForStorage(attachment) {
  return {
    id: attachment.id,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    name: attachment.name,
    size: attachment.size,
  };
}

function sanitizeMessageForStorage(message) {
  return {
    ...message,
    attachments: (message.attachments || []).map(sanitizeAttachmentForStorage),
  };
}

function loadSidebarCollapsed() {
  return window.localStorage.getItem(sidebarStorageKey) !== "false";
}

function loadTheme() {
  return window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}

function createEmptyUsage() {
  return {
    dayKey: getTodayKey(),
    lastInputTokens: 0,
    lastOutputTokens: 0,
    lastTotalTokens: 0,
    limitMessage: "",
    requestsToday: 0,
    tokensToday: 0,
  };
}

function loadStoredUsage() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(usageStorageKey) || "{}");
    const emptyUsage = createEmptyUsage();

    if (parsed?.dayKey === emptyUsage.dayKey) {
      return {
        ...emptyUsage,
        ...parsed,
      };
    }
  } catch {
    // Fall back to a fresh daily usage view.
  }

  return createEmptyUsage();
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getTokenCount(usageMetadata, keys) {
  for (const key of keys) {
    const value = Number(usageMetadata?.[key]);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function summarizeUsageMetadata(usageMetadata) {
  const inputTokens = getTokenCount(usageMetadata, ["promptTokenCount", "inputTokenCount"]);
  const outputTokens = getTokenCount(usageMetadata, ["candidatesTokenCount", "outputTokenCount"]);
  const totalTokens = getTokenCount(usageMetadata, ["totalTokenCount"]) || inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function getRemainingTokens(tokensToday) {
  if (!dailyTokenLimit) {
    return null;
  }

  return Math.max(0, dailyTokenLimit - (Number(tokensToday) || 0));
}

function getRemainingMessages(requestsToday) {
  if (!dailyMessageLimit) {
    return null;
  }

  return Math.max(0, dailyMessageLimit - (Number(requestsToday) || 0));
}

function getUsageNote(usage) {
  if (usage.limitMessage) {
    return usage.limitMessage;
  }

  if (!dailyTokenLimit && !dailyMessageLimit) {
    return "Set daily token/message limits in Netlify to show remaining usage.";
  }

  const remainingMessages = getRemainingMessages(usage.requestsToday);

  if (remainingMessages !== null && remainingMessages <= 0) {
    return "Local chat counter reached today's message limit. Clear Chat resets this browser counter.";
  }

  const remainingTokens = getRemainingTokens(usage.tokensToday);

  if (remainingTokens !== null && remainingTokens <= 0) {
    return "Local token counter reached today's limit. Clear Chat resets this browser counter.";
  }

  return "Remaining usage is estimated from this browser's daily chat and token totals.";
}

function getSnaGptEndpoint() {
  return snaGptEndpointPath;
}

async function readJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const looksLikeHtml = /^\s*<!doctype|^\s*<html/i.test(text);

  if (looksLikeHtml) {
    throw new Error(
      "SNA GPT server returned the app page instead of JSON. Restart the app and try again.",
    );
  }

  throw new Error(text || fallbackMessage);
}

async function sendSnaGptMessage(messages, signal) {
  let response;

  try {
    response = await fetch(getSnaGptEndpoint(), {
      body: JSON.stringify({
        messages: messages.map((message) => ({
          attachments: (message.attachments || []).map((attachment) => ({
            data: attachment.data,
            kind: attachment.kind,
            mimeType: attachment.mimeType,
            name: attachment.name,
            size: attachment.size,
            text: attachment.text,
          })),
          content: message.content,
          role: message.role,
        })),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error("SNA GPT server is not available. Restart the app and try again.");
  }

  const result = await readJsonResponse(response, "Could not reach SNA GPT.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not reach SNA GPT.");
  }

  return result;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsText(file);
  });
}

function dataUrlToBase64(dataUrl) {
  return String(dataUrl).split(",")[1] || "";
}

function getFileExtension(name) {
  return (name || "").split(".").pop()?.toLowerCase() || "";
}

function getAttachmentKind(file) {
  const extension = getFileExtension(file.name);
  const mimeType = file.type || "";

  if (mimeType.startsWith("image/") || /^(png|jpe?g|webp|bmp|gif|tiff?)$/.test(extension)) {
    return "image";
  }

  if (mimeType === "application/pdf" || extension === "pdf") {
    return "pdf";
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return "docx";
  }

  if (
    mimeType.startsWith("text/") ||
    ["csv", "html", "json", "log", "md", "txt", "xml"].includes(extension)
  ) {
    return extension === "csv" ? "csv" : "text";
  }

  return "unknown";
}

function getAttachmentMimeType(file, kind) {
  if (file.type) {
    return file.type;
  }

  if (kind === "pdf") return "application/pdf";
  if (kind === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (kind === "csv") return "text/csv";
  if (kind === "image") return "image/png";
  return "text/plain";
}

function makeAttachmentId(file) {
  const randomPart = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return `${file.name || "file"}-${file.size}-${randomPart}`;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not prepare the image attachment."));
      }
    }, type, quality);
  });
}

function loadDataUrlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not open the image attachment."));
    image.src = dataUrl;
  });
}

async function prepareImageData(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);

  if (file.size <= maxBinaryFileBytes) {
    return {
      data: dataUrlToBase64(sourceDataUrl),
      mimeType: file.type || "image/png",
    };
  }

  const image = await loadDataUrlImage(sourceDataUrl);
  const width = image.naturalWidth || image.width || 1;
  const height = image.naturalHeight || image.height || 1;
  const scale = Math.min(1, 1800 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the image attachment.");
  }

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressedBlob = await canvasToBlob(canvas, "image/jpeg", 0.86);

  if (compressedBlob.size > maxBinaryFileBytes) {
    throw new Error(`${file.name} is too large. Use an image under ${formatFileSize(maxBinaryFileBytes)}.`);
  }

  const compressedDataUrl = await readFileAsDataUrl(
    new File([compressedBlob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    }),
  );

  return {
    data: dataUrlToBase64(compressedDataUrl),
    mimeType: "image/jpeg",
  };
}

async function prepareAttachment(file) {
  const kind = getAttachmentKind(file);
  const mimeType = getAttachmentMimeType(file, kind);
  const base = {
    id: makeAttachmentId(file),
    kind,
    mimeType,
    name: file.name || "attachment",
    size: file.size || 0,
  };

  if (kind === "unknown") {
    throw new Error(`${file.name} is not supported.`);
  }

  if (kind === "text" || kind === "csv") {
    if (file.size > maxTextFileBytes) {
      throw new Error(`${file.name} is too large. Use a text/CSV file under ${formatFileSize(maxTextFileBytes)}.`);
    }

    return {
      ...base,
      text: (await readFileAsText(file)).slice(0, maxTextAttachmentLength),
    };
  }

  if (kind === "image") {
    return {
      ...base,
      ...(await prepareImageData(file)),
    };
  }

  if (file.size > maxBinaryFileBytes) {
    throw new Error(`${file.name} is too large. Use a file under ${formatFileSize(maxBinaryFileBytes)}.`);
  }

  return {
    ...base,
    data: dataUrlToBase64(await readFileAsDataUrl(file)),
  };
}

function getAttachmentIcon(kind) {
  if (kind === "image") return ImageIcon;
  if (kind === "csv") return FileSpreadsheet;
  return FileText;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseMessageParts(content) {
  const parts = [];
  const fencePattern = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = fencePattern.exec(content)) !== null) {
    const [block, rawLanguage = "", rawCode = ""] = match;
    const text = content.slice(lastIndex, match.index);

    if (text) {
      parts.push({
        content: text,
        type: "text",
      });
    }

    parts.push({
      code: rawCode.replace(/\n$/, ""),
      language: rawLanguage.trim(),
      type: "code",
    });

    lastIndex = match.index + block.length;
  }

  const trailingText = content.slice(lastIndex);

  if (trailingText || !parts.length) {
    parts.push({
      content: trailingText || content,
      type: "text",
    });
  }

  return parts;
}

function getSyntaxLanguage(language) {
  const normalized = String(language || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");

  return languageAliases[normalized] || normalized || "text";
}

function getTokenClass(token, code, tokenEnd, syntaxSets) {
  if (/^(\/\*|\/\/|#)/.test(token)) {
    return "token-comment";
  }

  if (/^(['"`])/.test(token)) {
    return "token-string";
  }

  if (/^<\/?[A-Za-z]/.test(token)) {
    return "token-tag";
  }

  if (/^\d/.test(token)) {
    return "token-number";
  }

  if (syntaxSets.literals.has(token)) {
    return "token-literal";
  }

  if (syntaxSets.keywords.has(token)) {
    return "token-keyword";
  }

  if (syntaxSets.builtins.has(token)) {
    return "token-builtin";
  }

  if (
    /^[A-Za-z_$][\w$-]*$/.test(token) &&
    code.slice(tokenEnd).trimStart().startsWith("(")
  ) {
    return "token-function";
  }

  if (/^[{}()[\].,;:+\-*/%=<>!&|^~?]+$/.test(token)) {
    return "token-operator";
  }

  return "";
}

function highlightCode(code, language) {
  const syntaxLanguage = getSyntaxLanguage(language);
  const syntaxSets = {
    builtins: new Set(builtinWords),
    keywords: new Set([
      ...commonKeywords,
      ...(languageKeywords[syntaxLanguage] || []),
    ]),
    literals: new Set(literals),
  };
  const fragments = [];
  let lastIndex = 0;
  let match;

  codeTokenPattern.lastIndex = 0;

  while ((match = codeTokenPattern.exec(code)) !== null) {
    const token = match[0];
    const tokenClass = getTokenClass(
      token,
      code,
      match.index + token.length,
      syntaxSets,
    );

    if (match.index > lastIndex) {
      fragments.push(code.slice(lastIndex, match.index));
    }

    fragments.push(
      tokenClass ? (
        <span className={tokenClass} key={`${match.index}-${token}`}>
          {token}
        </span>
      ) : (
        token
      ),
    );

    lastIndex = match.index + token.length;
  }

  if (lastIndex < code.length) {
    fragments.push(code.slice(lastIndex));
  }

  return fragments;
}

function CodeBlock({ code, language, onCopy }) {
  const [copied, setCopied] = useState(false);
  const label = language || "Code";

  async function handleCopy() {
    const didCopy = await onCopy(code, "Code copied.");

    if (didCopy) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <div className="sna-code-block">
      <div className="sna-code-header">
        <span>{label}</span>
        <button
          className="sna-code-copy"
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label} code`}
          title="Copy code"
        >
          {copied ? (
            <Check size={14} strokeWidth={2.4} />
          ) : (
            <Copy size={14} strokeWidth={2.2} />
          )}
          <span>{copied ? "Copied" : "Copy code"}</span>
        </button>
      </div>
      <pre>
        <code>{highlightCode(code, language)}</code>
      </pre>
    </div>
  );
}

function renderInlineMarkdown(text, keyPrefix) {
  const nodes = [];
  const pattern = /(`[^`]+`|\*\*[^*\n][\s\S]*?\*\*|\*[^*\n][^*\n]*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (token.startsWith("`")) {
      nodes.push(
        <code className="sna-inline-code" key={`${keyPrefix}-code-${match.index}`}>
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={`${keyPrefix}-em-${match.index}`}>
          {token.slice(1, -1)}
        </em>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderTextBlock(content, keyPrefix) {
  const lines = String(content || "").split(/\r?\n/);
  const blocks = [];
  let listItems = [];

  function flushList(index) {
    if (!listItems.length) {
      return;
    }

    blocks.push(
      <ul className="sna-message-list-markdown" key={`${keyPrefix}-list-${index}`}>
        {listItems}
      </ul>,
    );
    listItems = [];
  }

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const bulletMatch = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);

    if (headingMatch) {
      const HeadingTag = `h${Math.min(headingMatch[1].length + 1, 6)}`;

      flushList(index);
      blocks.push(
        <HeadingTag className="sna-message-heading" key={`${keyPrefix}-heading-${index}`}>
          {renderInlineMarkdown(headingMatch[2], `${keyPrefix}-heading-${index}`)}
        </HeadingTag>,
      );
      return;
    }

    if (bulletMatch) {
      listItems.push(
        <li key={`${keyPrefix}-item-${index}`}>
          {renderInlineMarkdown(bulletMatch[1], `${keyPrefix}-item-${index}`)}
        </li>,
      );
      return;
    }

    flushList(index);

    if (!line.trim()) {
      blocks.push(<br key={`${keyPrefix}-break-${index}`} />);
      return;
    }

    blocks.push(
      <p key={`${keyPrefix}-paragraph-${index}`}>
        {renderInlineMarkdown(line, `${keyPrefix}-paragraph-${index}`)}
      </p>,
    );
  });

  flushList(lines.length);

  return blocks;
}

function MessageContent({ content, onCopy }) {
  return (
    <div className="sna-message-content">
      {parseMessageParts(content).map((part, index) => (
        part.type === "code" ? (
          <CodeBlock
            code={part.code}
            key={`${part.type}-${index}`}
            language={part.language}
            onCopy={onCopy}
          />
        ) : (
          <div className="sna-message-text" key={`${part.type}-${index}`}>
            {renderTextBlock(part.content, `${part.type}-${index}`)}
          </div>
        )
      ))}
    </div>
  );
}

function AnimatedMessageContent({ animate, content, messageId, onCopy, onStep }) {
  const [visibleLength, setVisibleLength] = useState(() => (animate ? 0 : content.length));
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  useEffect(() => {
    if (!animate || reduceMotion) {
      setVisibleLength(content.length);
      return undefined;
    }

    let frameId = 0;
    let lastTime = 0;
    let done = false;

    setVisibleLength(0);

    function reveal(timestamp) {
      if (!lastTime || timestamp - lastTime >= 12) {
        lastTime = timestamp;
        setVisibleLength((current) => {
          if (current >= content.length) {
            done = true;
            return current;
          }

          const remaining = content.length - current;
          const chunkSize = Math.max(6, Math.ceil(remaining / 34));
          const nextLength = Math.min(content.length, current + chunkSize);
          done = nextLength >= content.length;
          onStep?.();
          return nextLength;
        });
      }

      if (!done) {
        frameId = window.requestAnimationFrame(reveal);
      }
    }

    frameId = window.requestAnimationFrame(reveal);
    return () => window.cancelAnimationFrame(frameId);
  }, [animate, content, messageId, onStep, reduceMotion]);

  const visibleContent = animate ? content.slice(0, visibleLength) : content;
  const isWriting = animate && visibleLength < content.length;

  return (
    <>
      <MessageContent content={visibleContent} onCopy={onCopy} />
      {isWriting ? <span className="sna-writing-cursor" aria-hidden="true" /> : null}
    </>
  );
}

function ChatMessage({ animate, message, onCopy, onStep }) {
  const isUser = message.role === "user";
  const attachments = message.attachments || [];
  const displayMessage = isUser
    ? message
    : {
      ...message,
      content: normalizeMessageContent(message),
    };

  return (
    <article className={`sna-message ${isUser ? "is-user" : "is-assistant"}`}>
      <span className="sna-message-avatar" aria-hidden="true">
        {isUser ? (
          <UserRound size={20} strokeWidth={2.1} />
        ) : (
          <img src={snaGptLogo} alt="" />
        )}
      </span>
      <div className="sna-message-bubble">
        <div className="sna-message-top">
          <strong>{isUser ? "You" : "SNA GPT"}</strong>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        {attachments.length ? (
          <AttachmentList attachments={attachments} />
        ) : null}
        <AnimatedMessageContent
          animate={animate}
          content={displayMessage.content}
          messageId={message.id}
          onCopy={onCopy}
          onStep={onStep}
        />
        {!isUser ? (
          <button
            className="sna-copy-button"
            type="button"
            onClick={() => onCopy(displayMessage.content)}
            aria-label="Copy SNA GPT message"
            title="Copy"
          >
            <Copy size={15} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function AttachmentList({ attachments, onRemove }) {
  return (
    <div className="sna-attachment-list">
      {attachments.map((attachment) => {
        const Icon = getAttachmentIcon(attachment.kind);

        return (
          <div className="sna-attachment-chip" key={attachment.id || attachment.name}>
            <Icon size={16} strokeWidth={2.2} />
            <span>{attachment.name}</span>
            <small>{formatFileSize(attachment.size)}</small>
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                aria-label={`Remove ${attachment.name}`}
                title="Remove"
              >
                <X size={14} strokeWidth={2.3} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SnaGptTool({ onBack }) {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [theme, setTheme] = useState(loadTheme);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(publicModelName);
  const [freeMode, setFreeMode] = useState(false);
  const [hideFreeModeNote, setHideFreeModeNote] = useState(false);
  const [usage, setUsage] = useState(loadStoredUsage);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const requestRef = useRef(null);

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !busy;
  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const showStarterPrompts =
    !busy &&
    messages.length === 1 &&
    messages[0]?.role === "assistant" &&
    !messages[0]?.attachments?.length;

  useEffect(() => {
    window.localStorage.setItem(
      chatStorageKey,
      JSON.stringify(messages.slice(-40).map(sanitizeMessageForStorage)),
    );
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(usageStorageKey, JSON.stringify(usage));
  }, [usage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      behavior: "smooth",
      top: scrollRef.current.scrollHeight,
    });
  }, [messages, busy]);

  function scrollMessagesToBottom() {
    scrollRef.current?.scrollTo({
      behavior: "smooth",
      top: scrollRef.current.scrollHeight,
    });
  }

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    function handlePaste(event) {
      if (busy) {
        return;
      }

      const pastedFile = getClipboardImageFile(event.clipboardData);

      if (!pastedFile) {
        return;
      }

      event.preventDefault();
      addFiles([pastedFile]);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [busy, attachments]);

  function clearChat() {
    requestRef.current?.abort();
    setBusy(false);
    setAttachments([]);
    setFreeMode(false);
    setHideFreeModeNote(false);
    setModel(publicModelName);
    setMessages([createWelcomeMessage()]);
    setUsage(createEmptyUsage());
    setStatus("Ready.");
  }

  async function copyText(text, successMessage = "Copied.") {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(successMessage);
      return true;
    } catch {
      setStatus("Could not copy.");
      return false;
    }
  }

  async function addFiles(files) {
    const incomingFiles = Array.from(files || []).filter(Boolean);

    if (!incomingFiles.length) {
      return;
    }

    if (freeMode) {
      setStatus("File upload is disabled in SNA Version 26.5 Free. Start a new chat when Pro is available.");
      return;
    }

    const remainingSlots = maxAttachments - attachments.length;

    if (remainingSlots <= 0) {
      setStatus(`Maximum ${maxAttachments} files per message.`);
      return;
    }

    setStatus("Preparing attachment...");

    try {
      const prepared = [];

      for (const file of incomingFiles.slice(0, remainingSlots)) {
        prepared.push(await prepareAttachment(file));
      }

      setAttachments((current) => [...current, ...prepared].slice(0, maxAttachments));
      setStatus(`${prepared.length} file${prepared.length === 1 ? "" : "s"} attached.`);
    } catch (error) {
      setStatus(error?.message || "Could not attach that file.");
    }
  }

  function removeAttachment(id) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  async function submitMessage(text = draft) {
    const rawContent = text.trim();

    if ((!rawContent && !attachments.length) || busy) {
      return;
    }

    const content = rawContent || "Analyze the attached file(s).";
    const messageAttachments = attachments;
    const userMessage = createMessage("user", content, messageAttachments);
    const nextMessages = [...messages, userMessage];
    const controller = new AbortController();

    requestRef.current?.abort();
    requestRef.current = controller;

    setMessages(nextMessages);
    setDraft("");
    setAttachments([]);
    setBusy(true);
    setStatus("Thinking...");

    try {
      const result = await sendSnaGptMessage(nextMessages, controller.signal);
      const reply = result.reply || "SNA GPT did not return a response.";

      if (isProviderCapacityReply(reply)) {
        throw new Error(providerCapacityMessage);
      }

      const assistantMessage = createMessage("assistant", reply);
      const tokenUsage = summarizeUsageMetadata(result.usageMetadata);
      const uploadSupported = result.fileUploadSupported !== false;

      setMessages([...nextMessages, assistantMessage]);
      setModel(result.model || publicModelName);
      setFreeMode(!uploadSupported);
      setHideFreeModeNote(false);
      setUsage((current) => {
        const emptyUsage = createEmptyUsage();
        const dailyUsage = current.dayKey === emptyUsage.dayKey ? current : emptyUsage;

        return {
          ...dailyUsage,
          lastInputTokens: tokenUsage.inputTokens,
          lastOutputTokens: tokenUsage.outputTokens,
          lastTotalTokens: tokenUsage.totalTokens,
          limitMessage: "",
          requestsToday: dailyUsage.requestsToday + 1,
          tokensToday: dailyUsage.tokensToday + tokenUsage.totalTokens,
        };
      });
      setStatus(tokenUsage.totalTokens ? `Ready. Used ${formatNumber(tokenUsage.totalTokens)} tokens.` : "Ready.");
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("Stopped.");
        return;
      }

      const rawMessage = error?.message || "Could not reach SNA GPT.";
      const message = isProviderCapacityReply(rawMessage) ? providerCapacityMessage : rawMessage;
      const shouldUseFreeTextMode = /SNA Version 26\.5 Free|file upload is not supported/i.test(message);

      setMessages([
        ...nextMessages,
        createMessage("assistant", message),
      ]);
      if (shouldUseFreeTextMode) {
        setFreeMode(true);
        setHideFreeModeNote(false);
        setModel("SNA Version 26.5 Free");
      }
      setUsage((current) => ({
        ...current,
        limitMessage: /limit|quota|wait|over/i.test(message) ? message : current.limitMessage,
      }));
      setStatus(/limit|quota|wait|over/i.test(message) ? "Limit reached." : "Error.");
    } finally {
      setBusy(false);
      requestRef.current = null;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  function handleDragOver(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) {
      return;
    }

    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event) {
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
      setDragActive(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <section
      className={`sna-gpt-tool is-${theme}-mode${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${dragActive ? " is-dragging-file" : ""}`}
      aria-labelledby="sna-gpt-title"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <aside className="sna-sidebar">
        <button
          className="sna-sidebar-toggle"
          type="button"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? "Show SNA GPT sidebar" : "Hide SNA GPT sidebar"}
          title={sidebarCollapsed ? "Show" : "Hide"}
        >
          {sidebarCollapsed ? (
            <ChevronRight size={18} strokeWidth={2.3} />
          ) : (
            <ChevronLeft size={18} strokeWidth={2.3} />
          )}
        </button>

        <div className="sna-brand-panel">
          <span className="sna-brand-icon" aria-hidden="true">
            <img src={snaGptLogo} alt="" />
          </span>
          <div>
            <p className="eyebrow">SNA GPT</p>
            <h1 id="sna-gpt-title">SNA GPT</h1>
            <span>Created by {"\u179F\u1784 \u179C\u17B6\u179F\u1793\u17B6"}</span>
          </div>
        </div>

        <div className="sna-side-actions">
          <div className="sna-usage-panel" aria-label="SNA GPT usage">
            <div className="sna-usage-title">
              <Gauge size={16} strokeWidth={2.2} />
              <span>Usage</span>
            </div>
            <dl>
              <div>
                <dt>Today</dt>
                <dd>{formatNumber(usage.tokensToday)} tokens</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>
                  {dailyTokenLimit
                    ? `${formatNumber(getRemainingTokens(usage.tokensToday))} tokens`
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt>Messages</dt>
                <dd>{formatNumber(usage.requestsToday)}</dd>
              </div>
              <div>
                <dt>Chats left</dt>
                <dd>
                  {dailyMessageLimit
                    ? formatNumber(getRemainingMessages(usage.requestsToday))
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt>Last</dt>
                <dd>{formatNumber(usage.lastTotalTokens)} tokens</dd>
              </div>
            </dl>
            <p>{getUsageNote(usage)}</p>
          </div>
          <button className="button secondary" type="button" onClick={clearChat}>
            <Trash2 size={16} strokeWidth={2.2} />
            <span>Clear Chat</span>
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() => latestAssistantMessage && copyText(latestAssistantMessage.content)}
            disabled={!latestAssistantMessage}
          >
            <Copy size={16} strokeWidth={2.2} />
            <span>Copy Last</span>
          </button>
        </div>
      </aside>

      <div className="sna-chat-panel">
        <header className="sna-chat-header">
          <div className="sna-chat-title-row">
            <button
              className="sna-chat-back"
              type="button"
              onClick={onBack}
              aria-label="Back to categories"
              title="Main Categories"
            >
              <ArrowLeft size={18} strokeWidth={2.4} />
            </button>
            <div className="sna-chat-title">
              <strong>SNA GPT Chat</strong>
              <span>{model}</span>
            </div>
          </div>
          <div className="sna-status" role="status">
            {busy ? <RefreshCw size={15} strokeWidth={2.2} /> : null}
            <span>{status}</span>
          </div>
          <button
            className="sna-theme-toggle"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <Sun size={17} strokeWidth={2.3} />
            ) : (
              <Moon size={17} strokeWidth={2.3} />
            )}
          </button>
        </header>

        <div className="sna-message-list" ref={scrollRef} aria-live="polite">
          {messages.map((message) => (
            <ChatMessage
              animate={message.role === "assistant" && message.id === latestAssistantMessage?.id && !busy}
              key={message.id}
              message={message}
              onCopy={copyText}
              onStep={scrollMessagesToBottom}
            />
          ))}
          {busy ? (
            <article className="sna-message is-assistant">
              <span className="sna-message-avatar" aria-hidden="true">
                <img src={snaGptLogo} alt="" />
              </span>
              <div className="sna-message-bubble sna-typing">
                <span />
                <span />
                <span />
              </div>
            </article>
          ) : null}
        </div>

        {showStarterPrompts ? (
          <div className="sna-prompt-strip">
            {starterPrompts.map((prompt) => (
              <button
                className="sna-prompt-chip"
                disabled={busy}
                key={prompt}
                type="button"
                onClick={() => submitMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <form className="sna-composer" onSubmit={handleSubmit}>
          {freeMode && !hideFreeModeNote ? (
            <div className="sna-free-mode-note" role="status">
              <span>SNA Version 26.5 Free is active. File upload is disabled until Pro is available again.</span>
              <button
                type="button"
                onClick={() => setHideFreeModeNote(true)}
                aria-label="Hide free mode notice"
                title="Hide"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          ) : null}
          <div className="sna-composer-main">
            {attachments.length ? (
              <AttachmentList attachments={attachments} onRemove={removeAttachment} />
            ) : null}
            <div className="sna-composer-row">
              <button
                className="sna-attach-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={freeMode || busy || attachments.length >= maxAttachments}
                aria-label="Attach files"
                title={freeMode ? "File upload is disabled in SNA Version 26.5 Free" : "Attach files"}
              >
                <Paperclip size={20} strokeWidth={2.3} />
              </button>
              <textarea
                aria-label="Message SNA GPT"
                maxLength={6000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message SNA GPT"
                rows={1}
                value={draft}
              />
            </div>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept={supportedAttachmentTypes}
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          <button className="sna-send-button" type="submit" disabled={!canSend} aria-label="Send message">
            <Send size={20} strokeWidth={2.3} />
          </button>
        </form>
        <div className="sna-drop-overlay" aria-hidden="true">
          <div>
            <Paperclip size={28} strokeWidth={2.1} />
            <span>Drop files to attach</span>
          </div>
        </div>
      </div>
    </section>
  );
}

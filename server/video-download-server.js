import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import ffmpegStaticPath from "ffmpeg-static";

function loadLocalEnvFile() {
  const envPath = path.resolve(".env");

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/g);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const quote = rawValue[0];
    const value = (quote === "\"" || quote === "'") && rawValue.at(-1) === quote
      ? rawValue.slice(1, -1)
      : rawValue;

    process.env[key] = value;
  }
}

loadLocalEnvFile();

const port = Number(process.env.VIDEO_SERVER_PORT || 5454);
const host = process.env.VIDEO_SERVER_HOST || "127.0.0.1";
const publicServerUrl = String(
  process.env.PUBLIC_VIDEO_SERVER_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://${host}:${port}`,
).replace(/\/+$/, "");
const downloadRoot = path.join(tmpdir(), "aisupport-video-downloads");
const maxRequestBytes = 64 * 1024;
const downloadTtlMs = 60 * 60 * 1000;
const videoQualities = new Set(["max", "1080", "720", "480", "360", "240", "144"]);
const audioBitrates = new Set(["320", "256", "128", "96", "64", "8"]);
const downloads = new Map();
const jobs = new Map();
const telegramDownloadChoices = new Map();
const telegramBotToken = cleanText(process.env.TELEGRAM_BOT_TOKEN, 300);
const telegramPollingEnabled = cleanText(process.env.TELEGRAM_BOT_ENABLED, 20).toLowerCase() !== "false";
const telegramApiBaseUrl = telegramBotToken
  ? `https://api.telegram.org/bot${telegramBotToken}`
  : "";
const wakePingEnabled = cleanText(process.env.RENDER_WAKE_PING_ENABLED, 20).toLowerCase() !== "false";
const wakePingIntervalMs = Math.max(
  60 * 1000,
  Number(process.env.RENDER_WAKE_PING_INTERVAL_MS || 10 * 60 * 1000),
);
let telegramUpdateOffset = Number(process.env.TELEGRAM_UPDATE_OFFSET || 0);

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    ...corsHeaders,
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendOptions(response) {
  response.writeHead(204, corsHeaders);
  response.end();
}

function cleanText(value, maxLength = 2000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function parseMediaUrl(value) {
  try {
    const url = new URL(cleanText(value, 2000));

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function getPlatform(url) {
  const hostName = url.hostname.toLowerCase().replace(/^www\./, "");

  if (
    hostName === "youtu.be" ||
    hostName === "youtube.com" ||
    hostName.endsWith(".youtube.com") ||
    hostName === "youtube-nocookie.com" ||
    hostName.endsWith(".youtube-nocookie.com")
  ) {
    return "YouTube";
  }

  if (
    hostName === "tiktok.com" ||
    hostName.endsWith(".tiktok.com") ||
    hostName === "vm.tiktok.com" ||
    hostName === "vt.tiktok.com"
  ) {
    return "TikTok";
  }

  if (
    hostName === "facebook.com" ||
    hostName.endsWith(".facebook.com") ||
    hostName === "fb.watch" ||
    hostName.endsWith(".fb.watch") ||
    hostName === "fb.com" ||
    hostName.endsWith(".fb.com")
  ) {
    return "Facebook";
  }

  return "";
}

function getPublicUrl(pathname) {
  const pathValue = String(pathname || "");

  return `${publicServerUrl}${pathValue.startsWith("/") ? pathValue : `/${pathValue}`}`;
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function setJobProgress(job, progress, stage = job.stage) {
  job.progress = clampProgress(Math.max(job.progress || 0, progress));
  job.stage = stage;
  job.updatedAt = Date.now();
}

function parseYtDlpProgress(text, job, format) {
  const lines = String(text || "").split(/\r?\n|\r/g).filter(Boolean);

  for (const line of lines) {
    const percentMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);

    if (percentMatch) {
      const rawPercent = Number(percentMatch[1]);
      const mappedProgress = format === "mp3"
        ? 5 + rawPercent * 0.78
        : 5 + rawPercent * 0.9;

      setJobProgress(job, mappedProgress, "Downloading media");
      continue;
    }

    if (/\[(extractaudio|ffmpeg|videoconvertor|merger|postprocessor)\]/i.test(line)) {
      setJobProgress(job, format === "mp3" ? 88 : 94, "Converting file");
    }
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxRequestBytes) {
        request.destroy(new Error("Request body is too large."));
        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function readJsonBody(request) {
  const text = await readRequestBody(request);

  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

function getFfmpegPath() {
  return cleanText(process.env.FFMPEG_PATH, 1000) || ffmpegStaticPath || "ffmpeg";
}

function getYtDlpCommandCandidates() {
  const configuredPath = cleanText(process.env.YTDLP_PATH, 1000);

  if (configuredPath) {
    return [{ args: [], command: configuredPath }];
  }

  return [
    { args: [], command: "yt-dlp" },
    { args: ["-m", "yt_dlp"], command: "python" },
    { args: ["-m", "yt_dlp"], command: "py" },
  ];
}

function getYtDlpCookieStatus() {
  return {
    cookiesBase64: Boolean(cleanText(process.env.YTDLP_COOKIES_BASE64, 500000)),
    cookiesFromBrowser: Boolean(cleanText(process.env.YTDLP_COOKIES_FROM_BROWSER, 200)),
    cookiesPath: Boolean(cleanText(process.env.YTDLP_COOKIES_PATH, 1000)),
  };
}

function decodeCookiesBase64(value) {
  const normalizedValue = cleanText(value, 500000).replace(/\s+/g, "");

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedValue)) {
    throw new Error(
      "YTDLP_COOKIES_BASE64 must be the encoded cookies.txt value, not the PowerShell commands.",
    );
  }

  const text = Buffer.from(normalizedValue, "base64").toString("utf8");
  const hasNetscapeHeader = text.includes("# Netscape HTTP Cookie File");
  const hasCookieRows = /^\S+\t(?:TRUE|FALSE)\t\S+\t(?:TRUE|FALSE)\t\d+\t\S+\t/m.test(text);

  if (!hasNetscapeHeader && !hasCookieRows) {
    throw new Error(
      "YTDLP_COOKIES_BASE64 does not look like a base64-encoded Netscape cookies.txt file.",
    );
  }

  return text;
}

function getYtDlpAuthArgs() {
  const cookiesPath = cleanText(process.env.YTDLP_COOKIES_PATH, 1000);
  const cookiesFromBrowser = cleanText(process.env.YTDLP_COOKIES_FROM_BROWSER, 200);
  const cookiesBase64 = cleanText(process.env.YTDLP_COOKIES_BASE64, 500000);

  if (cookiesPath) {
    return ["--cookies", cookiesPath];
  }

  if (cookiesBase64) {
    const generatedCookiesPath = path.join(downloadRoot, "yt-dlp-cookies.txt");

    writeFileSync(generatedCookiesPath, decodeCookiesBase64(cookiesBase64), {
      mode: 0o600,
    });

    return ["--cookies", generatedCookiesPath];
  }

  if (cookiesFromBrowser) {
    return ["--cookies-from-browser", cookiesFromBrowser];
  }

  return [];
}

function getYtDlpJavaScriptArgs(platform) {
  const configuredRuntimes = cleanText(process.env.YTDLP_JS_RUNTIMES, 1000);
  const configuredRemoteComponents = cleanText(process.env.YTDLP_REMOTE_COMPONENTS, 1000);
  const nodeMajorVersion = Number(process.versions.node.split(".")[0]);
  const canUseNodeSolver = nodeMajorVersion >= 22;
  const normalizedRuntimes = configuredRuntimes === "node" && !canUseNodeSolver
    ? "deno"
    : configuredRuntimes;
  const runtimes = normalizedRuntimes || (platform === "YouTube" ? "deno" : "");
  const remoteComponents = configuredRemoteComponents || (platform === "YouTube" ? "ejs:github" : "");
  const args = [];

  if (runtimes) {
    args.push("--js-runtimes", runtimes);
  }

  if (remoteComponents) {
    args.push("--remote-components", remoteComponents);
  }

  return args;
}

function getEffectiveYtDlpJavaScriptRuntime() {
  const configuredRuntimes = cleanText(process.env.YTDLP_JS_RUNTIMES, 1000);
  const nodeMajorVersion = Number(process.versions.node.split(".")[0]);

  if (configuredRuntimes === "node" && nodeMajorVersion < 22) {
    return "deno";
  }

  return configuredRuntimes || "deno";
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { onOutput, ...spawnOptions } = options;
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      ...spawnOptions,
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onOutput?.(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onOutput?.(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(stderr.trim() || stdout.trim() || `${command} exited with ${code}.`);
      error.code = code;
      reject(error);
    });
  });
}

async function resolveYtDlpCommand() {
  const candidates = getYtDlpCommandCandidates();

  for (const candidate of candidates) {
    try {
      await runProcess(candidate.command, [...candidate.args, "--version"]);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    "yt-dlp is not installed. Install it with: python -m pip install -U yt-dlp",
  );
}

function getSafeFilename(name, fallback) {
  const safeName = cleanText(name, 180)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return safeName || fallback;
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

function isPreviewImage(file) {
  return [".jpg", ".jpeg", ".png", ".webp"].includes(file.extension);
}

function getFormatArgs(format, quality, bitrate) {
  if (format === "mp3") {
    return [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      `${bitrate}K`,
    ];
  }

  const videoSelector = quality === "max"
    ? "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
    : `bestvideo[ext=mp4][height<=${quality}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${quality}]/best[height<=${quality}]/best`;

  return [
    "-f",
    videoSelector,
    "--merge-output-format",
    "mp4",
    "--recode-video",
    "mp4",
  ];
}

async function findDownloadedFile(directory, format) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        const info = await stat(filePath);

        return {
          extension: path.extname(entry.name).toLowerCase(),
          filePath,
          mtimeMs: info.mtimeMs,
          name: entry.name,
          size: info.size,
        };
      }),
  );
  const targetExtension = `.${format}`;
  const matches = files
    .filter((file) => file.extension === targetExtension && file.size > 0)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (matches[0]) {
    return matches[0];
  }

  const fallback = files
    .filter((file) => file.size > 0)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];

  if (fallback) {
    return fallback;
  }

  throw new Error("yt-dlp finished but no downloadable file was created.");
}

async function findPreviewImage(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        const info = await stat(filePath);

        return {
          extension: path.extname(entry.name).toLowerCase(),
          filePath,
          mtimeMs: info.mtimeMs,
          name: entry.name,
          size: info.size,
        };
      }),
  );

  return files
    .filter((file) => isPreviewImage(file) && file.size > 0)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0] || null;
}

function validateDownloadPayload(payload) {
  const mediaUrl = parseMediaUrl(payload.url);
  const platform = mediaUrl ? getPlatform(mediaUrl) : "";
  const format = cleanText(payload.format, 10).toLowerCase();
  const quality = videoQualities.has(cleanText(payload.quality, 10))
    ? cleanText(payload.quality, 10)
    : "720";
  const bitrate = audioBitrates.has(cleanText(payload.bitrate, 10))
    ? cleanText(payload.bitrate, 10)
    : "128";

  if (!payload.hasPermission) {
    throw new Error("Confirm that you own this media or have permission to download it.");
  }

  if (!mediaUrl || !platform) {
    throw new Error("Paste a valid Facebook, YouTube, or TikTok video URL.");
  }

  if (!["mp4", "mp3"].includes(format)) {
    throw new Error("Choose MP4 video or MP3 audio.");
  }

  return {
    bitrate,
    format,
    mediaUrl,
    platform,
    quality,
  };
}

function getResultItems(result) {
  return Array.isArray(result?.items) ? result.items : [];
}

function parseTelegramDownloadRequest(text) {
  const message = cleanText(text, 2000);
  const urlMatch = message.match(/https?:\/\/\S+/i);

  if (!urlMatch) {
    return null;
  }

  const command = (message.match(/^\/([a-z0-9_]+)/i)?.[1] || "").toLowerCase();
  const wantsAudio = command === "mp3" || /\bmp3\b/i.test(message);
  const wantsVideo = command === "mp4" || /\bmp4\b/i.test(message);

  return {
    bitrate: "128",
    format: wantsAudio && !wantsVideo ? "mp3" : "mp4",
    hasPermission: true,
    quality: "720",
    url: urlMatch[0].replace(/[)\].,]+$/g, ""),
  };
}

function getTelegramChoiceId() {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

function saveTelegramDownloadChoice(chatId, url) {
  const choiceId = getTelegramChoiceId();

  telegramDownloadChoices.set(choiceId, {
    chatId,
    createdAt: Date.now(),
    url,
  });

  return choiceId;
}

function cleanupTelegramDownloadChoices() {
  const now = Date.now();

  for (const [choiceId, choice] of telegramDownloadChoices) {
    if (now - choice.createdAt > downloadTtlMs) {
      telegramDownloadChoices.delete(choiceId);
    }
  }
}

async function callTelegram(method, payload) {
  if (!telegramApiBaseUrl) {
    return null;
  }

  const response = await fetch(`${telegramApiBaseUrl}/${method}`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.ok === false) {
    throw new Error(result?.description || `Telegram ${method} failed.`);
  }

  return result.result;
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    disable_web_page_preview: false,
    text,
    ...extra,
  });
}

async function prepareTelegramDownload(chatId, payload) {
  let progressMessage = null;

  try {
    const downloadRequest = validateDownloadPayload(payload);
    const jobId = randomUUID();
    const job = {
      createdAt: Date.now(),
      error: "",
      id: jobId,
      progress: 0,
      result: null,
      stage: "Queued",
      status: "queued",
      updatedAt: Date.now(),
    };

    jobs.set(jobId, job);
    progressMessage = await sendTelegramMessage(
      chatId,
      `Queued ${downloadRequest.platform} ${downloadRequest.format.toUpperCase()} download...`,
    );

    runDownloadJob(jobId, downloadRequest);

    let lastProgress = -1;
    let lastStage = "";

    while (!["completed", "error"].includes(job.status)) {
      if (
        progressMessage?.message_id &&
        (job.progress >= lastProgress + 10 || job.stage !== lastStage)
      ) {
        lastProgress = job.progress;
        lastStage = job.stage;
        await callTelegram("editMessageText", {
          chat_id: chatId,
          message_id: progressMessage.message_id,
          text: `${job.stage || "Preparing"}... ${job.progress}%`,
        }).catch(() => {});
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (job.status === "error") {
      await sendTelegramMessage(chatId, job.error || "Could not prepare the download.");
      return;
    }

    const item = getResultItems(job.result)[0];

    if (!item?.downloadUrl) {
      await sendTelegramMessage(chatId, "The download finished but no file link was created.");
      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        "Download is ready.",
        item.filename ? `File: ${item.filename}` : "",
        `Link: ${item.downloadUrl}`,
        "",
        "Links expire after about 1 hour.",
      ].filter(Boolean).join("\n"),
    );
  } catch (error) {
    await sendTelegramMessage(chatId, error?.message || "Could not prepare the download.").catch(() => {});
  }
}

async function answerTelegramCommand(message) {
  const chatId = message?.chat?.id;
  const text = cleanText(message?.text || message?.caption, 2000);

  if (!chatId || !text) {
    return;
  }

  if (/^\/(start|help)\b/i.test(text)) {
    await sendTelegramMessage(
      chatId,
      [
        "Welcom to Assinstand Help",
        "Send a url Facebook, youtube,tiktok",
      ].join("\n"),
    );
    return;
  }

  const payload = parseTelegramDownloadRequest(text);

  if (!payload) {
    await sendTelegramMessage(chatId, "Send a url Facebook, youtube,tiktok");
    return;
  }

  const choiceId = saveTelegramDownloadChoice(chatId, payload.url);

  await sendTelegramMessage(chatId, "Choose download format:", {
    reply_markup: {
      inline_keyboard: [
        [
          { callback_data: `dl:${choiceId}:mp4`, text: "MP4" },
          { callback_data: `dl:${choiceId}:mp3`, text: "MP3" },
        ],
      ],
    },
  });
}

async function answerTelegramCallbackQuery(callbackQuery) {
  const data = cleanText(callbackQuery?.data, 100);
  const chatId = callbackQuery?.message?.chat?.id;
  const callbackQueryId = callbackQuery?.id;
  const [, choiceId, format] = data.match(/^dl:([a-f0-9]{16}):(mp4|mp3)$/i) || [];

  if (!callbackQueryId || !chatId || !choiceId || !format) {
    return;
  }

  const choice = telegramDownloadChoices.get(choiceId);

  if (!choice || choice.chatId !== chatId) {
    await callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      show_alert: true,
      text: "This download choice expired. Send the link again.",
    }).catch(() => {});
    return;
  }

  telegramDownloadChoices.delete(choiceId);

  await callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: `Preparing ${format.toUpperCase()}...`,
  }).catch(() => {});

  if (callbackQuery.message?.message_id) {
    await callTelegram("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {});
  }

  await prepareTelegramDownload(chatId, {
    bitrate: "128",
    format,
    hasPermission: true,
    quality: "720",
    url: choice.url,
  });
}

async function pollTelegramUpdates() {
  if (!telegramBotToken || !telegramPollingEnabled) {
    return;
  }

  while (true) {
    try {
      const response = await fetch(`${telegramApiBaseUrl}/getUpdates`, {
        body: JSON.stringify({
          allowed_updates: ["message", "callback_query"],
          offset: telegramUpdateOffset || undefined,
          timeout: 25,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        throw new Error(payload?.description || "Telegram polling failed.");
      }

      for (const update of payload.result || []) {
        telegramUpdateOffset = update.update_id + 1;
        const handler = update.callback_query
          ? answerTelegramCallbackQuery(update.callback_query)
          : answerTelegramCommand(update.message);

        handler.catch((error) => {
          console.error("Telegram message failed:", error?.message || error);
        });
      }
    } catch (error) {
      console.error("Telegram polling error:", error?.message || error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function prepareDownload(downloadRequest, jobId, job) {
  const jobDirectory = path.join(downloadRoot, jobId);
  const ffmpegPath = getFfmpegPath();
  setJobProgress(job, 2, "Checking yt-dlp");
  const ytDlp = await resolveYtDlpCommand();

  setJobProgress(job, 4, "Preparing download");
  await mkdir(jobDirectory, { recursive: true });

  const outputTemplate = path.join(jobDirectory, "%(title).180B-%(id)s.%(ext)s");
  const args = [
    ...ytDlp.args,
    "--newline",
    "--no-playlist",
    "--restrict-filenames",
    "--windows-filenames",
    "--no-mtime",
    "--force-overwrites",
    ...getYtDlpJavaScriptArgs(downloadRequest.platform),
    ...getYtDlpAuthArgs(),
    "--write-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "--ffmpeg-location",
    ffmpegPath,
    "-o",
    outputTemplate,
    ...getFormatArgs(downloadRequest.format, downloadRequest.quality, downloadRequest.bitrate),
    downloadRequest.mediaUrl.href,
  ];

  await runProcess(ytDlp.command, args, {
    onOutput: (text) => parseYtDlpProgress(text, job, downloadRequest.format),
  });

  setJobProgress(job, 98, "Preparing file link");

  const downloadedFile = await findDownloadedFile(jobDirectory, downloadRequest.format);
  const previewImage = await findPreviewImage(jobDirectory);
  const fallbackName = downloadRequest.format === "mp3" ? "download.mp3" : "download.mp4";
  const filename = getSafeFilename(downloadedFile.name, fallbackName);

  downloads.set(jobId, {
    contentType: getContentType(downloadedFile.filePath),
    createdAt: Date.now(),
    filePath: downloadedFile.filePath,
    filename,
  });

  if (previewImage) {
    downloads.set(`${jobId}-preview`, {
      contentType: getContentType(previewImage.filePath),
      createdAt: Date.now(),
      filePath: previewImage.filePath,
      filename: getSafeFilename(previewImage.name, "preview.jpg"),
      inline: true,
    });
  }

  return {
    format: downloadRequest.format,
    items: [
      {
        downloadUrl: getPublicUrl(`/downloads/${jobId}`),
        filename,
        previewKind: previewImage ? "image" : downloadRequest.format === "mp4" ? "video" : "audio",
        previewUrl: previewImage
          ? getPublicUrl(`/downloads/${jobId}-preview`)
          : downloadRequest.format === "mp4"
            ? getPublicUrl(`/downloads/${jobId}`)
            : "",
        type: downloadRequest.format,
      },
    ],
    platform: downloadRequest.platform,
    sourceStatus: "local-node",
  };
}

async function runDownloadJob(jobId, downloadRequest) {
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  try {
    job.status = "running";
    setJobProgress(job, 1, "Starting");
    job.result = await prepareDownload(downloadRequest, jobId, job);
    job.status = "completed";
    setJobProgress(job, 100, "Completed");
  } catch (error) {
    job.status = "error";
    job.error = error?.message || "Could not prepare the video download.";
    job.updatedAt = Date.now();
  }
}

async function handlePrepareDownload(request, response) {
  try {
    const payload = await readJsonBody(request);
    const downloadRequest = validateDownloadPayload(payload);
    const jobId = randomUUID();
    const job = {
      createdAt: Date.now(),
      error: "",
      id: jobId,
      progress: 0,
      result: null,
      stage: "Queued",
      status: "queued",
      updatedAt: Date.now(),
    };

    jobs.set(jobId, job);
    runDownloadJob(jobId, downloadRequest);

    sendJson(response, 202, {
      jobId,
      progress: job.progress,
      stage: job.stage,
      status: job.status,
      statusUrl: getPublicUrl(`/api/video-download/jobs/${jobId}`),
    });
  } catch (error) {
    sendJson(response, 400, {
      error: error?.message || "Could not prepare the video download.",
    });
  }
}

function handleJobStatus(response, jobId) {
  const job = jobs.get(jobId);

  if (!job) {
    sendJson(response, 404, { error: "Download job expired or not found." });
    return;
  }

  sendJson(response, 200, {
    error: job.error,
    jobId,
    progress: job.progress,
    result: job.result,
    stage: job.stage,
    status: job.status,
  });
}

async function handleFileDownload(request, response, downloadId) {
  const download = downloads.get(downloadId);

  if (!download || !existsSync(download.filePath)) {
    sendJson(response, 404, { error: "Download expired or not found." });
    return;
  }

  const info = await stat(download.filePath);
  response.writeHead(200, {
    ...corsHeaders,
    "Cache-Control": "no-store",
    "Content-Disposition": `${download.inline ? "inline" : "attachment"}; filename="${download.filename.replace(/"/g, "'")}"`,
    "Content-Length": info.size,
    "Content-Type": download.contentType,
  });
  createReadStream(download.filePath).pipe(response);
}

async function cleanupOldDownloads() {
  const now = Date.now();

  cleanupTelegramDownloadChoices();

  for (const [jobId, job] of jobs) {
    if (now - job.createdAt > downloadTtlMs) {
      jobs.delete(jobId);
    }
  }

  for (const [downloadId, download] of downloads) {
    if (now - download.createdAt <= downloadTtlMs) {
      continue;
    }

    downloads.delete(downloadId);
    await rm(path.dirname(download.filePath), { force: true, recursive: true }).catch(() => {});
  }
}

async function routeRequest(request, response) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === "OPTIONS") {
    sendOptions(response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/video-download") {
    await handlePrepareDownload(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname.startsWith("/api/video-download/jobs/")) {
    const jobId = requestUrl.pathname.split("/").filter(Boolean).at(-1);
    handleJobStatus(response, jobId);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname.startsWith("/downloads/")) {
    const downloadId = requestUrl.pathname.split("/").filter(Boolean).at(-1);
    await handleFileDownload(request, response, downloadId);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, {
      cookies: getYtDlpCookieStatus(),
      jsRuntimes: getEffectiveYtDlpJavaScriptRuntime(),
      ok: true,
      remoteComponents: cleanText(process.env.YTDLP_REMOTE_COMPONENTS, 1000) || "ejs:github",
      service: "AISupport local video downloader",
      telegramBot: {
        enabled: Boolean(telegramBotToken && telegramPollingEnabled),
        polling: telegramPollingEnabled,
      },
      wakePing: {
        enabled: wakePingEnabled,
        intervalMs: wakePingIntervalMs,
        target: publicServerUrl,
      },
    });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

await mkdir(downloadRoot, { recursive: true });
setInterval(cleanupOldDownloads, 10 * 60 * 1000).unref();

function startRenderWakePing() {
  if (!wakePingEnabled || !publicServerUrl || publicServerUrl.startsWith("http://127.0.0.1")) {
    return;
  }

  const ping = async () => {
    try {
      const response = await fetch(`${publicServerUrl}/health`, {
        headers: {
          "User-Agent": "aisupport-render-wake-ping/1.0",
        },
      });

      if (!response.ok) {
        console.warn(`Wake ping returned ${response.status}.`);
      }
    } catch (error) {
      console.warn("Wake ping failed:", error?.message || error);
    }
  };

  setInterval(ping, wakePingIntervalMs).unref();
}

createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    sendJson(response, 500, {
      error: error?.message || "Local video downloader failed.",
    });
  });
}).listen(port, host, () => {
  console.log(`Video downloader server ready at http://${host}:${port}`);
  console.log(`Public video server URL: ${publicServerUrl}`);
  console.log("Install yt-dlp if needed: python -m pip install -U yt-dlp");
  console.log(`Telegram bot: ${telegramBotToken && telegramPollingEnabled ? "enabled" : "disabled"}`);
  startRenderWakePing();
  pollTelegramUpdates();
});

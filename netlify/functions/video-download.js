import { Buffer } from "node:buffer";

const cobaltDefaultAuthScheme = "Api-Key";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const videoQualities = new Set(["max", "1080", "720", "480", "360", "240", "144"]);
const audioBitrates = new Set(["320", "256", "128", "96", "64", "8"]);

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

function cleanText(value, maxLength = 2000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeCobaltEndpoint(value) {
  const rawValue = cleanText(value, 500);

  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return `${url.href.replace(/\/+$/, "")}/`;
  } catch {
    return null;
  }
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
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fb.watch" ||
    host.endsWith(".fb.watch") ||
    host === "fb.com" ||
    host.endsWith(".fb.com")
  ) {
    return "Facebook";
  }

  return "";
}

function getAuthHeader() {
  const token = cleanText(process.env.COBALT_API_KEY, 500);

  if (!token) {
    return null;
  }

  const scheme = cleanText(process.env.COBALT_AUTH_SCHEME, 40) || cobaltDefaultAuthScheme;

  return `${scheme} ${token}`;
}

function getCobaltErrorMessage(payload, fallback = "Could not prepare the download.") {
  const code = payload?.error?.code || payload?.code || "";
  const service = payload?.error?.context?.service || payload?.service || "";
  const detail = payload?.message || payload?.error?.message || payload?.error || "";

  if (/auth/i.test(code)) {
    return "Downloader API authentication failed. Check COBALT_API_KEY and COBALT_AUTH_SCHEME.";
  }

  if (/rate|limit/i.test(code)) {
    return "Downloader API rate limit reached. Wait a moment or use another authorized API instance.";
  }

  if (/unsupported|service/i.test(code)) {
    return `This ${service || "media"} link is not supported by the downloader API.`;
  }

  if (typeof detail === "string" && detail) {
    return detail;
  }

  if (code) {
    return `${fallback} (${code})`;
  }

  return fallback;
}

function buildCobaltPayload({ format, mediaUrl, quality, bitrate }) {
  const common = {
    alwaysProxy: process.env.COBALT_ALWAYS_PROXY === "true",
    filenameStyle: "basic",
    localProcessing: "disabled",
    url: mediaUrl,
  };

  if (format === "mp3") {
    return {
      ...common,
      audioBitrate: bitrate,
      audioFormat: "mp3",
      downloadMode: "audio",
      tiktokFullAudio: false,
      youtubeBetterAudio: true,
    };
  }

  return {
    ...common,
    allowH265: false,
    downloadMode: "auto",
    videoQuality: quality,
    youtubeVideoCodec: "h264",
    youtubeVideoContainer: "mp4",
  };
}

async function readCobaltPayload(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getFileExtension(format) {
  return format === "mp3" ? "mp3" : "mp4";
}

function createDownloadItem({ filename, format, type, url }) {
  if (!url) {
    return null;
  }

  return {
    downloadUrl: url,
    filename: filename || `download.${getFileExtension(format)}`,
    type: type || format,
  };
}

function mapCobaltResult(result, format) {
  if (["tunnel", "redirect"].includes(result?.status) && result.url) {
    return {
      items: [
        createDownloadItem({
          filename: result.filename,
          format,
          type: format,
          url: result.url,
        }),
      ].filter(Boolean),
      sourceStatus: result.status,
    };
  }

  if (result?.status === "picker") {
    const items = [];

    if (format === "mp3" && result.audio) {
      items.push(createDownloadItem({
        filename: result.audioFilename,
        format,
        type: "audio",
        url: result.audio,
      }));
    }

    if (format === "mp4" && Array.isArray(result.picker)) {
      result.picker
        .filter((item) => item?.type === "video" || item?.type === "gif")
        .slice(0, 12)
        .forEach((item, index) => {
          items.push(createDownloadItem({
            filename: `video-${index + 1}.${getFileExtension(format)}`,
            format,
            type: item.type,
            url: item.url,
          }));
        });
    }

    return {
      items: items.filter(Boolean),
      sourceStatus: result.status,
    };
  }

  return {
    items: [],
    sourceStatus: result?.status || "unknown",
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
    return jsonResponse(405, { error: "Use POST to prepare a video download." }, {
      Allow: "POST, OPTIONS",
    });
  }

  try {
    const payload = await readJsonBody(event);
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
      return jsonResponse(400, {
        error: "Confirm that you own this media or have permission to download it.",
      });
    }

    if (!mediaUrl || !platform) {
      return jsonResponse(400, {
        error: "Not supported. Paste a valid Facebook video URL.",
      });
    }

    if (!["mp4", "mp3"].includes(format)) {
      return jsonResponse(400, {
        error: "Choose MP4 video or MP3 audio.",
      });
    }

    const cobaltEndpoint = normalizeCobaltEndpoint(process.env.COBALT_API_URL);

    if (!cobaltEndpoint) {
      return jsonResponse(500, {
        error: "Downloader API is not configured. Set COBALT_API_URL in Netlify.",
      });
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    const authHeader = getAuthHeader();

    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const response = await fetch(cobaltEndpoint, {
      body: JSON.stringify(buildCobaltPayload({
        bitrate,
        format,
        mediaUrl: mediaUrl.href,
        quality,
      })),
      headers,
      method: "POST",
    });
    const result = await readCobaltPayload(response);

    if (!response.ok || result?.status === "error") {
      const retryAfter = response.headers.get("retry-after");

      return jsonResponse(
        response.status || 502,
        { error: getCobaltErrorMessage(result) },
        retryAfter ? { "Retry-After": retryAfter } : {},
      );
    }

    if (result?.status === "local-processing") {
      return jsonResponse(422, {
        error: "This download needs local processing. Use a downloader API instance that can tunnel the finished file.",
      });
    }

    const mappedResult = mapCobaltResult(result, format);

    if (!mappedResult.items.length) {
      return jsonResponse(422, {
        error: "The downloader API did not return a downloadable file for this link.",
      });
    }

    return jsonResponse(200, {
      format,
      items: mappedResult.items,
      platform,
      sourceStatus: mappedResult.sourceStatus,
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error?.message || "Could not prepare the video download.",
    });
  }
}

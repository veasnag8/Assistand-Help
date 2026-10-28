import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Music2,
  ShieldCheck,
} from "lucide-react";
import Panel from "./Panel";

function getVideoDownloadEndpoint() {
  const configuredServer = String(import.meta.env.VITE_VIDEO_SERVER_URL || "").replace(/\/+$/, "");

  if (configuredServer) {
    return `${configuredServer}/api/video-download`;
  }

  if (import.meta.env.DEV) {
    return "http://127.0.0.1:5454/api/video-download";
  }

  return "/.netlify/functions/video-download";
}

const videoDownloadEndpoint = getVideoDownloadEndpoint();
const progressPollDelayMs = 1000;
const maxProgressPolls = 1800;

const modes = [
  {
    id: "mp4",
    label: "MP4",
    icon: Film,
  },
  {
    id: "mp3",
    label: "MP3",
    icon: Music2,
  },
];

const qualityOptions = [
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
  { value: "360", label: "360p" },
  { value: "240", label: "240p" },
];

const bitrateOptions = [
  { value: "320", label: "320 kbps" },
  { value: "256", label: "256 kbps" },
  { value: "128", label: "128 kbps" },
  { value: "96", label: "96 kbps" },
  { value: "64", label: "64 kbps" },
];

function getPlatformLabel(value) {
  try {
    const { hostname } = new URL(value);
    const host = hostname.toLowerCase().replace(/^www\./, "");

    if (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.watch" ||
      host.endsWith(".fb.watch") ||
      host === "fb.com" ||
      host.endsWith(".fb.com")
    ) return "Facebook";

    return "Unsupported";
  } catch {
    return "Waiting";
  }
}

async function readJsonResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text || "Could not read the downloader response.",
    };
  }
}

function getResultItems(result) {
  return Array.isArray(result?.items) ? result.items : [];
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getProgressValue(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function getReadableFilename(name, fallback) {
  return String(name || fallback)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function VideoDownloadTool() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState("720");
  const [bitrate, setBitrate] = useState("128");
  const [hasPermission, setHasPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("Paste a Facebook video URL.");
  const [statusKind, setStatusKind] = useState("neutral");
  const [copiedUrl, setCopiedUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [jobStage, setJobStage] = useState("");

  const platform = useMemo(() => getPlatformLabel(url), [url]);
  const resultItems = getResultItems(result);
  const canPrepare = platform === "Facebook" && url.trim() && hasPermission && !busy;
  const showProgress = busy || progress > 0 || resultItems.length > 0;

  async function pollDownloadJob(statusUrl) {
    for (let attempt = 0; attempt < maxProgressPolls; attempt += 1) {
      const response = await fetch(statusUrl);
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error || "Could not read download progress.");
      }

      const nextProgress = getProgressValue(payload.progress);
      const nextStage = payload.stage || "Preparing";

      setProgress(nextProgress);
      setJobStage(nextStage);
      setStatus(`${nextStage}... ${nextProgress}%`);

      if (payload.status === "completed" && payload.result) {
        return payload.result;
      }

      if (payload.status === "error") {
        throw new Error(payload.error || "Could not prepare the download.");
      }

      await sleep(progressPollDelayMs);
    }

    throw new Error("Download is taking too long. Try again with a shorter video.");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (platform !== "Facebook") {
      setStatus("Not supported. Please paste a Facebook video URL.");
      setStatusKind("error");
      return;
    }

    if (!hasPermission) {
      setStatus("Confirm permission before preparing a download.");
      setStatusKind("error");
      return;
    }

    try {
      setBusy(true);
      setResult(null);
      setCopiedUrl("");
      setProgress(0);
      setJobStage("Queued");
      setStatus("Preparing download... 0%");
      setStatusKind("neutral");

      const response = await fetch(videoDownloadEndpoint, {
        body: JSON.stringify({
          bitrate,
          format,
          hasPermission,
          quality,
          url,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error || "Could not prepare the download.");
      }

      const finalResult = payload.jobId && payload.statusUrl
        ? await pollDownloadJob(payload.statusUrl)
        : payload;

      setResult(finalResult);
      setProgress(100);
      setJobStage("Completed");
      setStatus(`Ready: ${finalResult.platform || platform} ${format.toUpperCase()} download.`);
      setStatusKind("success");
    } catch (error) {
      setStatus(error?.message || "Could not prepare the download.");
      setStatusKind("error");
    } finally {
      setBusy(false);
    }
  }

  async function copyDownloadUrl(downloadUrl) {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedUrl(downloadUrl);
      setStatus("Download link copied.");
      setStatusKind("success");
    } catch {
      setStatus("Could not copy the link.");
      setStatusKind("error");
    }
  }

  return (
    <section className="video-download-tool">
      <div className="video-download-grid">
        <Panel
          eyebrow="Downloader"
          title="Video Download"
          description="Download authorized Facebook media."
        >
          <form className="video-download-form" onSubmit={handleSubmit}>
            <label className="field video-url-field">
              <span>URL</span>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
                spellCheck="false"
              />
            </label>

            <div className="video-platform-strip">
              <span className={`video-platform-pill is-${platform.toLowerCase()}`}>
                {platform === "Unsupported" ? "Not supported" : platform}
              </span>
            </div>

            <div className="video-mode-grid" role="tablist" aria-label="Download format">
              {modes.map((mode) => {
                const Icon = mode.icon;
                const isActive = format === mode.id;

                return (
                  <button
                    className={`video-mode-card${isActive ? " is-active" : ""}`}
                    key={mode.id}
                    type="button"
                    onClick={() => setFormat(mode.id)}
                    aria-pressed={isActive}
                  >
                    <Icon size={20} />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="field">
              <span>{format === "mp4" ? "Quality" : "Bitrate"}</span>
              <select
                value={format === "mp4" ? quality : bitrate}
                onChange={(event) => (
                  format === "mp4"
                    ? setQuality(event.target.value)
                    : setBitrate(event.target.value)
                )}
              >
                {(format === "mp4" ? qualityOptions : bitrateOptions).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="video-permission-row">
              <input
                type="checkbox"
                checked={hasPermission}
                onChange={(event) => setHasPermission(event.target.checked)}
              />
              <ShieldCheck size={18} aria-hidden="true" />
              <span>I own this media or have permission to download it.</span>
            </label>

            <button className="button video-prepare-button" type="submit" disabled={!canPrepare}>
              {busy ? <Loader2 size={18} className="video-spin" /> : <Download size={18} />}
              <span>{busy ? "Preparing" : "Prepare Download"}</span>
            </button>
          </form>
        </Panel>

        <Panel
          eyebrow="Result"
          title="Download"
          description="Local download links expire after a short time."
        >
          <div className={`video-status is-${statusKind}`} role="status">
            {statusKind === "success" ? <CheckCircle2 size={18} /> : null}
            <span>{status}</span>
          </div>

          {showProgress ? (
            <div
              className="video-progress"
              aria-label="Download progress"
              aria-valuemax="100"
              aria-valuemin="0"
              aria-valuenow={progress}
              role="progressbar"
            >
              <div className="video-progress-top">
                <span>{jobStage || "Preparing"}</span>
                <strong>{progress}%</strong>
              </div>
              <div className="video-progress-track" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          {resultItems.length ? (
            <div className="video-result-list">
              {resultItems.map((item, index) => (
                <article className="video-result-card" key={`${item.downloadUrl}-${index}`}>
                  <div className="video-preview-frame">
                    {item.previewUrl && item.previewKind === "image" ? (
                      <img src={item.previewUrl} alt="" />
                    ) : null}
                    {item.previewUrl && item.previewKind === "video" ? (
                      <video src={item.previewUrl} controls preload="metadata" />
                    ) : null}
                    {!item.previewUrl || item.previewKind === "audio" ? (
                      <div className="video-preview-fallback">
                        {item.previewKind === "audio" ? <Music2 size={42} /> : <ImageIcon size={42} />}
                        <span>{item.previewKind === "audio" ? "Audio file" : "Preview not available"}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="video-result-meta">
                    <span>{item.type || result.format}</span>
                    <strong title={item.filename || `download.${result.format}`}>
                      {getReadableFilename(item.filename, `download.${result.format}`)}
                    </strong>
                  </div>

                  <div className="video-result-actions">
                    <a
                      className="button"
                      href={item.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={item.filename || true}
                    >
                      <Download size={16} />
                      <span>Download</span>
                    </a>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => copyDownloadUrl(item.downloadUrl)}
                    >
                      <Copy size={16} />
                      <span>{copiedUrl === item.downloadUrl ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="video-empty-state">
              <Download size={34} />
              <strong>No download prepared</strong>
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import {
  Copy,
  Expand,
  MessageSquare,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import Panel from "./Panel";

const commentsEndpointPath = "/.netlify/functions/comments";
const qrCodeEndpoint = "https://api.qrserver.com/v1/create-qr-code/";
const pollIntervalMs = 1800;

function createRoomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

function getHashParams() {
  const [, query = ""] = window.location.hash.split("?");
  return new URLSearchParams(query);
}

function getStoredRoomId() {
  const params = getHashParams();
  const requestedRoom = params.get("room");

  if (requestedRoom) {
    return requestedRoom;
  }

  const storedRoom = window.localStorage.getItem("comment-tool-room");

  if (storedRoom) {
    return storedRoom;
  }

  const nextRoom = createRoomId();
  window.localStorage.setItem("comment-tool-room", nextRoom);
  return nextRoom;
}

function formatCommentTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function newestFirst(comments) {
  return [...comments].sort(
    (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
  );
}

function mergeLiveComments(currentComments, incomingComments) {
  const commentsById = new Map();

  [...currentComments, ...incomingComments].forEach((comment) => {
    if (comment?.id) {
      commentsById.set(comment.id, comment);
    }
  });

  return newestFirst(Array.from(commentsById.values()));
}

function getPhoneUrl(roomId) {
  const url = new URL(window.location.href);

  url.hash = `comment?view=phone&room=${encodeURIComponent(roomId)}`;
  return url.toString();
}

function getScreenUrl(roomId) {
  const url = new URL(window.location.href);

  url.hash = `comment?view=screen&room=${encodeURIComponent(roomId)}`;
  return url.toString();
}

function getCommentsEndpoint() {
  const { hostname, port, protocol } = window.location;
  const isLocalVite =
    ["localhost", "127.0.0.1"].includes(hostname) && port && port !== "8888";

  if (isLocalVite) {
    return `${protocol}//${hostname}:8888${commentsEndpointPath}`;
  }

  return commentsEndpointPath;
}

function getCommentsUrl(roomId) {
  return `${getCommentsEndpoint()}?room=${encodeURIComponent(roomId)}`;
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
      "Comment server not available. Open the app with Netlify dev on port 8888.",
    );
  }

  throw new Error(text || fallbackMessage);
}

async function fetchComments(roomId) {
  const response = await fetch(getCommentsUrl(roomId), {
    cache: "no-store",
  });
  const result = await readJsonResponse(response, "Could not load comments.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not load comments.");
  }

  return result;
}

async function postComment(roomId, payload) {
  const response = await fetch(getCommentsUrl(roomId), {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result = await readJsonResponse(response, "Could not send comment.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not send comment.");
  }

  return result;
}

async function deleteComments(roomId) {
  const response = await fetch(getCommentsUrl(roomId), {
    method: "DELETE",
  });
  const result = await readJsonResponse(response, "Could not clear comments.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not clear comments.");
  }

  return result;
}

export default function CommentTool() {
  const [roomId] = useState(getStoredRoomId);
  const [comments, setComments] = useState([]);
  const [name, setName] = useState(() => window.localStorage.getItem("comment-tool-name") || "");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);

  const hashParams = getHashParams();
  const isPhoneView = hashParams.get("view") === "phone";
  const isScreenOnlyView = hashParams.get("view") === "screen";
  const phoneUrl = getPhoneUrl(roomId);
  const qrUrl = (() => {
    const params = new URLSearchParams({
      data: phoneUrl,
      margin: "12",
      size: "260x260",
    });

    return `${qrCodeEndpoint}?${params.toString()}`;
  })();

  useEffect(() => {
    let active = true;

    async function loadComments() {
      try {
        const result = await fetchComments(roomId);

        if (active) {
          setComments((current) => mergeLiveComments(current, result.comments || []));
          setStatus("Live.");
        }
      } catch (error) {
        if (active) {
          setStatus(error?.message || "Could not load comments.");
        }
      }
    }

    loadComments();
    const intervalId = window.setInterval(loadComments, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [roomId]);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setBusy(true);
      setStatus("Sending...");

      const result = await postComment(roomId, { name, text });

      window.localStorage.setItem("comment-tool-name", name);
      setComments((current) => mergeLiveComments(current, result.comments || []));
      setText("");
      setStatus("Sent.");
    } catch (error) {
      setStatus(error?.message || "Could not send comment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    try {
      setBusy(true);
      setStatus("Refreshing...");

      const result = await fetchComments(roomId);

      setComments((current) => mergeLiveComments(current, result.comments || []));
      setStatus("Live.");
    } catch (error) {
      setStatus(error?.message || "Could not refresh comments.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    try {
      setBusy(true);
      setStatus("Clearing...");

      await deleteComments(roomId);

      setComments([]);
      setStatus("Cleared.");
    } catch (error) {
      setStatus(error?.message || "Could not clear comments.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(phoneUrl);
    setStatus("Phone link copied.");
  }

  function openScreenOnlyView() {
    window.location.assign(getScreenUrl(roomId));
  }

  if (isPhoneView) {
    return (
      <section className="comment-phone-shell">
        <div className="comment-phone-panel">
          <div className="comment-phone-header">
            <span className="comment-tool-icon" aria-hidden="true">
              <MessageSquare size={26} strokeWidth={2.1} />
            </span>
            <div>
              <p className="eyebrow">Comment Tool</p>
              <h1>Send Comment</h1>
            </div>
          </div>

          <form className="comment-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="comment-name">Name</label>
              <input
                id="comment-name"
                maxLength={40}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Anonymous"
              />
            </div>

            <div className="field">
              <label htmlFor="comment-text">Comment</label>
              <textarea
                id="comment-text"
                maxLength={280}
                required
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type your comment"
              />
              <div className="meta-line">{text.length}/280</div>
            </div>

            <button className="button comment-submit-button" type="submit" disabled={busy || !text.trim()}>
              <Send size={18} strokeWidth={2.2} />
              <span>{busy ? "Sending..." : "Send"}</span>
            </button>
          </form>

          <div className="pdf-status" role="status">
            {status}
          </div>
        </div>
      </section>
    );
  }

  const liveCommentsPanel = (
    <Panel
      className={isScreenOnlyView ? "comment-screen-panel" : ""}
      eyebrow="Screen"
      title="Live Comments"
      description={`${comments.length} comment${comments.length === 1 ? "" : "s"}`}
    >
      <div className="comment-live-header">
        <span>
          <Monitor size={18} strokeWidth={2.2} />
          Display
        </span>
        <span>
          <Smartphone size={18} strokeWidth={2.2} />
          Phone
        </span>
      </div>

      <div className="comment-list" aria-live="polite">
        {comments.length ? (
          comments.map((comment) => (
            <article className="comment-card" key={comment.id}>
              <div className="comment-card-top">
                <strong>{comment.name}</strong>
                <span>{formatCommentTime(comment.createdAt)}</span>
              </div>
              <p>{comment.text}</p>
            </article>
          ))
        ) : (
          <div className="comment-empty">
            <MessageSquare size={46} strokeWidth={1.8} />
            <span>No comments yet</span>
          </div>
        )}
      </div>
    </Panel>
  );

  if (isScreenOnlyView) {
    return (
      <section className="comment-tool comment-tool--screen-only">
        <div className="comment-stage comment-stage--screen-only">
          {liveCommentsPanel}
        </div>
      </section>
    );
  }

  return (
    <section className="comment-tool">
      <div className="comment-stage">
        <Panel
          eyebrow="Phone"
          title="Scan To Comment"
          description={`Room ${roomId}`}
        >
          <div className="comment-qr-card">
            <img src={qrUrl} alt="Phone comment QR code" />
            <div className="comment-link-box">{phoneUrl}</div>
          </div>

          <div className="button-row wrap">
            <button className="button secondary" type="button" onClick={handleCopyLink}>
              <Copy size={16} strokeWidth={2.2} />
              <span>Copy Link</span>
            </button>
            <button className="button secondary" type="button" onClick={openScreenOnlyView}>
              <Expand size={16} strokeWidth={2.2} />
              <span>Full screen</span>
            </button>
            <button className="button ghost" type="button" onClick={handleRefresh} disabled={busy}>
              <RefreshCw size={16} strokeWidth={2.2} />
              <span>Refresh</span>
            </button>
            <button className="button ghost" type="button" onClick={handleClear} disabled={busy || !comments.length}>
              <Trash2 size={16} strokeWidth={2.2} />
              <span>Clear</span>
            </button>
          </div>
        </Panel>

        {liveCommentsPanel}
      </div>

      <div className="pdf-status" role="status">
        {busy ? "Working... " : null}
        {status}
      </div>
    </section>
  );
}

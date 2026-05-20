import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import snaGptLogo from "../image/sna-gpt.png";

const snaGptEndpointPath = "/.netlify/functions/sna-gpt";
const chatStorageKey = "sna-gpt-chat-v1";
const sidebarStorageKey = "sna-gpt-sidebar-collapsed";

const starterPrompts = [
  "Who created you?",
  "Help me write a professional message.",
  "Translate this text to Khmer.",
];

function createMessage(role, content) {
  const id = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    content,
    createdAt: new Date().toISOString(),
    id,
    role,
  };
}

function createWelcomeMessage() {
  return createMessage(
    "assistant",
    "Hello, I am SNA GPT. I was created by Song Veasna. How can I help today?",
  );
}

function loadStoredMessages() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(chatStorageKey) || "[]");

    if (Array.isArray(parsed) && parsed.length) {
      return parsed.filter((message) => message?.role && message?.content).slice(-40);
    }
  } catch {
    // Fall back to the welcome message.
  }

  return [createWelcomeMessage()];
}

function loadSidebarCollapsed() {
  return window.localStorage.getItem(sidebarStorageKey) === "true";
}

function getSnaGptEndpoint() {
  const { hostname, port, protocol } = window.location;
  const isLocalVite =
    ["localhost", "127.0.0.1"].includes(hostname) && port && port !== "8888";

  if (isLocalVite) {
    return `${protocol}//${hostname}:8888${snaGptEndpointPath}`;
  }

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
      "SNA GPT server not available. Open the app with Netlify dev on port 8888.",
    );
  }

  throw new Error(text || fallbackMessage);
}

async function sendSnaGptMessage(messages, signal) {
  const response = await fetch(getSnaGptEndpoint(), {
    body: JSON.stringify({
      messages: messages.map((message) => ({
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
  const result = await readJsonResponse(response, "Could not reach SNA GPT.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not reach SNA GPT.");
  }

  return result;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ChatMessage({ message, onCopy }) {
  const isUser = message.role === "user";

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
        <div className="sna-message-text">{message.content}</div>
        {!isUser ? (
          <button
            className="sna-copy-button"
            type="button"
            onClick={() => onCopy(message.content)}
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

export default function SnaGptTool() {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("SNA GPT");
  const scrollRef = useRef(null);
  const requestRef = useRef(null);

  const canSend = draft.trim().length > 0 && !busy;
  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );

  useEffect(() => {
    window.localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-40)));
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      behavior: "smooth",
      top: scrollRef.current.scrollHeight,
    });
  }, [messages, busy]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function clearChat() {
    requestRef.current?.abort();
    setBusy(false);
    setMessages([createWelcomeMessage()]);
    setStatus("Ready.");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied.");
    } catch {
      setStatus("Could not copy.");
    }
  }

  async function submitMessage(text = draft) {
    const content = text.trim();

    if (!content || busy) {
      return;
    }

    const userMessage = createMessage("user", content);
    const nextMessages = [...messages, userMessage];
    const controller = new AbortController();

    requestRef.current?.abort();
    requestRef.current = controller;

    setMessages(nextMessages);
    setDraft("");
    setBusy(true);
    setStatus("Thinking...");

    try {
      const result = await sendSnaGptMessage(nextMessages, controller.signal);
      const assistantMessage = createMessage("assistant", result.reply || "SNA GPT did not return a response.");

      setMessages([...nextMessages, assistantMessage]);
      setModel(result.model || "SNA GPT");
      setStatus("Ready.");
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("Stopped.");
        return;
      }

      setMessages([
        ...nextMessages,
        createMessage("assistant", error?.message || "Could not reach SNA GPT."),
      ]);
      setStatus("Error.");
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

  return (
    <section
      className={`sna-gpt-tool${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
      aria-labelledby="sna-gpt-title"
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
            <span>Created by Song Veasna</span>
          </div>
        </div>

        <div className="sna-side-actions">
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
          <div>
            <strong>SNA GPT Chat</strong>
            <span>{model}</span>
          </div>
          <div className="sna-status" role="status">
            {busy ? <RefreshCw size={15} strokeWidth={2.2} /> : null}
            <span>{status}</span>
          </div>
        </header>

        <div className="sna-message-list" ref={scrollRef} aria-live="polite">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} onCopy={copyText} />
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

        <form className="sna-composer" onSubmit={handleSubmit}>
          <textarea
            aria-label="Message SNA GPT"
            maxLength={6000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message SNA GPT"
            rows={1}
            value={draft}
          />
          <button className="sna-send-button" type="submit" disabled={!canSend} aria-label="Send message">
            <Send size={20} strokeWidth={2.3} />
          </button>
        </form>
      </div>
    </section>
  );
}

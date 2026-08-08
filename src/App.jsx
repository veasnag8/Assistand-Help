import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BotMessageSquare,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Copy,
  Clock3,
  ExternalLink,
  Gamepad2,
  HardDriveDownload,
  FileText,
  FileImage,
  FileSpreadsheet,
  MessageSquare,
  QrCode,
  ScanText as ScanTextIcon,
  Scissors,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import AcumaticaFlowTool from "./components/AcumaticaFlowTool";
import CommentTool from "./components/CommentTool";
import HangmanTool from "./components/HangmanTool";
import KhmerCalendarTool from "./components/KhmerCalendarTool";
import ImageTools from "./components/ImageTools";
import LogoCutTool from "./components/LogoCutTool";
import PdfTools from "./components/PdfTools";
import QrStudio from "./components/QrStudio";
import ScanTextTool from "./components/ScanTextTool";
import SnaGptTool from "./components/SnaGptTool";
import VideoDownloadTool from "./components/VideoDownloadTool";
import acumaticaLogo from "./image/acumatica-logo-transparent.png";
import mamLogo from "./image/mam-logo.png";
import snaGptLogo from "./image/sna-gpt.png";

const protectedActionPassword = "MAM@2026";
const protectedPasswordMessage = "Password is not correct.";
const protectedPasswordMaxAttempts = 3;
const categories = [
  {
    id: "sql-script-update",
    title: "SQL Script Update",
    tabTitle: "SQL Script Update",
    description: "Open the shared SQL script update workbook.",
    icon: FileSpreadsheet,
    tone: "excel",
    enabled: true,
    protected: true,
    externalUrl:
      "https://megaassetmanagement-my.sharepoint.com/:x:/g/personal/phal_bunnavath_mam_com_kh/IQAfMdcUw23KQJOmCvL4NkKxAQO__7lpCDyTfYD0xUIz_Es?e=HRXg4L",
  },
  {
    id: "master-list-boq",
    title: "Master List BOQ",
    tabTitle: "Master List BOQ",
    description: "Open the shared BOQ master list workbook.",
    icon: FileSpreadsheet,
    tone: "excel",
    enabled: true,
    protected: true,
    externalUrl:
      "https://megaassetmanagement-my.sharepoint.com/:x:/g/personal/phal_bunnavath_mam_com_kh/IQAW0G_7jYZLS7khZPkBFvzRAQVNj0cc1j7RS94carTvRBg?rtime=LkB8YN-23kg",
  },
  {
    id: "master-list-all-projects",
    title: "Master List All Project",
    tabTitle: "Master List All Project",
    description: "Includes FD, WH, Customer, and Vendor Investment.",
    icon: FileSpreadsheet,
    tone: "excel",
    enabled: true,
    protected: true,
    externalUrl:
      "https://megaassetmanagement-my.sharepoint.com/:x:/g/personal/mak_heangda_mam_com_kh/IQBrW5Pxxn1MTbmEFnd2iVmZAVw9BcT_Ti0Bl0h7tx89b_4?e=you4hD",
  },
  {
    id: "pdf",
    title: "PDF Tools",
    tabTitle: "PDF",
    description: "Split, merge, compress, and convert PDF files to Word.",
    icon: FileText,
    tone: "red",
    enabled: true,
  },
  {
    id: "acumatica-flow",
    title: "Acumatica Flow",
    tabTitle: "Acumatica Flow",
    description: "View process flow, team access rights, and AP/AR correction guidance in Acumatica. Petty Cash updated: 22/05/2026.",
    icon: Workflow,
    logo: acumaticaLogo,
    tone: "slate",
    enabled: true,
  },
  {
    id: "qr",
    title: "Prepare QR",
    tabTitle: "QR Code",
    description: "Prepare Template QR Code Canadia Bank for Report.",
    icon: QrCode,
    tone: "blue",
    enabled: true,
  },
  {
    id: "timer",
    title: "Set Timer",
    tabTitle: "Timer",
    description: "Set classroom timer for activities.",
    icon: Clock3,
    tone: "purple",
    enabled: true,
  },
  {
    id: "hangman",
    title: "Hangman Game",
    tabTitle: "Hangman",
    description: "Scan to join, set a hidden word, and guess letters together.",
    icon: Gamepad2,
    tone: "indigo",
    enabled: true,
  },
  {
    id: "scan-text",
    title: "Scanned Text",
    tabTitle: "Scanned Text",
    description: "Scan text from images, pasted screenshots, and PDFs.",
    icon: ScanTextIcon,
    tone: "green",
    enabled: true,
  },
  {
    id: "sna-gpt",
    title: "SNA GPT",
    tabTitle: "SNA GPT",
    description: "Chat with your custom GPT assistant created by Song Veasna.",
    icon: BotMessageSquare,
    logo: snaGptLogo,
    tone: "orange",
    enabled: true,
  },
  {
    id: "comment",
    title: "Comment Tool",
    tabTitle: "Comment",
    description: "Collect phone comments and show them on the screen.",
    icon: MessageSquare,
    tone: "pink",
    enabled: true,
  },
  {
    id: "video-download",
    title: "Video Download",
    tabTitle: "Video Download",
    description: "Download authorized Facebook, YouTube, and TikTok media.",
    icon: HardDriveDownload,
    tone: "teal",
    enabled: true,
  },
  {
    id: "image",
    title: "Image Tools",
    tabTitle: "Image Tools",
    description: "Resize, compress, scan to document, convert, crop, and enhance photos.",
    icon: FileImage,
    tone: "cyan",
    enabled: true,
  },
  {
    id: "khmer-calendar",
    title: "Khmer Calendar",
    tabTitle: "Khmer Calendar",
    description: "Create and print a Khmer monthly calendar.",
    icon: CalendarDays,
    tone: "yellow",
    enabled: true,
  },
  {
    id: "logo-cut",
    title: "Cut Logo",
    tabTitle: "Cut Logo",
    description: "Cut Site Logo 210 x 50 and Report Logo 300 x 300.",
    icon: Scissors,
    tone: "indigo",
    enabled: true,
  },
];

const toneColors = {
  purple: "#7c3aed",
  blue: "#2563eb",
  green: "#16a34a",
  red: "#ef4444",
  orange: "#f97316",
  pink: "#ec407a",
  cyan: "#06b6d4",
  excel: "#217346",
  teal: "#0f766e",
  indigo: "#2563eb",
  yellow: "#f4b400",
  slate: "#475569",
};

function getCategoryById(id) {
  return categories.find((item) => item.id === id) || null;
}

function getOpenableCategoryById(id) {
  const category = getCategoryById(id);

  if (!category?.enabled || category.externalUrl) {
    return null;
  }

  return category;
}

function getHashToolId() {
  const hashValue = window.location.hash.replace("#", "");
  return hashValue.split("?")[0];
}

function getHashParams() {
  const [, query = ""] = window.location.hash.split("?");
  return new URLSearchParams(query);
}

function updateBrowserTab(category) {
  const title = category
    ? `${category.tabTitle || category.title} - Assistand Help`
    : "Assistand Help - Main Categories";
  const color = category ? toneColors[category.tone] || "#2563eb" : "#f7b500";
  const label = category ? (category.tabTitle || category.title).slice(0, 2) : "AH";
  const favicon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="${color}"/>
      <text x="32" y="39" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="white">${label}</text>
    </svg>
  `;
  let faviconLink = document.querySelector('link[rel="icon"]');

  document.title = title;

  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    document.head.appendChild(faviconLink);
  }

  faviconLink.href = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
}

function BrandLogo() {
  return (
    <div className="brand-lockup">
      <img src={mamLogo} alt="Mega Asset Management Co.,Ltd" />
    </div>
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAccessInfoMarkdown({ user, username }) {
  return `*System Access Information*
=========================
URL: https://acumatica.mam.com.kh:22888/MegaProduction/
*Name: ${user}*
Username Login: \`${username}\`
Password: \`MAM@123456\`

_Please change password after first login._`;
}

function buildAccessInfoHtml({ user, username }) {
  const safeUser = escapeHtml(user);
  const safeUsername = escapeHtml(username);

  return `<div><strong>System Access Information</strong><br>
=========================<br>
URL: https://acumatica.mam.com.kh:22888/MegaProduction/<br>
<strong>Name: ${safeUser}</strong><br>
Username Login: <code>${safeUsername}</code><br>
Password: <code>MAM@123456</code><br>
<br>
<em>Please change password after first login.</em></div>`;
}

function UserAccessModal({ onClose }) {
  const [user, setUser] = useState("");
  const [username, setUsername] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const markdownResult = buildAccessInfoMarkdown({ user, username });
  const htmlResult = buildAccessInfoHtml({ user, username });

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  async function copyResult() {
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([htmlResult], { type: "text/html" }),
            "text/plain": new Blob([markdownResult], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(markdownResult);
      }
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Could not copy.");
    }
  }

  return (
    <div className="access-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="access-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="access-modal-header">
          <div>
            <p className="eyebrow">User Access</p>
            <h2 id="access-modal-title">Generate Login Info</h2>
          </div>
          <button className="access-icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        <label className="access-field" htmlFor="access-user-input">
          <span>Name</span>
          <input
            id="access-user-input"
            type="text"
            value={user}
            onChange={(event) => {
              setUser(event.target.value);
              setCopyStatus("");
            }}
            placeholder="Input Name"
            autoFocus
          />
        </label>

        <label className="access-field" htmlFor="access-username-input">
          <span>Username Login</span>
          <input
            id="access-username-input"
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setCopyStatus("");
            }}
            placeholder="M-00XXX"
          />
        </label>

        <div className="access-result">
          <strong>System Access Information</strong>
          <span>=========================</span>
          <span>URL: https://acumatica.mam.com.kh:22888/MegaProduction/</span>
          <strong>Name: {user}</strong>
          <span>
            Username Login: <code>{username}</code>
          </span>
          <span>
            Password: <code>MAM@123456</code>
          </span>
          <em>Please change password after first login.</em>
        </div>

        <footer className="access-modal-actions">
          <span>{copyStatus}</span>
          <button className="button primary" type="button" onClick={copyResult}>
            <Copy size={16} strokeWidth={2.2} />
            <span>Copy</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

function PasswordModal({ error, onClose, onSubmit }) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(password);
  }

  return (
    <div className="password-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="password-modal-header">
          <div>
            <p className="eyebrow">Protected</p>
            <h2 id="password-modal-title">Enter Password</h2>
          </div>
          <button className="access-icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>
        <form className="password-modal-form" onSubmit={handleSubmit}>
          <label className="access-field" htmlFor="protected-password-input">
            <span>Password</span>
            <input
              id="protected-password-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
          <span className="password-modal-error">{error}</span>
          <button className="button primary" type="submit">
            <span>Unlock</span>
          </button>
        </form>
      </section>
    </div>
  );
}

function CategoryCard({ category, onOpen, onProtectedOpen }) {
  const Icon = category.icon;
  const isExternal = Boolean(category.externalUrl);
  const statusText =
    category.statusLabel ||
    (category.enabled ? (isExternal ? "Open link" : "Open") : "Coming soon");
  const ArrowIcon = isExternal ? ExternalLink : ChevronRight;
  const content = (
    <>
      <span className="corner-accent" aria-hidden="true" />
      <span className="category-icon" aria-hidden="true">
        {category.logo ? (
          <img src={category.logo} alt="" />
        ) : (
          <Icon size={38} strokeWidth={1.9} />
        )}
      </span>
      <span className="category-copy">
        <strong>{category.title}</strong>
        <span>{category.description}</span>
      </span>
      {!category.enabled ? <span className="feature-status">{statusText}</span> : null}
      <span className="category-arrow" aria-hidden="true">
        <ArrowIcon size={22} strokeWidth={2.6} />
      </span>
    </>
  );

  if (isExternal && category.enabled) {
    return (
      <a
        className={`category-card tone-${category.tone}`}
        href={category.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${statusText} ${category.title}`}
        onClick={(event) => {
          if (category.protected) {
            event.preventDefault();
            onProtectedOpen(category.externalUrl);
          }
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={`category-card tone-${category.tone}`}
      type="button"
      onClick={() => {
        if (category.enabled) {
          onOpen(category.id);
        }
      }}
      disabled={!category.enabled}
      aria-label={`${statusText} ${category.title}`}
    >
      {content}
    </button>
  );
}

function Dashboard({ onOpen }) {
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const [passwordAttempts, setPasswordAttempts] = useState(0);

  function requestPassword(action) {
    setPasswordError("");
    setPasswordAttempts(0);
    setPasswordModal(action);
  }

  function closePasswordModal() {
    setPasswordError("");
    setPasswordAttempts(0);
    setPasswordModal(null);
  }

  function handlePasswordSubmit(password) {
    if (password !== protectedActionPassword) {
      const nextAttempts = passwordAttempts + 1;

      if (nextAttempts >= protectedPasswordMaxAttempts) {
        setPasswordError("");
        setPasswordAttempts(0);
        setPasswordModal(null);
        return;
      }

      setPasswordAttempts(nextAttempts);
      setPasswordError(`${protectedPasswordMessage} ${protectedPasswordMaxAttempts - nextAttempts} tries left.`);
      return;
    }

    const action = passwordModal;
    closePasswordModal();

    if (action?.type === "access") {
      setAccessModalOpen(true);
    }

    if (action?.type === "external" && action.url) {
      window.open(action.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-header">
        <BrandLogo />

        <div className="dashboard-title-block">
          <h1 id="dashboard-title">Assistand Help</h1>
          <p>Main Categories</p>
        </div>

        <div className="dashboard-icon-actions">
          <button
            className="dashboard-icon-button calendar-shortcut-button"
            type="button"
            onClick={() => onOpen("khmer-calendar")}
            aria-label="Open Khmer Calendar"
            title="Khmer Calendar"
          >
            <CalendarDays size={22} strokeWidth={2.2} />
          </button>
          <button
            className="dashboard-icon-button access-generator-button"
            type="button"
            onClick={() => setAccessModalOpen(true)}
            aria-label="Generate user access information"
            title="Generate user access information"
          >
            <Sparkles size={22} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {accessModalOpen ? <UserAccessModal onClose={() => setAccessModalOpen(false)} /> : null}
      {passwordModal ? (
        <PasswordModal
          error={passwordError}
          onClose={closePasswordModal}
          onSubmit={handlePasswordSubmit}
        />
      ) : null}

      <div className="category-grid">
        {categories.filter((category) => category.id !== "khmer-calendar").map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onOpen={onOpen}
            onProtectedOpen={(url) => requestPassword({ type: "external", url })}
          />
        ))}
      </div>

      <footer className="dashboard-footer">
        Copyright 2026 Create By សង វាសនា
      </footer>
    </section>
  );
}

function ToolHeader({ onBack }) {
  return (
    <header className="tool-header">
      <button className="back-button" type="button" onClick={onBack} aria-label="Back to categories">
        <ArrowLeft size={20} />
        <span>Main Categories</span>
      </button>
    </header>
  );
}

function TimerTool() {
  return (
    <div className="timer-frame-shell tool-frame-shell">
      <iframe
        className="timer-frame"
        src="/break-time.html"
        title="Set Timer"
        allow="fullscreen"
        allowFullScreen
      />
    </div>
  );
}

function PlaceholderTool({ category }) {
  const Icon = category.icon || CheckSquare;

  return (
    <section className={`placeholder-tool tone-${category.tone}`}>
      <span className="category-icon" aria-hidden="true">
        <Icon size={56} strokeWidth={1.8} />
      </span>
      <h2>{category.title}</h2>
      <p>{category.description}</p>
      <span className="placeholder-badge">Coming Soon</span>
    </section>
  );
}

function ToolView({ activeId, onBack }) {
  const category = useMemo(
    () => getCategoryById(activeId) || categories[0],
    [activeId],
  );
  const hideHeader =
    activeId === "sna-gpt" ||
    (activeId === "comment" && getHashParams().get("view") === "screen") ||
    (activeId === "hangman" && getHashParams().get("view") === "screen");

  return (
    <section className={`tool-view tool-view--${activeId}`}>
      {!hideHeader ? <ToolHeader onBack={onBack} /> : null}

      {activeId === "timer" ? <TimerTool /> : null}
      {activeId === "qr" ? <QrStudio /> : null}
      {activeId === "pdf" ? <PdfTools /> : null}
      {activeId === "image" ? <ImageTools /> : null}
      {activeId === "logo-cut" ? <LogoCutTool /> : null}
      {activeId === "scan-text" ? <ScanTextTool /> : null}
      {activeId === "sna-gpt" ? <SnaGptTool onBack={onBack} /> : null}
      {activeId === "comment" ? <CommentTool /> : null}
      {activeId === "hangman" ? <HangmanTool /> : null}
      {activeId === "video-download" ? <VideoDownloadTool /> : null}
      {activeId === "khmer-calendar" ? <KhmerCalendarTool /> : null}
      {activeId === "acumatica-flow" ? <AcumaticaFlowTool /> : null}
      {activeId !== "timer" && activeId !== "qr" && activeId !== "pdf" && activeId !== "image" && activeId !== "logo-cut" && activeId !== "scan-text" && activeId !== "sna-gpt" && activeId !== "comment" && activeId !== "hangman" && activeId !== "video-download" && activeId !== "khmer-calendar" && activeId !== "acumatica-flow" ? (
        <PlaceholderTool category={category} />
      ) : null}
    </section>
  );
}

export default function App() {
  const [activeTool, setActiveTool] = useState(() => {
    const hashId = getHashToolId();
    return getOpenableCategoryById(hashId) ? hashId : null;
  });

  useEffect(() => {
    function handleHashChange() {
      const hashId = getHashToolId();
      setActiveTool(getOpenableCategoryById(hashId) ? hashId : null);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const category = getCategoryById(activeTool);
    const currentHashId = getHashToolId();

    updateBrowserTab(category);

    if (category && currentHashId !== category.id) {
      window.history.replaceState(null, "", `#${category.id}`);
    }

    if (!category && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [activeTool]);

  return (
    <div className={`app-shell tool-${activeTool || "home"}`}>
      <main className={`app-layout${activeTool ? ` is-tool-view is-${activeTool}-view` : ""}`}>
        {activeTool ? (
          <ToolView activeId={activeTool} onBack={() => setActiveTool(null)} />
        ) : (
          <Dashboard onOpen={setActiveTool} />
        )}
      </main>
    </div>
  );
}

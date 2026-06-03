import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BotMessageSquare,
  CheckSquare,
  ChevronRight,
  Copy,
  Clock3,
  ExternalLink,
  HardDriveDownload,
  FileText,
  FileImage,
  FileSpreadsheet,
  MessageSquare,
  QrCode,
  ScanText as ScanTextIcon,
  UserRound,
  X,
} from "lucide-react";
import CommentTool from "./components/CommentTool";
import ImageTools from "./components/ImageTools";
import PdfTools from "./components/PdfTools";
import QrStudio from "./components/QrStudio";
import ScanTextTool from "./components/ScanTextTool";
import SnaGptTool from "./components/SnaGptTool";
import VideoDownloadTool from "./components/VideoDownloadTool";
import mamLogo from "./image/mam-logo.png";
import snaGptLogo from "./image/sna-gpt.png";

const categories = [
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
    id: "qr",
    title: "Prepare QR",
    tabTitle: "QR Code",
    description: "Prepare Template QR Code Canadia Bank for Report.",
    icon: QrCode,
    tone: "blue",
    enabled: true,
  },
  {
    id: "pdf",
    title: "PDF Tools",
    tabTitle: "PDF",
    description: "Split, merge, and compress PDF files.",
    icon: FileText,
    tone: "red",
    enabled: true,
  },
  {
    id: "master-list-boq",
    title: "Master List BOQ",
    tabTitle: "Master List BOQ",
    description: "Open the shared BOQ master list workbook.",
    icon: FileSpreadsheet,
    tone: "excel",
    enabled: true,
    externalUrl:
      "https://megaassetmanagement-my.sharepoint.com/:x:/g/personal/phal_bunnavath_mam_com_kh/IQAW0G_7jYZLS7khZPkBFvzRAQVNj0cc1j7RS94carTvRBg?rtime=LkB8YN-23kg",
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
    description: "Resize, compress, remove background, convert, crop, and enhance photos.",
    icon: FileImage,
    tone: "cyan",
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

function buildAccessInfo({ user, username }) {
  return `*System Access Information*
=========================
URL: https://acumatica.mam.com.kh:22888/MegaProduction/
*Name: ${user}*
Username Login: \`${username}\`
Password: \`MAM@123456\`

_Please change password after first login._`;
}

function UserAccessModal({ onClose }) {
  const [user, setUser] = useState("");
  const [username, setUsername] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const result = buildAccessInfo({ user, username });

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
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

        <pre className="access-result">{result}</pre>

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

function CategoryCard({ category, onOpen }) {
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

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-header">
        <BrandLogo />

        <div className="dashboard-title-block">
          <h1 id="dashboard-title">Assistand Help</h1>
          <p>Main Categories</p>
        </div>

        <div className="dot-grid" aria-hidden="true">
          {Array.from({ length: 25 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>

        <button
          className="access-generator-button"
          type="button"
          onClick={() => setAccessModalOpen(true)}
          aria-label="Generate user access information"
          title="Generate user access information"
        >
          <UserRound size={22} strokeWidth={2.2} />
        </button>
      </header>

      {accessModalOpen ? <UserAccessModal onClose={() => setAccessModalOpen(false)} /> : null}

      <div className="category-grid">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} onOpen={onOpen} />
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
    (activeId === "comment" && getHashParams().get("view") === "screen");

  return (
    <section className={`tool-view tool-view--${activeId}`}>
      {!hideHeader ? <ToolHeader onBack={onBack} /> : null}

      {activeId === "timer" ? <TimerTool /> : null}
      {activeId === "qr" ? <QrStudio /> : null}
      {activeId === "pdf" ? <PdfTools /> : null}
      {activeId === "image" ? <ImageTools /> : null}
      {activeId === "scan-text" ? <ScanTextTool /> : null}
      {activeId === "sna-gpt" ? <SnaGptTool onBack={onBack} /> : null}
      {activeId === "comment" ? <CommentTool /> : null}
      {activeId === "video-download" ? <VideoDownloadTool /> : null}
      {activeId !== "timer" && activeId !== "qr" && activeId !== "pdf" && activeId !== "image" && activeId !== "scan-text" && activeId !== "sna-gpt" && activeId !== "comment" && activeId !== "video-download" ? (
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

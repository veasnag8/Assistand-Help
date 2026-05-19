import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckSquare,
  ChevronRight,
  Clock3,
  FileText,
  FileImage,
  MessageSquare,
  QrCode,
  ScanText as ScanTextIcon,
} from "lucide-react";
import CommentTool from "./components/CommentTool";
import ImageTools from "./components/ImageTools";
import PdfTools from "./components/PdfTools";
import QrStudio from "./components/QrStudio";
import ScanTextTool from "./components/ScanTextTool";
import mamLogo from "./image/mam-logo.png";

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
    description: "Generate QR codes for attendance.",
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
    id: "image",
    title: "Image Tools",
    tabTitle: "Image Tools",
    description: "Resize, compress, remove background, convert, crop, and enhance photos.",
    icon: FileImage,
    tone: "cyan",
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
    id: "comment",
    title: "Comment Tool",
    tabTitle: "Comment",
    description: "Collect phone comments and show them on the screen.",
    icon: MessageSquare,
    tone: "pink",
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
  indigo: "#2563eb",
  yellow: "#f4b400",
};

function getCategoryById(id) {
  return categories.find((item) => item.id === id) || null;
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

function CategoryCard({ category, onOpen }) {
  const Icon = category.icon;
  const statusText = category.enabled ? "Open" : "Coming soon";

  return (
    <button
      className={`category-card tone-${category.tone}`}
      type="button"
      onClick={() => onOpen(category.id)}
      aria-label={`${statusText} ${category.title}`}
    >
      <span className="corner-accent" aria-hidden="true" />
      <span className="category-icon" aria-hidden="true">
        <Icon size={38} strokeWidth={1.9} />
      </span>
      <span className="category-copy">
        <strong>{category.title}</strong>
        <span>{category.description}</span>
      </span>
      {!category.enabled ? <span className="feature-status">Coming Soon</span> : null}
      <span className="category-arrow" aria-hidden="true">
        <ChevronRight size={22} strokeWidth={2.6} />
      </span>
    </button>
  );
}

function Dashboard({ onOpen }) {
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
      </header>

      <div className="category-grid">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} onOpen={onOpen} />
        ))}
      </div>

      <footer className="dashboard-footer">
        Copyright 2026 Create By Song Veasna
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
  const hideHeader = activeId === "comment" && getHashParams().get("view") === "screen";

  return (
    <section className={`tool-view tool-view--${activeId}`}>
      {!hideHeader ? <ToolHeader onBack={onBack} /> : null}

      {activeId === "timer" ? <TimerTool /> : null}
      {activeId === "qr" ? <QrStudio /> : null}
      {activeId === "pdf" ? <PdfTools /> : null}
      {activeId === "image" ? <ImageTools /> : null}
      {activeId === "scan-text" ? <ScanTextTool /> : null}
      {activeId === "comment" ? <CommentTool /> : null}
      {activeId !== "timer" && activeId !== "qr" && activeId !== "pdf" && activeId !== "image" && activeId !== "scan-text" && activeId !== "comment" ? (
        <PlaceholderTool category={category} />
      ) : null}
    </section>
  );
}

export default function App() {
  const [activeTool, setActiveTool] = useState(() => {
    const hashId = getHashToolId();
    return getCategoryById(hashId) ? hashId : null;
  });

  useEffect(() => {
    function handleHashChange() {
      const hashId = getHashToolId();
      setActiveTool(getCategoryById(hashId) ? hashId : null);
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
      <main className={`app-layout${activeTool ? " is-tool-view" : ""}`}>
        {activeTool ? (
          <ToolView activeId={activeTool} onBack={() => setActiveTool(null)} />
        ) : (
          <Dashboard onOpen={setActiveTool} />
        )}
      </main>
    </div>
  );
}

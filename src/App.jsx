import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BotMessageSquare,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  Copy,
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
  UserRoundPlus,
  Workflow,
  X,
} from "lucide-react";
import AcumaticaFlowTool from "./components/AcumaticaFlowTool";
import AcumaticaNumberingTool from "./components/AcumaticaNumberingTool";
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
    description: "View process flow, team access rights, and AP/AR correction guidance in separate tabs. Petty Cash updated: 22/05/2026.",
    icon: Workflow,
    logo: acumaticaLogo,
    tone: "slate",
    enabled: true,
  },
  {
    id: "acumatica-numbering",
    title: "Acumatica Numbering",
    tabTitle: "Numbering Generator",
    description: "Generate and export numbering sequences by branch, year, and category.",
    icon: FileSpreadsheet,
    tone: "excel",
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
    ? `${category.tabTitle || category.title} - Assistant Help`
    : "Assistant Help - Main Categories";
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

const financeAccessGroups = [
  {
    title: "AR Invoice",
    tone: "rose",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
  {
    title: "AR Payment/Cash Sale",
    tone: "blue",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
  {
    title: "AP Bill",
    tone: "orange",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
  {
    title: "AP Payment",
    tone: "amber",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
  {
    title: "Cash Purchase",
    tone: "lavender",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
  {
    title: "GL",
    tone: "green",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
];

const financeAccessRoles = [
  {
    name: "AR Officer",
    permissions: ["ar.view", "ar.create", "payment.view", "payment.create", "gl.view", "gl.create"],
  },
  {
    name: "AP Officer",
    permissions: ["bill.view", "bill.create", "apPayment.view", "apPayment.create", "cashPurchase.view", "cashPurchase.create", "gl.view", "gl.create"],
  },
  {
    name: "Account Senior",
    permissions: ["ar.view", "ar.create", "ar.edit", "payment.view", "payment.create", "payment.edit", "bill.view", "bill.create", "bill.edit", "apPayment.view", "apPayment.create", "apPayment.edit", "cashPurchase.view", "cashPurchase.create", "cashPurchase.edit", "gl.view", "gl.create", "gl.edit"],
  },
  {
    name: "Account Supervisor",
    permissions: ["ar.view", "ar.create", "ar.edit", "ar.release", "payment.view", "payment.release", "bill.view", "bill.create", "bill.edit", "bill.release", "apPayment.view", "apPayment.create", "apPayment.edit", "cashPurchase.view", "cashPurchase.release", "gl.view", "gl.create", "gl.edit"],
  },
  {
    name: "Finance Manager",
    permissions: ["ar.view", "ar.edit", "ar.release", "payment.view", "payment.edit", "payment.release", "bill.view", "bill.edit", "bill.release", "apPayment.view", "apPayment.edit", "apPayment.release", "cashPurchase.view", "cashPurchase.edit", "cashPurchase.release", "gl.view", "gl.edit", "gl.release"],
  },
];

const siteAccessGroups = [
  {
    title: "AR Invoice",
    tone: "rose",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
  {
    title: "Run Contract Billing",
    tone: "lime",
    permissions: ["Run Contract Billing"],
  },
  {
    title: "AR Payment/Cash Sale",
    tone: "blue",
    permissions: ["View only", "Create", "Edit/Remove Hold", "Release"],
  },
  {
    title: "Contract",
    tone: "green",
    permissions: ["View only", "Create", "Set Up", "Activate"],
  },
];

const siteAccessRoles = [
  {
    name: "Sale Invoice",
    permissions: ["ar.view", "ar.create", "billing.run", "payment.view", "contract.view"],
  },
  {
    name: "Sale Supervisor",
    permissions: ["ar.view", "ar.edit", "ar.release", "payment.view", "contract.view"],
  },
  {
    name: "Cash Officer",
    permissions: ["ar.view", "payment.view", "payment.create", "contract.view"],
  },
  {
    name: "Cash Supervisor",
    permissions: ["ar.view", "payment.view", "payment.edit", "payment.release", "contract.view"],
  },
  {
    name: "Project Invoice & Cash",
    permissions: ["ar.view", "ar.create", "billing.run", "payment.view", "payment.create", "contract.view"],
  },
  {
    name: "Project Invoice Release & Cash Create",
    permissions: ["ar.view", "ar.edit", "ar.release", "payment.view", "payment.create", "contract.view"],
  },
  {
    name: "Contract Officer",
    permissions: ["ar.view", "payment.view", "contract.view", "contract.create", "contract.setup"],
  },
  {
    name: "Project Manager",
    permissions: ["ar.view", "ar.edit", "ar.release", "payment.view", "payment.edit", "payment.release", "contract.view", "contract.setup", "contract.activate"],
  },
];

function AccessRightsTable({ title, groups, roles }) {
  const columns = groups.flatMap((group) =>
    group.permissions.map((label) => ({
      id: `${group.title}.${label}`,
      label,
      tone: group.tone,
    })),
  );
  const rolePermissionKeys = groups.flatMap((group) => {
    const prefix = group.title;
    return group.permissions.map((permission) => {
      const simplifiedPrefix = {
        "AR Invoice": "ar",
        "AR Payment/Cash Sale": "payment",
        "AP Bill": "bill",
        "AP Payment": "apPayment",
        "Cash Purchase": "cashPurchase",
        GL: "gl",
        "Run Contract Billing": "billing",
        Contract: "contract",
      }[prefix];
      const simplifiedPermission = {
        "View only": "view",
        Create: "create",
        "Edit/Remove Hold": "edit",
        Release: "release",
        "Run Contract Billing": "run",
        "Set Up": "setup",
        Activate: "activate",
      }[permission];
      return `${simplifiedPrefix}.${simplifiedPermission}`;
    });
  });

  return (
    <section className="access-table-section" aria-label={title}>
      <h3>{title}</h3>
      <p className="access-table-hint">Swipe horizontally to view all permissions.</p>
      <div className="access-table-scroll">
        <table
          className={`access-rights-table ${groups.length > 4 ? "access-rights-table--finance" : "access-rights-table--site"}`}
        >
          <thead>
            <tr>
              <th className="access-number-heading" rowSpan={2} scope="col">№</th>
              <th className="access-role-heading" rowSpan={2} scope="col">Role ID</th>
              {groups.map((group) => (
                <th
                  className={`access-group-heading tone-${group.tone}`}
                  colSpan={group.permissions.length}
                  key={group.title}
                  scope="colgroup"
                >
                  {group.title}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((column) => (
                <th
                  className={`access-permission-heading tone-${column.tone}`}
                  key={column.id}
                  scope="col"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role, roleIndex) => (
              <tr key={role.name}>
                <th scope="row" className="access-row-number">{roleIndex + 1}</th>
                <th scope="row" className="access-row-role">{role.name}</th>
                {rolePermissionKeys.map((permissionKey, columnIndex) => {
                  const checked = role.permissions.includes(permissionKey);
                  return (
                    <td
                      className="access-permission-cell"
                      key={columns[columnIndex].id}
                      aria-label={checked ? "Allowed" : "Not allowed"}
                    >
                      {checked ? <span aria-hidden="true">✓</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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

function AccessRightsModal({ onClose }) {
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
          <div className="access-title">
            <h2 id="access-modal-title">Acumatica User Access Right Update</h2>
            <p>Date: 09/01/2025</p>
          </div>
          <button className="access-icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>
        <AccessRightsTable title="Finance Division" groups={financeAccessGroups} roles={financeAccessRoles} />
        <AccessRightsTable title="Site Group Night Market" groups={siteAccessGroups} roles={siteAccessRoles} />
        <p className="access-effective-note">Note: This access right is effective from the sign date.</p>
      </section>
    </div>
  );
}

function GenerateUserModal({ onClose }) {
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
        className="generate-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-user-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="access-modal-header">
          <div>
            <p className="eyebrow">Generate User</p>
            <h2 id="generate-user-modal-title">Generate Login Info</h2>
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
  const [generateUserModalOpen, setGenerateUserModalOpen] = useState(false);
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
          <h1 id="dashboard-title">Assistant Help</h1>
          <p>Main Categories</p>
        </div>

        <div className="dashboard-icon-actions">
          <button
            className="dashboard-icon-button video-download-shortcut-button"
            type="button"
            onClick={() => onOpen("video-download")}
            aria-label="Open Video Download"
            title="Video Download"
          >
            <HardDriveDownload size={22} strokeWidth={2.2} />
          </button>
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
            className="dashboard-icon-button generate-user-shortcut-button"
            type="button"
            onClick={() => setGenerateUserModalOpen(true)}
            aria-label="Generate User"
            title="Generate User"
          >
            <UserRoundPlus size={22} strokeWidth={2.2} />
          </button>
          <button
            className="dashboard-icon-button access-generator-button"
            type="button"
            onClick={() => setAccessModalOpen(true)}
            aria-label="User Access Rights"
            title="User Access Rights"
          >
            <ClipboardCheck size={22} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {accessModalOpen ? <AccessRightsModal onClose={() => setAccessModalOpen(false)} /> : null}
      {generateUserModalOpen ? (
        <GenerateUserModal onClose={() => setGenerateUserModalOpen(false)} />
      ) : null}
      {passwordModal ? (
        <PasswordModal
          error={passwordError}
          onClose={closePasswordModal}
          onSubmit={handlePasswordSubmit}
        />
      ) : null}

      <div className="category-grid">
        {categories.filter((category) => !["khmer-calendar", "video-download"].includes(category.id)).map((category) => (
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
      {activeId === "acumatica-numbering" ? <AcumaticaNumberingTool /> : null}
      {activeId !== "timer" && activeId !== "qr" && activeId !== "pdf" && activeId !== "image" && activeId !== "logo-cut" && activeId !== "scan-text" && activeId !== "sna-gpt" && activeId !== "comment" && activeId !== "hangman" && activeId !== "video-download" && activeId !== "khmer-calendar" && activeId !== "acumatica-flow" && activeId !== "acumatica-numbering" ? (
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

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import Panel from "./Panel";
import {
  dataUrlToImage,
  downloadBlob,
  enhanceImage,
  isPdfFile,
  pdfFileToImage,
  readFileAsDataUrl,
} from "../lib/file-utils";
import {
  BADGE_SCALE_MAX,
  BADGE_SCALE_MIN,
  BADGE_SCALE_STEP,
  DEFAULT_BADGE_POSITION,
  OUTPUT_HEIGHT,
  OUTPUT_WIDTH,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clamp,
  defaultQrDetails,
  getCenteredCrop,
  normalizeCropPosition,
  renderQrLayout,
} from "../lib/qr-utils";

const textFields = [
  { id: "accountName", label: "Account name" },
  { id: "accountNumber", label: "Account number" },
];

const KHMER_RIEL_SYMBOL = "\u17DB";
const KHR_CURRENCY_LABEL = `KHR ${KHMER_RIEL_SYMBOL}`;

const currencyOptions = [
  { value: "USD $", label: "USD $" },
  { value: KHR_CURRENCY_LABEL, label: KHR_CURRENCY_LABEL },
];

const badgeOptions = [
  { value: "", label: "None" },
  { value: "$", label: "$" },
  { value: KHMER_RIEL_SYMBOL, label: KHMER_RIEL_SYMBOL },
];

const sqlScriptUpdateUrl =
  "https://megaassetmanagement-my.sharepoint.com/:x:/g/personal/phal_bunnavath_mam_com_kh/IQAfMdcUw23KQJOmCvL4NkKxAQO__7lpCDyTfYD0xUIz_Es?e=HRXg4L";

function formatAccountNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const groups = [3, 4, 3, 3];
  const parts = [];
  let cursor = 0;

  for (const size of groups) {
    if (cursor >= digits.length) {
      break;
    }

    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }

  return parts.join(" ");
}

function formatAccountName(value) {
  return value.toLocaleUpperCase();
}

function getExportFilename(accountName, sourceFileName) {
  const sanitizedAccountName = formatAccountName(accountName || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  const fallbackName = sourceFileName
    ? sourceFileName.replace(/\.[^.]+$/, "")
    : "qr-layout";

  return `${sanitizedAccountName || fallbackName}.png`;
}

export default function QrStudio() {
  const previewRef = useRef(null);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    scale: 1,
    target: "qr",
  });

  const [sourceImage, setSourceImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [enhancedImage, setEnhancedImage] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [details, setDetails] = useState(defaultQrDetails);
  const [isBadgeLocked, setIsBadgeLocked] = useState(true);

  useEffect(() => {
    if (!previewRef.current) {
      return;
    }

    let active = true;

    const renderPreview = () => {
      if (!previewRef.current || !active) {
        return;
      }

      renderQrLayout(
        previewRef.current,
        {
          sourceImage,
          zoom,
          rotation,
          crop,
          ...details,
        },
        { showGuide: true },
      );
    };

    renderPreview();

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        renderPreview();
      });
    }

    return () => {
      active = false;
    };
  }, [sourceImage, zoom, rotation, crop, details]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const nextImage = isPdfFile(file)
        ? await pdfFileToImage(file)
        : await dataUrlToImage(await readFileAsDataUrl(file));
      const nextCrop = getCenteredCrop(nextImage, 1);

      setOriginalImage(nextImage);
      setEnhancedImage(null);
      setSourceImage(nextImage);
      setFileName(file.name);
      setIsEnhanced(false);
      setZoom(1);
      setRotation(0);
      setCrop(nextCrop);
    } catch (error) {
      console.error(error);
    } finally {
      event.target.value = "";
    }
  }

  async function handleEnhancePhoto() {
    if (!originalImage) {
      return;
    }

    if (isEnhanced) {
      setSourceImage(originalImage);
      setIsEnhanced(false);
      setCrop(normalizeCropPosition(originalImage, crop, zoom));
      return;
    }

    try {
      setIsEnhancing(true);
      const nextEnhancedImage = enhancedImage || (await enhanceImage(originalImage));

      setEnhancedImage(nextEnhancedImage);
      setSourceImage(nextEnhancedImage);
      setIsEnhanced(true);
      setCrop(normalizeCropPosition(nextEnhancedImage, crop, zoom));
    } catch (error) {
      console.error(error);
    } finally {
      setIsEnhancing(false);
    }
  }

  function updateDetail(field, value) {
    setDetails((current) => ({
      ...current,
      [field]:
        field === "accountNumber"
          ? formatAccountNumber(value)
          : field === "accountName"
            ? formatAccountName(value)
            : value,
    }));
  }

  function handleZoomChange(rawValue) {
    const nextZoom = clamp(Number(rawValue) || 1, ZOOM_MIN, ZOOM_MAX);
    const nextCrop = normalizeCropPosition(sourceImage, crop, nextZoom);

    setZoom(nextZoom);
    setCrop(nextCrop);
  }

  function handleRotationChange(rawValue) {
    setRotation(clamp(Number(rawValue) || 0, -180, 180));
  }

  function handleBadgeScaleChange(rawValue) {
    const nextBadgeScale = clamp(
      Number(rawValue) || defaultQrDetails.badgeScale,
      BADGE_SCALE_MIN,
      BADGE_SCALE_MAX,
    );

    setDetails((current) => ({
      ...current,
      badgeScale: nextBadgeScale,
    }));
  }

  function nudgeBadgeScale(direction) {
    handleBadgeScaleChange(details.badgeScale + BADGE_SCALE_STEP * direction);
  }

  function resetView() {
    if (!sourceImage) {
      return;
    }

    setZoom(1);
    setRotation(0);
    setCrop(getCenteredCrop(sourceImage, 1));
  }

  async function exportPng() {
    if (!sourceImage) {
      return;
    }

    const exportCanvas = document.createElement("canvas");

    renderQrLayout(
      exportCanvas,
      {
        sourceImage,
        zoom,
        rotation,
        crop,
        ...details,
      },
      { showGuide: false },
    );

    const blob = await new Promise((resolve) => {
      exportCanvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      return;
    }

    downloadBlob(
      blob,
      getExportFilename(details.accountName, fileName),
    );
  }

  function getCanvasPointer(event, bounds) {
    const scale = OUTPUT_WIDTH / bounds.width;

    return {
      x: (event.clientX - bounds.left) * scale,
      y: (event.clientY - bounds.top) * scale,
      scale,
    };
  }

  function isBadgePointer(event, bounds) {
    if (isBadgeLocked || !details.badgeText.trim()) {
      return false;
    }

    const pointer = getCanvasPointer(event, bounds);
    const badgeScale = clamp(
      Number(details.badgeScale) || defaultQrDetails.badgeScale,
      BADGE_SCALE_MIN,
      BADGE_SCALE_MAX,
    );
    const radius = 39 * badgeScale + 12;
    const badgeX = Number(details.badgePosition?.x) || DEFAULT_BADGE_POSITION.x;
    const badgeY = Number(details.badgePosition?.y) || DEFAULT_BADGE_POSITION.y;

    return Math.hypot(pointer.x - badgeX, pointer.y - badgeY) <= radius;
  }

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const bounds = previewRef.current?.getBoundingClientRect();

    if (!bounds) {
      return;
    }

    const pointer = getCanvasPointer(event, bounds);
    const canDragBadge = !isBadgeLocked && badgeEnabled;
    const target = canDragBadge ? "badge" : "qr";

    if (target === "qr" && !sourceImage) {
      return;
    }

    const badgeX = Number(details.badgePosition?.x) || DEFAULT_BADGE_POSITION.x;
    const badgeY = Number(details.badgePosition?.y) || DEFAULT_BADGE_POSITION.y;
    const badgeWasClicked = isBadgePointer(event, bounds);

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: target === "badge" ? (badgeWasClicked ? badgeX : pointer.x) : crop.x,
      originY: target === "badge" ? (badgeWasClicked ? badgeY : pointer.y) : crop.y,
      scale: pointer.scale,
      target,
    };

    if (target === "badge" && !badgeWasClicked) {
      setDetails((current) => ({
        ...current,
        badgePosition: {
          x: clamp(pointer.x, 0, OUTPUT_WIDTH),
          y: clamp(pointer.y, 0, OUTPUT_HEIGHT),
        },
      }));
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = (event.clientX - dragRef.current.startX) * dragRef.current.scale;
    const deltaY = (event.clientY - dragRef.current.startY) * dragRef.current.scale;

    if (dragRef.current.target === "badge") {
      setDetails((current) => ({
        ...current,
        badgePosition: {
          x: clamp(dragRef.current.originX + deltaX, 0, OUTPUT_WIDTH),
          y: clamp(dragRef.current.originY + deltaY, 0, OUTPUT_HEIGHT),
        },
      }));
      return;
    }

    const nextCrop = normalizeCropPosition(
      sourceImage,
      {
        x: dragRef.current.originX + deltaX,
        y: dragRef.current.originY + deltaY,
      },
      zoom,
    );

    setCrop(nextCrop);
  }

  function handlePointerUp(event) {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    dragRef.current.target = "qr";

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const badgeEnabled = Boolean(details.badgeText.trim());

  return (
    <section className="section-grid">
      <Panel
        eyebrow="Tool 01"
        title="QR Layout Studio"
        description="Upload a QR image, adjust the framing, and export the final branded card as PNG."
      >
        <div className="stack-lg">
          <div className="field">
            <label htmlFor="qr-upload">Source file</label>
            <div className="inline-actions">
              <label className="button secondary" htmlFor="qr-upload">
                Choose file
              </label>
              <input
                id="qr-upload"
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                onChange={handleUpload}
              />
              <span className="hint">PNG, JPG, WEBP, PDF</span>
            </div>
            {fileName ? <div className="meta-line">Loaded: {fileName}</div> : null}
          </div>

          <div className="form-grid">
            {textFields.map((field) => (
              <div className="field" key={field.id}>
                <label htmlFor={field.id}>{field.label}</label>
                <input
                  id={field.id}
                  value={details[field.id]}
                  placeholder={field.placeholder}
                  inputMode={field.id === "accountNumber" ? "numeric" : undefined}
                  maxLength={field.id === "accountNumber" ? 16 : undefined}
                  onChange={(event) => updateDetail(field.id, event.target.value)}
                />
              </div>
            ))}

            <div className="field">
              <label htmlFor="currencyLabel">Currency text</label>
              <select
                id="currencyLabel"
                value={details.currencyLabel}
                onChange={(event) => updateDetail("currencyLabel", event.target.value)}
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="badgeText">Center badge</label>
              <select
                id="badgeText"
                value={details.badgeText}
                onChange={(event) => updateDetail("badgeText", event.target.value)}
              >
                {badgeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={isBadgeLocked}
                onChange={(event) => setIsBadgeLocked(event.target.checked)}
                disabled={!badgeEnabled}
              />
              <span>Lock badge</span>
            </label>
          </div>

          <div className="adjust-grid">
            <div className="range-stack">
              <div className="range-row range-row--control">
                <label htmlFor="zoom-range">Zoom</label>
                <div className="range-inline">
                  <span>{zoom.toFixed(2)}x</span>
                  <input
                    className="range-number"
                    type="number"
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step={ZOOM_STEP}
                    value={zoom}
                    onChange={(event) => handleZoomChange(event.target.value)}
                  />
                </div>
              </div>
              <input
                id="zoom-range"
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={ZOOM_STEP}
                value={zoom}
                onChange={(event) => handleZoomChange(event.target.value)}
              />
            </div>

            <div className="range-stack">
              <div className="range-row range-row--control">
                <label htmlFor="rotation-range">Rotation</label>
                <div className="range-inline">
                  <span>{rotation} deg</span>
                  <input
                    className="range-number"
                    type="number"
                    min="-180"
                    max="180"
                    step="1"
                    value={rotation}
                    onChange={(event) => handleRotationChange(event.target.value)}
                  />
                </div>
              </div>
              <input
                id="rotation-range"
                type="range"
                min="-180"
                max="180"
                step="1"
                value={rotation}
                onChange={(event) => handleRotationChange(event.target.value)}
              />
            </div>

            <div className="range-stack">
              <div className="range-row range-row--control">
                <label htmlFor="badge-scale-range">Badge zoom</label>
                <div className="range-inline">
                  <button
                    type="button"
                    className="button secondary button--step"
                    onClick={() => nudgeBadgeScale(-1)}
                    disabled={!badgeEnabled}
                    aria-label="Zoom out center badge"
                  >
                    -
                  </button>
                  <span>{details.badgeScale.toFixed(2)}x</span>
                  <button
                    type="button"
                    className="button secondary button--step"
                    onClick={() => nudgeBadgeScale(1)}
                    disabled={!badgeEnabled}
                    aria-label="Zoom in center badge"
                  >
                    +
                  </button>
                  <input
                    className="range-number"
                    type="number"
                    min={BADGE_SCALE_MIN}
                    max={BADGE_SCALE_MAX}
                    step={BADGE_SCALE_STEP}
                    value={details.badgeScale}
                    onChange={(event) => handleBadgeScaleChange(event.target.value)}
                    disabled={!badgeEnabled}
                  />
                </div>
              </div>
              <input
                id="badge-scale-range"
                type="range"
                min={BADGE_SCALE_MIN}
                max={BADGE_SCALE_MAX}
                step={BADGE_SCALE_STEP}
                value={details.badgeScale}
                onChange={(event) => handleBadgeScaleChange(event.target.value)}
                disabled={!badgeEnabled}
              />
              <div className="hint">Tap - or + to zoom the center badge in or out.</div>
            </div>
          </div>

          <div className="button-row">
            <a
              className="button secondary"
              href={sqlScriptUpdateUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} strokeWidth={2.2} />
              <span>SQL Script Update</span>
            </a>
            <button type="button" className="button ghost" onClick={resetView}>
              Reset view
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={handleEnhancePhoto}
              disabled={!sourceImage || isEnhancing}
            >
              {isEnhancing ? "Enhancing..." : isEnhanced ? "Use original" : "Enhance photo"}
            </button>
            <button
              type="button"
              className="button"
              onClick={exportPng}
              disabled={!sourceImage}
            >
              Export PNG
            </button>
          </div>
        </div>
      </Panel>

      <div className="stack-lg">
        <Panel
          eyebrow="Preview"
          title="Live output"
          description="The exported canvas is locked to the final production size."
        >
          <div
            className={`canvas-surface${sourceImage ? " is-loaded" : ""}${
              !isBadgeLocked && badgeEnabled ? " can-move-badge" : ""
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas ref={previewRef} className="preview-canvas" />
          </div>

          <div className="canvas-footnote">
            Output size: {OUTPUT_WIDTH} x {OUTPUT_HEIGHT}px
          </div>
        </Panel>
      </div>
    </section>
  );
}

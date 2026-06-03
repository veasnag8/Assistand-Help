import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Move, Scissors, Upload } from "lucide-react";
import {
  dataUrlToImage,
  downloadBlob,
  readFileAsDataUrl,
} from "../lib/file-utils";

const logoPresets = {
  site: {
    label: "Site Logo",
    width: 210,
    height: 50,
    filename: "site-logo.png",
  },
  report: {
    label: "Report Logo",
    width: 300,
    height: 300,
    filename: "report-logo.png",
  },
};

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Could not export the logo."));
    }, "image/png");
  });
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function getLogoPlacement(sourceWidth, sourceHeight, targetWidth, targetHeight, logoScale, focusX = 50, focusY = 50) {
  const baseScale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const scale = baseScale * (logoScale / 100);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = drawWidth > targetWidth
    ? (targetWidth - drawWidth) * (focusX / 100)
    : (targetWidth - drawWidth) / 2;
  const y = drawHeight > targetHeight
    ? (targetHeight - drawHeight) * (focusY / 100)
    : (targetHeight - drawHeight) / 2;

  return {
    drawHeight,
    drawWidth,
    scale,
    x,
    y,
  };
}

function getVisibleSourceRect(sourceWidth, sourceHeight, targetWidth, targetHeight, logoScale, focusX, focusY) {
  const placement = getLogoPlacement(sourceWidth, sourceHeight, targetWidth, targetHeight, logoScale, focusX, focusY);
  const x1 = clampNumber(-placement.x / placement.scale, 0, sourceWidth);
  const y1 = clampNumber(-placement.y / placement.scale, 0, sourceHeight);
  const x2 = clampNumber((targetWidth - placement.x) / placement.scale, 0, sourceWidth);
  const y2 = clampNumber((targetHeight - placement.y) / placement.scale, 0, sourceHeight);

  return {
    height: Math.max(1, y2 - y1),
    placement,
    width: Math.max(1, x2 - x1),
    x: x1,
    y: y1,
  };
}

function drawLogoToCanvas(image, placement, targetWidth, targetHeight) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the logo canvas.");
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    placement.x,
    placement.y,
    placement.drawWidth,
    placement.drawHeight,
  );

  return canvas;
}

function fitRect(sourceWidth, sourceHeight, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);

  return {
    height: sourceHeight * scale,
    width: sourceWidth * scale,
  };
}

function drawStackedLogoToCanvas(image, splitPercent, targetWidth, targetHeight) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const splitX = clampNumber(Math.round(sourceWidth * (splitPercent / 100)), 1, sourceWidth - 1);
  const iconSourceWidth = splitX;
  const textSourceWidth = sourceWidth - splitX;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the stacked logo canvas.");
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, canvas.width, canvas.height);

  const iconBox = fitRect(iconSourceWidth, sourceHeight, targetWidth * 0.62, targetHeight * 0.48);
  const textBox = fitRect(textSourceWidth, sourceHeight, targetWidth * 0.86, targetHeight * 0.28);
  const iconX = (targetWidth - iconBox.width) / 2;
  const iconY = 24;
  const textX = (targetWidth - textBox.width) / 2;
  const textY = targetHeight - textBox.height - 32;

  context.drawImage(
    image,
    0,
    0,
    iconSourceWidth,
    sourceHeight,
    iconX,
    iconY,
    iconBox.width,
    iconBox.height,
  );
  context.drawImage(
    image,
    splitX,
    0,
    textSourceWidth,
    sourceHeight,
    textX,
    textY,
    textBox.width,
    textBox.height,
  );

  return canvas;
}

function isSupportedImage(file) {
  return file?.type?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file?.name || "");
}

export default function LogoCutTool() {
  const [presetId, setPresetId] = useState("site");
  const [sources, setSources] = useState([]);
  const [activeSourceId, setActiveSourceId] = useState("");
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceImage, setSourceImage] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [cropFocus, setCropFocus] = useState({ x: 50, y: 50 });
  const [layoutMode, setLayoutMode] = useState("normal");
  const [logoScale, setLogoScale] = useState(100);
  const [splitPercent, setSplitPercent] = useState(38);
  const [status, setStatus] = useState("Choose a logo image to start.");
  const resultFrameRef = useRef(null);
  const dragRef = useRef(null);
  const sourcesRef = useRef([]);
  const activePreset = logoPresets[presetId];
  const isStackMode = presetId === "report" && layoutMode === "stack";
  const sourceSize = useMemo(() => {
    if (!sourceImage) return null;

    return {
      width: sourceImage.naturalWidth || sourceImage.width,
      height: sourceImage.naturalHeight || sourceImage.height,
    };
  }, [sourceImage]);
  const activeCrop = useMemo(() => {
    if (!sourceSize) return null;

    return getVisibleSourceRect(
      sourceSize.width,
      sourceSize.height,
      activePreset.width,
      activePreset.height,
      logoScale,
      cropFocus.x,
      cropFocus.y,
    );
  }, [activePreset.height, activePreset.width, cropFocus.x, cropFocus.y, logoScale, sourceSize]);
  const resultPlacement = sourceSize
    ? getLogoPlacement(
      sourceSize.width,
      sourceSize.height,
      activePreset.width,
      activePreset.height,
      logoScale,
      cropFocus.x,
      cropFocus.y,
    )
    : null;
  const resultScale = presetId === "site" ? 2.4 : 1;
  const resultEditorStyle = {
    height: `${activePreset.height * resultScale}px`,
    width: `${activePreset.width * resultScale}px`,
  };
  const resultImageStyle = resultPlacement
    ? {
      height: `${resultPlacement.drawHeight * resultScale}px`,
      left: `${resultPlacement.x * resultScale}px`,
      top: `${resultPlacement.y * resultScale}px`,
      width: `${resultPlacement.drawWidth * resultScale}px`,
    }
    : null;

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => () => {
    sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.url));
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!sourceImage) {
      return;
    }

    let cancelled = false;

    async function refreshPreview() {
      try {
        const blob = await buildLogoBlob(activePreset, sourceImage);

        if (cancelled) {
          return;
        }

        if (isStackMode) {
          const nextUrl = URL.createObjectURL(blob);

          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return nextUrl;
          });
        }
        setStatus(`Ready: ${activePreset.label} ${activePreset.width} x ${activePreset.height}px.`);
      } catch (error) {
        if (!cancelled) {
          setStatus(error?.message || "Could not prepare the logo preview.");
        }
      }
    }

    refreshPreview();

    return () => {
      cancelled = true;
    };
  }, [activePreset, cropFocus.x, cropFocus.y, isStackMode, layoutMode, logoScale, sourceImage, splitPercent]);

  async function buildLogoBlob(preset = activePreset, image = sourceImage) {
    if (!image) {
      throw new Error("Please choose a logo image first.");
    }

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (preset.id === "report" && layoutMode === "stack") {
      return canvasToBlob(drawStackedLogoToCanvas(image, splitPercent, preset.width, preset.height));
    }

    const placement = getLogoPlacement(
      sourceWidth,
      sourceHeight,
      preset.width,
      preset.height,
      logoScale,
      cropFocus.x,
      cropFocus.y,
    );
    const canvas = drawLogoToCanvas(image, placement, preset.width, preset.height);

    return canvasToBlob(canvas);
  }

  function activateSource(source) {
    if (!source) {
      return;
    }

    setActiveSourceId(source.id);
    setSourceFile(source.file);
    setSourceImage(source.image);
    setSourceUrl(source.url);
    setCropFocus(source.cropFocus || { x: 50, y: 50 });
    setLayoutMode(source.layoutMode || "normal");
    setLogoScale(source.logoScale || 100);
    setSplitPercent(source.splitPercent || 38);
  }

  function updateActiveSourceSettings({
    nextCropFocus = cropFocus,
    nextLayoutMode = layoutMode,
    nextLogoScale = logoScale,
    nextSplitPercent = splitPercent,
  } = {}) {
    setCropFocus(nextCropFocus);
    setLayoutMode(nextLayoutMode);
    setLogoScale(nextLogoScale);
    setSplitPercent(nextSplitPercent);
    setSources((current) => current.map((source) => (
      source.id === activeSourceId
        ? {
          ...source,
          cropFocus: nextCropFocus,
          layoutMode: nextLayoutMode,
          logoScale: nextLogoScale,
          splitPercent: nextSplitPercent,
        }
        : source
    )));
  }

  function updateActiveSourceTransform(nextCropFocus = cropFocus, nextLogoScale = logoScale) {
    updateActiveSourceSettings({ nextCropFocus, nextLogoScale });
  }

  async function handleFileChange(event) {
    const files = Array.from(event.target.files || []).filter(Boolean);

    if (!files.length) {
      return;
    }

    const supportedFiles = files.filter(isSupportedImage);

    if (!supportedFiles.length) {
      setStatus("Please choose a PNG, JPG, or WebP image.");
      return;
    }

    setStatus(`Opening ${supportedFiles.length} logo${supportedFiles.length === 1 ? "" : "s"}...`);

    try {
      const nextSources = [];

      for (const file of supportedFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        const image = await dataUrlToImage(dataUrl);

        nextSources.push({
          cropFocus: { x: 50, y: 50 },
          file,
          id: `${file.name}-${file.size}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
          image,
          layoutMode: "normal",
          logoScale: 100,
          splitPercent: 38,
          url: URL.createObjectURL(file),
        });
      }

      setSources((current) => [...current, ...nextSources]);
      activateSource(nextSources[0]);
      event.target.value = "";
    } catch (error) {
      setStatus(error?.message || "Could not open that logo.");
    }
  }

  async function handlePresetChange(nextPresetId) {
    const nextPreset = logoPresets[nextPresetId] || logoPresets.site;

    setPresetId(nextPresetId);
    setStatus(`Selected ${nextPreset.label} ${nextPreset.width} x ${nextPreset.height}px.`);
  }

  async function handleDownload() {
    try {
      const blob = await buildLogoBlob();
      const baseName = (sourceFile?.name || activePreset.filename).replace(/\.[^.]+$/, "");

      downloadBlob(blob, `${baseName}-${activePreset.width}x${activePreset.height}.png`);
      setStatus(`Downloaded ${activePreset.label} ${activePreset.width} x ${activePreset.height}px.`);
    } catch (error) {
      setStatus(error?.message || "Could not download the logo.");
    }
  }

  function setFocusFromPlacement(nextX, nextY, nextScale = logoScale) {
    if (!sourceSize) {
      return;
    }

    const placement = getLogoPlacement(
      sourceSize.width,
      sourceSize.height,
      activePreset.width,
      activePreset.height,
      nextScale,
      50,
      50,
    );
    const maxX = activePreset.width - placement.drawWidth;
    const maxY = activePreset.height - placement.drawHeight;
    const nextFocusX = placement.drawWidth > activePreset.width
      ? clampNumber((nextX / maxX) * 100, 0, 100)
      : 50;
    const nextFocusY = placement.drawHeight > activePreset.height
      ? clampNumber((nextY / maxY) * 100, 0, 100)
      : 50;

    updateActiveSourceTransform({ x: nextFocusX, y: nextFocusY }, nextScale);
  }

  function handleResultPointerDown(event) {
    if (!resultFrameRef.current) {
      return;
    }

    event.preventDefault();

    if (isStackMode) {
      dragRef.current = { mode: "split" };
      updateSplitFromPointer(event);
      resultFrameRef.current.setPointerCapture?.(event.pointerId);
      return;
    }

    if (!resultPlacement) {
      return;
    }

    dragRef.current = {
      mode: "move",
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: resultPlacement.x,
      startY: resultPlacement.y,
    };
    resultFrameRef.current.setPointerCapture?.(event.pointerId);
  }

  function handleResizePointerDown(event) {
    if (!resultPlacement || !resultFrameRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      mode: "resize",
      pointerX: event.clientX,
      startScale: logoScale,
      startWidth: resultPlacement.drawWidth,
    };
    resultFrameRef.current.setPointerCapture?.(event.pointerId);
  }

  function handleResultPointerMove(event) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    if (drag.mode === "split") {
      updateSplitFromPointer(event);
      return;
    }

    if (!resultPlacement) {
      return;
    }

    if (drag.mode === "resize") {
      const deltaX = (event.clientX - drag.pointerX) / resultScale;
      const nextWidth = Math.max(10, drag.startWidth + deltaX);
      const nextScale = clampNumber((nextWidth / drag.startWidth) * drag.startScale, 50, 250);

      updateActiveSourceTransform(cropFocus, nextScale);
      return;
    }

    const deltaX = (event.clientX - drag.pointerX) / resultScale;
    const deltaY = (event.clientY - drag.pointerY) / resultScale;

    setFocusFromPlacement(drag.startX + deltaX, drag.startY + deltaY);
  }

  function handleResultPointerUp() {
    dragRef.current = null;
  }

  function handleResultWheel(event) {
    if (!sourceImage) {
      return;
    }

    event.preventDefault();
    const nextScale = clampNumber(logoScale + (event.deltaY > 0 ? -8 : 8), 50, 250);

    updateActiveSourceTransform(cropFocus, nextScale);
  }

  function updateSplitFromPointer(event) {
    if (!resultFrameRef.current) {
      return;
    }

    const rect = resultFrameRef.current.getBoundingClientRect();
    const nextSplit = clampNumber(((event.clientX - rect.left) / rect.width) * 100, 15, 75);

    updateActiveSourceSettings({ nextSplitPercent: Math.round(nextSplit) });
  }

  return (
    <section className="logo-cut-tool">
      <div className="logo-cut-controls">
        <label className="logo-upload-card" htmlFor="logo-source">
          <Upload size={22} strokeWidth={2.2} />
          <span>Source Logo</span>
          <small>{sourceFile?.name || "PNG, JPG, or WebP"}</small>
          <input
            id="logo-source"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
          />
        </label>

        {sources.length ? (
          <div className="logo-source-list" aria-label="Uploaded logos">
            {sources.map((source, index) => (
              <button
                className={source.id === activeSourceId ? "is-active" : ""}
                type="button"
                key={source.id}
                onClick={() => activateSource(source)}
              >
                <img src={source.url} alt="" />
                <span>{source.file.name}</span>
                <small>{index + 1}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="logo-preset-group" role="group" aria-label="Logo size">
          {Object.entries(logoPresets).map(([id, preset]) => (
            <button
              className={id === presetId ? "is-active" : ""}
              type="button"
              key={id}
              onClick={() => handlePresetChange(id)}
            >
              <Scissors size={18} strokeWidth={2.2} />
              <span>{preset.label}</span>
              <small>
                {preset.width}px x {preset.height}px
              </small>
            </button>
          ))}
        </div>

        <div className="logo-cut-sliders" aria-label="Cut position">
          {presetId === "report" ? (
            <div className="logo-layout-toggle" role="group" aria-label="Report logo layout">
              <button
                className={layoutMode === "normal" ? "is-active" : ""}
                type="button"
                onClick={() => updateActiveSourceSettings({ nextLayoutMode: "normal" })}
              >
                Normal Crop
              </button>
              <button
                className={layoutMode === "stack" ? "is-active" : ""}
                type="button"
                onClick={() => updateActiveSourceSettings({ nextLayoutMode: "stack" })}
              >
                Text Below Logo
              </button>
            </div>
          ) : null}
          {isStackMode ? (
            <label>
              <span>Text Split: {splitPercent}%</span>
              <input
                type="range"
                min="15"
                max="75"
                value={splitPercent}
                onChange={(event) => updateActiveSourceSettings({ nextSplitPercent: Number(event.target.value) })}
                disabled={!sourceImage}
              />
            </label>
          ) : null}
          <label>
            <span>Logo Size: {logoScale}%</span>
            <input
              type="range"
              min="50"
              max="250"
              value={logoScale}
              onChange={(event) => updateActiveSourceTransform(cropFocus, Number(event.target.value))}
              disabled={!sourceImage || isStackMode}
            />
          </label>
          <label>
            <span>Move Cut Left / Right</span>
            <input
              type="range"
              min="0"
              max="100"
              value={cropFocus.x}
              onChange={(event) => updateActiveSourceTransform({ ...cropFocus, x: Number(event.target.value) }, logoScale)}
              disabled={isStackMode || !sourceImage || !activeCrop || activeCrop.width >= sourceSize?.width}
            />
          </label>
          <label>
            <span>Move Cut Up / Down</span>
            <input
              type="range"
              min="0"
              max="100"
              value={cropFocus.y}
              onChange={(event) => updateActiveSourceTransform({ ...cropFocus, y: Number(event.target.value) }, logoScale)}
              disabled={isStackMode || !sourceImage || !activeCrop || activeCrop.height >= sourceSize?.height}
            />
          </label>
        </div>

        <button className="button primary" type="button" onClick={handleDownload} disabled={!sourceImage}>
          <Download size={17} strokeWidth={2.2} />
          <span>Download PNG</span>
        </button>

        <p className="logo-cut-status">{status}</p>
      </div>

      <div className="logo-preview-panel">
        <div className="logo-preview-header">
          <div>
            <strong>{activePreset.label}</strong>
            <span>
              {activePreset.width}px x {activePreset.height}px
            </span>
          </div>
          {sourceSize ? (
            <small>
              Source {sourceSize.width} x {sourceSize.height}px
            </small>
          ) : null}
        </div>

        <div
          className={`logo-preview-frame logo-preview-${presetId}`}
          style={{ "--logo-preview-ratio": `${activePreset.width} / ${activePreset.height}` }}
        >
          {isStackMode && previewUrl ? (
            <div
              className="logo-stack-editor"
              style={resultEditorStyle}
              ref={resultFrameRef}
              onPointerDown={handleResultPointerDown}
              onPointerMove={handleResultPointerMove}
              onPointerUp={handleResultPointerUp}
              onPointerCancel={handleResultPointerUp}
              role="presentation"
            >
              <img className="logo-stacked-result" src={previewUrl} alt={`${activePreset.label} text below preview`} />
              <span className="logo-stack-split-handle">
                <Move size={16} strokeWidth={2.4} />
              </span>
            </div>
          ) : sourceUrl && resultImageStyle ? (
            <div
              className="logo-result-editor"
              style={resultEditorStyle}
              ref={resultFrameRef}
              onPointerDown={handleResultPointerDown}
              onPointerMove={handleResultPointerMove}
              onPointerUp={handleResultPointerUp}
              onPointerCancel={handleResultPointerUp}
              onWheel={handleResultWheel}
              role="presentation"
            >
              <img className="logo-result-image" src={sourceUrl} alt={`${activePreset.label} editable result`} style={resultImageStyle} />
              <span className="logo-result-selection" style={resultImageStyle}>
                <span className="logo-result-handle is-top-left" />
                <span className="logo-result-handle is-top-right" />
                <span className="logo-result-handle is-bottom-left" />
                <span className="logo-result-handle is-bottom-right" onPointerDown={handleResizePointerDown} />
              </span>
            </div>
          ) : (
            <div className="logo-preview-empty">
              <ImageIcon size={36} strokeWidth={1.8} />
              <span>Choose a logo image</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

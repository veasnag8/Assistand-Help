import { useEffect, useMemo, useState } from "react";
import { Download, Image as ImageIcon, Scissors, Upload } from "lucide-react";
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

function getCoverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight, focusX = 50, focusY = 50) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (sourceRatio > targetRatio) {
    const width = Math.round(sourceHeight * targetRatio);
    const maxX = sourceWidth - width;

    return {
      height: sourceHeight,
      width,
      x: Math.round(maxX * (focusX / 100)),
      y: 0,
    };
  }

  const height = Math.round(sourceWidth / targetRatio);
  const maxY = sourceHeight - height;

  return {
    height,
    width: sourceWidth,
    x: 0,
    y: Math.round(maxY * (focusY / 100)),
  };
}

function drawLogoToCanvas(image, crop, targetWidth, targetHeight) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the logo canvas.");
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return canvas;
}

function isSupportedImage(file) {
  return file?.type?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file?.name || "");
}

export default function LogoCutTool() {
  const [presetId, setPresetId] = useState("site");
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceImage, setSourceImage] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [cropFocus, setCropFocus] = useState({ x: 50, y: 50 });
  const [status, setStatus] = useState("Choose a logo image to start.");
  const activePreset = logoPresets[presetId];
  const sourceSize = useMemo(() => {
    if (!sourceImage) return null;

    return {
      width: sourceImage.naturalWidth || sourceImage.width,
      height: sourceImage.naturalHeight || sourceImage.height,
    };
  }, [sourceImage]);
  const activeCrop = useMemo(() => {
    if (!sourceSize) return null;

    return getCoverCrop(
      sourceSize.width,
      sourceSize.height,
      activePreset.width,
      activePreset.height,
      cropFocus.x,
      cropFocus.y,
    );
  }, [activePreset.height, activePreset.width, cropFocus.x, cropFocus.y, sourceSize]);
  const cropOverlayStyle = activeCrop && sourceSize
    ? {
      height: `${(activeCrop.height / sourceSize.height) * 100}%`,
      left: `${(activeCrop.x / sourceSize.width) * 100}%`,
      top: `${(activeCrop.y / sourceSize.height) * 100}%`,
      width: `${(activeCrop.width / sourceSize.width) * 100}%`,
    }
    : null;

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

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

        const nextUrl = URL.createObjectURL(blob);

        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
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
  }, [activePreset, cropFocus.x, cropFocus.y, sourceImage]);

  async function buildLogoBlob(preset = activePreset, image = sourceImage) {
    if (!image) {
      throw new Error("Please choose a logo image first.");
    }

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const crop = getCoverCrop(sourceWidth, sourceHeight, preset.width, preset.height, cropFocus.x, cropFocus.y);
    const canvas = drawLogoToCanvas(image, crop, preset.width, preset.height);

    return canvasToBlob(canvas);
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isSupportedImage(file)) {
      setStatus("Please choose a PNG, JPG, or WebP image.");
      return;
    }

    setStatus("Opening logo...");

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await dataUrlToImage(dataUrl);
      const nextSourceUrl = URL.createObjectURL(file);

      setSourceFile(file);
      setSourceImage(image);
      setSourceUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextSourceUrl;
      });
      setCropFocus({ x: 50, y: 50 });
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
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
          />
        </label>

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
          <label>
            <span>Move Cut Left / Right</span>
            <input
              type="range"
              min="0"
              max="100"
              value={cropFocus.x}
              onChange={(event) => setCropFocus((current) => ({ ...current, x: Number(event.target.value) }))}
              disabled={!sourceImage || !activeCrop || activeCrop.width === sourceSize?.width}
            />
          </label>
          <label>
            <span>Move Cut Up / Down</span>
            <input
              type="range"
              min="0"
              max="100"
              value={cropFocus.y}
              onChange={(event) => setCropFocus((current) => ({ ...current, y: Number(event.target.value) }))}
              disabled={!sourceImage || !activeCrop || activeCrop.height === sourceSize?.height}
            />
          </label>
        </div>

        <button className="button primary" type="button" onClick={handleDownload} disabled={!sourceImage}>
          <Download size={17} strokeWidth={2.2} />
          <span>Download PNG</span>
        </button>

        <p className="logo-cut-status">{status}</p>
      </div>

      <div className="logo-preview-panel logo-cut-original-panel">
        <div className="logo-preview-header">
          <div>
            <strong>Original</strong>
            <span>{sourceFile?.name || "No image selected"}</span>
          </div>
          {sourceSize ? (
            <small>
              {sourceSize.width} x {sourceSize.height}px
            </small>
          ) : null}
        </div>

        <div className="logo-original-frame">
          {sourceUrl ? (
            <div className="logo-original-image-wrap">
              <img src={sourceUrl} alt="Original logo" />
              {cropOverlayStyle ? <span className="logo-crop-overlay" style={cropOverlayStyle} /> : null}
            </div>
          ) : (
            <div className="logo-preview-empty">
              <ImageIcon size={36} strokeWidth={1.8} />
              <span>Original logo appears here</span>
            </div>
          )}
        </div>
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
          {previewUrl ? (
            <img src={previewUrl} alt={`${activePreset.label} preview`} />
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

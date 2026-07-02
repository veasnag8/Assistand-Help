import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Cloud,
  Crop,
  Eraser,
  FileText,
  FileImage,
  Image as ImageIcon,
  Minimize2,
  WandSparkles,
} from "lucide-react";
import Panel from "./Panel";
import {
  dataUrlToImage,
  downloadBlob,
  enhanceImage,
  readFileAsDataUrl,
} from "../lib/file-utils";
import { removeBackgroundWithRemovalAi } from "../lib/remove-bg-api";

const modes = [
  {
    id: "resize",
    label: "Resize Image",
    icon: Minimize2,
    description: "Change image width and height.",
  },
  {
    id: "compress",
    label: "Compress Image",
    icon: Archive,
    description: "Reduce image file size.",
  },
  {
    id: "remove-bg",
    label: "Remove Background",
    icon: Eraser,
    description: "Remove the background with Removal.AI, browser AI, or quick clean.",
  },
  {
    id: "convert",
    label: "Convert PNG/JPG/WebP",
    icon: FileImage,
    description: "Export image as PNG, JPG, or WebP.",
  },
  {
    id: "crop",
    label: "Crop Image",
    icon: Crop,
    description: "Crop using exact pixel values.",
  },
  {
    id: "enhance",
    label: "AI Enhance Photo",
    icon: WandSparkles,
    description: "Improve sharpness, contrast, and color.",
  },
  {
    id: "scan-doc",
    label: "Scan to Document",
    icon: FileText,
    description: "Clean a photo of a page and export it as a PDF document.",
  },
];

const formatOptions = {
  "image/png": { label: "PNG", extension: "png" },
  "image/jpeg": { label: "JPG", extension: "jpg" },
  "image/webp": { label: "WebP", extension: "webp" },
};

const removeBgUploadUrl = "https://www.remove.bg/upload";

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Could not export the image."));
      },
      mimeType,
      quality,
    );
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getBaseName(fileName) {
  return (fileName || "image").replace(/\.[^.]+$/, "") || "image";
}

function getImageSize(image) {
  return {
    height: image?.naturalHeight || image?.height || 1,
    width: image?.naturalWidth || image?.width || 1,
  };
}

function isSupportedImage(file) {
  if (!file) return false;
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp)$/i.test(file.name)
  );
}

function getPixelLuminance(data, index) {
  return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
}

function isLikelyPaperPixel(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const luminance = getPixelLuminance(data, index);
  const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);

  return luminance > 184 && colorSpread < 58;
}

function findDenseRange(counts, threshold, minLength) {
  let bestStart = -1;
  let bestEnd = -1;
  let start = -1;

  for (let index = 0; index <= counts.length; index += 1) {
    const isDense = index < counts.length && counts[index] >= threshold;

    if (isDense && start === -1) {
      start = index;
    }

    if ((!isDense || index === counts.length) && start !== -1) {
      const end = index - 1;

      if (end - start + 1 >= minLength && end - start > bestEnd - bestStart) {
        bestStart = start;
        bestEnd = end;
      }

      start = -1;
    }
  }

  if (bestStart === -1) {
    return null;
  }

  return { end: bestEnd, start: bestStart };
}

function detectPaperBounds(imageData, width, height) {
  const data = imageData.data;
  const rowCounts = new Array(height).fill(0);
  const columnCounts = new Array(width).fill(0);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;

      if (!isLikelyPaperPixel(data, index)) {
        continue;
      }

      rowCounts[y] += 1;
      columnCounts[x] += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const denseRows = findDenseRange(rowCounts, Math.max(8, Math.round(width * 0.12)), Math.round(height * 0.24));
  const denseColumns = findDenseRange(columnCounts, Math.max(8, Math.round(height * 0.12)), Math.round(width * 0.24));

  if (denseRows && denseColumns) {
    let denseMinX = width;
    let denseMinY = height;
    let denseMaxX = -1;
    let denseMaxY = -1;

    for (let y = denseRows.start; y <= denseRows.end; y += 1) {
      for (let x = denseColumns.start; x <= denseColumns.end; x += 1) {
        const index = (y * width + x) * 4;

        if (!isLikelyPaperPixel(data, index)) {
          continue;
        }

        denseMinX = Math.min(denseMinX, x);
        denseMinY = Math.min(denseMinY, y);
        denseMaxX = Math.max(denseMaxX, x);
        denseMaxY = Math.max(denseMaxY, y);
      }
    }

    if (denseMaxX >= denseMinX && denseMaxY >= denseMinY) {
      minX = denseMinX;
      minY = denseMinY;
      maxX = denseMaxX;
      maxY = denseMaxY;
    }
  }

  const detectedWidth = maxX - minX + 1;
  const detectedHeight = maxY - minY + 1;
  const detectedArea = detectedWidth * detectedHeight;
  const sourceArea = width * height;

  if (detectedArea < sourceArea * 0.08 || detectedWidth < width * 0.2 || detectedHeight < height * 0.2) {
    return null;
  }

  const padding = Math.round(Math.min(width, height) * 0.004);

  return {
    height: Math.min(height, maxY + padding + 1) - Math.max(0, minY - padding),
    width: Math.min(width, maxX + padding + 1) - Math.max(0, minX - padding),
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
  };
}

export default function ImageTools() {
  const [mode, setMode] = useState("resize");
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceImage, setSourceImage] = useState(null);
  const [resizeWidth, setResizeWidth] = useState(1200);
  const [resizeHeight, setResizeHeight] = useState(800);
  const [keepAspect, setKeepAspect] = useState(true);
  const [outputFormat, setOutputFormat] = useState("image/jpeg");
  const [quality, setQuality] = useState(0.82);
  const [removeBgMethod, setRemoveBgMethod] = useState("api");
  const [bgTolerance, setBgTolerance] = useState(42);
  const [documentTone, setDocumentTone] = useState("clean");
  const [documentPageSize, setDocumentPageSize] = useState("image");
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 1200, height: 800 });
  const [apiRemoveResult, setApiRemoveResult] = useState(null);
  const [aiRemoveResult, setAiRemoveResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewSize, setPreviewSize] = useState(0);
  const [status, setStatus] = useState("Choose an image to start.");
  const [busy, setBusy] = useState(false);
  const [removeBgBusy, setRemoveBgBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);

  const activeMode = useMemo(
    () => modes.find((item) => item.id === mode) || modes[0],
    [mode],
  );

  const sourceSize = useMemo(() => getImageSize(sourceImage), [sourceImage]);
  const forcedPng = mode === "remove-bg";
  const activeFormat = forcedPng ? "image/png" : outputFormat;
  const activeFormatOption = formatOptions[activeFormat] || formatOptions["image/png"];
  const currentSourceKey = useMemo(() => {
    if (!sourceFile) return "";
    return `${sourceFile.name}-${sourceFile.size}-${sourceFile.lastModified}`;
  }, [sourceFile]);
  const hasAiRemoveResult = Boolean(
    aiRemoveResult?.sourceKey === currentSourceKey && aiRemoveResult?.blob,
  );
  const hasApiRemoveResult = Boolean(
    apiRemoveResult?.sourceKey === currentSourceKey && apiRemoveResult?.blob,
  );
  const hasSelectedRemoveResult = removeBgMethod === "api" ? hasApiRemoveResult : hasAiRemoveResult;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      if (!sourceImage) {
        setPreviewUrl("");
        setPreviewSize(0);
        return;
      }

      if (removeBgBusy) {
        return;
      }

      try {
        setPreviewBusy(true);
        const { blob } = await buildOutputImage();
        const nextUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }

        setPreviewUrl(nextUrl);
        setPreviewSize(blob.size);
        setStatus(
          mode === "remove-bg" && removeBgMethod !== "quick" && !hasSelectedRemoveResult
            ? `Click Remove BG to start ${
                removeBgMethod === "api" ? "Removal.AI" : "browser AI"
              } background removal.`
            : `${activeMode.label} preview ready.`,
        );
      } catch (error) {
        if (!cancelled) {
          setStatus(error?.message || "Could not prepare the image preview.");
        }
      } finally {
        if (!cancelled) {
          setPreviewBusy(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    activeMode.label,
    apiRemoveResult,
    aiRemoveResult,
    bgTolerance,
    cropBox,
    hasSelectedRemoveResult,
    hasAiRemoveResult,
    mode,
    outputFormat,
    quality,
    removeBgMethod,
    removeBgBusy,
    resizeHeight,
    resizeWidth,
    sourceImage,
    documentPageSize,
    documentTone,
  ]);

  async function handleSourceFile(file) {
    setPreviewUrl("");
    setPreviewSize(0);
    setSourceFile(null);
    setSourceImage(null);
    setApiRemoveResult(null);
    setAiRemoveResult(null);

    if (!file) {
      setStatus("Choose an image to start.");
      return;
    }

    if (!isSupportedImage(file)) {
      setStatus("Please choose a PNG, JPG, or WebP image.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Opening image...");

      const dataUrl = await readFileAsDataUrl(file);
      const image = await dataUrlToImage(dataUrl);
      const imageSize = getImageSize(image);
      const preferredFormat = formatOptions[file.type] ? file.type : "image/jpeg";

      setSourceFile(file);
      setSourceImage(image);
      setResizeWidth(imageSize.width);
      setResizeHeight(imageSize.height);
      setCropBox({ x: 0, y: 0, width: imageSize.width, height: imageSize.height });
      setOutputFormat(preferredFormat);
      setApiRemoveResult(null);
      setAiRemoveResult(null);
      setStatus(`Loaded ${file.name} - ${imageSize.width} x ${imageSize.height}.`);
    } catch (error) {
      setStatus(error?.message || "Could not open the selected image.");
    } finally {
      setBusy(false);
    }
  }

  function getSourceKey() {
    return currentSourceKey;
  }

  function openRemoveBgUpload() {
    window.location.assign(removeBgUploadUrl);
  }

  function handleModeSelect(nextMode) {
    if (nextMode === "remove-bg") {
      openRemoveBgUpload();
      return;
    }

    setMode(nextMode);
  }

  async function buildAiBackgroundRemovalImage(sourceWidth, sourceHeight) {
    const sourceKey = getSourceKey();

    if (aiRemoveResult?.sourceKey === sourceKey && aiRemoveResult?.blob) {
      return aiRemoveResult;
    }

    if (!sourceFile) {
      throw new Error("Please choose an image first.");
    }

    setStatus("Loading AI remove background model...");

    const { default: removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(sourceFile, {
      device: "cpu",
      model: "isnet_quint8",
      output: {
        format: "image/png",
        quality: 0.95,
      },
      progress: (key, current, total) => {
        if (!total) {
          setStatus(`Preparing AI remove background: ${key}`);
          return;
        }

        const percent = Math.round((current / total) * 100);
        setStatus(`AI remove background loading ${key}: ${percent}%`);
      },
    });

    const result = {
      blob,
      height: sourceHeight,
      sourceKey,
      width: sourceWidth,
    };

    setAiRemoveResult(result);
    return result;
  }

  async function buildApiBackgroundRemovalImage() {
    const sourceKey = getSourceKey();

    if (apiRemoveResult?.sourceKey === sourceKey && apiRemoveResult?.blob) {
      return apiRemoveResult;
    }

    if (!sourceFile) {
      throw new Error("Please choose an image first.");
    }

    setStatus("Removing background with Removal.AI...");

    const result = {
      ...(await removeBackgroundWithRemovalAi(sourceFile)),
      sourceKey,
    };

    setApiRemoveResult(result);
    return result;
  }

  async function buildLocalBackgroundRemovalImage(canvas, context, sourceWidth, sourceHeight) {
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    context.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);

    const imageData = context.getImageData(0, 0, sourceWidth, sourceHeight);
    const data = imageData.data;
    const red = data[0];
    const green = data[1];
    const blue = data[2];
    const tolerance = Number(bgTolerance);
    const fadeWidth = 18;

    for (let index = 0; index < data.length; index += 4) {
      const distance = Math.sqrt(
        (data[index] - red) ** 2 +
          (data[index + 1] - green) ** 2 +
          (data[index + 2] - blue) ** 2,
      );

      if (distance <= tolerance) {
        data[index + 3] = 0;
      } else if (distance <= tolerance + fadeWidth) {
        data[index + 3] = Math.round(data[index + 3] * ((distance - tolerance) / fadeWidth));
      }
    }

    context.putImageData(imageData, 0, 0);
    const blob = await canvasToBlob(canvas, "image/png");

    return {
      blob,
      height: canvas.height,
      width: canvas.width,
    };
  }

  async function buildSourcePreviewImage(sourceWidth, sourceHeight) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not prepare the image preview canvas.");
    }

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    context.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);

    const sourceMimeType = formatOptions[sourceFile?.type] ? sourceFile.type : "image/png";
    const blob = await canvasToBlob(
      canvas,
      sourceMimeType,
      sourceMimeType === "image/png" ? undefined : quality,
    );

    return {
      blob,
      height: canvas.height,
      width: canvas.width,
    };
  }

  async function buildScannedDocumentImage(sourceWidth, sourceHeight) {
    const sourceCanvas = document.createElement("canvas");
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });

    if (!sourceContext) {
      throw new Error("Could not prepare the document scan canvas.");
    }

    const longestSide = Math.max(sourceWidth, sourceHeight);
    const scale = Math.min(1, 2200 / longestSide);

    sourceCanvas.width = Math.max(1, Math.round(sourceWidth * scale));
    sourceCanvas.height = Math.max(1, Math.round(sourceHeight * scale));

    sourceContext.fillStyle = "#ffffff";
    sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = "high";
    sourceContext.drawImage(sourceImage, 0, 0, sourceCanvas.width, sourceCanvas.height);

    const sourceImageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const paperBounds =
      detectPaperBounds(sourceImageData, sourceCanvas.width, sourceCanvas.height) || {
        height: sourceCanvas.height,
        width: sourceCanvas.width,
        x: 0,
        y: 0,
      };
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Could not prepare the document scan canvas.");
    }

    canvas.width = paperBounds.width;
    canvas.height = paperBounds.height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      sourceCanvas,
      paperBounds.x,
      paperBounds.y,
      paperBounds.width,
      paperBounds.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const luminance = getPixelLuminance(pixels, index);
      const contrast = clampNumber((luminance - 128) * 1.34 + 146, 0, 255);
      const value = documentTone === "bw" ? (contrast < 180 ? 0 : 255) : contrast;

      if (documentTone === "color") {
        pixels[index] = clampNumber((red - 128) * 1.12 + 142, 0, 255);
        pixels[index + 1] = clampNumber((green - 128) * 1.12 + 142, 0, 255);
        pixels[index + 2] = clampNumber((blue - 128) * 1.12 + 142, 0, 255);
      } else {
        pixels[index] = value;
        pixels[index + 1] = value;
        pixels[index + 2] = value;
      }

      pixels[index + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);

    return {
      blob: await canvasToBlob(canvas, "image/jpeg", 0.92),
      canvas,
      height: canvas.height,
      width: canvas.width,
    };
  }

  function updateResizeWidth(value) {
    const width = clampNumber(value, 1, 12000);
    setResizeWidth(width);

    if (keepAspect && sourceImage) {
      setResizeHeight(Math.max(1, Math.round((width * sourceSize.height) / sourceSize.width)));
    }
  }

  function updateResizeHeight(value) {
    const height = clampNumber(value, 1, 12000);
    setResizeHeight(height);

    if (keepAspect && sourceImage) {
      setResizeWidth(Math.max(1, Math.round((height * sourceSize.width) / sourceSize.height)));
    }
  }

  function updateCropBox(key, value) {
    setCropBox((current) => {
      const maxWidth = sourceSize.width;
      const maxHeight = sourceSize.height;
      const next = {
        ...current,
        [key]: clampNumber(value, key === "width" || key === "height" ? 1 : 0, 12000),
      };

      next.x = clampNumber(next.x, 0, Math.max(0, maxWidth - 1));
      next.y = clampNumber(next.y, 0, Math.max(0, maxHeight - 1));
      next.width = clampNumber(next.width, 1, Math.max(1, maxWidth - next.x));
      next.height = clampNumber(next.height, 1, Math.max(1, maxHeight - next.y));

      return next;
    });
  }

  async function buildOutputImage({ runAi = false } = {}) {
    if (!sourceImage) {
      throw new Error("Please choose an image first.");
    }

    const { width: sourceWidth, height: sourceHeight } = getImageSize(sourceImage);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: mode === "remove-bg" });

    if (!context) {
      throw new Error("Could not prepare the image canvas.");
    }

    if (mode === "resize") {
      canvas.width = clampNumber(resizeWidth, 1, 12000);
      canvas.height = clampNumber(resizeHeight, 1, 12000);
      context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    } else if (mode === "crop") {
      const cropX = clampNumber(cropBox.x, 0, sourceWidth - 1);
      const cropY = clampNumber(cropBox.y, 0, sourceHeight - 1);
      const cropWidth = clampNumber(cropBox.width, 1, sourceWidth - cropX);
      const cropHeight = clampNumber(cropBox.height, 1, sourceHeight - cropY);

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      context.drawImage(
        sourceImage,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );
    } else if (mode === "enhance") {
      const enhancedImage = await enhanceImage(sourceImage);

      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      context.drawImage(enhancedImage, 0, 0, sourceWidth, sourceHeight);
    } else if (mode === "scan-doc") {
      return buildScannedDocumentImage(sourceWidth, sourceHeight);
    } else if (mode === "remove-bg") {
      if (removeBgMethod === "api") {
        if (hasApiRemoveResult) {
          return apiRemoveResult;
        }

        if (!runAi) {
          return buildSourcePreviewImage(sourceWidth, sourceHeight);
        }

        return buildApiBackgroundRemovalImage();
      }

      if (removeBgMethod === "ai") {
        if (hasAiRemoveResult) {
          return aiRemoveResult;
        }

        if (!runAi) {
          return buildSourcePreviewImage(sourceWidth, sourceHeight);
        }

        try {
          return await buildAiBackgroundRemovalImage(sourceWidth, sourceHeight);
        } catch (error) {
          setStatus(
            `AI remove could not finish. Quick clean preview used instead. ${error?.message || ""}`.trim(),
          );
        }
      }

      return buildLocalBackgroundRemovalImage(canvas, context, sourceWidth, sourceHeight);
    } else {
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      context.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);
    }

    const mimeType = mode === "remove-bg" ? "image/png" : activeFormat;
    const blob = await canvasToBlob(canvas, mimeType, mimeType === "image/png" ? undefined : quality);

    return {
      blob,
      height: canvas.height,
      width: canvas.width,
    };
  }

  async function handleDownload() {
    try {
      setBusy(true);
      setStatus("Preparing download...");

      if (
        mode === "remove-bg" &&
        removeBgMethod !== "quick" &&
        !hasSelectedRemoveResult
      ) {
        setStatus("Click Remove BG first, then download the transparent PNG.");
        return;
      }

      const { blob, canvas, width, height } = await buildOutputImage();

      if (mode === "scan-doc") {
        const pdfBlob = await buildScannedDocumentPdf(canvas);

        downloadBlob(pdfBlob, `${getBaseName(sourceFile?.name)}-document.pdf`);
        setPreviewSize(pdfBlob.size);
        setStatus(`Downloaded scanned document - ${formatFileSize(pdfBlob.size)}.`);
        return;
      }

      const fileName = `${getBaseName(sourceFile?.name)}-${mode}.${activeFormatOption.extension}`;

      downloadBlob(blob, fileName);
      setPreviewSize(blob.size);
      setStatus(`Downloaded ${width} x ${height} image - ${formatFileSize(blob.size)}.`);
    } catch (error) {
      setStatus(error?.message || "Could not export the image.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveBackground() {
    openRemoveBgUpload();
  }

  async function buildScannedDocumentPdf(canvas) {
    if (!canvas) {
      throw new Error("Could not prepare the scanned document.");
    }

    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const imageBytes = await canvasToBlob(canvas, "image/jpeg", 0.92).then((blob) =>
      blob.arrayBuffer(),
    );
    const image = await pdf.embedJpg(imageBytes);
    const imageWidth = image.width;
    const imageHeight = image.height;
    const a4Portrait = { width: 595.28, height: 841.89 };
    const a4Landscape = { width: 841.89, height: 595.28 };
    const pageSize =
      documentPageSize === "a4"
        ? imageWidth > imageHeight
          ? a4Landscape
          : a4Portrait
        : { width: imageWidth, height: imageHeight };
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    const margin = documentPageSize === "a4" ? 28 : 0;
    const maxWidth = pageSize.width - margin * 2;
    const maxHeight = pageSize.height - margin * 2;
    const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;

    page.drawImage(image, {
      height: drawHeight,
      width: drawWidth,
      x: (pageSize.width - drawWidth) / 2,
      y: (pageSize.height - drawHeight) / 2,
    });

    const pdfBytes = await pdf.save();
    return new Blob([pdfBytes], { type: "application/pdf" });
  }

  function renderModeControls() {
    if (mode === "resize") {
      return (
        <>
          <div className="image-inline-grid">
            <div className="field">
              <label htmlFor="resize-width">Width</label>
              <input
                id="resize-width"
                type="number"
                min="1"
                value={resizeWidth}
                onChange={(event) => updateResizeWidth(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="resize-height">Height</label>
              <input
                id="resize-height"
                type="number"
                min="1"
                value={resizeHeight}
                onChange={(event) => updateResizeHeight(event.target.value)}
              />
            </div>
          </div>
          <label className="image-check-row">
            <input
              type="checkbox"
              checked={keepAspect}
              onChange={(event) => setKeepAspect(event.target.checked)}
            />
            <span>Keep aspect ratio</span>
          </label>
        </>
      );
    }

    if (mode === "compress") {
      return (
        <>
          <FormatControl
            activeFormat={activeFormat}
            disabled={forcedPng}
            outputFormat={outputFormat}
            setOutputFormat={setOutputFormat}
          />
          <QualityControl quality={quality} setQuality={setQuality} />
        </>
      );
    }

    if (mode === "remove-bg") {
      return (
        <>
          <div className="image-segmented-control image-segmented-control--three" role="group" aria-label="Remove background method">
            <button
              className={removeBgMethod === "api" ? "is-active" : ""}
              type="button"
              onClick={() => setRemoveBgMethod("api")}
            >
              <Cloud size={17} strokeWidth={2.2} />
              <span>Removal.AI</span>
            </button>
            <button
              className={removeBgMethod === "ai" ? "is-active" : ""}
              type="button"
              onClick={() => setRemoveBgMethod("ai")}
            >
              <WandSparkles size={17} strokeWidth={2.2} />
              <span>Browser AI</span>
            </button>
            <button
              className={removeBgMethod === "quick" ? "is-active" : ""}
              type="button"
              onClick={() => setRemoveBgMethod("quick")}
            >
              <Eraser size={17} strokeWidth={2.2} />
              <span>Quick clean</span>
            </button>
          </div>

          {removeBgMethod === "api" ? (
            <div className="image-enhance-card">
              <Cloud size={22} strokeWidth={2.1} />
              <span>Removal.AI selected. Transparent PNG output.</span>
            </div>
          ) : removeBgMethod === "ai" ? (
            <div className="image-enhance-card">
              <WandSparkles size={22} strokeWidth={2.1} />
              <span>Browser AI selected. Transparent PNG output.</span>
            </div>
          ) : (
            <div className="range-stack">
              <div className="range-row">
                <label htmlFor="bg-tolerance">Background tolerance</label>
                <span>{bgTolerance}</span>
              </div>
              <input
                id="bg-tolerance"
                type="range"
                min="8"
                max="120"
                value={bgTolerance}
                onChange={(event) => setBgTolerance(Number(event.target.value))}
              />
              <div className="hint">Quick clean works best with a flat color background.</div>
            </div>
          )}

          <button
            className="button image-remove-action"
            type="button"
            onClick={handleRemoveBackground}
            disabled={!sourceImage || busy || removeBgBusy}
          >
            {removeBgMethod === "api" ? (
              <Cloud size={17} strokeWidth={2.2} />
            ) : removeBgMethod === "quick" ? (
              <Eraser size={17} strokeWidth={2.2} />
            ) : (
              <WandSparkles size={17} strokeWidth={2.2} />
            )}
            <span>{removeBgBusy ? "Removing..." : "Remove BG"}</span>
          </button>
        </>
      );
    }

    if (mode === "convert") {
      return (
        <FormatControl
          activeFormat={activeFormat}
          disabled={forcedPng}
          outputFormat={outputFormat}
          setOutputFormat={setOutputFormat}
        />
      );
    }

    if (mode === "scan-doc") {
      return (
        <>
          <div className="field">
            <label htmlFor="document-tone">Document style</label>
            <select
              id="document-tone"
              value={documentTone}
              onChange={(event) => setDocumentTone(event.target.value)}
            >
              <option value="clean">Clean grayscale</option>
              <option value="bw">Black and white</option>
              <option value="color">Clean color</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="document-page-size">PDF page</label>
            <select
              id="document-page-size"
              value={documentPageSize}
              onChange={(event) => setDocumentPageSize(event.target.value)}
            >
              <option value="image">Fit to image</option>
              <option value="a4">A4 page</option>
            </select>
          </div>

          <div className="image-enhance-card">
            <FileText size={22} strokeWidth={2.1} />
            <span>Auto crops the white paper, cleans it, then exports PDF.</span>
          </div>
        </>
      );
    }

    if (mode === "crop") {
      return (
        <div className="image-inline-grid">
          <div className="field">
            <label htmlFor="crop-x">Left</label>
            <input
              id="crop-x"
              type="number"
              min="0"
              value={cropBox.x}
              onChange={(event) => updateCropBox("x", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="crop-y">Top</label>
            <input
              id="crop-y"
              type="number"
              min="0"
              value={cropBox.y}
              onChange={(event) => updateCropBox("y", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="crop-width">Width</label>
            <input
              id="crop-width"
              type="number"
              min="1"
              value={cropBox.width}
              onChange={(event) => updateCropBox("width", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="crop-height">Height</label>
            <input
              id="crop-height"
              type="number"
              min="1"
              value={cropBox.height}
              onChange={(event) => updateCropBox("height", event.target.value)}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="image-enhance-card">
        <WandSparkles size={22} strokeWidth={2.1} />
        <span>Auto enhance is ready for the selected photo.</span>
      </div>
    );
  }

  return (
    <section className="image-tools">
      <div className="image-mode-grid" role="tablist" aria-label="Image tools">
        {modes.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === mode;

          return (
            <button
              className={`image-mode-card${isActive ? " is-active" : ""}`}
              type="button"
              key={item.id}
              onClick={() => handleModeSelect(item.id)}
              aria-selected={isActive}
              role="tab"
            >
              <Icon size={22} strokeWidth={2.1} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <Panel
        eyebrow="Image Tool"
        title={activeMode.label}
        description={activeMode.description}
      >
        <div className="image-workspace">
          <div className="image-controls">
            <div className="field">
              <label htmlFor="source-image">Source image</label>
              <input
                id="source-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                onChange={(event) => handleSourceFile(event.target.files?.[0] || null)}
              />
              {sourceFile ? (
                <div className="meta-line">
                  {sourceFile.name} - {formatFileSize(sourceFile.size)} - {sourceSize.width} x {sourceSize.height}
                </div>
              ) : null}
            </div>

            <div className="image-control-card">
              {renderModeControls()}
            </div>

            <button
              className="button"
              type="button"
              onClick={handleDownload}
              disabled={!sourceImage || busy || previewBusy || removeBgBusy}
            >
              {mode === "scan-doc" ? "Download PDF" : "Download Image"}
            </button>
          </div>

          <div className="image-preview-panel">
            <div className="image-preview-header">
              <div>
                <span>Preview</span>
                <strong>{activeMode.label}</strong>
              </div>
              {sourceFile ? (
                <small>
                  {formatFileSize(sourceFile.size)} -&gt; {previewBusy || removeBgBusy ? "Working..." : formatFileSize(previewSize)}
                </small>
              ) : null}
            </div>

            <div className={`image-preview-frame${mode === "remove-bg" ? " is-transparent" : ""}`}>
              {previewUrl ? (
                <img src={previewUrl} alt={`${activeMode.label} preview`} />
              ) : (
                <div className="image-empty-state">
                  <ImageIcon size={42} strokeWidth={1.8} />
                  <span>Choose an image file</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <div className="pdf-status" role="status">
        {busy || previewBusy || removeBgBusy ? "Working... " : null}
        {status}
      </div>
    </section>
  );
}

function FormatControl({ activeFormat, disabled, outputFormat, setOutputFormat }) {
  return (
    <div className="field">
      <label htmlFor="image-format">Format</label>
      <select
        id="image-format"
        value={disabled ? activeFormat : outputFormat}
        onChange={(event) => setOutputFormat(event.target.value)}
        disabled={disabled}
      >
        {Object.entries(formatOptions).map(([value, option]) => (
          <option key={value} value={value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function QualityControl({ quality, setQuality }) {
  return (
    <div className="range-stack">
      <div className="range-row">
        <label htmlFor="image-quality">Quality</label>
        <span>{Math.round(quality * 100)}%</span>
      </div>
      <input
        id="image-quality"
        type="range"
        min="0.25"
        max="0.96"
        step="0.01"
        value={quality}
        onChange={(event) => setQuality(Number(event.target.value))}
      />
    </div>
  );
}

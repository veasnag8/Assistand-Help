import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Move,
  Scissors,
  Upload,
} from "lucide-react";
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
const minLogoScale = 20;
const maxLogoScale = 900;
const defaultSourceCrop = { bottom: 0, left: 0, right: 0, top: 0 };

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
  const x = (targetWidth - drawWidth) * (focusX / 100);
  const y = (targetHeight - drawHeight) * (focusY / 100);

  return {
    drawHeight,
    drawWidth,
    scale,
    x,
    y,
  };
}

function getCroppedSourceSize(sourceWidth, sourceHeight, sourceCrop = defaultSourceCrop) {
  return {
    height: sourceHeight * ((100 - sourceCrop.top - sourceCrop.bottom) / 100),
    width: sourceWidth * ((100 - sourceCrop.left - sourceCrop.right) / 100),
  };
}

function drawLogoToCanvas(image, placement, targetWidth, targetHeight, sourceCrop = defaultSourceCrop) {
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
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceX = sourceWidth * (sourceCrop.left / 100);
  const sourceY = sourceHeight * (sourceCrop.top / 100);
  const croppedSource = getCroppedSourceSize(sourceWidth, sourceHeight, sourceCrop);

  context.drawImage(
    image,
    sourceX,
    sourceY,
    croppedSource.width,
    croppedSource.height,
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

function createLogoSettings(overrides = {}) {
  const sourceCrop = overrides.sourceCrop || defaultSourceCrop;
  const cropFocus = overrides.cropFocus || { x: 50, y: 50 };

  return {
    cropFocus: { x: cropFocus.x, y: cropFocus.y },
    layoutMode: overrides.layoutMode || "normal",
    locked: Boolean(overrides.locked),
    logoScale: overrides.logoScale || 100,
    splitPercent: overrides.splitPercent || 38,
    sourceCrop: {
      bottom: sourceCrop.bottom,
      left: sourceCrop.left,
      right: sourceCrop.right,
      top: sourceCrop.top,
    },
  };
}

function createDefaultPresetSettings() {
  return {
    report: createLogoSettings(),
    site: createLogoSettings(),
  };
}

function getPresetSettings(source, presetId) {
  return createLogoSettings(source?.presetSettings?.[presetId]);
}

function isEditableEventTarget(target) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
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
  const [sourceCrop, setSourceCrop] = useState(defaultSourceCrop);
  const [copiedSource, setCopiedSource] = useState(null);
  const [status, setStatus] = useState("Choose a logo image to start.");
  const resultFrameRef = useRef(null);
  const dragRef = useRef(null);
  const activeSourceIdRef = useRef("");
  const copiedSourceRef = useRef(null);
  const sourceImageRef = useRef(null);
  const sourcesRef = useRef([]);
  const activePreset = useMemo(() => ({ ...logoPresets[presetId], id: presetId }), [presetId]);
  const isStackMode = presetId === "report" && layoutMode === "stack";
  const sourceSize = useMemo(() => {
    if (!sourceImage) return null;

    return {
      width: sourceImage.naturalWidth || sourceImage.width,
      height: sourceImage.naturalHeight || sourceImage.height,
    };
  }, [sourceImage]);
  const croppedSourceSize = sourceSize ? getCroppedSourceSize(sourceSize.width, sourceSize.height, sourceCrop) : null;
  const resultPlacement = croppedSourceSize
    ? getLogoPlacement(
      croppedSourceSize.width,
      croppedSourceSize.height,
      activePreset.width,
      activePreset.height,
      logoScale,
      cropFocus.x,
      cropFocus.y,
    )
    : null;
  const resultScale = presetId === "site" ? 4 : 1.65;
  const resultEditorStyle = {
    height: `${activePreset.height * resultScale}px`,
    width: `${activePreset.width * resultScale}px`,
  };
  const activeSource = sources.find((source) => source.id === activeSourceId) || null;
  const activeSourceSettings = getPresetSettings(activeSource, presetId);
  const activeGroupId = activeSource?.groupId || activeSource?.id || "";
  const canvasSources = useMemo(
    () => sources.filter((source) => (source.groupId || source.id) === activeGroupId),
    [activeGroupId, sources],
  );
  const visibleSources = useMemo(() => sources.filter((source) => !source.isDuplicate), [sources]);

  function getSourceRenderData(source) {
    const image = source.image;
    const imageWidth = image?.naturalWidth || image?.width || 0;
    const imageHeight = image?.naturalHeight || image?.height || 0;

    if (!imageWidth || !imageHeight) {
      return null;
    }

    const settings = getPresetSettings(source, presetId);
    const crop = settings.sourceCrop || defaultSourceCrop;
    const croppedSize = getCroppedSourceSize(imageWidth, imageHeight, crop);
    const placement = getLogoPlacement(
      croppedSize.width,
      croppedSize.height,
      activePreset.width,
      activePreset.height,
      settings.logoScale || 100,
      settings.cropFocus?.x ?? 50,
      settings.cropFocus?.y ?? 50,
    );

    return {
      croppedSize,
      crop,
      imageStyle: {
        height: `${imageHeight * placement.scale * resultScale}px`,
        left: `${-imageWidth * (crop.left / 100) * placement.scale * resultScale}px`,
        top: `${-imageHeight * (crop.top / 100) * placement.scale * resultScale}px`,
        width: `${imageWidth * placement.scale * resultScale}px`,
      },
      placement,
      wrapperStyle: {
        height: `${placement.drawHeight * resultScale}px`,
        left: `${placement.x * resultScale}px`,
        top: `${placement.y * resultScale}px`,
        width: `${placement.drawWidth * resultScale}px`,
      },
    };
  }

  function getOffsetCropFocus(source, offsetX = 28, offsetY = 34, settingsOverride = null) {
    const renderData = settingsOverride
      ? getSourceRenderData({
        ...source,
        presetSettings: {
          ...(source.presetSettings || {}),
          [presetId]: settingsOverride,
        },
      })
      : getSourceRenderData(source);

    if (!renderData) {
      return source.cropFocus || { x: 50, y: 50 };
    }

    const maxX = activePreset.width - renderData.placement.drawWidth;
    const maxY = activePreset.height - renderData.placement.drawHeight;
    const nextX = renderData.placement.x + offsetX;
    const nextY = renderData.placement.y + offsetY;

    return {
      x: maxX !== 0 ? clampNumber((nextX / maxX) * 100, 0, 100) : 50,
      y: maxY !== 0 ? clampNumber((nextY / maxY) * 100, 0, 100) : 50,
    };
  }

  function cloneSourceForCanvas(source, offsetX = 28, offsetY = 34, settingsOverride = null) {
    const settings = settingsOverride || getPresetSettings(source, presetId);
    const nextSettings = createLogoSettings({
      ...settings,
      cropFocus: getOffsetCropFocus(source, offsetX, offsetY, settings),
      locked: false,
    });

    return {
      ...source,
      groupId: source.groupId || source.id,
      id: `${source.file.name}-copy-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      isDuplicate: true,
      presetSettings: {
        ...(source.presetSettings || {}),
        [presetId]: nextSettings,
      },
      url: URL.createObjectURL(source.file),
    };
  }

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    activeSourceIdRef.current = activeSourceId;
    copiedSourceRef.current = copiedSource;
    sourceImageRef.current = sourceImage;
  }, [activeSourceId, copiedSource, sourceImage]);

  useEffect(() => () => {
    sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.url));
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    function handleWindowPointerMove(event) {
      handleResultPointerMove(event);
    }

    function handleWindowPointerUp() {
      handleResultPointerUp();
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  });

  useEffect(() => {
    function handleLogoShortcut(event) {
      if (!sourceImageRef.current || isEditableEventTarget(event.target) || (!event.ctrlKey && event.key !== "Delete")) {
        return;
      }

      const key = event.key.toLowerCase();
      const code = event.code;

      if (event.ctrlKey && (key === "c" || code === "KeyC")) {
        copyActiveSource(event);
        return;
      }

      if (event.ctrlKey && (key === "v" || code === "KeyV")) {
        pasteCopiedSource(event);
        return;
      }

      if (event.ctrlKey && (key === "d" || code === "KeyD")) {
        duplicateActiveSource(event);
        return;
      }

      if (event.key === "Delete") {
        deleteActiveSource(event);
      }
    }

    document.addEventListener("keydown", handleLogoShortcut, true);
    return () => document.removeEventListener("keydown", handleLogoShortcut, true);
  }, [cropFocus, layoutMode, logoScale, presetId, sourceCrop, splitPercent]);

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
    const croppedSource = getCroppedSourceSize(sourceWidth, sourceHeight, sourceCrop);

    if (preset.id === "report" && layoutMode === "stack") {
      return canvasToBlob(drawStackedLogoToCanvas(image, splitPercent, preset.width, preset.height));
    }

    if (canvasSources.length > 1) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not prepare the logo canvas.");
      }

      canvas.width = preset.width;
      canvas.height = preset.height;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, canvas.width, canvas.height);

      canvasSources.forEach((source) => {
        const renderData = getSourceRenderData(source);
        const itemImage = source.image;
        const itemWidth = itemImage.naturalWidth || itemImage.width;
        const itemHeight = itemImage.naturalHeight || itemImage.height;

        if (!renderData) {
          return;
        }

        context.drawImage(
          itemImage,
          itemWidth * (renderData.crop.left / 100),
          itemHeight * (renderData.crop.top / 100),
          renderData.croppedSize.width,
          renderData.croppedSize.height,
          renderData.placement.x,
          renderData.placement.y,
          renderData.placement.drawWidth,
          renderData.placement.drawHeight,
        );
      });

      return canvasToBlob(canvas);
    }

    const placement = getLogoPlacement(
      croppedSource.width,
      croppedSource.height,
      preset.width,
      preset.height,
      logoScale,
      cropFocus.x,
      cropFocus.y,
    );
    const canvas = drawLogoToCanvas(image, placement, preset.width, preset.height, sourceCrop);

    return canvasToBlob(canvas);
  }

  function activateSource(source, targetPresetId = presetId) {
    if (!source) {
      return;
    }

    const settings = getPresetSettings(source, targetPresetId);

    activeSourceIdRef.current = source.id;
    sourceImageRef.current = source.image;
    setActiveSourceId(source.id);
    setSourceFile(source.file);
    setSourceImage(source.image);
    setSourceUrl(source.url);
    setCropFocus(settings.cropFocus);
    setLayoutMode(settings.layoutMode);
    setLogoScale(settings.logoScale);
    setSplitPercent(settings.splitPercent);
    setSourceCrop(settings.sourceCrop);
  }

  function updateActiveSourceSettings({
    nextCropFocus = cropFocus,
    nextLayoutMode = layoutMode,
    nextLogoScale = logoScale,
    nextSplitPercent = splitPercent,
    nextSourceCrop = sourceCrop,
  } = {}) {
    setCropFocus(nextCropFocus);
    setLayoutMode(nextLayoutMode);
    setLogoScale(nextLogoScale);
    setSplitPercent(nextSplitPercent);
    setSourceCrop(nextSourceCrop);
    setSources((current) => current.map((source) => (
      source.id === activeSourceId
        ? {
          ...source,
          presetSettings: {
            ...(source.presetSettings || {}),
            [presetId]: createLogoSettings({
              cropFocus: nextCropFocus,
              layoutMode: nextLayoutMode,
              locked: getPresetSettings(source, presetId).locked || false,
              logoScale: nextLogoScale,
              splitPercent: nextSplitPercent,
              sourceCrop: nextSourceCrop,
            }),
          },
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
        const id = `${file.name}-${file.size}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;

        nextSources.push({
          file,
          groupId: id,
          id,
          image,
          presetSettings: createDefaultPresetSettings(),
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
    const currentSettings = createLogoSettings({
      cropFocus,
      layoutMode,
      locked: activeSourceSettings.locked || false,
      logoScale,
      splitPercent,
      sourceCrop,
    });
    const sourceForNextPreset = activeSource
      ? {
        ...activeSource,
        presetSettings: {
          ...(activeSource.presetSettings || {}),
          [presetId]: currentSettings,
        },
      }
      : null;

    setPresetId(nextPresetId);
    if (activeSourceId) {
      setSources((current) => current.map((source) => (
        source.id === activeSourceId
          ? {
            ...source,
            presetSettings: {
              ...(source.presetSettings || {}),
              [presetId]: currentSettings,
            },
          }
          : source
      )));
    }
    if (sourceForNextPreset) {
      activateSource(sourceForNextPreset, nextPresetId);
    }
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
      croppedSourceSize.width,
      croppedSourceSize.height,
      activePreset.width,
      activePreset.height,
      nextScale,
      50,
      50,
    );
    const maxX = activePreset.width - placement.drawWidth;
    const maxY = activePreset.height - placement.drawHeight;
    const nextFocusX = maxX !== 0
      ? clampNumber((nextX / maxX) * 100, 0, 100)
      : 50;
    const nextFocusY = maxY !== 0
      ? clampNumber((nextY / maxY) * 100, 0, 100)
      : 50;

    updateActiveSourceTransform({ x: nextFocusX, y: nextFocusY }, nextScale);
  }

  function handleResultPointerDown(event) {
    if (!resultFrameRef.current) {
      return;
    }

    event.preventDefault();

    if (activeSourceSettings.locked) {
      return;
    }

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

  function handleResizePointerDown(event, direction = "bottom-right") {
    if (!resultPlacement || !resultFrameRef.current || activeSourceSettings.locked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      direction,
      mode: "resize",
      pointerX: event.clientX,
      pointerY: event.clientY,
      startScale: logoScale,
      startHeight: resultPlacement.drawHeight,
      startWidth: resultPlacement.drawWidth,
    };
    resultFrameRef.current.setPointerCapture?.(event.pointerId);
  }

  function handleCropPointerDown(event, direction) {
    if (!resultPlacement || !resultFrameRef.current || activeSourceSettings.locked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      direction,
      mode: "crop",
      pointerX: event.clientX,
      pointerY: event.clientY,
      startCrop: sourceCrop,
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
      const deltaY = (event.clientY - drag.pointerY) / resultScale;
      const xSign = drag.direction.includes("left") ? -1 : drag.direction.includes("right") ? 1 : 0;
      const ySign = drag.direction.includes("top") ? -1 : drag.direction.includes("bottom") ? 1 : 0;
      const widthScale = xSign
        ? Math.max(10, drag.startWidth + deltaX * xSign) / drag.startWidth
        : 1;
      const heightScale = ySign
        ? Math.max(10, drag.startHeight + deltaY * ySign) / drag.startHeight
        : 1;
      const nextScale = clampNumber(Math.max(widthScale, heightScale) * drag.startScale, minLogoScale, maxLogoScale);

      updateActiveSourceTransform(cropFocus, nextScale);
      return;
    }

    if (drag.mode === "crop") {
      const deltaSourceX = (event.clientX - drag.pointerX) / resultScale / resultPlacement.scale;
      const deltaSourceY = (event.clientY - drag.pointerY) / resultScale / resultPlacement.scale;
      const deltaPercentX = sourceSize ? (deltaSourceX / sourceSize.width) * 100 : 0;
      const deltaPercentY = sourceSize ? (deltaSourceY / sourceSize.height) * 100 : 0;
      const nextCrop = { ...drag.startCrop };

      if (drag.direction === "left") nextCrop.left = clampNumber(drag.startCrop.left + deltaPercentX, 0, 94 - drag.startCrop.right);
      if (drag.direction === "right") nextCrop.right = clampNumber(drag.startCrop.right - deltaPercentX, 0, 94 - drag.startCrop.left);
      if (drag.direction === "top") nextCrop.top = clampNumber(drag.startCrop.top + deltaPercentY, 0, 94 - drag.startCrop.bottom);
      if (drag.direction === "bottom") nextCrop.bottom = clampNumber(drag.startCrop.bottom - deltaPercentY, 0, 94 - drag.startCrop.top);

      updateActiveSourceSettings({ nextSourceCrop: nextCrop });
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
    if (!sourceImage || activeSourceSettings.locked) {
      return;
    }

    event.preventDefault();
    const nextScale = clampNumber(logoScale + (event.deltaY > 0 ? -12 : 12), minLogoScale, maxLogoScale);

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

  function copyActiveSource(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const source = sourcesRef.current.find((item) => item.id === activeSourceIdRef.current);

    if (!source) {
      return;
    }

    const snapshot = {
      ...source,
      presetSettings: {
        ...(source.presetSettings || {}),
        [presetId]: createLogoSettings({
          cropFocus: { ...cropFocus },
          layoutMode,
          locked: false,
          logoScale,
          splitPercent,
          sourceCrop: { ...sourceCrop },
        }),
      },
    };

    copiedSourceRef.current = snapshot;
    setCopiedSource(snapshot);
    setStatus(`Copied ${source.file.name}.`);
  }

  function pasteCopiedSource(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const sourceToPaste = copiedSourceRef.current || copiedSource;

    if (!sourceToPaste) {
      setStatus("Copy a logo first.");
      return;
    }

    const duplicate = cloneSourceForCanvas(sourceToPaste, 34, 40, getPresetSettings(sourceToPaste, presetId));

    setSources((current) => [...current, duplicate]);
    activateSource(duplicate);
    setStatus(`Pasted ${sourceToPaste.file.name}.`);
  }

  function duplicateActiveSource(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const source = sourcesRef.current.find((item) => item.id === activeSourceIdRef.current);

    if (!source) {
      return;
    }

    const currentSettings = createLogoSettings({
      cropFocus: { ...cropFocus },
      layoutMode,
      locked: false,
      logoScale,
      splitPercent,
      sourceCrop: { ...sourceCrop },
    });
    const sourceSnapshot = {
      ...source,
      presetSettings: {
        ...(source.presetSettings || {}),
        [presetId]: currentSettings,
      },
    };
    const duplicate = cloneSourceForCanvas(sourceSnapshot, 34, 40, currentSettings);

    copiedSourceRef.current = sourceSnapshot;
    setCopiedSource(sourceSnapshot);
    setSources((current) => [...current, duplicate]);
    activateSource(duplicate);
    setStatus(`Duplicated ${source.file.name}.`);
  }

  function toggleActiveSourceLock(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const source = sourcesRef.current.find((item) => item.id === activeSourceIdRef.current);

    if (!source) {
      return;
    }

    const nextLocked = !activeSourceSettings.locked;

    setSources((current) => current.map((item) => (
      item.id === activeSourceId
        ? {
          ...item,
          presetSettings: {
            ...(item.presetSettings || {}),
            [presetId]: createLogoSettings({
              ...getPresetSettings(item, presetId),
              locked: nextLocked,
            }),
          },
        }
        : item
    )));
    setStatus(`${nextLocked ? "Locked" : "Unlocked"} ${source.file.name}.`);
  }

  function deleteActiveSource(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const sourceIndex = sourcesRef.current.findIndex((item) => item.id === activeSourceIdRef.current);

    if (sourceIndex < 0) {
      return;
    }

    const source = sourcesRef.current[sourceIndex];
    const nextSources = sourcesRef.current.filter((item) => item.id !== activeSourceIdRef.current);
    const nextActiveSource = nextSources[Math.max(0, sourceIndex - 1)] || nextSources[0] || null;

    URL.revokeObjectURL(source.url);
    setSources(nextSources);
    if (nextActiveSource) {
      activateSource(nextActiveSource);
    } else {
      setActiveSourceId("");
      setSourceFile(null);
      setSourceImage(null);
      setSourceUrl("");
      const defaultSettings = createLogoSettings();

      setCropFocus(defaultSettings.cropFocus);
      setLayoutMode(defaultSettings.layoutMode);
      setLogoScale(defaultSettings.logoScale);
      setSplitPercent(defaultSettings.splitPercent);
      setSourceCrop(defaultSettings.sourceCrop);
    }
    setStatus(`Deleted ${source.file.name}.`);
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

        {visibleSources.length ? (
          <div className="logo-source-list" aria-label="Uploaded logos">
            {visibleSources.map((source, index) => (
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
          ) : sourceUrl && resultPlacement ? (
            <div
              className="logo-result-editor"
              style={resultEditorStyle}
              ref={resultFrameRef}
              onPointerDown={handleResultPointerDown}
              onPointerMove={handleResultPointerMove}
              onPointerUp={handleResultPointerUp}
              onPointerCancel={handleResultPointerUp}
              onWheel={handleResultWheel}
              onContextMenu={(event) => event.preventDefault()}
              role="presentation"
            >
              {canvasSources.map((source) => {
                const renderData = getSourceRenderData(source);

                if (!renderData) {
                  return null;
                }

                const isActive = source.id === activeSourceId;

                return (
                  <span key={source.id}>
                    <span
                      className="logo-result-crop-layer"
                      style={renderData.wrapperStyle}
                      onPointerDown={(event) => {
                        if (!isActive) {
                          event.preventDefault();
                          event.stopPropagation();
                          activateSource(source);
                        }
                      }}
                      onContextMenu={(event) => {
                        if (!isActive) {
                          event.stopPropagation();
                          activateSource(source);
                        }
                      }}
                    >
                      <img className="logo-result-image" src={source.url} alt={`${activePreset.label} editable result`} style={renderData.imageStyle} />
                    </span>
                    {isActive ? (
                      <span className="logo-result-selection" style={renderData.wrapperStyle}>
                        <span className="logo-result-handle is-top-left" onPointerDown={(event) => handleResizePointerDown(event, "top-left")} />
                        <span className="logo-result-crop-handle is-top" onPointerDown={(event) => handleCropPointerDown(event, "top")} />
                        <span className="logo-result-handle is-top-right" onPointerDown={(event) => handleResizePointerDown(event, "top-right")} />
                        <span className="logo-result-crop-handle is-right" onPointerDown={(event) => handleCropPointerDown(event, "right")} />
                        <span className="logo-result-handle is-bottom-left" onPointerDown={(event) => handleResizePointerDown(event, "bottom-left")} />
                        <span className="logo-result-crop-handle is-bottom" onPointerDown={(event) => handleCropPointerDown(event, "bottom")} />
                        <span className="logo-result-handle is-bottom-right" onPointerDown={(event) => handleResizePointerDown(event, "bottom-right")} />
                        <span className="logo-result-crop-handle is-left" onPointerDown={(event) => handleCropPointerDown(event, "left")} />
                      </span>
                    ) : null}
                  </span>
                );
              })}
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

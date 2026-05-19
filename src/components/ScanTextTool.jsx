import { useEffect, useMemo, useState } from "react";
import {
  ClipboardPaste,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import Panel from "./Panel";
import {
  downloadBlob,
  loadPdfJs,
  readFileAsArrayBuffer,
  readFileAsDataUrl,
} from "../lib/file-utils";
import {
  formatFileSize,
  getBaseName,
  getClipboardImageFile,
  getOcrProgressMessage,
  isSupportedImageFile,
  isSupportedScanFile,
} from "../lib/ocr-utils";

const ocrProfiles = [
  {
    id: "khmer",
    imageKey: "ocrDataUrl",
    label: "Khmer",
    languages: "khm+eng",
  },
  {
    id: "chinese",
    imageKey: "binaryOcrDataUrl",
    label: "Chinese",
    languages: "chi_sim+chi_tra+eng",
  },
];

function isPdfFile(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function dataUrlToLoadedImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not open the selected image."));
    image.src = dataUrl;
  });
}

function getLoadedImageSize(image) {
  return {
    height: image.naturalHeight || image.height || 1,
    width: image.naturalWidth || image.width || 1,
  };
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function prepareOcrDataUrls(dataUrl) {
  const image = await dataUrlToLoadedImage(dataUrl);
  const { height, width } = getLoadedImageSize(image);
  const longestSide = Math.max(width, height);
  const scale = Math.max(1, Math.min(4, 1800 / longestSide));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not prepare OCR image canvas.");
  }

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const binaryPixels = new Uint8ClampedArray(pixels);

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;
    const softValue = clampChannel((luminance - 128) * 1.16 + 128);
    const binaryValue = softValue < 188 ? 0 : 255;

    pixels[index] = softValue;
    pixels[index + 1] = softValue;
    pixels[index + 2] = softValue;
    pixels[index + 3] = 255;

    binaryPixels[index] = binaryValue;
    binaryPixels[index + 1] = binaryValue;
    binaryPixels[index + 2] = binaryValue;
    binaryPixels[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  const ocrDataUrl = canvas.toDataURL("image/png");

  context.putImageData(new ImageData(binaryPixels, canvas.width, canvas.height), 0, 0);
  return {
    binaryOcrDataUrl: canvas.toDataURL("image/png"),
    ocrDataUrl,
  };
}

function formatCombinedText(results) {
  return results
    .filter((result) => result.text)
    .map((result, index, collection) => {
      if (collection.length <= 1) {
        return result.text;
      }

      return `Page ${result.pageNumber}\n${result.text}`;
    })
    .join("\n\n");
}

function countMatches(text, pattern) {
  return text.match(pattern)?.length || 0;
}

function scoreOcrCandidate(profile, text, confidence) {
  const normalizedConfidence = Number.isFinite(confidence) ? confidence : 0;
  const khmerChars = countMatches(text, /[\u1780-\u17ff]/g);
  const cjkChars = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
  const latinChars = countMatches(text, /[A-Za-z]/g);
  const digits = countMatches(text, /\d/g);
  const noisySymbols = countMatches(text, /[#@{}[\]<>|~`^_=+\\]/g);
  let score = normalizedConfidence + text.length * 0.04 + latinChars * 0.12 + digits * 0.08;

  score -= noisySymbols * 5;

  if (profile.id === "khmer") {
    score += khmerChars * 10 - cjkChars * 10;
    score += khmerChars ? 42 : 0;
  }

  if (profile.id === "chinese") {
    score += cjkChars * 10 - khmerChars * 10;
    score += cjkChars ? 42 : 0;
  }

  return score;
}

function buildBestResults(pages, candidatesByPage) {
  return pages.map((page, index) => {
    const candidates = candidatesByPage[index] || [];
    const bestCandidate =
      candidates.length > 0
        ? [...candidates].sort((first, second) => second.score - first.score)[0]
        : null;

    return {
      confidence: bestCandidate?.confidence ?? null,
      pageNumber: page.pageNumber,
      text: bestCandidate?.text || "",
    };
  });
}

async function renderPdfPages(file, { maxPages = Infinity, onProgress } = {}) {
  const { getDocument } = await loadPdfJs();
  const data = await readFileAsArrayBuffer(file);

  const pdf = await getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      onProgress?.(pageNumber, pageCount);

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not prepare the PDF page canvas.");
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL("image/png");
      const ocrDataUrls = await prepareOcrDataUrls(dataUrl);

      pages.push({
        dataUrl,
        height: canvas.height,
        id: `page-${pageNumber}`,
        label: `Page ${pageNumber}`,
        ...ocrDataUrls,
        pageNumber,
        width: canvas.width,
      });

      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}

export default function ScanTextTool() {
  const [sourceFile, setSourceFile] = useState(null);
  const [sourcePages, setSourcePages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [scanResults, setScanResults] = useState([]);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [status, setStatus] = useState("Upload or paste an image/PDF to scan.");
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  const activePage = sourcePages[activePageIndex] || null;
  const combinedText = useMemo(() => formatCombinedText(scanResults), [scanResults]);

  useEffect(() => {
    function handlePaste(event) {
      if (busy || scanBusy) {
        return;
      }

      const pastedFile = getClipboardImageFile(event.clipboardData);

      if (!pastedFile) {
        return;
      }

      event.preventDefault();
      loadSourceFile(pastedFile, { autoScan: true });
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [busy, scanBusy]);

  async function prepareImagePages(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await dataUrlToLoadedImage(dataUrl);
    const imageSize = getLoadedImageSize(image);
    const ocrDataUrls = await prepareOcrDataUrls(dataUrl);

    return [
      {
        dataUrl,
        height: imageSize.height,
        id: "image-1",
        label: file.name || "Image",
        ...ocrDataUrls,
        pageNumber: 1,
        width: imageSize.width,
      },
    ];
  }

  async function loadSourceFile(file, { autoScan = true } = {}) {
    setSourceFile(null);
    setSourcePages([]);
    setActivePageIndex(0);
    setScanResults([]);
    setOcrProgress(0);

    if (!file) {
      setStatus("Upload or paste an image/PDF to scan.");
      return;
    }

    if (!isSupportedScanFile(file)) {
      setStatus("Please choose an image or PDF file.");
      return;
    }

    let pages = [];

    try {
      setBusy(true);
      setStatus(isPdfFile(file) ? "Opening PDF..." : "Opening image...");

      if (isSupportedImageFile(file)) {
        pages = await prepareImagePages(file);
      } else {
        pages = await renderPdfPages(file, {
          maxPages: 1,
          onProgress: () => setStatus("Preparing PDF preview..."),
        });
      }

      setSourceFile(file);
      setSourcePages(pages);
      setStatus(
        isPdfFile(file)
          ? `Loaded ${file.name} - PDF ready to scan.`
          : `Loaded ${file.name} - ${pages[0].width} x ${pages[0].height}.`,
      );
    } catch (error) {
      setStatus(error?.message || "Could not open the selected file.");
    } finally {
      setBusy(false);
    }

    if (autoScan && pages.length) {
      await scanSourceFile({
        file,
        initialPages: isPdfFile(file) ? null : pages,
      });
    }
  }

  async function scanSourceFile({ file = sourceFile, initialPages } = {}) {
    if (!file) {
      setStatus("Choose or paste an image or PDF first.");
      return;
    }

    let worker = null;
    let pages = initialPages;

    try {
      setScanBusy(true);
      setOcrProgress(0);
      setScanResults([]);
      setStatus("Loading OCR data...");

      if (!pages) {
        if (isPdfFile(file)) {
          pages = await renderPdfPages(file, {
            onProgress: (pageNumber, pageCount) => {
              setStatus(`Preparing PDF page ${pageNumber} of ${pageCount}...`);
            },
          });
          setSourcePages(pages);
          setActivePageIndex(0);
        } else {
          pages = sourcePages.length ? sourcePages : await prepareImagePages(file);
          setSourcePages(pages);
        }
      }

      const { createWorker } = await import("tesseract.js");
      const candidatesByPage = pages.map(() => []);
      const failedProfiles = [];

      for (let profileIndex = 0; profileIndex < ocrProfiles.length; profileIndex += 1) {
        const profile = ocrProfiles[profileIndex];

        try {
          setStatus("Loading OCR data...");
          worker = await createWorker(profile.languages, 1, {
            logger: (message) => {
              const progress = typeof message?.progress === "number" ? message.progress : 0;
              const totalProgress = (profileIndex + progress) / ocrProfiles.length;

              setOcrProgress(totalProgress);
              setStatus(`OCR ${getOcrProgressMessage(message)}`);
            },
          });
          await worker.setParameters({
            preserve_interword_spaces: "1",
          });

          for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
            const page = pages[pageIndex];
            const imageForOcr = page[profile.imageKey] || page.ocrDataUrl || page.dataUrl;

            setActivePageIndex(pageIndex);
            setStatus(`Scanning ${page.label}...`);

            const {
              data: { confidence, text },
            } = await worker.recognize(imageForOcr);
            const cleanText = text.trim();

            candidatesByPage[pageIndex].push({
              confidence: Number.isFinite(confidence) ? Math.round(confidence) : null,
              score: scoreOcrCandidate(profile, cleanText, confidence),
              text: cleanText,
            });
            setScanResults(buildBestResults(pages, candidatesByPage));
          }
        } catch (error) {
          failedProfiles.push(error);
        } finally {
          if (worker) {
            await worker.terminate();
            worker = null;
          }
        }
      }

      const nextResults = buildBestResults(pages, candidatesByPage);
      const detectedText = formatCombinedText(nextResults);

      if (!detectedText && failedProfiles.length === ocrProfiles.length) {
        throw failedProfiles[0];
      }

      const confidenceValues = nextResults
        .map((result) => result.confidence)
        .filter((confidence) => Number.isFinite(confidence));
      const averageConfidence = confidenceValues.length
        ? Math.round(
            confidenceValues.reduce((total, confidence) => total + confidence, 0) /
              confidenceValues.length,
          )
        : null;

      setStatus(
        detectedText
          ? `Scanned text ready${averageConfidence === null ? "" : ` - ${averageConfidence}% confidence`}.`
          : "Scan finished. No text detected.",
      );
    } catch (error) {
      setStatus(error?.message || "Could not scan text from the file.");
    } finally {
      if (worker) {
        await worker.terminate();
      }

      setScanBusy(false);
      setOcrProgress(0);
    }
  }

  async function copyScannedText() {
    if (!combinedText) {
      setStatus("No scanned text to copy.");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(combinedText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = combinedText;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      setStatus("Copied scanned text.");
    } catch (error) {
      setStatus(error?.message || "Could not copy scanned text.");
    }
  }

  function downloadScannedText() {
    if (!combinedText) {
      setStatus("No scanned text to save.");
      return;
    }

    const blob = new Blob([combinedText], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${getBaseName(sourceFile?.name)}-scanned-text.txt`);
    setStatus("Saved scanned text.");
  }

  return (
    <section className="scan-text-tool">
      <Panel
        eyebrow="Scanned Text"
        title="Scan Text"
        description="Extract text from image and PDF files."
      >
        <div className="scan-text-workspace">
          <div className="scan-text-controls">
            <div className="field">
              <label htmlFor="scan-source-file">Image or PDF</label>
              <input
                id="scan-source-file"
                type="file"
                accept="image/*,application/pdf,.pdf"
                onChange={(event) => {
                  loadSourceFile(event.target.files?.[0] || null);
                  event.target.value = "";
                }}
                disabled={busy || scanBusy}
              />
              {sourceFile ? (
                <div className="meta-line">
                  {sourceFile.name} - {formatFileSize(sourceFile.size)}
                </div>
              ) : null}
            </div>

            <div className="scan-text-control-card">
              {scanBusy ? (
                <div className="range-stack">
                  <div className="range-row">
                    <label htmlFor="scan-progress">Scan progress</label>
                    <span>{Math.round(ocrProgress * 100)}%</span>
                  </div>
                  <progress id="scan-progress" value={Math.round(ocrProgress * 100)} max="100" />
                </div>
              ) : null}

              <div className="button-row wrap">
                <button
                  className="button secondary scan-text-action"
                  type="button"
                  onClick={copyScannedText}
                  disabled={!combinedText || scanBusy}
                >
                  <Copy size={17} strokeWidth={2.2} />
                  <span>Copy Text</span>
                </button>
                <button
                  className="button secondary scan-text-action"
                  type="button"
                  onClick={downloadScannedText}
                  disabled={!combinedText || scanBusy}
                >
                  <Download size={17} strokeWidth={2.2} />
                  <span>Save Text</span>
                </button>
              </div>

              <div className="scan-text-paste-card">
                <ClipboardPaste size={22} strokeWidth={2.1} />
                <span>Paste image from clipboard</span>
              </div>
            </div>
          </div>

          <div className="scan-text-preview-panel">
            <div className="scan-text-preview-header">
              <div>
                <span>Original</span>
                <strong>{activePage?.label || "No file selected"}</strong>
              </div>
              {sourceFile ? (
                <small>
                  {isPdfFile(sourceFile) ? (
                    <>
                      <FileText size={14} strokeWidth={2.2} />
                      <span>PDF</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={14} strokeWidth={2.2} />
                      <span>{activePage?.width} x {activePage?.height}</span>
                    </>
                  )}
                </small>
              ) : null}
            </div>

            <div className="scan-text-result-grid">
              <div className="scan-text-original-panel">
                <div className="scan-text-original-frame">
                  {activePage ? (
                    <img src={activePage.dataUrl} alt={`${activePage.label} original`} />
                  ) : (
                    <div className="image-empty-state">
                      <ImageIcon size={42} strokeWidth={1.8} />
                      <span>Choose or paste a file</span>
                    </div>
                  )}
                </div>

                {sourcePages.length > 1 ? (
                  <div className="scan-text-page-list" aria-label="PDF pages">
                    {sourcePages.map((page, index) => (
                      <button
                        className={index === activePageIndex ? "is-active" : ""}
                        key={page.id}
                        type="button"
                        onClick={() => setActivePageIndex(index)}
                      >
                        {page.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="scan-text-output-panel">
                <textarea
                  className="scan-text-output"
                  value={combinedText}
                  readOnly
                  dir="auto"
                  placeholder={scanBusy ? "Scanning..." : "Scanned text will appear here"}
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="pdf-status" role="status">
        {busy || scanBusy ? "Working... " : null}
        {status}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Archive, FileStack, Scissors, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import Panel from "./Panel";
import {
  downloadBlob,
  isPdfFile,
  loadPdfJs,
  readFileAsArrayBuffer,
} from "../lib/file-utils";

const modes = [
  {
    id: "split",
    label: "Split",
    icon: Scissors,
    description: "Export selected pages or ranges into a new PDF.",
  },
  {
    id: "merge",
    label: "Merge",
    icon: FileStack,
    description: "Combine multiple PDF files into one document.",
  },
  {
    id: "compress",
    label: "Compress",
    icon: Archive,
    description: "Reduce file size without keeping larger rebuilt PDFs.",
  },
];

const compressProfiles = {
  25: {
    attempts: [
      { quality: 0.32, scale: 0.55 },
    ],
    label: "Smallest file",
    targetRatio: 0.25,
  },
  50: {
    attempts: [
      { quality: 0.72, scale: 1.2 },
    ],
    label: "Balanced",
    targetRatio: 0.5,
  },
  75: {
    attempts: [
      { quality: 0.9, scale: 1.9 },
    ],
    label: "Better quality",
    targetRatio: 0.75,
  },
  90: {
    attempts: [
      { quality: 0.96, scale: 2.6 },
    ],
    label: "Best quality",
    targetRatio: 0.9,
  },
};

const maxCompressionCanvasPixels = 16_000_000;

function getSafeCompressionViewport(page, requestedScale) {
  const requestedViewport = page.getViewport({ scale: requestedScale });
  const requestedPixels = requestedViewport.width * requestedViewport.height;

  if (requestedPixels <= maxCompressionCanvasPixels) {
    return requestedViewport;
  }

  const scale = requestedScale * Math.sqrt(maxCompressionCanvasPixels / requestedPixels);

  return page.getViewport({ scale });
}

function canvasHasVisibleContent(canvas) {
  const sampleSize = 96;
  const sampleCanvas = document.createElement("canvas");
  const sampleContext = sampleCanvas.getContext("2d", { alpha: false, willReadFrequently: true });

  if (!sampleContext) {
    return true;
  }

  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  sampleContext.fillStyle = "#ffffff";
  sampleContext.fillRect(0, 0, sampleSize, sampleSize);
  sampleContext.drawImage(canvas, 0, 0, sampleSize, sampleSize);

  const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
  let visiblePixels = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];

    if (red < 245 || green < 245 || blue < 245) {
      visiblePixels += 1;
    }

    if (visiblePixels > 8) {
      return true;
    }
  }

  return false;
}

function getBaseName(fileName, fallback = "document") {
  return (fileName || fallback).replace(/\.[^.]+$/, "") || fallback;
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function readPdfDocument(file) {
  if (!file || !isPdfFile(file)) {
    throw new Error("Please choose a PDF file.");
  }

  return PDFDocument.load(await readFileAsArrayBuffer(file));
}

function createPdfResult(bytes, file, compressionKind) {
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    compressedBytes: bytes.length,
    compressionKind,
    filename: `${getBaseName(file.name)}-compressed.pdf`,
    originalBytes: file.size,
  };
}

function getOriginalPdfResult(file, reason = "already-optimized") {
  return {
    blob: file,
    compressedBytes: file.size,
    compressionKind: "original",
    filename: file.name,
    originalReason: reason,
    originalBytes: file.size,
  };
}

function chooseTargetPdfResult(candidates, file, targetRatio) {
  const compressedCandidates = candidates.filter((candidate) => (
    candidate && candidate.compressedBytes > 0 && candidate.compressedBytes < file.size
  ));

  if (!compressedCandidates.length) {
    return getOriginalPdfResult(file, "no-smaller-result");
  }

  const targetBytes = file.size * targetRatio;
  const minimumAcceptableBytes = targetRatio >= 0.75
    ? file.size * Math.max(0.1, targetRatio * 0.55)
    : 0;
  const underTarget = compressedCandidates
    .filter((candidate) => candidate.compressedBytes <= targetBytes)
    .sort((left, right) => right.compressedBytes - left.compressedBytes);

  if (underTarget[0]) {
    if (underTarget[0].compressedBytes < minimumAcceptableBytes) {
      return getOriginalPdfResult(file, "target-unavailable");
    }

    return underTarget[0];
  }

  return compressedCandidates
    .sort((left, right) => (
      Math.abs(left.compressedBytes - targetBytes) - Math.abs(right.compressedBytes - targetBytes)
    ))[0];
}

function getCompressionStatusMessage(result) {
  if (!result) {
    return "Choose a PDF file to calculate compression.";
  }

  if (result.originalReason === "target-unavailable") {
    return `No clean compressed PDF was close to the selected target. Keeping ${formatFileSize(result.originalBytes)} original.`;
  }

  if (result.originalReason) {
    return `Already optimized: ${formatFileSize(result.originalBytes)} is smaller than the rebuilt PDF.`;
  }

  return `After compression: ${formatFileSize(result.originalBytes)} -> ${formatFileSize(result.compressedBytes)}.`;
}

export default function PdfTools() {
  const [mode, setMode] = useState("split");
  const [splitFile, setSplitFile] = useState(null);
  const [splitPreviewPages, setSplitPreviewPages] = useState([]);
  const [selectedSplitPages, setSelectedSplitPages] = useState([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [mergeFiles, setMergeFiles] = useState([]);
  const [compressFile, setCompressFile] = useState(null);
  const [compressProfile, setCompressProfile] = useState("50");
  const [compressResult, setCompressResult] = useState(null);
  const [status, setStatus] = useState("Choose a mode and upload PDF files.");
  const [busy, setBusy] = useState(false);

  const activeMode = useMemo(
    () => modes.find((item) => item.id === mode) || modes[0],
    [mode],
  );

  useEffect(() => {
    let active = true;

    async function renderSplitPreview() {
      setSplitPreviewPages([]);
      setSelectedSplitPages([]);

      if (!splitFile) {
        return;
      }

      if (!isPdfFile(splitFile)) {
        setStatus("Please choose a PDF file.");
        return;
      }

      let pdf;

      try {
        setPreviewBusy(true);
        setStatus("Creating page preview...");

        const { getDocument } = await loadPdfJs();
        const data = await readFileAsArrayBuffer(splitFile);
        pdf = await getDocument({ data: data.slice(0) }).promise;
        const renderedPages = [];

        setSelectedSplitPages(
          Array.from({ length: pdf.numPages }, (_, index) => index),
        );

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (!active) {
            return;
          }

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(0.36, 150 / baseViewport.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });

          if (!context) {
            throw new Error("Could not prepare page preview.");
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: context, viewport }).promise;

          renderedPages.push({
            imageUrl: canvas.toDataURL("image/jpeg", 0.74),
            pageNumber,
          });

          setSplitPreviewPages([...renderedPages]);
        }

        if (active) {
          setStatus(`Preview ready: ${pdf.numPages} page(s). Uncheck pages you do not need.`);
        }
      } catch (error) {
        if (active) {
          setStatus(error?.message || "Could not preview the PDF.");
        }
      } finally {
        if (pdf) {
          await pdf.destroy();
        }

        if (active) {
          setPreviewBusy(false);
        }
      }
    }

    renderSplitPreview();

    return () => {
      active = false;
    };
  }, [splitFile]);

  function toggleSplitPage(pageIndex) {
    setSelectedSplitPages((current) => (
      current.includes(pageIndex)
        ? current.filter((item) => item !== pageIndex)
        : [...current, pageIndex].sort((a, b) => a - b)
    ));
  }

  function selectAllSplitPages() {
    setSelectedSplitPages(
      splitPreviewPages.map((page) => page.pageNumber - 1),
    );
  }

  function clearSplitPages() {
    setSelectedSplitPages([]);
  }

  function removeMergeFile(removeIndex) {
    setMergeFiles((current) => (
      current.filter((_, index) => index !== removeIndex)
    ));
  }

  function handleCompressFileChange(file) {
    setCompressFile(file);
    setCompressResult(null);

    if (file) {
      setStatus(`Original file ready: ${formatFileSize(file.size)}.`);
    }
  }

  function handleCompressProfileChange(value) {
    setCompressProfile(value);
    setCompressResult(null);
  }

  function getCompressionSummary() {
    if (!compressFile || !compressResult?.compressedBytes) {
      return compressFile ? "Ready to compress" : "Waiting for file";
    }

    if (compressResult.originalReason === "target-unavailable") {
      return "No clean result";
    }

    if (compressResult.originalReason) {
      return "Original kept";
    }

    return "Smaller";
  }

  async function buildCompressedPdf(file, profileKey, onProgress = () => {}) {
    let pdf;

    try {
      if (!file || !isPdfFile(file)) {
        throw new Error("Please choose a PDF file.");
      }

      const profile = compressProfiles[profileKey] || compressProfiles["50"];
      const { getDocument } = await loadPdfJs();
      const data = await readFileAsArrayBuffer(file);
      const candidates = [];
      const targetBytes = file.size * profile.targetRatio;

      onProgress("Optimizing PDF structure...");

      try {
        const sourcePdf = await PDFDocument.load(data.slice(0));
        const outputPdf = await PDFDocument.create();
        const pageIndexes = Array.from(
          { length: sourcePdf.getPageCount() },
          (_, index) => index,
        );
        const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);

        copiedPages.forEach((page) => outputPdf.addPage(page));

        const optimizedBytes = await outputPdf.save({
          addDefaultPage: false,
          useObjectStreams: true,
        });

        candidates.push(createPdfResult(optimizedBytes, file, "optimized-copy"));
      } catch {
        onProgress("PDF structure optimization skipped. Rebuilding pages...");
      }

      pdf = await getDocument({ data: data.slice(0) }).promise;

      for (const attempt of profile.attempts) {
        const outputPdf = await PDFDocument.create();
        let visiblePageCount = 0;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          onProgress(`Compressing page ${pageNumber} of ${pdf.numPages} for ${profile.label} target...`);

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = getSafeCompressionViewport(page, attempt.scale);
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });

          if (!context) {
            throw new Error("Could not prepare compression canvas.");
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

          const renderTask = page.render({ canvasContext: context, viewport });
          await renderTask.promise;

          if (canvasHasVisibleContent(canvas)) {
            visiblePageCount += 1;
          }

          const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", attempt.quality);
          });

          if (!blob) {
            throw new Error("Could not compress one of the PDF pages.");
          }

          const jpgBytes = await blob.arrayBuffer();
          const jpgImage = await outputPdf.embedJpg(jpgBytes);
          const outputPage = outputPdf.addPage([baseViewport.width, baseViewport.height]);

          outputPage.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: baseViewport.width,
            height: baseViewport.height,
          });
        }

        if (!visiblePageCount) {
          onProgress("Compression render produced blank pages. Trying another setting...");
          continue;
        }

        const bytes = await outputPdf.save({ useObjectStreams: true });
        const candidate = createPdfResult(bytes, file, `image-rebuild-${profile.label}`);

        candidates.push(candidate);

        if (candidate.compressedBytes <= targetBytes) {
          break;
        }
      }

      const result = chooseTargetPdfResult(candidates, file, profile.targetRatio);

      return {
        ...result,
        originalReason: result.compressedBytes >= file.size
          ? result.originalReason || "already-optimized"
          : result.originalReason,
      };
    } finally {
      if (pdf) {
        await pdf.destroy();
      }
    }
  }

  async function handleSplit() {
    try {
      setBusy(true);
      setStatus("Preparing selected pages...");

      const sourcePdf = await readPdfDocument(splitFile);
      const pageIndexes = selectedSplitPages;

      if (!pageIndexes.length) {
        throw new Error("Select at least one page.");
      }

      const outputPdf = await PDFDocument.create();
      const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);

      copiedPages.forEach((page) => outputPdf.addPage(page));

      const bytes = await outputPdf.save({ useObjectStreams: true });
      downloadBlob(
        new Blob([bytes], { type: "application/pdf" }),
        `${getBaseName(splitFile.name)}-split.pdf`,
      );
      setStatus(`Split complete: ${pageIndexes.length} page(s) exported.`);
    } catch (error) {
      setStatus(error?.message || "Could not split the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMerge() {
    try {
      setBusy(true);
      setStatus("Merging PDFs...");

      if (mergeFiles.length < 2) {
        throw new Error("Choose at least two PDF files.");
      }

      const outputPdf = await PDFDocument.create();

      for (const file of mergeFiles) {
        const sourcePdf = await readPdfDocument(file);
        const pageIndexes = Array.from(
          { length: sourcePdf.getPageCount() },
          (_, index) => index,
        );
        const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);

        copiedPages.forEach((page) => outputPdf.addPage(page));
      }

      const bytes = await outputPdf.save({ useObjectStreams: true });
      downloadBlob(
        new Blob([bytes], { type: "application/pdf" }),
        "merged.pdf",
      );
      setStatus(`Merge complete: ${mergeFiles.length} PDFs combined.`);
    } catch (error) {
      setStatus(error?.message || "Could not merge the PDFs.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompress() {
    try {
      setBusy(true);
      setStatus("Preparing compressed PDF...");

      if (!compressFile || !isPdfFile(compressFile)) {
        throw new Error("Please choose a PDF file.");
      }

      const result = compressResult?.blob
        ? compressResult
        : await buildCompressedPdf(compressFile, compressProfile, setStatus);

      if (result.originalReason) {
        setCompressResult(result);
        setStatus(getCompressionStatusMessage(result));
        return;
      }

      downloadBlob(result.blob, result.filename);
      setCompressResult(result);
      setStatus(
        `Downloaded compressed PDF: ${formatFileSize(result.originalBytes)} -> ${formatFileSize(result.compressedBytes)}.`,
      );
    } catch (error) {
      setStatus(error?.message || "Could not compress the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pdf-tools">
      <div className="pdf-mode-grid" role="tablist" aria-label="PDF tools">
        {modes.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === mode;

          return (
            <button
              className={`pdf-mode-card${isActive ? " is-active" : ""}`}
              type="button"
              key={item.id}
              onClick={() => setMode(item.id)}
              aria-selected={isActive}
              role="tab"
            >
              <Icon size={24} strokeWidth={2.1} />
              <span>{item.label} PDF</span>
            </button>
          );
        })}
      </div>

      <Panel
        eyebrow="PDF Tool"
        title={`${activeMode.label} PDF`}
        description={activeMode.description}
      >
        {mode === "split" ? (
          <div className="pdf-form">
            <div className="field">
              <label htmlFor="split-pdf">Source PDF</label>
              <input
                id="split-pdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  setSplitFile(event.target.files?.[0] || null);
                }}
              />
              {splitFile ? <div className="meta-line">{splitFile.name}</div> : null}
            </div>

            {splitFile ? (
              <div className="pdf-preview-panel">
                <div className="pdf-preview-toolbar">
                  <strong>
                    {previewBusy
                      ? "Loading preview..."
                      : `${selectedSplitPages.length} of ${splitPreviewPages.length} page(s) selected`}
                  </strong>
                  <div className="button-row">
                    <button className="button secondary" type="button" onClick={selectAllSplitPages}>
                      Select all
                    </button>
                    <button className="button ghost" type="button" onClick={clearSplitPages}>
                      Clear
                    </button>
                  </div>
                </div>

                <div className="pdf-page-grid" aria-label="PDF page preview">
                  {splitPreviewPages.map((page) => {
                    const pageIndex = page.pageNumber - 1;
                    const selected = selectedSplitPages.includes(pageIndex);

                    return (
                      <label
                        className={`pdf-page-card${selected ? " is-selected" : ""}`}
                        key={page.pageNumber}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSplitPage(pageIndex)}
                        />
                        <img src={page.imageUrl} alt={`Page ${page.pageNumber} preview`} />
                        <span>Page {page.pageNumber}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <button className="button" type="button" onClick={handleSplit} disabled={busy}>
              Export Split PDF
            </button>
          </div>
        ) : null}

        {mode === "merge" ? (
          <div className="pdf-form">
            <div className="field">
              <label htmlFor="merge-pdfs">PDF files</label>
              <input
                id="merge-pdfs"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(event) => setMergeFiles(Array.from(event.target.files || []))}
              />
              <div className="meta-line">
                {mergeFiles.length ? `${mergeFiles.length} file(s) selected` : "Choose two or more PDFs."}
              </div>
            </div>

            <div className="pdf-file-list">
              {mergeFiles.map((file, index) => (
                <div className="pdf-file-row" key={`${file.name}-${index}`}>
                  <span>{index + 1}</span>
                  <strong>{file.name}</strong>
                  <small>{formatFileSize(file.size)}</small>
                  <button
                    className="pdf-remove-button"
                    type="button"
                    onClick={() => removeMergeFile(index)}
                    aria-label={`Remove ${file.name}`}
                    title="Remove"
                  >
                    <X size={16} strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>

            <button className="button" type="button" onClick={handleMerge} disabled={busy}>
              Merge PDFs
            </button>
          </div>
        ) : null}

        {mode === "compress" ? (
          <div className="pdf-form">
            <div className="field">
              <label htmlFor="compress-pdf">Source PDF</label>
              <input
                id="compress-pdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => handleCompressFileChange(event.target.files?.[0] || null)}
              />
              {compressFile ? (
                <div className="meta-line">
                  {compressFile.name} · {formatFileSize(compressFile.size)}
                </div>
              ) : null}
            </div>

            {compressFile ? (
              <div className="pdf-compress-result" aria-label="Compression size result">
                <div className="pdf-size-card is-original">
                  <span>Original</span>
                  <strong>{formatFileSize(compressFile.size)}</strong>
                </div>
                <div className="pdf-size-arrow" aria-hidden="true">→</div>
                <div className={`pdf-size-card ${compressResult?.originalReason ? "is-neutral" : "is-compressed"}`}>
                  <span>After</span>
                  <strong>
                    {compressResult?.compressedBytes
                      ? formatFileSize(compressResult.compressedBytes)
                      : "Ready"}
                  </strong>
                  <small>{getCompressionSummary()}</small>
                </div>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="compress-profile">Compress size</label>
              <select
                id="compress-profile"
                value={compressProfile}
                onChange={(event) => handleCompressProfileChange(event.target.value)}
              >
                {Object.entries(compressProfiles).map(([value, profile]) => (
                  <option key={value} value={value}>
                    {profile.label}
                  </option>
                ))}
              </select>
              <div className="hint">Choose a compression level. Smaller files may reduce visual quality.</div>
            </div>

            <button
              className="button"
              type="button"
              onClick={handleCompress}
              disabled={busy || Boolean(compressResult?.originalReason)}
            >
              {compressResult?.originalReason ? "Original Kept" : "Compress PDF"}
            </button>
          </div>
        ) : null}
      </Panel>

      <div className="pdf-status" role="status">
        {busy ? "Working... " : null}
        {status}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Archive, FileStack, FileType, Scissors, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
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
  {
    id: "word",
    label: "PDF to Word",
    icon: FileType,
    description: "Scan PDF pages and export Khmer-friendly Word text.",
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

function isSupportedWordPdfFile(file) {
  return isPdfFile(file);
}

const pdfToWordEndpointPath = "/.netlify/functions/pdf-to-word";

const defaultWordFont = "Khmer UI";

function isPageLabelText(value) {
  return /^page\s+\d+$/i.test(String(value || "").trim());
}

function cleanWordText(value, maxLength = 12000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function createWordTextRun(text, { bold = false, italic = false, size = 24, font = defaultWordFont } = {}) {
  return new TextRun({
    bold,
    font: {
      ascii: font,
      cs: font,
      eastAsia: font,
      hAnsi: font,
      hint: "eastAsia",
    },
    italics: italic,
    size: Math.max(12, Math.min(36, Math.round(size * 1.2))),
    text: cleanWordText(text) || " ",
  });
}

function createWordParagraph(children, options = {}) {
  return new Paragraph({
    children,
    spacing: options.spacing || { after: 120 },
  });
}

function createWordTableCell(value) {
  return new TableCell({
    children: [new Paragraph({ children: [createWordTextRun(value, { size: 18 })] })],
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
  });
}

function textContentToParagraphRuns(textContent) {
  const items = [...(textContent?.items || [])].sort((left, right) => {
    const leftY = Math.round((left.transform?.[5] || 0) * 10) / 10;
    const rightY = Math.round((right.transform?.[5] || 0) * 10) / 10;

    if (Math.abs(leftY - rightY) > 2) {
      return rightY - leftY;
    }

    return (left.transform?.[4] || 0) - (right.transform?.[4] || 0);
  });

  const lines = [];
  let current = [];
  let previousY = null;

  for (const item of items) {
    const text = cleanWordText(item?.str || "", 200);
    if (!text) {
      continue;
    }

    const y = Math.round((item.transform?.[5] || 0) * 10) / 10;

    if (previousY !== null && Math.abs(previousY - y) > 10 && current.length) {
      lines.push(current);
      current = [];
    }

    current.push(item);
    previousY = y;
  }

  if (current.length) {
    lines.push(current);
  }

  return lines.map((lineItems) => lineItems.map((item) => {
    const fontSize = Math.max(12, Math.min(24, Math.round((item.height || 12) * 0.9)));
    const text = cleanWordText(item.str || "", 200);
    return createWordTextRun(text, {
      bold: Boolean(item.fontName && /bold/i.test(item.fontName)),
      italic: Boolean(item.fontName && /italic/i.test(item.fontName)),
      size: fontSize,
    });
  }));
}

function extractTextContentString(textContent) {
  return cleanWordText(
    (textContent?.items || []).map((item) => item?.str || "").join(" "),
    5000,
  );
}

function shouldUseOcrForTextContent(textContent) {
  const text = extractTextContentString(textContent);

  if (!text) {
    return true;
  }

  const replacementCount = countMatches(text, /�/g);
  const khmerCount = countMatches(text, /[\u1780-\u17ff]/g);
  const latinCount = countMatches(text, /[A-Za-z]/g);
  const score = scoreOcrText(text, 0);
  const totalLetters = khmerCount + latinCount;

  if (replacementCount >= 2) {
    return true;
  }

  if (khmerCount >= 8 && score < 40) {
    return true;
  }

  if (khmerCount >= 4 && latinCount > khmerCount * 4) {
    return true;
  }

  return totalLetters > 0 && score < 18;
}

function createWordBlock(block, index) {
  const type = cleanWordText(block?.type, 24).toLowerCase();

  if (type === "heading") {
    return new Paragraph({
      children: [createWordTextRun(block?.text || block?.runs?.map((run) => run?.text).join(" "), { bold: true, size: 16 })],
      spacing: { after: 24, before: index === 0 ? 0 : 24 },
    });
  }

  if (type === "list") {
    const items = Array.isArray(block?.items) ? block.items : [];
    return items.map((item) => new Paragraph({
      bullet: { level: 0 },
      children: [createWordTextRun(item, { size: 13 })],
      spacing: { after: 18 },
    }));
  }

  if (type === "table") {
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    if (!rows.length) {
      return new Paragraph({ children: [createWordTextRun(" ")] });
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map((row) => new TableRow({
        children: Array.isArray(row) ? row.map(createWordTableCell) : [createWordTableCell(row)],
      })),
    });
  }

  return createWordParagraph([
    createWordTextRun(block?.text || block?.runs?.map((run) => run?.text).join(" "), { size: 13 }),
  ]);
}

function buildWordDocumentFromStructuredContent(structured, fallbackName) {
  const pages = Array.isArray(structured?.pages) ? structured.pages : [];
  const children = [];

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      children.push(new Paragraph({ text: "", pageBreakBefore: true }));
    }

    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    const filteredBlocks = blocks.filter((block) => {
      const blockText = cleanWordText(
        block?.text || block?.runs?.map((run) => run?.text).join(" ") || "",
        120,
      );

      return !(cleanWordText(block?.type, 24).toLowerCase() === "heading" && isPageLabelText(blockText));
    });

    filteredBlocks.forEach((block, blockIndex) => {
      const item = createWordBlock(block, blockIndex);
      if (Array.isArray(item)) {
        children.push(...item);
      } else {
        children.push(item);
      }
    });
  });

  if (!children.length) {
    children.push(new Paragraph({ children: [createWordTextRun("No content could be extracted.")] }));
  }

  return new Document({
    creator: "Assistand Help",
    sections: [{ children }],
    properties: {
      page: {
        margin: {
          top: 720,
          right: 720,
          bottom: 720,
          left: 720,
        },
      },
    },
    styles: {
      default: {
        document: {
          run: {
            font: {
              ascii: defaultWordFont,
              cs: defaultWordFont,
              eastAsia: defaultWordFont,
              hAnsi: defaultWordFont,
              hint: "eastAsia",
            },
            size: 16,
          },
        },
      },
    },
    title: fallbackName,
  });
}

function countMatches(text, pattern) {
  return text.match(pattern)?.length || 0;
}

function scoreOcrText(text, confidence) {
  const normalizedConfidence = Number.isFinite(confidence) ? confidence : 0;
  const khmerChars = countMatches(text, /[\u1780-\u17ff]/g);
  const latinChars = countMatches(text, /[A-Za-z]/g);
  const digits = countMatches(text, /\d/g);
  const punctuation = countMatches(text, /[^\w\s\u1780-\u17ff]/g);

  return normalizedConfidence + khmerChars * 12 + latinChars * 2 + digits * 0.08 - punctuation * 1.5;
}

function normalizeOcrText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParagraphs(text) {
  return normalizeOcrText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);
}

function clampWordSize(value) {
  return Math.max(16, Math.min(96, Math.round(value * 2)));
}

function normalizeWordColor(value) {
  if (typeof value !== "string") {
    return null;
  }

  const hex = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

async function renderPdfPagesForWord(file, { maxPages = Infinity, onProgress } = {}) {
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

      pages.push({
        dataUrl: canvas.toDataURL("image/png"),
        pageNumber,
      });

      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}

async function ocrPdfPageToRuns(imageDataUrl) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("khm+eng", 1, {
    logger: () => {},
  });

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
    });

    const { data } = await worker.recognize(imageDataUrl);
    const cleanText = normalizeOcrText(data.text || "");

    if (!cleanText) {
      return null;
    }

    return splitParagraphs(cleanText).map((paragraph) => [createWordTextRun(paragraph, { size: 24 })]);
  } finally {
    await worker.terminate();
  }
}

async function ocrPdfToWord(file, { onProgress } = {}) {
  const { getDocument } = await loadPdfJs();
  const data = await readFileAsArrayBuffer(file);
  const pdf = await getDocument({ data }).promise;
  const children = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.(pageNumber, pdf.numPages);
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

      let pageRuns = null;

      try {
        const textContent = await page.getTextContent({
          disableCombineTextItems: false,
          normalizeWhitespace: false,
        });
        if (!shouldUseOcrForTextContent(textContent)) {
          pageRuns = textContentToParagraphRuns(textContent);
        }
      } catch {
        pageRuns = null;
      }

      if (!pageRuns || !pageRuns.length) {
        pageRuns = await ocrPdfPageToRuns(canvas.toDataURL("image/png"));
      }

      if (pageRuns && pageRuns.length) {
        pageRuns.forEach((runs) => {
          children.push(
            new Paragraph({
              children: runs,
              spacing: { after: 180 },
            }),
          );
        });
      } else {
        children.push(
          new Paragraph({
            children: [
              createWordTextRun("No readable text was detected in this page.", {
                size: 24,
              }),
            ],
          }),
        );
      }

      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  return {
    blob,
    filename: `${getBaseName(file.name)}-ocr.docx`,
  };
}

function getPdfToWordEndpoint() {
  return pdfToWordEndpointPath;
}

async function readDocxResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  if (contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
    return response.arrayBuffer();
  }

  const text = await response.text();
  throw new Error(text || fallbackMessage);
}

async function convertPdfToWordWithGemini(file) {
  const response = await fetch(getPdfToWordEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: await readFileAsArrayBuffer(file),
  });

  const result = await readDocxResponse(response, "Could not convert the PDF to Word.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not convert the PDF to Word.");
  }

  const doc = buildWordDocumentFromStructuredContent(result.structured, result.fileName);
  const blob = await Packer.toBlob(doc);

  return {
    blob,
    filename: `${getBaseName(result.fileName || file.name)}-gemini.docx`,
  };
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
  const [compressPreviewBusy, setCompressPreviewBusy] = useState(false);
  const [wordFile, setWordFile] = useState(null);
  const [wordBusy, setWordBusy] = useState(false);
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

  useEffect(() => {
    let active = true;

    async function prepareCompressedPreview() {
      setCompressResult(null);

      if (mode !== "compress" || !compressFile) {
        return;
      }

      if (!isPdfFile(compressFile)) {
        setStatus("Please choose a PDF file.");
        return;
      }

      try {
        setCompressPreviewBusy(true);
        setStatus("Calculating compressed preview...");

        const result = await buildCompressedPdf(compressFile, compressProfile, (message) => {
          if (active) {
            setStatus(message);
          }
        });

        if (active) {
          setCompressResult(result);
          setStatus(getCompressionStatusMessage(result));
        }
      } catch (error) {
        if (active) {
          setStatus(error?.message || "Could not calculate compressed preview.");
        }
      } finally {
        if (active) {
          setCompressPreviewBusy(false);
        }
      }
    }

    prepareCompressedPreview();

    return () => {
      active = false;
    };
  }, [compressFile, compressProfile, mode]);

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
      return compressPreviewBusy ? "Calculating..." : "Waiting for file";
    }

    if (compressResult.originalReason === "target-unavailable") {
      return "No clean result";
    }

    if (compressResult.originalReason) {
      return "Original kept";
    }

    const originalBytes = compressResult.originalBytes || compressFile.size;
    const compressedBytes = compressResult.compressedBytes;
    const difference = originalBytes - compressedBytes;

    if (difference <= 0) {
      return "Original kept";
    }

    const percent = (difference / originalBytes) * 100;

    return percent < 1 ? "Less than 1% smaller" : `${percent.toFixed(0)}% smaller`;
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

  async function handleWordExport() {
    try {
      setBusy(true);
      setWordBusy(true);
      setStatus("Preparing PDF to Word export...");

      if (!wordFile || !isSupportedWordPdfFile(wordFile)) {
        throw new Error("Please choose a PDF file.");
      }

      let result;

      try {
        setStatus("Sending PDF to Gemini for layout-preserving conversion...");
        result = await convertPdfToWordWithGemini(wordFile);
      } catch (apiError) {
        setStatus(apiError?.message || "Gemini conversion failed. Falling back to local OCR...");
        result = await ocrPdfToWord(wordFile, {
          onProgress: (message) => {
            const statusText = typeof message === "string"
              ? message
              : message?.progress
                ? `OCR ${Math.round(message.progress * 100)}%`
                : "Scanning PDF...";
            setStatus(statusText);
          },
        });
      }

      downloadBlob(result.blob, result.filename);
      setStatus(`Downloaded Word document: ${result.filename}.`);
    } catch (error) {
      setStatus(error?.message || "Could not convert the PDF to Word.");
    } finally {
      setBusy(false);
      setWordBusy(false);
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
        title={mode === "word" ? "PDF to Word" : `${activeMode.label} PDF`}
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
                  {compressFile.name} Â· {formatFileSize(compressFile.size)}
                </div>
              ) : null}
            </div>

            {compressFile ? (
              <div className="pdf-compress-result" aria-label="Compression size result">
                <div className="pdf-size-card is-original">
                  <span>Original</span>
                  <strong>{formatFileSize(compressFile.size)}</strong>
                </div>
                <div className="pdf-size-arrow" aria-hidden="true">â†’</div>
                <div className={`pdf-size-card ${compressResult?.originalReason ? "is-neutral" : "is-compressed"}`}>
                  <span>After</span>
                  <strong>
                    {compressResult?.compressedBytes
                      ? formatFileSize(compressResult.compressedBytes)
                      : "Calculating..."}
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
              disabled={busy || compressPreviewBusy || Boolean(compressResult?.originalReason)}
            >
              {compressResult?.originalReason ? "Original Kept" : "Compress PDF"}
            </button>
          </div>
        ) : null}

        {mode === "word" ? (
          <div className="pdf-form">
            <div className="field">
              <label htmlFor="word-pdf">Source PDF</label>
              <input
                id="word-pdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setWordFile(event.target.files?.[0] || null)}
              />
              {wordFile ? (
                <div className="meta-line">
                  {wordFile.name} · {formatFileSize(wordFile.size)}
                </div>
              ) : null}
            </div>

            <div className="hint">
              Uses Gemini to preserve page order, headings, lists, and tables in the Word export, then falls back to local OCR if needed.
            </div>

            <button className="button" type="button" onClick={handleWordExport} disabled={busy || wordBusy || !wordFile}>
              Export PDF to Word
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


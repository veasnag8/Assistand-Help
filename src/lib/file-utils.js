let pdfJsPromise;

export async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjsLib, workerModule]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjsLib;
    });
  }

  return pdfJsPromise;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsArrayBuffer(file);
  });
}

export function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not open the selected image."));
    image.src = dataUrl;
  });
}

export function isPdfFile(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export async function enhanceImage(sourceImage) {
  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;
  const sourceCanvas = document.createElement("canvas");
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });

  if (!sourceContext) {
    throw new Error("Could not prepare the enhancement canvas.");
  }

  sourceCanvas.width = width;
  sourceCanvas.height = height;
  sourceContext.drawImage(sourceImage, 0, 0, width, height);

  const imageData = sourceContext.getImageData(0, 0, width, height);
  const source = imageData.data;
  const output = new Uint8ClampedArray(source);
  const sharpenAmount = 0.38;
  const contrast = 1.2;
  const saturation = 1.08;
  const brightness = 6;
  const alphaBoost = 1.22;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;

      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const top = index - width * 4;
        const bottom = index + width * 4;
        const left = index - 4;
        const right = index + 4;

        for (let channel = 0; channel < 3; channel += 1) {
          const base = source[index + channel];
          const sharpened =
            source[top + channel] * -1 +
            source[left + channel] * -1 +
            base * 5 +
            source[right + channel] * -1 +
            source[bottom + channel] * -1;

          output[index + channel] = clampChannel(
            base + (sharpened - base) * sharpenAmount,
          );
        }
      }

      const red = output[index];
      const green = output[index + 1];
      const blue = output[index + 2];
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

      output[index] = clampChannel(
        (luminance + (red - luminance) * saturation - 128) * contrast + 128 + brightness,
      );
      output[index + 1] = clampChannel(
        (luminance + (green - luminance) * saturation - 128) * contrast + 128 + brightness,
      );
      output[index + 2] = clampChannel(
        (luminance + (blue - luminance) * saturation - 128) * contrast + 128 + brightness,
      );
      output[index + 3] = clampChannel(source[index + 3] * alphaBoost);
    }
  }

  sourceContext.putImageData(new ImageData(output, width, height), 0, 0);
  return dataUrlToImage(sourceCanvas.toDataURL("image/png"));
}

export async function pdfFileToImage(file, scale = 2) {
  const { getDocument } = await loadPdfJs();
  const data = await readFileAsArrayBuffer(file);
  const pdf = await getDocument({ data }).promise;

  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not prepare the PDF preview canvas.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    return dataUrlToImage(canvas.toDataURL("image/png"));
  } catch (error) {
    throw new Error(error?.message || "Could not open the selected PDF.");
  } finally {
    await pdf.destroy();
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

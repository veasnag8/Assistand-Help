import { dataUrlToImage, readFileAsDataUrl } from "./file-utils";

const removeBgFunctionUrl = "/.netlify/functions/remove-bg";

async function readApiError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      return payload?.error || "Removal.AI could not process this image.";
    } catch {
      return "Removal.AI could not process this image.";
    }
  }

  const text = await response.text();
  return text || "Removal.AI could not process this image.";
}

export async function removeBackgroundWithRemovalAi(file) {
  if (!file) {
    throw new Error("Please choose an image first.");
  }

  const response = await fetch(removeBgFunctionUrl, {
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || "image.png"),
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error("Removal.AI returned an empty image.");
  }

  const dataUrl = await readFileAsDataUrl(blob);
  const image = await dataUrlToImage(dataUrl);

  return {
    blob,
    height: image.naturalHeight || image.height,
    width: image.naturalWidth || image.width,
  };
}

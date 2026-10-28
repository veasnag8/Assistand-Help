import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function splitTextIntoChunks(text, maxLen = 180) {
  const sentences = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[។!?\n])/);

  const chunks = [];
  let current = "";

  for (const part of sentences) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 1 <= maxLen) {
      current = current ? `${current} ${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > maxLen) {
        // split long sentence by commas or words
        const words = trimmed.split(" ");
        let sub = "";
        for (const w of words) {
          if (sub.length + w.length + 1 <= maxLen) {
            sub = sub ? `${sub} ${w}` : w;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
        else current = "";
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

async function fetchGoogleKhmerTts(text) {
  const chunks = splitTextIntoChunks(text, 180);
  const buffers = [];

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=km&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Google TTS request failed with status ${res.status}`);
    }

    const chunkBuffer = Buffer.from(await res.arrayBuffer());
    if (chunkBuffer.length > 0) {
      buffers.push(chunkBuffer);
    }
  }

  return Buffer.concat(buffers);
}

async function fetchEdgePisethTts(text) {
  try {
    const { EdgeTTS } = await import("edge-tts-universal");
    const tts = new EdgeTTS(text, "km-KH-PisethNeural");

    const synthesizePromise = tts.synthesize().then(async (result) => {
      const buf = Buffer.from(await result.audio.arrayBuffer());
      if (buf && buf.length > 500) {
        return buf;
      }
      return null;
    });

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve(null), 3000)
    );

    return await Promise.race([synthesizePromise, timeoutPromise]);
  } catch (err) {
    console.warn("Edge TTS Piseth attempt failed:", err?.message);
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
    };
  }

  let text = "";
  if (event.httpMethod === "GET") {
    text = event.queryStringParameters?.text || "";
  } else if (event.httpMethod === "POST") {
    try {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf8")
        : event.body || "{}";
      const parsed = JSON.parse(body);
      text = parsed.text || "";
    } catch {
      text = event.body || "";
    }
  }

  // Strip markdown, code blocks, URLs, and excessive symbols
  text = String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*#_~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Text parameter is required." }),
    };
  }

  // Truncate to reasonable playback limit (max 1200 characters)
  if (text.length > 1200) {
    text = text.slice(0, 1200);
  }

  try {
    // 1. Try Piseth Neural AI voice first (Edge TTS km-KH-PisethNeural)
    let audioBuffer = await fetchEdgePisethTts(text);

    // 2. If Piseth Neural fails or times out, fallback to Google Khmer voice
    if (!audioBuffer) {
      audioBuffer = await fetchGoogleKhmerTts(text);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("No audio data could be generated.");
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
      body: audioBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Khmer TTS handler error:", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: error?.message || "Failed to generate Khmer speech." }),
    };
  }
}


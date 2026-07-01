import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

const storeName = "comment-tool";
const maxComments = 250;
const maxNameLength = 40;
const maxTextLength = 280;
const fallbackRooms = new Map();

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function jsonResponse(statusCode, payload) {
  return {
    body: JSON.stringify(payload),
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
    statusCode,
  };
}

function normalizeRoomId(value) {
  return String(value || "main")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 48) || "main";
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getRoomKey(roomId) {
  return `rooms/${normalizeRoomId(roomId)}.json`;
}

async function getBlobStore() {
  return getStore(storeName);
}

async function readRoom(roomId) {
  const key = getRoomKey(roomId);

  try {
    const store = await getBlobStore();
    const roomData = await store.get(key, { consistency: "strong", type: "json" });

    if (Array.isArray(roomData)) {
      return roomData;
    }

    return Array.isArray(roomData?.comments) ? roomData.comments : [];
  } catch {
    return fallbackRooms.get(key) || [];
  }
}

async function writeRoom(roomId, comments) {
  const key = getRoomKey(roomId);
  const nextComments = comments.slice(-maxComments);

  try {
    const store = await getBlobStore();
    await store.setJSON(key, nextComments);
  } catch {
    fallbackRooms.set(key, nextComments);
  }

  return nextComments;
}

async function deleteRoom(roomId) {
  const key = getRoomKey(roomId);

  fallbackRooms.delete(key);

  try {
    const store = await getBlobStore();
    await store.delete(key);
  } catch {
    // Local fallback is already cleared.
  }
}

async function readJsonBody(event) {
  if (!event.body) {
    return {};
  }

  const text = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  return JSON.parse(text);
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      body: "",
      headers: corsHeaders,
      statusCode: 204,
    };
  }

  const roomId = normalizeRoomId(event.queryStringParameters?.room);

  if (event.httpMethod === "GET") {
    const comments = await readRoom(roomId);
    return jsonResponse(200, { comments, roomId });
  }

  if (event.httpMethod === "DELETE") {
    await deleteRoom(roomId);
    return jsonResponse(200, { cleared: true, comments: [], roomId });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Use GET, POST, or DELETE." });
  }

  try {
    const payload = await readJsonBody(event);
    const text = cleanText(payload.text, maxTextLength);
    const name = cleanText(payload.name, maxNameLength) || "Anonymous";

    if (!text) {
      return jsonResponse(400, { error: "Comment is required." });
    }

    const comments = await readRoom(roomId);
    const nextComment = {
      id: randomUUID(),
      name,
      text,
      createdAt: new Date().toISOString(),
    };
    const nextComments = await writeRoom(roomId, [...comments, nextComment]);

    return jsonResponse(201, {
      comment: nextComment,
      comments: nextComments,
      roomId,
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error?.message || "Could not save the comment.",
    });
  }
}

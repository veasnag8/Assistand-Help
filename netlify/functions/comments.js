import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

const storeName = "comment-tool";
const maxComments = 250;
const maxNameLength = 40;
const maxTextLength = 280;
const maxWordLength = 32;
const maxWrongGuesses = 6;
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

function cleanWord(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, maxWordLength);
}

function createEmptyRoom() {
  return {
    comments: [],
    hangman: null,
  };
}

function normalizeRoomData(roomData) {
  if (Array.isArray(roomData)) {
    return {
      ...createEmptyRoom(),
      comments: roomData,
    };
  }

  if (!roomData || typeof roomData !== "object") {
    return createEmptyRoom();
  }

  return {
    comments: Array.isArray(roomData.comments) ? roomData.comments : [],
    hangman: roomData.hangman && typeof roomData.hangman === "object" ? roomData.hangman : null,
  };
}

function getPublicHangmanState(game) {
  if (!game?.word) {
    return null;
  }

  const guessedLetters = Array.isArray(game.guessedLetters) ? game.guessedLetters : [];
  const guessedSet = new Set(guessedLetters);
  const wrongLetters = guessedLetters.filter((letter) => !game.word.includes(letter));
  const maskedWord = game.word
    .split("")
    .map((letter) => (guessedSet.has(letter) ? letter : "_"));
  const isWon = maskedWord.every((letter) => letter !== "_");
  const isLost = wrongLetters.length >= maxWrongGuesses;

  return {
    id: game.id,
    setterId: game.setterId,
    setterName: game.setterName,
    maskedWord,
    guessedLetters,
    wrongLetters,
    wrongCount: wrongLetters.length,
    maxWrongGuesses,
    status: isWon ? "won" : isLost ? "lost" : "playing",
    wordLength: game.word.length,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
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

    return normalizeRoomData(roomData);
  } catch {
    return fallbackRooms.get(key) || createEmptyRoom();
  }
}

async function writeRoom(roomId, roomData) {
  const key = getRoomKey(roomId);
  const nextRoom = normalizeRoomData(roomData);
  nextRoom.comments = nextRoom.comments.slice(-maxComments);

  try {
    const store = await getBlobStore();
    await store.setJSON(key, nextRoom);
  } catch {
    fallbackRooms.set(key, nextRoom);
  }

  return nextRoom;
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
    const room = await readRoom(roomId);
    return jsonResponse(200, {
      comments: room.comments,
      hangman: getPublicHangmanState(room.hangman),
      roomId,
    });
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
    const action = cleanText(payload.action, 32);
    const playerId = cleanText(payload.playerId, 80);
    const text = cleanText(payload.text, maxTextLength);
    const name = cleanText(payload.name, maxNameLength) || "Anonymous";

    if (action === "start-hangman") {
      const word = cleanWord(payload.word);

      if (word.length < 2) {
        return jsonResponse(400, { error: "Enter a word with at least 2 letters." });
      }

      if (!playerId) {
        return jsonResponse(400, { error: "Player ID is required." });
      }

      const room = await readRoom(roomId);
      const nextRoom = await writeRoom(roomId, {
        ...room,
        hangman: {
          id: randomUUID(),
          setterId: playerId,
          setterName: name,
          word,
          guessedLetters: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      return jsonResponse(201, {
        comments: nextRoom.comments,
        hangman: getPublicHangmanState(nextRoom.hangman),
        roomId,
      });
    }

    if (action === "guess-hangman") {
      const guess = cleanWord(payload.letter).slice(0, 1);

      if (!guess) {
        return jsonResponse(400, { error: "Choose a letter." });
      }

      const room = await readRoom(roomId);

      if (!room.hangman?.word) {
        return jsonResponse(400, { error: "Start Hangman first." });
      }

      const publicGame = getPublicHangmanState(room.hangman);

      if (publicGame.status !== "playing") {
        return jsonResponse(400, { error: "This game is already finished." });
      }

      const guessedLetters = Array.isArray(room.hangman.guessedLetters) ? room.hangman.guessedLetters : [];
      const nextLetters = guessedLetters.includes(guess) ? guessedLetters : [...guessedLetters, guess].sort();
      const nextRoom = await writeRoom(roomId, {
        ...room,
        hangman: {
          ...room.hangman,
          guessedLetters: nextLetters,
          updatedAt: new Date().toISOString(),
        },
      });

      return jsonResponse(200, {
        comments: nextRoom.comments,
        hangman: getPublicHangmanState(nextRoom.hangman),
        roomId,
      });
    }

    if (action === "reset-hangman") {
      const room = await readRoom(roomId);

      if (room.hangman?.setterId && room.hangman.setterId !== playerId) {
        return jsonResponse(403, { error: "Only the word setter can start a new word." });
      }

      const nextRoom = await writeRoom(roomId, {
        ...room,
        hangman: null,
      });

      return jsonResponse(200, {
        comments: nextRoom.comments,
        hangman: null,
        roomId,
      });
    }

    if (!text) {
      return jsonResponse(400, { error: "Comment is required." });
    }

    const room = await readRoom(roomId);
    const nextComment = {
      id: randomUUID(),
      name,
      text,
      createdAt: new Date().toISOString(),
    };
    const nextRoom = await writeRoom(roomId, {
      ...room,
      comments: [...room.comments, nextComment],
    });

    return jsonResponse(201, {
      comment: nextComment,
      comments: nextRoom.comments,
      hangman: getPublicHangmanState(nextRoom.hangman),
      roomId,
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error?.message || "Could not save the comment.",
    });
  }
}

import { useEffect, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  Expand,
  Gamepad2,
  RefreshCw,
  Smartphone,
  Trash2,
} from "lucide-react";
import Panel from "./Panel";

const hangmanEndpointPath = "/.netlify/functions/hangman";
const qrCodeEndpoint = "https://api.qrserver.com/v1/create-qr-code/";
const pollIntervalMs = 1400;

function createRoomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

function getHashParams() {
  const [, query = ""] = window.location.hash.split("?");
  return new URLSearchParams(query);
}

function getStoredRoomId() {
  const params = getHashParams();
  const requestedRoom = params.get("room");

  if (requestedRoom) {
    return requestedRoom;
  }

  const storedRoom = window.localStorage.getItem("hangman-game-room");

  if (storedRoom) {
    return storedRoom;
  }

  const nextRoom = createRoomId();
  window.localStorage.setItem("hangman-game-room", nextRoom);
  return nextRoom;
}

function getPlayerId() {
  const storedPlayerId = window.localStorage.getItem("hangman-game-player");

  if (storedPlayerId) {
    return storedPlayerId;
  }

  const nextPlayerId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  window.localStorage.setItem("hangman-game-player", nextPlayerId);
  return nextPlayerId;
}

function getPhoneUrl(roomId) {
  const url = new URL(window.location.href);

  url.hash = `hangman?view=phone&room=${encodeURIComponent(roomId)}`;
  return url.toString();
}

function getScreenUrl(roomId) {
  const url = new URL(window.location.href);

  url.hash = `hangman?view=screen&room=${encodeURIComponent(roomId)}`;
  return url.toString();
}

function getHangmanEndpoint() {
  const { hostname, port, protocol } = window.location;
  const isLocalVite =
    ["localhost", "127.0.0.1"].includes(hostname) && port && port !== "8888";

  if (isLocalVite) {
    return `${protocol}//${hostname}:8888${hangmanEndpointPath}`;
  }

  return hangmanEndpointPath;
}

function getHangmanUrl(roomId) {
  return `${getHangmanEndpoint()}?room=${encodeURIComponent(roomId)}`;
}

async function readJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const looksLikeHtml = /^\s*<!doctype|^\s*<html/i.test(text);

  if (looksLikeHtml) {
    throw new Error(
      "Hangman server not available. Open the app with Netlify dev on port 8888.",
    );
  }

  throw new Error(text || fallbackMessage);
}

async function fetchGame(roomId) {
  const response = await fetch(getHangmanUrl(roomId), {
    cache: "no-store",
  });
  const result = await readJsonResponse(response, "Could not load Hangman game.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not load Hangman game.");
  }

  return result;
}

async function postGameAction(roomId, payload) {
  const response = await fetch(getHangmanUrl(roomId), {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result = await readJsonResponse(response, "Could not update Hangman game.");

  if (!response.ok) {
    throw new Error(result?.error || "Could not update Hangman game.");
  }

  return result;
}

function HangmanBoard({ compact = false, game }) {
  const hangmanParts = Math.min(game?.wrongCount || 0, game?.maxWrongGuesses || 6);

  return (
    <div className={compact ? "hangman-board hangman-board--compact" : "hangman-board"}>
      <svg className="hangman-drawing" viewBox="0 0 220 250" role="img" aria-label="Hangman drawing">
        <path className="hangman-frame" d="M42 230H184M64 230V26H154M154 26V54" />
        {hangmanParts >= 1 ? <circle className="hangman-body" cx="154" cy="78" r="24" /> : null}
        {hangmanParts >= 2 ? <path className="hangman-body" d="M154 102V154" /> : null}
        {hangmanParts >= 3 ? <path className="hangman-body" d="M154 118L118 144" /> : null}
        {hangmanParts >= 4 ? <path className="hangman-body" d="M154 118L190 144" /> : null}
        {hangmanParts >= 5 ? <path className="hangman-body" d="M154 154L122 206" /> : null}
        {hangmanParts >= 6 ? <path className="hangman-body" d="M154 154L188 206" /> : null}
      </svg>
      <div className="hangman-word-screen">
        {game?.maskedWord?.map((letter, index) => (
          <span key={`${letter}-${index}`}>{letter}</span>
        ))}
      </div>
      <div className="hangman-meta">
        <span>Set by {game?.setterName || "Player"}</span>
        <span>Wrong: {game?.wrongLetters?.join(" ") || "-"}</span>
      </div>
    </div>
  );
}

function HangmanPlayersList({ players }) {
  return (
    <div className="hangman-player-list">
      <div className="hangman-player-list-title">
        <span>Players</span>
        <small>{players.length}</small>
      </div>
      {players.length ? (
        <div className="hangman-player-chips">
          {players.map((player) => (
            <span key={player.id}>{player.name}</span>
          ))}
        </div>
      ) : (
        <p>No players joined yet.</p>
      )}
    </div>
  );
}

export default function HangmanTool() {
  const [roomId] = useState(getStoredRoomId);
  const [playerId] = useState(getPlayerId);
  const [game, setGame] = useState(null);
  const [name, setName] = useState(() => (getHashParams().get("view") === "phone" ? "" : window.localStorage.getItem("hangman-game-name") || ""));
  const [players, setPlayers] = useState([]);
  const [word, setWord] = useState("");
  const [showWord, setShowWord] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);

  const hashParams = getHashParams();
  const isPhoneView = hashParams.get("view") === "phone";
  const isScreenOnlyView = hashParams.get("view") === "screen";
  const phoneUrl = getPhoneUrl(roomId);
  const guessedLetters = game?.guessedLetters || [];
  const correctGuessedLetters = guessedLetters.filter((letter) => game?.maskedWord?.includes(letter));
  const availableLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const isWordSetter = Boolean(game?.setterId && game.setterId === playerId);
  const cleanName = name.trim();
  const hasPlayerName = cleanName.length > 0;
  const qrUrl = (() => {
    const params = new URLSearchParams({
      data: phoneUrl,
      margin: "12",
      size: "260x260",
    });

    return `${qrCodeEndpoint}?${params.toString()}`;
  })();

  useEffect(() => {
    let active = true;

    async function loadGame() {
      try {
        const result = await fetchGame(roomId);

        if (active) {
          setGame(result.game || null);
          setPlayers(result.players || []);
          setStatus("Live.");
        }
      } catch (error) {
        if (active) {
          setStatus(error?.message || "Could not load Hangman game.");
        }
      }
    }

    loadGame();
    const intervalId = window.setInterval(loadGame, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [roomId]);

  async function handleStartGame(event) {
    event.preventDefault();

    if (!hasPlayerName) {
      setStatus("Enter your name before playing.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Starting Hangman...");

      const result = await postGameAction(roomId, {
        action: "start",
        name: cleanName,
        playerId,
        word,
      });

      window.localStorage.setItem("hangman-game-name", cleanName);
      setName(cleanName);
      setGame(result.game || null);
      setPlayers(result.players || []);
      setWord("");
      setShowWord(false);
      setStatus("Hangman started.");
    } catch (error) {
      setStatus(error?.message || "Could not start Hangman.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGuess(letter) {
    if (!hasPlayerName) {
      setStatus("Enter your name before playing.");
      return;
    }

    try {
      setBusy(true);
      setStatus(`Guessing ${letter}...`);

      const result = await postGameAction(roomId, {
        action: "guess",
        letter,
        name: cleanName,
        playerId,
      });

      window.localStorage.setItem("hangman-game-name", cleanName);
      setName(cleanName);
      setGame(result.game || null);
      setPlayers(result.players || []);
      setStatus("Guess sent.");
    } catch (error) {
      setStatus(error?.message || "Could not guess.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    try {
      setBusy(true);
      setStatus("Resetting Hangman...");

      const result = await postGameAction(roomId, {
        action: "reset",
        playerId,
      });

      setGame(result.game || null);
      setPlayers(result.players || []);
      setStatus("Hangman reset.");
    } catch (error) {
      setStatus(error?.message || "Could not reset Hangman.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    try {
      setBusy(true);
      setStatus("Refreshing...");

      const result = await fetchGame(roomId);

      setGame(result.game || null);
      setPlayers(result.players || []);
      setStatus("Live.");
    } catch (error) {
      setStatus(error?.message || "Could not refresh Hangman.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(phoneUrl);
    setStatus("Phone link copied.");
  }

  async function handleJoinGame() {
    if (!hasPlayerName) {
      setStatus("Enter your name before joining.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Joining...");

      const result = await postGameAction(roomId, {
        action: "join",
        name: cleanName,
        playerId,
      });

      window.localStorage.setItem("hangman-game-name", cleanName);
      setName(cleanName);
      setGame(result.game || null);
      setPlayers(result.players || []);
      setStatus("Joined game.");
    } catch (error) {
      setStatus(error?.message || "Could not join game.");
    } finally {
      setBusy(false);
    }
  }

  function openScreenOnlyView() {
    window.location.assign(getScreenUrl(roomId));
  }

  const phonePanel = (
    <div className="hangman-phone-card">
      <div className="hangman-phone-title">
        <span>
          <Gamepad2 size={18} strokeWidth={2.2} />
          Hangman Game
        </span>
        {game ? <small>{game.status}</small> : <small>set word</small>}
      </div>

      <div className="field">
        <label htmlFor="hangman-name">Name</label>
        <input
          id="hangman-name"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter your name"
          required
        />
      </div>

      <button className="button secondary" type="button" onClick={handleJoinGame} disabled={busy || !hasPlayerName}>
        <Smartphone size={17} strokeWidth={2.2} />
        <span>Join Game</span>
      </button>

      {!game ? (
        <form className="hangman-word-form" onSubmit={handleStartGame}>
          <label htmlFor="hangman-word">Set word</label>
          <div className="hangman-secret-row">
            <input
              id="hangman-word"
              maxLength={32}
              type={showWord ? "text" : "password"}
              value={word}
              onChange={(event) => setWord(event.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
              placeholder="Secret word"
              autoComplete="off"
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowWord((current) => !current)}
              aria-label={showWord ? "Hide word" : "Show word"}
              title={showWord ? "Hide word" : "Show word"}
            >
              {showWord ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button className="button secondary" type="submit" disabled={busy || !hasPlayerName || word.trim().length < 2}>
            <Gamepad2 size={17} strokeWidth={2.2} />
            <span>Start Game</span>
          </button>
        </form>
      ) : (
        <div className="hangman-guess-panel">
          {isPhoneView ? <HangmanBoard game={game} compact /> : null}
          <div className="hangman-word-preview" aria-label="Hangman word">
            {game.maskedWord?.map((letter, index) => (
              <span key={`${letter}-${index}`}>{letter}</span>
            ))}
          </div>
          <p>
            {isWordSetter
              ? "You set the word. Others can only see blanks."
              : `Word set by ${game.setterName || "Player"}.`}
          </p>
          <div className="hangman-letter-grid" aria-label="Guess letters">
            {availableLetters.map((letter) => (
              <button
                key={letter}
                type="button"
                disabled={busy || !hasPlayerName || game.status !== "playing" || correctGuessedLetters.includes(letter)}
                onClick={() => handleGuess(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
          {isWordSetter ? (
            <button className="button ghost" type="button" onClick={handleReset} disabled={busy}>
              <Trash2 size={16} strokeWidth={2.2} />
              <span>New Word</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );

  if (isPhoneView) {
    return (
      <section className="comment-phone-shell hangman-phone-shell">
        <div className="comment-phone-panel">
          <div className="comment-phone-header">
            <span className="comment-tool-icon hangman-tool-icon" aria-hidden="true">
              <Gamepad2 size={26} strokeWidth={2.1} />
            </span>
            <div>
              <p className="eyebrow">Hangman Game</p>
              <h1>Join Game</h1>
            </div>
          </div>

          {phonePanel}

          <div className="pdf-status" role="status">
            {status}
          </div>
        </div>
      </section>
    );
  }

  const boardPanel = (
    <Panel
      className="hangman-screen-panel"
      eyebrow="Game"
      title="Hangman"
      description={game ? `${game.wrongCount}/${game.maxWrongGuesses} wrong` : "Scan to start"}
    >
      {game ? (
        <HangmanBoard game={game} />
      ) : (
        <div className="comment-empty">
          <Gamepad2 size={46} strokeWidth={1.8} />
          <span>Scan QR and set a word</span>
        </div>
      )}
    </Panel>
  );

  if (isScreenOnlyView) {
    return (
      <section className="comment-tool comment-tool--screen-only hangman-tool">
        <div className="comment-stage comment-stage--screen-only">
          {boardPanel}
          <Panel eyebrow="Phone" title="Scan To Join" description={`Room ${roomId}`}>
            <div className="comment-qr-card">
              <img src={qrUrl} alt="Phone Hangman QR code" />
              <div className="comment-link-box">{phoneUrl}</div>
              <HangmanPlayersList players={players} />
            </div>
          </Panel>
        </div>
      </section>
    );
  }

  return (
    <section className="comment-tool hangman-tool">
      <div className="comment-stage">
        <Panel eyebrow="Phone" title="Scan To Join Hangman" description={`Room ${roomId}`}>
          <div className="comment-qr-card">
            <img src={qrUrl} alt="Phone Hangman QR code" />
            <div className="comment-link-box">{phoneUrl}</div>
            <HangmanPlayersList players={players} />
          </div>

          <div className="button-row wrap">
            <button className="button secondary" type="button" onClick={handleCopyLink}>
              <Copy size={16} strokeWidth={2.2} />
              <span>Copy Link</span>
            </button>
            <button className="button secondary" type="button" onClick={openScreenOnlyView}>
              <Expand size={16} strokeWidth={2.2} />
              <span>Full screen</span>
            </button>
            <button className="button ghost" type="button" onClick={handleRefresh} disabled={busy}>
              <RefreshCw size={16} strokeWidth={2.2} />
              <span>Refresh</span>
            </button>
          </div>
        </Panel>

        <div className="comment-side-stack">
          {boardPanel}
          <Panel eyebrow="Players" title="Phone Controls" description="Open the QR link on phones.">
            <div className="comment-live-header">
              <span>
                <Smartphone size={18} strokeWidth={2.2} />
                Phone
              </span>
              <span>{game?.status || "Waiting"}</span>
            </div>
            {phonePanel}
          </Panel>
        </div>
      </div>

      <div className="pdf-status" role="status">
        {busy ? "Working... " : null}
        {status}
      </div>
    </section>
  );
}

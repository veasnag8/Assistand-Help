# AI Support Studio

A browser-first React app for preparing branded QR payment cards.

## Local development

```bash
npm install
npm run dev
```

The Removal.AI and SNA GPT Gemini APIs run through Netlify functions so API keys
are not exposed in the browser. Set `REMOVAL_AI_API_KEY` and `GEMINI_API_KEY` in
Netlify environment variables before deploying. `GEMINI_MODEL` is optional and
defaults to `gemini-2.5-flash`. Set `SNA_GPT_FALLBACK_MODELS` to a
comma-separated list to let SNA GPT retry text-only chats with fallback models
when the primary Gemini model reaches a quota or rate limit. For local API
testing, create `.env` from `.env.example` and run the app with Netlify CLI, for
example `npx netlify-cli dev`. Set
`VITE_SNA_GPT_DAILY_TOKEN_LIMIT` and
`VITE_SNA_GPT_DAILY_MESSAGE_LIMIT` to show estimated remaining daily usage in
the SNA GPT sidebar. The default fallback model is `gemini-2.5-flash-lite`.

## Local video downloader

The Video Download tool can run locally without Cobalt by using the included
Node server, `yt-dlp`, and `ffmpeg-static`.

Install `yt-dlp` once:

```bash
python -m pip install -U yt-dlp
```

Then run the app and local video server together:

```bash
npm run dev:all
```

The app defaults to `VITE_VIDEO_SERVER_URL=http://127.0.0.1:5454`. If `yt-dlp`
is installed somewhere custom, set `YTDLP_PATH` in `.env`.

When deploying the app with the Node video backend, set the frontend to call the
backend URL instead of the Netlify function:

```bash
VITE_VIDEO_SERVER_URL=https://your-node-video-backend.example.com
```

On the Node video backend host, YouTube may require a JavaScript runtime and
signed-in cookies. The video server passes Node to yt-dlp by default for
YouTube and enables yt-dlp's recommended remote EJS challenge component by
default. For local development, set this in `.env` and restart `npm run dev:all`:

```bash
YTDLP_COOKIES_FROM_BROWSER=chrome
```

For hosted Node backends without a browser profile, export YouTube cookies as a
Netscape cookies file, base64 encode that file, and set:

```bash
YTDLP_COOKIES_BASE64=base64_encoded_cookies_txt
```

On Render, the YouTube-related backend variables should include:

```bash
YTDLP_JS_RUNTIMES=node
YTDLP_REMOTE_COMPONENTS=ejs:github
YTDLP_COOKIES_BASE64=base64_encoded_cookies_txt
```

Use only cookies from an account and media you are authorized to access.

For production, keep video downloads behind your own server or an authorized
Cobalt-compatible API instance. Public hosted Cobalt APIs are not intended for
other projects without permission.

## Production build

```bash
npm run build
```

## Netlify

This repo includes `netlify.toml`, so Netlify can use:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

## Notes

- Image tools are browser-first, with Removal.AI background removal proxied by a
  Netlify function when `REMOVAL_AI_API_KEY` is configured
- SNA GPT answers creator questions with "I was created by Song Veasna."
- Video downloads are for media the user owns or has permission to download.
  Local testing uses `server/video-download-server.js`.
- QR exports are saved as PNG files at 631 x 892 pixels

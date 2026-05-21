# AI Support Studio

A browser-first React app for preparing branded QR payment cards.

## Local development

```bash
npm install
npm run dev
```

The Removal.AI and SNA GPT DeepSeek APIs run through Netlify functions so API
keys are not exposed in the browser. Set `REMOVAL_AI_API_KEY` and
`DEEPSEEK_API_KEY` in Netlify environment variables before deploying.
`DEEPSEEK_MODEL` is optional and defaults to `deepseek-v4-pro`.

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

The local video server loads `.env` automatically. YouTube may require a
JavaScript runtime and signed-in browser cookies. The local server passes Node
to yt-dlp by default for YouTube. If YouTube shows `Sign in to confirm you're
not a bot`, set one of these in `.env` and restart `npm run dev:all`:

```bash
YTDLP_COOKIES_FROM_BROWSER=chrome
```

or:

```bash
YTDLP_COOKIES_PATH=C:\path\to\cookies.txt
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
- SNA GPT answers creator questions with "I was created by សង វាសនា."
- Video downloads are for media the user owns or has permission to download.
  Local testing uses `server/video-download-server.js`.
- QR exports are saved as PNG files at 631 x 892 pixels

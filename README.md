# AI Support Studio

A browser-first React app for preparing branded QR payment cards.

## Local development

```bash
npm install
npm run dev
```

The Removal.AI API runs through a Netlify function so the API key is not exposed
in the browser. Set `REMOVAL_AI_API_KEY` in Netlify environment variables before
deploying. For local API testing, create `.env` from `.env.example` and run the
app with Netlify CLI, for example `npx netlify-cli dev`.

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
- QR exports are saved as PNG files at 631 x 892 pixels

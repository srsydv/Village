# Aurea

Private AI travel concierge. Ask for destinations, expenses, hotels, visas, packing, and day-by-day plans before you fly. Powered by Google Gemini.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Run locally

1. Put your Gemini key in `.env` (never commit it):

```
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
PORT=3001
```

2. Install and start:

```bash
npm install
npm run dev
```

The Vite client proxies `/api` to the Express server on port 3001. The key stays on the server.

## What the app does

- **Ask** — short concierge questions
- **Plan** — itinerary first, then optional stays / food / sights
- **Trips** — saved on the device; share as text

Map data © OpenStreetMap contributors. Weather: Open-Meteo. Booking.com, Airbnb, and Zomato open as partner sites — Aurea does not take hotel payment. Visa steps are information only; you apply yourself.

## Test APK (not Play)

```bash
npm run apk
```

Writes `release/Aurea-testing.apk`. Debug only. Do not upload it to Play.

## Google Play

Host the Node app on HTTPS (see `Dockerfile`), keep `GEMINI_API_KEY` only on the server, then:

```bash
# in .env: PUBLIC_APP_URL=https://your-domain
npm run play:key    # once — back up android/aurea-upload.jks
npm run play        # writes release/Aurea-play.aab
```

Privacy policy for the Console: `https://your-domain/privacy.html`

Full checklist: [PLAY_STORE.md](PLAY_STORE.md). Listing images: `store/play-icon-512.png`, `store/play-feature-1024x500.png`.

## Stack

- Frontend: Vite + React + Tailwind
- Backend: Node.js + Express
- Model: Google Gemini (`x-goog-api-key`)
- Storage: device `localStorage` for profile, chats, and trips

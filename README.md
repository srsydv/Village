# Aurea

Private AI travel concierge. Ask for destinations, expenses, hotels, visas, packing, and day-by-day plans before you fly. Powered by Google Gemini.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Run locally

1. Put your Gemini key in `.env` (never commit it):

```
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-flash-latest
PORT=3001
```

2. Install and start:

```bash
npm install
npm run dev
```

The Vite client proxies `/api` to the Express server on port 3001. The key stays on the server and is never shipped to the phone.

## What the app does

- **Ask** — free-form concierge chat (destinations, budgets, hotels, visas, packing)
- **Plan** — structured itinerary with expense split and hotel tiers
- **Explore** — curated places; tap any city to start a brief
- **Trips** — saved plans on the device

## Play Store

Aurea is a mobile-first PWA (`standalone` display, portrait, dark theme). To publish on Google Play:

1. Host the API (`npm run build && npm start`) on a public HTTPS host and keep `GEMINI_API_KEY` in the server environment.
2. Point Capacitor at that host, or serve the built client from the same origin.
3. Install Android tooling, then:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync
npx cap open android
```

4. In Play Console, use package `com.aurea.travel`, 512×512 icon, feature graphic, and a public privacy policy URL (the in-app page is `/privacy`).
5. Restrict the Gemini key to your backend IPs / HTTP referrers. Do not embed the key in the Android APK.

## Stack

- Frontend: Vite + React + Tailwind
- Backend: Node.js + Express
- Model: Google Gemini (`x-goog-api-key`)
- Storage: device `localStorage` for profile, chats, and trips

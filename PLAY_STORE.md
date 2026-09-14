# Play Store (Aurea)

The Android project is Play-shaped. Google still needs a **live HTTPS host**, a **Developer account**, and a **manual Console upload**. This repo cannot click “Publish” for you.

Package: `com.aurea.travel`  
Version: `1.0.0` (versionCode 1)

## 1. Host the API (required)

The Play app must **not** contain `GEMINI_API_KEY`. Deploy this repo (Docker) and set:

```
NODE_ENV=production
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
PUBLIC_APP_URL=https://YOUR-DOMAIN
CORS_ORIGINS=https://YOUR-DOMAIN
PORT=3001
```

Then set the same `PUBLIC_APP_URL` in local `.env` before `npm run play`.

Privacy policy URL to paste in Play Console:

`https://YOUR-DOMAIN/privacy.html`

(also served in-app at `/privacy`)

## 2. Upload key (once)

```bash
npm run play:key
```

Back up `android/aurea-upload.jks` and `android/keystore.properties`. Never commit them. Enroll in **Play App Signing** and upload this as the upload key.

## 3. Build the bundle

```bash
npm run play
```

Output: `release/Aurea-play.aab`  
Upload that file. Do not upload `Aurea-testing.apk` (debug, and it may embed a key).

## 4. Play Console listing

- App name: Aurea
- Short description: Private AI travel plans — visa steps, INR budgets, day-by-day. You apply for visas yourself.
- Graphics: `store/play-icon.png` (512×512) and `store/play-feature.png` (feature graphic). Phone screenshots: capture the running app.
- Category: Travel
- Email: your support Gmail
- Privacy policy: the `/privacy.html` URL
- Content rating: IARC questionnaire. Not for under 13. No user-generated public feed.
- Target audience: 18+ is safest (travel purchases off-app).

## 5. Data safety (fill exactly)

Collected / shared:

- **App activity / chat text** — sent to Google Gemini to generate answers. Not sold. Not used for ads.
- **Location** — not collected as GPS. Destination names you type are sent to OpenStreetMap and Open-Meteo.
- **Financial info** — not collected. Hotel booking happens on Booking.com / Airbnb.
- **Account** — none.

Encryption in transit: yes (HTTPS). Users can delete data by clearing app storage or uninstalling.

## 6. Internal testing first

Create an internal testing track, add your Gmail, install from Play, and confirm Ask + Plan work on a phone with **no** debug APK.

## 7. What this repo still cannot do

- Pay the Play one-time developer fee
- Create your Google Cloud / Railway account
- Buy a domain or TLS certificate
- Pass review if Gemini is down or Nominatim blocks you

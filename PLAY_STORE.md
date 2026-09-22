# Play Store (Safar)

Package: `com.safar.travel`  
Version: `1.0.0` (versionCode 1)

**Step-by-step Console upload:** [PLAY_UPLOAD.md](PLAY_UPLOAD.md)

The Android project is Play-shaped. You still upload the bundle in Play Console yourself.

## Before you upload

1. **Redeploy the server** so `https://your-host/privacy.html` says Safar and Delete account. The Play app calls this host. Do not put `GEMINI_API_KEY` in the Android bundle.
2. Create the upload key once, then back it up:

```bash
npm run play:key
```

3. Build the signed bundle (needs `PUBLIC_APP_URL=https://…` in `.env`):

```bash
npm run play
```

Output: `release/Safar-play.aab`

## Listing copy

Use `store/listing.txt`.

- App name: Safar
- Graphics: `store/play-icon-512.png` and `store/play-feature-1024x500.png`
- Phone screenshots: `store/screenshots/`
- Category: Travel
- Privacy policy: `https://YOUR_HOST/privacy.html`
- Content rating: IARC. Not for under 13. Target 18+.

## Data safety (fill exactly)

Google Sign-In is **required**.

- **App activity / chat text** — sent to Google Gemini. Chats and plan searches (destination, dates, travelers, budget) are stored so the product can reload and so the operator can review activity. Plan searches are kept up to 90 days even if the trip is not saved. Not sold. Not used for ads.
- **Location** — not collected as GPS. Destination names are sent to OpenStreetMap and Open-Meteo.
- **Financial info** — not collected. Hotel booking happens on Booking.com / Airbnb.
- **Account** — Google Sign-In. Name, email, and profile photo from Google, plus chats and trips. Users can delete the account in Profile. Not sold. Not used for ads.

Encryption in transit: yes (HTTPS).

## Internal testing first

Create an internal testing track, add your Gmail, install from Play, and confirm Ask + Plan on a phone with **no** debug APK.

## What this repo cannot do

- Pay the Play developer fee
- Click Publish in Play Console
- Redeploy Render / Railway for you

# How to upload Safar to Google Play

Follow this in order. The app is already built. You are only using Play Console.

Package: `com.safar.travel`  
Version: `1.0.0` (versionCode 1)  
Signed bundle: `release/Safar-play.aab`

Do **not** upload `release/Safar-testing.apk`. That is a debug APK.

---

## 0. Before you open Play Console

1. Redeploy the server so the live privacy page is Safar. Reviewers will open it.
2. Confirm this URL loads in a browser (replace with your host if you changed it):

   `https://aurea-jrvb.onrender.com/privacy.html`

3. Back up these two files somewhere private (Drive, password manager, USB). If you lose them you cannot update this Play listing:

   - `android/safar-upload.jks`
   - `android/keystore.properties`

4. Confirm `release/Safar-play.aab` exists on this machine.

---

## 1. Open a Play developer account

1. Go to [https://play.google.com/console](https://play.google.com/console)
2. Sign in with the Google account you want as the publisher
3. If you have never published: pay the one-time **$25** registration fee and accept the developer agreement
4. Complete the **Account details** (developer name, email, address, phone). Developer name can be your name or “Safar”

Wait until Google says the account is active. New accounts can take a few hours.

---

## 2. Create the app

1. In Play Console click **Create app**
2. Fill:

   | Field | Value |
   | --- | --- |
   | App name | Safar |
   | Default language | English (United States) |
   | App or game | App |
   | Free or paid | Free |
   | Declarations | Tick the policies you agree with |

3. Click **Create app**

This listing is new. Package `com.safar.travel` will not update an old Aurea app.

---

## 3. Store listing

Left menu: **Grow users → Store presence → Main store listing** (wording may be **Store listings**).

### Text

Copy from `store/listing.txt`.

| Field | Paste this |
| --- | --- |
| App name | Safar |
| Short description | Private AI travel plans — visas, INR budgets, day-by-day. You file visas yourself. |
| Full description | The “Full description” block in `store/listing.txt` |

Category: **Travel**

### Graphics

Upload these exact files:

| Play field | File | Size |
| --- | --- | --- |
| App icon | `store/play-icon-512.png` | 512 × 512 |
| Feature graphic | `store/play-feature-1024x500.png` | 1024 × 500 |
| Phone screenshots (need at least 2) | `store/screenshots/01-home.png` | Home |
| | `store/screenshots/02-plan.png` | Plan |
| | `store/screenshots/03-trips.png` | Trips |
| | `store/screenshots/04-ask.png` | Ask |
| | `store/screenshots/05-profile.png` | Profile |

Upload all five screenshots. Skip tablet / TV / Wear unless you later add those assets.

Click **Save**.

---

## 4. Privacy policy

Left menu: **Policy → App content → Privacy policy** (or the dashboard card **Set privacy policy**).

Paste:

`https://aurea-jrvb.onrender.com/privacy.html`

The page must load without login. If you later move the host, change this URL here and rebuild the AAB with the new `PUBLIC_APP_URL`.

---

## 5. App content questionnaires

Finish every card under **Policy → App content**. Use these answers.

### Ads

**No.** Safar does not show ads.

### App access

**All functionality is available without special access.**  
Google Sign-In is required for every user. Do not mark it as a restricted login. Play testers will use their own Google accounts.

### Content ratings (IARC)

1. Start the questionnaire
2. Category: **Travel** / utility, not a game
3. No violence, no sexual content, no drugs
4. User-generated content: **No** (chats are private, not a public feed)
5. Shares location: **No** (destination names only, not GPS)
6. Unrestricted internet: **Yes** (opens Booking, Maps, official visa sites)

When the rating is issued, set **Target age** to **18+**. Do not target children. Not for under 13.

### Target audience

- Age: **18 and over**
- Appeal to children: **No**

### News / COVID / Data safety / Government

- News app: **No**
- COVID: **No**
- Government app: **No**
- Data safety: fill as in the next section

### Financial features

Safar does not take payment. Hotel links open Booking.com / Airbnb. Choose **No** for in-app payments and financial services unless the form only asks whether you *link* to booking sites — then describe that users leave the app to book.

---

## 6. Data safety

**Policy → App content → Data safety.**

Overview:

- Collects user data: **Yes**
- Encrypted in transit: **Yes**
- Users can request deletion: **Yes** (Profile → Delete account)

### Data you collect

| Type | Collected? | How to describe it |
| --- | --- | --- |
| Name | Yes | From Google Sign-In |
| Email | Yes | From Google Sign-In |
| User IDs | Yes | Google account id |
| Photos | Yes (optional) | Google profile photo |
| App interactions / other user content | Yes | Ask chat text and Plan fields (destination, dates, travelers, budget) |
| Location | No GPS | Do **not** tick Approximate or Precise location |
| Financial info | No | Booking happens on partner sites |
| Photos/videos the user uploads | No | Only the Google avatar if present |

### For each collected type

- Collected: **Yes**
- Shared: **Yes** for chat/plan text (sent to Google Gemini). **No** for selling data
- Required or optional: **Required** (Sign-In is required)
- Purpose: **App functionality**
- Sold: **No**
- Used for ads / ads personalization: **No**
- Ephemeral: **No** (chats and trips are stored until the user deletes the account). Plan searches may be kept up to 90 days even if the trip is not saved

### Deletion

Users delete the account in **Profile → Delete account**. That is enough for Play’s “in-app deletion” question.

---

## 7. Upload the bundle (internal testing first)

Do not send version 1 straight to Production.

1. Left menu: **Test and release → Testing → Internal testing**
2. Click **Create new release**
3. If asked to accept Play App Signing, accept it. Google will keep the app-signing key. You keep the upload key (`safar-upload.jks`)
4. Upload `release/Safar-play.aab`
5. Release name: `1.0.0`
6. Release notes (English):

   ```
   First release of Safar. Ask travel questions, generate a day-by-day plan, and save trips on any phone you sign in with.
   ```

7. Save → **Review release** → **Start rollout to Internal testing**

If Play rejects the AAB, the error is usually signing, `versionCode`, or a missing privacy URL. Do not upload the APK instead.

---

## 8. Add yourself as a tester

1. On Internal testing, open the **Testers** tab
2. Create an email list (e.g. “Safar team”)
3. Add your Gmail (the one signed into Play Store on your phone)
4. Save
5. Copy the **join on the web** link
6. Open that link on your phone, accept the test, then install **Safar** from the Play Store listing (it may say “Internal test”)

On the phone:

- Sign in with Google
- Ask a visa or budget question
- Generate a plan
- Save a trip
- Open Profile and confirm **Delete account** is there (do not delete unless you want to)

If Ask or Plan fail, the live server is down or `PUBLIC_APP_URL` in the AAB does not match the deployed host. Fix the server first; do not publish.

---

## 9. Countries, pricing, and production

When the internal install works:

1. **Test and release → Production → Countries/regions** — select where you want to be listed (India plus any others)
2. **Monetization → Free** — already free
3. **Test and release → Production → Create new release**
4. Promote the same `1.0.0` AAB from Internal testing, or upload `release/Safar-play.aab` again
5. Same release notes as above
6. Review the dashboard. Every required task should show a green check
7. Click **Send for review** / **Start rollout to Production**

Review often takes a few days. Watch email on the developer account.

---

## 10. After it is live

- Share the Play Store link (Play Console → Store listing → “View on Google Play”)
- Do not delete `android/safar-upload.jks`
- For the next version: bump `versionCode` and `versionName` in `android/app/build.gradle`, run `npm run play`, upload the new AAB to Production

---

## Files you will upload (checklist)

- [ ] `release/Safar-play.aab`
- [ ] `store/play-icon-512.png`
- [ ] `store/play-feature-1024x500.png`
- [ ] `store/screenshots/01-home.png`
- [ ] `store/screenshots/02-plan.png`
- [ ] `store/screenshots/03-trips.png`
- [ ] `store/screenshots/04-ask.png`
- [ ] `store/screenshots/05-profile.png`
- [ ] Privacy URL live: `https://aurea-jrvb.onrender.com/privacy.html`
- [ ] Listing text from `store/listing.txt`

---

## What this repo cannot do for you

- Pay the $25 Play fee
- Click Create app / Upload / Publish
- Redeploy Render
- Recover a lost upload keystore

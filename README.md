# Village — समूह (Samooh)

Offline-first digital ledger for village Self-Help Groups (SHGs). This is a **transparent notebook**, not a bank, wallet, or payments product.

A facilitator can create a group, add members with icons, record weekly savings and loans, hear Hindi audio confirmation, and keep working when the network drops. Entries save on the phone and sync when coverage returns.

**Full guidebook:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

## User guidebook

समूह records cash that already changed hands in the meeting. It does not send money.

### Create or join a group

1. Open the app at [http://127.0.0.1:5173](http://127.0.0.1:5173) (or your deployed URL).
2. **नया समूह** — enter group name, optional village, and a 4-digit PIN. Tap **समूह बनाएं**. Note the 6-character **group code** on the home screen.
3. **जुड़ें** (second phone) — enter that code and the same PIN, then **अंदर जाएं**.

Share the code and PIN only with people who already keep the paper register.

### Weekly meeting

1. **समूह** → **+ जोड़ें** — name + picture icon, then **सहेजें** (needs internet).
2. **जमा** (or the home tiles) — pick type, keypad amount, tap the member, **सहेजें और सुनें**.
   - Green **जमा** = savings
   - Orange **कर्ज़ दिया** = loan given
   - Blue **कर्ज़ चुकाया** = loan repaid
3. The phone speaks Hindi (example: *सीता ने 200 रुपये जमा किए*).
4. **घर** shows cash on hand, total savings, and loans still due.
5. **खाता** is the full ledger. Tap **सिंक** if a yellow badge says entries are still on the phone.

### Offline

Savings and loan entries work with no network. A dark bar means offline; a yellow bar means pending uploads. Tap the bar or **सिंक** when coverage returns. Adding a new member still needs internet.

### Install and sign out

If **ऐप होम स्क्रीन पर लगाएं** appears, tap **इंस्टॉल** (or Chrome → Add to Home screen). **बाहर** on home signs out; you will need the code and PIN again.

Troubleshooting, safety notes, and screen-by-screen detail: [User Guide](docs/USER_GUIDE.md).

## Stack

- **Frontend:** Vite + React (JavaScript) at `client/`
- **Backend:** Node.js + Express (JavaScript) at `server/`
- **Data:** `.data/samooh.json` by default, or MongoDB when `MONGODB_URI` is set

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` to the Express server on port 3001.

Without `MONGODB_URI`, the API stores data in `.data/samooh.json` (gitignored). To use MongoDB:

```bash
cp .env.example .env
# set MONGODB_URI and SESSION_SECRET
```

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Group home: cash on hand, savings, loans |
| `/group` | Member grid + add member |
| `/entry` | Amount keypad + save / loan / repay |
| `/history` | Ledger with pending-sync badge |

## Out of scope (v1)

UPI/wallets, credit scoring, NRLM government sync, dialects beyond Hindi, SMS/Bluetooth mesh.

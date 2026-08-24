# Village

Rural toolkit with two apps:

- **समूह (Samooh)** — SHG digital ledger (savings, loans, Hindi confirmations). A notebook, not a bank.
- **ग्रामसेवा (GramSeva)** — village trades directory and micro-job board, with offline save and SMS / share to neighbors.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) and pick one. **Full guidebook:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

## User guidebook

### Village home

Two large tiles: **समूह** and **ग्रामसेवा**. Each has its own PIN and 6-character code.

### समूह (savings group)

1. **नया समूह** — name, optional village, 4-digit PIN → **समूह बनाएं**.
2. **समूह** → **+ जोड़ें** — member name + icon (**सहेजें** needs internet).
3. **जमा** — type (जमा / कर्ज़ दिया / कर्ज़ चुकाया), keypad, member, **सहेजें और सुनें**.
4. **घर** shows cash on hand. **खाता** is the ledger. Yellow badge = unsynced (works offline).

### ग्रामसेवा (local services)

1. **नया गाँव** — village name + PIN. Share the **गाँव कोड**.
2. **लोग** — add मिस्त्री / बिजली / नल / राजमिस्त्री / मजदूर / दर्जी / ट्रैक्टर. **कॉल** or **SMS**.
3. **माँग** — pick a skill icon, your name, optional wage. **सहेजें और सुनें**, or **सहेजें + SMS / शेयर** to reach a neighbor with no data (SMS) or Android Nearby Share.
4. **काम** — open jobs, **काम लें**, **हो गया**.

Workers and jobs save on the phone first and sync when the network returns.

Troubleshooting and safety: [User Guide](docs/USER_GUIDE.md).

## Stack

- **Frontend:** Vite + React (JavaScript) at `client/`
- **Backend:** Node.js + Express (JavaScript) at `server/`
- **Data:** `.data/samooh.json` and `.data/gramseva.json`, or MongoDB when `MONGODB_URI` is set

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` to Express on port 3001.

```bash
cp .env.example .env
# optional: set MONGODB_URI and SESSION_SECRET
```

## Screens

| Route | App | Purpose |
| --- | --- | --- |
| `/` | Hub | Choose समूह or ग्रामसेवा |
| `/samooh` | समूह | Cash on hand, savings, loans |
| `/samooh/group` | समूह | Members |
| `/samooh/entry` | समूह | Record money |
| `/samooh/history` | समूह | Ledger |
| `/seva` | ग्रामसेवा | Village home |
| `/seva/directory` | ग्रामसेवा | Mechanic / labor directory |
| `/seva/jobs` | ग्रामसेवा | Job bulletin board |
| `/seva/post` | ग्रामसेवा | New help request |

## Out of scope (v1)

UPI/wallets, credit scoring, NRLM sync, dialects beyond Hindi, native Bluetooth/SMS mesh (phone SMS and Share sheet are used instead).

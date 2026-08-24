# Village

Hyper-local **समाचार (News)** for rural communities: email/password accounts, PIN/GPS village onboarding, official district feed (in-app reader), village UGC posts (photo/video/voice), likes/comments, Socket.io village alerts and chat.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). **Full guidebook:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

## How to use

1. **खाता बनाएं** with name, **email**, **password**, and **6-digit PIN code** (e.g. `276404`) or **GPS**.
2. App looks up state/district/post offices via `api.postalpincode.in`, then you confirm **गाँव का नाम**. Later visits: **लॉगिन** with email + password only.
3. **सरकारी** — district/state/India.gov notices + in-app reader (no external browser).
4. **घर / लिखें** — village feed; post text + camera/video/voice; auto-tagged to village + PIN.
5. Likes, text/audio comments; top banner when neighbors post (WebSocket).
6. **बात** — village group chat or 1:1 with people in the same village.

## Stack

- **Frontend:** Vite + React (JavaScript) — camera/mic via browser APIs (PWA)
- **Backend:** Node.js + Express + Socket.io
- **Database:** MongoDB when `MONGODB_URI` is set (else `.data/*.json`)
- **Media:** local `.data/uploads/news/` (swap to S3/Cloudinary later)
- **Address:** Indian Postal PIN API + OpenStreetMap Nominatim reverse geocode

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api`, `/uploads`, and `/socket.io` to port 3001.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Redirects to `/news` |
| `/news` | Village UGC feed |
| `/news/official` | Official / PIN feed |
| `/news/compose` | Citizen reporter |
| `/news/chat` | Village / DM chat |

## Out of scope (v1)

UPI, NRLM sync, native Bluetooth mesh, Cloudinary/S3 (disk uploads today), dialects beyond Hindi UI.

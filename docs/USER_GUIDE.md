# Village User Guide

Village is a hyper-local **समाचार** app for rural communities. It works best in Chrome on Android.

**Open:** [http://127.0.0.1:5173](http://127.0.0.1:5173) (goes to समाचार).

For villages such as **नूरपुर सरैहजी**, Post **मुबारकपुर**, Dist **आज़मगढ़**, PIN **276404**.

## Onboarding

1. Open the app.
2. **खाता बनाएं:** name, **email**, **password** (6+ characters), and a **6-digit PIN code**, or tap **GPS से पता लगाएं**.
3. The app fills **state / district / post offices** from the India Post PIN API.
4. Confirm or type your **गाँव का नाम**.
5. Next time tap **लॉगिन** and enter only email + password. Use **बाहर** to sign out.

## सरकारी (official)

- Notices for your PIN/district.
- Buttons open **जिला NIC / राज्य / भारत सरकार / PIB** inside an **in-app reader** (iframe + text excerpt). You stay in Village; you are not sent to an external browser tab as the primary path.

## गाँव की खबर (UGC)

1. **लिखें** — text, camera/video, or voice note.
2. Post is tagged with your village + PIN.
3. Neighbors online get a live banner (WebSocket).
4. **♥** like, **टिप्पणी** text or voice reply.

## बात (chat)

- Default room is the whole village.
- Chips list other people who registered in the same village for **1:1** chat.
- Text or voice messages over WebSocket.

## What this app does not do

- Pay or receive money (no UPI, no bank transfer)
- Score credit or decide who gets a loan
- Connect to government NRLM systems
- Speak languages other than Hindi (v1)
- Direct Bluetooth/SMS mesh between two Village installs (use the phone’s SMS or Share sheet instead)

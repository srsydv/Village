# Safar affiliate partners

How Safar earns when someone books a room, flight, bus, train, tour, or eSIM through the app. Safar does not charge the traveler and does not take the hotel or ticket payment. The booking site pays Safar a commission after the trip actually happens.

Read this before applying. Programs approve a live website. A test APK on your phone is not enough.

## How the money works

1. You join a partner program. It is free.
2. They give you a tracking link, or a short ID to add to the URL.
3. Safar opens that URL when someone taps **See stays**, **Book stay**, **See fare**, or the same kind of button.
4. If that person completes the booking, the program adds a commission to your dashboard.
5. They pay your bank after their minimum and after the stay, flight, or ticket is finished. A cancellation pays nothing.

The commission follows the traveler. Someone in Delhi who books a hotel in Lisbon through your Booking.com link still counts, as long as that program allows the country. Some Indian campaigns pay only for bookings made in India. Those limits are on each campaign page.

You do not set the percentage. Each program publishes it, or shows it inside the dashboard after approval. Rates, cookies, and payout minimums change. Re-open the program page on the day you apply.

A cookie is how long they remember your click. If the cookie is 1 day, they must book the next day. If it is 30 days, a booking three weeks later can still be yours.

## Before anyone will approve you

Do these once. Every program below asks for the same things.

1. Host Safar on HTTPS. The Play upload notes call this `PUBLIC_APP_URL`. Use that exact address on every application.
2. Keep the privacy policy on that domain (`/privacy`).
3. Add this sentence to the privacy policy and under the booking buttons: “Safar may earn a commission if you book through these links. The price you pay is the same.”
4. Have a bank account in your name. Indian networks also ask for PAN. Report the income as your own.
5. Describe Safar as a travel-planning app that links to live prices. Coupon sites, cashback sites, and brand-name ads are disallowed by most of these programs.

If a program rejects you for low traffic, leave the plain links in the app, get real travelers using them, and apply again.

## Apply in this order

Three accounts cover almost every link already in the app. Open them in this order so you are not filling ten forms in one day.

| Order | Account | What it unlocks | Apply |
| --- | --- | --- | --- |
| 1 | CJ | Booking.com stays. This is the link Safar already uses most. | [CJ Booking.com signup](https://www.cj.com/en-gb/publisher/partners/booking.com). Choose **APAC** if most travelers are in India. |
| 2 | Cuelinks | Indian hotels, flights, and redBus. One login, many brands. | [cuelinks.com](https://www.cuelinks.com/) |
| 3 | The brand’s own form | Agoda stays, Kayak flights, Viator and GetYourGuide tours, Trip.com, Airalo eSIM | Links in the sections below |

Skyscanner and Airalo both run on Impact. Create the Impact publisher account when you apply to the first of those two, then reuse it.

## Rooms

These are the highest commissions. One finished hotel stay is worth more than a pile of ad views.

### Booking.com — do this first

Safar already opens Booking.com from **See stays** and **Book stay**. Join through CJ, not a form on Booking.com. Official page: [CJ Booking.com affiliate programme](https://www.cj.com/en-gb/publisher/partners/booking.com).

Their page states the starting rates. The dashboard can change yours later if volume grows.

| Completed booking | Starting commission |
| --- | --- |
| Accommodation stay | 4% |
| Car rental | 6% |
| Attraction | 4% |
| Flight | £2 or €2 per flight |
| Taxi | 4% |

A ₹20,000 stay at 4% is ₹800. They pay when the stay is completed. A cancellation pays nothing.

The cookie is the browser session. They pay only if the traveler finishes the booking in the same browser visit that opened from Safar. A link they save and use tomorrow does not count. [Their FAQ](https://www.cj.com/en-gb/publisher/partners/booking.com) calls this session-based.

They accept a website or blog. A social profile alone is rejected. Listing fake Booking.com voucher codes gets you removed. They do not give voucher codes.

**Steps**

1. Put Safar on HTTPS first, with `/privacy` loading on that same domain. Have the commission sentence in the privacy policy.
2. Open the [CJ Booking.com page](https://www.cj.com/en-gb/publisher/partners/booking.com).
3. Under **Where’s Your Audience?**, choose **APAC**. India is in that list. Pick the region where the travelers are, which for Safar is India.
4. Create a CJ publisher account, or sign in if you already have one. Use your own name, email, and bank country.
5. Give them the live Safar URL, the privacy URL, and this description: “Safar is a travel-planning app. The traveler gets a day-by-day plan, then opens Booking.com for the live stay price. We do not take payment. We disclose that we may earn a commission.”
6. Submit the Booking.com application for APAC. Approval is a review, not instant.
7. Sign in at [cj.com](https://www.cj.com/) later and check the partnership status. They also email you.
8. After it shows approved, open CJ’s deep-link tool. Paste a Safar Booking.com search URL in, copy the tracking URL they return, and send it over so it can go into `staySearchUrl` in `client/src/lib/stays.js` and the `booking` URL in `placeLinks` in `client/src/lib/links.js`.

An old `aid=` from Booking.com’s closed direct program does not pay. Only the CJ tracking link does.

### Agoda — strong for Asia

- Apply: [partners.agoda.com](https://partners.agoda.com/)
- Pays on: completed stays. Agoda’s own page lists about 4% below 50 bookings in a month, 4.5% from 50 to 299, and 5% above that. Confirm those tiers on the page.
- Code: there is no Agoda button yet. Add one beside Booking.com in `placeLinks` and `staySearchUrl` after you are approved, using the link format Agoda gives you.

### MakeMyTrip and Goibibo hotels — India

Apply from your Cuelinks dashboard. Search the campaign by name. As of October 2026 the public pages showed ceilings, not guaranteed amounts:

| Campaign | Page | Ceiling shown |
| --- | --- | --- |
| Goibibo hotels | [cuelinks.com/campaigns/goibibo-affiliate-program](https://www.cuelinks.com/campaigns/goibibo-affiliate-program) | up to ₹252 per completed booking |
| MakeMyTrip hotels | [cuelinks.com/campaigns/makemytrip-homestays-affiliate-program](https://www.cuelinks.com/campaigns/makemytrip-homestays-affiliate-program) | up to ₹135 per completed domestic hotel booking |

Cookie on those two listings was 30 days. Tracking was marked offline, which means the sale can take weeks to appear. Open the page again before you count on the rupee amount. Campaigns pause without notice.

Code: flight links for these brands already exist in `client/src/lib/transport.js`. Hotel links do not. Add a hotel URL only for a campaign that is live and that allows in-app links.

### Airbnb

Airbnb’s Associates program ended on 31 March 2021. The **Airbnb** button can stay, because travelers use it. It will not pay you. Their notice is on [Airbnb’s help page](https://www.airbnb.ae/help/article/2646).

## Flights

Flight commission is usually a fixed fee per ticket, smaller than a hotel percentage. Still worth wiring once the hotel links are live.

| Brand in Safar | Where to apply | What to expect |
| --- | --- | --- |
| Skyscanner | [partners.skyscanner.net](https://www.partners.skyscanner.net/product/affiliates) (they send you to Impact) | Commission on flights, hotels, and cars referred through your partner link. They email you if you are accepted. |
| Kayak | [affiliates.kayak.com](https://affiliates.kayak.com/) | Apply with the Safar URL and a short note that the app links to a Kayak fare search. |
| Cleartrip | Cuelinks, [cleartrip campaign](https://www.cuelinks.com/campaigns/cleartrip-affiliate-program) | October 2026 page: up to ₹81 per domestic flight sale. Cookie listed as 1 day, so the traveler must book quickly. India only. |
| Goibibo, MakeMyTrip, Ixigo, Yatra | Cuelinks, search each name | Use the campaign only while it says it is active. The Yatra listing was paused in October 2026. Ixigo may have no open campaign; skip it until one appears. |

Google Flights is the primary fare button in `client/src/lib/transport.js`. Google does not pay a commission on that link. Leave it first so the traveler still sees a fare. Put the paying partner (Skyscanner or Kayak, then an Indian brand) as the next button, with your tracking URL.

## Trains and buses

| Brand in Safar | Partner program |
| --- | --- |
| redBus | Cuelinks, [red-bus campaign](https://www.cuelinks.com/campaigns/red-bus-affiliate-program). October 2026 page: up to ₹54 per sale, 7-day cookie, India. Read the coupon rules on that page before you ship the link. Some redBus offers pay only when a specific code is used. |
| Trip.com trains | [trip.com/partners](https://www.trip.com/partners/index). Their page advertises commission up to 7% across Trip.com bookings, including trains. This is the paying version of the China-rail button. |
| Omio, ConfirmTkt, RailYatri, Ixigo Trains, AbhiBus, FlixBus, 12Go, Rome2Rio | No public program is assumed here. Search the brand plus “affiliate” on the day you care. If they have a live campaign, wrap that URL the same way. If they do not, keep the plain link. |

These official railways do not pay an app affiliate. Keep them so the traveler can buy the real ticket: IRCTC, 12306, Amtrak, SNCF Connect, Deutsche Bahn, National Rail, Navitime.

## Food

Zomato search links do not pay a commission. There is no restaurant-booking program to join for the **Zomato** button in `placeLinks`. Leave the button. It makes the plan useful. It is not a revenue line.

Food-delivery coupon campaigns on affiliate networks are a different product. They are not this button.

## Sights, tours, and the extras that pay well

Safar lists sights, then opens a map. A **Book this** button on a sight is a new link, and these programs are built for it. Tours often pay a higher percent than flights.

| What the traveler buys | Apply | Published rate to confirm on the page |
| --- | --- | --- |
| Tours and tickets worldwide | [partner.getyourguide.com](https://partner.getyourguide.com/) | Guides put this near 8% of a completed experience. Read the live terms. |
| Tours and tickets, especially the Americas | [partnerresources.viator.com](https://partnerresources.viator.com/) | Viator states 8% on an experience booked within 30 days, paid after the experience is completed. No traffic minimum on their page. |
| Tours and tickets in Asia | [affiliate.klook.com](https://affiliate.klook.com/) | Confirm the current percent on signup. |
| Travel eSIM | [airalo.com affiliate program](https://www.airalo.com/m/resources/airalo-affiliate-program) via Impact | Airalo states up to 10% on a successful referral. |

Add the button only after that program approves you, on the sight card in `client/src/components/PlacePicker.jsx`. One partner per sight is enough. Viator or GetYourGuide covers most international trips. Klook is the one to prefer when the destination is in Asia.

Visa application sites and travel insurance can pay a referral fee later. Add them only when Safar has a real “apply” or “get insurance” button, and only with a program that publishes a partner signup. Until then, visa text stays information-only, which is what the privacy policy already says.

## Where each link is built

| Traveler taps | File | Pays after you join |
| --- | --- | --- |
| See stays | `client/src/lib/stays.js` (`staySearchUrl`) | Booking.com through CJ |
| Book stay | `client/src/lib/links.js` (`placeLinks`) | Booking.com through CJ |
| Airbnb | `client/src/lib/links.js` | No |
| Zomato | `client/src/lib/links.js` | No |
| Maps | `client/src/lib/links.js` | No |
| See fare | `client/src/lib/transport.js` | Skyscanner, Kayak, and any live Cuelinks flight campaign. Google Flights stays unpaid. |
| Trains and buses | `client/src/lib/transport.js` | redBus through Cuelinks. Trip.com when that button is a partner link. Official railways stay unpaid. |

## What to paste into the app after approval

The partner ID is public. It sits in the URL. It is not a secret like the Gemini key. Keep it in one place so you are not editing twenty strings.

1. Copy the tracking URL from CJ, Cuelinks, Impact, or the brand dashboard. Use their deep-link tool. Paste Safar’s current search URL in, and copy what comes out.
2. Send that tracking URL, or the parameter they tell you to add, and say which button it belongs to.
3. The change is only in the URL builders above. The screen stays the same. The traveler still lands on the same search, with dates and city filled in.
4. Tap the button yourself on a phone. You should land on the right city and dates. Then look in the partner dashboard. A click should show up the same day. A commission shows up only after a real completed booking, sometimes weeks later.
5. On Cuelinks, generate the link inside the campaign. A handmade Booking.com or MakeMyTrip URL with no tracker pays nothing.

Do not wrap a link until that campaign is approved and marked active. A paused campaign (Yatra was one) tracks nothing.

## What to write on the application

Use this, and change the domain to your real `PUBLIC_APP_URL`:

> Safar is a travel-planning app. A traveler enters a destination and dates. We show a day-by-day plan with estimated costs, then open your site for the live price and booking. We do not process the payment. Links are inside the trip, shown when someone is choosing a stay, fare, or ticket. The site is https://YOUR-DOMAIN. Privacy policy: https://YOUR-DOMAIN/privacy. We will disclose that we may earn a commission.

## Checklist

- [ ] App is on HTTPS and the privacy page loads
- [ ] Commission sentence is in the privacy policy and under the booking buttons
- [ ] CJ account open, Booking.com application sent
- [ ] Cuelinks account open
- [ ] Applied to live campaigns only: Goibibo hotels, MakeMyTrip hotels, Cleartrip flights, redBus
- [ ] Agoda application sent
- [ ] Skyscanner and Kayak applications sent
- [ ] After the first approval, tracking URL is in the matching file above
- [ ] Test tap lands on the right search, and the dashboard shows the click
- [ ] Viator or GetYourGuide, then Airalo, after the stay and fare links are earning

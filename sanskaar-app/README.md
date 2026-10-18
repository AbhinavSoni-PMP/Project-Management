# SANSKAAR — Mobile App

The iOS and Android app for the SANSKAAR wedding-couture website (`../sanskaar`).
Built with Expo (React Native), so one codebase runs on iPhone and Android.

## What's inside

| Screen | What it does |
|---|---|
| **Home** | Full-screen swipeable hero, bride / groom section, bestsellers, Style advisor, collections, our workshop, reviews, consultation |
| **☰ Menu** | Amazon-style list of the whole catalogue (women's and men's categories, occasions, collections), plus account, language and help |
| **Shop** | Search, women / men, category chips and a filter sheet (occasion, collection, colour, price, new / bestsellers, sort) |
| **Product** | Photos, live price and discount, "Only N left" / Sold out, **Delivery by** date, sizes with their unit, size guide, made to measure, add to bag |
| **Wishlist / Bag** | Saved pieces; bag with quantities and free-shipping progress |
| **Checkout** | Log in or sign up, delivery name, mobile, email and address (prefilled next time), order summary, **Pay** with Razorpay (cards, UPI, net banking, wallets, EMI) |
| **Account** | Log in / create account, **My orders**, language, log out |
| **Order tracking** | Expected delivery date, status timeline (confirmed → being tailored → shipped → out for delivery → delivered), courier, tracking number and link, items and address |
| **Languages** | English, हिन्दी, ગુજરાતી, मराठी, ಕನ್ನಡ: the same translations as the website (`sanskaar/js/i18n.js`) |

Bag, wishlist, recently viewed, language, sign-in and the delivery address are remembered on the phone.

## Connecting to the SANSKAAR API

Accounts, live prices and stock, checkout and order tracking come from the API in [`../sanskaar-api`](../sanskaar-api); its README has the setup steps. Once it's online, set its address in **one** place, the website's `SANSKAAR.config.apiUrl` (top of `sanskaar/js/app.js`), then run `npm run sync` here. You can also set `EXPO_PUBLIC_API_URL` in `sanskaar-app/.env` (see `.env.example`). Restart with `npx expo start -c`.

Without it the app still works as a catalogue, but log in, checkout and order tracking stay switched off.

## One source of truth: the website

The app does not keep its own copy of the catalogue. `npm run sync` reads the website and regenerates:

- `src/data/catalog.json` ← `sanskaar/js/catalog-data.js` (products, collections) and `SANSKAAR.config` in `sanskaar/js/app.js` (API address, WhatsApp number, phone, address, shipping rules)
- `src/data/i18n.json` ← `sanskaar/js/i18n.js` (all translations)
- `src/data/art.generated.js` ← `sanskaar/js/art.js` (the illustrated previews shown until a product is photographed)
- `assets/site/**` and `src/data/images.generated.ts` ← every photo in `sanskaar/images/`

**Prices, discounts, stock, sizes and delivery days** are managed on the website's Owner admin page (or in its Excel file) and reach the app live. **New products, photos and wording** are added on the website; then run `npm run sync` here (it also refreshes `../sanskaar-api/data/catalog.json`). Don't edit the generated files by hand.

## Run it on your phone

You need [Node.js](https://nodejs.org) 20+ and the **Expo Go** app on your phone (App Store / Play Store).

```bash
cd sanskaar-app
npm install
npm start
```

Scan the QR code with your camera (iPhone) or with Expo Go (Android). Press `w` to open it in a browser instead.

## Publish to the App Store / Play Store

Use EAS (Expo's build service, no Xcode or Android Studio needed):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform all     # creates the .ipa / .aab
npx eas-cli@latest submit --platform all    # uploads to the stores
```

Before publishing, set your real identifiers in `app.json` (`ios.bundleIdentifier` and `android.package`, currently `in.sanskaar.app`) and your real WhatsApp number in the website's `SANSKAAR.config` (then `npm run sync`).

## Checks

```bash
npm run typecheck
npm run lint
```

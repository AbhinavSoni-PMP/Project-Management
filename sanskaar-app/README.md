# SANSKAAR — Mobile App

The iOS and Android app for the SANSKAAR wedding-couture website (`../sanskaar`).
Built with Expo (React Native), so one codebase runs on iPhone and Android.

## What's inside

| Tab / screen | What it does |
|---|---|
| **Home** | Full-screen swipeable hero (campaign photos `sanskaar/images/site/hero-mobile-*.jpg`, or the studio product photos until those exist), Bride / Groom edits, signature catalogue with category tabs, the five Rajasthan collections, atelier story, testimonials, consultation CTA |
| **Shop** | Full catalogue: search, Bride / Groom toggle, category chips, and a filter sheet (occasion, collection, colour, price, new / bestsellers, sort) |
| **Product** | Swipeable photo gallery, colourways, size picker with size guide, "Made to measure", sticky **Add to bag**, WhatsApp enquiry, details / fit / shipping / care, "Complete the look" and similar pieces |
| **Stylist** | The 3-question Bridal Style Advisor, same scoring as the website |
| **Wishlist** | Saved pieces |
| **Bag** | Quantities, free-shipping progress, **Proceed to checkout** |
| **Checkout** | Delivery address (remembered for next time), order summary, then **Pay** with Razorpay: credit & debit cards, UPI, net banking, wallets, EMI. Order confirmation screen after a verified payment. |
| **Book a consultation** | Appointment form sent to the atelier on WhatsApp |

Bag, wishlist, recently viewed and the delivery address are saved on the phone.

## Payments

Checkout needs the payments API in [`../sanskaar-api`](../sanskaar-api) (it holds your Razorpay secret key and prices orders from the catalogue). Follow its README to get Razorpay test keys and put it online, then create `sanskaar-app/.env` with:

```
EXPO_PUBLIC_API_URL=https://your-api.vercel.app
```

and restart with `npx expo start -c`. Until this is set, the Pay button stays disabled.

## One source of truth: the website

The app does not keep its own copy of the catalogue. `npm run sync` reads the website and regenerates:

- `src/data/catalog.json` ← `sanskaar/js/catalog-data.js` (products, prices, collections) and `SANSKAAR.config` in `sanskaar/js/app.js` (WhatsApp number, phone, address, free-shipping threshold)
- `src/data/art.generated.js` ← `sanskaar/js/art.js` (the illustrated previews shown until a product is photographed)
- `assets/site/**` and `src/data/images.generated.ts` ← every photo in `sanskaar/images/`

So to change a price, add a product or add photos: edit the website as usual (see `sanskaar/images/README.md`), then run `npm run sync` here. The same command also updates the prices the payments API charges (`../sanskaar-api/data/catalog.json`). Don't edit the generated files by hand.

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

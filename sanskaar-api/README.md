# SANSKAAR — Payments API

A small server that lets the app take real payments through **Razorpay**:
credit & debit cards, UPI (GPay, PhonePe, Paytm…), net banking, wallets and EMI.

It does two things the phone must never do itself:

| Endpoint | What it does |
|---|---|
| `POST /api/orders` | Prices the bag **from the catalogue** (so prices can't be tampered with), checks the delivery details and creates a Razorpay order. The customer's items and address are saved on the order, so you see everything in the Razorpay dashboard. |
| `POST /api/verify` | Checks Razorpay's signature to confirm a payment is genuine before the app shows "Order confirmed". |

Prices come from `data/catalog.json`, which `npm run sync` in `sanskaar-app/` regenerates from the website. Shipping rules (`freeShippingAbove`, `shippingFee`) live in `SANSKAAR.config` at the top of `sanskaar/js/app.js`.

## Set it up (about 15 minutes)

### 1. Razorpay test keys
1. Sign up at https://dashboard.razorpay.com (free).
2. Make sure **Test mode** is on (toggle at the top).
3. **Account & Settings → API Keys → Generate key.** Copy the **Key ID** (`rzp_test_…`) and **Key Secret**.

Test mode needs no KYC and moves no real money.

### 2. Put the API online (Vercel, free)
1. Sign in at https://vercel.com with GitHub and click **Add New → Project**.
2. Import this repository and set **Root Directory** to `sanskaar-api`.
3. Under **Environment Variables** add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. Click **Deploy**. You'll get an address like `https://sanskaar-api.vercel.app`.

### 3. Point the app at it
In `sanskaar-app/`, create a file named `.env` containing:
```
EXPO_PUBLIC_API_URL=https://sanskaar-api.vercel.app
```
Then restart the app with `npx expo start -c`.

### 4. Make a test payment
Add something to the bag → **Proceed to checkout** → fill in the address → **Pay**.
In test mode, use Razorpay's test details from
https://razorpay.com/docs/payments/payments/test-card-details/ (test cards, test UPI ID `success@razorpay`).
The payment then appears under **Transactions → Payments** in the dashboard, with the order details under **Orders → Notes**.

## Going live
1. Complete KYC in the Razorpay dashboard (business and bank details).
2. Generate **Live** keys (`rzp_live_…`) and replace both values in Vercel → Settings → Environment Variables, then redeploy.
3. Every payment then settles to your bank account.

## Run it on your computer instead
```bash
cp .env.example .env      # then paste your test keys into .env
npm run dev               # http://localhost:3001
```
Your phone can't reach `localhost`, so set `EXPO_PUBLIC_API_URL` to your computer's Wi-Fi address (e.g. `http://192.168.1.20:3001`).

## Tests
```bash
npm test
```

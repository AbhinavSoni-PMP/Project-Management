# SANSKAAR — API (accounts, orders, payments, owner admin)

One small server that both the **website** (`../sanskaar`) and the **app** (`../sanskaar-app`) use:

- **Customer accounts:** sign up / log in with email or mobile number and password.
- **Live catalogue:** MRP, discount % and ₹, selling price, delivery days, sizes and size unit, stock. The website and app show these values, so a change made by the owner shows everywhere.
- **Payments with Razorpay:** credit and debit cards, UPI, net banking, wallets, EMI. Prices are always calculated here, never on the phone, and every payment is checked with Razorpay's signature.
- **Orders and delivery tracking:** the customer sees Order confirmed → Being tailored → Shipped → Out for delivery → Delivered, with the expected date, courier, tracking number and link, and your notes.
- **Owner admin:** edit prices, discounts, stock, sizes and delivery days, and update each order's delivery status. **Download the catalogue as Excel, edit it, upload it back.** Sold and remaining stock are counted automatically from paid orders on the app and website.

## Set it up (about 20 minutes)

### 1. Razorpay test keys
1. Sign up at https://dashboard.razorpay.com and keep **Test mode** on.
2. **Account & Settings → API Keys → Generate key.** Copy the **Key ID** (`rzp_test_…`) and **Key Secret**.

### 2. Put the API online (Vercel, free)
1. Sign in at https://vercel.com with GitHub → **Add New → Project** → import this repository → set **Root Directory** to `sanskaar-api`.
2. **Storage → Create → Neon (Postgres)** and connect it to the project. This adds `DATABASE_URL` for you.
3. **Settings → Environment Variables**: add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `AUTH_SECRET` (any long random text) and `OWNER_EMAILS` (your email). See `.env.example`.
4. **Deploy.** You'll get an address like `https://sanskaar-api.vercel.app`. The database tables and all 57 products are created automatically on the first request.

### 3. Connect the website and the app
- **Website:** at the top of `sanskaar/js/app.js`, set `apiUrl: "https://sanskaar-api.vercel.app",`.
- **App:** run `npm run sync` in `sanskaar-app/`. It picks up the same `apiUrl`. You can also set `EXPO_PUBLIC_API_URL` in `sanskaar-app/.env`.

### 4. Become the owner
Sign up on the website with the email you put in `OWNER_EMAILS`. **Owner admin** then appears in the menu and on your account page (`admin.html`).

## Using the Owner admin page
- **Products & prices:** change MRP, Discount %, Discount ₹, delivery days, sizes, size unit (Standard / Inches / CM / UK / US), stock received, or hide a product, then press **Save**. Selling price = MRP − Discount % − Discount ₹.
- **Orders & delivery:** set the status, expected delivery date, courier, tracking number and link, and add a note for the customer. They see it in **My orders** right away.
- **Excel:** **Download Excel** → edit the **yellow** columns → upload the file. The grey columns (selling price, tentative delivery date, sold, remaining) are calculated. The file also has an **Orders** sheet. If any row has a mistake, nothing is saved and the page lists what to fix.

New products (with photos and descriptions) are still added on the website (`sanskaar/js/catalog-data.js`). Run `npm run sync` in `sanskaar-app/` and redeploy, and they appear in the admin page and in Excel.

## Going live with real payments
Complete KYC in the Razorpay dashboard, generate **Live** keys (`rzp_live_…`), replace both values in Vercel and redeploy.

## Run it on your computer
```bash
npm install
cp .env.example .env      # paste your keys
npm run dev               # http://localhost:3001 (data kept in ./.data)
```

## Tests
```bash
npm test
```

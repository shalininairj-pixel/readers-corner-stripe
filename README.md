# The Reader's Corner: Stripe Payment Element Integration

A small online bookshop. A customer picks a book, pays with the **Stripe Payment Element**, and lands on a confirmation page showing the **total charged** and the **PaymentIntent ID (`pi_...`)**.

Stack: Node.js, Express, plain HTML/CSS/JavaScript (no build step), Stripe Node SDK and Stripe.js.

---

## 1. How to build, configure and run

**Prerequisites**
- Node.js 18 or newer (check with `node -v`)
- A free Stripe account. Everything here uses **test mode**, so no verification or real money is involved.

**Steps**

```bash
# 1. Get the code
git clone <https://github.com/shalininairj-pixel/readers-corner-stripe>
cd bookstore

# 2. Install dependencies
npm install

# 3. Add your Stripe test keys
cp .env.example .env        # Windows: copy .env.example .env
# Open .env and fill in the values from
# Dashboard > Developers > API keys (with Test mode switched on):
#   STRIPE_SECRET_KEY=sk_test_...
#   STRIPE_PUBLISHABLE_KEY=pk_test_...
#   PORT=4242

# 4. Start the app
npm start
```

Open **http://localhost:4242**, choose a book and pay.

**Test cards** (any future expiry, any 3-digit CVC, any postcode)

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 9995` | Card declined (insufficient funds) |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

**Notes**
- `.env` is git-ignored, so your keys are never committed. After editing `.env`, restart the server, because it is only read at startup.
- Fonts load from Google Fonts. Offline, the page falls back to Georgia.

**Project structure**

```
bookstore/
├── server.js          # Express server: catalog, Stripe API calls
├── public/
│   ├── index.html     # Layout and styling
│   └── script.js      # Browser logic: shelf, checkout, confirmation
├── .env.example       # Template for keys (copy to .env)
├── package.json
└── README.md
```

---

## 2. How the solution works

### Architecture

| Layer | File | Responsibility |
|---|---|---|
| Server | `server.js` | Owns the book catalog and prices. Talks to Stripe using the **secret key**. |
| Page | `public/index.html` | Static layout and styling. |
| Browser logic | `public/script.js` | Draws the shelf, mounts Stripe's Payment Element, confirms payment, shows the receipt. Uses only the **publishable key**. |

The server exposes four small endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | Returns the publishable key to the browser |
| `GET /api/books` | Returns the catalog |
| `POST /api/create-payment-intent` | Creates a PaymentIntent for the chosen book |
| `GET /api/payment-intent/:id` | Retrieves a PaymentIntent so the confirmation can be verified |

### Payment flow

1. The customer clicks **Buy**. The browser sends only the `bookId` to the server.
2. The server looks up the price itself and calls `stripe.paymentIntents.create(...)` with `automatic_payment_methods` enabled. It returns the intent's `client_secret`.
3. The browser calls `stripe.elements({ clientSecret })` and mounts the **Payment Element**, which renders Stripe's secure payment form. Card details go straight from the browser to Stripe and never touch my server.
4. On submit, `stripe.confirmPayment()` completes the payment and redirects back to the app with `?payment_intent=pi_...` in the URL.
5. The page calls `GET /api/payment-intent/:id`. The server retrieves the intent from Stripe, and the confirmation (book, total amount, `pi_` ID) is shown **only if the status is `succeeded`**.

### Stripe APIs used
- **PaymentIntents API**: `create` and `retrieve`
- **Stripe.js**: `Stripe()`, `elements()` (with the Appearance API for theming), the **Payment Element**, and `confirmPayment()`

### Key design decisions
- **Prices live on the server.** The browser never sends an amount, so a customer can't edit the price in dev tools.
- **Amounts are in cents** (Stripe's smallest currency unit), which avoids floating-point rounding errors.
- **The confirmation is verified with Stripe**, not trusted from the URL. Anyone could type a `pi_` into the address bar.
- **Secrets stay server-side** in `.env`. Only the publishable key reaches the browser.
- **No build step or framework**, so the app runs with two commands and is easy to extend during a live session.

---

## 3. Approach, docs and challenges

### Approach
I broke the work into the smallest flow that could work end to end (create intent, collect payment, confirm), got that running, and only then improved the design. I started with the data flow before touching styling. The server decides *what* is being charged, Stripe collects the payment details, and the server confirms the result.

I used an AI assistant to help scaffold the project and explain the Stripe concepts. I then ran the app myself, made test purchases, tried failure cases, and went through the code until I could explain each part. *(Edit this paragraph into your own words. State it as accurately as you like, but keep it truthful.)*

### Docs I used
- Stripe: *Accept a payment* guide (Payment Element, custom payment flow)
- Stripe API reference: PaymentIntents (create, retrieve)
- Stripe: Testing guide (test cards, including declines and 3D Secure)
- Stripe: Elements Appearance API (to match the shop's theme)
- Express documentation (routing, static files, JSON body parsing)

### Challenges
- **Returning to code after a long gap.** It had been about five years since I wrote code in Java, so I had to relearn how a Node project is organised: `package.json` in place of Maven, `npm install`, and `.env` in place of properties files. Mapping each idea to its Java equivalent helped.
- **Environment setup on Windows.** My terminal was initially in the wrong folder, and `npm install` failed with a permissions error until I ran it from inside the project directory. I also realised I had been trying to run it from inside the unextracted zip.
- **A silent configuration failure.** The page showed the heading but no books. The cause was that my keys file had been saved as `.env.txt`, so the server never loaded the keys. I fixed it by checking `/api/config` in the browser and `dir /a` in the terminal, then recreating the file with the exact name `.env`.
- **Understanding the key roles.** It took me a while to see why there are two keys and a `client_secret`. The secret key stays on the server, the publishable key is safe in the browser, and the `client_secret` lets the browser complete one specific payment.
- **Trust boundaries.** I had to think about what the browser is allowed to decide. The answer is nothing about price or payment status, which is why both are handled on the server.

---

## 4. How I would extend this

**Reliability**
- **Webhooks** (`payment_intent.succeeded`, `payment_intent.payment_failed`): today, if a customer closes the tab right after paying, the app never finds out. A signed webhook lets Stripe notify the server, so orders are fulfilled reliably.
- **Idempotency keys** and re-using an existing PaymentIntent if the customer retries, to prevent duplicate charges and abandoned intents.

**Product features**
- A shopping cart, quantities and a real database of books and orders
- Stripe **Customers** with saved payment methods for returning buyers
- Order confirmation emails and receipts, refunds from an admin page
- Tax calculation (Stripe Tax), shipping options, and multi-currency pricing
- Additional local payment methods via the Dashboard, with no code change thanks to `automatic_payment_methods`

**Engineering**
- Automated tests (for example, Jest with Stripe's test mode or mocks), structured logging and error monitoring
- Input validation and rate limiting on the API
- A deployment on HTTPS with environment-specific configuration and key rotation
- Splitting the server into routes, services and config modules as it grows

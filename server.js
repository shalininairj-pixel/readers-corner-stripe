require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(express.json());
app.use(express.static('public'));

// The catalog lives on the SERVER so customers can't change prices in the browser.
// Prices are in cents (Stripe uses the smallest currency unit).
const BOOKS = [
  { id: 'b1', title: 'Yellowface', author: 'R. F. Kuang', price: 1599, color: '#e8b923', ink: '#2b2210' },
  { id: 'b2', title: 'Days at the Morisaki Bookshop', author: 'Satoshi Yagisawa', price: 1399, color: '#3f6f63', ink: '#f6efe3' },
  { id: 'b3', title: 'The Midnight Library', author: 'Matt Haig', price: 1499, color: '#1d2b53', ink: '#f6efe3' },
];

app.get('/api/config', (req, res) =>
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY }));

app.get('/api/books', (req, res) => res.json(BOOKS));

// Step 1 of payment: tell Stripe "a customer intends to pay X".
app.post('/api/create-payment-intent', async (req, res) => {
  const book = BOOKS.find((b) => b.id === req.body.bookId);
  if (!book) return res.status(400).json({ error: 'Unknown book' });
  try {
    const intent = await stripe.paymentIntents.create({
      amount: book.price,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { bookId: book.id, title: book.title },
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 3: after payment, the confirmation page asks the server for the verified result.
app.get('/api/payment-intent/:id', async (req, res) => {
  try {
    const pi = await stripe.paymentIntents.retrieve(req.params.id);
    res.json({ id: pi.id, amount: pi.amount, currency: pi.currency,
               status: pi.status, title: pi.metadata.title });
  } catch (err) {
    res.status(404).json({ error: 'Payment not found' });
  }
});

const port = process.env.PORT || 4242;
app.listen(port, () => console.log(`Running at http://localhost:${port}`));

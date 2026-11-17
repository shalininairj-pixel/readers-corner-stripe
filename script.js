const $ = (id) => document.getElementById(id);
const money = (cents, cur) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'usd' }).format(cents / 100);
let stripe, elements;

async function init() {
  const { publishableKey } = await (await fetch('/api/config')).json();
  stripe = Stripe(publishableKey);
  const piId = new URLSearchParams(location.search).get('payment_intent');
  if (piId) return showConfirmation(piId); // Stripe sends the customer back here after paying
  showCatalog();
}

async function showCatalog() {
  $('checkout').hidden = true;
  $('catalog').hidden = false;
  const books = await (await fetch('/api/books')).json();
  const grid = document.createElement('div');
  grid.className = 'grid';
  books.forEach((b) => {
    const card = document.createElement('div');
    card.className = 'book';
    card.innerHTML = '<div class="cover"><b></b><span></span></div>' +
      '<div class="meta"><div><div class="t"></div><div class="a"></div></div><div class="p"></div></div>';
    const cover = card.querySelector('.cover');
    cover.style.background = b.color;
    cover.style.color = b.ink;
    cover.querySelector('b').textContent = b.title;
    cover.querySelector('span').textContent = b.author;
    card.querySelector('.t').textContent = b.title;
    card.querySelector('.a').textContent = b.author;
    card.querySelector('.p').textContent = money(b.price);
    const btn = document.createElement('button');
    btn.textContent = 'Buy this book';
    btn.onclick = () => startCheckout(b);
    card.append(btn);
    grid.append(card);
  });
  $('catalog').replaceChildren(grid);
}

async function startCheckout(book) {
  $('catalog').hidden = true;
  $('checkout').hidden = false;
  $('error').textContent = '';
  $('pay-btn').disabled = true; // stays disabled until the card details are complete
  $('checkout-title').textContent = `${book.title} — ${money(book.price)}`;
  const res = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookId: book.id }),
  });
  const { clientSecret, error } = await res.json();
  if (error) { $('error').textContent = error; return; }
  // 'appearance' restyles Stripe's form to match our bookshop theme
  elements = stripe.elements({
    clientSecret,
    appearance: { theme: 'stripe', variables: { colorPrimary: '#7a4b2a', fontFamily: 'Lora, Georgia, serif' } },
  });
  $('payment-element').innerHTML = '';
  const paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');
  paymentElement.on('change', (ev) => { $('pay-btn').disabled = !ev.complete; });
}

$('payment-form').addEventListener('submit', (e) => e.preventDefault()); // pressing Enter must never pay
$('pay-btn').addEventListener('click', async (e) => {
  if (!e.isTrusted) return; // ignore clicks not made by a real person
  console.log('Pay now clicked'); // only a click on Pay now starts the payment
  $('pay-btn').disabled = true;
  $('overlay').hidden = false; // show 'processing' screen
  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: window.location.origin + '/' },
  });
  // Only reached if something went wrong (success redirects away)
  $('overlay').hidden = true;
  $('error').textContent = error.message;
  $('pay-btn').disabled = false;
});
$('back-btn').onclick = showCatalog;

async function showConfirmation(id) {
  $('catalog').hidden = true;
  const res = await fetch('/api/payment-intent/' + id);
  const pi = await res.json();
  history.replaceState({}, '', '/'); // clear ?payment_intent=... so a refresh or old link can't reopen the receipt
  const box = $('confirmation');
  box.hidden = false;
  if (!res.ok || pi.status !== 'succeeded') {
    box.innerHTML = '<h2>Payment not completed</h2><p>Status: <code></code></p><a href="/">Back to the shelf</a>';
    box.querySelector('code').textContent = pi.status || 'unknown';
    return;
  }
  box.innerHTML = '<h2>Thank you for visiting The Reader\'s Corner ✨</h2>' +
    '<p>Your book: <strong id="t"></strong></p><p>Total charged: <strong id="a"></strong></p>' +
    '<p>Payment Intent ID: <code id="i"></code></p><a href="/">Browse more books</a>';
  $('t').textContent = pi.title;
  $('a').textContent = money(pi.amount, pi.currency);
  $('i').textContent = pi.id;
}
init();

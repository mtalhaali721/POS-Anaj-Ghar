# Andaj Ghar POS

Counter for Andaj Ghar Chakki. Packed atta, gehun, cheeni, and daal sit on the board. Wheat a house brings in has its own chakki queue. Wholesale shops keep a khata for udhaar.

This branch is a temporary static export for GitHub Pages. `main` stays the normal Next.js app. `npm run build` writes the site to `out/`, including `out/index.html`.

The day book is kept in the browser (`localStorage`), because GitHub Pages cannot run the counter’s server. Each browser starts from the sample day and remembers that browser’s sales. **Reset sample** on the board puts the opening day back.

The sample day opens on Rs 11,802 collected, Rs 78,200 shop udhaar, three mill tickets, and two open shop orders.

## Run it locally

You need Node 20.9+.

```bash
npm install
npm run dev
```

The counter listens on http://127.0.0.1:43127/POS-Anaj-Ghar/

## GitHub Pages

The site is built for https://mtalhaali721.github.io/POS-Anaj-Ghar/

In the repo, open Settings → Pages → Build and deployment, and set Source to **GitHub Actions**. A push to `cursor/github-pages-static-8113` publishes `out/`.

## How a sale works

1. On the counter, add kilos with +1, +5, +10, +25, or +50.
2. Search a shop such as `c-sharma`. Wholesale accounts show the open udhaar and the limit. Shop rate is a switch on the ticket, and also on each card.
3. Cash, card, and Raast post a paid bill and take the kilos off the floor. Udhaar posts to the khata and refuses the sale if it would cross the limit.
4. **Park as order** holds a shop call-in. Pack it, send it out, then take payment from the order.
5. Chakki tickets are for gehun a house brings in. Billing happens when they collect the atta. Milling is Rs 10 per kg, with no GST.
6. Accounts records a wasooli against an open balance.

Cashiers on the sample roster: Ayesha Khan (Counter 1), Imran Ali (Counter 2), Farah Naz (Floor).

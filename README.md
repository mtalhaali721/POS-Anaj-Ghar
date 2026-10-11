# Andaj Ghar POS

Counter for Andaj Ghar Chakki. Packed atta, gehun, cheeni, and daal sit on the board. Wheat a house brings in has its own chakki queue. Wholesale shops keep a khata for udhaar.

The till is a Next.js and React app. The day book lives in this app, in `data/andaj.json`, which is created the first time you open the counter. You do not need the back office or a separate API to run it.

The sample day opens on Rs 11,802 collected, Rs 78,200 shop udhaar, three mill tickets, and two open shop orders.

## Run it

You need Node 20.9+.

```bash
npm install
npm run dev
```

The counter listens on http://127.0.0.1:43127.

On the board, **Reset sample** puts that opening day back. Practice bills stay in `data/andaj.json` and are not committed.

## How a sale works

1. On the counter, add kilos with +1, +5, +10, +25, or +50.
2. Search a shop such as `c-sharma`. Wholesale accounts show the open udhaar and the limit. Shop rate is a switch on the ticket, and also on each card.
3. Cash, card, and Raast post a paid bill and take the kilos off the floor. Udhaar posts to the khata and refuses the sale if it would cross the limit.
4. **Park as order** holds a shop call-in. Pack it, send it out, then take payment from the order.
5. Chakki tickets are for gehun a house brings in. Billing happens when they collect the atta. Milling is Rs 10 per kg, with no GST.
6. Accounts records a wasooli against an open balance.

Cashiers on the sample roster: Ayesha Khan (Counter 1), Imran Ali (Counter 2), Farah Naz (Floor).

"use client";

import { Minus, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ProductArt } from "@/components/product-art";
import { ReceiptDialog } from "@/components/receipt";
import { useCashier } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kg, quote, rupees } from "@/lib/money";
import type { Bill, Customer, Product, ShopOrder } from "@/lib/types";

const categories = [
  { id: "tamam", label: "Tamam" },
  { id: "atta", label: "Atta" },
  { id: "gehun", label: "Gehun" },
  { id: "cheeni", label: "Cheeni" },
  { id: "daalain", label: "Daalain" },
  { id: "aur", label: "Aur" },
];

const jumps = [1, 5, 10, 25, 50];

type CartLine = { productId: number; qtyKg: number; shopRate: boolean };

const cartKey = "andaj-cart-v1";
type Draft = {
  cart: CartLine[];
  note: string;
  discount: string;
  useShopRate: boolean;
  customer: Customer | null;
};
const emptyDraft: Draft = { cart: [], note: "", discount: "0", useShopRate: false, customer: null };
let draft: Draft = emptyDraft;
let draftHydrated = false;

function hydrateDraft() {
  if (draftHydrated || typeof window === "undefined") return;
  draftHydrated = true;
  const saved = window.sessionStorage.getItem(cartKey);
  if (!saved) return;
  try {
    draft = { ...emptyDraft, ...(JSON.parse(saved) as Partial<Draft>) };
  } catch {
    window.sessionStorage.removeItem(cartKey);
  }
}

function readDraft() {
  hydrateDraft();
  return draft;
}

function writeDraft(next: Draft) {
  draft = next;
  window.sessionStorage.setItem(cartKey, JSON.stringify(next));
  window.dispatchEvent(new Event("andaj-cart"));
}

function subscribeDraft(onStoreChange: () => void) {
  window.addEventListener("andaj-cart", onStoreChange);
  return () => window.removeEventListener("andaj-cart", onStoreChange);
}

export function CounterScreen() {
  const { cashier } = useCashier();
  const router = useRouter();
  const params = useSearchParams();
  const orderParam = params.get("order");
  const ticket = useSyncExternalStore(subscribeDraft, readDraft, () => emptyDraft);
  const { cart, note, discount, useShopRate, customer } = ticket;
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("tamam");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<Customer[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [receipt, setReceipt] = useState<Bill | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [newShop, setNewShop] = useState(false);
  const searchTimer = useRef<number | null>(null);

  function updateTicket(partial: Partial<Draft>) {
    writeDraft({ ...readDraft(), ...partial });
  }

  function searchCustomers(value: string) {
    setCustomerQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (value.trim().length < 1) {
      setCustomerHits([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      api<Customer[]>(`/api/customers?q=${encodeURIComponent(value)}`)
        .then(setCustomerHits)
        .catch(() => setCustomerHits([]));
    }, 180);
  }

  useEffect(() => {
    api<Product[]>("/api/products")
      .then((rows) => {
        setProducts(rows);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    if (!orderParam) return;
    const id = Number(orderParam);
    if (!Number.isFinite(id)) return;
    api<ShopOrder[]>("/api/orders")
      .then((orders) => {
        const order = orders.find((item) => item.id === id);
        if (!order || order.status === "cancelled" || order.status === "delivered") return;
        setOrderId(order.id);
        writeDraft({
          ...readDraft(),
          note: order.note,
          useShopRate: order.lines.every((line) => line.shopRate),
          cart: order.lines.map((line) => ({
            productId: line.productId,
            qtyKg: line.qtyKg,
            shopRate: line.shopRate,
          })),
        });
        if (order.customerId) {
          api<Customer[]>("/api/customers").then((rows) => {
            const match = rows.find((row) => row.id === order.customerId);
            if (match) writeDraft({ ...readDraft(), customer: match });
          });
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not open the order."));
  }, [orderParam]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const inCategory = category === "tamam" || product.category === category;
      const matches =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.subtitle.toLowerCase().includes(term);
      return inCategory && matches;
    });
  }, [products, query, category]);

  const discountPercent = Math.min(100, Math.max(0, Number(discount) || 0));

  const priced = cart
    .map((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) return null;
      const shop = line.shopRate || useShopRate;
      return {
        ...line,
        shop,
        product,
        rate: shop ? product.shopPricePerKg : product.pricePerKg,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const totals = quote(
    priced.map((line) => ({ qtyKg: line.qtyKg, rate: line.rate, gstPercent: line.product.gstPercent })),
    discountPercent,
  );

  function add(product: Product, qty: number) {
    const current = readDraft().cart;
    const existing = current.find((line) => line.productId === product.id);
    const nextQty = (existing?.qtyKg ?? 0) + qty;
    if (nextQty > product.stockKg) {
      setError(`${product.name} has ${kg(product.stockKg)} left on the floor.`);
      return;
    }
    setError("");
    const cartNext = !existing
      ? [...current, { productId: product.id, qtyKg: qty, shopRate: readDraft().useShopRate }]
      : current.map((line) => (line.productId === product.id ? { ...line, qtyKg: nextQty } : line));
    updateTicket({ cart: cartNext });
  }

  function setQty(productId: number, qtyKg: number) {
    const current = readDraft().cart;
    updateTicket({
      cart:
        qtyKg <= 0
          ? current.filter((line) => line.productId !== productId)
          : current.map((line) => (line.productId === productId ? { ...line, qtyKg } : line)),
    });
  }

  function toggleShop(product: Product) {
    const current = readDraft().cart;
    const existing = current.find((line) => line.productId === product.id);
    updateTicket({
      cart: !existing
        ? [...current, { productId: product.id, qtyKg: 1, shopRate: true }]
        : current.map((line) => (line.productId === product.id ? { ...line, shopRate: !line.shopRate } : line)),
    });
  }

  function clearTicket() {
    writeDraft(emptyDraft);
    setCustomerQuery("");
    setCustomerHits([]);
    setOrderId(null);
    setError("");
    if (orderParam) router.replace("/counter");
  }

  async function pay(method: "cash" | "card" | "raast" | "udhaar") {
    setError("");
    if (!priced.length) {
      setError("Add atta, gehun, or cheeni before taking payment.");
      return;
    }
    if (method === "udhaar" && !customer) {
      setError("Pick a shop before putting this on udhaar.");
      return;
    }
    setBusy(method);
    try {
      const bill = await api<Bill>("/api/bills", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer?.id ?? null,
          discountPercent,
          note,
          method,
          useShopRate,
          cashier: cashier.name,
          counter: cashier.counter,
          fromOrderId: orderId,
          lines: priced.map((line) => ({
            productId: line.productId,
            qtyKg: line.qtyKg,
            shopRate: line.shop,
          })),
        }),
      });
      setReceipt(bill);
      clearTicket();
      setProducts(await api<Product[]>("/api/products"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The bill did not save.");
    } finally {
      setBusy("");
    }
  }

  async function park() {
    setError("");
    if (!priced.length) {
      setError("Add a few bags before parking the order.");
      return;
    }
    setBusy("park");
    try {
      const order = await api<ShopOrder>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer?.id ?? null,
          note,
          cashier: cashier.name,
          useShopRate,
          lines: priced.map((line) => ({
            productId: line.productId,
            qtyKg: line.qtyKg,
            shopRate: line.shop,
          })),
        }),
      });
      clearTicket();
      setError(`Parked as ${order.number}. It is waiting with the shop orders.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not park the order.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 pb-24 xl:grid-cols-[minmax(0,1fr)_340px] xl:pb-0">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-leaf">Counter sale</p>
            <h1 className="font-display text-4xl">Andaj Ghar POS</h1>
          </div>
          <label className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Atta, gehun, cheeni, SKU."
              className="h-11 w-full rounded-full border border-line bg-white pl-10 pr-4 text-sm outline-none focus:border-leaf"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              key={item.id}
              onClick={() => setCategory(item.id)}
              className={cn(
                "rounded-full border border-line bg-white px-4 py-1.5 text-sm",
                category === item.id && "border-moss bg-moss text-white",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {offline && (
          <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-sm text-[#6f2a22]">
            The mill book is offline. Refresh the counter.
          </p>
        )}
        {visible.length === 0 ? (
          <p className="mt-8 rounded-3xl bg-white px-5 py-10 text-center text-sm text-mist">
            Nothing on this shelf matches. Try another name or SKU.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map((product) => {
              const line = cart.find((item) => item.productId === product.id);
              const shopOn = line ? line.shopRate || useShopRate : useShopRate;
              const price = shopOn ? product.shopPricePerKg : product.pricePerKg;
              return (
                <article
                  key={product.id}
                  className={cn(
                    "rounded-3xl bg-white p-3 shadow-[0_1px_0_rgba(16,36,28,0.04)]",
                    line && "ring-2 ring-lime",
                  )}
                >
                  <ProductArt art={product.art} />
                  <h2 className="mt-1 text-sm font-semibold leading-5">{product.name}</h2>
                  <p className="text-xs text-mist">{product.subtitle}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-xl font-semibold">{rupees(price)}</p>
                    <button className="text-xs text-leaf" onClick={() => toggleShop(product)}>
                      {line?.shopRate ? "counter rate" : "shop rate"}
                    </button>
                  </div>
                  <p className="text-[11px] text-mist">
                    / kg · {product.sku} · {kg(product.stockKg)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {jumps.map((qty) => (
                      <button
                        key={qty}
                        onClick={() => add(product, qty)}
                        className="rounded-full border border-line px-2 py-1 text-[11px] hover:border-leaf hover:text-leaf"
                      >
                        +{qty}
                      </button>
                    ))}
                  </div>
                  {line && <p className="mt-2 text-xs font-medium text-leaf">{kg(line.qtyKg)} on the ticket</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <BillPanel
        customer={customer}
        customerQuery={customerQuery}
        hits={customerHits}
        onQuery={searchCustomers}
        onPick={(next) => {
          updateTicket({ customer: next });
          setCustomerQuery("");
          setCustomerHits([]);
        }}
        onClearCustomer={() => updateTicket({ customer: null })}
        onNewShop={() => setNewShop(true)}
        useShopRate={useShopRate}
        onShopRate={(value) => updateTicket({ useShopRate: value })}
        lines={priced}
        onQty={setQty}
        discount={discount}
        onDiscount={(value) => updateTicket({ discount: value })}
        note={note}
        onNote={(value) => updateTicket({ note: value })}
        totals={totals}
        error={error}
        busy={busy}
        orderId={orderId}
        onClear={clearTicket}
        onPark={() => void park()}
        onPay={(method) => void pay(method)}
      />

      <ReceiptDialog bill={receipt} onOpenChange={(open) => !open && setReceipt(null)} />
      <NewShopDialog
        open={newShop}
        onOpenChange={setNewShop}
        onCreated={(created) => {
          updateTicket({ customer: created });
          setNewShop(false);
        }}
      />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white p-3 xl:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs text-mist">{priced.length ? `${priced.length} lines` : "Ticket empty"}</p>
            <p className="font-display text-2xl">{rupees(totals.total)}</p>
          </div>
          <a href="#ticket" className="rounded-full bg-moss px-4 py-2 text-sm text-white">
            Open ticket
          </a>
        </div>
      </div>
    </div>
  );
}

function BillPanel({
  customer,
  customerQuery,
  hits,
  onQuery,
  onPick,
  onClearCustomer,
  onNewShop,
  useShopRate,
  onShopRate,
  lines,
  onQty,
  discount,
  onDiscount,
  note,
  onNote,
  totals,
  error,
  busy,
  orderId,
  onClear,
  onPark,
  onPay,
}: {
  customer: Customer | null;
  customerQuery: string;
  hits: Customer[];
  onQuery: (value: string) => void;
  onPick: (customer: Customer) => void;
  onClearCustomer: () => void;
  onNewShop: () => void;
  useShopRate: boolean;
  onShopRate: (value: boolean) => void;
  lines: {
    productId: number;
    qtyKg: number;
    shop: boolean;
    rate: number;
    product: Product;
  }[];
  onQty: (productId: number, qty: number) => void;
  discount: string;
  onDiscount: (value: string) => void;
  note: string;
  onNote: (value: string) => void;
  totals: { subtotal: number; discount: number; gst: number; total: number };
  error: string;
  busy: string;
  orderId: number | null;
  onClear: () => void;
  onPark: () => void;
  onPay: (method: "cash" | "card" | "raast" | "udhaar") => void;
}) {
  return (
    <aside id="ticket" className="h-fit rounded-3xl bg-white p-4 xl:sticky xl:top-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Current bill</p>
      <h2 className="font-display text-2xl">Ticket</h2>
      {orderId && <p className="text-xs text-leaf">Paying parked order #{orderId}</p>}
      <label className="mt-3 block text-xs text-mist">
        Customer / shop
        <input
          value={customer ? `${customer.name} · ${customer.code}` : customerQuery}
          onChange={(event) => {
            if (customer) onClearCustomer();
            onQuery(event.target.value);
          }}
          placeholder="c-sharma"
          className="mt-1 h-10 w-full rounded-2xl border border-line px-3 text-sm text-ink outline-none focus:border-leaf"
        />
      </label>
      {hits.length > 0 && !customer && (
        <div className="mt-1 overflow-hidden rounded-2xl border border-line">
          {hits.slice(0, 5).map((hit) => (
            <button
              key={hit.id}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-foam"
              onClick={() => onPick(hit)}
            >
              <span className="font-medium">{hit.name}</span>
              <span className="ml-2 text-xs text-mist">
                {hit.code} · {rupees(hit.balance)} / {rupees(hit.limit)}
              </span>
            </button>
          ))}
        </div>
      )}
      <button className="mt-2 text-xs text-leaf" onClick={onNewShop}>
        Open a new khata
      </button>
      {customer?.wholesale && (
        <p className="mt-2 text-xs text-leaf">
          Wholesale rates on · Udhaar {rupees(customer.balance)} / {rupees(customer.limit)}
        </p>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={useShopRate} onChange={(event) => onShopRate(event.target.checked)} />
        Use shop rates on this ticket
      </label>

      <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
        {lines.length === 0 && <p className="rounded-2xl bg-foam px-3 py-6 text-center text-sm text-mist">The ticket is empty.</p>}
        {lines.map((line) => (
          <div key={line.productId} className="rounded-2xl bg-foam p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{line.product.name}</p>
                <p className="text-xs text-mist">
                  {rupees(line.rate)} / kg · GST {line.product.gstPercent}%
                </p>
              </div>
              <p className="text-sm font-semibold">{rupees(line.qtyKg * line.rate)}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button className="rounded-full border border-line bg-white p-1" onClick={() => onQty(line.productId, line.qtyKg - 1)} aria-label="Remove a kilo">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                value={line.qtyKg}
                onChange={(event) => onQty(line.productId, Number(event.target.value))}
                className="h-8 w-16 rounded-full border border-line bg-white text-center text-sm"
                inputMode="decimal"
                aria-label={`${line.product.name} kilos`}
              />
              <button className="rounded-full border border-line bg-white p-1" onClick={() => onQty(line.productId, line.qtyKg + 1)} aria-label="Add a kilo">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-mist">{kg(line.qtyKg)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-xs text-mist">
          Discount %
          <input
            value={discount}
            onChange={(event) => onDiscount(event.target.value)}
            className="mt-1 h-10 w-full rounded-2xl border border-line px-3 text-sm text-ink"
            inputMode="decimal"
          />
        </label>
        <label className="text-xs text-mist">
          Bill note
          <input
            value={note}
            onChange={(event) => onNote(event.target.value)}
            placeholder="50 kg bori"
            className="mt-1 h-10 w-full rounded-2xl border border-line px-3 text-sm text-ink"
          />
        </label>
      </div>
      <dl className="mt-4 space-y-1 text-sm">
        <Total label="Subtotal" value={rupees(totals.subtotal)} />
        <Total label="Discount" value={`− ${rupees(totals.discount)}`} />
        <Total label="GST" value={rupees(totals.gst)} />
        <div className="flex items-end justify-between pt-2">
          <dt>To collect</dt>
          <dd className="font-display text-3xl">{rupees(totals.total)}</dd>
        </div>
      </dl>
      {error && <p className="mt-3 rounded-2xl bg-foam px-3 py-2 text-sm text-[#6f2a22]">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onClear} disabled={busy !== ""}>
          Clear
        </Button>
        <Button variant="outline" onClick={onPark} disabled={busy !== ""}>
          {busy === "park" ? "Parking…" : "Park as order"}
        </Button>
        <Button onClick={() => onPay("cash")} disabled={busy !== ""}>
          {busy === "cash" ? "Saving…" : "Cash"}
        </Button>
        <Button onClick={() => onPay("raast")} disabled={busy !== ""}>
          Raast
        </Button>
        <Button onClick={() => onPay("card")} disabled={busy !== ""}>
          Card
        </Button>
        <Button onClick={() => onPay("udhaar")} disabled={busy !== ""}>
          Udhaar
        </Button>
      </div>
    </aside>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-mist">
      <dt>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function NewShopDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [limit, setLimit] = useState("50000");
  const [wholesale, setWholesale] = useState(true);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    try {
      const created = await api<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          kind: "shop",
          wholesale,
          limit: Number(limit) || 0,
          note: "Opened at the counter",
        }),
      });
      setName("");
      setPhone("");
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open the khata.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Open a khata</DialogTitle>
        <DialogDescription>A shop can take bags on udhaar up to the limit you set.</DialogDescription>
        <div className="mt-4 space-y-3">
          <Field label="Shop name" value={name} onChange={setName} />
          <Field label="Phone" value={phone} onChange={setPhone} />
          <Field label="Udhaar limit" value={limit} onChange={setLimit} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wholesale} onChange={(event) => setWholesale(event.target.checked)} />
            Wholesale shop
          </label>
          {error && <p className="text-sm text-[#6f2a22]">{error}</p>}
          <Button onClick={() => void save()}>Save khata</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs text-mist">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-2xl border border-line px-3 text-sm text-ink"
      />
    </label>
  );
}

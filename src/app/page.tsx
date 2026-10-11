"use client";

import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { kg, rupees, statusLabel } from "@/lib/money";
import type { Dashboard } from "@/lib/types";

export default function BoardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Dashboard>("/api/dashboard"));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The board could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    const poll = window.setInterval(() => void load(), 15000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [load]);

  async function resetSample() {
    if (!window.confirm("Put the sample day back? Today's practice bills will be replaced.")) return;
    setResetting(true);
    try {
      await api("/api/sample/reset", { method: "POST" });
      window.sessionStorage.removeItem("andaj-cart-v1");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-leaf">Andaj Ghar Chakki</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">Aaj patthar pe</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-mist">
            Packed atta, gehun aur cheeni ka counter. Jo apna dana le aaye unke liye alag chakki queue.
            Shops ko wholesale aur udhaar milta hai.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void resetSample()} disabled={resetting}>
            <RefreshCw className="h-4 w-4" />
            Reset sample
          </Button>
          <Button asChild>
            <Link href="/counter">Open counter</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-sm text-[#6f2a22]">
          <span>{error}</span>
          <button className="font-medium underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          href="/bills"
          label="Collected today"
          value={data ? rupees(data.collectedToday) : "—"}
          hint={data ? `${data.billsToday} bills` : "Loading the book"}
        />
        <Stat
          href="/accounts"
          label="Shop udhaar"
          value={data ? rupees(data.shopUdhaar) : "—"}
          hint="Karyana pe khula hisaab"
        />
        <Stat
          href="/chakki"
          label="Mill tickets"
          value={data ? String(data.millTickets) : "—"}
          hint="Jo gehun abhi floor pe hai"
        />
        <Stat
          href="/orders"
          label="Open shop orders"
          value={data ? String(data.openOrders) : "—"}
          hint="Waiting to pack or deliver"
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Low bags</h2>
            <Link href="/counter" className="text-sm text-leaf">
              Sell
            </Link>
          </div>
          {!data ? (
            <p className="mt-6 text-sm text-mist">Checking the godown…</p>
          ) : data.lowBags.length === 0 ? (
            <p className="mt-6 text-sm text-mist">Stock is healthy.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {data.lowBags.map((product) => (
                <li key={product.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {product.name}
                    <span className="ml-2 text-mist">{product.sku}</span>
                  </span>
                  <span>{kg(product.stockKg)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-3xl bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Chakki queue</h2>
            <Link href="/chakki" className="text-sm text-leaf">
              Floor
            </Link>
          </div>
          {!data ? (
            <p className="mt-6 text-sm text-mist">Asking the floor…</p>
          ) : data.queue.length === 0 ? (
            <p className="mt-6 text-sm text-mist">The stones are clear.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.queue.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-medium">{ticket.customerName}</span>
                    <span className="text-mist">
                      {ticket.number} · {statusLabel[ticket.status] ?? ticket.status}
                    </span>
                  </span>
                  <span>{kg(ticket.wheatKg)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-3xl bg-sidebar p-6 text-[#e7f3ec]">
        <h2 className="font-display text-2xl text-white">Yeh counter kaise chalta hai</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <Guide
            title="Packed sale"
            body="Walk-in aur shops atta, gehun, cheeni aur daalain kilo se uthate hain. Shops ko bag rate khud mil jata hai."
          />
          <Guide
            title="Apna dana"
            body="Ghar wale gehun chakki pe daalte hain. Ticket yahin pisa rakhta hai, atta uthate waqt bill ban jata hai."
          />
          <Guide
            title="Shop call-ins"
            body="Bill ko order ki tarah park karo, 25/50 kg bori pack karo, phir cash, Raast ya udhaar wasool karo."
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <Link href={href} className="rounded-3xl bg-white p-4 transition hover:-translate-y-0.5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-mist">
        {label}
        <ArrowUpRight className="h-4 w-4" />
      </div>
      <p className="mt-3 font-display text-3xl">{value}</p>
      <p className="mt-1 text-sm text-mist">{hint}</p>
    </Link>
  );
}

function Guide({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-lime">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#c5d9ce]">{body}</p>
    </div>
  );
}

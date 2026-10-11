"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { kg, rupees, statusLabel, when } from "@/lib/money";
import type { ShopOrder } from "@/lib/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(async () => {
    try {
      setOrders(await api<ShopOrder[]>("/api/orders"));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Shop orders could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function move(id: number, status: string) {
    try {
      await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the order.");
    }
  }

  async function cancel(id: number) {
    if (!window.confirm("Cancel this parked order?")) return;
    try {
      await api(`/api/orders/${id}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel the order.");
    }
  }

  const rows = (orders ?? []).filter((order) =>
    filter === "all" ? true : order.status === "open" || order.status === "packing" || order.status === "out",
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-leaf">Shop call-ins</p>
          <h1 className="font-display text-4xl">Orders waiting on bags</h1>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>
            Open
          </Button>
          <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            All
          </Button>
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-sm text-[#6f2a22]">{error}</p>}
      {!orders ? (
        <p className="mt-8 text-sm text-mist">Loading the packing list…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-3xl bg-white px-5 py-12 text-center text-sm text-mist">
          No shop orders in this list. Park a ticket from the counter when a shop calls ahead.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((order) => {
            const amount = order.lines.reduce((sum, line) => sum + line.qtyKg * line.rate, 0);
            const closed = order.status === "delivered" || order.status === "cancelled";
            return (
              <article key={order.id} className="rounded-3xl bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-mist">
                      {order.number} · {when(order.createdAt)} · {order.cashier}
                    </p>
                    <h2 className="font-display text-2xl">{order.customerName}</h2>
                    <p className="text-sm text-leaf">{statusLabel[order.status] ?? order.status}</p>
                  </div>
                  <p className="font-display text-3xl">{rupees(amount)}</p>
                </div>
                <ul className="mt-3 text-sm text-mist">
                  {order.lines.map((line) => (
                    <li key={line.id}>
                      {line.name} · {kg(line.qtyKg)}
                      {line.shopRate ? " · shop rate" : ""}
                    </li>
                  ))}
                </ul>
                {order.note && <p className="mt-2 text-sm">{order.note}</p>}
                {!closed && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => void move(order.id, "packing")}>
                        Start packing
                      </Button>
                    )}
                    {order.status === "packing" && (
                      <Button size="sm" variant="outline" onClick={() => void move(order.id, "out")}>
                        Out for delivery
                      </Button>
                    )}
                    <Button size="sm" asChild>
                      <Link href={`/counter?order=${order.id}`}>Take payment</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void cancel(order.id)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

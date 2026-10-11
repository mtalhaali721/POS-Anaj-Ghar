"use client";

import { useCallback, useEffect, useState } from "react";
import { useCashier } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { rupees, when } from "@/lib/money";
import type { Customer, LedgerEntry } from "@/lib/types";

export default function AccountsPage() {
  const { cashier } = useCashier();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (q = "") => {
    try {
      const rows = await api<Customer[]>(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setCustomers(rows);
      setError("");
      return rows;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The khata could not load.");
      return [];
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openKhata(customer: Customer) {
    setSelected(customer);
    setAmount("");
    setNote("");
    try {
      setLedger(await api<LedgerEntry[]>(`/api/customers/${customer.id}/ledger`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not read the ledger.");
    }
  }

  async function wasool() {
    if (!selected) return;
    setError("");
    try {
      const updated = await api<Customer>(`/api/customers/${selected.id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount), note, cashier: cashier.name }),
      });
      setSelected(updated);
      setAmount("");
      setLedger(await api<LedgerEntry[]>(`/api/customers/${updated.id}/ledger`));
      await load(query);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The payment did not save.");
    }
  }

  const owing = (customers ?? []).reduce((sum, customer) => sum + customer.balance, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs uppercase tracking-[0.18em] text-leaf">Khata</p>
      <h1 className="font-display text-4xl">Shop udhaar</h1>
      <p className="mt-2 text-sm text-mist">Open balance across shops: {customers ? rupees(owing) : "…"}</p>
      {error && <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-sm text-[#6f2a22]">{error}</p>}
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl bg-white">
          <div className="border-b border-line p-4">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                void load(event.target.value);
              }}
              placeholder="Search a shop, code, or phone"
              className="h-10 w-full rounded-full border border-line px-4 text-sm outline-none focus:border-leaf"
            />
          </div>
          {!customers ? (
            <p className="p-5 text-sm text-mist">Opening the books…</p>
          ) : customers.length === 0 ? (
            <p className="p-5 text-sm text-mist">No khata matches that search.</p>
          ) : (
            <ul className="divide-y divide-line">
              {customers.map((customer) => (
                <li key={customer.id}>
                  <button className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-foam" onClick={() => void openKhata(customer)}>
                    <span>
                      <span className="block font-medium">{customer.name}</span>
                      <span className="text-xs text-mist">
                        {customer.code} · limit {rupees(customer.limit)}
                        {customer.wholesale ? " · wholesale" : ""}
                      </span>
                    </span>
                    <span className="font-display text-2xl">{rupees(customer.balance)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="h-fit rounded-3xl bg-white p-5">
          {!selected ? (
            <p className="text-sm text-mist">Pick a shop to see the khata and record a wasooli.</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.16em] text-mist">{selected.code}</p>
              <h2 className="font-display text-3xl">{selected.name}</h2>
              <p className="text-sm text-mist">{selected.phone || "No phone"}</p>
              <p className="mt-3 font-display text-4xl">{rupees(selected.balance)}</p>
              <p className="text-xs text-mist">of {rupees(selected.limit)}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-foam">
                <div
                  className="h-full bg-leaf"
                  style={{ width: `${Math.min(100, selected.limit ? (selected.balance / selected.limit) * 100 : 0)}%` }}
                />
              </div>
              {selected.note && <p className="mt-3 text-sm text-mist">{selected.note}</p>}
              <form
                className="mt-4 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void wasool();
                }}
              >
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount received"
                  className="h-10 w-full rounded-2xl border border-line px-3 text-sm"
                  inputMode="decimal"
                />
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Note"
                  className="h-10 w-full rounded-2xl border border-line px-3 text-sm"
                />
                <Button type="submit" className="w-full">
                  Record wasooli
                </Button>
              </form>
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
                {ledger.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-3 border-t border-line pt-2">
                    <span>
                      <span className="block capitalize">{entry.kind}</span>
                      <span className="text-xs text-mist">
                        {when(entry.createdAt)}
                        {entry.billNumber ? ` · ${entry.billNumber}` : ""}
                      </span>
                    </span>
                    <span>{rupees(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

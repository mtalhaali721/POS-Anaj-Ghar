"use client";

import { useCallback, useEffect, useState } from "react";
import { ReceiptDialog } from "@/components/receipt";
import { useCashier } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { kg, rupees, statusLabel, when } from "@/lib/money";
import type { Bill, MillTicket } from "@/lib/types";

const nextStatus: Record<string, string> = {
  received: "milling",
  milling: "ready",
};

export default function ChakkiPage() {
  const { cashier } = useCashier();
  const [tickets, setTickets] = useState<MillTicket[] | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wheat, setWheat] = useState("20");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<Bill | null>(null);
  const [method, setMethod] = useState<"cash" | "raast" | "card">("cash");

  const load = useCallback(async () => {
    try {
      setTickets(await api<MillTicket[]>("/api/tickets"));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The floor list could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function addTicket() {
    setError("");
    try {
      await api("/api/tickets", {
        method: "POST",
        body: JSON.stringify({ customerName: name, phone, wheatKg: Number(wheat), note }),
      });
      setName("");
      setPhone("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not take the wheat in.");
    }
  }

  async function advance(ticket: MillTicket) {
    const status = nextStatus[ticket.status];
    if (!status) return;
    try {
      await api(`/api/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not move the ticket.");
    }
  }

  async function collect(ticket: MillTicket) {
    try {
      const bill = await api<Bill>(`/api/tickets/${ticket.id}/collect`, {
        method: "POST",
        body: JSON.stringify({ method, cashier: cashier.name, counter: cashier.counter }),
      });
      setReceipt(bill);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not bill the milling.");
    }
  }

  const open = (tickets ?? []).filter((ticket) => ticket.status !== "collected");
  const done = (tickets ?? []).filter((ticket) => ticket.status === "collected");

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs uppercase tracking-[0.18em] text-leaf">Apna dana</p>
      <h1 className="font-display text-4xl">Chakki queue</h1>
      <p className="mt-2 max-w-2xl text-sm text-mist">
        House wheat waits here until the stones finish. The bill is the milling charge, taken when they pick the atta up.
      </p>
      {error && <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-sm text-[#6f2a22]">{error}</p>}

      <form
        className="mt-5 grid gap-3 rounded-3xl bg-white p-5 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void addTicket();
        }}
      >
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Wheat kg" value={wheat} onChange={setWheat} />
        <Field label="Note" value={note} onChange={setNote} />
        <div className="md:col-span-4">
          <Button type="submit">Take wheat in</Button>
        </div>
      </form>

      {!tickets ? (
        <p className="mt-6 text-sm text-mist">Asking the floor…</p>
      ) : open.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-white px-5 py-10 text-center text-sm text-mist">The floor is clear.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {open.map((ticket) => (
            <article key={ticket.id} className="rounded-3xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-mist">
                    {ticket.number} · {when(ticket.createdAt)}
                  </p>
                  <h2 className="font-display text-2xl">{ticket.customerName}</h2>
                  <p className="text-sm text-mist">
                    {kg(ticket.wheatKg)} · {rupees(ticket.ratePerKg)} / kg · {statusLabel[ticket.status]}
                  </p>
                  {ticket.note && <p className="mt-1 text-sm">{ticket.note}</p>}
                </div>
                <p className="font-display text-3xl">{rupees(ticket.wheatKg * ticket.ratePerKg)}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {nextStatus[ticket.status] && (
                  <Button size="sm" variant="outline" onClick={() => void advance(ticket)}>
                    Mark {statusLabel[nextStatus[ticket.status]].toLowerCase()}
                  </Button>
                )}
                <label className="text-xs text-mist">
                  Collect with
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value as "cash" | "raast" | "card")}
                    className="ml-2 h-8 rounded-full border border-line bg-white px-2 text-sm text-ink"
                  >
                    <option value="cash">Cash</option>
                    <option value="raast">Raast</option>
                    <option value="card">Card</option>
                  </select>
                </label>
                <Button size="sm" onClick={() => void collect(ticket)}>
                  Bill and collect
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Collected today</h2>
          <ul className="mt-3 divide-y divide-line rounded-3xl bg-white px-5">
            {done.map((ticket) => (
              <li key={ticket.id} className="flex justify-between py-3 text-sm">
                <span>
                  {ticket.customerName} · {ticket.number}
                </span>
                <span className="text-mist">{kg(ticket.wheatKg)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ReceiptDialog bill={receipt} onOpenChange={(open) => !open && setReceipt(null)} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs text-mist">
      {label}
      <input
        required={label === "Name" || label === "Wheat kg"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-2xl border border-line px-3 text-sm text-ink"
      />
    </label>
  );
}

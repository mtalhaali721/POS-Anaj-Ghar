"use client";

import { useCallback, useEffect, useState } from "react";
import { ReceiptDialog } from "@/components/receipt";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { methodLabel, rupees, when } from "@/lib/money";
import type { Bill } from "@/lib/types";

const filters = ["all", "cash", "card", "raast", "udhaar", "void"];

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Bill | null>(null);

  const load = useCallback(async (method: string) => {
    try {
      const path = method === "all" ? "/api/bills" : `/api/bills?method=${method}`;
      setBills(await api<Bill[]>(path));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bills could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(filter), 0);
    return () => window.clearTimeout(timer);
  }, [filter, load]);

  async function voidBill(bill: Bill) {
    if (!window.confirm(`Void ${bill.number}? Stock and udhaar will be put back.`)) return;
    try {
      await api(`/api/bills/${bill.id}/void`, { method: "POST" });
      await load(filter);
      setOpen(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not void the bill.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs uppercase tracking-[0.18em] text-leaf">Day book</p>
      <h1 className="font-display text-4xl">Bills</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <Button key={item} size="sm" variant={filter === item ? "default" : "outline"} onClick={() => setFilter(item)}>
            {item === "all" ? "All" : methodLabel[item] ?? "Void"}
          </Button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-sm text-[#6f2a22]">{error}</p>}
      <div className="mt-4 overflow-hidden rounded-3xl bg-white">
        {!bills ? (
          <p className="p-5 text-sm text-mist">Opening the day book…</p>
        ) : bills.length === 0 ? (
          <p className="p-8 text-center text-sm text-mist">No bills in this filter yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-mist">
              <tr>
                <th className="px-4 py-3 font-medium">Bill</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">When</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <button className="font-medium text-leaf" onClick={() => setOpen(bill)}>
                      {bill.number}
                    </button>
                    {bill.status === "void" && <span className="ml-2 text-xs text-[#8d2d2d]">void</span>}
                  </td>
                  <td className="px-4 py-3">{bill.customerName}</td>
                  <td className="px-4 py-3">{methodLabel[bill.method] ?? bill.method}</td>
                  <td className="hidden px-4 py-3 text-mist md:table-cell">{when(bill.createdAt)}</td>
                  <td className="px-4 py-3 text-right">{rupees(bill.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ReceiptDialog bill={open} onOpenChange={(next) => !next && setOpen(null)} onVoid={(bill) => void voidBill(bill)} />
    </div>
  );
}

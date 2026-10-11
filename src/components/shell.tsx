"use client";

import {
  BookOpen,
  LayoutGrid,
  Menu,
  Package,
  Receipt,
  Store,
  Wheat,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Cashier, Staff } from "@/lib/types";

const CashierContext = createContext<{
  cashier: Cashier;
  setCashier: (cashier: Cashier) => void;
} | null>(null);

export function useCashier() {
  const value = useContext(CashierContext);
  if (!value) throw new Error("Cashier is only available inside the counter shell.");
  return value;
}

const links = [
  { href: "/", label: "Board", icon: LayoutGrid },
  { href: "/counter", label: "Counter", icon: Store },
  { href: "/orders", label: "Shop orders", icon: Package },
  { href: "/chakki", label: "Chakki", icon: Wheat },
  { href: "/accounts", label: "Accounts", icon: BookOpen },
  { href: "/bills", label: "Bills", icon: Receipt },
];

const fallback: Cashier = { name: "Ayesha Khan", counter: "Counter 1" };
const cashierKey = "andaj-cashier";
let cashierNow = fallback;
let cashierHydrated = false;

function hydrateCashier() {
  if (cashierHydrated || typeof window === "undefined") return;
  cashierHydrated = true;
  const saved = window.localStorage.getItem(cashierKey);
  if (!saved) return;
  try {
    cashierNow = JSON.parse(saved) as Cashier;
  } catch {
    window.localStorage.removeItem(cashierKey);
  }
}

function subscribeCashier(onStoreChange: () => void) {
  window.addEventListener("andaj-cashier", onStoreChange);
  return () => window.removeEventListener("andaj-cashier", onStoreChange);
}

function readCashier() {
  hydrateCashier();
  return cashierNow;
}

function publishCashier(next: Cashier) {
  cashierNow = next;
  window.localStorage.setItem(cashierKey, JSON.stringify(next));
  window.dispatchEvent(new Event("andaj-cashier"));
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [picking, setPicking] = useState(false);
  const cashier = useSyncExternalStore(subscribeCashier, readCashier, () => fallback);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const kick = window.setTimeout(() => setNow(new Date()), 0);
    api<Staff[]>("/api/staff")
      .then(setStaff)
      .catch(() => setStaff([]));
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(kick);
    };
  }, []);

  const setCashier = (next: Cashier) => {
    publishCashier(next);
    setPicking(false);
  };

  const clock = useMemo(() => {
    if (!now) return { day: "Karachi", time: "" };
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(now);
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    return { day, time };
  }, [now]);

  return (
    <CashierContext.Provider value={{ cashier, setCashier }}>
      <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
        <button
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-sidebar text-white md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/40 md:hidden",
            open ? "block" : "hidden",
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col bg-sidebar px-3 py-4 text-white transition-transform md:static md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-6 flex items-start justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-lime text-ink">
                <Wheat className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Andaj Ghar</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8eaaa0]">Chakki POS</p>
              </div>
            </div>
            <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="space-y-1">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-3 py-2 text-sm text-[#d5e6dc]",
                    active && "bg-lime font-medium text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto">
            <button
              className="w-full rounded-2xl bg-[#0b1c16] p-3 text-left"
              onClick={() => setPicking((value) => !value)}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-xs font-semibold text-ink">
                  {cashier.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span>
                  <span className="block text-sm font-medium">{cashier.name}</span>
                  <span className="block text-[11px] text-[#8eaaa0]">{cashier.counter}</span>
                </span>
              </div>
              <span className="mt-2 block text-[11px] text-[#8eaaa0]">
                {clock.day}
                {clock.time ? ` · ${clock.time}` : ""}
              </span>
            </button>
            {picking && (
              <div className="mt-2 space-y-1 rounded-2xl bg-[#0b1c16] p-2">
                {(staff.length ? staff : [{ id: 0, ...fallback, role: "Cashier", email: "", active: true }]).map(
                  (person) => (
                    <button
                      key={person.id}
                      className="block w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-white/5"
                      onClick={() => setCashier({ name: person.name, counter: person.counter })}
                    >
                      <span className="block">{person.name}</span>
                      <span className="text-[11px] text-[#8eaaa0]">
                        {person.role} · {person.counter}
                      </span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </aside>
        <main className="min-w-0 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>
    </CashierContext.Provider>
  );
}

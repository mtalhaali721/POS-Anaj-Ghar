"use client";

import { kg, methodLabel, rupees, when } from "@/lib/money";
import type { Bill } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function ReceiptDialog({
  bill,
  onOpenChange,
  onVoid,
}: {
  bill: Bill | null;
  onOpenChange: (open: boolean) => void;
  onVoid?: (bill: Bill) => void;
}) {
  return (
    <Dialog open={bill !== null} onOpenChange={onOpenChange}>
      <DialogContent className="print:static print:w-full print:translate-x-0 print:translate-y-0 print:shadow-none">
        {bill && (
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-leaf">Andaj Ghar Chakki</p>
            <DialogTitle>{bill.number}</DialogTitle>
            <DialogDescription>
              {when(bill.createdAt)} · {bill.cashier} · {bill.counter}
            </DialogDescription>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-mist">Customer</span>
                <span>{bill.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mist">Payment</span>
                <span>
                  {methodLabel[bill.method] ?? bill.method}
                  {bill.status === "void" ? " · void" : ""}
                </span>
              </div>
              <div className="divide-y divide-line border-y border-line">
                {bill.lines.map((line) => (
                  <div key={line.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium">{line.name}</p>
                      <p className="text-xs text-mist">
                        {kg(line.qtyKg)} · {rupees(line.rate)} / kg
                        {line.shopRate ? " · shop" : ""}
                      </p>
                    </div>
                    <p>{rupees(line.gross)}</p>
                  </div>
                ))}
              </div>
              <Row label="Subtotal" value={rupees(bill.subtotal)} />
              <Row label="Discount" value={rupees(bill.discountAmount)} />
              <Row label="GST" value={rupees(bill.gst)} />
              <div className="flex items-end justify-between pt-1">
                <span className="text-mist">To collect</span>
                <span className="font-display text-3xl">{rupees(bill.total)}</span>
              </div>
              {bill.note && <p className="rounded-2xl bg-foam px-3 py-2 text-mist">{bill.note}</p>}
              {onVoid && bill.status !== "void" && (
                <Button variant="danger" onClick={() => onVoid(bill)}>
                  Void this bill
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-mist">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

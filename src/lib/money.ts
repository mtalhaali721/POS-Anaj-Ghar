export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function rupees(value: number) {
  const whole = Math.abs(value - Math.round(value)) < 0.001;
  const formatted = new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value);
  return `Rs ${formatted}`;
}

export function kg(value: number) {
  const whole = Math.abs(value - Math.round(value)) < 0.001;
  return `${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value)} kg`;
}

export type QuoteLine = { gross: number; net: number; gst: number };

export function quote(
  lines: { qtyKg: number; rate: number; gstPercent: number }[],
  discountPercent: number,
) {
  const factor = 1 - discountPercent / 100;
  let subtotal = 0;
  let discount = 0;
  let gst = 0;
  const detailed: QuoteLine[] = lines.map((line) => {
    const gross = round2(line.qtyKg * line.rate);
    const net = round2(gross * factor);
    const tax = round2((net * line.gstPercent) / 100);
    subtotal += gross;
    discount += gross - net;
    gst += tax;
    return { gross, net, gst: tax };
  });
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    gst: round2(gst),
    total: round2(subtotal - discount + gst),
    lines: detailed,
  };
}

export function when(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export const methodLabel: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  raast: "Raast",
  udhaar: "Udhaar",
};

export const statusLabel: Record<string, string> = {
  open: "Open",
  packing: "Packing",
  out: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  received: "Received",
  milling: "Milling",
  ready: "Ready",
  collected: "Collected",
  paid: "Paid",
  void: "Void",
};

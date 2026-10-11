export type Product = {
  id: number;
  name: string;
  subtitle: string;
  sku: string;
  category: string;
  pricePerKg: number;
  shopPricePerKg: number;
  stockKg: number;
  gstPercent: number;
  art: string;
  active: boolean;
};

export type Customer = {
  id: number;
  name: string;
  code: string;
  phone: string;
  kind: string;
  wholesale: boolean;
  balance: number;
  limit: number;
  note: string;
};

export type BillLine = {
  id: number;
  productId: number | null;
  name: string;
  sku: string;
  qtyKg: number;
  rate: number;
  shopRate: boolean;
  gstPercent: number;
  gross: number;
  net: number;
  gstAmount: number;
};

export type Bill = {
  id: number;
  number: string;
  createdAt: string;
  customerId: number | null;
  customerName: string;
  cashier: string;
  counter: string;
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  gst: number;
  total: number;
  note: string;
  method: string;
  status: string;
  orderId: number | null;
  ticketId: number | null;
  lines: BillLine[];
};

export type ShopOrderLine = {
  id: number;
  productId: number;
  name: string;
  sku: string;
  qtyKg: number;
  rate: number;
  shopRate: boolean;
};

export type ShopOrder = {
  id: number;
  number: string;
  createdAt: string;
  customerId: number | null;
  customerName: string;
  note: string;
  status: string;
  cashier: string;
  lines: ShopOrderLine[];
};

export type MillTicket = {
  id: number;
  number: string;
  createdAt: string;
  customerName: string;
  phone: string;
  wheatKg: number;
  ratePerKg: number;
  status: string;
  note: string;
  billId: number | null;
};

export type LedgerEntry = {
  id: number;
  customerId: number;
  createdAt: string;
  kind: string;
  amount: number;
  note: string;
  billNumber: string | null;
};

export type Staff = {
  id: number;
  name: string;
  role: string;
  counter: string;
  email: string;
  active: boolean;
};

export type Dashboard = {
  collectedToday: number;
  billsToday: number;
  shopUdhaar: number;
  millTickets: number;
  openOrders: number;
  lowStockKg: number;
  lowBags: Product[];
  queue: MillTicket[];
  shopName: string;
};

export type Cashier = { name: string; counter: string };

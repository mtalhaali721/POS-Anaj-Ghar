import { round2 } from "@/lib/money";
import type {
  Bill,
  BillLine,
  Customer,
  Dashboard,
  LedgerEntry,
  MillTicket,
  Product,
  ShopOrder,
  ShopOrderLine,
  Staff,
} from "@/lib/types";

export class CounterError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Settings = {
  id: number;
  shopName: string;
  millingRatePerKg: number;
  lowStockKg: number;
};

type Book = {
  settings: Settings;
  products: Product[];
  customers: Customer[];
  bills: Bill[];
  orders: ShopOrder[];
  tickets: MillTicket[];
  ledger: LedgerEntry[];
  staff: Staff[];
};

const storageKey = "andaj-book-v1";
const methods = ["cash", "card", "raast", "udhaar"];

let queue: Promise<unknown> = Promise.resolve();

function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function karachiDay(date = new Date()) {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = stamp.split("-").map(Number);
  return { year, month, day };
}

function karachiStamp(dayOffset: number, hour: number, minute: number) {
  const { year, month, day } = karachiDay();
  return new Date(Date.UTC(year, month - 1, day + dayOffset, hour - 5, minute, 0)).toISOString();
}

function isToday(iso: string) {
  const today = karachiDay();
  const then = karachiDay(new Date(iso));
  return today.year === then.year && today.month === then.month && today.day === then.day;
}

function nextId(rows: { id: number }[]) {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

function nextNumber(existing: string[], prefix: string, width: number) {
  let max = 0;
  for (const number of existing) {
    if (!number.startsWith(prefix)) continue;
    const value = Number.parseInt(number.slice(prefix.length), 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return prefix + String(max + 1).padStart(width, "0");
}

function loose(value: number) {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function quoteLines(lines: { qty: number; rate: number; gstPercent: number }[], discountPercent: number) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new CounterError("Discount has to sit between 0 and 100.");
  }
  if (lines.length === 0) throw new CounterError("The ticket is empty.");
  const factor = 1 - discountPercent / 100;
  let subtotal = 0;
  let discount = 0;
  let gst = 0;
  const detailed = lines.map((line) => {
    if (line.qty <= 0) throw new CounterError("Quantity has to be more than zero.");
    if (line.rate < 0) throw new CounterError("Rate cannot be negative.");
    const gross = round2(line.qty * line.rate);
    const net = round2(gross * factor);
    const tax = round2((net * line.gstPercent) / 100);
    subtotal += gross;
    discount += gross - net;
    gst += tax;
    return { gross, net, gstAmount: tax };
  });
  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discount),
    gst: round2(gst),
    total: round2(subtotal - discount + gst),
    lines: detailed,
  };
}

function product(
  id: number,
  name: string,
  subtitle: string,
  sku: string,
  category: string,
  price: number,
  shop: number,
  stock: number,
  art: string,
): Product {
  return {
    id,
    name,
    subtitle,
    sku,
    category,
    pricePerKg: price,
    shopPricePerKg: shop,
    stockKg: stock,
    gstPercent: 5,
    art,
    active: true,
  };
}

function customer(
  id: number,
  name: string,
  code: string,
  phone: string,
  balance: number,
  limit: number,
  note: string,
): Customer {
  return { id, name, code, phone, kind: "shop", wholesale: true, balance, limit, note };
}

function sampleBook(): Book {
  const products: Product[] = [
    product(1, "Chakki Atta", "Chakki atta", "FL-ATTA", "atta", 142, 136, 1360, "sack"),
    product(2, "Tandoori Atta", "Tandoori atta", "FL-TAND", "atta", 152, 146, 980, "sack"),
    product(3, "Maida", "Maida", "FL-MAIDA", "atta", 156, 149, 760, "sack"),
    product(4, "Sooji / Rawa", "Sooji", "FL-SOOJI", "atta", 158, 151, 540, "sack"),
    product(5, "Besan", "Besan", "FL-BESAN", "atta", 258, 246, 410, "sack"),
    product(6, "Chawal Atta", "Chawal atta", "FL-RICE", "atta", 170, 162, 260, "sack"),
    product(7, "Multigrain Atta", "Multi grain atta", "FL-MULT", "atta", 178, 170, 190, "sack"),
    product(8, "Wheat Bran", "Chokar", "FL-BRAN", "atta", 42, 38, 430, "bran"),
    product(9, "Desi Gehun", "Desi gehun", "WH-DESI", "gehun", 80, 76, 4000, "wheat"),
    product(10, "Punjab Gehun", "Punjab gehun", "WH-PUN", "gehun", 94, 90, 1860, "wheat"),
    product(11, "Durum Gehun", "Durum gehun", "WH-DUR", "gehun", 118, 112, 640, "wheat"),
    product(12, "Organic Gehun", "Organic gehun", "WH-ORG", "gehun", 108, 102, 310, "wheat-green"),
    product(13, "Safed Cheeni", "White sugar", "CH-WHITE", "cheeni", 168, 162, 820, "sugar"),
    product(14, "Shakkar", "Desi shakkar", "CH-SHAK", "cheeni", 172, 166, 260, "sugar"),
    product(15, "Brown Sugar", "Brown sugar", "CH-BROWN", "cheeni", 210, 198, 220, "sugar"),
    product(16, "Chana Dal", "Chana dal", "DL-CHANA", "daalain", 246, 236, 380, "dal"),
    product(17, "Moong Dal", "Moong dal", "DL-MOONG", "daalain", 280, 268, 210, "dal"),
    product(18, "Masoor Dal", "Masoor dal", "DL-MASOOR", "daalain", 232, 222, 300, "dal"),
    product(19, "Namak", "Iodised salt", "AU-SALT", "aur", 28, 24, 600, "salt"),
  ];
  const customers: Customer[] = [
    customer(1, "C. Sharma", "c-sharma", "0300 4127781", 24800, 150000, "Atta and maida, Thursday lorry"),
    customer(2, "Iqbal Store", "iqbal", "0321 5540192", 18600, 80000, "Pays on the first"),
    customer(3, "Noor Bakers", "noor", "0333 8802144", 14200, 60000, "Maida and chakki atta"),
    customer(4, "Rehmat Karyana", "rehmat", "0301 6672208", 12100, 50000, "Neighbourhood shop"),
    customer(5, "Madina Store", "madina", "0345 2199087", 8500, 40000, "Besan for the weekend"),
  ];
  const staff: Staff[] = [
    { id: 1, name: "Ayesha Khan", role: "Cashier", counter: "Counter 1", email: "ayesha@andajghar.pk", active: true },
    { id: 2, name: "Imran Ali", role: "Cashier", counter: "Counter 2", email: "imran@andajghar.pk", active: true },
    { id: 3, name: "Farah Naz", role: "Chakki desk", counter: "Floor", email: "farah@andajghar.pk", active: true },
  ];
  const ledger: LedgerEntry[] = customers.map((shop) => ({
    id: shop.id,
    customerId: shop.id,
    createdAt: karachiStamp(-12, 10, 0),
    kind: "udhaar",
    amount: shop.balance,
    note: "Opening khata",
    billNumber: null,
  }));

  const bills: Bill[] = [];
  const bill = (
    id: number,
    number: string,
    sku: string,
    qty: number,
    method: string,
    customerName: string,
    customerId: number | null,
    hour: number,
    minute: number,
    note: string,
  ) => {
    const item = products.find((row) => row.sku === sku);
    if (!item) throw new Error(`Missing seed product ${sku}`);
    const quote = quoteLines([{ qty, rate: item.pricePerKg, gstPercent: item.gstPercent }], 0);
    const line = quote.lines[0];
    bills.push({
      id,
      number,
      createdAt: karachiStamp(0, hour, minute),
      customerId,
      customerName,
      cashier: "Ayesha Khan",
      counter: "Counter 1",
      discountPercent: 0,
      subtotal: quote.subtotal,
      discountAmount: quote.discountAmount,
      gst: quote.gst,
      total: quote.total,
      note,
      method,
      status: "paid",
      orderId: null,
      ticketId: null,
      lines: [
        {
          id,
          productId: item.id,
          name: item.name,
          sku: item.sku,
          qtyKg: qty,
          rate: item.pricePerKg,
          shopRate: false,
          gstPercent: item.gstPercent,
          gross: line.gross,
          net: line.net,
          gstAmount: line.gstAmount,
        },
      ],
    });
  };
  bill(1, "AG-1841", "FL-ATTA", 40, "cash", "Walk-in", null, 9, 10, "10 kg packs");
  bill(2, "AG-1842", "FL-TAND", 25, "card", "Walk-in", null, 11, 40, "");
  bill(3, "AG-1843", "WH-DESI", 22, "raast", "C. Sharma", 1, 14, 5, "Shop rate off");

  const atta = products[0];
  const besan = products[4];
  const maida = products[2];
  const orders: ShopOrder[] = [
    {
      id: 1,
      number: "SO-204",
      createdAt: karachiStamp(0, 8, 20),
      customerId: 3,
      customerName: "Noor Bakers",
      note: "50 kg bori x2, deliver Thursday",
      status: "open",
      cashier: "Ayesha Khan",
      lines: [
        {
          id: 1,
          productId: atta.id,
          name: atta.name,
          sku: atta.sku,
          qtyKg: 100,
          rate: atta.shopPricePerKg,
          shopRate: true,
        },
      ],
    },
    {
      id: 2,
      number: "SO-205",
      createdAt: karachiStamp(0, 10, 5),
      customerId: 5,
      customerName: "Madina Store",
      note: "Pack before asr",
      status: "packing",
      cashier: "Imran Ali",
      lines: [
        {
          id: 2,
          productId: besan.id,
          name: besan.name,
          sku: besan.sku,
          qtyKg: 25,
          rate: besan.shopPricePerKg,
          shopRate: true,
        },
        {
          id: 3,
          productId: maida.id,
          name: maida.name,
          sku: maida.sku,
          qtyKg: 10,
          rate: maida.shopPricePerKg,
          shopRate: true,
        },
      ],
    },
  ];

  const tickets: MillTicket[] = [
    {
      id: 1,
      number: "MILL-0142",
      createdAt: karachiStamp(0, 7, 40),
      customerName: "Asma Bibi",
      phone: "0302 1188340",
      wheatKg: 20,
      ratePerKg: 10,
      status: "milling",
      note: "Desi gehun, fine chakki",
      billId: null,
    },
    {
      id: 2,
      number: "MILL-0143",
      createdAt: karachiStamp(0, 8, 15),
      customerName: "Ali Raza",
      phone: "0315 6621904",
      wheatKg: 40,
      ratePerKg: 10,
      status: "ready",
      note: "Will collect this evening",
      billId: null,
    },
    {
      id: 3,
      number: "MILL-0144",
      createdAt: karachiStamp(0, 12, 5),
      customerName: "Hussain Gharana",
      phone: "0334 9002217",
      wheatKg: 15,
      ratePerKg: 10,
      status: "received",
      note: "Keep the chokar separate",
      billId: null,
    },
  ];

  return {
    settings: { id: 1, shopName: "Andaj Ghar Chakki", millingRatePerKg: 10, lowStockKg: 180 },
    products,
    customers,
    bills,
    orders,
    tickets,
    ledger,
    staff,
  };
}

function readBook(): Book {
  if (typeof localStorage === "undefined") {
    throw new CounterError("The mill book opens in the browser.");
  }
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    const book = sampleBook();
    writeBook(book);
    return book;
  }
  try {
    return JSON.parse(raw) as Book;
  } catch {
    const book = sampleBook();
    writeBook(book);
    return book;
  }
}

function writeBook(book: Book) {
  localStorage.setItem(storageKey, JSON.stringify(book));
}

function dashboard(book: Book): Dashboard {
  const collected = book.bills.filter((bill) => bill.status === "paid" && isToday(bill.createdAt));
  const low = book.products
    .filter((item) => item.active && item.stockKg < book.settings.lowStockKg)
    .sort((a, b) => a.stockKg - b.stockKg);
  const queue = book.tickets
    .filter((ticket) => ticket.status !== "collected")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    collectedToday: round2(collected.reduce((sum, bill) => sum + bill.total, 0)),
    billsToday: collected.length,
    shopUdhaar: round2(book.customers.reduce((sum, shop) => sum + shop.balance, 0)),
    millTickets: queue.length,
    openOrders: book.orders.filter((order) => order.status === "open" || order.status === "packing" || order.status === "out").length,
    lowStockKg: book.settings.lowStockKg,
    lowBags: low,
    queue,
    shopName: book.settings.shopName,
  };
}

type LineInput = { productId: number; qtyKg: number; shopRate?: boolean | null };

function prepareLines(book: Book, lines: LineInput[], useShopDefault: boolean, reserveStock: boolean) {
  return lines.map((line) => {
    const item = book.products.find((row) => row.id === line.productId);
    if (!item) throw new CounterError("One of the items is no longer sold.");
    if (!item.active) throw new CounterError(`${item.name} is off the board.`);
    if (line.qtyKg <= 0) throw new CounterError(`Enter a quantity for ${item.name}.`);
    const already = lines
      .slice(0, lines.indexOf(line))
      .filter((row) => row.productId === item.id)
      .reduce((sum, row) => sum + row.qtyKg, 0);
    if (reserveStock && item.stockKg < already + line.qtyKg) {
      throw new CounterError(`${item.name} has ${loose(item.stockKg)} kg left.`);
    }
    const shop = line.shopRate ?? useShopDefault;
    return { product: item, qty: line.qtyKg, rate: shop ? item.shopPricePerKg : item.pricePerKg, shopRate: shop };
  });
}

function createBill(
  book: Book,
  input: {
    customerId?: number | null;
    discountPercent: number;
    note?: string | null;
    method: string;
    useShopRate: boolean;
    cashier?: string | null;
    counter?: string | null;
    fromOrderId?: number | null;
    lines: LineInput[];
  },
) {
  if (!methods.includes(input.method)) throw new CounterError("Choose cash, card, Raast, or udhaar.");
  if (!input.lines?.length) throw new CounterError("Add something to the ticket first.");
  const customer = findCustomer(book, input.customerId);
  if (input.method === "udhaar" && !customer) throw new CounterError("Udhaar needs a shop on the khata.");
  let order: ShopOrder | undefined;
  if (input.fromOrderId != null) {
    order = book.orders.find((row) => row.id === input.fromOrderId);
    if (!order) throw new CounterError("That parked order is gone.", 404);
    if (order.status === "delivered" || order.status === "cancelled") {
      throw new CounterError("This order is already closed.");
    }
  }
  const prepared = prepareLines(book, input.lines, input.useShopRate, true);
  const quote = quoteLines(
    prepared.map((line) => ({ qty: line.qty, rate: line.rate, gstPercent: line.product.gstPercent })),
    input.discountPercent,
  );
  if (customer && input.method === "udhaar" && customer.balance + quote.total > customer.limit) {
    throw new CounterError(
      `${customer.name} would cross the udhaar limit of Rs ${loose(customer.limit)}. Open limit is Rs ${loose(customer.limit - customer.balance)}.`,
    );
  }
  const number = nextNumber(
    book.bills.map((row) => row.number),
    "AG-",
    4,
  );
  let lineId = nextId(book.bills.flatMap((row) => row.lines));
  const bill: Bill = {
    id: nextId(book.bills),
    number,
    createdAt: new Date().toISOString(),
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? "Walk-in",
    cashier: input.cashier?.trim() || "Ayesha Khan",
    counter: input.counter?.trim() || "Counter 1",
    discountPercent: input.discountPercent,
    subtotal: quote.subtotal,
    discountAmount: quote.discountAmount,
    gst: quote.gst,
    total: quote.total,
    note: input.note?.trim() ?? "",
    method: input.method,
    status: input.method === "udhaar" ? "udhaar" : "paid",
    orderId: order?.id ?? null,
    ticketId: null,
    lines: prepared.map((line, index) => {
      const quoted = quote.lines[index];
      const row: BillLine = {
        id: lineId,
        productId: line.product.id,
        name: line.product.name,
        sku: line.product.sku,
        qtyKg: line.qty,
        rate: line.rate,
        shopRate: line.shopRate,
        gstPercent: line.product.gstPercent,
        gross: quoted.gross,
        net: quoted.net,
        gstAmount: quoted.gstAmount,
      };
      lineId += 1;
      return row;
    }),
  };
  for (const line of prepared) line.product.stockKg = round2(line.product.stockKg - line.qty);
  if (customer && input.method === "udhaar") {
    customer.balance = round2(customer.balance + quote.total);
    book.ledger.push({
      id: nextId(book.ledger),
      customerId: customer.id,
      createdAt: bill.createdAt,
      kind: "udhaar",
      amount: quote.total,
      note: "Counter udhaar",
      billNumber: number,
    });
  }
  if (order) order.status = "delivered";
  book.bills.push(bill);
  return bill;
}

function findCustomer(book: Book, id: number | null | undefined) {
  if (id == null) return undefined;
  const customer = book.customers.find((row) => row.id === id);
  if (!customer) throw new CounterError("That shop is not on the khata.", 404);
  return customer;
}

function codeFromName(name: string) {
  const compact = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const stem = compact.slice(0, 12);
  return stem || "shop";
}

function uniqueCode(book: Book, code: string) {
  const stem = code.trim() || "shop";
  let candidate = stem;
  let n = 2;
  while (book.customers.some((row) => row.code === candidate)) {
    candidate = stem + n;
    n += 1;
  }
  return candidate;
}

async function mutate<T>(work: (book: Book) => T) {
  return exclusive(async () => {
    const book = await readBook();
    const result = work(book);
    await writeBook(book);
    return result;
  });
}

async function read<T>(work: (book: Book) => T) {
  return exclusive(async () => work(await readBook()));
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function dispatch(request: Request, slug: string[]) {
  const [a, b, c] = slug;
  const method = request.method;
  const url = new URL(request.url);

  if (a === "dashboard" && !b && method === "GET") return json(await read(dashboard));

  if (a === "sample" && b === "reset" && !c && method === "POST") {
    return json(
      await exclusive(async () => {
        await writeBook(sampleBook());
        return { ok: true };
      }),
    );
  }

  if (a === "products" && !b && method === "GET") {
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const category = url.searchParams.get("category");
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    return json(
      await read((book) =>
        book.products
          .filter((item) => includeInactive || item.active)
          .filter((item) => !category || category === "tamam" || item.category === category)
          .filter((item) => !q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
          .sort((left, right) => left.id - right.id),
      ),
    );
  }

  if (a === "customers" && !b && method === "GET") {
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    return json(
      await read((book) =>
        book.customers
          .filter((shop) => !q || shop.name.toLowerCase().includes(q) || shop.code.toLowerCase().includes(q) || shop.phone.includes(q))
          .sort((left, right) => right.balance - left.balance || left.name.localeCompare(right.name, undefined, { sensitivity: "accent" })),
      ),
    );
  }

  if (a === "customers" && !b && method === "POST") {
    const input = await readJson<{
      name?: string;
      code?: string;
      phone?: string;
      kind?: string;
      wholesale?: boolean;
      limit?: number;
      note?: string;
    }>(request);
    return json(
      await mutate((book) => {
        if (!input.name?.trim()) throw new CounterError("The khata needs a name.");
        if ((input.limit ?? 0) < 0) throw new CounterError("The limit cannot be negative.");
        const kind = input.kind?.trim() || "shop";
        if (kind !== "shop" && kind !== "house" && kind !== "walkin") {
          throw new CounterError("Kind must be shop, house, or walk-in.");
        }
        const shop: Customer = {
          id: nextId(book.customers),
          name: input.name.trim(),
          code: uniqueCode(book, input.code?.trim().toLowerCase() || codeFromName(input.name)),
          phone: input.phone?.trim() ?? "",
          kind,
          wholesale: Boolean(input.wholesale),
          balance: 0,
          limit: input.limit ?? 0,
          note: input.note?.trim() ?? "",
        };
        book.customers.push(shop);
        return shop;
      }),
    );
  }

  if (a === "customers" && b && c === "ledger" && method === "GET") {
    const id = Number(b);
    return json(
      await read((book) => {
        if (!book.customers.some((shop) => shop.id === id)) throw new CounterError("That khata is not open.", 404);
        return book.ledger
          .filter((row) => row.customerId === id)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      }),
    );
  }

  if (a === "customers" && b && c === "payments" && method === "POST") {
    const id = Number(b);
    const input = await readJson<{ amount?: number; note?: string; cashier?: string }>(request);
    return json(
      await mutate((book) => {
        if (!input.amount || input.amount <= 0) throw new CounterError("Enter the amount that came in.");
        const shop = book.customers.find((row) => row.id === id);
        if (!shop) throw new CounterError("That khata is not open.", 404);
        if (input.amount > shop.balance) {
          throw new CounterError(`${shop.name} only has Rs ${Math.round(shop.balance)} open. Take that, or less.`);
        }
        shop.balance = round2(shop.balance - input.amount);
        book.ledger.push({
          id: nextId(book.ledger),
          customerId: shop.id,
          createdAt: new Date().toISOString(),
          kind: "wasool",
          amount: input.amount,
          note: input.note?.trim() || `Wasool at ${input.cashier?.trim() || "counter"}`,
          billNumber: null,
        });
        return shop;
      }),
    );
  }

  if (a === "bills" && !b && method === "GET") {
    const filter = url.searchParams.get("method");
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get("take") ?? 80) || 80));
    return json(
      await read((book) =>
        book.bills
          .filter((bill) => !filter || filter === "all" || bill.method === filter || bill.status === filter)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, take),
      ),
    );
  }

  if (a === "bills" && b && !c && method === "GET") {
    const id = Number(b);
    return json(
      await read((book) => {
        const bill = book.bills.find((row) => row.id === id);
        if (!bill) throw new CounterError("That bill is not in the book.", 404);
        return bill;
      }),
    );
  }

  if (a === "bills" && !b && method === "POST") {
    const input = await readJson<{
      customerId?: number | null;
      discountPercent?: number;
      note?: string | null;
      method: string;
      useShopRate?: boolean;
      cashier?: string | null;
      counter?: string | null;
      fromOrderId?: number | null;
      lines: LineInput[];
    }>(request);
    return json(
      await mutate((book) =>
        createBill(book, {
          ...input,
          discountPercent: input.discountPercent ?? 0,
          useShopRate: Boolean(input.useShopRate),
        }),
      ),
    );
  }

  if (a === "bills" && b && c === "void" && method === "POST") {
    const id = Number(b);
    return json(
      await mutate((book) => {
        const bill = book.bills.find((row) => row.id === id);
        if (!bill) throw new CounterError("That bill is not in the book.", 404);
        if (bill.status === "void") throw new CounterError("This bill is already void.");
        for (const line of bill.lines) {
          if (line.productId == null) continue;
          const item = book.products.find((row) => row.id === line.productId);
          if (item) item.stockKg = round2(item.stockKg + line.qtyKg);
        }
        if (bill.method === "udhaar" && bill.customerId != null) {
          const shop = book.customers.find((row) => row.id === bill.customerId);
          if (shop) {
            shop.balance = round2(Math.max(0, shop.balance - bill.total));
            book.ledger.push({
              id: nextId(book.ledger),
              customerId: shop.id,
              createdAt: new Date().toISOString(),
              kind: "void",
              amount: bill.total,
              note: "Bill voided",
              billNumber: bill.number,
            });
          }
        }
        if (bill.ticketId != null) {
          const ticket = book.tickets.find((row) => row.id === bill.ticketId);
          if (ticket) {
            ticket.status = "ready";
            ticket.billId = null;
          }
        }
        bill.status = "void";
        return bill;
      }),
    );
  }

  if (a === "orders" && !b && method === "GET") {
    return json(await read((book) => [...book.orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt))));
  }

  if (a === "orders" && !b && method === "POST") {
    const input = await readJson<{
      customerId?: number | null;
      note?: string | null;
      cashier?: string | null;
      useShopRate?: boolean;
      lines: LineInput[];
    }>(request);
    return json(
      await mutate((book) => {
        if (!input.lines?.length) throw new CounterError("Park at least one item.");
        const customer = input.customerId != null ? findCustomer(book, input.customerId) : undefined;
        const prepared = prepareLines(book, input.lines, Boolean(input.useShopRate), false);
        let lineId = nextId(book.orders.flatMap((row) => row.lines));
        const order: ShopOrder = {
          id: nextId(book.orders),
          number: nextNumber(
            book.orders.map((row) => row.number),
            "SO-",
            3,
          ),
          createdAt: new Date().toISOString(),
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? "Walk-in",
          note: input.note?.trim() ?? "",
          status: "open",
          cashier: input.cashier?.trim() || "Ayesha Khan",
          lines: prepared.map((line) => {
            const row: ShopOrderLine = {
              id: lineId,
              productId: line.product.id,
              name: line.product.name,
              sku: line.product.sku,
              qtyKg: line.qty,
              rate: line.rate,
              shopRate: line.shopRate,
            };
            lineId += 1;
            return row;
          }),
        };
        book.orders.push(order);
        return order;
      }),
    );
  }

  if (a === "orders" && b && !c && method === "PATCH") {
    const id = Number(b);
    const input = await readJson<{ status?: string }>(request);
    return json(
      await mutate((book) => {
        const allowed = ["open", "packing", "out"];
        if (!input.status || !allowed.includes(input.status)) {
          throw new CounterError("Move the order to open, packing, or out for delivery.");
        }
        const order = book.orders.find((row) => row.id === id);
        if (!order) throw new CounterError("That order is not on the board.", 404);
        if (order.status === "delivered" || order.status === "cancelled") {
          throw new CounterError("This order is already closed.");
        }
        order.status = input.status;
        return order;
      }),
    );
  }

  if (a === "orders" && b && c === "cancel" && method === "POST") {
    const id = Number(b);
    return json(
      await mutate((book) => {
        const order = book.orders.find((row) => row.id === id);
        if (!order) throw new CounterError("That order is not on the board.", 404);
        if (order.status === "delivered" || order.status === "cancelled") {
          throw new CounterError("This order is already closed.");
        }
        order.status = "cancelled";
        return order;
      }),
    );
  }

  if (a === "tickets" && !b && method === "GET") {
    return json(await read((book) => [...book.tickets].sort((left, right) => right.createdAt.localeCompare(left.createdAt))));
  }

  if (a === "tickets" && !b && method === "POST") {
    const input = await readJson<{
      customerName?: string;
      phone?: string;
      wheatKg?: number;
      note?: string;
      ratePerKg?: number;
    }>(request);
    return json(
      await mutate((book) => {
        if (!input.customerName?.trim()) throw new CounterError("Whose gehun is this?");
        if (!input.wheatKg || input.wheatKg <= 0) throw new CounterError("Enter how many kilos came in.");
        const rate = input.ratePerKg ?? book.settings.millingRatePerKg;
        if (rate < 0) throw new CounterError("Milling rate cannot be negative.");
        const ticket: MillTicket = {
          id: nextId(book.tickets),
          number: nextNumber(
            book.tickets.map((row) => row.number),
            "MILL-",
            4,
          ),
          createdAt: new Date().toISOString(),
          customerName: input.customerName.trim(),
          phone: input.phone?.trim() ?? "",
          wheatKg: input.wheatKg,
          ratePerKg: rate,
          status: "received",
          note: input.note?.trim() ?? "",
          billId: null,
        };
        book.tickets.push(ticket);
        return ticket;
      }),
    );
  }

  if (a === "tickets" && b && !c && method === "PATCH") {
    const id = Number(b);
    const input = await readJson<{ status?: string }>(request);
    return json(
      await mutate((book) => {
        const allowed = ["received", "milling", "ready"];
        if (!input.status || !allowed.includes(input.status)) {
          throw new CounterError("Set the ticket to received, milling, or ready.");
        }
        const ticket = book.tickets.find((row) => row.id === id);
        if (!ticket) throw new CounterError("That ticket is not on the floor.", 404);
        if (ticket.status === "collected") throw new CounterError("This wheat has already been collected.");
        ticket.status = input.status;
        return ticket;
      }),
    );
  }

  if (a === "tickets" && b && c === "collect" && method === "POST") {
    const id = Number(b);
    const input = await readJson<{
      method?: string;
      customerId?: number | null;
      cashier?: string | null;
      counter?: string | null;
      note?: string | null;
    }>(request);
    return json(
      await mutate((book) => {
        if (!input.method || !methods.includes(input.method)) {
          throw new CounterError("Choose cash, card, Raast, or udhaar.");
        }
        const ticket = book.tickets.find((row) => row.id === id);
        if (!ticket) throw new CounterError("That ticket is not on the floor.", 404);
        if (ticket.status === "collected") throw new CounterError("This ticket is already billed.");
        let customer: Customer | undefined;
        if (input.customerId != null) {
          customer = book.customers.find((row) => row.id === input.customerId);
          if (!customer) throw new CounterError("That khata is not open.", 404);
        }
        if (input.method === "udhaar" && !customer) throw new CounterError("Udhaar needs a shop or house on the khata.");
        const quote = quoteLines([{ qty: ticket.wheatKg, rate: ticket.ratePerKg, gstPercent: 0 }], 0);
        const line = quote.lines[0];
        if (customer && input.method === "udhaar" && customer.balance + quote.total > customer.limit) {
          throw new CounterError(`${customer.name} would cross the udhaar limit of Rs ${Math.round(customer.limit)}.`);
        }
        const number = nextNumber(
          book.bills.map((row) => row.number),
          "AG-",
          4,
        );
        const createdAt = new Date().toISOString();
        const bill: Bill = {
          id: nextId(book.bills),
          number,
          createdAt,
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? ticket.customerName,
          cashier: input.cashier?.trim() || "Farah Naz",
          counter: input.counter?.trim() || "Floor",
          discountPercent: 0,
          subtotal: quote.subtotal,
          discountAmount: 0,
          gst: quote.gst,
          total: quote.total,
          note: input.note?.trim() || `Apna dana ${ticket.number}`,
          method: input.method,
          status: input.method === "udhaar" ? "udhaar" : "paid",
          orderId: null,
          ticketId: ticket.id,
          lines: [
            {
              id: nextId(book.bills.flatMap((row) => row.lines)),
              productId: null,
              name: "Chakki milling",
              sku: "MILL",
              qtyKg: ticket.wheatKg,
              rate: ticket.ratePerKg,
              shopRate: false,
              gstPercent: 0,
              gross: line.gross,
              net: line.net,
              gstAmount: line.gstAmount,
            },
          ],
        };
        if (customer && input.method === "udhaar") {
          customer.balance = round2(customer.balance + quote.total);
          book.ledger.push({
            id: nextId(book.ledger),
            customerId: customer.id,
            createdAt,
            kind: "udhaar",
            amount: quote.total,
            note: "Milling on udhaar",
            billNumber: number,
          });
        }
        book.bills.push(bill);
        ticket.status = "collected";
        ticket.billId = bill.id;
        return bill;
      }),
    );
  }

  if (a === "staff" && !b && method === "GET") {
    return json(await read((book) => [...book.staff].sort((left, right) => left.id - right.id)));
  }

  return json({ message: "That path is not on the counter." }, 404);
}

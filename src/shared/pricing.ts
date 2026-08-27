export type LineType =
  | "PER_PERSON"
  | "FLAT"
  | "PERCENT_DISCOUNT"
  | "FIXED_DISCOUNT"
  | "TBD";

export type InvoiceLineInput = {
  type: LineType;
  label: string;
  description?: string;
  qty: number;
  unitCents: number;
};

export type InvoiceTotals = {
  foodSubtotalCents: number;
  discountCents: number;
  chargeCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  depositDueCents: number;
  balanceCents: number;
};

export function lineAmountCents(
  line: InvoiceLineInput,
  guestCount: number,
  runningSubtotalCents: number,
): number {
  if (line.type === "TBD") return 0;
  if (line.type === "PERCENT_DISCOUNT") {
    return -Math.round((runningSubtotalCents * line.unitCents) / 10000);
  }
  if (line.type === "FIXED_DISCOUNT") {
    return -Math.abs(line.unitCents * line.qty);
  }
  const qty = line.type === "PER_PERSON" ? line.qty || guestCount : line.qty;
  return line.unitCents * qty;
}

export function invoiceLineAmountCents(
  lines: InvoiceLineInput[],
  index: number,
  guestCount: number,
): number {
  const line = lines[index];
  if (line.type === "TBD") return 0;
  if (line.type === "PERCENT_DISCOUNT") {
    let running = 0;
    for (const prev of lines) {
      if (prev.type === "TBD" || prev.type === "PERCENT_DISCOUNT" || prev.type === "FIXED_DISCOUNT") {
        continue;
      }
      running += lineAmountCents(prev, guestCount, 0);
    }
    return lineAmountCents(line, guestCount, running);
  }
  return lineAmountCents(line, guestCount, 0);
}

export function calculateInvoice(opts: {
  lines: InvoiceLineInput[];
  guestCount: number;
  taxRateBps: number;
  paidCents: number;
  depositCents: number;
}): InvoiceTotals {
  let foodSubtotalCents = 0;
  let discountCents = 0;
  let chargeCents = 0;

  const priced = opts.lines.filter((l) => l.type !== "TBD");
  const nonDiscount = priced.filter(
    (l) => l.type !== "PERCENT_DISCOUNT" && l.type !== "FIXED_DISCOUNT",
  );

  for (const line of nonDiscount) {
    const amount = lineAmountCents(line, opts.guestCount, 0);
    if (line.type === "FLAT" && amount >= 0 && isChargeLabel(line.label)) {
      chargeCents += amount;
    } else {
      foodSubtotalCents += amount;
    }
  }

  const preDiscount = foodSubtotalCents + chargeCents;
  for (const line of priced) {
    if (line.type === "PERCENT_DISCOUNT" || line.type === "FIXED_DISCOUNT") {
      discountCents += -lineAmountCents(line, opts.guestCount, preDiscount);
    }
  }

  const subtotalCents = Math.max(0, preDiscount - discountCents);
  const taxCents = Math.round((subtotalCents * opts.taxRateBps) / 10000);
  const totalCents = subtotalCents + taxCents;
  const paidCents = opts.paidCents;
  const depositDueCents = Math.min(opts.depositCents, totalCents);
  const balanceCents = Math.max(0, totalCents - paidCents);

  return {
    foodSubtotalCents,
    discountCents,
    chargeCents,
    subtotalCents,
    taxCents,
    totalCents,
    paidCents,
    depositDueCents,
    balanceCents,
  };
}

function isChargeLabel(label: string) {
  const l = label.toLowerCase();
  return (
    l.includes("setup") ||
    l.includes("server") ||
    l.includes("service fee") ||
    l.includes("personnel") ||
    l.includes("travel") ||
    l.includes("gratuity")
  );
}

export function formatMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoneyShort(cents: number) {
  if (cents % 100 === 0) {
    return `$${cents / 100}`;
  }
  return formatMoney(cents);
}

/** Admin inputs use dollars; storage stays in cents. */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? Number(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatPriceWithUnit(cents: number | null | undefined, unit?: string | null) {
  if (cents == null) return "Quoted later";
  const money = formatMoneyShort(cents);
  if (unit === "PER_PERSON") return `${money} per person`;
  if (unit === "PER_UNIT") return `${money} per unit`;
  if (unit === "PER_LAYER") return `${money} per layer`;
  if (unit === "PER_SERVER") return `${money} per server`;
  if (unit === "NONE") return "Included";
  return money;
}

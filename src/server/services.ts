import { prisma } from "./db.js";
import { calculateInvoice, type InvoiceLineInput } from "../shared/pricing.js";

export async function getSettings() {
  const settings = await prisma.businessSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings) throw new Error("Business settings missing. Run npm run setup.");
  return settings;
}

export async function invoiceWithTotals(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      event: { include: { payments: true } },
    },
  });
  if (!invoice) return null;
  const settings = await getSettings();
  const paidCents = invoice.event.payments.reduce((s, p) => s + p.amountCents, 0);
  const totals = calculateInvoice({
    lines: invoice.lines as InvoiceLineInput[],
    guestCount: invoice.event.guestCount,
    taxRateBps: invoice.taxRateBps,
    paidCents,
    depositCents: settings.depositCents,
  });
  return { invoice, totals, settings, paidCents };
}

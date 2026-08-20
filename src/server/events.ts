import { nanoid } from "nanoid";
import { prisma } from "./db.js";
import { linesFromWizard, type WizardInput } from "./buildInvoice.js";
import { getSettings } from "./services.js";

function lineCreates(lines: Awaited<ReturnType<typeof linesFromWizard>>) {
  return lines.map((line, i) => ({
    sortOrder: i + 1,
    type: line.type,
    label: line.label,
    description: line.description,
    qty: line.qty,
    unitCents: line.unitCents,
    packageSlug: line.packageSlug,
    itemId: line.itemId,
    categoryName: line.categoryName,
  }));
}

export async function createEventFromWizard(opts: {
  input: WizardInput;
  status: string;
  invoiceStatus: string;
}) {
  const settings = await getSettings();
  const lines = await linesFromWizard(opts.input);
  const today = new Date().toISOString().slice(0, 10);
  return prisma.event.create({
    data: {
      publicToken: nanoid(16),
      clientName: opts.input.event.clientName,
      phone: opts.input.event.phone ?? "",
      email: opts.input.event.email ?? "",
      contactName: opts.input.event.contactName ?? "",
      venue: opts.input.event.venue ?? "",
      eventName: opts.input.event.eventName ?? "",
      eventDate: opts.input.event.eventDate,
      proposalDate: today,
      guestCount: opts.input.event.guestCount,
      notes: opts.input.event.notes ?? "",
      status: opts.status,
      wizardJson: JSON.stringify(opts.input),
      invoices: {
        create: {
          version: 1,
          status: opts.invoiceStatus,
          isCurrent: true,
          taxRateBps: settings.taxRateBps,
          notes: opts.input.event.notes ?? "",
          terms: settings.terms,
          lines: { create: lineCreates(lines) },
        },
      },
    },
    include: { invoices: true },
  });
}

export async function updateRequestFromWizard(publicToken: string, input: WizardInput) {
  const event = await prisma.event.findUnique({
    where: { publicToken },
    include: { invoices: { where: { isCurrent: true } } },
  });
  if (!event) return { error: "Not found" as const, status: 404 as const };
  if (!["invite", "request", "draft"].includes(event.status)) {
    return { error: "This proposal is locked. Ask Agape if you need a change." as const, status: 409 as const };
  }
  const settings = await getSettings();
  const lines = await linesFromWizard(input);
  const current = event.invoices[0];
  const eventData = {
    clientName: input.event.clientName,
    phone: input.event.phone ?? "",
    email: input.event.email ?? "",
    contactName: input.event.contactName ?? "",
    venue: input.event.venue ?? "",
    eventName: input.event.eventName ?? "",
    eventDate: input.event.eventDate,
    guestCount: input.event.guestCount,
    notes: input.event.notes ?? "",
    status: "request" as const,
    wizardJson: JSON.stringify(input),
  };

  if (!current) {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        ...eventData,
        invoices: {
          create: {
            version: 1,
            status: "draft",
            isCurrent: true,
            taxRateBps: settings.taxRateBps,
            notes: input.event.notes ?? "",
            terms: settings.terms,
            lines: { create: lineCreates(lines) },
          },
        },
      },
    });
  } else {
    await prisma.$transaction([
      prisma.invoiceLine.deleteMany({ where: { invoiceId: current.id } }),
      ...lineCreates(lines).map((line) =>
        prisma.invoiceLine.create({ data: { invoiceId: current.id, ...line } }),
      ),
      prisma.invoice.update({
        where: { id: current.id },
        data: { notes: input.event.notes ?? "", status: "draft" },
      }),
      prisma.event.update({ where: { id: event.id }, data: eventData }),
    ]);
  }
  return { error: null, status: 200 as const, eventId: event.id, publicToken };
}

export function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

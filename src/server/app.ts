import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "./db.js";
import { currentUser, login, logout, requireAuth } from "./auth.js";
import { type WizardInput } from "./buildInvoice.js";
import { loadCatalog } from "./catalog.js";
import {
  createEventFromWizard,
  daysUntil,
  updateRequestFromWizard,
} from "./events.js";
import { getSettings, invoiceWithTotals } from "./services.js";
import { renderInvoicePdf } from "./pdf.js";
import { calculateInvoice, type InvoiceLineInput } from "../shared/pricing.js";

export const app = new Hono();

const wizardSchema = z.object({
  event: z.object({
    clientName: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    contactName: z.string().optional(),
    venue: z.string().optional(),
    eventName: z.string().optional(),
    eventDate: z.string().min(1),
    guestCount: z.number().int().min(1),
    notes: z.string().optional(),
  }).refine(
    (e) => Boolean((e.phone && e.phone.trim()) || (e.email && e.email.trim())),
    { message: "Email or phone required", path: ["phone"] },
  ),
  packageSlugs: z.array(z.string()),
  dinner: z.object({
    meatIds: z.array(z.string()),
    sideIds: z.array(z.string()),
    breadId: z.string().nullable(),
  }),
  saladIds: z.array(z.string()),
  addonIds: z.array(z.string()),
  dessertIds: z.array(z.string()),
  drinkIds: z.array(z.string()),
  cakeNotes: z.string().optional(),
  cakeLayers: z.number().int().min(1).optional(),
  cakeFlavor: z.string().optional(),
  tableSettingIds: z.array(z.string()).optional(),
  chargeTemplateIds: z.array(z.string()),
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  }),
);

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const user = await login(c, email, password);
  if (!user) return c.json({ error: "Invalid email or password" }, 401);
  return c.json({ user });
});

app.post("/api/auth/logout", async (c) => {
  await logout(c);
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ user: null });
  return c.json({ user });
});

const pub = new Hono();

pub.get("/catalog", async (c) => c.json(await loadCatalog({ publicOnly: true })));

pub.post("/requests", async (c) => {
  const parsed = wizardSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please fill in your name, date, and guest count." }, 400);
  try {
    const event = await createEventFromWizard({
      input: parsed.data as WizardInput,
      status: "request",
      invoiceStatus: "draft",
    });
    return c.json({ publicToken: event.publicToken, id: event.id });
  } catch (err) {
    console.error(err);
    return c.json({ error: err instanceof Error ? err.message : "Could not save request" }, 500);
  }
});

pub.get("/events/:token", async (c) => {
  const event = await prisma.event.findUnique({
    where: { publicToken: c.req.param("token") },
    include: {
      invoices: {
        where: { isCurrent: true },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      },
      payments: true,
    },
  });
  if (!event) return c.json({ error: "Not found" }, 404);
  const settings = await getSettings();
  const inv = event.invoices[0];
  const paidCents = event.payments.reduce((s, p) => s + p.amountCents, 0);
  const totals = inv
    ? calculateInvoice({
        lines: inv.lines as InvoiceLineInput[],
        guestCount: event.guestCount,
        taxRateBps: inv.taxRateBps,
        paidCents,
        depositCents: settings.depositCents,
      })
    : null;
  const canEdit = ["invite", "request", "draft"].includes(event.status);
  let wizard = null;
  try {
    wizard = JSON.parse(event.wizardJson || "null");
  } catch {
    wizard = null;
  }
  return c.json({
    canEdit,
    status: event.status,
    invoiceStatus: inv?.status ?? null,
    event: {
      clientName: event.clientName,
      contactName: event.contactName,
      phone: event.phone,
      email: (event as { email?: string }).email ?? "",
      venue: event.venue,
      eventName: event.eventName,
      eventDate: event.eventDate,
      guestCount: event.guestCount,
      notes: event.notes,
    },
    invoice: inv
      ? {
          id: inv.id,
          version: inv.version,
          status: inv.status,
          notes: inv.notes,
          terms: inv.terms,
          lines: inv.lines,
        }
      : null,
    totals,
    paidCents,
    settings: {
      businessName: settings.businessName,
      tagline: settings.tagline,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      depositCents: settings.depositCents,
      balanceDueDays: settings.balanceDueDays,
      terms: settings.terms,
    },
    wizard,
  });
});

pub.put("/events/:token", async (c) => {
  const parsed = wizardSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please fill in your name, date, and guest count." }, 400);
  const result = await updateRequestFromWizard(c.req.param("token"), parsed.data as WizardInput);
  if (result.error) return c.json({ error: result.error }, result.status);
  return c.json({ publicToken: result.publicToken });
});

pub.get("/events/:token/pdf", async (c) => {
  const event = await prisma.event.findUnique({
    where: { publicToken: c.req.param("token") },
    include: { invoices: { where: { isCurrent: true } } },
  });
  const inv = event?.invoices[0];
  if (!inv) return c.json({ error: "Not found" }, 404);
  const payload = await invoiceWithTotals(inv.id);
  if (!payload) return c.json({ error: "Not found" }, 404);
  const buf = await renderInvoicePdf(payload);
  const filename = `Agape-${payload.invoice.event.clientName.replace(/\s+/g, "-")}-v${payload.invoice.version}.pdf`;
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(new Uint8Array(buf));
});

pub.post("/events/:token/pay", async (c) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return c.json({
      ok: false,
      mocked: true,
      message: "Online payment is not on yet. Agape will send a payment link, or you can pay the deposit another way.",
    });
  }
  return c.json({ ok: false, message: "Stripe is not wired yet." });
});

app.route("/api/public", pub);

const api = new Hono();
api.use("*", requireAuth);

api.get("/catalog", async (c) => c.json(await loadCatalog()));

api.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  const dir = process.env.UPLOAD_DIR ?? "./uploads";
  await mkdir(dir, { recursive: true });
  const ext = extname(file.name) || ".jpg";
  const name = `${nanoid(12)}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, name), buf);
  return c.json({ url: `/uploads/${name}` });
});

api.post("/categories", async (c) => {
  const body = await c.req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return c.json({ error: "name required" }, 400);
  const slug = String(body.slug ?? name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.category.create({
    data: { name, slug: slug || nanoid(6), sortOrder: (max._max.sortOrder ?? 0) + 10 },
  });
  return c.json(row);
});

api.patch("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const row = await prisma.category.update({
    where: { id },
    data: {
      name: body.name,
      sortOrder: body.sortOrder,
      active: body.active,
      photoUrl: body.photoUrl,
    },
  });
  return c.json(row);
});

api.delete("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const count = await prisma.menuItem.count({ where: { categoryId: id } });
  if (count > 0) {
    return c.json({ error: "Move or delete items in this category first." }, 400);
  }
  await prisma.category.delete({ where: { id } });
  return c.json({ ok: true });
});

api.post("/items", async (c) => {
  const body = await c.req.json();
  const row = await prisma.menuItem.create({
    data: {
      name: String(body.name ?? "").trim(),
      description: String(body.description ?? ""),
      categoryId: String(body.categoryId),
      photoUrl: body.photoUrl ?? null,
      priceCents: body.priceCents === null || body.priceCents === "" ? null : Number(body.priceCents),
      priceUnit: body.priceUnit ?? "PER_PERSON",
      isAddOn: Boolean(body.isAddOn),
      active: body.active !== false,
      sortOrder: Number(body.sortOrder ?? 0),
    },
  });
  return c.json(row);
});

api.patch("/items/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const data: Record<string, unknown> = {};
  for (const key of [
    "name",
    "description",
    "categoryId",
    "photoUrl",
    "priceUnit",
    "isAddOn",
    "active",
    "sortOrder",
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.priceCents !== undefined) {
    data.priceCents =
      body.priceCents === null || body.priceCents === "" ? null : Number(body.priceCents);
  }
  const row = await prisma.menuItem.update({ where: { id }, data });
  return c.json(row);
});

api.delete("/items/:id", async (c) => {
  await prisma.menuItem.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

api.patch("/packages/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const data: Record<string, unknown> = {};
  for (const key of [
    "name",
    "description",
    "photoUrl",
    "priceUnit",
    "includesNotes",
    "active",
    "sortOrder",
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.priceCents !== undefined) {
    data.priceCents =
      body.priceCents === null || body.priceCents === "" ? null : Number(body.priceCents);
  }
  const row = await prisma.package.update({ where: { id }, data });
  return c.json(row);
});

api.post("/charges", async (c) => {
  const body = await c.req.json();
  const row = await prisma.chargeTemplate.create({
    data: {
      name: String(body.name ?? "").trim(),
      description: String(body.description ?? ""),
      amountCents: Number(body.amountCents ?? 0),
      unit: body.unit ?? "FLAT",
      active: body.active !== false,
    },
  });
  return c.json(row);
});

api.patch("/charges/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const row = await prisma.chargeTemplate.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      amountCents: body.amountCents === undefined ? undefined : Number(body.amountCents),
      unit: body.unit,
      active: body.active,
    },
  });
  return c.json(row);
});

api.delete("/charges/:id", async (c) => {
  await prisma.chargeTemplate.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

api.get("/settings", async (c) => c.json(await getSettings()));

api.patch("/settings", async (c) => {
  const body = await c.req.json();
  const row = await prisma.businessSettings.update({
    where: { id: "default" },
    data: {
      businessName: body.businessName,
      tagline: body.tagline,
      address: body.address,
      phone: body.phone,
      email: body.email,
      taxRateBps: body.taxRateBps === undefined ? undefined : Number(body.taxRateBps),
      depositCents: body.depositCents === undefined ? undefined : Number(body.depositCents),
      balanceDueDays:
        body.balanceDueDays === undefined ? undefined : Number(body.balanceDueDays),
      terms: body.terms,
      logoUrl: body.logoUrl,
    },
  });
  return c.json(row);
});

api.get("/events", async (c) => {
  const events = await prisma.event.findMany({
    orderBy: { eventDate: "asc" },
    include: {
      invoices: { where: { isCurrent: true }, include: { lines: true } },
      payments: true,
    },
  });
  const settings = await getSettings();
  const rows = events.map((event) => {
    const inv = event.invoices[0];
    const paidCents = event.payments.reduce((s, p) => s + p.amountCents, 0);
    const totals = inv
      ? calculateInvoice({
          lines: inv.lines as InvoiceLineInput[],
          guestCount: event.guestCount,
          taxRateBps: inv.taxRateBps,
          paidCents,
          depositCents: settings.depositCents,
        })
      : null;
    return { ...event, totals, dueInDays: daysUntil(event.eventDate) };
  });
  return c.json(rows);
});

api.get("/events/:id", async (c) => {
  const event = await prisma.event.findUnique({
    where: { id: c.req.param("id") },
    include: {
      invoices: { orderBy: { version: "desc" }, include: { lines: { orderBy: { sortOrder: "asc" } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!event) return c.json({ error: "Not found" }, 404);
  const settings = await getSettings();
  const current = event.invoices.find((i) => i.isCurrent) ?? event.invoices[0];
  const paidCents = event.payments.reduce((s, p) => s + p.amountCents, 0);
  const totals = current
    ? calculateInvoice({
        lines: current.lines as InvoiceLineInput[],
        guestCount: event.guestCount,
        taxRateBps: current.taxRateBps,
        paidCents,
        depositCents: settings.depositCents,
      })
    : null;
  return c.json({ event, totals, settings, paidCents });
});

api.post("/events", async (c) => {
  const parsed = wizardSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid event details" }, 400);
  const event = await createEventFromWizard({
    input: parsed.data as WizardInput,
    status: "quoted",
    invoiceStatus: "draft",
  });
  return c.json(event);
});

api.post("/events/client-link", async (c) => {
  const event = await prisma.event.create({
    data: {
      publicToken: nanoid(16),
      clientName: "New client",
      eventDate: "",
      guestCount: 50,
      status: "invite",
      wizardJson: "{}",
    },
  });
  return c.json({ id: event.id, publicToken: event.publicToken });
});

api.post("/events/:id/send", async (c) => {
  const event = await prisma.event.findUnique({
    where: { id: c.req.param("id") },
    include: { invoices: { where: { isCurrent: true } } },
  });
  if (!event) return c.json({ error: "Not found" }, 404);
  const inv = event.invoices[0];
  if (!inv) return c.json({ error: "Create an invoice first." }, 400);
  await prisma.$transaction([
    prisma.event.update({ where: { id: event.id }, data: { status: "quoted" } }),
    prisma.invoice.update({ where: { id: inv.id }, data: { status: "sent" } }),
  ]);
  if (!process.env.RESEND_API_KEY) {
    return c.json({
      ok: true,
      mocked: true,
      publicToken: event.publicToken,
      message: "Proposal is now visible on the client link. Email is not configured yet — copy the link and send it yourself.",
    });
  }
  return c.json({ ok: true, publicToken: event.publicToken });
});

api.patch("/events/:id", async (c) => {
  const body = await c.req.json();
  const event = await prisma.event.update({
    where: { id: c.req.param("id") },
    data: {
      clientName: body.clientName,
      phone: body.phone,
      contactName: body.contactName,
      venue: body.venue,
      eventName: body.eventName,
      eventDate: body.eventDate,
      guestCount: body.guestCount === undefined ? undefined : Number(body.guestCount),
      notes: body.notes,
      status: body.status,
    },
  });
  return c.json(event);
});

api.get("/invoices/:id", async (c) => {
  const payload = await invoiceWithTotals(c.req.param("id"));
  if (!payload) return c.json({ error: "Not found" }, 404);
  return c.json(payload);
});

api.patch("/invoices/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  if (Array.isArray(body.lines)) {
    await prisma.$transaction([
      prisma.invoiceLine.deleteMany({ where: { invoiceId: id } }),
      ...body.lines.map(
        (
          line: {
            type: string;
            label: string;
            description?: string;
            qty: number;
            unitCents: number;
            packageSlug?: string | null;
            itemId?: string | null;
            categoryName?: string | null;
          },
          i: number,
        ) =>
          prisma.invoiceLine.create({
            data: {
              invoiceId: id,
              sortOrder: i + 1,
              type: line.type,
              label: line.label,
              description: line.description ?? "",
              qty: Number(line.qty ?? 1),
              unitCents: Number(line.unitCents ?? 0),
              packageSlug: line.packageSlug,
              itemId: line.itemId,
              categoryName: line.categoryName,
            },
          }),
      ),
    ]);
  }
  await prisma.invoice.update({
    where: { id },
    data: {
      notes: body.notes,
      terms: body.terms,
      taxRateBps: body.taxRateBps === undefined ? undefined : Number(body.taxRateBps),
      status: body.status,
    },
  });
  const payload = await invoiceWithTotals(id);
  return c.json(payload);
});

api.post("/invoices/:id/revise", async (c) => {
  const current = await prisma.invoice.findUnique({
    where: { id: c.req.param("id") },
    include: { lines: true },
  });
  if (!current) return c.json({ error: "Not found" }, 404);
  const max = await prisma.invoice.aggregate({
    where: { eventId: current.eventId },
    _max: { version: true },
  });
  await prisma.invoice.updateMany({
    where: { eventId: current.eventId },
    data: { isCurrent: false },
  });
  const copy = await prisma.invoice.create({
    data: {
      eventId: current.eventId,
      version: (max._max.version ?? 1) + 1,
      status: "draft",
      isCurrent: true,
      taxRateBps: current.taxRateBps,
      notes: current.notes,
      terms: current.terms,
      lines: {
        create: current.lines.map((line) => ({
          sortOrder: line.sortOrder,
          type: line.type,
          label: line.label,
          description: line.description,
          qty: line.qty,
          unitCents: line.unitCents,
          packageSlug: line.packageSlug,
          itemId: line.itemId,
          categoryName: line.categoryName,
        })),
      },
    },
  });
  return c.json(copy);
});

api.get("/invoices/:id/pdf", async (c) => {
  const payload = await invoiceWithTotals(c.req.param("id"));
  if (!payload) return c.json({ error: "Not found" }, 404);
  const buf = await renderInvoicePdf(payload);
  const filename = `Agape-${payload.invoice.event.clientName.replace(/\s+/g, "-")}-v${payload.invoice.version}.pdf`;
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(new Uint8Array(buf));
});

api.post("/invoices/:id/email", async (c) => {
  if (!process.env.RESEND_API_KEY) {
    return c.json({
      ok: false,
      mocked: true,
      message: "Email is not configured yet. Add RESEND_API_KEY later. Download the PDF for now.",
    });
  }
  return c.json({
    ok: false,
    message: "Resend key is present but sending is not wired yet.",
  });
});

api.post("/events/:id/payments", async (c) => {
  const body = await c.req.json();
  const row = await prisma.payment.create({
    data: {
      eventId: c.req.param("id"),
      amountCents: Number(body.amountCents ?? 0),
      type: body.type ?? "deposit",
      method: body.method ?? "manual",
      notes: body.notes ?? "",
    },
  });
  return c.json(row);
});

api.post("/invoices/:id/stripe-checkout", async (c) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return c.json({
      ok: false,
      mocked: true,
      message: "Stripe is not configured yet. Record a manual payment, or add STRIPE_SECRET_KEY later.",
    });
  }
  return c.json({
    ok: false,
    message: "Stripe key is present but checkout is not wired yet.",
  });
});

app.route("/api", api);

import { prisma } from "./db.js";
import type { LineType } from "../shared/pricing.js";
import {
  cakeDescription,
  CAKE_CENTS_PER_LAYER,
  CAKE_DEFAULT_LAYERS,
  chargeQty,
  GRATUITY_PER_SERVER_CENTS,
  isAutoGratuity,
  serverCountForGuests,
} from "../shared/service.js";

export type WizardInput = {
  event: {
    clientName: string;
    phone?: string;
    email?: string;
    contactName?: string;
    venue?: string;
    eventName?: string;
    eventDate: string;
    guestCount: number;
    notes?: string;
  };
  packageSlugs: string[];
  dinner: { meatIds: string[]; sideIds: string[]; breadId: string | null };
  saladIds: string[];
  addonIds: string[];
  dessertIds: string[];
  drinkIds: string[];
  cakeNotes?: string;
  cakeLayers?: number;
  cakeFlavor?: string;
  tableSettingIds?: string[];
  chargeTemplateIds: string[];
};

type LineDraft = {
  type: LineType;
  label: string;
  description: string;
  qty: number;
  unitCents: number;
  packageSlug?: string | null;
  itemId?: string | null;
  categoryName?: string | null;
};

export async function linesFromWizard(input: WizardInput): Promise<LineDraft[]> {
  const lines: LineDraft[] = [];
  const guestCount = input.event.guestCount;
  const slugs = new Set(input.packageSlugs);
  const drinks = await prisma.menuItem.findMany({
    where: { id: { in: input.drinkIds } },
  });
  const drinkNote =
    drinks.length > 0
      ? `Drinks: ${drinks.map((d) => d.name).join(", ")} and water.`
      : "Includes water.";

  if (slugs.has("grazing")) {
    const pkg = await prisma.package.findUnique({ where: { slug: "grazing" } });
    if (pkg) {
      lines.push({
        type: "PER_PERSON",
        label: pkg.name,
        description: pkg.description,
        qty: guestCount,
        unitCents: pkg.priceCents ?? 0,
        packageSlug: pkg.slug,
      });
    }
  }

  if (slugs.has("hors-doeuvres")) {
    const pkg = await prisma.package.findUnique({ where: { slug: "hors-doeuvres" } });
    if (pkg) {
      lines.push({
        type: "PER_PERSON",
        label: pkg.name,
        description: [pkg.includesNotes, drinkNote].filter(Boolean).join(" "),
        qty: guestCount,
        unitCents: pkg.priceCents ?? 0,
        packageSlug: pkg.slug,
      });
    }
  }

  if (slugs.has("dinner")) {
    const pkg = await prisma.package.findUnique({ where: { slug: "dinner" } });
    const meats = await prisma.menuItem.findMany({ where: { id: { in: input.dinner.meatIds } } });
    const sides = await prisma.menuItem.findMany({ where: { id: { in: input.dinner.sideIds } } });
    const bread = input.dinner.breadId
      ? await prisma.menuItem.findUnique({ where: { id: input.dinner.breadId } })
      : null;
    const parts = [
      meats.length ? `Meats: ${meats.map((m) => m.name).join("; ")}.` : "",
      sides.length ? `Sides: ${sides.map((s) => s.name).join("; ")}.` : "",
      bread ? `Bread: ${bread.name}.` : "",
      pkg?.includesNotes ?? "",
      drinkNote,
    ].filter(Boolean);
    lines.push({
      type: "PER_PERSON",
      label: pkg?.name ?? "Dinner — 2 meats / 2 sides / bread",
      description: parts.join(" "),
      qty: guestCount,
      unitCents: pkg?.priceCents ?? 1800,
      packageSlug: "dinner",
    });
  }

  if (input.saladIds.length) {
    const salads = await prisma.menuItem.findMany({
      where: { id: { in: input.saladIds } },
    });
    for (const salad of salads) {
      lines.push({
        type: "PER_PERSON",
        label: salad.name,
        description: "Salad add-on",
        qty: guestCount,
        unitCents: salad.priceCents ?? 300,
        itemId: salad.id,
        categoryName: "Salads",
      });
    }
  }

  if (input.addonIds.length) {
    const addons = await prisma.menuItem.findMany({
      where: { id: { in: input.addonIds } },
    });
    for (const addon of addons) {
      lines.push({
        type: "PER_PERSON",
        label: addon.name,
        description: "Hors d'oeuvre add-on",
        qty: guestCount,
        unitCents: addon.priceCents ?? 0,
        itemId: addon.id,
        categoryName: "Hors d'oeuvre add-ons",
        packageSlug: "hors-doeuvres",
      });
    }
  }

  if (slugs.has("dessert-bar")) {
    const desserts = await prisma.menuItem.findMany({
      where: { id: { in: input.dessertIds } },
    });
    const names = desserts.map((d) => d.name).join("; ");
    lines.push({
      type: "TBD",
      label: "Dessert Bar",
      description: names || "To be determined",
      qty: guestCount,
      unitCents: 0,
      packageSlug: "dessert-bar",
      categoryName: "Desserts",
    });
  }

  if (slugs.has("cake")) {
    const pkg = await prisma.package.findUnique({ where: { slug: "cake" } });
    const layers = Math.max(1, Math.round(input.cakeLayers ?? CAKE_DEFAULT_LAYERS));
    const unitCents = pkg?.priceCents ?? CAKE_CENTS_PER_LAYER;
    lines.push({
      type: "FLAT",
      label: pkg?.name ?? "Wedding Cake",
      description:
        input.cakeNotes ||
        cakeDescription(layers, input.cakeFlavor) ||
        pkg?.includesNotes ||
        `${layers} layers`,
      qty: layers,
      unitCents,
      packageSlug: "cake",
    });
  }

  const tableIds = input.tableSettingIds ?? [];
  if (tableIds.length) {
    const tableItems = await prisma.menuItem.findMany({
      where: { id: { in: tableIds } },
      include: { category: true },
    });
    const included = tableItems.filter((item) => item.priceCents == null);
    if (included.length) {
      lines.push({
        type: "FLAT",
        label: "Table settings",
        description: included.map((item) => item.name).join(", "),
        qty: 1,
        unitCents: 0,
        categoryName: "Table settings",
      });
    }
    for (const item of tableItems.filter((row) => row.priceCents != null)) {
      const perPerson = item.priceUnit === "PER_PERSON";
      lines.push({
        type: perPerson ? "PER_PERSON" : "FLAT",
        label: item.name,
        description: item.description || "Table settings",
        qty: perPerson ? guestCount : 1,
        unitCents: item.priceCents ?? 0,
        itemId: item.id,
        categoryName: item.category?.name ?? "Table settings",
      });
    }
  }

  const servers = serverCountForGuests(guestCount);
  const gratTemplates = await prisma.chargeTemplate.findMany();
  const grat = gratTemplates.find((t) => isAutoGratuity(t));
  const perServerCents = grat?.amountCents ?? GRATUITY_PER_SERVER_CENTS;
  const perServerDollars = (perServerCents / 100).toFixed(perServerCents % 100 === 0 ? 0 : 2);
  lines.push({
    type: "FLAT",
    label: grat?.name ?? "Server gratuity",
    description: `One server per 25 guests. ${servers} server${servers === 1 ? "" : "s"} × $${perServerDollars}.`,
    qty: servers,
    unitCents: perServerCents,
  });

  if (input.chargeTemplateIds.length) {
    const templates = gratTemplates.filter((t) => input.chargeTemplateIds.includes(t.id));
    for (const t of templates) {
      if (isAutoGratuity(t)) continue;
      const qty = chargeQty(t.unit, guestCount);
      lines.push({
        type: t.unit === "PER_PERSON" ? "PER_PERSON" : "FLAT",
        label: t.name,
        description: t.description,
        qty,
        unitCents: t.amountCents,
      });
    }
  }

  return lines;
}

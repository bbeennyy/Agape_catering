import { prisma } from "./db.js";
import type { LineType } from "../shared/pricing.js";

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
    lines.push({
      type: "FLAT",
      label: pkg?.name ?? "Wedding Cake",
      description: input.cakeNotes || pkg?.includesNotes || "2 tier / 6 layer",
      qty: 1,
      unitCents: pkg?.priceCents ?? 18500,
      packageSlug: "cake",
    });
  }

  if (input.chargeTemplateIds.length) {
    const templates = await prisma.chargeTemplate.findMany({
      where: { id: { in: input.chargeTemplateIds } },
    });
    for (const t of templates) {
      const qty = t.unit === "PER_PERSON" ? guestCount : 1;
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

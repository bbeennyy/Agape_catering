import { prisma } from "./db.js";
import { getSettings } from "./services.js";

export async function loadCatalog(opts?: { publicOnly?: boolean }) {
  const publicOnly = opts?.publicOnly ?? false;
  const [categories, packages, charges, settings] = await Promise.all([
    prisma.category.findMany({
      where: publicOnly ? { active: true } : undefined,
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          where: publicOnly ? { active: true } : undefined,
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.package.findMany({
      where: publicOnly ? { active: true } : undefined,
      orderBy: { sortOrder: "asc" },
      include: { rules: true },
    }),
    publicOnly
      ? Promise.resolve([])
      : prisma.chargeTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  const publicSettings = publicOnly
    ? {
        businessName: settings.businessName,
        tagline: settings.tagline,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        taxRateBps: settings.taxRateBps,
        depositCents: settings.depositCents,
        balanceDueDays: settings.balanceDueDays,
        terms: settings.terms,
        logoUrl: settings.logoUrl,
      }
    : settings;
  return { categories, packages, charges, settings: publicSettings };
}

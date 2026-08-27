import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TERMS = `Prices are subject to change due to product availability.
A $200 non refundable deposit is required on all orders.
All remaining balances are due 10 days prior to the event date.
Server gratuity is $170 per server, one server per 25 guests ($850 for 125 guests).`;

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "laura@agape.local";
  const password = process.env.ADMIN_PASSWORD ?? "agapelocal";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: "Laura A. Stephens" },
    create: { email, passwordHash, name: "Laura A. Stephens" },
  });

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { terms: TERMS },
    create: {
      id: "default",
      businessName: "Agape Catering",
      tagline: "Food made with Love",
      address: "229 Morgan Road\nDanielsville, GA 30633",
      phone: "(678) 790-6184",
      email: "Agapelove4food@gmail.com",
      taxRateBps: 0,
      depositCents: 20000,
      balanceDueDays: 10,
      terms: TERMS,
    },
  });

  const categories = [
    { slug: "meats", name: "Meats", sortOrder: 10 },
    { slug: "sides", name: "Sides", sortOrder: 20 },
    { slug: "salads", name: "Salads", sortOrder: 30 },
    { slug: "bread", name: "Bread", sortOrder: 40 },
    { slug: "desserts", name: "Desserts", sortOrder: 50 },
    { slug: "pasta", name: "Pasta", sortOrder: 60 },
    { slug: "sauces", name: "Sauces", sortOrder: 70 },
    { slug: "addons", name: "Hors d'oeuvre add-ons", sortOrder: 80 },
    { slug: "drinks", name: "Drinks", sortOrder: 90 },
    { slug: "table-settings", name: "Table settings", sortOrder: 100 },
  ];

  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: c,
    });
    catIds[c.slug] = row.id;
  }

  async function items(
    slug: string,
    names: Array<
      | string
      | {
          name: string;
          description?: string;
          priceCents?: number;
          isAddOn?: boolean;
          priceUnit?: "PER_PERSON" | "FLAT" | "PER_LAYER" | "NONE";
        }
    >,
  ) {
    const categoryId = catIds[slug];
    for (let i = 0; i < names.length; i++) {
      const raw = names[i];
      const item = typeof raw === "string" ? { name: raw } : raw;
      const existing = await prisma.menuItem.findFirst({
        where: { categoryId, name: item.name },
      });
      const data = {
        name: item.name,
        description: item.description ?? "",
        categoryId,
        priceCents: item.priceCents ?? (slug === "salads" ? 300 : null),
        priceUnit: item.priceUnit ?? "PER_PERSON",
        isAddOn: item.isAddOn ?? (slug === "addons" || slug === "salads"),
        sortOrder: (i + 1) * 10,
        active: true,
      };
      if (existing) {
        await prisma.menuItem.update({ where: { id: existing.id }, data });
      } else {
        await prisma.menuItem.create({ data });
      }
    }
  }

  await items("meats", [
    "Teriyaki Beef Medallions",
    "Mississippi Pot Roast",
    "Grilled Flank Steak with Chimichurri",
    "Carne Asada",
    "Parmesan Crusted Chicken",
    "Marry Me Chicken",
    "Lemon Butter Chicken with Capers",
    "Chicken Marsala",
    "Chicken with Parmesan Cream Sauce",
    "Chicken Francese",
    "Mongolian Chicken",
    "Coconut Lime Chicken",
    "Honey Garlic Chicken",
    "Italian Chicken",
    "Bourbon Glazed Salmon",
    {
      name: "Grilled Salmon with White Wine Butter Sauce",
      description: "Grilled salmon with white wine butter sauce",
    },
    {
      name: "Stuffed Poblano Peppers",
      description: "Steak, chicken, or cheese filling",
    },
    "Apple/Onion Pork Loin",
    "Citrus/Rosemary Pork Loin",
    "Meatloaf",
    "Salisbury Steak",
    "Hamburger Steak with mushroom gravy",
    "Lasagna",
    "Grilled Chicken Alfredo",
  ]);

  await items("sides", [
    "Roasted Garlic Potatoes",
    "Garlic Herb Mashed Potatoes",
    "Au Gratin Potatoes",
    "Green Beans",
    "Grilled Asparagus",
    "Roasted Cauliflower Steaks",
    "Italian Mixed Vegetables",
    "Stuffed Mushrooms",
    { name: "Rice", description: "Jasmine, long grain, or mexi" },
    "Honey Glazed Carrots",
    "Roasted Sweet Potatoes",
    "Butternut Squash",
    "Marinated Grilled Cactus",
    "Patatas Bravas",
  ]);

  await items("salads", [
    "Caesar Salad",
    "Garden Salad",
    "Potato Salad",
    "Fruit Salad",
    "Grape Salad",
    "Spinach Salad",
    "Broccoli Salad",
    "Pasta Salad",
  ]);

  await items("bread", [
    "Croissant",
    "Cornbread",
    "Jalapeno Cheddar Cornbread",
    "Cheddar Bay Biscuits",
    "Yeast Rolls",
    "Wheat Rolls",
    "Garlic Bread",
  ]);

  await items("desserts", [
    { name: "Chocolate Brownie with Peanut Butter Frosting" },
    "Lemon Bars",
    "Vanilla Panna Cotta with Fresh Berries",
    {
      name: "Sweet Potato Cupcakes with Bourbon Cream Cheese Frosting",
    },
    "Red Velvet Cupcakes",
    {
      name: "Parfait",
      description: "Chocolate mousse, berry, strawberry cream, raspberry, keylime",
    },
    {
      name: "Cheesecake Minis",
      description: "Keylime, oreo, raspberry, blueberry/lavender",
    },
    "Chocolate Espresso Cake",
    "Strawberry/Cinnamon Tres Leches Cake",
    {
      name: "Churros",
      description: "Served with strawberry sauce, chocolate sauce, and caramel",
    },
  ]);

  await items("pasta", [
    "Pasta Kale",
    "Lasagna",
    "Baked Ziti",
    "Mediterranean Pasta",
    "Italian Vegetable",
    "Southern Pasta",
  ]);

  await items("sauces", [
    "Chimichurri",
    "Parmesan Cream",
    "Lemon Butter",
    "Garlic Honey",
    "Pesto",
    "Honey Mustard",
    "Bourbon Glaze",
    "Teriyaki",
    "Citrus Rosemary",
  ]);

  await items("addons", [
    { name: "Bourbon Glazed Meatballs", priceCents: 300, isAddOn: true },
    { name: "Shrimp Cocktail Cups", priceCents: 400, isAddOn: true },
    { name: "Dill Chicken Salad Croissants", priceCents: 300, isAddOn: true },
    { name: "Pork Loin Medallions", priceCents: 300, isAddOn: true },
    { name: "Bourbon Glazed Filet Medallions", priceCents: 600, isAddOn: true },
    { name: "Bacon Ranch Deviled Eggs", priceCents: 300, isAddOn: true },
    { name: "Assorted Flatbreads", priceCents: 400, isAddOn: true },
    { name: "Pinwheels (assorted)", priceCents: 300, isAddOn: true },
    { name: "Cranberry Brie Bits", priceCents: 300, isAddOn: true },
    { name: "Brie & Bacon Jam Crostinis", priceCents: 400, isAddOn: true },
  ]);

  await items("drinks", [
    "Sweet Tea",
    "Lemonade",
    { name: "Water", description: "Cucumber/lemon. Always included." },
  ]);

  await items("table-settings", [
    {
      name: "Plateware",
      description: "Plates for the table.",
    },
    {
      name: "Plasticware",
      description: "Disposable utensils.",
    },
    {
      name: "Glasses",
      description: "Cups and glasses.",
    },
    {
      name: "Napkins",
      description: "",
    },
    {
      name: "Silverware",
      description: "Upgrade from disposable utensils.",
    },
    {
      name: "Tablecloths",
      description: "Linens for the tables.",
      priceUnit: "FLAT",
    },
  ]);

  const packages = [
    {
      slug: "grazing",
      name: "Grazing Table (flat lay)",
      description: "A styled grazing table for guests to nibble as they arrive.",
      priceCents: 800,
      priceUnit: "PER_PERSON",
      includesNotes: "",
      sortOrder: 10,
    },
    {
      slug: "hors-doeuvres",
      name: "Passed Hors d'oeuvres",
      description: "Passed hors d'oeuvres. Add-ons are extra per person.",
      priceCents: 1200,
      priceUnit: "PER_PERSON",
      includesNotes:
        "Includes your choice of 2 drink options and water. Includes high quality disposable plates, utensils, cups and napkins.",
      sortOrder: 20,
    },
    {
      slug: "dinner",
      name: "Dinner — 2 meats / 2 sides / bread",
      description: "Buffet dinner. Pick 2 meats, 2 sides, and bread. Salad is $3 extra.",
      priceCents: 1800,
      priceUnit: "PER_PERSON",
      includesNotes:
        "Includes your choice of 2 drink options and water. Includes high quality disposable plates, utensils, cups and napkins.",
      sortOrder: 30,
    },
    {
      slug: "dessert-bar",
      name: "Dessert Bar",
      description: "Pick dessert items. Price is quoted per event.",
      priceCents: null,
      priceUnit: "PER_PERSON",
      includesNotes: "",
      sortOrder: 40,
    },
    {
      slug: "cake",
      name: "Wedding Cake",
      description: "$92.50 per layer. Two layers is $185. Vanilla, chocolate, or mixed flavors.",
      priceCents: 9250,
      priceUnit: "PER_LAYER",
      includesNotes: "Priced per layer. Two layers is $185.",
      sortOrder: 50,
    },
  ];

  for (const p of packages) {
    await prisma.package.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }

  const dinner = await prisma.package.findUniqueOrThrow({ where: { slug: "dinner" } });
  await prisma.packageRule.deleteMany({ where: { packageId: dinner.id } });
  await prisma.packageRule.createMany({
    data: [
      { packageId: dinner.id, categoryId: catIds.meats, min: 2, max: 2, extraCents: 0 },
      { packageId: dinner.id, categoryId: catIds.sides, min: 2, max: 2, extraCents: 0 },
      { packageId: dinner.id, categoryId: catIds.bread, min: 1, max: 1, extraCents: 0 },
    ],
  });

  const charges = [
    {
      name: "Server gratuity",
      description:
        "One server per 25 guests at $170 each. $850 for 125 guests.",
      amountCents: 17000,
      unit: "PER_SERVER",
      sortOrder: 5,
    },
    {
      name: "Setup and Service Fee",
      description: "Optional setup quoted per event.",
      amountCents: 0,
      unit: "FLAT",
      sortOrder: 10,
    },
    {
      name: "Servers / personnel",
      description: "Staff wages if quoted separately from gratuity.",
      amountCents: 0,
      unit: "FLAT",
      sortOrder: 20,
    },
    {
      name: "Travel / delivery",
      description: "",
      amountCents: 0,
      unit: "FLAT",
      sortOrder: 30,
    },
  ];

  for (const c of charges) {
    const existing = await prisma.chargeTemplate.findFirst({ where: { name: c.name } });
    if (existing) {
      await prisma.chargeTemplate.update({ where: { id: existing.id }, data: c });
    } else {
      await prisma.chargeTemplate.create({ data: c });
    }
  }

  console.log("Seeded Agape menu, packages, and admin user.");
  console.log(`Login: ${email} / ${password}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

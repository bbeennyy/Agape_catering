/** Guest-count and cake rules used by the wizard, invoices, and catalog. */

export const GUESTS_PER_SERVER = 25;
/** $170 per server. Five servers (125 guests) = $850. */
export const GRATUITY_PER_SERVER_CENTS = 17000;

/** $92.50 per layer. Two layers = $185. */
export const CAKE_CENTS_PER_LAYER = 9250;
export const CAKE_DEFAULT_LAYERS = 2;

export const CAKE_FLAVORS = [
  { id: "vanilla", label: "Vanilla" },
  { id: "chocolate", label: "Chocolate" },
  { id: "mixed", label: "Mixed flavors" },
] as const;

export type CakeFlavorId = (typeof CAKE_FLAVORS)[number]["id"];

export const TABLE_SETTINGS_SLUG = "table-settings";
export const TABLE_SETTINGS_CATEGORY_NAME = "Table settings";

/** Included with dinner and hors d'oeuvres unless the client changes them. */
export const TABLE_SETTINGS_INCLUDED_NAMES = [
  "Plateware",
  "Plasticware",
  "Glasses",
  "Napkins",
];

export function serverCountForGuests(guestCount: number) {
  const n = Math.max(1, Math.floor(Number(guestCount) || 0));
  return Math.max(1, Math.ceil(n / GUESTS_PER_SERVER));
}

export function gratuityCentsForGuests(
  guestCount: number,
  perServerCents = GRATUITY_PER_SERVER_CENTS,
) {
  return serverCountForGuests(guestCount) * perServerCents;
}

export function cakePriceCents(layers: number) {
  const n = Math.max(1, Math.round(Number(layers) || CAKE_DEFAULT_LAYERS));
  return n * CAKE_CENTS_PER_LAYER;
}

export function cakeFlavorLabel(id: string | null | undefined) {
  return CAKE_FLAVORS.find((f) => f.id === id)?.label ?? CAKE_FLAVORS[0].label;
}

export function cakeDescription(layers: number, flavorId: string | null | undefined) {
  const n = Math.max(1, Math.round(Number(layers) || CAKE_DEFAULT_LAYERS));
  const flavor = cakeFlavorLabel(flavorId);
  const layerWord = n === 1 ? "layer" : "layers";
  return `${n} ${layerWord} · ${flavor} · $92.50 per layer`;
}

export function chargeQty(unit: string, guestCount: number) {
  if (unit === "PER_PERSON") return guestCount;
  if (unit === "PER_SERVER") return serverCountForGuests(guestCount);
  return 1;
}

export function isAutoGratuity(charge: { name: string; unit: string }) {
  return charge.unit === "PER_SERVER" || /gratuity/i.test(charge.name);
}

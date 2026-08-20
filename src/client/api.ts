import type { InvoiceTotals } from "../shared/pricing.js";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  photoUrl: string | null;
  categoryId: string;
  priceCents: number | null;
  priceUnit: string;
  isAddOn: boolean;
  active: boolean;
  sortOrder: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  photoUrl: string | null;
  active: boolean;
  items: MenuItem[];
};

export type Package = {
  id: string;
  name: string;
  slug: string;
  description: string;
  photoUrl: string | null;
  priceCents: number | null;
  priceUnit: string;
  includesNotes: string;
  sortOrder: number;
  active: boolean;
  rules: { categoryId: string; min: number; max: number; extraCents: number }[];
};

export type ChargeTemplate = {
  id: string;
  name: string;
  description: string;
  amountCents: number;
  unit: string;
  active: boolean;
};

export type Settings = {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  taxRateBps: number;
  depositCents: number;
  balanceDueDays: number;
  terms: string;
  logoUrl: string | null;
};

export type Catalog = {
  categories: Category[];
  packages: Package[];
  charges: ChargeTemplate[];
  settings: Settings;
};

export type InvoiceLine = {
  id?: string;
  type: string;
  label: string;
  description: string;
  qty: number;
  unitCents: number;
  packageSlug?: string | null;
  itemId?: string | null;
  categoryName?: string | null;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 401 && !path.startsWith("/auth")) {
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof data.error === "string" ? data.error : res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function uploadFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  return api<{ url: string }>("/upload", { method: "POST", body });
}

export async function publicApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api/public${path}`, { ...init, headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof data.error === "string" ? data.error : res.statusText);
  }
  return res.json() as Promise<T>;
}

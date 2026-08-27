import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { api, publicApi, type Catalog, type MenuItem, type Package } from "../api";
import { Money, Photo } from "../components/ui";
import { calculateInvoice, formatMoneyShort, formatPriceWithUnit } from "../../shared/pricing";

type Dinner = { meatIds: string[]; sideIds: string[]; breadId: string | null };

type Step =
  | "event"
  | "spread"
  | "meats"
  | "sides"
  | "bread"
  | "salads"
  | "addons"
  | "desserts"
  | "cake"
  | "drinks"
  | "service"
  | "review";

const STEP_COPY: Record<Step, { title: string; hint: string }> = {
  event: { title: "Event details", hint: "Just the essentials — then we pick food." },
  spread: { title: "What are we serving?", hint: "Tap every package you want." },
  meats: { title: "Pick 2 meats", hint: "Dinner includes two." },
  sides: { title: "Pick 2 sides", hint: "Dinner includes two." },
  bread: { title: "Pick your bread", hint: "Choose one." },
  salads: { title: "Add a salad?", hint: "Optional · $3 per person each. Skip if none." },
  addons: { title: "Hors d'oeuvre add-ons", hint: "On top of the $12 per person package." },
  desserts: { title: "Dessert bar", hint: "Pick what you want listed. Price comes later." },
  cake: { title: "Wedding cake", hint: "Tap a starting style." },
  drinks: { title: "Pick 2 drinks", hint: "Water is always included." },
  service: { title: "Service extras", hint: "Setup, servers, travel — tap to add." },
  review: { title: "Looking good?", hint: "Confirm, then submit." },
};

const GUEST_PRESETS = [25, 50, 75, 100, 125, 150, 200];

const CAKE_OPTIONS = [
  {
    id: "vanilla",
    label: "Vanilla / vanilla buttercream",
    notes: "2 tier / 6 layer. Vanilla cake / vanilla buttercream.",
  },
  {
    id: "chocolate",
    label: "Chocolate / chocolate buttercream",
    notes: "2 tier / 6 layer. Chocolate cake / chocolate buttercream.",
  },
  {
    id: "red-velvet",
    label: "Red velvet / cream cheese",
    notes: "2 tier / 6 layer. Red velvet / cream cheese frosting.",
  },
  {
    id: "undecided",
    label: "Still deciding",
    notes: "2 tier / 6 layer. Flavor to be confirmed.",
  },
];

type WizardProps = {
  mode?: "admin" | "client";
  publicToken?: string;
  onSubmitted?: (token: string) => void;
  initial?: {
    event?: {
      clientName?: string;
      phone?: string;
      email?: string;
      contactName?: string;
      venue?: string;
      eventName?: string;
      eventDate?: string;
      guestCount?: number;
      notes?: string;
    };
    packageSlugs?: string[];
    dinner?: Dinner;
    saladIds?: string[];
    addonIds?: string[];
    dessertIds?: string[];
    drinkIds?: string[];
    cakeNotes?: string;
    chargeTemplateIds?: string[];
  };
};

function contactFromInitial(event?: {
  email?: string;
  phone?: string;
}) {
  if (!event) return "";
  return (event.email || event.phone || "").trim();
}

export function Wizard({ mode = "admin", publicToken, initial, onSubmitted }: WizardProps) {
  const navigate = useNavigate();
  const client = mode === "client";
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [step, setStep] = useState<Step>("event");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [clientName, setClientName] = useState(initial?.event?.clientName ?? "");
  const [venue, setVenue] = useState(initial?.event?.venue ?? "");
  const [contact, setContact] = useState(contactFromInitial(initial?.event));
  const [eventDate, setEventDate] = useState(initial?.event?.eventDate ?? "");
  const [guestCount, setGuestCount] = useState(initial?.event?.guestCount ?? 50);
  const [packageSlugs, setPackageSlugs] = useState<string[]>(initial?.packageSlugs ?? []);
  const [dinner, setDinner] = useState<Dinner>(
    initial?.dinner ?? { meatIds: [], sideIds: [], breadId: null },
  );
  const [saladIds, setSaladIds] = useState<string[]>(initial?.saladIds ?? []);
  const [addonIds, setAddonIds] = useState<string[]>(initial?.addonIds ?? []);
  const [dessertIds, setDessertIds] = useState<string[]>(initial?.dessertIds ?? []);
  const [drinkIds, setDrinkIds] = useState<string[]>(initial?.drinkIds ?? []);
  const [cakeNotes, setCakeNotes] = useState(
    initial?.cakeNotes ?? CAKE_OPTIONS[0].notes,
  );
  const [chargeTemplateIds, setChargeTemplateIds] = useState<string[]>(
    initial?.chargeTemplateIds ?? [],
  );

  useEffect(() => {
    const load = client ? publicApi<Catalog>("/catalog") : api<Catalog>("/catalog");
    load.then(setCatalog);
  }, [client]);

  const itemsByCat = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    if (!catalog) return map;
    for (const c of catalog.categories) map[c.slug] = c.items.filter((i) => i.active);
    return map;
  }, [catalog]);

  const pkgMap = useMemo(() => {
    const m: Record<string, Package> = {};
    catalog?.packages.forEach((p) => {
      m[p.slug] = p;
    });
    return m;
  }, [catalog]);

  const steps = useMemo(() => {
    const s: Step[] = ["event", "spread"];
    if (packageSlugs.includes("dinner")) s.push("meats", "sides", "bread");
    s.push("salads");
    if (packageSlugs.includes("hors-doeuvres")) s.push("addons");
    if (packageSlugs.includes("dessert-bar")) s.push("desserts");
    if (packageSlugs.includes("cake")) s.push("cake");
    if (packageSlugs.includes("dinner") || packageSlugs.includes("hors-doeuvres")) s.push("drinks");
    if (!client) s.push("service");
    s.push("review");
    return s;
  }, [packageSlugs, client]);

  const estimate = useMemo(() => {
    if (!catalog) return null;
    const lines = [];
    const g = guestCount;
    for (const slug of packageSlugs) {
      const p = pkgMap[slug];
      if (!p) continue;
      if (p.priceCents == null) {
        lines.push({ type: "TBD" as const, label: p.name, qty: g, unitCents: 0 });
      } else if (p.priceUnit === "FLAT") {
        lines.push({ type: "FLAT" as const, label: p.name, qty: 1, unitCents: p.priceCents });
      } else {
        lines.push({ type: "PER_PERSON" as const, label: p.name, qty: g, unitCents: p.priceCents });
      }
    }
    for (const id of saladIds) {
      const item = itemsByCat.salads?.find((i) => i.id === id);
      if (item) {
        lines.push({
          type: "PER_PERSON" as const,
          label: item.name,
          qty: g,
          unitCents: item.priceCents ?? 300,
        });
      }
    }
    for (const id of addonIds) {
      const item = itemsByCat.addons?.find((i) => i.id === id);
      if (item?.priceCents != null) {
        lines.push({
          type: "PER_PERSON" as const,
          label: item.name,
          qty: g,
          unitCents: item.priceCents,
        });
      }
    }
    for (const id of chargeTemplateIds) {
      const t = catalog.charges.find((c) => c.id === id);
      if (!t) continue;
      lines.push({
        type: t.unit === "PER_PERSON" ? ("PER_PERSON" as const) : ("FLAT" as const),
        label: t.name,
        qty: t.unit === "PER_PERSON" ? g : 1,
        unitCents: t.amountCents,
      });
    }
    return calculateInvoice({
      lines,
      guestCount: g,
      taxRateBps: catalog.settings.taxRateBps,
      paidCents: 0,
      depositCents: catalog.settings.depositCents,
    });
  }, [catalog, packageSlugs, pkgMap, saladIds, addonIds, chargeTemplateIds, guestCount, itemsByCat]);

  const safeStep: Step = steps.includes(step) ? step : "event";
  const idx = steps.indexOf(safeStep);
  const copy = STEP_COPY[safeStep];
  const progress = ((idx + 1) / steps.length) * 100;

  function goTo(next: Step, dir: "forward" | "back") {
    setDirection(dir);
    setAnimKey((k) => k + 1);
    setStep(next);
  }

  function goNext() {
    if (idx >= steps.length - 1) return;
    goTo(steps[idx + 1], "forward");
  }

  function goBack() {
    if (idx <= 0) return;
    goTo(steps[idx - 1], "back");
  }

  function togglePkg(slug: string) {
    setPackageSlugs((cur) =>
      cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug],
    );
  }

  function pickLimited(list: string[], id: string, max: number) {
    if (list.includes(id)) return list.filter((x) => x !== id);
    if (list.length < max) return [...list, id];
    return [...list.slice(1), id];
  }

  function splitContact(value: string) {
    const v = value.trim();
    if (v.includes("@")) return { email: v, phone: "" };
    return { email: "", phone: v };
  }

  function canContinue() {
    if (safeStep === "event") {
      return Boolean(clientName.trim() && venue.trim() && contact.trim() && eventDate);
    }
    if (safeStep === "spread") return packageSlugs.length > 0;
    if (safeStep === "meats") return dinner.meatIds.length === 2;
    if (safeStep === "sides") return dinner.sideIds.length === 2;
    if (safeStep === "bread") return Boolean(dinner.breadId);
    if (safeStep === "drinks") return drinkIds.length === 2;
    return true;
  }

  async function submit() {
    setBusy(true);
    setError("");
    const { email, phone } = splitContact(contact);
    const payload = {
      event: {
        clientName: clientName.trim(),
        contactName: "",
        phone,
        email,
        venue: venue.trim(),
        eventName: "",
        eventDate,
        guestCount,
        notes: "",
      },
      packageSlugs,
      dinner,
      saladIds,
      addonIds,
      dessertIds,
      drinkIds,
      cakeNotes,
      chargeTemplateIds: client ? [] : chargeTemplateIds,
    };
    try {
      if (client) {
        if (publicToken) {
          await publicApi(`/events/${publicToken}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          if (onSubmitted) onSubmitted(publicToken);
          else navigate(`/p/${publicToken}`);
        } else {
          const created = await publicApi<{ publicToken: string }>("/requests", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          if (onSubmitted) onSubmitted(created.publicToken);
          else navigate(`/p/${created.publicToken}`);
        }
      } else {
        const created = await api<{ id: string; invoices: { id: string }[] }>("/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const inv = created.invoices[0];
        navigate(
          inv
            ? `/admin/events/${created.id}/invoices/${inv.id}`
            : `/admin/events/${created.id}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!catalog) {
    return <p className="text-ink/50">Loading menu…</p>;
  }

  return (
    <div className="pb-28">
      <div className="mb-6">
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-mist">
          <div
            className="h-full rounded-full bg-sage transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs uppercase tracking-[0.22em] text-sage">
          {idx + 1} / {steps.length}
        </p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">{copy.title}</h1>
        <p className="mt-1 text-sm text-ink/60">{copy.hint}</p>
      </div>

      <div className="relative min-h-[28rem] overflow-hidden">
        <div
          key={animKey}
          className={
            direction === "forward" ? "wizard-slide-forward" : "wizard-slide-back"
          }
        >
          {safeStep === "event" && (
            <section className="mx-auto max-w-lg space-y-5 rounded-3xl border border-line bg-paper p-6">
              <Field
                label="Name"
                value={clientName}
                onChange={setClientName}
                placeholder="Ben & Evie"
                autoComplete="name"
              />
              <Field
                label="Venue"
                value={venue}
                onChange={setVenue}
                placeholder="Perimeter Church"
              />
              <Field
                label="Email or phone"
                value={contact}
                onChange={setContact}
                placeholder="you@email.com or (678) 555-0100"
                autoComplete="email"
                inputMode="email"
              />
              <label className="block text-sm">
                Event date
                <input
                  type="date"
                  className="mt-1 w-full rounded-2xl border border-line bg-cream/40 px-4 py-3 text-base"
                  value={eventDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </label>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Guests</span>
                  <span className="font-medium">{guestCount}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="h-12 w-12 rounded-full border border-line text-xl"
                    onClick={() => setGuestCount((g) => Math.max(1, g - 5))}
                  >
                    −
                  </button>
                  <div className="flex flex-1 flex-wrap justify-center gap-2">
                    {GUEST_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGuestCount(n)}
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          guestCount === n
                            ? "bg-sage text-white"
                            : "bg-mist/70 text-ink/70"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="h-12 w-12 rounded-full border border-line text-xl"
                    onClick={() => setGuestCount((g) => g + 5)}
                  >
                    +
                  </button>
                </div>
              </div>
            </section>
          )}

          {safeStep === "spread" && (
            <PickGrid
              items={catalog.packages
                .filter((p) => p.active)
                .map((p) => ({
                  id: p.slug,
                  name: p.name,
                  description: p.description,
                  photoUrl: p.photoUrl,
                  priceLabel:
                    p.priceCents == null
                      ? "Quoted later"
                      : p.priceUnit === "FLAT"
                        ? `${formatMoneyShort(p.priceCents)} starting`
                        : formatPriceWithUnit(p.priceCents, p.priceUnit),
                }))}
              selected={packageSlugs}
              onToggle={togglePkg}
            />
          )}

          {safeStep === "meats" && (
            <PickGrid
              items={toCards(itemsByCat.meats ?? [])}
              selected={dinner.meatIds}
              onToggle={(id) =>
                setDinner((d) => ({ ...d, meatIds: pickLimited(d.meatIds, id, 2) }))
              }
              selectedHint={`${dinner.meatIds.length} of 2`}
            />
          )}

          {safeStep === "sides" && (
            <PickGrid
              items={toCards(itemsByCat.sides ?? [])}
              selected={dinner.sideIds}
              onToggle={(id) =>
                setDinner((d) => ({ ...d, sideIds: pickLimited(d.sideIds, id, 2) }))
              }
              selectedHint={`${dinner.sideIds.length} of 2`}
            />
          )}

          {safeStep === "bread" && (
            <PickGrid
              items={toCards(itemsByCat.bread ?? [])}
              selected={dinner.breadId ? [dinner.breadId] : []}
              onToggle={(id) =>
                setDinner((d) => ({ ...d, breadId: d.breadId === id ? null : id }))
              }
              selectedHint="Pick 1"
            />
          )}

          {safeStep === "salads" && (
            <PickGrid
              items={toCards(itemsByCat.salads ?? [], true)}
              selected={saladIds}
              onToggle={(id) =>
                setSaladIds((cur) =>
                  cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                )
              }
              selectedHint={saladIds.length ? `${saladIds.length} selected` : "Optional"}
              allowEmpty
            />
          )}

          {safeStep === "addons" && (
            <PickGrid
              items={toCards(itemsByCat.addons ?? [], true)}
              selected={addonIds}
              onToggle={(id) =>
                setAddonIds((cur) =>
                  cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                )
              }
              allowEmpty
            />
          )}

          {safeStep === "desserts" && (
            <PickGrid
              items={toCards(itemsByCat.desserts ?? [])}
              selected={dessertIds}
              onToggle={(id) =>
                setDessertIds((cur) =>
                  cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                )
              }
              allowEmpty
            />
          )}

          {safeStep === "cake" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {CAKE_OPTIONS.map((opt) => {
                const on = cakeNotes === opt.notes;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCakeNotes(opt.notes)}
                    className={`rounded-2xl border px-5 py-6 text-left transition ${
                      on
                        ? "border-sage bg-paper ring-2 ring-sage"
                        : "border-line bg-paper hover:border-sage/40"
                    }`}
                  >
                    <div className="font-serif text-xl">{opt.label}</div>
                    <p className="mt-2 text-sm text-ink/55">Starting at $185</p>
                  </button>
                );
              })}
            </div>
          )}

          {safeStep === "drinks" && (
            <PickGrid
              items={toCards((itemsByCat.drinks ?? []).filter((d) => d.name !== "Water"))}
              selected={drinkIds}
              onToggle={(id) => setDrinkIds((cur) => pickLimited(cur, id, 2))}
              selectedHint={`${drinkIds.length} of 2`}
            />
          )}

          {safeStep === "service" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {catalog.charges
                .filter((t) => t.active)
                .map((t) => {
                  const on = chargeTemplateIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setChargeTemplateIds((cur) =>
                          cur.includes(t.id)
                            ? cur.filter((x) => x !== t.id)
                            : [...cur, t.id],
                        )
                      }
                      className={`rounded-2xl border px-5 py-5 text-left transition ${
                        on
                          ? "border-sage bg-paper ring-2 ring-sage"
                          : "border-line bg-paper hover:border-sage/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-serif text-xl">{t.name}</div>
                          <p className="mt-1 text-sm text-ink/55">{t.description}</p>
                        </div>
                        <Money cents={t.amountCents} />
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {safeStep === "review" && (
            <div className="mx-auto max-w-lg rounded-3xl border border-line bg-paper p-6">
              <h2 className="font-serif text-2xl">{clientName}</h2>
              <p className="mt-1 text-sm text-ink/60">
                {eventDate} · {guestCount} guests · {venue}
              </p>
              <p className="mt-1 text-sm text-ink/55">{contact}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {packageSlugs.map((s) => (
                  <li key={s} className="flex justify-between gap-3 border-b border-line py-2">
                    <span>{pkgMap[s]?.name ?? s}</span>
                    <span className="text-ink/50">
                      {pkgMap[s]?.priceCents == null
                        ? "Quoted later"
                        : formatPriceWithUnit(pkgMap[s]!.priceCents!, pkgMap[s]!.priceUnit)}
                    </span>
                  </li>
                ))}
                {dinner.meatIds.map((id) => (
                  <li key={id} className="text-ink/70">
                    Meat · {itemsByCat.meats?.find((x) => x.id === id)?.name}
                  </li>
                ))}
                {dinner.sideIds.map((id) => (
                  <li key={id} className="text-ink/70">
                    Side · {itemsByCat.sides?.find((x) => x.id === id)?.name}
                  </li>
                ))}
                {dinner.breadId ? (
                  <li className="text-ink/70">
                    Bread · {itemsByCat.bread?.find((x) => x.id === dinner.breadId)?.name}
                  </li>
                ) : null}
                {saladIds.map((id) => (
                  <li key={id} className="text-ink/70">
                    Salad · {itemsByCat.salads?.find((x) => x.id === id)?.name} · $3 per person
                  </li>
                ))}
              </ul>
              {client ? (
                <p className="mt-4 text-sm text-ink/65">
                  This is a request. Agape confirms pricing before anything is final.
                </p>
              ) : null}
              {error ? <p className="mt-4 text-sm text-terra">{error}</p> : null}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="text-sm">
            <div className="text-ink/50">{guestCount} guests</div>
            <div className="font-medium">
              {estimate ? <Money cents={estimate.totalCents} /> : "—"}
              {packageSlugs.includes("dessert-bar") ? (
                <span className="ml-2 text-xs font-normal text-ink/50">+ dessert quoted later</span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            {idx > 0 ? (
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2.5 text-sm"
                onClick={goBack}
              >
                Back
              </button>
            ) : null}
            {safeStep === "review" ? (
              <button
                type="button"
                disabled={busy || !canContinue()}
                onClick={submit}
                className="rounded-full bg-terra px-5 py-2.5 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : client ? "Submit request" : "Create invoice"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canContinue()}
                className="rounded-full bg-sage px-5 py-2.5 text-sm text-white disabled:opacity-40"
                onClick={goNext}
              >
                {safeStep === "salads" && saladIds.length === 0 ? "Skip" : "Continue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type CardItem = {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string | null;
  priceLabel?: string;
};

function toCards(items: MenuItem[], withPrice = false): CardItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    photoUrl: item.photoUrl,
    priceLabel:
      withPrice && item.priceCents != null
        ? formatPriceWithUnit(item.priceCents, item.priceUnit)
        : undefined,
  }));
}

function PickGrid({
  items,
  selected,
  onToggle,
  selectedHint,
}: {
  items: CardItem[];
  selected: string[];
  onToggle: (id: string) => void;
  selectedHint?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div>
      {selectedHint ? (
        <p className="mb-3 text-sm font-medium text-sage">{selectedHint}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const on = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className={`wizard-card-in overflow-hidden rounded-2xl border text-left transition ${
                on
                  ? "border-sage bg-paper ring-2 ring-sage"
                  : "border-line bg-paper hover:border-sage/35"
              }`}
            >
              <Photo url={item.photoUrl} name={item.name} className="h-28 w-full text-2xl" />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium leading-snug">{item.name}</div>
                  {item.priceLabel ? (
                    <span className="shrink-0 text-sm text-terra">{item.priceLabel}</span>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="mt-1 text-xs text-ink/55">{item.description}</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        className="mt-1 w-full rounded-2xl border border-line bg-cream/40 px-4 py-3 text-base"
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

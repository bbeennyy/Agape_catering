import { useEffect, useState } from "react";
import { api, type Settings } from "../api";
import { dollarsToCents } from "../../shared/pricing";

export function BusinessSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<Settings>("/settings").then(setS);
  }, []);

  if (!s) return <p>Loading…</p>;

  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = await api<Settings>("/settings", {
          method: "PATCH",
          body: JSON.stringify(s),
        });
        setS(next);
        setMsg("Saved");
      }}
    >
      <h1 className="font-serif text-3xl">Business</h1>
      <p className="text-sm text-ink/60">These print on every proposal. Tax starts at 0 until you set it.</p>
      {msg ? <p className="text-sm text-sage">{msg}</p> : null}
      {(
        [
          ["businessName", "Business name"],
          ["tagline", "Tagline"],
          ["phone", "Phone"],
          ["email", "Email"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-sm">
          {label}
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={s[key]}
            onChange={(e) => setS({ ...s, [key]: e.target.value })}
          />
        </label>
      ))}
      <label className="block text-sm">
        Address
        <textarea
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          rows={3}
          value={s.address}
          onChange={(e) => setS({ ...s, address: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        Default deposit ($)
        <input
          type="number"
          min={0}
          step={1}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={s.depositCents / 100}
          onChange={(e) =>
            setS({ ...s, depositCents: dollarsToCents(e.target.value || 0) })
          }
        />
      </label>
      <label className="block text-sm">
        Sales tax (%)
        <input
          type="number"
          min={0}
          step={0.01}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={Number((s.taxRateBps / 100).toFixed(2))}
          onChange={(e) =>
            setS({ ...s, taxRateBps: Math.round(Number(e.target.value || 0) * 100) })
          }
        />
        <span className="mt-1 block text-xs text-ink/50">
          Example: type 8.25 for 8.25% tax. Use 0 if you don’t charge tax.
        </span>
      </label>
      <label className="block text-sm">
        Balance due days before event
        <input
          type="number"
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={s.balanceDueDays}
          onChange={(e) => setS({ ...s, balanceDueDays: Number(e.target.value) })}
        />
      </label>
      <label className="block text-sm">
        Terms
        <textarea
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          rows={6}
          value={s.terms}
          onChange={(e) => setS({ ...s, terms: e.target.value })}
        />
      </label>
      <button className="rounded-full bg-sage px-4 py-2 text-white">Save</button>
    </form>
  );
}

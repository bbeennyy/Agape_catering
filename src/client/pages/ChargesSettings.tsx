import { useEffect, useState } from "react";
import { api, type ChargeTemplate } from "../api";
import { CHARGE_UNITS } from "../../shared/constants";
import { humanizeCode } from "../../shared/labels";
import { isAutoGratuity } from "../../shared/service";
import { dollarsToCents } from "../../shared/pricing";

export function ChargesSettings() {
  const [rows, setRows] = useState<ChargeTemplate[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0");
  const [unit, setUnit] = useState<(typeof CHARGE_UNITS)[number]>("FLAT");

  async function reload() {
    const c = await api<{ charges: ChargeTemplate[] }>("/catalog");
    setRows(c.charges);
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <h1 className="font-serif text-3xl">Extra charges</h1>
      <p className="mt-1 text-sm text-ink/60">
        Setup, travel, extra staff. Server gratuity is added once to every proposal — edit the $170
        rate here. Do not add it again on the invoice.
      </p>
      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/charges", {
            method: "POST",
            body: JSON.stringify({
              name,
              amountCents: dollarsToCents(amount),
              unit,
            }),
          });
          setName("");
          setAmount("0");
          setUnit("FLAT");
          await reload();
        }}
      >
        <input
          className="rounded-lg border border-line px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-28 rounded-lg border border-line px-3 py-2"
          placeholder="Amount $"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="rounded-lg border border-line px-3 py-2"
          value={unit}
          onChange={(e) => setUnit(e.target.value as (typeof CHARGE_UNITS)[number])}
        >
          {CHARGE_UNITS.map((u) => (
            <option key={u} value={u}>
              {humanizeCode(u)}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-sage px-4 py-2 text-white">Add</button>
      </form>
      <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-paper">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-ink/55">
                {r.description}
                {isAutoGratuity(r) ? " Added once to every proposal." : ""}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">
                $
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="ml-1 w-24 rounded border border-line px-2 py-1"
                  defaultValue={r.amountCents / 100}
                  key={`${r.id}-${r.amountCents}`}
                  onBlur={async (e) => {
                    await api(`/charges/${r.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ amountCents: dollarsToCents(e.target.value) }),
                    });
                    await reload();
                  }}
                />
              </label>
              <select
                className="rounded border border-line px-2 py-1 text-sm"
                defaultValue={r.unit}
                key={`${r.id}-unit-${r.unit}`}
                onChange={async (e) => {
                  await api(`/charges/${r.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ unit: e.target.value }),
                  });
                  await reload();
                }}
              >
                {CHARGE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {humanizeCode(u)}
                  </option>
                ))}
              </select>
              {isAutoGratuity(r) ? (
                <span className="text-xs text-ink/50">Automatic</span>
              ) : (
                <button
                  type="button"
                  className="text-sm text-terra"
                  onClick={async () => {
                    await api(`/charges/${r.id}`, { method: "DELETE" });
                    await reload();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

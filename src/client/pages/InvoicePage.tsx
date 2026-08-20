import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type ChargeTemplate, type InvoiceLine } from "../api";
import { Money } from "../components/ui";
import {
  calculateInvoice,
  formatMoney,
  type InvoiceLineInput,
  type InvoiceTotals,
} from "../../shared/pricing";

type Payload = {
  invoice: {
    id: string;
    version: number;
    status: string;
    notes: string;
    terms: string;
    taxRateBps: number;
    lines: InvoiceLine[];
    event: {
      id: string;
      clientName: string;
      guestCount: number;
      eventDate: string;
      eventName: string;
    };
  };
  totals: InvoiceTotals;
  settings: { depositCents: number };
  paidCents: number;
};

export function InvoicePage() {
  const { id, invoiceId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Payload | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [notes, setNotes] = useState("");
  const [taxRateBps, setTaxRateBps] = useState(0);
  const [charges, setCharges] = useState<ChargeTemplate[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!invoiceId) return;
    api<Payload>(`/invoices/${invoiceId}`).then((d) => {
      setData(d);
      setLines(d.invoice.lines);
      setNotes(d.invoice.notes);
      setTaxRateBps(d.invoice.taxRateBps);
    });
    api<{ charges: ChargeTemplate[] }>("/catalog").then((c) => setCharges(c.charges));
  }, [invoiceId]);

  const totals = useMemo(() => {
    if (!data) return null;
    return calculateInvoice({
      lines: lines as InvoiceLineInput[],
      guestCount: data.invoice.event.guestCount,
      taxRateBps,
      paidCents: data.paidCents,
      depositCents: data.settings.depositCents,
    });
  }, [data, lines, taxRateBps]);

  if (!data || !totals) return <p>Loading…</p>;
  const ev = data.invoice.event;

  function update(i: number, patch: Partial<InvoiceLine>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    const next = await api<Payload>(`/invoices/${data!.invoice.id}`, {
      method: "PATCH",
      body: JSON.stringify({ lines, notes, taxRateBps }),
    });
    setData(next);
    setLines(next.invoice.lines);
    setMsg("Saved");
  }

  async function revise() {
    const copy = await api<{ id: string }>(`/invoices/${data!.invoice.id}/revise`, {
      method: "POST",
    });
    navigate(`/admin/events/${id}/invoices/${copy.id}`);
  }

  async function emailStub() {
    const res = await api<{ mocked?: boolean; message: string }>(
      `/invoices/${data!.invoice.id}/email`,
      { method: "POST" },
    );
    setMsg(res.message);
  }

  async function stripeStub() {
    const res = await api<{ mocked?: boolean; message: string }>(
      `/invoices/${data!.invoice.id}/stripe-checkout`,
      { method: "POST" },
    );
    setMsg(res.message);
  }

  return (
    <div className="pb-16">
      <Link to={`/admin/events/${ev.id}`} className="text-sm text-sage">
        ← {ev.clientName}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Invoice v{data.invoice.version}</h1>
          <p className="text-sm text-ink/60">
            {ev.eventName} · {ev.eventDate} · {ev.guestCount} guests
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="rounded-full border border-line px-3 py-1.5 text-sm"
            href={`/api/invoices/${data.invoice.id}/pdf`}
          >
            Download PDF
          </a>
          <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={revise}>
            Revise (new version)
          </button>
          <button type="button" className="rounded-full bg-sage px-3 py-1.5 text-sm text-white" onClick={save}>
            Save
          </button>
        </div>
      </div>
      {msg ? <p className="mt-3 text-sm text-sage">{msg}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-mist/50 text-left">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit ¢</th>
              <th className="px-3 py-2">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-line px-1 py-1"
                    value={line.type}
                    onChange={(e) => update(i, { type: e.target.value })}
                  >
                    <option>PER_PERSON</option>
                    <option>FLAT</option>
                    <option>PERCENT_DISCOUNT</option>
                    <option>FIXED_DISCOUNT</option>
                    <option>TBD</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full rounded border border-line px-2 py-1 font-medium"
                    value={line.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                  <input
                    className="mt-1 w-full rounded border border-line px-2 py-1 text-xs"
                    value={line.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-20 rounded border border-line px-2 py-1"
                    value={line.qty}
                    onChange={(e) => update(i, { qty: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-24 rounded border border-line px-2 py-1"
                    value={line.unitCents}
                    onChange={(e) => update(i, { unitCents: Number(e.target.value) })}
                  />
                  {line.type === "PERCENT_DISCOUNT" ? (
                    <div className="text-[10px] text-ink/50">1000 = 10%</div>
                  ) : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {line.type === "TBD"
                    ? "TBD"
                    : formatMoney(
                        line.type === "PERCENT_DISCOUNT"
                          ? 0
                          : line.type === "FIXED_DISCOUNT"
                            ? -Math.abs(line.unitCents * line.qty)
                            : line.unitCents * line.qty,
                      )}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-terra"
                    onClick={() => setLines((cur) => cur.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-line px-3 py-1.5 text-sm"
          onClick={() =>
            setLines((cur) => [
              ...cur,
              { type: "FLAT", label: "Custom line", description: "", qty: 1, unitCents: 0 },
            ])
          }
        >
          Add line
        </button>
        <button
          type="button"
          className="rounded-full border border-line px-3 py-1.5 text-sm"
          onClick={() =>
            setLines((cur) => [
              ...cur,
              {
                type: "PERCENT_DISCOUNT",
                label: "Discount",
                description: "",
                qty: 1,
                unitCents: 1000,
              },
            ])
          }
        >
          Add % discount
        </button>
        <button
          type="button"
          className="rounded-full border border-line px-3 py-1.5 text-sm"
          onClick={() =>
            setLines((cur) => [
              ...cur,
              {
                type: "FIXED_DISCOUNT",
                label: "Discount",
                description: "",
                qty: 1,
                unitCents: 10000,
              },
            ])
          }
        >
          Add $ discount
        </button>
        {charges.map((t) => (
          <button
            key={t.id}
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-sm"
            onClick={() =>
              setLines((cur) => [
                ...cur,
                {
                  type: t.unit === "PER_PERSON" ? "PER_PERSON" : "FLAT",
                  label: t.name,
                  description: t.description,
                  qty: t.unit === "PER_PERSON" ? ev.guestCount : 1,
                  unitCents: t.amountCents,
                },
              ])
            }
          >
            + {t.name}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <label className="text-sm">
          Notes
          <textarea
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <label className="text-sm">
            Sales tax (%)
            <input
              type="number"
              min={0}
              step={0.01}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              value={Number((taxRateBps / 100).toFixed(2))}
              onChange={(e) => setTaxRateBps(Math.round(Number(e.target.value || 0) * 100))}
            />
            <span className="mt-1 block text-xs text-ink/50">
              Example: 8.25 means 8.25% tax.
            </span>
          </label>
          <dl className="mt-4 space-y-1 text-sm">
            <Row k="Subtotal" v={<Money cents={totals.subtotalCents} />} />
            <Row k="Tax" v={<Money cents={totals.taxCents} />} />
            <Row k="Total" v={<Money cents={totals.totalCents} />} />
            <Row k="Paid" v={<Money cents={totals.paidCents} />} />
            <Row k="Deposit (default)" v={<Money cents={totals.depositDueCents} />} />
            <Row k="Balance" v={<Money cents={totals.balanceCents} />} />
          </dl>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="rounded-full border border-line px-4 py-2 text-sm" onClick={emailStub}>
          Email proposal (later)
        </button>
        <button type="button" className="rounded-full border border-line px-4 py-2 text-sm" onClick={stripeStub}>
          Stripe checkout (later)
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink/60">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

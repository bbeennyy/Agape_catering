import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Money } from "../components/ui";
import { humanizeCode } from "../../shared/labels";
import { dollarsToCents, formatMoney, type InvoiceTotals } from "../../shared/pricing";

type EventPayload = {
  event: {
    id: string;
    clientName: string;
    contactName: string;
    phone: string;
    venue: string;
    eventName: string;
    eventDate: string;
    guestCount: number;
    notes: string;
    publicToken: string;
    status: string;
    invoices: { id: string; version: number; isCurrent: boolean; status: string }[];
    payments: { id: string; amountCents: number; type: string; method: string; createdAt: string }[];
  };
  totals: InvoiceTotals | null;
};

export function EventPage() {
  const { id } = useParams();
  const [data, setData] = useState<EventPayload | null>(null);
  const [amount, setAmount] = useState("200");
  const [msg, setMsg] = useState("");

  async function reload() {
    if (!id) return;
    setData(await api<EventPayload>(`/events/${id}`));
  }

  useEffect(() => {
    reload();
  }, [id]);

  if (!data) return <p>Loading…</p>;
  const { event, totals } = data;
  const current = event.invoices.find((i) => i.isCurrent) ?? event.invoices[0];

  return (
    <div>
      <Link to="/admin" className="text-sm text-sage">
        ← Events
      </Link>
      <h1 className="mt-2 font-serif text-3xl">{event.clientName}</h1>
      <p className="text-ink/60">
        {event.eventName} · {event.eventDate} · {event.guestCount} guests
      </p>
      <p className="text-sm text-ink/55">
        {event.contactName} {[event.phone, (event as { email?: string }).email].filter(Boolean).join(" · ")} · {event.venue}
      </p>
      {msg ? <p className="mt-2 text-sm text-sage">{msg}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-line px-4 py-2 text-sm"
          onClick={async () => {
            const url = `${window.location.origin}/p/${event.publicToken}`;
            await navigator.clipboard.writeText(url);
            setMsg(`Client link copied: ${url}`);
          }}
        >
          Copy client link
        </button>
        <button
          type="button"
          className="rounded-full bg-sage px-4 py-2 text-sm text-white"
          onClick={async () => {
            const res = await api<{ message?: string }>(`/events/${event.id}/send`, {
              method: "POST",
            });
            setMsg(res.message ?? "Proposal is now visible to the client.");
            await reload();
          }}
        >
          Send proposal to client
        </button>
      </div>

      {totals ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Total" cents={totals.totalCents} />
          <Stat label="Paid" cents={totals.paidCents} />
          <Stat label="Balance" cents={totals.balanceCents} />
        </div>
      ) : null}

      <h2 className="mt-8 font-serif text-xl">Invoices</h2>
      <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-paper">
        {event.invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between px-4 py-3">
            <span>
              Version {inv.version} · {humanizeCode(inv.status)}
              {inv.isCurrent ? " · current" : ""}
            </span>
            <Link className="text-sage" to={`/admin/events/${event.id}/invoices/${inv.id}`}>
              Open
            </Link>
          </li>
        ))}
      </ul>
      {current ? (
        <Link
          to={`/admin/events/${event.id}/invoices/${current.id}`}
          className="mt-4 inline-block rounded-full bg-sage px-4 py-2 text-sm text-white"
        >
          Edit current invoice
        </Link>
      ) : null}

      <h2 className="mt-10 font-serif text-xl">Record a payment</h2>
      <p className="text-sm text-ink/55">
        Stripe keys are not required yet. Log a deposit or balance by hand.
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await api(`/events/${event.id}/payments`, {
            method: "POST",
            body: JSON.stringify({
              amountCents: dollarsToCents(amount),
              type: "deposit",
              method: "manual",
            }),
          });
          setAmount("");
          await reload();
        }}
      >
        <input
          className="w-32 rounded-lg border border-line px-3 py-2"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="200.00"
        />
        <button className="rounded-full bg-terra px-4 py-2 text-sm text-white">Save payment</button>
      </form>
      <ul className="mt-3 text-sm text-ink/70">
        {event.payments.map((p) => (
          <li key={p.id}>
            {humanizeCode(p.type)} · {formatMoney(p.amountCents)} · {humanizeCode(p.method)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <div className="text-xs uppercase tracking-wide text-ink/50">{label}</div>
      <div className="mt-1 font-serif text-2xl">
        <Money cents={cents} />
      </div>
    </div>
  );
}

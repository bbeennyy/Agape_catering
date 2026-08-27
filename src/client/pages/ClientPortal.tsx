import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api";
import { ClientShell } from "../components/ClientShell";
import { Money } from "../components/ui";
import { formatMoney, formatPriceWithUnit, invoiceLineAmountCents, type InvoiceLineInput, type InvoiceTotals } from "../../shared/pricing";
import { Wizard } from "./Wizard";

type PublicEvent = {
  canEdit: boolean;
  status: string;
  invoiceStatus: string | null;
  event: {
    clientName: string;
    contactName: string;
    phone: string;
    email?: string;
    venue: string;
    eventName: string;
    eventDate: string;
    guestCount: number;
    notes: string;
  };
  invoice: {
    id: string;
    version: number;
    status: string;
    notes: string;
    terms: string;
    lines: {
      type: string;
      label: string;
      description: string;
      qty: number;
      unitCents: number;
    }[];
  } | null;
  totals: InvoiceTotals | null;
  paidCents: number;
  settings: {
    businessName: string;
    tagline: string;
    phone: string;
    email: string;
    depositCents: number;
    balanceDueDays: number;
    terms: string;
  };
  wizard: {
    event?: PublicEvent["event"];
    packageSlugs?: string[];
    dinner?: { meatIds: string[]; sideIds: string[]; breadId: string | null };
    saladIds?: string[];
    addonIds?: string[];
    dessertIds?: string[];
    drinkIds?: string[];
    cakeNotes?: string;
    chargeTemplateIds?: string[];
  } | null;
};

export function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState<PublicEvent | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [payMsg, setPayMsg] = useState("");

  async function reload(stayOnSummary = false) {
    if (!token) return;
    const next = await publicApi<PublicEvent>(`/events/${token}`);
    setData(next);
    if (stayOnSummary) setEditing(false);
    else setEditing(next.canEdit && !next.invoice);
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  }, [token]);

  if (error) {
    return (
      <ClientShell>
        <p className="text-terra">{error}</p>
      </ClientShell>
    );
  }
  if (!data || !token) {
    return (
      <ClientShell>
        <p className="text-ink/50">Loading…</p>
      </ClientShell>
    );
  }

  if (data.canEdit && (editing || !data.invoice)) {
    const initial = data.wizard && data.event.clientName && data.event.clientName !== "New client"
      ? data.wizard
      : undefined;
    return (
      <ClientShell>
        <Wizard
          mode="client"
          publicToken={token}
          initial={initial}
          onSubmitted={() => reload(true)}
        />
      </ClientShell>
    );
  }

  const official = data.invoiceStatus === "sent" || data.status === "quoted" || data.status === "booked";
  const totals = data.totals;

  return (
    <ClientShell>
      <p className="text-xs uppercase tracking-[0.2em] text-sage">
        {official ? "Your proposal" : "Menu request received"}
      </p>
      <h1 className="mt-1 font-serif text-3xl">{data.event.clientName}</h1>
      <p className="text-ink/60">
        {data.event.eventName} · {data.event.eventDate} · {data.event.guestCount} guests
      </p>
      <p className="text-sm text-ink/55">
        {[data.event.email, data.event.phone].filter(Boolean).join(" · ")} · {data.event.venue}
      </p>

      {!official ? (
        <p className="mt-4 rounded-xl bg-mist/70 px-4 py-3 text-sm">
          Agape has your menu. Prices below are an estimate until they send the confirmed
          proposal. You can still edit until then.
        </p>
      ) : (
        <p className="mt-4 rounded-xl bg-mist/70 px-4 py-3 text-sm">
          This is your confirmed proposal. A ${data.settings.depositCents / 100} deposit holds
          the date. Remaining balance is due {data.settings.balanceDueDays} days before the event.
        </p>
      )}

      {data.invoice ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-mist/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.invoice.lines.map((line, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{line.label}</div>
                    {line.description ? (
                      <div className="mt-1 text-xs text-ink/55">{line.description}</div>
                    ) : null}
                    {line.type === "PER_PERSON" && line.unitCents ? (
                      <div className="mt-1 text-xs text-ink/55">
                        {formatPriceWithUnit(line.unitCents, line.type)}
                      </div>
                    ) : null}
                    {line.type === "PERCENT_DISCOUNT" ? (
                      <div className="mt-1 text-xs text-ink/55">
                        {line.unitCents / 100}% off
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{line.type === "TBD" ? "—" : line.qty}</td>
                  <td className="px-4 py-3">
                    {line.type === "TBD"
                      ? "Quote later"
                      : formatMoney(
                          invoiceLineAmountCents(
                            data.invoice!.lines as InvoiceLineInput[],
                            i,
                            data.event.guestCount,
                          ),
                        )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {totals ? (
        <dl className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>
              <Money cents={totals.subtotalCents} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>
              <Money cents={totals.taxCents} />
            </dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Total</dt>
            <dd>
              <Money cents={totals.totalCents} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Paid</dt>
            <dd>
              <Money cents={totals.paidCents} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Balance</dt>
            <dd>
              <Money cents={totals.balanceCents} />
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {data.invoice ? (
          <a
            className="rounded-full bg-sage px-4 py-2 text-sm text-white"
            href={`/api/public/events/${token}/pdf`}
          >
            Download PDF
          </a>
        ) : null}
        {data.canEdit ? (
          <button
            type="button"
            className="rounded-full border border-line px-4 py-2 text-sm"
            onClick={() => setEditing(true)}
          >
            Edit menu
          </button>
        ) : null}
        {official ? (
          <button
            type="button"
            className="rounded-full bg-terra px-4 py-2 text-sm text-white"
            onClick={async () => {
              const res = await publicApi<{ message: string }>(`/events/${token}/pay`, {
                method: "POST",
              });
              setPayMsg(res.message);
            }}
          >
            {totals && totals.paidCents < totals.depositDueCents ? "Pay deposit" : "Pay balance"}
          </button>
        ) : null}
      </div>
      {payMsg ? <p className="mt-3 text-sm text-ink/70">{payMsg}</p> : null}

      <p className="mt-8 whitespace-pre-line text-xs text-ink/50">
        {data.invoice?.terms || data.settings.terms}
      </p>
      <p className="mt-4 text-xs text-ink/45">
        Bookmark this page. {data.settings.phone} · {data.settings.email}
      </p>
    </ClientShell>
  );
}

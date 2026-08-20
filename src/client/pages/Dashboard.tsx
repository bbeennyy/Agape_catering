import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { EventCalendar } from "../components/EventCalendar";
import { Money } from "../components/ui";
import type { InvoiceTotals } from "../../shared/pricing";

type Row = {
  id: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  venue: string;
  guestCount: number;
  status: string;
  publicToken: string;
  dueInDays: number | null;
  totals: InvoiceTotals | null;
};

type StatusFilter = "all" | "request" | "invite" | "quoted" | "booked" | "due_soon";
type SortKey = "date_asc" | "date_desc" | "name" | "total_desc";
type ViewTab = "list" | "calendar";

const PAGE_SIZE = 25;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "request", label: "Needs review" },
  { id: "invite", label: "Waiting" },
  { id: "quoted", label: "Sent" },
  { id: "booked", label: "Booked" },
  { id: "due_soon", label: "Due soon" },
];

export function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<ViewTab>("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("date_asc");
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  async function reload() {
    setRows(await api<Row[]>("/events"));
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [deferredQuery, statusFilter, sort]);

  const counts = useMemo(() => {
    if (!rows) return null;
    return {
      all: rows.length,
      request: rows.filter((r) => r.status === "request").length,
      invite: rows.filter((r) => r.status === "invite").length,
      quoted: rows.filter((r) => r.status === "quoted").length,
      booked: rows.filter((r) => r.status === "booked").length,
      due_soon: rows.filter(
        (r) =>
          r.dueInDays != null &&
          r.dueInDays <= 10 &&
          r.dueInDays >= 0 &&
          (r.totals?.balanceCents ?? 0) > 0,
      ).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let list = rows;

    if (statusFilter === "due_soon") {
      list = list.filter(
        (r) =>
          r.dueInDays != null &&
          r.dueInDays <= 10 &&
          r.dueInDays >= 0 &&
          (r.totals?.balanceCents ?? 0) > 0,
      );
    } else if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (deferredQuery) {
      list = list.filter((r) => {
        const hay = `${r.clientName} ${r.eventName} ${r.venue} ${r.eventDate}`.toLowerCase();
        return hay.includes(deferredQuery);
      });
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.clientName.localeCompare(b.clientName);
        case "total_desc":
          return (b.totals?.totalCents ?? -1) - (a.totals?.totalCents ?? -1);
        case "date_desc":
          return (b.eventDate || "").localeCompare(a.eventDate || "");
        case "date_asc":
        default:
          if (!a.eventDate && !b.eventDate) return 0;
          if (!a.eventDate) return 1;
          if (!b.eventDate) return -1;
          return a.eventDate.localeCompare(b.eventDate);
      }
    });
    return sorted;
  }, [rows, statusFilter, deferredQuery, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const hasActiveFilters = Boolean(query.trim()) || statusFilter !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Events</h1>
          <p className="mt-1 text-sm text-ink/60">
            {counts ? `${counts.all} total` : "Proposals and invoices"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-line px-4 py-2 text-sm"
            title="Creates a private link you can text or email. The client opens it and fills in their event details."
            onClick={async () => {
              const created = await api<{ id: string; publicToken: string }>("/events/client-link", {
                method: "POST",
              });
              const url = `${window.location.origin}/p/${created.publicToken}`;
              await navigator.clipboard.writeText(url);
              setMsg(`Copied private client link — send it so they can fill in their event.`);
              await reload();
            }}
          >
            Send Link to Client
          </button>
          <Link
            to="/admin/events/new"
            className="rounded-full bg-terra px-4 py-2 text-sm text-white hover:bg-terra/90"
          >
            New proposal
          </Link>
        </div>
      </div>
      {msg ? <p className="mt-2 text-sm text-sage">{msg}</p> : null}

      {!rows ? (
        <p className="mt-10 text-ink/50">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-paper p-10 text-center">
          <p className="font-serif text-xl">No events yet</p>
          <p className="mt-2 text-sm text-ink/60">
            Send a link to a client, or build a proposal yourself.
          </p>
        </div>
      ) : (
        <section className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-line bg-paper p-1">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  view === "list" ? "bg-sage text-white" : "text-ink/70 hover:bg-mist/60"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  view === "calendar" ? "bg-sage text-white" : "text-ink/70 hover:bg-mist/60"
                }`}
              >
                Calendar
              </button>
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client, event, venue…"
              className="min-w-[12rem] flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm"
            />

            {view === "list" ? (
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-full border border-line bg-paper px-3 py-2 text-sm"
                aria-label="Sort by"
              >
                <option value="date_asc">Soonest first</option>
                <option value="date_desc">Latest first</option>
                <option value="name">Name A–Z</option>
                <option value="total_desc">Highest total</option>
              </select>
            ) : null}

            {hasActiveFilters ? (
              <button
                type="button"
                className="text-sm text-terra hover:underline"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const n = counts?.[f.id] ?? 0;
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    active
                      ? "bg-sage text-white"
                      : "border border-line bg-paper text-ink/75 hover:bg-mist/60"
                  }`}
                >
                  {f.label}
                  <span className={`ml-1 tabular-nums ${active ? "text-white/80" : "text-ink/40"}`}>
                    {n}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-ink/50">
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
            {filtered.length !== rows.length ? ` of ${rows.length}` : ""}
          </p>

          {view === "calendar" ? (
            <div className="mt-3">
              <EventCalendar events={filtered} compact />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper p-8 text-center text-sm text-ink/60">
              No events match.
            </div>
          ) : (
            <>
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper">
                <table className="w-full text-left text-sm">
                  <thead className="bg-mist/60 text-ink/70">
                    <tr>
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Guests</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id} className="border-t border-line hover:bg-mist/30">
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/events/${r.id}`}
                            className="font-medium text-sage-dark hover:underline"
                          >
                            {r.clientName}
                          </Link>
                          <div className="text-xs text-ink/50">{r.eventName || r.venue}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Status
                            status={r.status}
                            dueInDays={r.dueInDays}
                            balance={r.totals?.balanceCents ?? 0}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.eventDate || "—"}</td>
                        <td className="px-4 py-3">{r.guestCount}</td>
                        <td className="px-4 py-3">
                          {r.totals ? <Money cents={r.totals.totalCents} /> : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r.totals ? <Money cents={r.totals.balanceCents} /> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pageCount > 1 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-ink/55">
                    Page {safePage + 1} of {pageCount}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={safePage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Status({
  status,
  dueInDays,
  balance,
}: {
  status: string;
  dueInDays: number | null;
  balance: number;
}) {
  const label =
    status === "invite"
      ? "Waiting on client"
      : status === "request"
        ? "Needs review"
        : status === "quoted"
          ? "Proposal sent"
          : status === "booked"
            ? "Booked"
            : status;
  return (
    <div>
      <div>{label}</div>
      {dueInDays != null && dueInDays <= 10 && dueInDays >= 0 && balance > 0 ? (
        <div className="text-xs text-terra">Balance due in {dueInDays}d</div>
      ) : null}
    </div>
  );
}

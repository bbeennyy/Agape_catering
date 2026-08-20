import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatMoneyShort } from "../../shared/pricing";
import type { InvoiceTotals } from "../../shared/pricing";

export type CalendarEvent = {
  id: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  totals: InvoiceTotals | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TAG_STYLES = [
  "bg-rose-500 text-white",
  "bg-amber-500 text-white",
  "bg-emerald-600 text-white",
  "bg-sky-500 text-white",
  "bg-orange-500 text-white",
  "bg-teal-600 text-white",
  "bg-fuchsia-500 text-white",
  "bg-lime-600 text-white",
  "bg-cyan-600 text-white",
  "bg-red-500 text-white",
  "bg-yellow-500 text-ink",
  "bg-blue-500 text-white",
];

function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAG_STYLES[h % TAG_STYLES.length];
}

/** Prefer YYYY-MM-DD; ignore empty / unparseable. */
function dateKey(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function buildCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { key: string; day: number | null; inMonth: boolean }[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ key: `pad-${i}`, day: null, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key, day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `end-${cells.length}`, day: null, inMonth: false });
  }
  return cells;
}

function defaultCursor(events: CalendarEvent[]) {
  const today = new Date();
  const withDates = events
    .map((e) => dateKey(e.eventDate))
    .filter((k): k is string => Boolean(k))
    .sort();
  const upcoming = withDates.find((k) => k >= today.toISOString().slice(0, 10));
  const pick = upcoming ?? withDates[0];
  if (pick) {
    const [y, m] = pick.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  return { year: today.getFullYear(), month: today.getMonth() };
}

export function EventCalendar({
  events,
  compact = false,
}: {
  events: CalendarEvent[];
  compact?: boolean;
}) {
  const initial = useMemo(() => defaultCursor(events), [events]);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = dateKey(e.eventDate);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => buildCells(year, month), [year, month]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const datedCount = [...byDay.values()].reduce((n, list) => n + list.length, 0);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-line bg-paper ${compact ? "" : "mt-6"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 px-4 py-3">
        <div>
          {compact ? null : <h2 className="font-serif text-xl text-sage-dark">Event calendar</h2>}
          <p className="text-xs text-ink/55">
            {datedCount === 0
              ? "Proposed dates appear once events have a date."
              : `${datedCount} dated event${datedCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-mist/60"
            aria-label="Previous month"
          >
            ←
          </button>
          <div className="min-w-[10rem] text-center text-sm font-medium">{monthLabel(year, month)}</div>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-mist/60"
            aria-label="Next month"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setYear(t.getFullYear());
              setMonth(t.getMonth());
            }}
            className="ml-1 rounded-full bg-sage px-3 py-1.5 text-xs text-white hover:bg-sage-dark"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-mist/40 text-center text-[11px] font-medium uppercase tracking-wide text-ink/55">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {cells.map((cell) => {
          const dayEvents = cell.inMonth ? (byDay.get(cell.key) ?? []) : [];
          const isToday = cell.inMonth && cell.key === todayKey;
          return (
            <div
              key={cell.key}
              className={`min-h-[5.5rem] border-b border-r border-line p-1.5 last:border-r-0 sm:min-h-[7rem] ${
                cell.inMonth ? "bg-paper" : "bg-cream/50"
              } ${isToday ? "ring-2 ring-inset ring-terra/40" : ""}`}
            >
              {cell.day != null ? (
                <div
                  className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-terra font-semibold text-white" : "text-ink/70"
                  }`}
                >
                  {cell.day}
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                {dayEvents.map((ev) => {
                  const label = ev.eventName?.trim() || ev.clientName;
                  const price =
                    ev.totals != null ? formatMoneyShort(ev.totals.totalCents) : "TBD";
                  return (
                    <Link
                      key={ev.id}
                      to={`/admin/events/${ev.id}`}
                      title={`${ev.clientName}${ev.eventName ? ` · ${ev.eventName}` : ""} · ${price}`}
                      className={`block truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow-sm transition hover:brightness-110 sm:text-[11px] ${colorForId(ev.id)}`}
                    >
                      <span className="block truncate">{label}</span>
                      <span className="block truncate opacity-90">{price}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

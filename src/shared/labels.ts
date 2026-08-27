/** Client-facing wording for stored codes (PER_PERSON, FLAT, draft, …). */

const LABELS: Record<string, string> = {
  PER_PERSON: "Per person",
  FLAT: "Flat fee",
  PER_UNIT: "Per unit",
  PER_LAYER: "Per layer",
  PER_SERVER: "Per server",
  PERCENT_DISCOUNT: "Percent discount",
  FIXED_DISCOUNT: "Dollar discount",
  TBD: "Quote later",
  NONE: "No extra charge",
  draft: "Draft",
  sent: "Sent",
  invite: "Waiting on client",
  request: "Needs review",
  quoted: "Proposal sent",
  booked: "Booked",
  deposit: "Deposit",
  balance: "Balance",
  manual: "Manual",
};

export function humanizeCode(value: string | null | undefined): string {
  if (!value) return "";
  if (LABELS[value]) return LABELS[value];
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

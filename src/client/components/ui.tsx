import { formatMoney, formatMoneyShort } from "../../shared/pricing";

export function Money({ cents, short }: { cents: number; short?: boolean }) {
  return <span>{short ? formatMoneyShort(cents) : formatMoney(cents)}</span>;
}

export function Photo({
  url,
  name,
  className = "",
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`grid place-items-center bg-mist font-serif text-sage ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}

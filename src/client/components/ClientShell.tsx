import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-ink">
            <div className="font-serif text-xl tracking-[0.2em] text-sage-dark">AGAPE</div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-sage">Catering</div>
          </Link>
          <div className="flex items-center gap-4 text-right text-xs text-ink/55">
            <Link to="/" className="hidden hover:text-sage sm:inline">
              Home
            </Link>
            <div>
              <div>Food made with love</div>
              <div>(678) 790-6184</div>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

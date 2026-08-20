import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=2400&q=80";

const PACKAGES = [
  {
    name: "Grazing table",
    price: "From $8 pp",
    blurb: "A styled flat-lay spread for guests as they arrive.",
  },
  {
    name: "Dinner buffet",
    price: "$18 pp",
    blurb: "Two meats, two sides, and bread. Salad is $3 extra.",
  },
  {
    name: "Passed hors d'oeuvres",
    price: "From $12 pp",
    blurb: "Passed bites with optional add-ons like shrimp or filet.",
  },
];

export function Landing() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="min-h-screen bg-ink text-paper">
      <section className="relative min-h-[100svh] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Catered dinner table with warm candlelight and plated food"
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[2.4s] ease-out ${
            ready ? "scale-100" : "scale-105"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/25" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col px-4 pb-16 pt-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <div className="font-serif text-2xl tracking-[0.28em] text-paper sm:text-3xl">
                AGAPE
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.32em] text-paper/70">
                Catering
              </div>
            </div>
            <a
              href="tel:6787906184"
              className="text-sm text-paper/80 transition hover:text-paper"
            >
              (678) 790-6184
            </a>
          </header>

          <div
            className={`mt-auto max-w-xl transition-all duration-1000 ease-out ${
              ready ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            }`}
          >
            <p className="font-serif text-4xl leading-tight tracking-tight text-paper sm:text-5xl md:text-6xl">
              Food made with love
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-paper/80 sm:text-lg">
              Georgia catering for weddings and gatherings — built around your
              menu, guest count, and the way you want the table to feel.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/start"
                className="rounded-full bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-cream"
              >
                Build your menu
              </Link>
              <a
                href="#packages"
                className="rounded-full border border-paper/40 px-6 py-3 text-sm text-paper/90 transition hover:border-paper hover:bg-paper/10"
              >
                See packages
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className="bg-cream px-4 py-20 text-ink">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-3xl sm:text-4xl">How we serve you</h2>
          <p className="mt-3 max-w-xl text-ink/65">
            Start with a package. Fill in the dishes. Agape confirms the final
            proposal before anything is locked in.
          </p>
          <div className="mt-12 grid gap-10 border-t border-line pt-10 md:grid-cols-3">
            {PACKAGES.map((pkg) => (
              <div key={pkg.name}>
                <p className="text-xs uppercase tracking-[0.22em] text-sage">{pkg.price}</p>
                <h3 className="mt-2 font-serif text-2xl">{pkg.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{pkg.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-sage-dark px-4 py-24 text-paper">
        <div
          className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-sage/40 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl">
          <h2 className="font-serif text-3xl sm:text-4xl">A short path to your table</h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Choose the spread",
                body: "Dinner, grazing, hors d'oeuvres, dessert, cake — pick what fits the night.",
              },
              {
                n: "02",
                title: "Name the dishes",
                body: "Select meats, sides, bread, salads, and drinks from the full Agape menu.",
              },
              {
                n: "03",
                title: "We confirm",
                body: "You submit a request. Agape reviews pricing, adds service if needed, and sends the proposal.",
              },
            ].map((step) => (
              <li key={step.n}>
                <p className="font-serif text-sm tracking-[0.2em] text-paper/50">{step.n}</p>
                <h3 className="mt-3 font-serif text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/70">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14">
            <Link
              to="/start"
              className="inline-flex rounded-full bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-cream"
            >
              Start building your menu
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink/10 bg-cream px-4 py-10 text-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-serif text-lg tracking-[0.22em]">AGAPE</div>
            <p className="mt-2 text-sm text-ink/60">
              229 Morgan Road, Danielsville, GA
              <br />
              Agapelove4food@gmail.com
            </p>
          </div>
          <p className="text-sm text-ink/50">Food made with love</p>
        </div>
      </footer>
    </div>
  );
}

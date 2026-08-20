import { useState, type FormEvent } from "react";
import { api } from "../api";

export function Login({ onLogin }: { onLogin: (u: { id: string; email: string; name: string }) => void }) {
  const [email, setEmail] = useState("laura@agape.local");
  const [password, setPassword] = useState("agapelocal");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: { id: string; email: string; name: string } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-none"
      >
        <div className="mb-6 text-center">
          <div className="font-serif text-3xl tracking-[0.22em] text-sage-dark">AGAPE</div>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-sage">Catering</div>
          <p className="mt-4 text-sm text-ink/70">Food made with love</p>
        </div>
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="mt-3 block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-terra">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-full bg-sage py-2.5 text-white hover:bg-sage-dark disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs text-ink/50">
          Local default: laura@agape.local / agapelocal
        </p>
        <p className="mt-3 text-center text-sm">
          <a className="text-sage underline" href="/">
            Back to the client site
          </a>
        </p>
      </form>
    </div>
  );
}

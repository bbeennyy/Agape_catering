import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api";

type Props = {
  user: { name: string; email: string };
  onLogout: () => void;
};

const links = [
  { to: "/admin", label: "Events" },
  { to: "/admin/events/new", label: "New proposal" },
  { to: "/", label: "Client site" },
  { to: "/admin/settings/menu", label: "Menu" },
  { to: "/admin/settings/charges", label: "Charges" },
  { to: "/admin/settings/business", label: "Business" },
];

export function Layout({ user, onLogout }: Props) {
  const navigate = useNavigate();
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    onLogout();
    navigate("/admin/login");
  }
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <div className="font-serif text-xl tracking-[0.2em] text-sage-dark">AGAPE</div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-sage">Admin</div>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/admin" || l.to === "/"}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm ${
                    isActive && l.to !== "/"
                      ? "bg-sage text-white"
                      : "text-ink/80 hover:bg-mist"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink/70 sm:inline">{user.name}</span>
            <button type="button" onClick={logout} className="text-terra hover:underline">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

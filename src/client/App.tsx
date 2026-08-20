import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { BusinessSettings } from "./pages/BusinessSettings";
import { ChargesSettings } from "./pages/ChargesSettings";
import { ClientOrder } from "./pages/ClientOrder";
import { ClientPortal } from "./pages/ClientPortal";
import { Dashboard } from "./pages/Dashboard";
import { EventPage } from "./pages/EventPage";
import { InvoicePage } from "./pages/InvoicePage";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { MenuSettings } from "./pages/MenuSettings";
import { Wizard } from "./pages/Wizard";

type User = { id: string; email: string; name: string };

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function RedirectOldEvent() {
  const { id } = useParams();
  return <Navigate to={`/admin/events/${id}`} replace />;
}

function RedirectOldInvoice() {
  const { id, invoiceId } = useParams();
  return <Navigate to={`/admin/events/${id}/invoices/${invoiceId}`} replace />;
}

function RedirectOldSettings() {
  const { "*": rest } = useParams();
  return <Navigate to={`/admin/settings/${rest ?? ""}`} replace />;
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const location = useLocation();
  const onAdmin = isAdminPath(location.pathname);

  useEffect(() => {
    if (!onAdmin) return;
    let cancelled = false;
    api<{ user: User | null }>("/auth/me")
      .then((d) => {
        if (!cancelled) setUser(d.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, onAdmin]);

  if (onAdmin && user === undefined) {
    return (
      <div className="grid min-h-screen place-items-center text-sage">
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      {/* Client site */}
      <Route path="/" element={<Landing />} />
      <Route path="/start" element={<ClientOrder />} />
      <Route path="/p/:token" element={<ClientPortal />} />

      {/* Old client / admin URLs */}
      <Route path="/order" element={<Navigate to="/" replace />} />
      <Route path="/order/start" element={<Navigate to="/start" replace />} />
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/events/new" element={<Navigate to="/admin/events/new" replace />} />
      <Route path="/events/:id" element={<RedirectOldEvent />} />
      <Route path="/events/:id/invoices/:invoiceId" element={<RedirectOldInvoice />} />
      <Route path="/settings/*" element={<RedirectOldSettings />} />

      {/* Admin */}
      <Route
        path="/admin/login"
        element={
          user ? (
            <Navigate to="/admin" replace />
          ) : (
            <Login onLogin={setUser} />
          )
        }
      />

      {user ? (
        <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/events/new" element={<Wizard />} />
          <Route path="/admin/events/:id" element={<EventPage />} />
          <Route
            path="/admin/events/:id/invoices/:invoiceId"
            element={<InvoicePage />}
          />
          <Route path="/admin/settings/menu" element={<MenuSettings />} />
          <Route path="/admin/settings/business" element={<BusinessSettings />} />
          <Route path="/admin/settings/charges" element={<ChargesSettings />} />
        </Route>
      ) : (
        <Route
          path="/admin/*"
          element={<Navigate to="/admin/login" replace />}
        />
      )}

      <Route
        path="*"
        element={<Navigate to={onAdmin ? "/admin/login" : "/"} replace />}
      />
    </Routes>
  );
}

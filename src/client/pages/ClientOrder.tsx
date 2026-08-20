import { ClientShell } from "../components/ClientShell";
import { Wizard } from "./Wizard";

export function ClientOrder() {
  return (
    <ClientShell>
      <Wizard mode="client" />
    </ClientShell>
  );
}

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/platform";
import { AdminPanel } from "@/components/admin-panel";
export default async function Admin() {
  const u = await requireUser();
  if (!isAdmin(u.id)) notFound();
  return (
    <section className="section private-page">
      <h1>Administration</h1>
      <p>
        Gestion des modèles, comptes et opérations. Chaque modification exige
        une justification.
      </p>
      <AdminPanel />
    </section>
  );
}

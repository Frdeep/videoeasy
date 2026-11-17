import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/page-user";
import { isAdmin } from "@/lib/platform";
import { AdminPanel } from "@/components/admin-panel";
export default async function Admin() {
  const u = await requirePageUser();
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

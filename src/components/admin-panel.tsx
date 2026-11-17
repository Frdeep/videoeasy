"use client";
import { useEffect, useState } from "react";
type Model = {
  allowed_plans: string[];
  id: string;
  name: string;
  enabled: boolean;
  credits: number;
  provider: string;
};
type Row = Record<string, string | number | boolean>;
export function AdminPanel() {
  const [adjustmentId, setAdjustmentId] = useState("");
  useEffect(() => setAdjustmentId(crypto.randomUUID()), []);
  const [data, setData] = useState<{
    models: Model[];
    jobs: Row[];
    profiles: Row[];
    audit: Row[];
  }>();
  const [message, setMessage] = useState("Chargement…");
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch("/api/platform/admin");
    if (!r.ok) throw Error();
    setData(await r.json());
    setMessage("");
  }
  useEffect(() => {
    load().catch(() => setMessage("Administration indisponible."));
  }, []);
  async function send(value: object) {
    setBusy(true);
    try {
      const r = await fetch("/api/platform/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!r.ok) throw Error();
      await load();
      setAdjustmentId(crypto.randomUUID());
    } catch {
      setMessage("Modification refusée ou service indisponible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p role="status">{message}</p>
      <h2>Catalogue des modèles</h2>
      {data?.models.map((m) => (
        <form
          className="admin-row"
          key={m.id}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send({
              action: "model",
              id: m.id,
              enabled: f.get("enabled") === "on",
              allowedPlans: f.getAll("plans"),
              credits: Number(f.get("credits")),
              reason: f.get("reason"),
            });
          }}
        >
          <strong>
            {m.name} · {m.provider}
          </strong>
          {["standard", "metal", "gold"].map((plan) => (
            <label key={plan}>
              {plan}
              <input
                type="checkbox"
                name="plans"
                value={plan}
                defaultChecked={m.allowed_plans.includes(plan)}
              />
            </label>
          ))}
          <label>
            Actif
            <input name="enabled" type="checkbox" defaultChecked={m.enabled} />
          </label>
          <label>
            Crédits
            <input
              name="credits"
              type="number"
              min="1"
              max="100000"
              defaultValue={m.credits}
              required
            />
          </label>
          <input
            name="reason"
            aria-label="Justification"
            placeholder="Justification obligatoire"
            minLength={5}
            maxLength={500}
            required
          />
          <button disabled={busy}>Enregistrer</button>
        </form>
      ))}
      <h2>Comptes et suspension</h2>
      <form
        className="admin-row"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void send({
            action: "suspend",
            id: f.get("id"),
            suspended: f.get("suspended") === "on",
            reason: f.get("reason"),
          });
        }}
      >
        <input
          name="id"
          placeholder="UUID Supabase du compte"
          aria-label="UUID du compte"
          required
        />
        <label>
          Suspendre
          <input name="suspended" type="checkbox" />
        </label>
        <input
          name="reason"
          placeholder="Justification obligatoire"
          aria-label="Justification suspension"
          minLength={5}
          maxLength={500}
          required
        />
        <button disabled={busy}>Appliquer</button>
      </form>
      {data?.profiles.map((p) => (
        <p key={String(p.user_id)}>
          {String(p.user_id)} · {String(p.display_name)} ·{" "}
          {p.suspended ? "Suspendu" : "Actif"}
        </p>
      ))}
      <h2>Ajustement des crédits</h2>
      <p>
        Sur la période payée courante uniquement. Un retrait ne peut pas
        utiliser les crédits déjà réservés.
      </p>
      <form
        className="admin-row"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void send({
            action: "credits",
            id: f.get("id"),
            requestId: f.get("requestId"),
            delta: Number(f.get("delta")),
            reason: f.get("reason"),
          });
        }}
      >
        <input name="requestId" type="hidden" value={adjustmentId} />
        <input
          name="id"
          placeholder="UUID du compte"
          aria-label="Compte à ajuster"
          required
        />
        <input
          name="delta"
          type="number"
          min="-100000"
          max="100000"
          placeholder="Crédits (+ ou −)"
          aria-label="Nombre de crédits à ajuster"
          required
        />
        <input
          name="reason"
          minLength={5}
          maxLength={500}
          placeholder="Justification"
          aria-label="Justification ajustement"
          required
        />
        <button disabled={busy}>Ajuster</button>
      </form>
      <h2>Dernières tâches</h2>
      <div className="admin-table">
        {data?.jobs.map((j) => (
          <p key={String(j.id)}>
            {String(j.id)} · {String(j.status)} · {String(j.credits)} crédits
          </p>
        ))}
      </div>
      <h2>Journal des modifications</h2>
      {data?.audit.map((a) => (
        <p key={String(a.id)}>
          {String(a.action)} · {String(a.target)} · {String(a.reason)}
        </p>
      ))}
    </>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Paywall } from "./paywall";
import { RiseText, Segmented } from "./motion";
import { genres, starters, type Genre } from "@/lib/showcase";
import { presets } from "@/lib/presets";
import { useT } from "./i18n";

type Model = {
  id: string;
  name: string;
  kind: string;
  credits: number;
  provider: string;
};
type Sub = { status: string; plan: string; available_credits: string | number };
type Ratio = "16:9" | "9:16";
const modes = ["Libre", "Presets"] as const;

const ratioOf = (m: Model): Ratio =>
  m.name.includes("9:16") ? "9:16" : "16:9";

export function GenerationForm() {
  const { t, dl, locale } = useT();
  const [models, setModels] = useState<Model[]>([]);
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [mode, setMode] = useState<(typeof modes)[number]>("Libre");
  const [ratio, setRatio] = useState<Ratio>("9:16");
  const [genre, setGenre] = useState<Genre>("Réaliste");
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState(presets[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [autoRewrite, setAutoRewrite] = useState(true);
  const [rewritten, setRewritten] = useState("");
  const [id, setId] = useState("");
  const [step, setStep] = useState<"" | "rewrite" | "send">("");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const g = q.get("genre");
    if (g && (genres as readonly string[]).includes(g)) {
      setGenre(g as Genre);
      setPrompt(t(starters[g as Genre]));
    }
    Promise.all([
      fetch("/api/platform/models").then((r) =>
        r.ok ? r.json() : { models: [] },
      ),
      fetch("/api/billing/status").then((r) =>
        r.ok ? r.json() : { subscriptions: [] },
      ),
    ])
      .then(([m, s]) => {
        setModels(m.models ?? []);
        setSub(
          (s.subscriptions ?? []).find((x: Sub) => x.status === "active") ??
            null,
        );
      })
      .catch(() => {
        setSub(null);
        setError(t("Studio indisponible. Réessayez."));
      });
  }, []);

  const preset = presets.find((p) => p.id === presetId)!;
  const script = useMemo(
    () => (mode === "Libre" ? prompt : preset.build(values)),
    [mode, prompt, preset, values],
  );
  const model = models.find((m) => ratioOf(m) === ratio);
  const balance = sub ? Number(sub.available_credits) : 0;
  const enough = !!model && balance >= model.credits;
  const busy = step !== "";
  const touch = () => {
    setId("");
    setRewritten("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !model) return;
    setError("");
    let finalScript = rewritten || script;
    try {
      if (autoRewrite && !rewritten) {
        setStep("rewrite");
        const r = await fetch("/api/platform/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: script,
            genre: mode === "Libre" ? genre : preset.genre,
            ratio,
            lang: locale,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(t(d.error ?? ""));
        finalScript = d.prompt;
        setRewritten(d.prompt);
      }
      setStep("send");
      const jobId = id || crypto.randomUUID();
      setId(jobId);
      const r = await fetch("/api/platform/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: jobId,
          model: model.id,
          prompt: finalScript,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(t(d.error ?? ""));
      location.assign("/gallery");
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : t("Non confirmé. Réessayez."),
      );
      setStep("");
    }
  }

  if (sub === undefined)
    return (
      <div className="page studio-page">
        <div className="skeleton" aria-busy="true" aria-label={t("Chargement")} />
      </div>
    );

  if (sub === null)
    return (
      <div className="page">
        <Paywall
          compact
          title={t("Débloquez le studio.")}
          subtitle={t("Choisissez une formule. Créez tout de suite.")}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );

  return (
    <div className="page studio-page">
      <header className="page-head">
        <RiseText text="Créer." />
        <div className="balance" aria-live="polite">
          <strong>{balance.toLocaleString(dl)}</strong> {t("crédits")}
        </div>
      </header>

      <form className="composer" onSubmit={submit}>
        <Segmented
          options={modes}
          value={mode}
          label="Mode"
          onChange={(m) => {
            setMode(m);
            if (m === "Presets") setRatio(preset.ratio);
            touch();
          }}
        />

        {mode === "Libre" ? (
          <div className="mode-pane" key="libre">
            <label className="field-label" htmlFor="generation-prompt">
              {t("Votre idée")}
            </label>
            <textarea
              id="generation-prompt"
              disabled={busy}
              maxLength={2500}
              rows={5}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                touch();
              }}
              placeholder={t("Ex. : un chat qui fait du skate au coucher du soleil.")}
            />
            <div className="chips" role="group" aria-label={t("Genre")}>
              {genres.map((g) => (
                <button
                  type="button"
                  key={g}
                  className={g === genre ? "chip on" : "chip"}
                  aria-pressed={g === genre}
                  onClick={() => {
                    setGenre(g);
                    if (
                      !prompt.trim() ||
                      Object.values(starters).some((x) => x === prompt || t(x) === prompt)
                    )
                      setPrompt(t(starters[g]));
                    touch();
                  }}
                >
                  {t(g)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mode-pane" key="presets">
            <div className="preset-grid" role="radiogroup" aria-label="Presets">
              {presets.map((p) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={p.id === presetId}
                  key={p.id}
                  className={p.id === presetId ? "preset on" : "preset"}
                  onClick={() => {
                    setPresetId(p.id);
                    setValues({});
                    setRatio(p.ratio);
                    touch();
                  }}
                >
                  <small>{t(p.genre)}</small>
                  <strong>{t(p.name)}</strong>
                  <span>{t(p.pitch)}</span>
                </button>
              ))}
            </div>
            <div className="preset-fields">
              {preset.fields.map((f) => (
                <div key={f.key}>
                  <label className="field-label" htmlFor={`f-${f.key}`}>
                    {t(f.label)}
                  </label>
                  {f.options ? (
                    <div className="chips">
                      {f.options.map((o) => (
                        <button
                          type="button"
                          key={o}
                          className={values[f.key] === o ? "chip on" : "chip"}
                          onClick={() => {
                            setValues({ ...values, [f.key]: o });
                            touch();
                          }}
                        >
                          {t(o)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      id={`f-${f.key}`}
                      value={values[f.key] ?? ""}
                      placeholder={t(f.placeholder)}
                      maxLength={200}
                      onChange={(e) => {
                        setValues({ ...values, [f.key]: e.target.value });
                        touch();
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="script-preview">
              <span>{t("Script")}</span>
              {script}
            </p>
          </div>
        )}

        <span className="field-label">{t("Format")}</span>
        <div className="format-choice" role="radiogroup" aria-label="Format">
          {(["9:16", "16:9"] as Ratio[]).map((r) => (
            <button
              type="button"
              role="radio"
              aria-checked={r === ratio}
              key={r}
              className={r === ratio ? "active" : ""}
              disabled={busy}
              onClick={() => {
                setRatio(r);
                touch();
              }}
            >
              <span
                className={`ratio ${r === "9:16" ? "tall" : "wide"}`}
                aria-hidden
              />
              <strong>{r}</strong>
              <small>
                {r === "9:16" ? "TikTok · Reels · Shorts" : "YouTube · Web"}
              </small>
            </button>
          ))}
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={autoRewrite}
            disabled={busy}
            onChange={(e) => {
              setAutoRewrite(e.target.checked);
              touch();
            }}
          />
          <span className="track" aria-hidden />
          <span>
            <strong>{t("Réécriture automatique")}</strong>
            <small>{t("L’IA transforme votre idée en script pro.")}</small>
          </span>
        </label>

        {rewritten && (
          <p className="script-preview rewritten">
            <span>{t("Script réécrit")}</span>
            {rewritten}
          </p>
        )}

        <div className="launch">
          <div>
            <strong>{ratio} · HD</strong>
            <span>
              {enough || !model ? t("720p · son") : t("Crédits insuffisants")}
            </span>
          </div>
          <button
            className="button primary big"
            disabled={busy || !enough || script.trim().length < 3}
          >
            {step === "rewrite"
              ? t("Réécriture…")
              : step === "send"
                ? t("Lancement…")
                : t("Générer")}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="fine-print">
          {t("Prête en quelques minutes dans")}{" "}
          <Link href="/gallery">{t("Créations")}</Link>.{" "}
          {t("Échec = crédits rendus.")}
        </p>
      </form>
    </div>
  );
}

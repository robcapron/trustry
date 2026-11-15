"use client";

import { useActionState, useState } from "react";
import {
  connectMarketplaceAction,
  disconnectAction,
  regenerateApiKey,
  saveFrequency,
  saveMcpLevel,
  syncNowAction,
  testConnection,
  type ConnectorState,
} from "@/app/(app)/[espace]/parametres/[onglet]/connector-actions";
import { Button } from "@/components/trustry/button";
import type { ConnectorSpec } from "@/domain/connector-fields";
import { cn } from "@/lib/utils";

function Feedback({ state }: { state: ConnectorState }) {
  if (state.error) return <p className="text-meta text-critique" role="alert">{state.error}</p>;
  if (state.ok) return <p className="text-meta text-bon" role="status">{state.ok}</p>;
  return null;
}

export function CopyField({ value, dark = false }: { value: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <code
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center overflow-x-auto rounded-item px-4 font-mono text-meta whitespace-nowrap",
          dark ? "bg-white/10 text-fluo" : "bg-blanc text-ink",
        )}
      >
        {value}
      </code>
      <Button
        type="button"
        variant={dark ? "accent" : "secondary"}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copié" : "Copier"}
      </Button>
    </div>
  );
}

function Toggle({ checked, disabled, label }: { checked: boolean; disabled?: boolean; label: string }) {
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "relative inline-block h-[26px] w-[44px] flex-none rounded-full transition-colors disabled:cursor-not-allowed",
        checked ? "bg-fluo" : "bg-white/25",
      )}
    >
      <span className={cn("absolute top-[3px] left-0 size-5 rounded-full bg-carbone transition-transform", checked ? "translate-x-[21px]" : "translate-x-[3px]", !checked && "bg-blanc")} />
    </button>
  );
}

const LEVELS = [
  { key: "read", title: "Lecture des données", text: "Profit, P&L, alertes, catalogue, commandes" },
  { key: "actions_with_approval", title: "Actions avec validation", text: "Débloquer une réf, ajuster un prix ou une enchère après votre accord" },
  { key: "actions_auto", title: "Actions automatiques", text: "Claude agit sans validation (déconseillé)" },
] as const;

/** Les 3 niveaux d'accès de Claude, cumulatifs : lecture toujours active. */
export function McpLevels({ espace, level, canEdit }: { espace: string; level: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ConnectorState, FormData>(saveMcpLevel, {});
  const rank = LEVELS.findIndex((l) => l.key === level);
  return (
    <div className="flex flex-col">
      {LEVELS.map((l, i) => {
        const on = i <= rank;
        const next = i === 0 ? "read" : on ? LEVELS[i - 1].key : l.key;
        return (
          <form key={l.key} action={action} className="flex items-center justify-between gap-4 border-t border-white/10 py-3 first:border-0">
            <input type="hidden" name="espace" value={espace} />
            <input type="hidden" name="niveau" value={next} />
            <span>
              <span className="block text-ui font-semibold">{l.title}</span>
              <span className="block text-caption text-on-dark-muted">{l.text}</span>
            </span>
            <Toggle checked={on} disabled={!canEdit || i === 0 || pending} label={l.title} />
          </form>
        );
      })}
      {state.error ? <p className="text-meta text-[#fda29b]">{state.error}</p> : null}
    </div>
  );
}

export function ApiKeyForm({ espace, prefix, canEdit }: { espace: string; prefix: string | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ConnectorState, FormData>(regenerateApiKey, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="espace" value={espace} />
      {state.key ? (
        <CopyField value={state.key} />
      ) : (
        <div className="flex gap-2">
          <code className="flex h-11 min-w-0 flex-1 items-center rounded-item bg-blanc px-4 font-mono text-meta">
            {prefix ? `${prefix.slice(0, 9)}${"•".repeat(16)}${prefix.slice(-4)}` : "Aucune clé"}
          </code>
          {canEdit ? (
            <Button type="submit" variant="secondary" disabled={pending}>
              {prefix ? "Régénérer" : "Créer une clé"}
            </Button>
          ) : null}
        </div>
      )}
      <Feedback state={state} />
    </form>
  );
}

export function FrequencySelect({ espace, value, canEdit }: { espace: string; value: number; canEdit: boolean }) {
  const [state, action] = useActionState<ConnectorState, FormData>(saveFrequency, {});
  return (
    <form action={action}>
      <input type="hidden" name="espace" value={espace} />
      <select
        name="frequence"
        defaultValue={String(value)}
        disabled={!canEdit}
        aria-label="Fréquence de synchronisation"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-10 rounded-full bg-blanc px-4 text-ui"
      >
        <option value="15">Toutes les 15 min</option>
        <option value="60">Toutes les heures</option>
        <option value="1440">Une fois par jour</option>
      </select>
      {state.error ? <p className="mt-1 text-caption text-critique">{state.error}</p> : null}
    </form>
  );
}

export function ConnectForm({
  espace,
  marketplace,
  name,
  spec,
  scopes,
  allowTest,
}: {
  espace: string;
  marketplace: string;
  name: string;
  spec: ConnectorSpec;
  scopes: readonly { key: string; label: string }[];
  allowTest: boolean;
}) {
  const oauth = spec.family === "oauth";
  const [method, setMethod] = useState<"api" | "mcp" | "test">(oauth ? "mcp" : "api");
  const [testState, testAction, testing] = useActionState<ConnectorState, FormData>(testConnection, {});
  const [state, action, pending] = useActionState<ConnectorState, FormData>(connectMarketplaceAction, {});
  const methods = [
    { key: "api" as const, title: spec.label, text: oauth ? "Autorisation OAuth (bientôt)" : "Remontée automatique", disabled: oauth },
    { key: "mcp" as const, title: "Via Claude", text: "Connecteur MCP", disabled: false },
    ...(allowTest ? [{ key: "test" as const, title: "Données de test", text: "Connecteur fictif", disabled: false }] : []),
  ];
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="espace" value={espace} />
      <input type="hidden" name="marketplace" value={marketplace} />
      <input type="hidden" name="methode" value={method} />
      <fieldset>
        <legend className="mb-2 text-ui font-semibold">Méthode de connexion</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {methods.map((m) => (
            <label
              key={m.key}
              className={cn(
                "flex cursor-pointer items-start justify-between gap-2 rounded-item border bg-blanc px-4 py-3",
                method === m.key ? "border-2 border-carbone" : "border-line",
                m.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span>
                <span className="block text-ui font-semibold">{m.title}</span>
                <span className="block text-caption text-muted">{m.text}</span>
              </span>
              <input type="radio" name="_methode" checked={method === m.key} disabled={m.disabled} onChange={() => setMethod(m.key)} className="mt-1 accent-carbone" />
            </label>
          ))}
        </div>
      </fieldset>

      {method === "api" && !oauth
        ? spec.fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-1.5">
              <span className="text-ui font-semibold">{f.label}</span>
              <input
                name={f.name}
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                defaultValue={f.defaultValue}
                placeholder={f.placeholder}
                className="h-11 rounded-item border border-line bg-blanc px-4 text-ui outline-none focus:border-carbone"
              />
              {f.hint ? <span className="text-caption text-muted">{f.hint}</span> : null}
            </label>
          ))
        : null}
      {method === "mcp" ? (
        <p className="rounded-item bg-blanc px-4 py-3 text-meta text-ink-2">
          Claude récupère les données de {name} avec vos connecteurs (Amazon, Odoo...) et les envoie à Trustry via le serveur MCP de l&apos;espace.
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-ui font-semibold">Données à synchroniser</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {scopes.map((s) => (
            <label key={s.key} className="flex items-center gap-2.5 text-ui">
              <input type="checkbox" name={`scope_${s.key}`} defaultChecked={s.key !== "ads" || marketplace.startsWith("amazon")} className="size-[18px] accent-carbone" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col items-start gap-2.5">
        {method === "api" && !oauth ? (
          <Button type="submit" variant="secondary" formAction={testAction} disabled={testing}>
            {testing ? "Test en cours..." : "Tester la connexion"}
          </Button>
        ) : null}
        <Feedback state={testState} />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Connexion..." : `Connecter ${name}`}
        </Button>
        <Feedback state={state} />
      </div>
      <p className="text-caption text-muted">Première synchro : 30 jours d&apos;historique, quelques minutes.</p>
    </form>
  );
}

export function ManageActions({ espace, connectionId, canEdit }: { espace: string; connectionId: string; canEdit: boolean }) {
  const [syncState, syncAction, syncing] = useActionState<ConnectorState, FormData>(syncNowAction, {});
  const [discState, discAction, disconnecting] = useActionState<ConnectorState, FormData>(disconnectAction, {});
  if (!canEdit) return null;
  return (
    <div className="flex flex-col items-start gap-2.5">
      <form action={syncAction}>
        <input type="hidden" name="espace" value={espace} />
        <input type="hidden" name="connexion" value={connectionId} />
        <Button type="submit" variant="primary" disabled={syncing}>
          {syncing ? "Synchro..." : "Synchroniser maintenant"}
        </Button>
      </form>
      <Feedback state={syncState} />
      <form
        action={discAction}
        onSubmit={(e) => {
          if (!confirm("Déconnecter cette marketplace ? L'historique est conservé.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="espace" value={espace} />
        <input type="hidden" name="connexion" value={connectionId} />
        <Button type="submit" variant="ghost" disabled={disconnecting}>
          Déconnecter
        </Button>
      </form>
      <Feedback state={discState} />
    </div>
  );
}

import type { Metadata } from "next";
import { Button } from "@/components/trustry/button";
import { Card } from "@/components/trustry/card";
import { ROLE_LABEL } from "@/domain/access";
import { isAllowedRedirectUri, workspaceFromResource } from "@/domain/oauth";
import { isDemoMode } from "@/lib/env";
import { listWorkspaces, requireUser } from "@/server/data";
import { getClient } from "@/server/mcp/auth";
import { createSupabaseAdminClient, hasAdminAccess } from "@/server/supabase/admin";
import { decide } from "./actions";

export const metadata: Metadata = { title: "Autoriser l'accès à Trustry" };

function Problem({ text }: { text: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <Card>
        <h1 className="text-title font-semibold">Autorisation impossible</h1>
        <p className="mt-2 text-ui text-muted">{text}</p>
      </Card>
    </main>
  );
}

/** Écran de consentement OAuth : l'utilisateur relie un client MCP (Claude) à l'un de ses espaces. */
export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/autoriser">) {
  const q = await searchParams;
  const str = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");
  if (isDemoMode() || !hasAdminAccess()) return <Problem text="Le serveur MCP n'est pas disponible en mode démo." />;
  if (str("response_type") !== "code" || str("code_challenge_method") !== "S256" || !str("code_challenge")) {
    return <Problem text="Requête OAuth invalide : code et PKCE (S256) obligatoires." />;
  }
  const client = await getClient(createSupabaseAdminClient(), str("client_id"));
  const redirectUri = str("redirect_uri");
  if (!client || !client.redirect_uris.includes(redirectUri) || !isAllowedRedirectUri(redirectUri)) {
    return <Problem text="Application inconnue ou adresse de retour non autorisée." />;
  }
  const [user, workspaces] = await Promise.all([requireUser(), listWorkspaces()]);
  if (!workspaces.length) return <Problem text="Vous n'avez accès à aucun espace client." />;
  const wanted = workspaceFromResource(str("resource"));
  const preselected = workspaces.find((w) => w.slug === wanted)?.slug ?? workspaces[0].slug;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6">
      <p className="font-brand text-[28px] font-black italic">TRUSTRY</p>
      <Card>
        <h1 className="text-title font-semibold">{client.client_name} demande l&apos;accès à Trustry</h1>
        <p className="mt-1.5 text-ui text-muted">Connecté en tant que {user.email}.</p>
        <form action={decide} className="mt-5 flex flex-col gap-4">
          {["client_id", "redirect_uri", "state", "code_challenge"].map((k) => (
            <input key={k} type="hidden" name={k} value={k === "client_id" ? client.client_id : str(k)} />
          ))}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-ui font-semibold">Espace client</legend>
            {workspaces.map((w) => (
              <label key={w.id} className="flex items-center justify-between gap-3 rounded-item bg-blanc px-4 py-3">
                <span>
                  <span className="block text-ui font-semibold">{w.name}</span>
                  <span className="block text-caption text-muted">{ROLE_LABEL[w.role]}</span>
                </span>
                <input type="radio" name="espace" value={w.slug} defaultChecked={w.slug === preselected} className="accent-carbone" />
              </label>
            ))}
          </fieldset>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-meta text-ink-2">
            <li>Lecture : profit, P&amp;L, alertes, prévision, revue mensuelle, connecteurs.</li>
            <li>Actions : selon le niveau choisi par l&apos;admin de l&apos;espace (avec validation par défaut).</li>
            <li>Vos droits restent ceux de votre rôle ; l&apos;accès s&apos;arrête si vous quittez l&apos;espace.</li>
          </ul>
          <div className="flex gap-2.5">
            <Button type="submit" name="decision" value="autoriser" variant="primary">
              Autoriser
            </Button>
            <Button type="submit" name="decision" value="refuser" variant="secondary">
              Refuser
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/trustry/button";
import { sendMagicLink, signIn, type AuthState } from "./actions";

const input =
  "h-[42px] rounded-nav border border-line bg-blanc px-3.5 text-nav font-normal text-ink outline-0 focus:border-carbone";

export function LoginForm({ suite }: { suite?: string }) {
  const [state, login, pending] = useActionState<AuthState, FormData>(signIn, {});
  const [linkState, magic, sending] = useActionState<AuthState, FormData>(sendMagicLink, {});
  const message = state.error ?? linkState.error;

  return (
    <form action={login} className="flex flex-col gap-4">
      <input type="hidden" name="suite" value={suite ?? ""} />
      <label className="flex flex-col gap-1.5 text-meta font-semibold">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} placeholder="vous@entreprise.fr" />
      </label>
      <label className="flex flex-col gap-1.5 text-meta font-semibold">
        Mot de passe
        <input name="password" type="password" autoComplete="current-password" className={input} />
      </label>
      {message ? (
        <p role="alert" className="rounded-nav bg-critique-soft px-3 py-2 text-meta text-critique">
          {message}
        </p>
      ) : null}
      {linkState.info ? (
        <p role="status" className="rounded-nav bg-bon-soft px-3 py-2 text-meta text-bon">
          {linkState.info}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="mt-1 w-full">
        {pending ? "Connexion..." : "Se connecter"}
      </Button>
      <Button type="submit" formAction={magic} formNoValidate variant="secondary" disabled={sending} className="w-full">
        {sending ? "Envoi..." : "Recevoir un lien de connexion"}
      </Button>
    </form>
  );
}

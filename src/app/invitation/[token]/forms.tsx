"use client";

import { useActionState } from "react";
import { Button } from "@/components/trustry/button";
import { acceptInvite, sendInviteLink, type InviteState } from "./actions";

export function EmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(sendInviteLink, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1.5 text-meta font-semibold">
        Votre email (celui qui a reçu l&apos;invitation)
        <input name="email" type="email" required className="h-[42px] rounded-nav border border-line px-3.5 text-nav font-normal outline-0 focus:border-carbone" />
      </label>
      {state.error ? <p className="rounded-nav bg-critique-soft px-3 py-2 text-meta text-critique">{state.error}</p> : null}
      {state.info ? <p className="rounded-nav bg-bon-soft px-3 py-2 text-meta text-bon">{state.info}</p> : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Envoi..." : "Recevoir mon lien d'accès"}
      </Button>
    </form>
  );
}

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(acceptInvite, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? <p className="rounded-nav bg-critique-soft px-3 py-2 text-meta text-critique">{state.error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Validation..." : "Rejoindre l'espace"}
      </Button>
    </form>
  );
}

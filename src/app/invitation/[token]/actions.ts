"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type InviteState = { error?: string; info?: string };

/** Envoie un lien de connexion (crée le compte si besoin) qui ramène sur l'invitation. */
export async function sendInviteLink(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const email = z.email().safeParse(formData.get("email"));
  const token = z.string().min(10).max(100).safeParse(formData.get("token"));
  if (!email.success || !token.success) return { error: "Adresse email invalide." };
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback?suite=${encodeURIComponent(`/invitation/${token.data}`)}`, shouldCreateUser: true },
  });
  if (error) return { error: "Envoi impossible pour le moment. Réessayez dans quelques minutes." };
  return { info: "Lien envoyé : ouvrez l'email reçu pour finaliser votre accès." };
}

export async function acceptInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error) return { error: error.message };
  redirect(`/${data as string}/dashboard`);
}

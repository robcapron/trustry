"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type AuthState = { error?: string; info?: string };

const credentials = z.object({
  email: z.email({ error: "Adresse email invalide." }),
  password: z.string().min(8, { error: "Le mot de passe doit faire au moins 8 caractères." }),
  suite: z.string().optional(),
});

function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (isDemoMode()) redirect("/");
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: "Email ou mot de passe incorrect." };
  redirect(safeNext(parsed.data.suite));
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (isDemoMode()) redirect("/");
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Saisissez votre adresse email pour recevoir un lien." };
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: false },
  });
  if (error) return { error: "Envoi impossible pour le moment. Réessayez dans quelques minutes." };
  return { info: "Lien envoyé. Ouvrez l'email reçu pour vous connecter." };
}

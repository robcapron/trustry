import type { Metadata } from "next";
import { EmptyState } from "@/components/trustry/states";
import { ROLE_LABEL, type Role } from "@/domain/access";
import { isDemoMode } from "@/lib/env";
import { getCurrentUser } from "@/server/data";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { AcceptForm, EmailForm } from "./forms";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/trustry-logo.svg" alt="Trustry" width={140} height={44} className="h-auto w-[140px]" />
      {children}
    </main>
  );

  if (isDemoMode()) {
    return shell(<EmptyState icon="lock" title="Invitations indisponibles en mode démo" description="Connectez Supabase pour inviter des membres." />);
  }

  const user = await getCurrentUser();
  if (!user) {
    return shell(
      <>
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.03em]">Vous êtes invité sur Trustry</h1>
          <p className="mt-1.5 text-sm text-muted">Recevez un lien de connexion par email pour rejoindre l&apos;espace.</p>
        </div>
        <EmailForm token={token} />
      </>,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("invitation_preview", { invite_token: token });
  const invite = (data as { workspace_name: string; email: string; role: Role; expired: boolean; accepted: boolean }[] | null)?.[0];
  if (!invite || invite.expired || invite.accepted) {
    return shell(
      <EmptyState
        icon="lock"
        title={invite?.accepted ? "Invitation déjà utilisée" : invite?.expired ? "Invitation expirée" : "Invitation introuvable"}
        description="Demandez un nouveau lien à l'administrateur de l'espace."
      />,
    );
  }
  return shell(
    <>
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.03em]">Rejoindre {invite.workspace_name}</h1>
        <p className="mt-1.5 text-sm text-muted">
          Rôle : {ROLE_LABEL[invite.role]}. Connecté en tant que {user.email}.
        </p>
      </div>
      <AcceptForm token={token} />
    </>,
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/trustry/button";
import { isDemoMode } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const suite = typeof params.suite === "string" ? params.suite : undefined;
  const linkError = params.erreur === "lien";
  const demo = isDemoMode();

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/trustry-logo.svg" alt="Trustry" width={140} height={44} className="mb-10 h-auto w-[140px]" />
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.03em]">Connexion</h1>
          <p className="mt-1.5 mb-8 text-sm text-muted">Accédez au pilotage de vos marketplaces.</p>
          {linkError ? (
            <p role="alert" className="mb-4 rounded-nav bg-critique-soft px-3 py-2 text-meta text-critique">
              Ce lien de connexion a expiré. Demandez-en un nouveau.
            </p>
          ) : null}
          {demo ? (
            <div className="flex flex-col gap-3">
              <p className="rounded-nav bg-info-soft px-3 py-2 text-meta text-info">
                Mode démo : données d&apos;exemple, aucune connexion requise.
              </p>
              <Button asChild variant="primary" className="w-full">
                <Link href="/">Entrer dans la démo</Link>
              </Button>
            </div>
          ) : (
            <LoginForm suite={suite} />
          )}
        </div>
      </section>
      <section aria-hidden className="relative hidden overflow-hidden bg-carbone lg:flex lg:flex-col lg:justify-end lg:p-14">
        <p className="font-brand text-[56px] leading-[0.95] font-black text-blanc italic">
          Le pilotage
          <br />
          de vos <span className="text-fluo">marketplaces.</span>
        </p>
        <p className="mt-6 max-w-md text-sm text-on-dark-muted">
          Canaux, pays, SKU, alertes priorisées et les 7 piliers de la gestion marketplace, au même endroit.
        </p>
      </section>
    </main>
  );
}

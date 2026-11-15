import { redirect } from "next/navigation";
import { listWorkspaces, requireUser } from "@/server/data";

/** Accueil : on ouvre le Dashboard du premier espace accessible. */
export default async function Home() {
  await requireUser();
  const workspaces = await listWorkspaces();
  if (workspaces.length === 0) redirect("/bienvenue");
  redirect(`/${workspaces[0].slug}/dashboard`);
}

import { redirect } from "next/navigation";

export default async function ParametresIndex({ params }: PageProps<"/[espace]/parametres">) {
  const { espace } = await params;
  redirect(`/${espace}/parametres/espace`);
}

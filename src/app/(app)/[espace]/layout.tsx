import { notFound } from "next/navigation";
import { MobileTabBar, MobileTopBar } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import type { SwitcherWorkspace } from "@/components/layout/workspace-switcher";
import { canUseModule, MODULES } from "@/domain/access";
import { isDemoMode } from "@/lib/env";
import { getNavCounts, getWorkspace, listWorkspaces, requireUser } from "@/server/data";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/[espace]">) {
  const { espace } = await params;
  const user = await requireUser();
  const [workspace, workspaces] = await Promise.all([getWorkspace(espace), listWorkspaces()]);
  if (!workspace) notFound();
  const counts = await getNavCounts(workspace.id);

  const toSwitcher = (w: typeof workspace): SwitcherWorkspace => ({
    slug: w.slug,
    name: w.name,
    role: w.role,
    organizationName: w.organizationName,
    organizationWorkspaceCount: w.organizationWorkspaceCount,
  });
  const current = toSwitcher(workspace);
  const all = workspaces.map(toSwitcher);
  const modules = MODULES.filter((m) =>
    canUseModule({ module: m, role: workspace.role, enabledModules: workspace.enabledModules, grantedModules: workspace.grantedModules }),
  );

  return (
    <div className="flex min-h-dvh bg-blanc">
      <Sidebar current={current} workspaces={all} counts={counts} userEmail={user.email} modules={modules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar current={current} workspaces={all} userEmail={user.email} />
        {isDemoMode() ? (
          <p className="bg-fluo px-4 py-1.5 text-center text-caption font-semibold text-carbone">
            Mode démo - données d&apos;exemple<span className="hidden sm:inline">, aucune marketplace réelle connectée</span>
          </p>
        ) : null}
        <main className="mx-auto flex w-full max-w-main min-w-0 flex-1 flex-col gap-4 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-14">
          {children}
        </main>
        <MobileTabBar slug={workspace.slug} counts={counts} />
      </div>
    </div>
  );
}

import "server-only";
import { canUseModule, type ModuleKey } from "@/domain/access";
import { getWorkspace } from "./data";
import type { WorkspaceSummary } from "./types";

/** Retourne l'espace si l'utilisateur peut utiliser le module, sinon null. */
export async function workspaceWithModule(slug: string, module: ModuleKey): Promise<WorkspaceSummary | null> {
  const workspace = await getWorkspace(slug);
  if (!workspace) return null;
  const ok = canUseModule({
    module,
    role: workspace.role,
    enabledModules: workspace.enabledModules,
    grantedModules: workspace.grantedModules,
  });
  return ok ? workspace : null;
}

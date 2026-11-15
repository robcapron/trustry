import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { updateEcbRates } from "@/server/sync/fx-rates";
import { runAlertEngine } from "@/server/sync/run-alerts";
import { runConnectionSync } from "@/server/sync/run-sync";
import { EVENTS, inngest } from "./client";

/** Toutes les 15 minutes : lance la synchro des connexions dues selon leur fréquence. */
export const scheduleSyncs = inngest.createFunction(
  { id: "planifier-synchros", triggers: [{ cron: "TZ=Europe/Paris */15 * * * *" }] },
  async ({ step }) => {
    const due = await step.run("connexions-a-synchroniser", async () => {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("connections")
        .select("id, workspace_id, adapter, status, last_sync_at, sync_frequency_minutes")
        .in("status", ["connected", "error", "syncing"]);
      const now = Date.now();
      return (data ?? [])
        .filter((c) => c.adapter === "mock" || c.adapter === "native")
        .filter((c) => !c.last_sync_at || now - new Date(c.last_sync_at).getTime() >= (c.sync_frequency_minutes - 1) * 60_000)
        .map((c) => ({ id: c.id as string, workspaceId: c.workspace_id as string }));
    });
    if (due.length) {
      await step.sendEvent(
        "envoyer-synchros",
        due.map((c) => ({ name: EVENTS.syncConnection, data: { connectionId: c.id, workspaceId: c.workspaceId } })),
      );
    }
    return { scheduled: due.length };
  },
);

/** Synchro d'une connexion, puis réévaluation des alertes de l'espace. Une seule synchro à la fois par connexion. */
export const syncConnection = inngest.createFunction(
  {
    id: "synchroniser-connexion",
    triggers: [{ event: EVENTS.syncConnection }],
    concurrency: [{ key: "event.data.connectionId", limit: 1 }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { connectionId, workspaceId } = event.data as { connectionId: string; workspaceId: string };
    const result = await step.run("synchro", () => runConnectionSync(createSupabaseAdminClient(), connectionId));
    if (result.status === "success") {
      await step.sendEvent("alertes", { name: EVENTS.evaluateAlerts, data: { workspaceId } });
    }
    return result;
  },
);

/** Moteur d'alertes d'un espace ; regroupe les demandes rapprochées (une évaluation par minute et par espace). */
export const evaluateAlerts = inngest.createFunction(
  {
    id: "evaluer-alertes",
    triggers: [{ event: EVENTS.evaluateAlerts }, { cron: "TZ=Europe/Paris 0 * * * *" }],
    debounce: { key: "event.data.workspaceId", period: "60s" },
  },
  async ({ event, step }) => {
    const workspaceIds = await step.run("espaces", async () => {
      const id = (event?.data as { workspaceId?: string } | undefined)?.workspaceId;
      if (id) return [id];
      const { data } = await createSupabaseAdminClient().from("workspaces").select("id");
      return (data ?? []).map((w) => w.id as string);
    });
    const results = [];
    for (const ws of workspaceIds) {
      results.push(await step.run(`alertes-${ws}`, () => runAlertEngine(createSupabaseAdminClient(), ws)));
    }
    return results;
  },
);

/** Taux BCE : publiés vers 16 h, récupérés chaque jour ouvré à 16 h 30 (Paris). */
export const fetchEcbRates = inngest.createFunction(
  { id: "taux-bce", triggers: [{ cron: "TZ=Europe/Paris 30 16 * * 1-5" }], retries: 5 },
  async ({ step }) => step.run("taux", () => updateEcbRates(createSupabaseAdminClient())),
);

export const functions = [scheduleSyncs, syncConnection, evaluateAlerts, fetchEcbRates];

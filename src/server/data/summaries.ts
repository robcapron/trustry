import type { ConnectionStatus, SyncSummary } from "../types";

export function summarizeConnections(statuses: ConnectionStatus[]): SyncSummary {
  return {
    total: statuses.length,
    upToDate: statuses.filter((s) => s === "connected").length,
    syncing: statuses.filter((s) => s === "syncing").length,
    errors: statuses.filter((s) => s === "error").length,
    notConnected: statuses.filter((s) => s === "not_connected").length,
  };
}

import { Inngest } from "inngest";

/** Client Inngest de Trustry (jobs : synchro des connecteurs, moteur d'alertes, taux BCE). */
export const inngest = new Inngest({ id: "trustry" });

export const EVENTS = {
  syncConnection: "trustry/connection.sync",
  evaluateAlerts: "trustry/alerts.evaluate",
} as const;

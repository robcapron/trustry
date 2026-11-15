import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Point d'entrée appelé par Inngest (signé avec INNGEST_SIGNING_KEY en production).
export const { GET, POST, PUT } = serve({ client: inngest, functions });

// Une synchro complète peut prendre du temps (plusieurs marketplaces et pays).
export const maxDuration = 300;

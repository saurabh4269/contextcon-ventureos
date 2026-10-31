"use client";
// Settings: Connectors read GET /api/integrations/connectors (real config + health checks) over the connector catalogue.
// Gmail / Calendar / Meet: Connect runs the real Google sign-in (/api/oauth/google/start → callback stores the token
// locally) and Disconnect removes the stored sign-in. Other keys live in server env, so their Connect/Disconnect fail
// with an explicit message instead of a timer-driven "Connected". Workflow, members, access and export have no data
// source here and render the unavailable state. Sync re-runs the health checks (recorded in organizational memory).
import { useState } from "react";
import { SettingsScreen } from "@port/screens/settings";
import type { ConnectorsView } from "@port/components/connectors";
import type { SettingsSection, ShellData } from "@port/types";
import { toLiveConnectors, UI_IDS_BY_API_ID } from "@/lib/adapters/connectors";
import { connectorCatalogue } from "@/lib/connectors/catalogue";
import type { IntegrationsResponse } from "@/lib/live/types";
import { failureMessage, useLiveJson } from "./useLiveJson";
import { UnavailableBlock } from "./unavailable";

const LIVE_UI_IDS = new Set(Object.values(UI_IDS_BY_API_ID).flat());
const GOOGLE_UI_IDS = new Set([...(UI_IDS_BY_API_ID.gmail ?? []), ...(UI_IDS_BY_API_ID.calendar ?? [])]);

export function LiveSettings({ shell, initialSection, view }: { shell: ShellData; initialSection: SettingsSection; view: ConnectorsView }) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const res = useLiveJson<IntegrationsResponse>("/api/integrations/connectors");
  const connectors = res.state === "ok" ? toLiveConnectors(connectorCatalogue, res.data) : connectorCatalogue;
  const status = res.state === "loading" ? "loading" : res.state === "failed" ? "error" : "ready";
  const env = (id: string) => (res.state === "ok" ? res.data.connectors.find((c) => UI_IDS_BY_API_ID[c.id]?.includes(id)) : undefined);

  return (
    <SettingsScreen shell={shell} data={{ isAdmin: false, connectors }} section={section} onSection={setSection} connectorsView={view}
      unavailable={() => <UnavailableBlock screen="settings" />}
      loadingCards={connectorCatalogue.items.length} status={status} error={res.state === "failed" ? failureMessage(res, "Couldn’t load connector status") : undefined} onRetry={() => void res.reload(true)}
      onConnect={async (id) => {
        const info = env(id);
        if (!LIVE_UI_IDS.has(id) || !info) throw new Error("Not available in this build yet — this tile is part of the catalogue only.");
        if (GOOGLE_UI_IDS.has(id)) { window.location.assign("/api/oauth/google/start"); return; }
        throw new Error(`Connect from the server: set ${info.env.join(" or ")} in the environment, then use Sync to re-check. ${info.detail}`);
      }}
      onSyncConnector={async () => {
        const r = await res.reload(true);
        if (r.state !== "ok") throw new Error("Health check failed");
      }}
      onDisconnect={async (id) => {
        if (!GOOGLE_UI_IDS.has(id)) throw new Error("Keys are configured in the server environment; remove the env var to disconnect.");
        const r = await fetch("/api/oauth/google/disconnect", { method: "POST" });
        const j = (await r.json().catch(() => null)) as { message?: string } | null;
        await res.reload(true);
        if (!r.ok) throw new Error(j?.message ?? `Disconnect failed (HTTP ${r.status})`);
      }}
      onSaveKey={async () => { throw new Error("Keys are configured in the server environment, not saved from the UI."); }} />
  );
}

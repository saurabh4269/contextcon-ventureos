"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
// ?tab=connectors (or ?section=) · connectors: &filter=connected|attention|available &category=data|email|… &q=… &connect=<id> &manage=<id> &status=loading|empty|error
// Live mode (DEALDESK_DATA_MODE=live): Connectors come from GET /api/integrations/connectors; see src/live/settings.tsx.
import { use, useState } from "react";
import { SettingsScreen } from "@port/screens/settings";
import { shellInvest, settings, settingsMember } from "@port/fixtures";
import type { ConnectorCategoryId, LoadStatus, SettingsSection } from "@port/types";
import type { ConnectorTab } from "@port/components/connectors";
import { useDataMode } from "@/components/datamode";
import { LiveSettings } from "@/live/settings";
import { liveShellFrom } from "@/live/shell";
const SECTIONS: SettingsSection[] = ["workflow", "connectors", "integrations", "members", "access", "export"];
type Q = { section?: string; tab?: string; member?: string; status?: string; filter?: string; category?: string; q?: string; connect?: string; manage?: string };
export default function Settings({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const mode = useDataMode();
  const want = (q.tab ?? q.section) as SettingsSection;
  const [s, setS] = useState<SettingsSection>(SECTIONS.includes(want) ? want : "workflow");
  const base = q.member ? settingsMember : settings;
  const view = { tab: q.filter as ConnectorTab, category: q.category as ConnectorCategoryId, q: q.q, connect: q.connect, manage: q.manage };
  if (mode === "live") return <LiveSettings shell={liveShellFrom(shellInvest)} initialSection={s} view={view} />;
  const status = (["loading", "error"] as LoadStatus[]).includes(q.status as LoadStatus) ? (q.status as LoadStatus) : "ready";
  const data = q.status === "empty" ? { ...base, connectors: { ...base.connectors, items: [] } } : base;
  // Demo mode: connect/sync/disconnect are simulated with short delays and labelled as demo in the connect modal.
  return <SettingsScreen shell={shellInvest} data={data} section={s} onSection={setS} status={status} onRetry={() => location.reload()}
    connectorsView={view} connectorsDemo
    onSyncConnector={() => new Promise((r) => setTimeout(r, 1200))}
    onDisconnect={() => new Promise((r) => setTimeout(r, 500))}
    onConnect={() => new Promise((r) => setTimeout(r, 1100))}
    onPatchConfig={() => new Promise((r) => setTimeout(r, 400))}
    onExportBundle={() => new Promise((r) => setTimeout(() => r({ url: "#", size: "84 MB" }), 1200))}
    onSaveKey={(_p, k) => new Promise((r) => setTimeout(() => r({ masked: k.slice(0, 3) + "…" + k.slice(-4) }), 500))} />;
}

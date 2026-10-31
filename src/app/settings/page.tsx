"use client";
// Settings: Connectors are live (GET /api/integrations/connectors); other sections render the unavailable state.
// ?section=<id> picks the section · connectors view: &filter=connected|attention|available &category=<id> &q=<search>
import { use } from "react";
import type { ConnectorCategoryId, SettingsSection } from "@port/types";
import type { ConnectorTab } from "@port/components/connectors";
import { LiveSettings } from "@/live/settings";
import { liveShell } from "@/live/shell";

const SECTIONS: SettingsSection[] = ["workflow", "connectors", "integrations", "members", "access", "export"];
type Q = { section?: string; tab?: string; filter?: string; category?: string; q?: string };
export default function Settings({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const want = (q.section ?? q.tab) as SettingsSection;
  return <LiveSettings shell={liveShell} initialSection={SECTIONS.includes(want) ? want : "connectors"} view={{ tab: q.filter as ConnectorTab, category: q.category as ConnectorCategoryId, q: q.q }} />;
}

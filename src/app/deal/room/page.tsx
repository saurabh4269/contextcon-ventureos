"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
// v4 · ?id=helio&file=deck|bank opens Helio's room at that file (the deal page's evidence links land here).
// Live mode: ?id=<domain> (from a live deal) has no data room source in this build → explicit empty state.
import { use, useState } from "react";
import { DataRoomScreen } from "@port/screens/dataroom";
import { Page, TopBar } from "@port/components/shell";
import { EmptyState } from "@port/components/states";
import { shellInvest, dataRoom, helioRoom, helioRoomFiles } from "@port/fixtures";
import { useDataMode, useLiveCoverage } from "@/components/datamode";
export default function Room({ searchParams }: { searchParams: Promise<{ walled?: string; id?: string; file?: string }> }) {
  const q = use(searchParams);
  const mode = useDataMode();
  const [file, setFile] = useState(q.file ?? "deck");
  if (mode === "live" && q.id?.includes(".")) return <NoRoom domain={q.id} />;
  if (q.id === "helio") return <DataRoomScreen shell={shellInvest} data={helioRoom(file)} walled={!!q.walled} onOpenFile={(f) => (helioRoomFiles as readonly string[]).includes(f) && setFile(f)} onOpenFolder={(f) => setFile(f === "fin" ? "bank" : f === "pitch" ? "deck" : file)} />;
  return <DataRoomScreen shell={shellInvest} data={dataRoom} walled={!!q.walled} />;
}
function NoRoom({ domain }: { domain: string }) {
  useLiveCoverage("Live · no data room source", "demo");
  return (
    <Page active="pipeline" shell={shellInvest} top={<TopBar crumbs={[{ label: domain, href: `/deal?domain=${encodeURIComponent(domain)}` }, { label: "Data room" }]} ctx={domain} />}>
      <EmptyState title="No data room connected" body={`This build has no data-room source (Drive, Dropbox, DocSend or uploads) for ${domain}, so there are no files or deck claims to show.`} />
    </Page>
  );
}

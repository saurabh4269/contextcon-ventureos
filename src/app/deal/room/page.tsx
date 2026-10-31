"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
// v4 · ?id=helio&file=deck|bank opens Helio's room at that file (the deal page's evidence links land here).
import { use, useState } from "react";
import { DataRoomScreen } from "@port/screens/dataroom";
import { shellInvest, dataRoom, helioRoom, helioRoomFiles } from "@port/fixtures";
export default function Room({ searchParams }: { searchParams: Promise<{ walled?: string; id?: string; file?: string }> }) {
  const q = use(searchParams);
  const [file, setFile] = useState(q.file ?? "deck");
  if (q.id === "helio") return <DataRoomScreen shell={shellInvest} data={helioRoom(file)} walled={!!q.walled} onOpenFile={(f) => (helioRoomFiles as readonly string[]).includes(f) && setFile(f)} onOpenFolder={(f) => setFile(f === "fin" ? "bank" : f === "pitch" ? "deck" : file)} />;
  return <DataRoomScreen shell={shellInvest} data={dataRoom} walled={!!q.walled} />;
}

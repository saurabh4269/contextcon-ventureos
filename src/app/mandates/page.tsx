"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { MandatesScreen } from "@port/screens/mandates";
import { shellBank, mandateHalyard, mandateCobalt } from "@port/fixtures";
export default function Mandates({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const q = use(searchParams);
  const [m, setM] = useState(q.m === "cobalt" ? "cobalt" : "halyard");
  return <MandatesScreen shell={shellBank} data={m === "cobalt" ? mandateCobalt : mandateHalyard} onSelectMandate={(id) => (id === "cobalt" || id === "halyard") && setM(id)} />;
}

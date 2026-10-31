"use client";
// Deal workflow: /workflow (deals, inbox candidates, start by domain), /workflow?id=<id> (one deal's ten-step timeline),
// /workflow?start=<domain>&name=<name> (auto-starts from an /ask result). Live data in both modes (there is no
// fixture workflow). The Settings › Workflow section (briefs and guardrails) stays at /settings?section=workflow.
import { use } from "react";
import { WorkflowScreen } from "@/live/workflow";

export default function Workflow({ searchParams }: { searchParams: Promise<{ id?: string; start?: string; name?: string }> }) {
  const q = use(searchParams);
  return <WorkflowScreen key={q.id ?? q.start ?? "list"} id={q.id} start={q.start} name={q.name} />;
}

"use client";
// Person page: /person?linkedin=<profile URL>[&domain=<company>] enriches the person live on Crustdata. ?tab= picks the tab.
import { use } from "react";
import type { PersonTab } from "@port/types";
import { LivePerson } from "@/live/person";
import { liveShell } from "@/live/shell";

export default function Person({ searchParams }: { searchParams: Promise<{ linkedin?: string; domain?: string; tab?: string }> }) {
  const q = use(searchParams);
  return <LivePerson shell={liveShell} linkedin={q.linkedin} domain={q.domain} tab={q.tab as PersonTab} />;
}
